// Box test for scene BGM (Voice bot): REAL audio/GameAudio.ts + REAL audio/SceneMusic.ts transpiled to ES5 (downlevelIteration off,
// like Cocos' loose ES5), against a small cc double. Covers: bundle loading (assetManager.loadBundle -> bundle.load, cached getBundle,
// errors, stale callbacks), two-source crossfade looping (schedule at duration - MP3 padding - 150 ms, equal power, role swap, coarse
// currentTime, partner that never starts, gates mid-fade), scene switch crossfade (1.5 s, failure fade-out, null stop, not-yet-audible
// switch stays immediate), SceneMusic mapping + fallback, ES5 safety scan of both files, and the committed BGM assets / bundle metas.
// Usage: node tools/voice-bot/bgm/test_scene_bgm.cjs   (typescript: QF_TYPESCRIPT_MODULE or the GGbot vendor-node copy)
'use strict';
const path = require('path'), fs = require('fs'), Module = require('module'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '../../..'), P = path.join(ROOT, 'creator-build-project'), S = path.join(P, 'assets/scripts');
const ts = require(process.env.QF_TYPESCRIPT_MODULE || '/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/typescript');
const tr = f => ts.transpileModule(fs.readFileSync(path.join(S, f), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, experimentalDecorators: true, downlevelIteration: false } }).outputText;
const CODE = { 'audio/GameAudio.ts': tr('audio/GameAudio.ts'), 'audio/SceneMusic.ts': tr('audio/SceneMusic.ts') };
let fail = 0, pass = 0; const ok = (c, m, d) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d === undefined ? '' : ' ' + JSON.stringify(d))); if (c) pass++; else fail++; };
const near = (a, b, e) => Math.abs(a - b) <= e;

function world(opts = {}) {
  let now = 0;
  class Emitter { constructor() { this._h = {}; } on(t, f, tg) { (this._h[t] = this._h[t] || []).push([f, tg]); } off(t, f, tg) { this._h[t] = (this._h[t] || []).filter(x => !(x[0] === f && (tg === undefined || x[1] === tg))); }
    emit(t, ...a) { for (const [f, tg] of (this._h[t] || []).slice()) f.apply(tg, a); } }
  const sources = [];
  class AudioSource { constructor() { this.playOnAwake = true; this.loop = false; this.volume = 1; this._clip = null; this.playing = false; this.plays = 0; this.state = 0; this.t = 0; this.shownT = 0; this.wraps = 0; sources.push(this); }
    get clip() { return this._clip; } set clip(c) { this._clip = c; this.t = 0; this.shownT = 0; }
    get duration() { return this._clip ? this._clip.duration : 0; } get currentTime() { return opts.coarse ? this.shownT : this.t; }
    play() { this.plays++; this.state = 1; if (!AudioSource.deferStart) this.playing = true; } pause() { this.playing = false; this.state = 2; } stop() { this.playing = false; this.state = 3; this.t = 0; } destroy() { this.destroyed = true; this.playing = false; }
    advance(dt) { if (!this.playing || !this._clip) return; this.t += dt; if (this.t >= this._clip.duration) { if (this.loop) { this.t -= this._clip.duration; this.wraps++; } else { this.t = this._clip.duration; this.playing = false; this.state = 3; } }
      if (!opts.coarse || Math.floor(this.t / 0.25) !== Math.floor(this.shownT / 0.25) || this.t < this.shownT) this.shownT = opts.coarse ? Math.floor(this.t / 0.25) * 0.25 : this.t; } }
  AudioSource.EventType = { STARTED: 'started', ENDED: 'ended' }; AudioSource.AudioState = { INIT: 0, PLAYING: 1, PAUSED: 2, STOPPED: 3 }; AudioSource.maxAudioChannel = 10; AudioSource.deferStart = false;
  class Node extends Emitter { constructor(n) { super(); this.name = n; this.comps = []; this.valid = true; this.children = []; }
    addChild(c) { this.children.push(c); } addComponent(C) { const c = new C(); c.node = this; this.comps.push(c); if (c.onLoad) c.onLoad(); return c; }
    getComponent(C) { return this.comps.find(c => c instanceof C) || null; } getComponentsInChildren(name) { return (scene.byName[name] || []); } }
  function Component() {} Component.prototype.destroy = function () { this._destroyed = true; return true; };
  const loads = [], bundleLoads = [], bundles = {}, onceCbs = [];
  const clip = (n, d = 10) => ({ name: n, duration: d, refs: 0, addRef() { this.refs++; return this; }, decRef() { this.refs--; return this; }, getDuration() { return this.duration; } });
  const mkBundle = name => ({ name, loads: [], load(p, T, cb) { this.loads.push({ p, cb }); } });
  const assetManager = { getBundle: n => bundles[n] || null, loadBundle(n, cb) { bundleLoads.push({ n, cb }); } };
  const input = new Emitter(), game = new Emitter(), store = new Map();
  const scene = new Node('Scene'); scene.byName = {};
  const cc = { _decorator: { ccclass: () => C => C, property: () => () => {} }, Component, Node, AudioSource, AudioClip: class {},
    isValid: (o) => !!o && o.valid !== false && o.destroyed !== true && o._destroyed !== true,
    resources: { load(p, T, cb) { loads.push({ p, cb }); }, loadDir() {} }, assetManager,
    director: { getScene: () => scene, addPersistRootNode() {}, once(ev, cb) { onceCbs.push(cb); } }, Director: { EVENT_AFTER_SCENE_LAUNCH: 'after' },
    game, Game: { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' }, sys: { localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) } },
    input, Input: { EventType: { TOUCH_END: 'touch', MOUSE_UP: 'mouse', KEY_DOWN: 'key' } } };
  const mods = {};
  const req = from => id => { if (id === 'cc') return cc; const key = { './GameAudio': 'audio/GameAudio.ts' }[id]; if (!key) throw Error('unexpected import ' + id + ' from ' + from); return load(key); };
  function load(key) { if (mods[key]) return mods[key].exports; const m = new Module(key); m.filename = path.join(S, key); m.paths = []; mods[key] = m; m.require = req(key); m._compile(CODE[key], m.filename); return m.exports; }
  const GA = load('audio/GameAudio.ts'), SM = load('audio/SceneMusic.ts');
  GA.GameAudio.now = () => now;
  const a = GA.GameAudio.ensure();
  const step = (sec, dt = 1 / 60) => { for (let t = 0; t < sec - 1e-9; t += dt) { now += dt * 1000; for (const s of sources) s.advance(dt); for (const c of a.node.comps) if (typeof c.update === 'function') c.update(dt); } };
  const live = () => sources.filter(s => !s.destroyed && s.playing && s.clip);
  const ready = (n = 'main', d = 10) => { const l = loads.find(x => !x.done); l.done = true; const c = clip(n, d); l.cb(null, c); return c; };
  return { GA, SM, a, cc, step, sources, live, loads, bundleLoads, bundles, mkBundle, clip, ready, input, game, onceCbs, scene, AudioSource, now: () => now, advanceClock: ms => { now += ms; } };
}
const unlock = w => w.input.emit('touch');

// ---------- 1. bundle loading ----------
{ const w = world(); w.ready('main'); unlock(w);
  ok(w.loads[0].p === 'audio_bgm/bgm_main' && w.a.musicDiagnostics().bundle === null, 'default track still loads via resources.load (unchanged call)', w.loads.map(l => l.p));
  w.a.setMusic('audio/bgm_meadow', 'region_meadow');
  ok(w.bundleLoads.length === 1 && w.bundleLoads[0].n === 'region_meadow', 'scene track with bundle: assetManager.loadBundle(region_meadow)');
  const b = w.mkBundle('region_meadow'); w.bundles.region_meadow = b; w.bundleLoads[0].cb(null, b);
  ok(b.loads.length === 1 && b.loads[0].p === 'audio/bgm_meadow', 'then bundle.load(path, AudioClip)');
  const c = w.clip('bgm_meadow', 72.6); b.loads[0].cb(null, c);
  ok(w.a.musicDiagnostics().status === 'ready' && w.a.musicDiagnostics().bundle === 'region_meadow' && c.refs === 1, 'clip ready, referenced once', w.a.musicDiagnostics());
  w.a.setMusic('audio/bgm_meadow', 'region_meadow');
  ok(w.bundleLoads.length === 1 && b.loads.length === 1, 'same path+bundle again: no reload');
  w.a.setMusic(null); w.a.setMusic('audio/bgm_meadow', 'region_meadow');
  ok(w.bundleLoads.length === 1 && b.loads.length === 2, 'already-loaded bundle: getBundle() reused, no second loadBundle');
  ok(c.refs === 0, 'previous clip released on stop', c.refs);
}
{ const w = world(); w.ready('main'); unlock(w);
  w.a.setMusic('audio/bgm_meadow', 'region_meadow'); w.bundleLoads[0].cb(new Error('subpackage missing'), null);
  const d = w.a.musicDiagnostics();
  ok(d.status === 'error' && /region_meadow\/audio\/bgm_meadow/.test(d.error) && /subpackage missing/.test(d.error), 'missing bundle -> observable error naming bundle/path', d.error);
  w.a.setMusic('audio/bgm_skycity', 'region_skycity'); const late = w.mkBundle('region_meadow');
  w.bundleLoads[0].cb(null, late);
  ok(late.loads.length === 0 && w.a.musicDiagnostics().path === 'audio/bgm_skycity', 'stale loadBundle callback after a newer setMusic is ignored');
  const sb = w.mkBundle('region_skycity'); w.bundleLoads[1].cb(null, sb); const old = w.clip('x'); sb.loads[0].cb(null, w.clip('bgm_skycity', 72));
  ok(w.a.musicDiagnostics().status === 'ready', 'newest bundle track becomes ready');
}

// ---------- 2. crossfade looping ----------
function loopWorld(opts) { const w = world(opts); const c = w.ready('main', 10); unlock(w); w.step(0.02); return { w, c }; }
{ const { w, c } = loopWorld({}); const a = w.a, first = a.loopSource;
  const startAt = w.GA.GameAudio.loopStartAt(10);
  ok(near(startAt, 10 - 0.045 - 0.15 - 0.03, 1e-9), 'schedule point = duration - 45 ms MP3 padding - 150 ms crossfade - 30 ms frame margin', startAt);
  w.step(startAt - 0.05);
  ok(w.live().length === 1 && !a.musicDiagnostics().loopCrossfade.partner, 'before the schedule point: one voice');
  let trigT = null; for (let i = 0; i < 12 && trigT === null; i++) { const before = first.t; w.step(1 / 60); if (a.musicDiagnostics().loopCrossfade.partner) trigT = before; }
  const partner = w.sources.find(s => s !== first && s.clip === c && !s.destroyed);
  ok(!!partner && partner.plays === 1 && partner.loop === true, 'partner voice started at the schedule point (loop=true fallback)', partner && { plays: partner.plays, t: first.t });
  ok(trigT !== null && trigT <= startAt + 1e-6 && first.t >= startAt - 1e-6 && first.t < startAt + 1 / 60 + 1e-6, 'partner started in the first frame that reaches the schedule point', { trigT, t: first.t });
  w.step(0.075);
  const v = a.musicDiagnostics().volume, p2 = first.volume ** 2 + partner.volume ** 2;
  ok(near(p2, v * v, 0.02 * v * v) && first.volume > 0.05 && partner.volume > 0.05, 'mid-crossfade: equal power (sum of squares = volume^2)', { out: first.volume, in: partner.volume, v });
  w.step(0.12);
  ok(a.loopSource === partner && first.destroyed && first.wraps === 0, 'after 150 ms: partner is loopSource, old voice retired before it wrapped', { wraps: first.wraps });
  ok(near(partner.volume, v, 1e-9) && a.musicDiagnostics().playbackState === 'playing' && a.musicDiagnostics().loopCrossfade.completed === 1, 'new voice at full music volume; diagnostics playing', a.musicDiagnostics().loopCrossfade);
  w.step(10); ok(a.musicDiagnostics().loopCrossfade.completed === 2 && w.live().length === 1, 'next pass crossfades again; never more than the active voices', a.musicDiagnostics().loopCrossfade);
  const maxLive = (() => { let m = 0; for (let i = 0; i < 600; i++) { w.step(1 / 60); m = Math.max(m, w.live().length); } return m; })();
  ok(maxLive <= 2, 'at most 2 music voices at any time', maxLive);
}
{ const { w } = loopWorld({ coarse: true }); const a = w.a, first = a.loopSource;
  w.step(9.6);
  const startedAt = (() => { for (let i = 0; i < 60; i++) { const t0 = first.t; w.step(1 / 60); if (a.musicDiagnostics().loopCrossfade.partner) return t0 + 1 / 60; } return null; })();
  ok(startedAt !== null && Math.abs(startedAt - w.GA.GameAudio.loopStartAt(10)) < 0.06, 'coarse 250 ms currentTime: wall-clock extrapolation keeps the start within 60 ms', startedAt);
}
{ const { w } = loopWorld({}); const a = w.a, first = a.loopSource;
  w.AudioSource.deferStart = true; w.step(9.85);
  ok(a.musicDiagnostics().loopCrossfade.partner && !a.musicDiagnostics().loopCrossfade.fading, 'partner requested but platform has not started it: no fade yet');
  ok(near(first.volume, a.musicDiagnostics().volume, 1e-9), 'old voice stays at full volume while waiting (no dip)');
  w.step(0.5);
  ok(first.wraps === 1 && !a.musicDiagnostics().loopCrossfade.partner && w.sources.filter(s => s !== first && !s.destroyed && s.clip).length === 0 && a.loopSource === first,
    'partner never started: platform loop wraps the old voice and the partner is dropped (fallback, single voice)');
}
for (const gate of ['mute', 'hide', 'interrupt', 'volume0']) { const { w } = loopWorld({}); const a = w.a;
  w.step(9.88); const partner = w.sources.find(s => s !== a.loopSource && !s.destroyed && s.clip);
  if (gate === 'mute') a.setMuted(true); if (gate === 'hide') w.game.emit('hide'); if (gate === 'volume0') a.setMusicVolume(0);
  if (gate === 'interrupt') { global.wx = undefined; }
  if (gate === 'interrupt') a.onInterruptBegin();
  w.step(0.02);
  ok(!!partner && partner.destroyed && w.live().length === 0, gate + ' mid-crossfade: partner destroyed, music paused', { partner: !!partner, live: w.live().length });
  if (gate === 'mute') a.setMuted(false); if (gate === 'hide') w.game.emit('show'); if (gate === 'volume0') a.setMusicVolume(0.4); if (gate === 'interrupt') a.onInterruptEnd();
  w.step(0.02);
  ok(a.loopSource.playing && w.live().length <= 2, gate + ' lifted: loopSource resumes (it is past the schedule point, so a fresh crossfade may start)', w.live().length);
  w.step(0.4);
  ok(w.live().length === 1 && w.live()[0] === a.loopSource && a.loopSource.wraps === 0, gate + ' lifted: crossfade completes to one voice, no platform wrap', { live: w.live().length });
}

// ---------- 3. scene switch crossfade ----------
{ const { w } = loopWorld({}); const a = w.a, old = a.loopSource; const v = a.musicDiagnostics().volume;
  w.step(1); a.setMusic('audio/bgm_skycity', 'region_skycity');
  ok(old.playing && !old.destroyed && a.loopSource !== old && near(old.volume, v, 1e-9), 'switch while audible: old track keeps playing at full volume while the new one loads');
  w.step(0.5); ok(near(old.volume, v, 1e-9), 'no fade before the new track is confirmed playing');
  const b = w.mkBundle('region_skycity'); w.bundleLoads[0].cb(null, b); b.loads[0].cb(null, w.clip('bgm_skycity', 72));
  w.step(1 / 60);
  ok(a.loopSource.playing && a.musicDiagnostics().sceneCrossfade.started, 'new track playing -> 1.5 s crossfade starts');
  w.step(0.75);
  ok(near(old.volume ** 2 + a.loopSource.volume ** 2, v * v, 0.03 * v * v) && old.volume > 0.2 * v && a.loopSource.volume > 0.2 * v, 'scene crossfade midway: equal power', { old: old.volume, nw: a.loopSource.volume });
  w.step(0.8);
  ok(old.destroyed && near(a.loopSource.volume, v, 1e-9) && w.live().length === 1 && !a.musicDiagnostics().sceneCrossfade.fadingOut, 'after 1.5 s: old voice retired, new at full volume');
}
{ const { w } = loopWorld({}); const a = w.a, old = a.loopSource;
  a.setMusic('audio/bgm_meadow', 'region_meadow'); w.bundleLoads[0].cb(new Error('no region_meadow'), null);
  w.step(0.75); ok(old.volume < a.musicDiagnostics().volume * 0.8 && old.volume > 0, 'new track fails to load: old track fades out instead of cutting', old.volume);
  w.step(0.9); ok(old.destroyed && w.live().length === 0 && a.musicDiagnostics().status === 'error', 'fade-out completes; error stays observable');
}
{ const { w } = loopWorld({}); const a = w.a, old = a.loopSource;
  a.setMusic('audio/bgm_meadow', 'region_meadow'); w.step(0.2); a.setMusic(null);
  ok(old.destroyed && w.live().length === 0 && a.musicDiagnostics().status === 'idle', 'setMusic(null) during a scene switch stops everything immediately');
}
{ const { w } = loopWorld({}); const a = w.a, old = a.loopSource;
  a.setMusic('audio/bgm_meadow', 'region_meadow'); w.step(0.2); a.setMuted(true);
  ok(old.destroyed && w.live().length === 0, 'mute during scene switch: fading voice destroyed at once');
  a.setMuted(false); const b = w.mkBundle('region_meadow'); w.bundleLoads[0].cb(null, b); b.loads[0].cb(null, w.clip('bgm_meadow', 72)); w.step(0.1);
  ok(w.live().length === 1 && near(a.loopSource.volume, a.musicDiagnostics().volume, 1e-9), 'after unmute the new track plays alone at normal volume');
}
{ const w = world(); w.ready('main'); const a = w.a, old = a.loopSource;   // loaded, but no gesture yet: not audible
  a.setMusic('audio/bgm_skycity', 'region_skycity');
  ok(old.destroyed && !a.musicDiagnostics().sceneCrossfade.fadingOut, 'switch before audio unlock: immediate (original behaviour, no extra voice)');
}
{ const { w } = loopWorld({}); const a = w.a; a.destroy();
  ok(w.live().length === 0, 'destroy stops every music voice');
}

// ---------- 4. SceneMusic mapping + driver ----------
{ const { sceneTrackFor } = world().SM;
  const T = [[{ state: 'home', stable: 'home' }, 'island'], [{ state: 'island', stable: 'island' }, 'island'], [{ state: 'walking-out', stable: 'home' }, 'island'],
    [{ state: 'skycity-loading', stable: 'island' }, null], [{ state: 'skycity', stable: 'skycity' }, 'skycity'],
    [{ state: 'level-loading', stable: 'island' }, null], [{ state: 'level', stable: 'level' }, null],
    [{ state: 'level', stable: 'level', boardPresent: true, boardProvider: 'regional-r05', boardRegion: 'meadow' }, 'meadow'],
    [{ state: 'level', stable: 'level', boardPresent: true, boardProvider: 'regional-r05', boardRegion: 'sky' }, 'skycity'],
    [{ state: 'level', stable: 'level', boardPresent: true, boardProvider: 'regional-r05', boardRegion: 'tide' }, 'island'],
    [{ state: 'level', stable: 'level', boardPresent: true, boardProvider: 'mainline-v33' }, 'island'], [{}, 'island']];
  const bad = T.filter(([p, e]) => sceneTrackFor(p) !== e).map(([p, e]) => ({ p, e, got: sceneTrackFor(p) }));
  ok(bad.length === 0, 'sceneTrackFor: home/island/tide/mainline -> island, skycity visit + sky region -> skycity, meadow -> meadow, transitions keep', bad);
}
{ const w = world(); w.ready('main'); unlock(w);
  ok(w.onceCbs.length === 1, 'SceneMusic self-mounts after the first scene launch');
  w.onceCbs[0](); const sm = w.a.node.comps.find(c => c instanceof w.SM.SceneMusic);
  ok(!!sm, 'SceneMusic component on the persistent GameAudio node');
  let snap = { state: 'island', stable: 'island' }, pres = null;
  const flow = { valid: true, commands: () => ({ snapshot: () => snap }) }, board = { valid: true, node: { valid: true }, hostPresentation: () => pres };
  w.scene.byName.WorldFlowComponent = [flow];
  w.step(1.1);
  ok(w.a.musicDiagnostics().path === 'audio_bgm/bgm_main' && w.bundleLoads.length === 0, 'island: keeps the default island BGM, no reload');
  snap = { state: 'level', stable: 'level' }; w.scene.byName.ManagedMobileBoardUI = [board]; pres = { provider: 'regional-r05', active: { region: 'meadow' } };
  w.step(0.3);
  ok(w.bundleLoads.length === 1 && w.bundleLoads[0].n === 'region_meadow' && w.a.musicDiagnostics().path === 'audio/bgm_meadow', 'meadow region board -> setMusic(audio/bgm_meadow, region_meadow)');
  w.bundleLoads[0].cb(new Error('missing'), null); w.step(0.3);
  ok(w.a.musicDiagnostics().path === 'audio_bgm/bgm_main' && w.a.musicDiagnostics().bundle === null, 'meadow BGM unavailable -> falls back to island BGM');
  w.step(2); ok(w.bundleLoads.length === 1, 'fallback is sticky for this visit (no retry loop)');
  pres = { provider: 'regional-r05', active: { region: 'sky' } }; w.step(0.3);
  ok(w.a.musicDiagnostics().path === 'audio/bgm_skycity' && w.bundleLoads[1].n === 'region_skycity', 'sky region board -> sky city BGM from region_skycity');
  w.scene.byName.ManagedMobileBoardUI = []; board.valid = false; snap = { state: 'island', stable: 'island' }; w.step(0.3);
  ok(w.a.musicDiagnostics().path === 'audio_bgm/bgm_main', 'back on the island -> island BGM');
  snap = { state: 'skycity-loading', stable: 'island' }; w.step(0.3); ok(w.a.musicDiagnostics().path === 'audio_bgm/bgm_main', 'skycity-loading: unchanged');
  snap = { state: 'skycity', stable: 'skycity' }; w.step(0.3); ok(w.a.musicDiagnostics().path === 'audio/bgm_skycity', 'skycity visit -> sky city BGM');
}

// ---------- 5. loose-ES5 safety of the two files ----------
{ const files = ['audio/GameAudio.ts', 'audio/SceneMusic.ts'];
  const CC = ['/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/@cocos/creator-types/engine/cc.d.ts'].filter(f => fs.existsSync(f));
  const prog = ts.createProgram(files.map(f => path.join(S, f)).concat(CC), { target: ts.ScriptTarget.ES5, downlevelIteration: false, lib: ['lib.es2017.d.ts', 'lib.dom.d.ts'], noEmit: true, strict: false, skipLibCheck: true, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.NodeJs, experimentalDecorators: true });
  const ITER = new Set([2802, 2461, 2569, 2548, 2549, 2495]), bad = [];
  for (const sf of prog.getSourceFiles()) { const rel = path.relative(S, sf.fileName); if (!files.includes(rel)) continue;
    for (const d of prog.getSemanticDiagnostics(sf).concat(prog.getSyntacticDiagnostics(sf))) if (ITER.has(d.code)) bad.push(rel + ':' + (sf.getLineAndCharacterOfPosition(d.start || 0).line + 1) + ' TS' + d.code); }
  const RX = [/function\s*\*/, /Symbol\.iterator/, /for\s*\(\s*(?:const|let|var)[^;)]*\bof\b[^)]*\.(?:entries|values|keys)\(\)/, /\.\.\.\s*(?:new\s+(?:Map|Set)\b|[\w.]+\.(?:entries|values|keys)\(\))/, /for\s*\(\s*(?:const|let|var)[^;)]*\bof\s+this\.(?:clips|sfxVoices|reasons|lastPlay)\b/];
  for (const f of files) fs.readFileSync(path.join(S, f), 'utf8').split('\n').forEach((l, i) => { const c = l.replace(/\/\/.*$/, ''); for (const rx of RX) if (rx.test(c)) bad.push(f + ':' + (i + 1) + ' scan ' + l.trim().slice(0, 80)); });
  ok(bad.length === 0, 'loose ES5: no Map/Set/iterator spread or for-of in GameAudio.ts / SceneMusic.ts (TS ' + ts.version + ', cc types ' + (CC.length ? 'on' : 'off') + ')', bad);
}

// ---------- 6. assets + bundle config ----------
{ const B = path.join(P, 'assets/bundles'), J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
  const sky = J(path.join(B, 'region_skycity.meta')), mea = J(path.join(B, 'region_meadow.meta'));
  const strip = m => { const c = JSON.parse(JSON.stringify(m)); delete c.uuid; delete c.userData.bundleName; return c; };
  ok(JSON.stringify(strip(sky)) === JSON.stringify(strip(mea)) && mea.userData.bundleName === 'region_meadow' && mea.uuid !== sky.uuid && mea.userData.isBundle === true && mea.userData.compressionType.wechatgame === 'subpackage' && mea.userData.isRemoteBundle.wechatgame === false,
    'region_meadow.meta == region_skycity.meta except uuid + bundleName (wx_subpackage, priority 1, subpackage, not remote)', mea.userData);
  for (const [f, minS, maxS] of [['bundles/region_meadow/audio/bgm_meadow.mp3', 72, 73.5], ['bundles/region_skycity/audio/bgm_skycity.mp3', 71.5, 73], ['resources/audio_bgm/bgm_main.mp3', 83, 84.5]]) {
    const p = path.join(P, 'assets', f), m = J(p + '.meta'), buf = fs.readFileSync(p);
    // MPEG-1 Layer III frame header after the ID3/Xing area: bitrate index 0b0110 = 48 kbps, mode != 3 (stereo)
    let i = 0; if (buf.slice(0, 3).toString() === 'ID3') i = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
    while (i < buf.length - 4 && !(buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0)) i++;
    const KB = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const flen = j => Math.floor(144000 * KB[(buf[j + 2] >> 4) & 15] / 44100) + ((buf[j + 2] >> 1) & 1);
    i += flen(i);   // skip the LAME/Xing info frame (it carries its own bitrate)
    const br = (buf[i + 2] >> 4) & 15, sr = (buf[i + 2] >> 2) & 3, mode = (buf[i + 3] >> 6) & 3;
    const kbps = KB[br];
    // first frame may be the Xing/LAME info frame (still 48k CBR header with LAME); check a later frame too
    ok(m.importer === 'audio-clip' && kbps === 48 && sr === 0 && mode !== 3 && buf.length > 3e5 && buf.length < 6e5, f + ': audio-clip meta, MPEG-1 44.1 kHz stereo, ' + buf.length + ' B', { kbps, mode, uuid: m.uuid });
  }
  ok(J(path.join(P, 'assets/resources/audio_bgm/bgm_main.mp3.meta')).uuid === '24969762-d70f-41d5-abe0-6cf06ce46946', 'island bgm_main.mp3 keeps its uuid 24969762-…');
}
console.log((fail ? 'FAILED ' + fail : 'ALL PASS') + ' scene-bgm (' + pass + ' checks)');
process.exitCode = fail ? 1 : 0;
