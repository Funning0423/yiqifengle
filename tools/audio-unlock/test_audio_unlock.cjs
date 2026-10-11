// Box test for the global first-touch audio unlock (GGbot 2026-10-11, Mac test f0f3a13 bug: no sound indoors until the first island tap).
// Runs the REAL audio/AudioUnlock.ts + REAL audio/GameAudio.ts + REAL RoomExploreOverlay.ts (+ REAL AmbienceAudio/WindAudio for the indoor
// silence check), transpiled to ES5 like Cocos, against a small cc double whose touch routing follows Cocos 3.8: platform wx.onTouch*
// listeners first, then a UI node that hits CLAIMS (swallows) the touch, and only unclaimed touches reach the global `input` listeners.
// Usage: node tools/audio-unlock/test_audio_unlock.cjs   (typescript: AU_TS, VB_TS or the GGbot vendor-node copy)
'use strict';
const path = require('path'), fs = require('fs'), Module = require('module');
const ROOT = path.resolve(__dirname, '../..'), S = path.join(ROOT, 'creator-build-project/assets/scripts');
const ts = require(process.env.AU_TS || process.env.VB_TS || '/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/typescript');
const tr = f => ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, experimentalDecorators: true, downlevelIteration: false } }).outputText;
const CODE = {}; for (const f of ['audio/AudioUnlock.ts', 'audio/GameAudio.ts', 'audio/AmbienceAudio.ts', 'audio/WindAudio.ts', 'RoomExploreOverlay.ts']) CODE[f] = tr(path.join(S, f));
let fail = 0; const ok = (c, m, d) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d === undefined ? '' : ' ' + JSON.stringify(d))); if (!c) fail++; };

/** One fresh world (module statics are per load). opts: wx (platform layer present), web (window present, no wx), gameAudio (create it at once). */
function world(opts = {}) {
  let now = 0; const G = global;
  const saved = { wx: G.wx, window: G.window, performance: G.performance };
  Object.defineProperty(G, 'performance', { value: { now: () => now }, configurable: true, writable: true });
  class Emitter { constructor() { this._h = {}; } on(t, f, tg) { (this._h[t] = this._h[t] || []).push([f, tg]); } off(t, f, tg) { this._h[t] = (this._h[t] || []).filter(x => !(x[0] === f && (tg === undefined || x[1] === tg))); }
    emit(t, ...a) { for (const [f, tg] of (this._h[t] || []).slice()) f.apply(tg, a); } count(t) { return (this._h[t] || []).length; } }
  const EventType = { TOUCH_START: 'touch-start', TOUCH_MOVE: 'touch-move', TOUCH_END: 'touch-end', TOUCH_CANCEL: 'touch-cancel', MOUSE_DOWN: 'mouse-down', MOUSE_UP: 'mouse-up', KEY_DOWN: 'key-down' };
  class Node extends Emitter { constructor(name) { super(); this.name = name || ''; this.children = []; this.parent = null; this.comps = []; this.active = true; this.valid = true; this.layer = 0; this.position = { x: 0, y: 0 }; }
    get isValid() { return this.valid; } get activeInHierarchy() { let n = this; while (n) { if (!n.active) return false; n = n.parent; } return true; }
    addChild(c) { c.parent = this; this.children.push(c); } setSiblingIndex() {} setPosition(x, y) { this.position = { x, y }; }
    addComponent(C) { const c = new C(); c.node = this; this.comps.push(c); if (c.onLoad) c.onLoad(); return c; }
    getComponent(C) { return this.comps.find(c => c instanceof C) || null; } getComponentInChildren() { return null; }
    destroy() { this.valid = false; return true; } }
  Node.EventType = EventType;
  function Component() {} Component.prototype.destroy = function () { this._destroyed = true; return true; };
  class UITransform { setContentSize(w, h) { this.width = w; this.height = h; } }
  class Label {} Label.HorizontalAlign = { CENTER: 1 }; Label.VerticalAlign = { CENTER: 1 };
  class AudioSource { constructor() { this.playOnAwake = true; this.loop = false; this.volume = 1; this.clip = null; this.playing = false; this.plays = 0; this.state = 0; }
    play() { this.plays++; this.state = 1; if (!AudioSource.deferStart) this.playing = true; } pause() { this.playing = false; this.state = 2; } stop() { this.playing = false; this.state = 3; } destroy() { this.destroyed = true; this.playing = false; } }
  AudioSource.EventType = { STARTED: 'started', ENDED: 'ended' }; AudioSource.AudioState = { INIT: 0, PLAYING: 1, PAUSED: 2, STOPPED: 3 }; AudioSource.maxAudioChannel = 10; AudioSource.deferStart = true;
  const loads = [], dirs = [];
  const clip = n => ({ name: n, duration: 2, refs: 0, addRef() { this.refs++; return this; }, decRef() { this.refs--; return this; } });
  const input = new Emitter(), game = new Emitter(), onceCbs = [];
  const scene = new Node('Scene'); scene.getComponentInChildren = n => n === 'WorldFlowComponent' ? flow : null;
  const flow = { valid: true, wind: 0, visible: true, w: 1, rig: true, getWindStrength() { return this.wind; }, isWorldVisible() { return this.visible; }, getRoomLightWeight() { return this.w; }, hasRoomLight() { return this.rig; } };
  const store = new Map();
  const cc = { _decorator: { ccclass: () => C => C, property: () => () => {} }, Component, Node, UITransform, Label, Layers: { Enum: { UI_2D: 1 } }, Color: class { constructor(...a) { this.a = a; } }, EventTouch: class {},
    AudioSource, AudioClip: class {}, isValid: (o, _s) => !!o && o.valid !== false && o.destroyed !== true && o._destroyed !== true,
    resources: { load(p, T, cb) { loads.push({ p, cb }); }, loadDir(p, T, cb) { dirs.push({ p, cb }); } },
    director: { getScene: () => scene, addPersistRootNode() {}, once(ev, cb) { onceCbs.push(cb); } }, Director: { EVENT_AFTER_SCENE_LAUNCH: 'after-launch' },
    game, Game: { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' }, sys: { localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) } },
    input, Input: { EventType } };
  // platform
  const wxL = { TouchStart: [], TouchEnd: [], TouchMove: [], TouchCancel: [] }, wxOff = [];
  if (opts.wx) { G.wx = { setInnerAudioOption(o) { o.success && o.success(); } }; for (const k in wxL) { G.wx['on' + k] = f => wxL[k].push(f); G.wx['off' + k] = f => { wxOff.push(k); wxL[k] = f ? wxL[k].filter(x => x !== f) : []; }; } } else delete G.wx;
  const domL = {};
  if (opts.web) G.window = { addEventListener(t, f, o) { (domL[t] = domL[t] || []).push({ f, capture: !!(o && o.capture) }); }, removeEventListener() {} }; else delete G.window;
  // modules
  const mods = {};
  const req = (from) => id => { if (id === 'cc') return cc; if (id === 'cc/env') return { EDITOR: false }; const key = { './audio/AudioUnlock': 'audio/AudioUnlock.ts', './AudioUnlock': 'audio/AudioUnlock.ts', './GameAudio': 'audio/GameAudio.ts', '../audio/GameAudio': 'audio/GameAudio.ts', './AmbienceAudio': 'audio/AmbienceAudio.ts' }[id]; if (!key) throw Error('unexpected import ' + id + ' from ' + from); return load(key); };
  function load(key) { if (mods[key]) return mods[key].exports; const m = new Module(key); m.filename = path.join(S, key); m.paths = []; mods[key] = m; m.require = req(key); m._compile(CODE[key], m.filename); return m.exports; }
  const { AudioUnlock } = load('audio/AudioUnlock.ts'); const { GameAudio } = load('audio/GameAudio.ts'); const { RoomExploreOverlay } = load('RoomExploreOverlay.ts');
  GameAudio.now = () => now;
  if (opts.ambience) { load('audio/AmbienceAudio.ts'); load('audio/WindAudio.ts'); }
  // the world: UI canvas with the full-screen room surface (as in WorldIntegrationBoot), door handle visible at (300,400)
  const canvas = new Node('WorldNavigationCanvas'); scene.addChild(canvas);
  let leaves = 0, looks = 0;
  const commands = { roomView: () => ({ enabled: true, settling: false, door: { visible: opts.doorVisible !== false, x: 300 / 390, y: 400 / 844, direction: 1 } }), lookRoom: () => { looks++; return true; }, leaveHome: () => {} };
  const room = new RoomExploreOverlay(canvas, () => commands, () => true, () => { leaves++; });
  room.sync(390, 844);
  const surface = canvas.children.find(n => n.name === 'RoomExploreSurface');
  const button = new Node('SomeSwallowingUIButton'); canvas.addChild(button); button.active = false;   // any UI node that claims a touch and never forwards a gesture
  let buttonTouches = 0; button.on(EventType.TOUCH_START, () => { buttonTouches++; }); button.on(EventType.TOUCH_END, () => { buttonTouches++; });
  const ga = () => GameAudio.instance;
  const mkGA = () => { const a = GameAudio.ensure(); return a; };
  if (opts.gameAudio !== false) mkGA();
  const bgmReady = () => { const l = loads.find(x => x.p === 'audio_bgm/bgm_main'); if (l && !l.done) { l.done = true; l.cb(null, clip('bgm_main')); } };
  /** Cocos 3.8 routing: wx platform listeners -> (UI claim: active hit node swallows) -> else global input. target: 'room' | 'button' | 'blank' */
  let ids = 0;
  function touch(target, phase, x = 50, y = 700) {
    const raw = { touches: phase === 'start' ? [{ identifier: 1, clientX: x, clientY: y }] : [], changedTouches: [{ identifier: 1, clientX: x, clientY: y }] };
    const key = phase === 'start' ? 'TouchStart' : 'TouchEnd';
    for (const f of wxL[key].slice()) f(raw);
    if (opts.web) for (const l of (domL[phase === 'start' ? 'touchstart' : 'touchend'] || []).slice()) l.f({ type: phase === 'start' ? 'touchstart' : 'touchend' });
    const uiY = 844 - y, all = phase === 'start' ? [1] : [];
    const e = { getID: () => 1, getUILocation: () => ({ x, y: uiY }), getLocation: () => ({ x: x * 3, y: uiY * 3 }), getAllTouches: () => all.map(i => ({ getID: () => i })) };
    const type = phase === 'start' ? EventType.TOUCH_START : EventType.TOUCH_END;
    const claim = target === 'room' ? (surface.activeInHierarchy ? surface : null) : target === 'button' ? (button.active = true, button) : null;
    if (claim) claim.emit(type, e); else input.emit(type, e);   // claimed = swallowed: global input never sees it
    if (target === 'button' && phase === 'end') button.active = false;
    ids++;
  }
  const tap = (target, x, y) => { touch(target, 'start', x, y); touch(target, 'end', x, y); };
  const step = (sec, dt = 1 / 60) => { for (let t = 0; t < sec - 1e-9; t += dt) { now += dt * 1000; const a = ga(); if (a) { a.update(dt); for (const c of a.node.comps) if (c !== a && typeof c.update === 'function') c.update(dt); } } };
  const restore = () => { if (saved.wx === undefined) delete G.wx; else G.wx = saved.wx; if (saved.window === undefined) delete G.window; else G.window = saved.window; };
  return { AudioUnlock, GameAudio, ga, mkGA, bgmReady, touch, tap, step, wxL, wxOff, domL, input, room, surface, flow, leaves: () => leaves, looks: () => looks, buttonTouches: () => buttonTouches,
    onceCbs, loads, dirs, clip, AudioSource, restore, diag: () => ga() && ga().musicDiagnostics(), now: () => now };
}
const BLANK = [50, 700], DOOR = [300, 844 - 400];   // client px (y down); door handle at UI (300,400)

// 1) first touch = room swipe, WeChat platform layer present: unlock by wx at touchstart, synchronously
{ const w = world({ wx: true }); w.bgmReady();
  ok(w.diag().gestureSeen === false && w.diag().playbackState === 'idle', 'before any touch: gestureSeen=false, BGM loaded but idle', w.diag());
  ok(w.wxL.TouchStart.length === 1 && w.wxL.TouchEnd.length === 1, 'AudioUnlock registered wx.onTouchStart + wx.onTouchEnd at module load');
  w.touch('room', 'start', ...BLANK);
  const d = w.diag(), s = w.AudioUnlock.snapshot();
  ok(d.gestureSeen === true && d.playbackState === 'pending' && d.playRequested === true, 'room swipe touchstart: gestureSeen=true and BGM play requested INSIDE the callback (no await/timer)', d);
  ok(s.unlocked && s.source === 'wx' && s.event === 'touchstart', 'first source = wx (platform layer runs before the UI surface claims the touch)', s);
  ok(s.bySource['room-swipe'] === 1, 'RoomExploreOverlay.down also forwarded (room-swipe backup)', s.bySource);
  for (let i = 0; i < 6; i++) w.touch('room', 'start', 60 + i * 20, 700);   // drag-ish repeats
  const ls = w.ga().loopSource;
  ok(ls.plays === 1, 'repeated gestures while pending are coalesced (one play request)', { plays: ls.plays });
  ls.playing = true; w.step(0.1);
  ok(w.diag().playbackState === 'playing' && w.diag().playing, 'indoor BGM: pending -> playing', w.diag());
  ok(w.wxOff.length === 0, 'never calls wx.offTouch* (old base libraries drop every listener on a bare off)');
  w.restore(); }

// 2) no platform layer (web-less, wx-less double): room swipe and door tap are forwarded by RoomExploreOverlay itself
{ const w = world({}); w.bgmReady();
  w.touch('room', 'start', ...BLANK); w.touch('room', 'end', 90, 700);
  let s = w.AudioUnlock.snapshot();
  ok(s.unlocked && s.source === 'room-swipe' && w.diag().gestureSeen, 'swallowed room swipe (no wx) -> source=room-swipe', s);
  w.restore(); }
{ const w = world({}); w.bgmReady();
  w.tap('room', ...DOOR);
  const s = w.AudioUnlock.snapshot();
  ok(s.unlocked && s.source === 'door-tap' && s.event === 'touchstart', 'door tap on the handle (no wx) -> source=door-tap, before leaving', s);
  ok(w.leaves() === 1, 'door tap still leaves home exactly once');
  w.restore(); }
{ const w = world({ doorVisible: false }); w.bgmReady();
  w.room.leave();   // T0's "door off-screen" path calls the overlay's leave callback directly
  ok(w.AudioUnlock.snapshot().source === 'door-tap' && w.diag().gestureSeen && w.leaves() === 1, 'overlay leave() callback (T0 door-offscreen path) also forwards door-tap first');
  w.restore(); }

// 3) blank area nobody claims -> Cocos global input
{ const w = world({}); w.bgmReady(); w.surface.active = false;   // e.g. a frame where the room surface is disabled
  w.tap('blank', ...BLANK);
  const s = w.AudioUnlock.snapshot();
  ok(s.unlocked && s.source === 'cocos', 'unclaimed blank-area touch -> source=cocos (cc.input TOUCH_START)', s);
  w.restore(); }
// 4) a UI node that swallows the touch and never forwards: wx layer still unlocks; web preview unlocks via window capture (touchend too)
{ const w = world({ wx: true }); w.bgmReady(); w.surface.active = false;
  w.tap('button', ...BLANK);
  ok(w.buttonTouches() === 2 && w.AudioUnlock.snapshot().source === 'wx' && w.diag().gestureSeen, 'UI-swallowed node (wx present) -> source=wx', w.AudioUnlock.snapshot());
  w.restore(); }
{ const w = world({ web: true }); w.bgmReady(); w.surface.active = false;
  ok(['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerup'].every(t => (w.domL[t] || []).length === 1 && w.domL[t][0].capture), 'web: window capture listeners incl. touchend/mouseup/pointerup (browsers ignore touchstart as activation)');
  w.touch('button', 'end', ...BLANK);
  ok(w.AudioUnlock.snapshot().source === 'canvas' && w.AudioUnlock.snapshot().event === 'touchend' && w.diag().gestureSeen, 'UI-swallowed touch END in web preview -> source=canvas event=touchend', w.AudioUnlock.snapshot());
  w.restore(); }
{ const w = world({}); w.bgmReady(); w.surface.active = false;
  w.tap('button', ...BLANK);
  ok(!w.AudioUnlock.snapshot().unlocked && !w.diag().gestureSeen, 'documented limit: with NO platform layer and NO window, a non-forwarding UI node cannot unlock (real builds always have wx or window)');
  w.restore(); }

// 5) touches before GameAudio exists are ignored, listener stays, a later touch unlocks
{ const w = world({ wx: true, gameAudio: false });
  w.tap('room', ...BLANK);
  ok(!w.AudioUnlock.snapshot().unlocked && w.AudioUnlock.snapshot().ignoredBeforeGameAudio === 4, 'no GameAudio yet (wx start/end + room down/up): gestures ignored, nothing recorded', w.AudioUnlock.snapshot());
  w.mkGA(); w.bgmReady(); w.tap('room', ...BLANK);
  ok(w.AudioUnlock.snapshot().unlocked && w.diag().gestureSeen && w.diag().playbackState === 'pending', 'after GameAudio appears the next touch unlocks (listener was not removed)');
  w.restore(); }

// 6) gesture before the BGM clip loaded: playback starts when it loads; unconfirmed start (10 s) -> a LATER touch retries
{ const w = world({ wx: true });
  w.tap('room', ...BLANK);
  ok(w.diag().gestureSeen && w.diag().status === 'loading' && w.diag().playbackState === 'idle', 'gesture while BGM still loading: gestureSeen, nothing to play yet', w.diag());
  w.bgmReady();
  ok(w.diag().playbackState === 'pending', 'clip load after the gesture starts the loop request by itself', w.diag());
  w.step(10.1);
  ok(w.diag().playbackState === 'retryable', 'start unconfirmed for 10 s -> retryable (needs a new gesture)', w.diag());
  const before = w.ga().loopSource; w.tap('room', ...BLANK); const after = w.ga().loopSource;
  ok(after !== before && after.plays === 1 && w.diag().playbackState === 'pending' && w.diag().playbackRecoveries === 1, 'a later room touch (wx listener still on) rebuilds and retries playback', w.diag());
  after.playing = true; w.step(0.1);
  ok(w.diag().playbackState === 'playing', 'retry confirmed -> playing');
  w.restore(); }

// 7) indoors after unlock: BGM only; waves, gulls and wind stay silent (outdoor weight 0, wind 0); outdoors the gate is open
{ const w = world({ wx: true, ambience: true }); w.bgmReady();
  w.onceCbs.forEach(cb => cb());   // AudioBridge-less: AmbienceAudio.ensure + WindAudio.ensure (director AFTER_SCENE_LAUNCH)
  for (const l of w.loads) if (!l.done) { l.done = true; l.cb(null, w.clip(l.p.split('/').pop())); }
  for (const d of w.dirs) d.cb(null, ['sfx_amb_gull_1', 'sfx_amb_gull_2', 'sfx_amb_gull_3'].map(n => w.clip(n)));
  const a = w.ga(); const played = []; const orig = a.play.bind(a); a.play = (n, v) => { played.push(n); return orig(n, v); };
  w.tap('room', ...BLANK); a.loopSource.playing = true;
  ok(a.canPlayAmbience() === true, 'after unlock canPlayAmbience() = true (gate open)');
  w.flow.w = 1; w.flow.wind = 0; w.step(30);
  const others = a.node.comps.filter(c => c instanceof w.AudioSource && c !== a.loopSource);
  ok(a.loopSource.playing && others.every(s => !s.playing) && played.length === 0, 'indoors 30 s after unlock: only BGM plays; waves/wind sources silent, no gull', { sources: others.map(s => ({ clip: s.clip && s.clip.name, playing: s.playing, vol: +s.volume.toFixed(3) })), played });
  w.flow.w = 0; w.step(3);
  const waves = others.find(s => s.clip && s.clip.name === 'amb_waves_loop');
  ok(waves && waves.plays >= 1 && waves.volume > 0.3, 'sanity: outdoors (w=0) the same unlocked gate lets the waves in', waves && { plays: waves.plays, vol: +waves.volume.toFixed(3) });
  w.restore(); }

// 8) ES5 hazards in the shipped sources touched here
{ const bad = [];
  for (const f of ['audio/AudioUnlock.ts', 'RoomExploreOverlay.ts']) { const src = fs.readFileSync(path.join(S, f), 'utf8');
    if (/for\s*\(\s*(const|let|var)\s+[^;)]*\s+of\s/.test(src)) bad.push(f + ': for-of'); if (/\.\.\.\s*(this\.)?\w*(Map|Set|map|set)\b/.test(src.replace(/\.\.\.this\.(start|handle|rect)/g, ''))) bad.push(f + ': spread of Map/Set'); }
  ok(bad.length === 0, 'AudioUnlock/RoomExploreOverlay: no for-of, no Map/Set spread (ES5 loose-safe)', bad); }

console.log(fail ? `FAILED ${fail}` : 'ALL PASS audio-unlock');
process.exit(fail ? 1 : 0);
