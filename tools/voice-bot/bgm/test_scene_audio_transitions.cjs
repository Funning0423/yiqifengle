// After every scene transition the current BGM and ambience layers match SceneAudioTable.
// Also: 2 s crossfade, background pause keeps the place, a fresh session starts from the room, seagulls stop off the coast.
'use strict';
const path = require('path'), fs = require('fs'), Module = require('module');
const ROOT = path.resolve(__dirname, '../../..');
const S = path.join(ROOT, 'creator-build-project/assets/scripts');
const ts = require(process.env.QF_TYPESCRIPT_MODULE || '/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/typescript');
const tr = f => ts.transpileModule(fs.readFileSync(path.join(S, f), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, experimentalDecorators: true, downlevelIteration: false } }).outputText;
let fail = 0, pass = 0;
const ok = (c, m, d) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d === undefined ? '' : ' ' + JSON.stringify(d))); if (c) pass++; else fail++; };
const near = (a, b, e) => Math.abs(a - b) <= e;

const CODE = {
  'world-r2/LevelRegion.ts': tr('world-r2/LevelRegion.ts'),
  'audio/SceneAudioTable.ts': tr('audio/SceneAudioTable.ts'),
};
function loadPure(key) {
  const mods = loadPure.mods || (loadPure.mods = {});
  if (mods[key]) return mods[key].exports;
  const m = new Module(key); m.filename = path.join(S, key); m.paths = []; mods[key] = m;
  m.require = id => {
    if (id === '../world-r2/LevelRegion') return loadPure('world-r2/LevelRegion.ts');
    throw Error('unexpected import ' + id);
  };
  m._compile(CODE[key], m.filename);
  return m.exports;
}
const T = loadPure('audio/SceneAudioTable.ts');
const { resolveSceneAudio, SCENE_PROFILES, BGM, LAYER_ASSETS, SCENE_AUDIO_CROSSFADE_S, publishSceneBed } = T;

function disk(bundle, resPath) {
  if (!bundle) return path.join(ROOT, 'creator-build-project/assets/resources', resPath + '.mp3');
  return path.join(ROOT, 'creator-build-project/assets/bundles', bundle, resPath + '.mp3');
}

// ---------- inventory: real files only, missing stays missing ----------
{
  const bgmFiles = Object.keys(BGM).map(id => ({ id, file: disk(BGM[id].bundle, BGM[id].path), ok: fs.existsSync(disk(BGM[id].bundle, BGM[id].path)) }));
  ok(bgmFiles.every(x => x.ok), 'shipped BGM files exist (island / meadow / skycity)', bgmFiles.filter(x => !x.ok));
  const layerFiles = Object.keys(LAYER_ASSETS).map(id => ({ id, file: disk(LAYER_ASSETS[id].bundle, LAYER_ASSETS[id].path), ok: fs.existsSync(disk(LAYER_ASSETS[id].bundle, LAYER_ASSETS[id].path)) }));
  ok(layerFiles.every(x => x.ok), 'shipped ambience layers exist (waves / wind / gulls / lake)', layerFiles.filter(x => !x.ok));
  const cand = T.BGM_CANDIDATES || {};
  const candFiles = Object.keys(cand).map(id => ({ id, ok: fs.existsSync(disk(cand[id].bundle, cand[id].path)), wired: Object.keys(BGM).some(k => BGM[k].path === cand[id].path) }));
  ok(!fs.existsSync(disk(null, 'audio_bgm/bgm_sail')) && candFiles.every(x => x.ok && !x.wired) && (!fs.existsSync(disk('region_lakeside', 'audio/bgm_lakeside')) || !!cand.lakeside), 'sail / lakeside BGM only as delivered candidates (files exist, listed in BGM_CANDIDATES, not wired into BGM yet)', candFiles);
  const route = (T.TRAVEL_ROUTES || {}).lakeside;
  ok(!!route && route.from === 'skycity' && route.via === 'balloon' && route.bgmHandover.shape === 'dip' && Object.keys(T.TRAVEL_ROUTES).every(k => ['island', 'meadow'].indexOf(T.TRAVEL_ROUTES[k].from) < 0 || k !== 'lakeside'), 'plan B: lakeside is reached from sky city by balloon (dip handover); no island / meadow route to the lake in the data', route);
  const pc = T.PENDING_CANDIDATES || {};
  const pcBad = []; Object.keys(pc).forEach(id => pc[id].clips.forEach(c => { if (!fs.existsSync(disk(c.bundle, c.path))) pcBad.push(c.path); }));
  const pcWired = JSON.stringify(T.SCENE_AMBIENCE_DESIGN || {}).match(/waterbird|gardener|starring/g);
  ok(pcBad.length === 0 && !pcWired, 'pending candidates (water birds / gardener / star ring) exist on disk and are not in SCENE_AMBIENCE_DESIGN', { pcBad, pcWired });
  const pend = T.PENDING_LAYER_ASSETS || {};
  const pendBad = Object.keys(pend).filter(id => !fs.existsSync(disk(pend[id].bundle, pend[id].path)));
  ok(pendBad.length === 0, 'pending layer assets (birds / insects / high wind / meadow wind) exist on disk', pendBad);
  const names = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { if (!/^(library|temp|build|node_modules)$/.test(e.name)) walk(f); } else if (/\.(mp3|wav|ogg|meta)$/.test(e.name)) names.push(f); } })(path.join(ROOT, 'creator-build-project/assets'));
  const tagged = names.filter(f => /NOT_FOR_SHIP/i.test(f) || /NOT_FOR_SHIP/i.test(fs.readFileSync(f, 'utf8').slice(0, 4000)));
  ok(tagged.length === 0, 'no audio asset is tagged NOT_FOR_SHIP', tagged);
  const known = { wind: 1, waves: 1, gulls: 1, lake: 1 };
  let badLayer = [];
  Object.keys(SCENE_PROFILES).forEach(id => {
    const p = SCENE_PROFILES[id];
    p.layers.forEach(layer => { if (!known[layer] || !LAYER_ASSETS[layer === 'wind' ? 'wind' : layer]) badLayer.push(id + ':' + layer); });
    p.missing.forEach(m => { if (p.layers.indexOf(m) >= 0) badLayer.push('missing-but-on ' + m); });
  });
  ok(badLayer.length === 0 && SCENE_AUDIO_CROSSFADE_S >= 1.5 && SCENE_AUDIO_CROSSFADE_S <= 2.5, 'profiles only enable shipped layers; crossfade is 1.5–2.5 s', { badLayer, xfade: SCENE_AUDIO_CROSSFADE_S });
}

// ---------- after each transition, BGM id + layers ----------
function bedOf(p) {
  const on = id => p.layers.indexOf(id) >= 0;
  return { waves: on('waves'), gulls: on('gulls'), wind: on('wind'), lake: on('lake'), birds: on('birds'), insects: on('insects'), highWind: on('highWind') };
}
const TRIPS = [
  [{ state: 'home', stable: 'home' }, 'home', 'island', { gulls: false, waves: false, wind: false, lake: false }],
  [{ state: 'island', stable: 'island' }, 'island', 'island', { gulls: true, waves: true, wind: true, lake: false }],
  [{ state: 'region-travel', stable: 'island', journeyTarget: 'meadow', journeyPhase: 'bridge', journeyRegion: 'island' }, 'sail', 'meadow', { gulls: true, waves: true, lake: false }],
  [{ state: 'region-travel', stable: 'island', journeyTarget: 'meadow', journeyPhase: 'arrival', journeyRegion: 'meadow' }, 'meadow', 'meadow', { gulls: false, waves: false, lake: false }],
  [{ state: 'meadow', stable: 'meadow', journeyRegion: 'meadow', journeyPhase: 'arrived' }, 'meadow', 'meadow', { gulls: false, waves: false }],
  [{ state: 'paused', stable: 'meadow', journeyRegion: 'meadow', journeyPhase: 'arrived' }, 'meadow', 'meadow', { gulls: false, waves: false }],
  [{ state: 'region-travel', stable: 'meadow', journeyTarget: 'skycity', journeyPhase: 'bridge', journeyRegion: 'meadow' }, 'balloon', 'skycity', { gulls: false, waves: false, lake: false, highWind: false }],
  [{ state: 'skycity', stable: 'skycity', journeyRegion: 'skycity', journeyPhase: 'arrived' }, 'skycity', 'skycity', { gulls: false, waves: false, highWind: false }],
  [{ state: 'paused', stable: 'skycity', journeyRegion: 'skycity', journeyPhase: 'arrived' }, 'skycity', 'skycity', { gulls: false }],
  [{ state: 'home', stable: 'home' }, 'home', 'island', { gulls: false, waves: false }],
  [{ state: 'region-travel', stable: 'island', journeyTarget: 'lakeside', journeyPhase: 'bridge', journeyRegion: 'island' }, 'island', 'island', { gulls: true, waves: true, lake: false }],
  [{ state: 'region-travel', stable: 'island', journeyTarget: 'lakeside', journeyPhase: 'arrival' }, 'lakeside', 'island', { gulls: false, waves: false, lake: true }],
  [{ state: 'lakeside', stable: 'lakeside' }, 'lakeside', 'island', { gulls: false, waves: false, lake: true }],
  [{ state: 'paused', stable: 'lakeside' }, 'lakeside', 'island', { gulls: false, lake: true }],
  [{ state: 'paused', stable: 'island', journeyTarget: 'meadow', journeyPhase: 'paused', journeyRegion: 'island' }, 'island', 'island', { gulls: true }],
  [{ state: 'level', stable: 'level', boardPresent: true, boardProvider: 'regional-r05', boardRegion: 'meadow' }, 'meadow', 'meadow', { gulls: false }],
  [{ state: 'level', stable: 'level', boardPresent: true, boardProvider: 'mainline-v33', boardStageId: 'mainline-09' }, 'skycity', 'skycity', { gulls: false }],
  [{ state: 'level', stable: 'level', boardPresent: true, boardProvider: 'regional-r05', boardRegion: 'tide' }, 'island', 'island', { gulls: true, waves: true }],
  [{ state: 'level', stable: 'level', boardPresent: true, boardStageId: 'r04-lake-02' }, 'lakeside', 'island', { gulls: false, lake: true }],
  [{ state: 'skycity-loading', stable: 'island' }, 'hold', null, null],
  [{ state: 'level-loading', stable: 'island' }, 'hold', null, null],
  [{ state: 'level', stable: 'level' }, 'hold', null, null],
  [{ state: 'region-loading', stable: 'meadow' }, 'hold', null, null],
];
{
  const bad = [];
  for (let i = 0; i < TRIPS.length; i++) {
    const [probe, place, track, layers] = TRIPS[i];
    const got = resolveSceneAudio(probe);
    if (got.place !== place || got.track !== track) bad.push({ i, probe, place, track, got: { place: got.place, track: got.track } });
    if (layers) {
      const b = bedOf(got);
      Object.keys(layers).forEach(k => { if (b[k] !== layers[k]) bad.push({ i, layer: k, want: layers[k], got: b[k], place: got.place }); });
      if (b.birds || b.insects || b.highWind) bad.push({ i, ghost: b });
    }
  }
  ok(bad.length === 0, 'after each scene transition, BGM id and ambience layers match the table (pause keeps the place; hold keeps the track)', bad);
  ok(SCENE_PROFILES.meadow.missing.indexOf('birds') >= 0 && SCENE_PROFILES.meadow.missing.indexOf('insects') >= 0 && SCENE_PROFILES.skycity.missing.indexOf('highWind') >= 0 && SCENE_PROFILES.lakeside.missing.indexOf('lakeside-bgm') >= 0 && SCENE_PROFILES.sail.missing.indexOf('sail-bgm') >= 0, 'missing beds are named, not filled with a fake file');
}

// ---------- SceneMusic drives setMusic + the bed, including crossfade, pause, restart ----------
function musicWorld() {
  let now = 0;
  class Emitter { constructor() { this._h = {}; } on(t, f, tg) { (this._h[t] = this._h[t] || []).push([f, tg]); } off(t, f, tg) { this._h[t] = (this._h[t] || []).filter(x => !(x[0] === f && (tg === undefined || x[1] === tg))); } emit(t, ...a) { for (const [f, tg] of (this._h[t] || []).slice()) f.apply(tg, a); } }
  const sources = [];
  class AudioSource { constructor() { this.playOnAwake = true; this.loop = false; this.volume = 1; this._clip = null; this.playing = false; this.state = 0; this.t = 0; sources.push(this); }
    get clip() { return this._clip; } set clip(c) { this._clip = c; this.t = 0; } get duration() { return this._clip ? this._clip.duration : 0; } get currentTime() { return this.t; }
    play() { this.state = 1; this.playing = true; } pause() { this.playing = false; this.state = 2; } stop() { this.playing = false; this.state = 3; this.t = 0; } destroy() { this.destroyed = true; this.playing = false; }
    advance(dt) { if (!this.playing || !this._clip) return; this.t += dt; if (this.t >= this._clip.duration) { if (this.loop) this.t -= this._clip.duration; else { this.playing = false; this.state = 3; } } } }
  AudioSource.EventType = { STARTED: 'started', ENDED: 'ended' }; AudioSource.AudioState = { INIT: 0, PLAYING: 1, PAUSED: 2, STOPPED: 3 }; AudioSource.maxAudioChannel = 10;
  class Node extends Emitter { constructor(n) { super(); this.name = n; this.comps = []; this.valid = true; this.children = []; } addChild(c) { this.children.push(c); c.parent = this; } addComponent(C) { const c = new C(); c.node = this; this.comps.push(c); if (c.onLoad) c.onLoad(); return c; } getComponent(C) { return this.comps.find(c => c instanceof C) || null; } getComponentsInChildren(name) { return scene.byName[name] || []; } }
  function Component() {} Component.prototype.destroy = function () { this._destroyed = true; return true; };
  const bundleLoads = [], bundles = {}, onceCbs = [];
  const clip = (n, d) => ({ name: n, duration: d, refs: 0, addRef() { this.refs++; return this; }, decRef() { this.refs--; return this; }, getDuration() { return this.duration; } });
  const mkBundle = name => ({ name, loads: [], load(p, T, cb) { this.loads.push({ p, cb }); } });
  const scene = new Node('Scene'); scene.byName = {};
  const cc = { _decorator: { ccclass: () => C => C, property: () => () => {} }, Component, Node, AudioSource, AudioClip: class {},
    isValid: o => !!o && o.valid !== false && o._destroyed !== true,
    resources: { load() {}, loadDir() {} }, assetManager: { getBundle: n => bundles[n] || null, loadBundle(n, cb) { bundleLoads.push({ n, cb }); } },
    director: { getScene: () => scene, addPersistRootNode() {}, once(ev, cb) { onceCbs.push(cb); } }, Director: { EVENT_AFTER_SCENE_LAUNCH: 'after' },
    game: new Emitter(), Game: { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' }, sys: { localStorage: { getItem: () => null, setItem() {} } },
    input: new Emitter(), Input: { EventType: { TOUCH_END: 'touch', MOUSE_UP: 'mouse', KEY_DOWN: 'key' } } };
  const files = { 'world-r2/LevelRegion.ts': CODE['world-r2/LevelRegion.ts'], 'audio/SceneAudioTable.ts': CODE['audio/SceneAudioTable.ts'], 'audio/GameAudio.ts': tr('audio/GameAudio.ts'), 'audio/SceneMusic.ts': tr('audio/SceneMusic.ts') };
  const mods = {};
  const req = from => id => { if (id === 'cc') return cc; const key = { './GameAudio': 'audio/GameAudio.ts', './SceneAudioTable': 'audio/SceneAudioTable.ts', '../world-r2/LevelRegion': 'world-r2/LevelRegion.ts' }[id]; if (!key) throw Error('unexpected ' + id + ' from ' + from); return load(key); };
  function load(key) { if (mods[key]) return mods[key].exports; const m = new Module(key); m.filename = path.join(S, key); m.paths = []; mods[key] = m; m.require = req(key); m._compile(files[key], m.filename); return m.exports; }
  const GA = load('audio/GameAudio.ts'), SM = load('audio/SceneMusic.ts');
  GA.GameAudio.now = () => now;
  const a = GA.GameAudio.ensure();
  const G = global; G.__worldLoading = { snapshot: () => ({ phase: 'ready' }) };
  scene.byName.WorldIntegrationBoot = [{ valid: true }];
  onceCbs[0]();
  const sm = a.node.comps.find(c => c instanceof SM.SceneMusic);
  const snap = { state: 'home', stable: 'home' };
  scene.byName.WorldFlowComponent = [{ valid: true, commands: () => ({ snapshot: () => snap }) }];
  const step = (sec, dt = 1 / 60) => { for (let t = 0; t < sec - 1e-9; t += dt) { now += dt * 1000; for (const s of sources) s.advance(dt); for (const c of a.node.comps) if (typeof c.update === 'function') c.update(dt); } };
  const finish = (bundleName, clipName) => { const bl = bundleLoads.find(x => x.n === bundleName && !x.done); if (!bl) return null; bl.done = true; const b = bundles[bundleName] || mkBundle(bundleName); bundles[bundleName] = b; bl.cb(null, b); const l = b.loads.find(x => !x.done); l.done = true; const c = clip(clipName, 80); l.cb(null, c); return c; };
  return { a, sm, snap, step, finish, input: cc.input, live: () => sources.filter(s => !s.destroyed && s.playing && s.clip), cleanup: () => { delete G.__worldLoading; delete G.__sceneAudioBed; } };
}
{
  const w = musicWorld();
  w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.island.path && w.a.musicDiagnostics().bundle === BGM.island.bundle && global.__sceneAudioBed && global.__sceneAudioBed.gulls === false && global.__sceneAudioBed.place === 'home', 'restart / room ready at home: island BGM, no seagulls', global.__sceneAudioBed);
  w.finish('audio_bgm_island', 'bgm_main'); w.input.emit('touch'); w.step(1.6);
  ok(w.live().length === 1 && near(w.a.loopSource.volume, 0.4, 0.02), 'home BGM finished its room fade-in');
  w.snap.state = 'island'; w.snap.stable = 'island'; w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.island.path && global.__sceneAudioBed.gulls === true && global.__sceneAudioBed.waves === true && global.__sceneAudioBed.place === 'island', 'island: same BGM, sea layers on');
  w.snap.state = 'region-travel'; w.snap.stable = 'island'; w.snap.journey = { target: 'meadow', phase: 'bridge', region: 'island' }; w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.meadow.path && w.a.musicDiagnostics().bundle === 'region_meadow' && global.__sceneAudioBed.place === 'sail' && global.__sceneAudioBed.gulls === true && w.a.musicDiagnostics().sceneCrossfade.xfadeS === 2 && w.a.musicDiagnostics().sceneCrossfade.fadingOut, 'sail starts: crossfade to meadow BGM over 2 s, gulls still on', w.a.musicDiagnostics().sceneCrossfade);
  const old = w.live()[0];
  w.finish('region_meadow', 'bgm_meadow'); w.step(1 / 60);
  ok(w.a.musicDiagnostics().sceneCrossfade.started && w.a.loopSource.playing, 'meadow clip confirmed, 2 s crossfade running');
  w.step(1);
  const v = w.a.musicDiagnostics().volume;
  ok(old && near(old.volume * old.volume + w.a.loopSource.volume * w.a.loopSource.volume, v * v, 0.05 * v * v), 'halfway through the 2 s crossfade: equal power', { old: old && old.volume, nw: w.a.loopSource.volume, v });
  w.step(1.05);
  ok(old.destroyed && near(w.a.loopSource.volume, v, 1e-6) && w.a.musicDiagnostics().path === BGM.meadow.path, 'after 2 s only the meadow BGM is left');
  w.snap.journey.phase = 'arrival'; w.snap.journey.region = 'meadow'; w.step(0.3);
  ok(global.__sceneAudioBed.place === 'meadow' && global.__sceneAudioBed.gulls === false && global.__sceneAudioBed.waves === false && w.a.musicDiagnostics().path === BGM.meadow.path, 'sail arrival: gulls and waves off, meadow BGM stays');
  w.snap.state = 'meadow'; w.snap.stable = 'meadow'; w.snap.journey = { target: null, phase: 'arrived', region: 'meadow' }; w.step(0.3);
  ok(global.__sceneAudioBed.gulls === false && w.a.musicDiagnostics().path === BGM.meadow.path, 'standing in the meadow: still meadow BGM, no seagulls');
  w.snap.state = 'paused'; w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.meadow.path && global.__sceneAudioBed.place === 'meadow' && global.__sceneAudioBed.gulls === false, 'background pause keeps the meadow bed (does not snap back to island)');
  w.snap.state = 'meadow'; w.step(0.05);
  w.game = null;
  w.snap.state = 'region-travel'; w.snap.stable = 'meadow'; w.snap.journey = { target: 'skycity', phase: 'bridge', region: 'meadow' }; w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.skycity.path && w.a.musicDiagnostics().bundle === 'region_skycity' && global.__sceneAudioBed.place === 'balloon' && global.__sceneAudioBed.gulls === false && global.__sceneAudioBed.highWind === false, 'balloon: crossfade to skycity BGM, no gulls, no high-wind layer');
  w.snap.state = 'skycity'; w.snap.stable = 'skycity'; w.snap.journey = { target: null, phase: 'arrived', region: 'skycity' }; w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.skycity.path && global.__sceneAudioBed.place === 'skycity' && global.__sceneAudioBed.gulls === false, 'sky city arrived: skycity BGM, sea layers off');
  w.snap.state = 'paused'; w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.skycity.path && global.__sceneAudioBed.gulls === false, 'background on the sky city keeps skycity BGM');
  w.snap.state = 'lakeside'; w.snap.stable = 'lakeside'; w.snap.journey = { region: 'lakeside', phase: 'arrived', target: null }; w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.island.path && global.__sceneAudioBed.place === 'lakeside' && global.__sceneAudioBed.lake === true && global.__sceneAudioBed.gulls === false && global.__sceneAudioBed.waves === false, 'lakeside: island BGM (no lakeside track), lake layer on, gulls off');
  w.cleanup();
}
{
  const w = musicWorld();
  w.snap.state = 'meadow'; w.snap.stable = 'meadow'; w.snap.journey = { region: 'meadow', phase: 'arrived', target: null };
  w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.meadow.path && global.__sceneAudioBed.gulls === false && global.__sceneAudioBed.place === 'meadow', 'fresh session restored on the meadow: meadow BGM, no seagulls (not the island bed)');
  w.cleanup();
}

// ---------- AmbienceAudio / WindAudio actually follow the bed ----------
function ambienceEnv() {
  delete global.__sceneAudioBed; delete global.__voiceWind;
  const onceCbs = [], loads = [];
  class AudioSource { constructor() { this.playOnAwake = true; this.loop = false; this.volume = 1; this.clip = null; this.playing = false; this.currentTime = 0; }
    play() { this.playing = true; } stop() { this.playing = false; } pause() { this.playing = false; } destroy() { this.destroyed = true; this.playing = false; } }
  class Node { constructor() { this.comps = []; this.valid = true; } addComponent(C) { const c = new C(); c.node = this; this.comps.push(c); if (c.onLoad) c.onLoad(); return c; } getComponent(C) { return this.comps.find(c => c instanceof C) || null; } }
  function Component() {}
  const flow = { valid: true, wind: 0, visible: true, w: 0, rig: true,
    getWindStrength() { return this.wind; }, isWorldVisible() { return this.visible; }, getRoomLightWeight() { return this.w; }, hasRoomLight() { return this.rig; }, onCraneStart() { return () => {}; } };
  const audioNode = new Node();
  const GameAudio = { instance: { canPlayAmbience() { return true; }, node: audioNode, getMusicVolume() { return 0.4; }, transitionGain() { return 1; }, play() {}, setWindDuck() {} }, ensure() { return this.instance; }, ambienceMounters: [], ambienceQuieters: [] };
  const scene = { getComponentInChildren() { return flow; } };
  const cc = { _decorator: { ccclass: () => C => C }, Component, AudioSource, AudioClip: class {}, isValid: o => !!o && o.valid !== false,
    resources: { load(p, T, cb) { loads.push(p); cb(null, { p, refs: 0, addRef() { this.refs++; }, decRef() { this.refs--; } }); } },
    director: { getScene: () => scene, once(ev, cb) { onceCbs.push(cb); } }, Director: { EVENT_AFTER_SCENE_LAUNCH: 'x' } };
  const compile = (file, extra) => { const m = new Module(file); m.filename = file; m.paths = []; const orig = m.require.bind(m);
    m.require = id => id === 'cc' ? cc : id === './GameAudio' ? { GameAudio } : extra && extra[id] ? extra[id] : orig(id);
    m._compile(tr(path.relative(S, file)), file); return m.exports; };
  const amb = compile(path.join(S, 'audio/AmbienceAudio.ts'));
  const wind = compile(path.join(S, 'audio/WindAudio.ts'), { './AmbienceAudio': amb });
  audioNode.addComponent(amb.AmbienceAudio);
  audioNode.addComponent(wind.WindAudio);
  const a = audioNode.getComponent(amb.AmbienceAudio), w = audioNode.getComponent(wind.WindAudio);
  const run = (sec, dt = 1 / 60) => { for (let t = 0; t < sec - 1e-9; t += dt) { a.update(dt); w.update(dt); } };
  return { a, w, flow, amb, run };
}
{
  const e = ambienceEnv();
  e.run(1.2);
  ok(e.a.src.playing && e.a.src.volume > 0.2, 'on the coast the wave bed is playing', e.a.src.volume);
  const id = e.amb.AmbienceAudio.requestGullCall('near', 10);
  ok(id !== null && e.a.gullDiagnostics().playing.length === 1, 'a seagull call is playing on the coast', e.a.gullDiagnostics());
  e.flow.wind = 1; e.run(1.2);
  ok(e.w.snapshot().softPlaying || e.w.snapshot().strongPlaying, 'wind bed plays while the wind layer is allowed', e.w.snapshot());
  publishSceneBed(SCENE_PROFILES.meadow);
  e.run(1 / 60);
  ok(!e.a.src.playing && e.a.src.volume === 0 && e.a.gullDiagnostics().playing.length === 0 && e.a.gullDiagnostics().pending.length === 0, 'meadow bed: waves and the live seagull stop on the next frame');
  ok(!e.w.snapshot().softPlaying && !e.w.snapshot().strongPlaying && e.w.snapshot().s === 0, 'meadow bed: wind loops stop (no meadow wind asset)');
  publishSceneBed(SCENE_PROFILES.island);
  e.flow.wind = 0; e.run(1.2);
  ok(e.a.src.playing && e.a.src.volume > 0.2, 'back on the island the wave bed returns');
  delete global.__sceneAudioBed; delete global.__voiceWind;
}

console.log((fail ? 'FAILED ' + fail : 'ALL PASS') + ' scene-audio transitions (' + pass + ' checks)');
process.exitCode = fail ? 1 : 0;
