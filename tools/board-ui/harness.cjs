'use strict';
/**
 * Board-UI test harness: loads the real TypeScript sources (typescript transpileModule → CommonJS, relative imports
 * resolved recursively) against an in-memory Cocos double. Board art comes from the real files under
 * assets/bundles/board_art (PNG sizes read from their headers), so layout uses the shipped slice sizes.
 * Scope: logic, layout numbers, node trees and input routing. Not rendering, not WeChat.
 */
const fs = require('node:fs'), path = require('node:path');
const env = require('../qf-env.cjs');
const ROOT = path.resolve(__dirname, '../..'), SCRIPTS = path.join(ROOT, 'creator-build-project/assets/scripts'), BUNDLES = path.join(ROOT, 'creator-build-project/assets/bundles');

function pngSize(file) { const b = fs.readFileSync(file); return b.toString('ascii', 1, 4) === 'PNG' ? { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } : { width: 0, height: 0 }; }

function createCc(state) {
  class Emitter { constructor() { this._ev = new Map(); } on(t, f, c) { if (!this._ev.has(t)) this._ev.set(t, []); this._ev.get(t).push([f, c]); } off(t, f, c) { this._ev.set(t, (this._ev.get(t) || []).filter(x => x[0] !== f || (c !== undefined && x[1] !== c))); } emit(t, ...a) { for (const [f, c] of [...(this._ev.get(t) || [])]) f.apply(c, a); } listeners(t) { return (this._ev.get(t) || []).length; } }
  class Vec3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { if (x && typeof x === 'object') { y = x.y; z = x.z; x = x.x; } this.x = x; this.y = y || 0; this.z = z || 0; return this; } clone() { return new Vec3(this.x, this.y, this.z); } }
  class Vec4 { constructor(x = 0, y = 0, z = 0, w = 0) { this.x = x; this.y = y; this.z = z; this.w = w; } }
  Vec3.ONE = new Vec3(1, 1, 1); Vec3.ZERO = new Vec3();
  class Vec2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } }
  class Quat { constructor() { this.x = 0; this.y = 0; this.z = 0; this.w = 1; } set(q) { Object.assign(this, { x: q.x, y: q.y, z: q.z, w: q.w }); return this; } static fromEuler(out, x, y, z) { out.ex = x; out.ey = y; out.ez = z; return out; } static multiply(out) { return out; } }
  class Color { constructor(r = 255, g = 255, b = 255, a = 255) { if (typeof r === 'string') { const h = r.replace('#', ''); const n = (i) => parseInt(h.slice(i, i + 2), 16); this.r = n(0); this.g = n(2); this.b = n(4); this.a = h.length >= 8 ? n(6) : 255; } else Object.assign(this, { r, g, b, a }); } toHEX(fmt = '#rrggbb') { const h = v => Math.round(v).toString(16).padStart(2, '0'); return h(this.r) + h(this.g) + h(this.b) + (fmt === '#rrggbbaa' ? h(this.a) : ''); } }
  class Size { constructor(width = 0, height = 0) { this.width = width; this.height = height; } }
  class Rect { constructor(x = 0, y = 0, width = 0, height = 0) { Object.assign(this, { x, y, width, height }); } }
  class Component { constructor() { this.enabled = true; this.node = null; } get enabled() { return this._enabled !== false; } set enabled(v) { const was = this.enabledInHierarchy; this._enabled = !!v; if (was && !this.enabledInHierarchy) this.onDisable?.(); } get isValid() { return !!this.node && this.node.isValid; } get enabledInHierarchy() { return this.enabled && !!this.node && this.node.activeInHierarchy; } addComponent(C) { return this.node.addComponent(C); } getComponent(C) { return this.node.getComponent(C); } scheduleOnce() {} }
  class Node extends Emitter {
    constructor(name = '') { super(); this.name = name; this.children = []; this.components = []; this.parent = null; this.position = new Vec3(); this.scale = new Vec3(1, 1, 1); this.angle = 0; this.euler = new Vec3(); this.rotation = new Quat(); this.layer = 1; this.active = true; this.isValid = true; }
    get active() { return this._active !== false; }
    set active(v) { const list = []; this.walk(n => list.push([n, n.activeInHierarchy])); this._active = !!v; for (const [n, before] of list) { const after = n.activeInHierarchy; if (before !== after) { n.emit(Node.EventType?.ACTIVE_IN_HIERARCHY_CHANGED || 'active-changed'); if (!after) for (const c of n.components) c.onDisable?.(); } } }
    get activeInHierarchy() { return this.active && this.isValid && (!this.parent || this.parent.activeInHierarchy); }
    get worldScale() { const p = this.parent ? this.parent.worldScale : new Vec3(1, 1, 1); return new Vec3(p.x * this.scale.x, p.y * this.scale.y, 1); }
    get worldPosition() { if (!this.parent) return this.position.clone(); const p = this.parent.worldPosition, s = this.parent.worldScale; return new Vec3(p.x + this.position.x * s.x, p.y + this.position.y * s.y, p.z + this.position.z); }
    addChild(n) { if (n.parent) n.removeFromParent(); n.parent = this; this.children.push(n); }
    removeFromParent() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
    setParent(p) { this.removeFromParent(); if (p) p.addChild(this); }
    addComponent(C) { const c = new C(); c.node = this; this.components.push(c); c.onLoad?.(); return c; }
    getComponent(C) { if (typeof C === 'string') { const n = C.replace(/^cc\./, ''); return this.components.find(c => c.constructor.name === n) || null; } return this.components.find(c => c instanceof C) || null; }
    getComponents(C) { return this.components.filter(c => c instanceof C); }
    getComponentInChildren(C) { return this.getComponent(C) || this.children.map(c => c.getComponentInChildren(C)).find(Boolean) || null; }
    getComponentsInChildren(C) { return [...this.components.filter(c => c instanceof C), ...this.children.flatMap(c => c.getComponentsInChildren(C))]; }
    getChildByName(n) { return this.children.find(c => c.name === n) || null; }
    setSiblingIndex(i) { if (!this.parent) return; const list = this.parent.children.filter(c => c !== this); list.splice(Math.max(0, Math.min(i, list.length)), 0, this); this.parent.children = list; }
    setPosition(x, y, z = 0) { this.position = x && typeof x === 'object' ? new Vec3(x.x, x.y, x.z) : new Vec3(x, y || 0, z || 0); }
    setWorldPosition(x, y, z = 0) { if (x && typeof x === 'object') { y = x.y; z = x.z; x = x.x; } const p = this.parent ? this.parent.worldPosition : new Vec3(), s = this.parent ? this.parent.worldScale : new Vec3(1, 1, 1); this.setPosition((x - p.x) / s.x, (y - p.y) / s.y, z - p.z); }
    setScale(x, y = x, z = 1) { this.scale = x && typeof x === 'object' ? new Vec3(x.x, x.y, x.z) : new Vec3(x, y, z); }
    setRotationFromEuler(x, y, z) { this.euler = new Vec3(x, y, z); }
    setRotation(q) { this.rotation = q; }
    lookAt() {}
    destroy() { if (!this.isValid) return; for (const c of this.components) c.onDestroy?.(); for (const n of [...this.children]) n.destroy(); this.isValid = false; this.removeFromParent(); }
    walk(fn) { fn(this); for (const c of this.children) c.walk(fn); }
    find(name) { if (this.name === name) return this; for (const c of this.children) { const r = c.find(name); if (r) return r; } return null; }
  }
  Node.EventType = { TOUCH_START: 'touch-start', TOUCH_MOVE: 'touch-move', TOUCH_END: 'touch-end', TOUCH_CANCEL: 'touch-cancel', ACTIVE_IN_HIERARCHY_CHANGED: 'active-changed' };
  class UITransform extends Component {
    constructor() { super(); this.width = 0; this.height = 0; this.anchorX = 0.5; this.anchorY = 0.5; }
    setContentSize(w, h) { if (w && typeof w === 'object') { h = w.height; w = w.width; } this.width = w; this.height = h; }
    get contentSize() { return new Size(this.width, this.height); }
    setAnchorPoint(x, y) { this.anchorX = x; this.anchorY = y; }
    /** p: screen point (origin bottom-left, like EventTouch.getLocation). */
    hitTest(p) { const q = this.node.worldPosition, s = this.node.worldScale, cx = q.x + state.viewport.width / 2, cy = q.y + state.viewport.height / 2; const w = this.width * Math.abs(s.x), h = this.height * Math.abs(s.y); return p.x >= cx - w * this.anchorX && p.x <= cx + w * (1 - this.anchorX) && p.y >= cy - h * this.anchorY && p.y <= cy + h * (1 - this.anchorY); }
  }
  class Sprite extends Component { constructor() { super(); this.spriteFrame = null; this.type = 0; this.sizeMode = 0; this.trim = true; this.grayscale = false; this.color = new Color(); this.fillType = 0; this.fillStart = 0; this.fillRange = 0; } }
  Sprite.Type = { SIMPLE: 0, SLICED: 1, TILED: 2, FILLED: 3 }; Sprite.SizeMode = { CUSTOM: 0, TRIMMED: 1, RAW: 2 }; Sprite.FillType = { HORIZONTAL: 0, VERTICAL: 1, RADIAL: 2 };
  class Label extends Component { constructor() { super(); this.string = ''; this.fontSize = 20; this.lineHeight = 24; this.isBold = false; this.color = new Color(); this.overflow = 0; this.enableWrapText = false; } }
  Label.HorizontalAlign = { LEFT: 0, CENTER: 1, RIGHT: 2 }; Label.VerticalAlign = { TOP: 0, CENTER: 1, BOTTOM: 2 }; Label.Overflow = { NONE: 0, CLAMP: 1, SHRINK: 2, RESIZE_HEIGHT: 3 };
  class Graphics extends Component {
    constructor() { super(); this.ops = []; this.fillColor = new Color(); this.strokeColor = new Color(); this.lineWidth = 1; }
    clear() { this.ops = []; }
  }
  for (const m of ['moveTo', 'lineTo', 'close', 'fill', 'stroke', 'rect', 'roundRect', 'circle', 'arc', 'ellipse', 'bezierCurveTo', 'quadraticCurveTo']) Graphics.prototype[m] = function (...a) { this.ops.push([m, ...a, m === 'fill' ? { ...this.fillColor } : m === 'stroke' ? { ...this.strokeColor } : undefined]); };
  class UIOpacity extends Component { constructor() { super(); this.opacity = 255; } }
  class BlockInputEvents extends Component {}
  class Mask extends Component {}
  class ScrollView extends Component {}
  class Canvas extends Component { constructor() { super(); this.alignCanvasWithScreen = true; this.cameraComponent = null; } }
  class Camera extends Component { constructor() { super(); this.camera = null; this.orthoHeight = 0; } }
  Camera.ProjectionType = { ORTHO: 0, PERSPECTIVE: 1 }; Camera.ClearFlag = { SOLID_COLOR: 7, DEPTH_ONLY: 6 }; Camera.FOVAxis = { VERTICAL: 0, HORIZONTAL: 1 };
  class MeshRenderer extends Component { constructor() { super(); this.sharedMaterials = []; this.mesh = null; } setSharedMaterial(m, i) { this.sharedMaterials[i] = m; } setMaterial(m, i = 0) { this.sharedMaterials[i] = m; } getMaterial(i = 0) { return this.sharedMaterials[i] || null; } }
  MeshRenderer.ShadowCastingMode = { OFF: 0, ON: 1 };
  class SphereLight extends Component { constructor() { super(); this.luminance = 1; } }
  class EventTouch {}
  class ImageAsset { constructor(o = {}) { this.width = o.width || 0; this.height = o.height || 0; this.refs = 0; this.path = o.path || ''; } addRef() { this.refs++; return this; } decRef() { this.refs--; return this; } destroy() { this.destroyed = true; } get data() { return { width: this.width, height: this.height }; } }
  class Texture2D { set image(v) { this._image = v; } get image() { return this._image; } setFilters() {} setWrapMode() {} setMipFilter() {} destroy() { this.destroyed = true; } }
  Texture2D.Filter = { NONE: 0, LINEAR: 1 }; Texture2D.WrapMode = { CLAMP_TO_EDGE: 0, REPEAT: 1 }; Texture2D.PixelFormat = { RGBA8888: 35 };
  class SpriteFrame { constructor() { this.originalSize = new Size(); this.insetLeft = 0; this.insetRight = 0; this.insetTop = 0; this.insetBottom = 0; } set texture(t) { this._texture = t; const i = t && t.image; if (i) this.originalSize = new Size(i.width, i.height); } get texture() { return this._texture; } destroy() { this.destroyed = true; } }
  class TextAsset { constructor(text = '') { this.text = text; } }
  class Prefab {}
  class Mesh {}
  /** Cocos 3.8.8 Pass. overridePipelineStates is warnID(12102) and does not change state. getUniform reads the uploaded block, not Material._props. */
  class Pass {
    constructor(src = {}) {
      this.defines = { ...(src.defines || {}) };
      this.rasterizerState = { ...(src.rasterizerState || {}) };
      this.depthStencilState = { ...(src.depthStencilState || {}) };
      this.blendState = { targets: ((src.blendState && src.blendState.targets) || [{ blend: false }]).map((t) => ({ ...t })) };
      this._getHandle = src._getHandle || src.getHandle;
      this.properties = {};
      const meta = src.properties || {};
      for (const k of Object.keys(meta)) this.properties[k] = { ...meta[k] };
      this.uniforms = {};
      const seed = (name, x, y, z, w) => { if (this.getHandle(name)) this.uniforms[name] = { x, y, z, w }; };
      seed('mainColor', 1, 1, 1, 1);
      seed('emissive', 0, 0, 0, 1);
      seed('emissiveScale', 1, 1, 1, 0);
      if (src.uniforms) for (const k of Object.keys(src.uniforms)) this.uniforms[k] = { ...src.uniforms[k] };
    }
    getHandle(name) { return this._getHandle && this._getHandle(name) ? { name } : 0; }
    setUniform(handle, val) { if (!handle || !handle.name) return; const v = val || {}; this.uniforms[handle.name] = { x: v.x || 0, y: v.y || 0, z: v.z || 0, w: v.w || 0 }; }
    getUniform(handle, out) { const v = handle && handle.name ? this.uniforms[handle.name] : null; out.x = v ? v.x : 0; out.y = v ? v.y : 0; out.z = v ? v.z : 0; out.w = v ? v.w : 0; return out; }
    overridePipelineStates() { console.warn('[cc.warnID] 12102 Base pass cannot override states, please use pass instance instead.'); }
  }
  /** Cocos 3.8.8 PassInstance. overridePipelineStates updates this instance only (pass-instance.ts), never the parent Pass. */
  class PassInstance extends Pass {
    constructor(parent, owner) { super(parent); this.parent = parent; this.owner = owner; }
    overridePipelineStates(_original, overrides) {
      const state = overrides || _original || {};
      if (state.rasterizerState) this.rasterizerState = { ...this.rasterizerState, ...state.rasterizerState };
      if (state.depthStencilState) this.depthStencilState = { ...this.depthStencilState, ...state.depthStencilState };
      if (state.blendState) this.blendState = { targets: state.blendState.targets.map((t) => ({ ...(this.blendState.targets[0] || {}), ...t })) };
    }
  }
  /**
   * Cocos 3.8.8 Material (v3.8.8 cocos/asset/assets/material.ts).
   * overridePipelineStates only warnID(16371). setProperty uploads through Pass.setUniform and also stores _props.
   * getProperty returns that cache, which can diverge from Pass.getUniform.
   */
  class Material {
    constructor() { this.passes = []; this._props = {}; this.props = this._props; this.name = ''; this.isValid = true; this.label = ''; this.effectName = 'builtin-standard'; }
    copy(o) {
      this.effectName = o.effectName || this.effectName; this.name = o.name || ''; this.label = o.label || '';
      this.passes = (o.passes || []).map((p) => new Pass(p));
      this._props = {}; this.props = this._props;
      const src = o._props || o.props || {};
      for (const k of Object.keys(src)) this.setProperty(k, src[k]);
      return this;
    }
    setProperty(name, val) {
      let ok = false;
      for (const pass of this.passes) {
        const handle = pass.getHandle(name);
        if (!handle) continue;
        // v3.8.8 material.ts _uploadProperty: pass.properties[name].linear → SRGBToLinear (component square) then v4_1.w = v4.w.
        let uploaded = val;
        if (pass.properties && pass.properties[name] && pass.properties[name].linear && val && typeof val.x === 'number') {
          uploaded = { x: val.x * val.x, y: val.y * val.y, z: val.z * val.z, w: val.w };
        }
        if (typeof pass.setUniform === 'function') pass.setUniform(handle, uploaded);
        this._props[name] = val; ok = true;
      }
      if (!ok) console.warn('[cc.warnID] 16373 ' + name);
    }
    getProperty(name) { return Object.prototype.hasOwnProperty.call(this._props, name) ? this._props[name] : null; }
    overridePipelineStates() { console.warn('[cc.warnID] 16371 Pipeline states in material asset \'' + (this.name || '') + '\' cannot be modified at runtime, please instantiate the material first.'); }
    recompileShaders() { console.warn('[cc.warnID] 16370 Shaders in material asset \'' + (this.name || '') + '\' cannot be modified at runtime, please instantiate the material first.'); }
    destroy() { this.isValid = false; this.destroyed = true; }
  }
  /** Cocos 3.8.8 MaterialInstance. Passes are PassInstances. overridePipelineStates and recompileShaders change those passes only. */
  class MaterialInstance extends Material {
    constructor(info) {
      super();
      this.parent = info && info.parent;
      this.owner = info && info.owner || null;
      const parent = this.parent;
      this.effectName = parent && parent.effectName || 'builtin-standard';
      this.name = parent && parent.name || '';
      this.passes = ((parent && parent.passes) || []).map((p) => new PassInstance(p, this));
      this._props = {}; this.props = this._props;
      const src = (parent && (parent._props || parent.props)) || {};
      for (const k of Object.keys(src)) this.setProperty(k, src[k]);
    }
    overridePipelineStates(overrides, passIdx = 0) {
      const pass = this.passes[passIdx];
      if (pass instanceof PassInstance) pass.overridePipelineStates(null, overrides);
    }
    recompileShaders(overrides, passIdx) {
      const list = passIdx === undefined ? this.passes : [this.passes[passIdx]];
      for (const pass of list) if (pass instanceof PassInstance && overrides) Object.assign(pass.defines, overrides);
    }
  }
  class RenderTexture { reset() {} destroy() {} } class JsonAsset {} class AudioSource extends Component {} class AudioClip {}
  const gfx = { BlendOp: { ADD: 0 }, BlendFactor: { ZERO: 0, ONE: 1, SRC_ALPHA: 2, DST_ALPHA: 3, ONE_MINUS_SRC_ALPHA: 4 }, CullMode: { NONE: 0, FRONT: 1, BACK: 2 }, ComparisonFunc: { NEVER: 0, LESS: 1, EQUAL: 2, LESS_EQUAL: 3, ALWAYS: 7 } };
  const game = new Emitter(); game.canvas = null;
  const view = new Emitter(); view.resizeWithBrowserSize = () => {}; view.getFrameSize = () => ({ ...state.viewport }); view.setDesignResolutionSize = () => {};
  const scene = new Node('Scene');
  const director = { getScene: () => scene, root: null, once() {}, on() {}, off() {} };
  const storage = new Map();
  const sys = { localStorage: { getItem: k => storage.has(k) ? storage.get(k) : null, setItem: (k, v) => { storage.set(k, String(v)); }, removeItem: k => { storage.delete(k); }, clear: () => storage.clear() }, platform: 'test', isBrowser: false };
  // board_art bundle double: real files, real PNG sizes, async like the engine.
  const later = fn => Promise.resolve().then(fn);
  function makeBundle(name) {
    const dir = path.join(BUNDLES, name), images = new Map();
    const bundle = {
      name,
      loadDir(sub, type, cb) {
        later(() => {
          const abs = path.join(dir, sub);
          if (state.failDirs.has(sub) || !fs.existsSync(abs)) { cb(Error('missing ' + sub), null); return; }
          if (type === Prefab) { cb(Error('no GLB importer in tests'), null); return; }
          const list = [];
          for (const f of fs.readdirSync(abs)) { if (!/\.(png|jpg)$/.test(f)) continue; const key = sub + '/' + f.replace(/\.(png|jpg)$/, ''); const size = f.endsWith('.png') ? pngSize(path.join(abs, f)) : { width: 750, height: 1624 }; const img = new ImageAsset({ ...size, path: key }); images.set(key, img); list.push(img); }
          state.loads.push(name + ':' + sub); cb(null, list);
        });
      },
      getDirWithPath(sub) { return [...images.keys()].filter(k => k.startsWith(sub + '/')).map(p => ({ path: p })); },
      get(p) { return images.get(p) || null; },
      load(p, type, cb) {
        later(() => {
          if (type === TextAsset) { const f = path.join(dir, p + '.txt'); cb(fs.existsSync(f) ? null : Error('missing'), fs.existsSync(f) ? new TextAsset(fs.readFileSync(f, 'utf8')) : null); return; }
          const f = [p + '.jpg', p + '.png'].map(x => path.join(dir, x)).find(x => fs.existsSync(x));
          if (!f) { cb(Error('missing ' + p), null); return; }
          cb(null, new ImageAsset({ ...(f.endsWith('.png') ? pngSize(f) : { width: 750, height: 1624 }), path: p }));
        });
      },
    };
    return bundle;
  }
  const bundles = new Map();
  const assetManager = {
    getBundle: n => bundles.get(n) || null,
    loadBundle: (n, cb) => later(() => { if (state.failBundles.has(n) || !fs.existsSync(path.join(BUNDLES, n))) { cb(Error('missing bundle ' + n), null); return; } if (!bundles.has(n)) { bundles.set(n, makeBundle(n)); if (state.onBundle) state.onBundle(n); } cb(null, bundles.get(n)); }),
    loadAny: (_o, ...rest) => { const cb = rest.reverse().find(f => typeof f === 'function'); later(() => cb && cb(Error('no materials in tests'), null)); }, // full9c-b: cc's loadAny(req, options?, onProgress?, onComplete)
    loadRemote: (_u, _o, cb) => later(() => cb(Error('no remote in tests'), null)),
  };
  const resources = { load: (p, type, cb) => later(() => { state.resourceLoads.push(p); cb(null, new ImageAsset({ width: 896, height: 128, path: p })); }) };
  const tweens = [];
  const tween = target => { const t = { target, steps: [], to(d, props) { this.steps.push(['to', d, props]); return this; }, call(f) { this.steps.push(['call', f]); return this; }, delay(d) { this.steps.push(['delay', d]); return this; }, start() { tweens.push(this); return this; } }; return t; };
  const Tween = { stopAllByTarget: target => { for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].target === target) tweens.splice(i, 1); } };
  const input = new Emitter(); input.getTouchCount = () => 0;
  const property = (...a) => (a.length >= 2 && typeof a[1] === 'string') ? undefined : () => {};
  return {
    Emitter, Vec2, Vec3, Vec4, Quat, Color, Size, Rect, Component, Node, UITransform, Sprite, Label, Graphics, UIOpacity, BlockInputEvents, Mask, ScrollView, Canvas, Camera, MeshRenderer, SphereLight, EventTouch,
    ImageAsset, Texture2D, SpriteFrame, TextAsset, Prefab, Mesh, Pass, PassInstance, Material, MaterialInstance, RenderTexture, JsonAsset, AudioSource, AudioClip, gfx, TTFFont: class TTFFont { },
    Director: { EVENT_AFTER_SCENE_LAUNCH: 'director_after_scene_launch' }, game, Game: { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' }, view, ResolutionPolicy: { EXACT_FIT: 1 }, Layers: { Enum: { UI_2D: 1 << 25, DEFAULT: 1 } }, director, sys, assetManager, AssetManager: {}, resources,
    isValid: (o, strict) => !!o && o.isValid !== false, profiler: { hideStats() {} }, _decorator: { ccclass: () => c => c, property }, tween, Tween, input, Input: { EventType: { TOUCH_START: 'touch-start' } },
    instantiate: p => new Node('Instance'), geometry: { Ray: class { constructor() { this.o = new Vec3(); this.d = new Vec3(); } }, ERaycastMode: { ANY: 0, CLOSEST: 1 }, intersect: { rayModel: () => 0 } },
    _storage: storage, _scene: scene, _tweens: tweens,
  };
}

/** Recording GameAudio double (the real component needs the engine audio stack). */
function audioStub(log) {
  class GameAudio {
    static notifyUserGesture() { log.push('gesture'); }
    constructor() { this.music = 0.4; this.sfxMuted = false; }
    static ensure() { return GameAudio.instance; } resetRenderBaseline() { log.push('baseline'); } onBoardFrame(v) { log.push('frame:' + (v.token || v.kind)); } onRender(state, won) { log.push('render:' + state + (won ? ':won' : '')); } onClaimResult(r) { log.push('claim:' + (r && r.ok)); } onPropTap() {}
    onButton() { log.push('button'); } onUiBack() { log.push('back'); } onToolTap() { log.push('tool'); } onOpenPanel() { log.push('panel'); }
    getMusicVolume() { return this.music; } setMusicVolume(v) { this.music = v; log.push('music:' + v); } isSfxMuted() { return this.sfxMuted; } setSfxMuted(m) { this.sfxMuted = m; log.push('sfx:' + m); }
  }
  GameAudio.instance = new GameAudio();
  return { GameAudio };
}

function createHarness(options = {}) {
  const ts = env.typescript();
  const state = { viewport: { width: 390, height: 844 }, loads: [], resourceLoads: [], failDirs: new Set(options.failDirs || []), failBundles: new Set(options.failBundles || []) };
  const cc = createCc(state), audioLog = [], cache = new Map();
  class WarmButtonSkin { constructor(parent) { this.node = new cc.Node('WarmButton3DSurface'); parent.addChild(this.node); this.node.setSiblingIndex(0); this.node.addComponent(cc.UITransform); } configure(w, h) { this.node.getComponent(cc.UITransform).setContentSize(w, h); } setPressed(p) { this.pressed = p; } destroy() { this.node.destroy(); } }
  const overrides = Object.assign({ 'audio/GameAudio': audioStub(audioLog), 'ui/WarmButtonSkin': { WarmButtonSkin } }, options.overrides || {});
  function resolve(from, spec) {
    if (spec === 'cc') return { kind: 'cc' };
    if (spec === 'cc/env') return { kind: 'env' };
    if (!spec.startsWith('.')) return { kind: 'node', id: spec };
    const abs = path.resolve(path.dirname(from), spec), rel = path.relative(SCRIPTS, abs).replace(/\\/g, '/').replace(/\.(ts|js)$/, '');
    if (overrides[rel]) return { kind: 'override', rel };
    if (spec.endsWith('.js') && fs.existsSync(abs)) return { kind: 'node', id: abs };
    for (const f of [abs + '.ts', abs.replace(/\.js$/, '.ts'), abs]) if (fs.existsSync(f) && f.endsWith('.ts')) return { kind: 'ts', file: f };
    if (fs.existsSync(abs + '.js')) return { kind: 'node', id: abs + '.js' };
    throw Error('Cannot resolve ' + spec + ' from ' + from);
  }
  // Creator merges a bundle folder's scripts into the bundle's own index.js and runs it on loadBundle (asset/bundle.html).
  function runBundleScripts(n) { const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.ts') ? [path.join(d, e.name)] : []);
    const dir = path.join(BUNDLES, n); if (fs.existsSync(dir)) for (const f of walk(dir)) { state.bundleScripts = (state.bundleScripts || []).concat(n + ':' + path.relative(dir, f)); load(f); } }
  state.onBundle = runBundleScripts;
  function load(file) {
    if (!path.isAbsolute(file)) {
      const rel = file.replace(/\.ts$/, ''); if (overrides[rel]) return overrides[rel];
      file = path.join(SCRIPTS, file.endsWith('.ts') ? file : file + '.ts');
    }
    if (cache.has(file)) return cache.get(file).exports;
    const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, experimentalDecorators: true, esModuleInterop: true, isolatedModules: true } }).outputText;
    const module = { exports: {} }; cache.set(file, module);
    const req = spec => { const r = resolve(file, spec); return r.kind === 'cc' ? cc : r.kind === 'env' ? { DEBUG: !!options.debug, EDITOR: false, PREVIEW: false, WECHAT: false } : r.kind === 'override' ? overrides[r.rel] : r.kind === 'ts' ? load(r.file) : require(r.id); };
    new Function('exports', 'require', 'module', '__filename', '__dirname', out)(module.exports, req, module, file, path.dirname(file));
    /* full9c: tools-only companion (code moved out of assets/ for the bundle budget) — its exports are merged in, the asset's own win */
    const comp = path.join(ROOT, 'tools/asset-companions', path.relative(SCRIPTS, file));
    if (!path.relative(SCRIPTS, file).startsWith('..') && fs.existsSync(comp)) { const c = load(comp); for (const k of Object.keys(c)) if (!(k in module.exports)) module.exports[k] = c[k]; }
    return module.exports;
  }
  const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
  const point = n => { const p = n.worldPosition; return { x: p.x + state.viewport.width / 2, y: p.y + state.viewport.height / 2 }; };
  const event = (p, id = 1, code) => ({ getLocation: () => p, getUILocation: () => p, getID: () => id, getEventCode: () => code, getAllTouches: () => [], windowId: 0, propagationStopped: false });
  const E = cc.Node.EventType;
  const tap = (n, id = 1) => { const e = event(point(n), id); n.emit(E.TOUCH_START, e); n.emit(E.TOUCH_END, e); };
  return { ts, cc, state, load, flush, point, event, tap, audioLog, SCRIPTS, ROOT, BUNDLES, setViewport(w, h) { state.viewport = { width: w, height: h }; } };
}
module.exports = { createHarness, pngSize, SCRIPTS, ROOT, BUNDLES };
