/* 《咦，起风了》 custom WeChat first screen (GGbot, docs/first-screen.md). Replaces the Cocos Creator 3.8.8 wechatgame
 * template first-screen (templates/wechatgame/first-screen.ejs): the build copies build-templates/wechatgame/ LAST, so this
 * file overwrites the generated one. Same module contract as the template, used unchanged by the generated game.js:
 *   start(alpha, antialias, useWebgl2) -> Promise   (creates the WebGL context the engine reuses, starts drawing)
 *   setProgress(v) -> Promise                       (resolves after the next drawn frame)
 *   end() -> Promise                                (one more frame, then frees every GL object; engine starts after)
 * It draws ONLY our loading picture: startup-art/first_screen_composite.jpg (base + logo + title + EMPTY progress track),
 * aspect-fill centred with s = max(W/750, H/1624) -- the same transform as the scene loading layer
 * (assets/scripts/ui/StartupLoadingLayout.ts coverTransform). None of the template images (engine logo, slogan) nor its bar.
 * The progress track stays empty here on purpose: the scene layer's first frame shows the same picture with the
 * ribbon at its start, so nothing moves at the handoff (game.js's setProgress values are accepted and ignored).
 * Handoff: the decoded images are published as globalThis/GameGlobal.__firstScreen so WorldIntegrationBoot builds its
 * sprites synchronously in its first frame (no async load gap, no solid-colour flash).
 * Plain ES5 (var/function, no arrow/template/let/const) so no transpiler step is assumed. */
var COMPOSITE = 'startup-art/first_screen_composite.jpg';
var EXTRA = { fill: 'startup-art/bar_fill.png', pinwheel: 'startup-art/pinwheel.png' };
var DESIGN_W = 750, DESIGN_H = 1624;
var CLEAR = [217 / 255, 210 / 255, 196 / 255, 1];

var VS = 'attribute vec2 a_Position;\nattribute vec2 a_TexCoord;\nvarying vec2 v_TexCoord;\n' +
    'void main() {\n    gl_Position = vec4(a_Position, 0.0, 1.0);\n    v_TexCoord = a_TexCoord;\n}';
var FS = 'precision mediump float;\nuniform sampler2D u_Sampler;\nvarying vec2 v_TexCoord;\n' +
    'void main() {\n    gl_FragColor = texture2D(u_Sampler, v_TexCoord);\n}';

var options = {
    alpha: false,
    antialias: true,
    depth: true,
    stencil: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: false
};

var G = (typeof GameGlobal !== 'undefined' && GameGlobal) || (typeof globalThis !== 'undefined' && globalThis) ||
    (typeof window !== 'undefined' && window) || {};
var gl = null, cv = null, program = null, texture = null, vertexBuffer = null, aPosition = -1, aTexCoord = -1;
var image = null, imageReady = false, rafHandle = null, afterTick = null, lastW = 0, lastH = 0;
var state = {
    version: 1, art: COMPOSITE, design: [DESIGN_W, DESIGN_H], images: {}, image: null, ready: false, error: null,
    t: { start: -1, image: -1, firstArtFrame: -1, end: -1, released: -1 }, frames: 0, cover: null, ended: false
};
G.__firstScreen = state;
if (typeof globalThis !== 'undefined' && globalThis !== G) globalThis.__firstScreen = state;
if (typeof window !== 'undefined' && window !== G) window.__firstScreen = state;

function now() {
    try { if (typeof performance !== 'undefined' && performance.now) return performance.now(); } catch (e) {}
    return Date.now();
}

/** Same rule as StartupLoadingLayout.coverTransform (checked by tools/test_first_screen.cjs). */
function coverTransform(W, H) {
    var s = Math.max(W / DESIGN_W, H / DESIGN_H);
    return { s: s, dx: (W - DESIGN_W * s) / 2, dy: (H - DESIGN_H * s) / 2, w: DESIGN_W * s, h: DESIGN_H * s };
}

/** Quad in clip space for the cover rectangle; texture row 0 (image top) maps to the top edge (no UNPACK_FLIP_Y). */
function coverVertices(W, H) {
    var c = coverTransform(W, H), hx = c.w / W, hy = c.h / H;
    return [
        -hx, hy, 0, 0,
        -hx, -hy, 0, 1,
        hx, hy, 1, 0,
        hx, -hy, 1, 1
    ];
}

function loadShader(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log('[first-screen] shader: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram() {
    var vs = loadShader(gl.VERTEX_SHADER, VS), fs = loadShader(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.log('[first-screen] link: ' + gl.getProgramInfoLog(p));
        gl.deleteProgram(p);
        return null;
    }
    return p;
}

function updateVertices() {
    var W = cv.width, H = cv.height;
    if (W === lastW && H === lastH) return;
    lastW = W; lastH = H;
    state.cover = coverTransform(W, H);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coverVertices(W, H)), gl.STATIC_DRAW);
}

function uploadImage() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    // 750x1624 is NPOT: WebGL1 needs CLAMP_TO_EDGE + no mipmaps (same as the template background texture).
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

function draw() {
    gl.viewport(0, 0, cv.width, cv.height);
    gl.disable(gl.BLEND);
    gl.clearColor(CLEAR[0], CLEAR[1], CLEAR[2], CLEAR[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!imageReady || !program) return;
    updateVertices();
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program, 'u_Sampler'), 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 16, 8);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (state.t.firstArtFrame < 0) state.t.firstArtFrame = now();
}

function tick() {
    rafHandle = requestAnimationFrame(function () {
        try { draw(); } catch (e) { state.error = 'draw: ' + e; }
        state.frames++;
        tick();
        if (afterTick) { var cb = afterTick; afterTick = null; cb(); }
    });
}

function nextFrame() {
    return new Promise(function (resolve) {
        var prev = afterTick;
        afterTick = function () { if (prev) prev(); resolve(); };
    });
}

/** Never rejects: a missing picture must not stop the game from starting (the template would reject and hang). */
function loadImage(path) {
    return new Promise(function (resolve) {
        var img = new Image();
        img.premultiplyAlpha = false;
        img.onload = function () { resolve(img); };
        img.onerror = function (err) { state.error = 'load ' + path + ': ' + (err && err.message || err || 'error'); resolve(null); };
        img.src = path;
    });
}

function setProgress(val) {
    state.progressCalls = (state.progressCalls || 0) + 1;
    return nextFrame();
}

function end() {
    state.t.end = now();
    return nextFrame().then(function () {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
        // Leave the context in default state for the engine's GL state cache.
        if (aPosition >= 0) gl.disableVertexAttribArray(aPosition);
        if (aTexCoord >= 0) gl.disableVertexAttribArray(aTexCoord);
        gl.useProgram(null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        if (texture) gl.deleteTexture(texture);
        if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
        if (program) gl.deleteProgram(program);
        texture = vertexBuffer = program = null;
        state.ended = true;
        state.t.released = now();
    });
}

function start(alpha, antialias, useWebgl2) {
    state.t.start = now();
    options.alpha = alpha === 'true';
    options.antialias = antialias !== 'false';
    cv = window.canvas || canvas;
    if (useWebgl2 === 'true') {
        gl = cv.getContext('webgl2', options);
    }
    // Same detection hack as the Cocos template: the engine reads window.WebGL2RenderingContext afterwards.
    if (gl) {
        window.WebGL2RenderingContext = true;
    } else {
        window.WebGL2RenderingContext = false;
        gl = cv.getContext('webgl', options);
    }
    program = createProgram();
    if (program) {
        aPosition = gl.getAttribLocation(program, 'a_Position');
        aTexCoord = gl.getAttribLocation(program, 'a_TexCoord');
    }
    vertexBuffer = gl.createBuffer();
    texture = gl.createTexture();
    tick();
    // Small pieces the scene layer needs right after takeover; never block the first screen on them.
    var extras = [];
    var keys = ['fill', 'pinwheel'];
    for (var i = 0; i < keys.length; i++) {
        (function (k) {
            extras.push(loadImage(EXTRA[k]).then(function (img) { if (img) state.images[k] = img; }));
        })(keys[i]);
    }
    return loadImage(COMPOSITE).then(function (img) {
        if (img) {
            image = img;
            state.image = img;
            state.images.composite = img;
            state.t.image = now();
            try { uploadImage(); imageReady = true; state.ready = true; } catch (e) { state.error = 'upload: ' + e; }
        }
        return Promise.all(extras);
    }).then(function () {
        return nextFrame();
    });
}

module.exports = { start: start, end: end, setProgress: setProgress, coverTransform: coverTransform, coverVertices: coverVertices };
