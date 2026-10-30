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
var FS = 'precision mediump float;\nuniform sampler2D u_Sampler;\nuniform float u_Alpha;\nvarying vec2 v_TexCoord;\n' +
    'void main() {\n    vec4 c = texture2D(u_Sampler, v_TexCoord);\n    gl_FragColor = vec4(c.rgb, c.a * u_Alpha);\n}';

/* Health advisory (健康游戏忠告, system-panels SPEC §1): drawn on this first-screen canvas while the engine loads.
 * Cold start only (this file runs once per process; warm start = onShow, nothing re-runs). 3.0 s; the first 1.5 s
 * cannot be skipped; a tap after that starts the 300 ms fade at once. Never shown again in the same process. */
var ADVISORY = { inMs: 400, outMs: 300, totalMs: 3000, lockMs: 1500, hintMs: 300, risePt: 6 };
var ADVISORY_TITLE = '健康游戏忠告';
var ADVISORY_LINES = ['抵制不良游戏，拒绝盗版游戏。', '注意自我保护，谨防受骗上当。', '适度游戏益脑，沉迷游戏伤身。', '合理安排时间，享受健康生活。'];
/* Mirror of assets/scripts/ui/PublicationInfo.ts (kept equal by tools/system-panels/test_system_panels.cjs). Empty until provided. */
var PUBLICATION_INFO = {};
var PUBLICATION_KEYS = ['copyright', 'publisher', 'approval', 'isbn'];
function publicationLines(info) {
    var out = [];
    for (var i = 0; i < PUBLICATION_KEYS.length; i++) {
        var v = info && info[PUBLICATION_KEYS[i]];
        if (typeof v !== 'string' || !v.replace(/\s+/g, '')) return null;
        out.push(v.replace(/^\s+|\s+$/g, ''));
    }
    return out;
}
/** Pure timing: ms since start, tapMs (accepted tap time or -1), reduced motion → { alpha, dy (pt), hint, done }. */
function advisoryFrame(ms, tapMs, reduced) {
    var A = ADVISORY, outAt = A.totalMs - A.outMs;
    if (tapMs >= A.lockMs && tapMs < outAt) outAt = tapMs;
    var a, dy = 0;
    if (ms >= outAt + A.outMs) return { alpha: 0, dy: 0, hint: 0, done: true };
    if (ms >= outAt) { var u = (ms - outAt) / A.outMs; a = Math.min(1, ms / A.inMs); a = a * (1 - u * u); }
    else if (ms < A.inMs) { var k = Math.max(0, ms) / A.inMs, e = 1 - Math.pow(1 - k, 3); a = e; dy = reduced ? 0 : A.risePt * (1 - e); }
    else a = 1;
    var hint = ms < A.lockMs ? 0 : Math.min(1, (ms - A.lockMs) / A.hintMs);
    return { alpha: a, dy: dy, hint: hint, done: false };
}
/** A tap counts only after the 1.5 s lock; returns the accepted tap time or -1. */
function advisoryTap(ms, tapMs) { return tapMs >= 0 ? tapMs : (ms >= ADVISORY.lockMs ? ms : -1); }

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
var adv = null, advTex = null, advBuf = null, image = null, imageReady = false, rafHandle = null, afterTick = null, lastW = 0, lastH = 0;
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
    if (!program) return;
    if (!imageReady) { drawAdvisory(); return; }
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
    gl.uniform1f(gl.getUniformLocation(program, 'u_Alpha'), 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (state.t.firstArtFrame < 0) state.t.firstArtFrame = now();
    drawAdvisory();
}

function advisoryReduced() {
    try { var w = typeof wx !== 'undefined' ? wx : null, v = w && w.getStorageSync ? w.getStorageSync('forest-v33-reduced-motion') : ''; return v === 'true' || v === '1'; } catch (e) { return false; }
}
function startAdvisory() {
    if (G.__qfAdvisory) return;
    var c2 = null;
    try { c2 = (typeof wx !== 'undefined' && wx.createCanvas) ? wx.createCanvas() : (typeof document !== 'undefined' ? document.createElement('canvas') : null); } catch (e) { c2 = null; }
    adv = G.__qfAdvisory = { t0: now(), tap: -1, done: false, reduced: advisoryReduced(), canvas: c2, ctx: null, frames: 0, error: null, pub: publicationLines(PUBLICATION_INFO) };
    try { adv.ctx = c2 && c2.getContext('2d'); } catch (e) { adv.ctx = null; }
    if (!adv.ctx) { adv.error = 'no 2d canvas'; adv.done = true; return; }
    advTex = gl.createTexture(); advBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, advBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 0, 0, -1, -1, 0, 1, 1, 1, 1, 0, 1, -1, 1, 1]), gl.STATIC_DRAW);
    adv.onTouch = function () { adv.tap = advisoryTap(now() - adv.t0, adv.tap); };
    try { if (typeof wx !== 'undefined' && wx.onTouchStart) wx.onTouchStart(adv.onTouch); } catch (e) {}
}
function stopAdvisory() {
    if (!adv) return;
    adv.done = true;
    try { if (typeof wx !== 'undefined' && wx.offTouchStart && adv.onTouch) wx.offTouchStart(adv.onTouch); } catch (e) {}
    if (advTex) gl.deleteTexture(advTex); if (advBuf) gl.deleteBuffer(advBuf); advTex = advBuf = null;
    if (adv.waiters) { var w = adv.waiters; adv.waiters = null; for (var i = 0; i < w.length; i++) w[i](); }
}
/** 2D paint of the page (SPEC §1.2) in canvas pixels; pt = W / 390 (text block capped at 1.2× on wide screens). */
function paintAdvisory(c, W, H, f) {
    var pt = Math.min(W / 390, (H / 844) * 1.2), cx = W / 2;
    var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#FBF4E4'); g.addColorStop(1, '#F2E1C0'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    var rg = c.createRadialGradient(cx, H * 0.3, 0, cx, H * 0.3, W * 0.9); rg.addColorStop(0, 'rgba(255,246,218,0.9)'); rg.addColorStop(1, 'rgba(255,246,218,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H);
    var hills = [['#E8D2A6', [0, .86, .18, .80, .37, .84, .58, .79, .80, .83, 1, .80]], ['#DCC08E', [0, .91, .22, .87, .45, .90, .68, .86, .88, .89, 1, .87]]];
    for (var i = 0; i < hills.length; i++) { var pts = hills[i][1]; c.fillStyle = hills[i][0]; c.beginPath(); c.moveTo(0, H); for (var j = 0; j < pts.length; j += 2) c.lineTo(pts[j] * W, pts[j + 1] * H); c.lineTo(W, H); c.closePath(); c.fill(); }
    var ty = H * 0.355 + f.dy * pt, serif = '"Noto Serif SC","Source Han Serif SC","Songti SC",serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#5A3A1E'; c.font = 'bold ' + Math.round(22 * pt) + 'px ' + serif; spaced(c, ADVISORY_TITLE, cx, ty, 6 * pt);
    c.fillStyle = '#D9BF8C'; c.fillRect(cx - 32 * pt, ty + 24 * pt - 0.75 * pt, 64 * pt, 1.5 * pt);
    c.fillStyle = '#C39A5E'; c.beginPath(); c.arc(cx, ty + 24 * pt, 3 * pt, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6B4A2E'; c.font = Math.round(17 * pt) + 'px ' + serif;
    for (var k = 0; k < ADVISORY_LINES.length; k++) spaced(c, ADVISORY_LINES[k], cx, ty + (72 + 40 * k) * pt, 2 * pt);
    if (adv.pub) { c.font = Math.round(11 * pt) + 'px ' + serif; for (var m = 0; m < adv.pub.length; m++) c.fillText(adv.pub[m], cx, H - (104 - 17 * m) * pt); }
    if (f.hint > 0) { c.globalAlpha = 0.8 * f.hint; c.font = Math.round(12 * pt) + 'px ' + serif; c.fillText('轻点继续', cx, H - 56 * pt); c.globalAlpha = 1; }
}
function spaced(c, text, x, y, sp) {
    var w = 0, i; for (i = 0; i < text.length; i++) w += c.measureText(text[i]).width + (i ? sp : 0);
    var px = x - w / 2; c.textAlign = 'left';
    for (i = 0; i < text.length; i++) { var cw = c.measureText(text[i]).width; c.fillText(text[i], px, y); px += cw + sp; }
    c.textAlign = 'center';
}
function drawAdvisory() {
    if (!adv || adv.done || !advTex) return;
    var f = advisoryFrame(now() - adv.t0, adv.tap, adv.reduced);
    if (f.done) { stopAdvisory(); return; }
    var W = cv.width, H = cv.height, c = adv.canvas;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    paintAdvisory(adv.ctx, W, H, f); adv.frames++;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, advTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.useProgram(program); gl.enableVertexAttribArray(aPosition); gl.enableVertexAttribArray(aTexCoord);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(gl.getUniformLocation(program, 'u_Sampler'), 0);
    gl.uniform1f(gl.getUniformLocation(program, 'u_Alpha'), f.alpha);
    gl.bindBuffer(gl.ARRAY_BUFFER, advBuf);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0); gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 16, 8);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
}
/** end() waits for the advisory (≤ 3.0 s from start) so the engine never covers it; no extra screen afterwards. */
function advisoryDone() {
    if (!adv || adv.done) return Promise.resolve();
    return new Promise(function (resolve) { (adv.waiters = adv.waiters || []).push(resolve); });
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
    return advisoryDone().then(nextFrame).then(function () {
        stopAdvisory();
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
    try { if (program) startAdvisory(); } catch (e) { state.error = 'advisory: ' + e; if (adv) adv.done = true; }
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

/* fg-update-manager: wx.getUpdateManager. No-op outside WeChat; never throws; installs once. onUpdateReady raises
 * GameGlobal.__qfUpdate.ready; the in-game popup decides when to ask ("稍后" ≤2 per session; next cold start applies it anyway). */
function installUpdatePrompt(w) {
    try {
        if (!w || typeof w.getUpdateManager !== 'function' || G.__qfUpdate) return false;
        var um = w.getUpdateManager(); if (!um) return false;
        var st = G.__qfUpdate = { hasUpdate: null, ready: false, failed: false, applied: false };
        um.onCheckForUpdate && um.onCheckForUpdate(function (r) { st.hasUpdate = !!(r && r.hasUpdate); });
        // system-panels SPEC §3: onUpdateReady only raises the signal; the in-game popup (IslandJourneyOverlay +
        // ui/UpdatePromptCore) opens it at a quiet island-home moment and calls st.apply(). Single update path.
        st.apply = function () { if (st.applied || !st.ready) return false; st.applied = true; try { um.applyUpdate(); } catch (e) { return false; } return true; };
        um.onUpdateReady && um.onUpdateReady(function () { st.ready = true; });
        um.onUpdateFailed && um.onUpdateFailed(function () { st.failed = true; console.log('[first-screen] update failed (silent)'); });
        return true;
    } catch (e) { return false; }
}
installUpdatePrompt(typeof wx !== 'undefined' ? wx : null);

module.exports = { installUpdatePrompt: installUpdatePrompt, advisoryFrame: advisoryFrame, advisoryTap: advisoryTap, publicationLines: publicationLines, PUBLICATION_INFO: PUBLICATION_INFO, ADVISORY: ADVISORY, ADVISORY_LINES: ADVISORY_LINES, start: start, end: end, setProgress: setProgress, coverTransform: coverTransform, coverVertices: coverVertices };
