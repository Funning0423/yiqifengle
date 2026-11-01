// Full trip: island → sail → meadow → balloon → sky city → lakeside.
// Each scene change must switch BGM and the ambience group. Crossfade ≤ 2 s.
// Meadow must not keep seagulls. Cues with a transit region id still count.
'use strict';
const path = require('path'), fs = require('fs'), Module = require('module');
const ROOT = path.resolve(__dirname, '..');
const S = path.join(ROOT, 'creator-build-project/assets/scripts');
const ts = require(process.env.QF_TYPESCRIPT_MODULE || '/tmp/ts5/node_modules/typescript');
const tr = f => ts.transpileModule(fs.readFileSync(path.join(S, f), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, experimentalDecorators: true, downlevelIteration: false } }).outputText;
let fail = 0, pass = 0;
const ok = (c, m, d) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d === undefined ? '' : ' ' + JSON.stringify(d))); if (c) pass++; else fail++; };

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
const { resolveSceneAudio, BGM, SCENE_AUDIO_CROSSFADE_S } = T;

function musicWorld(opts) {
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
  if (opts && opts.layers) {
    files['audio/AmbienceAudio.ts'] = tr('audio/AmbienceAudio.ts');
    files['audio/BedLayerCore.ts'] = tr('audio/BedLayerCore.ts');
    files['audio/BedLayerAudio.ts'] = tr('audio/BedLayerAudio.ts');
  }
  const mods = {};
  const req = from => id => {
    if (id === 'cc') return cc;
    const key = { './GameAudio': 'audio/GameAudio.ts', './SceneAudioTable': 'audio/SceneAudioTable.ts', './AmbienceAudio': 'audio/AmbienceAudio.ts', './BedLayerCore': 'audio/BedLayerCore.ts', './SceneMusic': 'audio/SceneMusic.ts', '../world-r2/LevelRegion': 'world-r2/LevelRegion.ts' }[id];
    if (!key) throw Error('unexpected ' + id + ' from ' + from);
    return load(key);
  };
  function load(key) { if (mods[key]) return mods[key].exports; const m = new Module(key); m.filename = path.join(S, key); m.paths = []; mods[key] = m; m.require = req(key); m._compile(files[key], m.filename); return m.exports; }
  const GA = load('audio/GameAudio.ts'), SM = load('audio/SceneMusic.ts');
  const BL = opts && opts.layers ? load('audio/BedLayerAudio.ts') : null;
  GA.GameAudio.now = () => now;
  const a = GA.GameAudio.ensure();
  const G = global;
  G.__worldLoading = { snapshot: () => ({ phase: 'ready' }) };
  scene.byName.WorldIntegrationBoot = [{ valid: true }];
  onceCbs[0]();
  if (BL) BL.BedLayerAudio.ensure();
  const snap = { state: 'home', stable: 'home', journey: { target: null, phase: 'idle', region: 'island' } };
  scene.byName.WorldFlowComponent = [{ valid: true, commands: () => ({ snapshot: () => snap }) }];
  const step = (sec, dt = 1 / 60) => { for (let t = 0; t < sec - 1e-9; t += dt) { now += dt * 1000; for (const s of sources) s.advance(dt); for (const c of a.node.comps) if (typeof c.update === 'function') c.update(dt); } };
  const finish = (bundleName, clipName) => { const bl = bundleLoads.find(x => x.n === bundleName && !x.done); if (!bl) return null; bl.done = true; const b = bundles[bundleName] || mkBundle(bundleName); bundles[bundleName] = b; bl.cb(null, b); const l = b.loads.find(x => !x.done); if (!l) return null; l.done = true; const c = clip(clipName, 80); l.cb(null, c); return c; };
  const durOf = (p) => { const name = String(p).split('/').pop(); if (name === 'amb_meadow_birds_loop') return 30.204; if (name === 'amb_meadow_insects_loop') return 19.464; if (name === 'amb_sky_air_loop') return 32.22; return 3.2; };
  const pump = () => { for (let guard = 0; guard < 24; guard++) { const bl = bundleLoads.find(x => !x.done); if (!bl) break; bl.done = true; const b = bundles[bl.n] || mkBundle(bl.n); bundles[bl.n] = b; bl.cb(null, b); for (let g2 = 0; g2 < 24; g2++) { const l = b.loads.find(x => !x.done); if (!l) break; l.done = true; l.cb(null, clip(String(l.p).split('/').pop(), durOf(l.p))); } } };
  const sm = a.node.comps.find(c => c instanceof SM.SceneMusic);
  const bedPlayer = BL ? a.node.comps.find(c => c instanceof BL.BedLayerAudio) : null;
  return { a, sm, snap, step, finish, pump, bedPlayer, core: BL ? load('audio/BedLayerCore.ts') : null, input: cc.input, live: () => sources.filter(s => !s.destroyed && s.playing && s.clip), cleanup: () => { delete G.__worldLoading; delete G.__sceneAudioBed; delete G.__sceneTransitCue; } };
}

function bed() { return global.__sceneAudioBed || {}; }
function cue(name, region) { global.__sceneTransitCue = name ? { cue: name, region: region || '', t: 1 } : null; }
function xfadeOk(d) {
  const x = d && d.sceneCrossfade;
  return !!(x && x.fadingOut && typeof x.xfadeS === 'number' && x.xfadeS > 0 && x.xfadeS <= 2);
}

/** Change the world, poll once, and require a new BGM file with a ≤2 s crossfade. */
function expectSwitch(w, label, pathWant, bundleWant, clipName, bedWant) {
  const before = w.a.musicDiagnostics().path;
  w.step(0.3);
  const d = w.a.musicDiagnostics();
  const b = bed();
  const layersOk = Object.keys(bedWant).every(k => b[k] === bedWant[k]);
  ok(d.path === pathWant && d.path !== before && d.bundle === bundleWant && xfadeOk(d) && layersOk, label, { before, path: d.path, bundle: d.bundle, xf: d.sceneCrossfade, bed: b, want: bedWant });
  const old = w.live().slice();
  const started = w.finish(bundleWant, clipName);
  ok(!!started, label + ': new clip loads');
  w.step(1 / 60);
  w.step(2.05);
  const live = w.live();
  const onlyNew = live.length === 1 && live[0].clip && live[0].clip.name === clipName && old.every(s => s.destroyed || s === live[0]);
  ok(onlyNew, label + ': after ≤2 s only the new BGM is playing', live.map(s => s.clip && s.clip.name));
}

ok(SCENE_AUDIO_CROSSFADE_S <= 2 && SCENE_AUDIO_CROSSFADE_S >= 0.2, 'scene crossfade constant is at most 2 s', SCENE_AUDIO_CROSSFADE_S);

// Ride phase stays "ready" for the whole sail/balloon (walk() does not advance phase). Arrival sets target null while state is still region-travel.
{
  const sail = resolveSceneAudio({ state: 'region-travel', stable: 'island', journeyTarget: 'meadow', journeyPhase: 'ready', journeyRegion: 'island' });
  ok(sail.place === 'sail' && sail.track === 'sail' && sail.layers.indexOf('gulls') >= 0, 'island→meadow while sailing (phase ready): sail BGM, gulls only at sea', { place: sail.place, track: sail.track, layers: sail.layers });
  const landed = resolveSceneAudio({ state: 'region-travel', stable: 'island', journeyTarget: null, journeyPhase: 'arrived', journeyRegion: 'meadow' });
  ok(landed.place === 'meadow' && landed.track === 'meadow' && landed.layers.indexOf('gulls') < 0 && landed.layers.indexOf('birds') >= 0, 'sail end, target cleared, state still region-travel: meadow bed, not island, no gulls', { place: landed.place, track: landed.track, layers: landed.layers });
  const up = resolveSceneAudio({ state: 'region-travel', stable: 'meadow', journeyTarget: 'skycity', journeyPhase: 'ready', journeyRegion: 'meadow' });
  ok(up.place === 'balloon' && up.track === 'skycity' && up.layers.indexOf('gulls') < 0 && up.layers.indexOf('highWind') >= 0 && up.layers.indexOf('birds') < 0, 'meadow→sky city in the air (phase ready): sky BGM + high wind, no gulls or meadow birds', { place: up.place, track: up.track, layers: up.layers });
  const down = resolveSceneAudio({ state: 'region-travel', stable: 'skycity', journeyTarget: 'lakeside', journeyPhase: 'ready', journeyRegion: 'skycity' });
  ok(down.place === 'balloon' && down.track === 'skycity' && down.layers.indexOf('gulls') < 0 && down.layers.indexOf('lake') < 0, 'sky city→lakeside descent: balloon bed, not the island track or seagulls', { place: down.place, track: down.track, layers: down.layers });
  const lake = resolveSceneAudio({ state: 'lakeside', stable: 'lakeside', journeyTarget: null, journeyPhase: 'arrived', journeyRegion: 'lakeside' });
  ok(lake.place === 'lakeside' && lake.track === 'lakeside' && lake.layers.indexOf('lake') >= 0 && lake.layers.indexOf('gulls') < 0 && lake.layers.indexOf('birds') < 0 && lake.layers.indexOf('highWind') < 0, 'lakeside: own BGM + lake, no gulls, birds, or high wind', { place: lake.place, track: lake.track, layers: lake.layers });
  const paths = ['island', 'meadow', 'skycity', 'lakeside'].map(id => BGM[id] && BGM[id].path);
  ok(paths.every(Boolean) && new Set(paths).size === 4 && BGM.sail && BGM.sail.path !== BGM.meadow.path, 'island, meadow, sky city, lakeside (and the sail) are different BGM files', { paths, sail: BGM.sail && BGM.sail.path });
}

function trackOf(id) {
  const t = BGM[id];
  return t ? { path: t.path, bundle: t.bundle } : { path: 'missing:' + id, bundle: 'missing:' + id };
}

{
  const w = musicWorld();
  w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.island.path && bed().place === 'home' && bed().gulls === false, 'room: island BGM, no seagulls');
  w.finish(BGM.island.bundle, 'bgm_main'); w.input.emit('touch'); w.step(1.6);
  w.snap.state = 'island'; w.snap.stable = 'island'; w.snap.journey = { target: null, phase: 'arrived', region: 'island' }; cue(null);
  w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.island.path && bed().gulls === true && bed().waves === true && bed().birds !== true, 'island: sea bed, seagulls, no meadow birds');

  w.snap.state = 'region-travel'; w.snap.stable = 'island'; w.snap.journey = { target: 'meadow', phase: 'ready', region: 'island' };
  const sail = trackOf('sail');
  expectSwitch(w, 'island→sail', sail.path, sail.bundle, 'bgm_sail', { place: 'sail', gulls: true, waves: true, birds: false, insects: false, lake: false, highWind: false });

  cue('sail-dock', 'meadow');
  const meadow = trackOf('meadow');
  expectSwitch(w, 'sail-dock→meadow (cue, phase still ready)', meadow.path, meadow.bundle, 'bgm_meadow', { place: 'meadow', gulls: false, waves: false, birds: true, insects: true, lake: false, highWind: false });

  w.snap.state = 'meadow'; w.snap.stable = 'meadow'; w.snap.journey = { target: null, phase: 'arrived', region: 'meadow' }; cue(null);
  w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.meadow.path && bed().gulls === false && bed().birds === true && bed().insects === true && bed().waves === false, 'standing in the meadow: meadow BGM, birds and insects, no seagulls');

  // World snapshot has not left the meadow yet. The balloon still stamps a transit id.
  cue('sky-city-enable', 'meadow-skycity');
  const sky = trackOf('skycity');
  expectSwitch(w, 'meadow→sky city on sky-city-enable (region meadow-skycity)', sky.path, sky.bundle, 'bgm_skycity', { place: 'skycity', gulls: false, waves: false, birds: false, insects: false, lake: false, highWind: true });

  w.snap.state = 'region-travel'; w.snap.stable = 'meadow'; w.snap.journey = { target: 'skycity', phase: 'ready', region: 'meadow' }; cue('balloon-liftoff', 'balloon');
  w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.skycity.path && bed().place === 'balloon' && bed().gulls === false && bed().birds === false && bed().highWind === true, 'balloon ride: sky BGM already playing, high wind, no gulls or birds');

  w.snap.state = 'skycity'; w.snap.stable = 'skycity'; w.snap.journey = { target: null, phase: 'arrived', region: 'skycity' }; cue(null);
  w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.skycity.path && bed().place === 'skycity' && bed().gulls === false && bed().birds === false && bed().highWind === true && bed().lake === false, 'sky city: sky BGM + high wind, no seagulls or meadow birds');

  // A late sail cue must not pull the sky city back to the sea.
  cue('sail-dock', 'meadow');
  w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.skycity.path && bed().place === 'skycity' && bed().gulls === false, 'late sail-dock while in the sky city does not restore seagulls');

  w.snap.state = 'region-travel'; w.snap.stable = 'skycity'; w.snap.journey = { target: 'lakeside', phase: 'ready', region: 'skycity' }; cue('balloon-liftoff', 'balloon');
  w.step(0.3);
  ok(w.a.musicDiagnostics().path === BGM.skycity.path && w.a.musicDiagnostics().path !== BGM.island.path && bed().place === 'balloon' && bed().gulls === false && bed().lake === false && bed().highWind === true, 'descent toward the lake: balloon bed, not island BGM, no seagulls');

  w.snap.state = 'lakeside'; w.snap.stable = 'lakeside'; w.snap.journey = { target: null, phase: 'arrived', region: 'lakeside' }; cue(null);
  const lake = trackOf('lakeside');
  expectSwitch(w, 'arrival at the lake', lake.path, lake.bundle, 'bgm_lakeside', { place: 'lakeside', gulls: false, waves: false, birds: false, insects: false, lake: true, highWind: false });

  // Empty target at the end of a ride must not snap the meadow back to the island track.
  w.snap.state = 'region-travel'; w.snap.stable = 'meadow'; w.snap.journey = { target: null, phase: 'arrived', region: 'meadow' };
  w.step(0.3);
  ok(bed().place === 'meadow' && bed().gulls === false && w.a.musicDiagnostics().path === BGM.meadow.path, 'target-null arrival window stays on the meadow, no seagulls');

  w.cleanup();
}

const near = (a, b, e) => Math.abs(a - b) <= e;
{
  const w = musicWorld({ layers: true });
  const C = w.core;
  ok(!!w.bedPlayer && C && C.MAX_SCATTER === 6 && w.bedPlayer.diagnostics().fadeS === 2, 'bed player is mounted; scatter cap is 6; layer crossfade is 2 s');
  const meadow = { place: 'meadow', birds: true, insects: true, highWind: false };
  ok(C.bedLayerTarget('birds', meadow, 0) === 0.8 && C.bedLayerTarget('insects', meadow, 0) === 0.5, 'meadow design: birds 0.8, insects 0.5');
  ok(near(C.bedLayerVol('insects', 'meadow', 1), 0.5 * Math.pow(10, 3 / 20), 1e-6), 'insects at night are +3 dB');
  ok(C.bedLayerTarget('highWind', { place: 'balloon', highWind: true }, 0) === 0.5 && C.bedLayerTarget('highWind', { place: 'skycity', highWind: true }, 0) === 0.75, 'high wind is 0.5 in the balloon and 0.75 in the sky city');
  ok(C.bedLayerTarget('birds', { place: 'island', birds: false, gulls: true }, 0) === 0 && C.bedLayerTarget('insects', { place: 'sail', insects: false }, 0) === 0 && C.bedLayerTarget('highWind', { place: 'lakeside', highWind: false, lake: true }, 0) === 0 && C.bedLayerTarget('birds', { place: 'meadow', birds: false }, 0) === 0, 'island, sail, and lakeside do not open the three beds; a closed flag stays silent');
  let curveOk = true;
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    if (!near(C.layerLevelAt(0, 0.8, u), 0.8 * Math.sin(u * Math.PI / 2), 1e-9)) curveOk = false;
    if (!near(C.layerLevelAt(0.8, 0, u), 0.8 * Math.cos(u * Math.PI / 2), 1e-9)) curveOk = false;
    if (!near(C.layerLevelAt(0, 0.5, u), 0.5 * Math.sin(u * Math.PI / 2), 1e-9)) curveOk = false;
  }
  const ride = C.layerLevelAt(0.5, 0.75, 0.5);
  ok(curveOk && near(ride, 0.625, 1e-9) && ride <= 0.75, 'on/off is equal-power; the same loop changing level does not overshoot', ride);
  const fileS = { birds: 30.204, insects: 19.464, highWind: 32.22 };
  let seamFits = true;
  const seamGap = {};
  ['birds', 'insects', 'highWind'].forEach(id => {
    const spec = C.BED_LOOPS[id];
    const tail = fileS[id] - spec.loopS;
    const need = C.encoderDelayS(spec.sr) + C.SEAM_XFADE_S;
    seamGap[id] = { tail: +tail.toFixed(4), need: +need.toFixed(4) };
    if (!(tail > need)) seamFits = false;
  });
  ok(seamFits, 'loop crossfade ends before the file ends (no wrap click)', seamGap);

  function fake() { return { volume: 0, playing: false, currentTime: 0, wraps: 0, play() { this.playing = true; }, pause() { this.playing = false; }, stop() { this.playing = false; this.currentTime = 0; } }; }
  function tick(s, dt, dur) { if (!s.playing) return; s.currentTime += dt; if (s.currentTime >= dur) { s.wraps++; s.currentTime -= dur; } }
  const a = fake(), b = fake();
  const loop = new C.LoopBed(C.BED_LOOPS.birds, a, b);
  loop.ready = true;
  const dt = 1 / 120;
  let overlap = 0, sumBad = 0, startedAt = -1;
  for (let i = 0; i < 120 * 32 && !(overlap > 8 && !a.playing && b.playing); i++) {
    loop.step(dt, 0.8, true, 1);
    if (b.playing && startedAt < 0) startedAt = a.currentTime;
    tick(a, dt, fileS.birds); tick(b, dt, fileS.birds);
    if (a.playing && b.playing && b.currentTime > C.encoderDelayS(32000)) {
      overlap++;
      if (Math.abs(a.volume + b.volume - loop.heard) > 1e-4) sumBad++;
    }
  }
  ok(startedAt >= 30 && startedAt < 30.02 && overlap > 8 && sumBad === 0 && !a.playing && b.playing && a.wraps === 0 && b.wraps === 0, 'birds loop hands over on an equal-gain overlap and neither source wraps', { startedAt, overlap, sumBad, aw: a.wraps, bw: b.wraps, at: a.currentTime, bt: b.currentTime });
  const x = fake(), y = fake();
  y.play = function () {};
  const broken = new C.LoopBed(C.BED_LOOPS.insects, x, y);
  broken.ready = true;
  for (let i = 0; i < 120 * 22; i++) { broken.step(dt, 0.5, true, 1); tick(x, dt, fileS.insects); }
  ok(broken.diagnostics().xFailed === true && x.playing, 'if the seam partner never starts, the current loop keeps playing');

  const clock = new C.ScatterClock(0.05, 0.05, () => 0);
  let voices = [], maxN = 0, t = 0;
  for (let i = 0; i < 80; i++) {
    t += 0.05;
    voices = voices.filter(e => e > t);
    if (clock.step(0.05, true, voices.length, 1)) voices.push(t + 2);
    if (voices.length > maxN) maxN = voices.length;
  }
  ok(maxN === 6 && voices.length <= 6 && clock.skipped > 0, 'at most 6 scatter voices; further ones are skipped', { maxN, skipped: clock.skipped });

  w.input.emit('touch');
  w.step(0.2);
  ok(w.a.canPlayAmbience(), 'gesture unlocks ambience for the layer player');
  function row(id) { return w.bedPlayer.diagnostics().layers.filter(r => r.id === id)[0]; }
  function place(state, stable, journey) {
    w.sm.poll = 0;
    w.snap.state = state; w.snap.stable = stable;
    w.snap.journey = journey || { target: null, phase: 'arrived', region: state };
    cue(null);
  }
  function arm() { w.step(1 / 60); w.pump(); }
  function sample(ids, frames) {
    const out = {};
    for (let i = 0; i < ids.length; i++) out[ids[i]] = [];
    for (let k = 0; k < frames; k++) { w.step(1 / 60); for (let i = 0; i < ids.length; i++) out[ids[i]].push(row(ids[i]).level); }
    return out;
  }
  place('island', 'island');
  w.step(0.3); w.pump();
  ok(bed().place === 'island' && bed().gulls === true && bed().waves === true && !row('birds').playing && !row('insects').playing && !row('highWind').playing && row('birds').level === 0, 'island: seagulls and waves stay on; birds, insects, and high wind are silent');
  place('region-travel', 'island', { target: 'meadow', phase: 'ready', region: 'island' });
  w.step(0.3);
  ok(bed().place === 'sail' && bed().gulls === true && bed().waves === true && row('birds').level === 0 && row('highWind').level === 0 && !row('birds').playing, 'sail: seagulls and waves, still no meadow birds or high wind');

  place('meadow', 'meadow', { target: null, phase: 'arrived', region: 'meadow' });
  arm();
  const inn = sample(['birds', 'insects'], 120), birdsIn = inn.birds, insectsIn = inn.insects;
  ok(near(birdsIn[0], C.layerLevelAt(0, 0.8, 1 / 120), 0.02) && near(birdsIn[59], C.layerLevelAt(0, 0.8, 0.5), 0.02) && near(birdsIn[119], 0.8, 0.02), 'meadow birds fade in on the 2 s equal-power curve to 0.8', { a: birdsIn[0], mid: birdsIn[59], end: birdsIn[119] });
  ok(near(insectsIn[119], 0.5, 0.02) && near(insectsIn[59], C.layerLevelAt(0, 0.5, 0.5), 0.02) && row('birds').playing && row('insects').playing && !row('highWind').playing && bed().gulls === false && near(row('birds').out, 0.8, 0.02) && near(row('insects').out, 0.5, 0.02), 'meadow is playing birds and insects at design volume, no seagulls or high wind', { insects: insectsIn[119], outB: row('birds').out, outI: row('insects').out });

  place('region-travel', 'meadow', { target: 'skycity', phase: 'ready', region: 'meadow' });
  arm();
  const up = sample(['birds', 'insects', 'highWind'], 120), birdsOut = up.birds, windIn = up.highWind;
  ok(bed().place === 'balloon' && near(birdsOut[59], C.layerLevelAt(0.8, 0, 0.5), 0.03) && near(birdsOut[119], 0, 0.02) && !row('birds').playing && !row('insects').playing, 'balloon: meadow beds fade out over 2 s', { mid: birdsOut[59], end: birdsOut[119] });
  ok(near(windIn[59], C.layerLevelAt(0, 0.5, 0.5), 0.03) && near(windIn[119], 0.5, 0.02) && row('highWind').playing && near(row('highWind').out, 0.5, 0.02) && bed().gulls === false, 'balloon: high wind fades in to 0.5 and is the layer playing', { mid: windIn[59], end: windIn[119], out: row('highWind').out });

  place('skycity', 'skycity', { target: null, phase: 'arrived', region: 'skycity' });
  const windRide = sample(['highWind'], 120).highWind;
  ok(bed().place === 'skycity' && near(windRide[0], C.layerLevelAt(0.5, 0.75, 1 / 120), 0.03) && near(windRide[59], 0.625, 0.03) && near(windRide[119], 0.75, 0.02) && row('highWind').playing && !row('birds').playing && bed().gulls === false && bed().lake === false, 'sky city: high wind rises 0.5 → 0.75, no birds or seagulls', { a: windRide[0], mid: windRide[59], end: windRide[119] });

  place('lakeside', 'lakeside', { target: null, phase: 'arrived', region: 'lakeside' });
  const windOut = sample(['highWind'], 120).highWind;
  ok(bed().place === 'lakeside' && bed().lake === true && bed().gulls === false && bed().waves === false && bed().birds === false && bed().highWind === false && near(windOut[59], C.layerLevelAt(0.75, 0, 0.5), 0.03) && near(windOut[119], 0, 0.02) && !row('highWind').playing && !row('birds').playing && !row('insects').playing, 'lakeside: only the lake bed; high wind fades out and the three loops are silent', { mid: windOut[59], end: windOut[119] });
  ok(w.bedPlayer.diagnostics().scatter.cap === 6 && w.bedPlayer.diagnostics().scatter.playing <= 6, 'scatter voices never exceed 6', w.bedPlayer.diagnostics().scatter);
  w.cleanup();
}

console.log((fail ? 'FAILED ' + fail : 'ALL PASS') + ' scene bgm switch (' + pass + ' checks)');
process.exitCode = fail ? 1 : 0;
