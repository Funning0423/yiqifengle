// Box test for WindAudio (mocked cc). Usage: node test_wind_audio.cjs  (typescript: VB_TS or GGbot vendor-node)
'use strict';
const path = require('path'), fs = require('fs'), Module = require('module');
const ROOT = path.resolve(__dirname, '../../..');
const DIR = path.join(ROOT, 'creator-build-project/assets/scripts/audio');
const SRC = path.join(DIR, 'WindAudio.ts'), AMB = path.join(DIR, 'AmbienceAudio.ts');
const VN = process.env.VB_TS || process.env.QF_TYPESCRIPT_MODULE || '/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/typescript';
const ts = require(VN);
const tr = (f) => ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, experimentalDecorators: true } }).outputText;
const js = tr(SRC), ambJs = tr(AMB);
let fail = 0; const ok = (c, m, d) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d === undefined ? '' : ' ' + JSON.stringify(d))); if (!c) fail++; };
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;

function env(opts = {}) {
  const onceCbs = [], loads = [];
  class AudioSource { constructor() { this.playOnAwake = true; this.loop = false; this.volume = 1; this.clip = null; this.playing = false; this.plays = 0; this.pauses = 0; }
    play() { this.playing = true; this.plays++; } stop() { this.playing = false; } pause() { this.playing = false; this.pauses++; } destroy() { this.destroyed = true; } }
  class Node { constructor() { this.comps = []; this.valid = true; }
    addComponent(C) { const c = new C(); c.node = this; this.comps.push(c); if (c.onLoad) c.onLoad(); return c; }
    getComponent(C) { return this.comps.find(c => c instanceof C) || null; } }
  function Component() {}
  const unsubbed = [];
  const flow = { valid: true, wind: 0, visible: true, w: 1, rig: true, listeners: [], cranes: [],
    getWindStrength() { return this.wind; }, isWorldVisible() { return this.visible; },
    getRoomLightWeight() { return this.w; }, hasRoomLight() { return this.rig; }, onCraneStart(cb) { this.cranes.push(cb); return () => {}; },
    onApronLift(cb) { this.listeners.push(cb); return () => { unsubbed.push(cb); this.listeners = this.listeners.filter(x => x !== cb); }; } };
  if (opts.noHook) delete flow.onApronLift;
  const audioNode = new Node();
  const gulls = []; let now = 0;
  const GameAudio = { instance: { can: true, canPlayAmbience() { return this.can; }, node: audioNode, plays: [], play(n, v) { this.plays.push({ t: +now.toFixed(3), n, v }); }, ducks: [], setWindDuck(x) { this.ducks.push(x); } }, ensure() { return this.instance; } };
  const scene = { getComponentInChildren(n) { return n === 'WorldFlowComponent' ? flow : null; } };
  const cc = { _decorator: { ccclass: () => (C) => C }, Component, AudioSource, AudioClip: class {},
    isValid: (o) => !!o && o.valid !== false && o.destroyed !== true,
    resources: { load(p, T, cb) { loads.push(p); cb(null, { p, refs: 0, addRef() { this.refs++; }, decRef() { this.refs--; } }); } },
    director: { getScene: () => scene, once(ev, cb) { onceCbs.push(cb); } }, Director: { EVENT_AFTER_SCENE_LAUNCH: 'x' } };
  delete global.__voiceWind;
  const load = (file, code, extra) => { const m = new Module(file); m.filename = file; m.paths = []; const o = m.require.bind(m);
    m.require = (id) => id === 'cc' ? cc : id === './GameAudio' ? { GameAudio } : extra && extra[id] ? extra[id] : o(id); m._compile(code, file); return m.exports; };
  const amb = load(AMB, ambJs);
  // gulls now play through AmbienceAudio's own L/R voices (stereo pan); record them from the 'start' events
  amb.AmbienceAudio.onGullCall(e => { if (e.phase === 'start') gulls.push({ t: +now.toFixed(3), n: e.clip, v: e.vol }); });
  const mod = load(SRC, js, { './AmbienceAudio': amb });
  amb.AmbienceAudio.windExit = 0;
  if (!opts.withAmbience) onceCbs.splice(0, 1);       // only WindAudio unless asked
  onceCbs.forEach(cb => cb());
  const w = audioNode.getComponent(mod.WindAudio), a = audioNode.getComponent(amb.AmbienceAudio);
  const gullSrc = c => !!a && a.voices.some(v => v.l === c || v.r === c);
  const sources = () => audioNode.comps.filter(c => c instanceof AudioSource && c !== (a && a.src) && !gullSrc(c));
  const run = (sec, dt = 1 / 60) => { for (let t = 0; t < sec - 1e-9; t += dt) { now += dt; w.update(dt); if (a) a.update(dt); } };
  return { mod, amb, w, a, flow, GameAudio, sources, run, loads, unsubbed, gulls, now: () => now };
}

// curve
{ const { mod } = env();
  const v = [0.15, 0.5, 1.0].map(s => [s, +mod.softGain(s).toFixed(4), +mod.strongGain(s).toFixed(4)]);
  ok(near(mod.softGain(0.15), 0.41) && near(mod.softGain(0.5), 0.55) && near(mod.softGain(1), 0.75), 'soft_gain 0.15/0.5/1.0 = 0.41/0.55/0.75', v);
  ok(near(mod.strongGain(0.15), 0) && near(mod.strongGain(0.5), 0.1983, 1e-4) && near(mod.strongGain(1), 1), 'strong_gain 0.15/0.5/1.0 = 0/0.1983/1', v);
  ok(mod.softGain(0) === 0 && near(mod.softGain(0.04), 0.5 * 0.366), 'soft_gain ramps from 0 below s=0.08');
}
// s=0: silent, no loop sources created
{ const e = env(); e.run(10);
  ok(e.sources().length === 0, 's=0 for 10 s -> no AudioSource created, nothing played', { n: e.sources().length });
  ok(e.w.snapshot().s === 0, 's stays exactly 0');
  ok(e.flow.listeners.length === 1, 'onApronLift hook found by typeof on WorldFlowComponent and subscribed once');
  ok(typeof global.__voiceWind?.notifyApronLift === 'function', 'globalThis.__voiceWind.notifyApronLift exposed');
}
// smoothing + mix
{ const e = env(); e.run(0.2); e.flow.wind = 1;
  e.run(0.25); const s1 = e.w.snapshot().s;
  ok(near(s1, 1 - Math.exp(-1), 0.02), 'one-pole: after tau=0.25 s, s ~ 63%', s1);
  e.run(2); const snap = e.w.snapshot();
  ok(near(snap.s, 1, 1e-3) && near(snap.soft, 0.75, 2e-3) && near(snap.strong, 1, 2e-3) && snap.softPlaying && snap.strongPlaying, 'wind=1 -> soft 0.75 + strong 1.0, both looping', snap);
  e.flow.wind = 0.5; e.run(3); const h = e.w.snapshot();
  ok(near(h.soft, 0.55, 3e-3) && near(h.strong, 0.1983, 3e-3), 'wind=0.5 -> soft 0.55 / strong 0.198', h);
  e.flow.wind = 0.15; e.run(4); const l = e.w.snapshot();
  ok(near(l.soft, 0.41, 3e-3) && l.strong === 0, 'wind=0.15 -> soft 0.41, strong muted (vol 0)', l);
  ok(e.sources().every(s => s.loop) && e.sources().length === 2, 'two looping sources');
  e.flow.wind = 0; e.run(4); const z = e.w.snapshot();
  ok(!z.softPlaying && !z.strongPlaying && z.soft === 0, 'wind back to 0 -> loops paused after idle', z);
}
// canPlayAmbience false / invisible
{ const e = env(); e.GameAudio.instance.can = false; e.flow.wind = 1; e.run(2);
  ok(e.sources().length === 0, 'canPlayAmbience false + wind 1 -> silent, nothing created');
  e.GameAudio.instance.can = true; e.run(2); ok(e.w.snapshot().strongPlaying, 'gate opens -> plays');
  e.GameAudio.instance.can = false; e.run(0.1); const s = e.w.snapshot();
  ok(!s.softPlaying && !s.strongPlaying && s.s === 0, 'gate closes (mute/suspend) -> paused at once', s);
  e.GameAudio.instance.can = true; e.flow.visible = false; e.run(1);
  ok(!e.w.snapshot().strongPlaying, 'isWorldVisible false -> silent');
  e.flow.listeners[0]('full', 0); ok(!e.sources().some(x => !x.loop && x.playing), 'flap dropped while world invisible');
}
// full lift
{ const e = env(); e.run(0.1); e.flow.listeners[0]('full', 1.2);
  const flap = e.sources().find(s => !s.loop);
  ok(flap && flap.playing && near(flap.volume, 0.7) && flap.clip.p === 'audio_sfx/sfx_apron_flap', "'full' via hook -> flap at 0.7", flap && flap.volume);
  ok(e.w.snapshot().gust < 0, "'full' does not start the idle-gust envelope");
  e.GameAudio.instance.can = false; flap.playing = false; e.mod.WindAudio.notifyApronLift('full', 1);
  ok(!flap.playing, 'canPlayAmbience false -> flap not played');
}
// soft lift envelope + flap (static entry)
{ const e = env(); e.run(0.1); e.mod.WindAudio.notifyApronLift('soft', 4);
  const flap = e.sources().find(s => !s.loop);
  ok(flap && flap.playing && near(flap.volume, 0.28), "'soft' -> flap at event, 0.28 (0.7 x -8 dB)", flap && flap.volume);
  let peak = 0, peakT = 0, t = 0; const dt = 1 / 60;
  while (t < 5.5) { e.w.update(dt); t += dt; const s = e.w.snapshot().s; if (s > peak) { peak = s; peakT = t; } }
  ok(peak > 0.42 && peak <= 0.5, "envelope peak s ~0.5 (after 0.25 s smoothing)", +peak.toFixed(3));
  ok(peakT > 1.7 && peakT < 2.3, 'envelope peak ~45% of 4 s (+smoothing lag)', +peakT.toFixed(2));
  const snap = e.w.snapshot(); ok(snap.gust < 0 && snap.s < 0.01, 'envelope finished, back to ~0', snap);
  e.run(2); ok(!e.w.snapshot().softPlaying, 'loops paused after gust');
  e.mod.WindAudio.notifyApronLift('soft'); ok(near(e.w.gustDur, 4), 'durationSec default 4');
  e.mod.WindAudio.notifyApronLift('bogus', 3); ok(true, 'unknown strength ignored (no throw)');
  global.__voiceWind.notifyApronLift('soft', 2); ok(near(e.w.gustDur, 2) && e.w.gust === 0, 'global __voiceWind entry works');
}
// no hook on flow -> fine
{ const e = env({ noHook: true }); e.run(3); ok(e.w.snapshot().hooks === 0, 'no onApronLift anywhere -> no subscription, no error'); }
// destroy
{ const e = env(); e.flow.wind = 1; e.run(2); e.w.onDestroy();
  ok(e.flow.listeners.length === 0 && e.unsubbed.length === 1, 'destroy -> onApronLift unsubscribed');
  ok(e.sources().every(s => !s.playing && s.destroyed), 'destroy -> sources stopped + destroyed');
  ok(e.mod.WindAudio.instance === null && global.__voiceWind === undefined, 'destroy -> static/global cleared');
  e.mod.WindAudio.notifyApronLift('full', 1); ok(true, 'notify after destroy is a no-op');
}
// ---- BGM wind duck feed: WindAudio passes its smoothed s to GameAudio.setWindDuck every frame; 0 when not allowed / destroyed
{ const e = env(); const G = e.GameAudio.instance; e.flow.wind = 1; e.run(2);
  ok(G.ducks.length > 100 && near(G.ducks[G.ducks.length - 1], e.w.s, 1e-9) && e.w.s > 0.99, 'setWindDuck(s) every frame with the smoothed wind (s -> 1)', { n: G.ducks.length, last: G.ducks[G.ducks.length - 1] });
  G.can = false; e.run(0.1); ok(G.ducks[G.ducks.length - 1] === 0, 'not allowed (muted / hidden) -> setWindDuck(0)');
  G.can = true; e.run(1); e.w.onDestroy(); ok(G.ducks[G.ducks.length - 1] === 0, 'destroy -> setWindDuck(0)');
  const o = env(); delete o.GameAudio.instance.setWindDuck; o.flow.wind = 1; let threw = false; try { o.run(1); } catch (x) { threw = true; } ok(!threw, 'GameAudio without setWindDuck (older build / stub): no-op');
}
// ---- exit sequence: waves floor + gull triggers (AmbienceAudio + WindAudio together), gull v6 rules ----
const ramp = (e, from, to, sec, key = 'wind') => { const n = Math.round(sec * 60); for (let i = 1; i <= n; i++) { e.flow[key] = from + (to - from) * i / n; e.run(1 / 60); } };
const gaps = (g) => g.slice(1).map((x, i) => +(x.t - g[i].t).toFixed(3));
{ const e = env({ withAmbience: true }); const A = e.amb.EXIT_AUDIO;
  ok(A.gullMinGapS === 2.5 && A.distant[0].vol === 0.3 && A.distant[1].vol === 0.38 && A.nearVol === 0.5 && A.craneVol === 0.6 && A.waveWindDuck === 0.25, 'v6 constants: gap 2.5 s, distant 0.30/0.38, near 0.5, crane 0.6 (GULL_VOL), wave duck 0.25', A);
  e.run(3); ok(e.a.src.volume === 0 && !e.a.src.playing && e.gulls.length === 0, 'indoors (w=1, rig, wind 0): waves silent, no gulls (T5 contract)');
  ramp(e, 0, 0.15, 0.3); e.run(2);
  ok(e.a.src.playing && near(e.a.src.volume, 0.35 * 0.028, 1e-3), 'wind 0.15 at the door (w still 1): waves start fading in (0.35*smoothstep(.1,.6,.15)=0.0098)', +e.a.src.volume.toFixed(4));
  ok(e.gulls.length === 0, 'no gull below 0.4');
  ramp(e, 0.15, 1, 9);   // slow rise: crossings 0.4 and 0.7 are > 2.5 s apart -> both play
  const g = e.gulls.slice();
  ok(g.length === 2 && g[0].n === A.distant[0].clip && near(g[0].v, 0.3) && g[1].n === A.distant[1].clip && near(g[1].v, 0.38) && g[1].t - g[0].t >= 2.5 - 1e-6, 'slow rise: distant gulls at 0.4 and 0.7 (gap >= 2.5 s), different clips, quiet', { g, gaps: gaps(g) });
  ok(near(e.a.src.volume, 0.35 * 0.75, 0.01), 'w=1 + wind 1 -> waves at floor 0.35, ducked 25% = 0.2625', +e.a.src.volume.toFixed(3));
  e.run(3); const tFlap = e.now(); e.flow.listeners[0]('full', 1); e.run(1.5);
  const n1 = e.gulls.slice(2);
  ok(n1.length === 1 && n1[0].n === A.nearClip && near(n1[0].v, 0.5) && near(n1[0].t - tFlap, 0.4, 0.04), "onApronLift('full') (gap free) -> near gull 0.4 s later at 0.5", n1);
  ramp(e, 1, 0.3, 1); ramp(e, 0.3, 1, 1); e.run(1);
  ok(e.gulls.length === 3, 'dip to 0.3 and back up: no repeat distant gulls (once per exit)');
  ramp(e, 1, 0, 2, 'w'); e.run(25);
  ok(e.gulls.length === 3, 'outdoor + exit wind still on: random island gulls suppressed for 25 s');
  ramp(e, 1, 0.05, 2); e.run(3);
  ramp(e, 0.05, 0.8, 4); const g2 = e.gulls.slice(3).filter(x => x.n === A.distant[0].clip && near(x.v, 0.3));
  ok(g2.length === 1, 'wind below 0.1 resets -> next exit plays the distant gull again', e.gulls.slice(3));
}
// REAL timelines (flow_sim, 60 fps): wind + room-light weight per frame. 138bca5: lift 14.82, crane 15.483.
// 50c0227 (int/v1 38b005f): lift ~14.87 (walk driver; lift_time_s 0.37) / 14.93 (timeline note), crane 15.567.
// Rule (item 5): same-distance gap 2.5 s, near<->far 1.2 s -> near gull at onApronLift + 0.4 s, inside the frontal hold, before onCraneStart;
// distant 0.4 kept (>= 1.2 s before), 0.7 merged (same distance), crane gull dropped (same distance as the near one, maxLate 0).
for (const [file, lift] of [['exit138_timeline.json', null], ['exit50c_timeline.json', 14.87], ['exit50c_timeline.json', 14.93]]) {
  const TL = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')); const LIFT = lift === null ? TL.events.apronLift : lift, CRANE = TL.events.craneStart;
  const tag = 'real ' + file.replace('_timeline.json', '') + ' lift ' + LIFT + ': ';
  const e = env({ withAmbience: true }); const A = e.amb.EXIT_AUDIO; e.a.gullIn = 1e9;   // no random gull at t<9 (she is indoors anyway)
  let flapDone = false, craneDone = false, wavesAtSill = null, wavesAt12 = null;
  for (const [t, wind, weight, layers] of TL.frames) {
    e.flow.wind = wind; e.flow.w = weight; e.flow.visible = layers > 0;
    if (!flapDone && t >= LIFT) { flapDone = true; e.flow.listeners[0]('full', 0.8); }
    if (!craneDone && t >= CRANE) { craneDone = true; e.flow.cranes[0]({ segment: 'toIsland', progress: .538, seconds: 5.95 }); }
    e.run(1 / 60);
    if (wavesAtSill === null && t >= 11) wavesAtSill = e.a.src.playing ? e.a.src.volume : 0;
    if (wavesAt12 === null && t >= 13.5) wavesAt12 = e.a.src.volume;
  }
  const t0 = e.now() - TL.frames.length / 60;   // harness clock -> seconds from leaveHome
  const G = e.gulls.map(x => ({ ...x, t: +(x.t - t0).toFixed(3) }));
  ok(wavesAtSill > 0.002 && wavesAtSill < 0.02 && wavesAt12 > 0.15, tag + 'waves start (very quiet, wind floor) right after the sill, clearly up by 13.5 s', { at11: +wavesAtSill.toFixed(4), at13_5: +wavesAt12.toFixed(4) });
  ok(G.length === 2, tag + 'exactly two gulls (distant 0.4 + near; 0.7 merged, crane gull dropped by the same-distance gap)', G);
  ok(G[0] && G[0].n === A.distant[0].clip && near(G[0].v, 0.3) && G[0].t > 13.7 && G[0].t < 14.2, tag + 'distant gull 0.5 s after the 0.4 crossing (~14.0 s)', G[0]);
  ok(!G.some(x => x.n === A.distant[1].clip), tag + '0.7 crossing merged into the first (far-far 2.5 s)');
  const nr = G[1]; const fromLift = nr ? +(nr.t - LIFT).toFixed(3) : null;
  ok(nr && nr.n === A.nearClip && near(nr.v, 0.5) && fromLift >= 0.4 - 1e-6 && fromLift <= 0.4 + 2 / 60 + 1e-6, tag + 'near gull at onApronLift + 0.4 s (within a frame)', { near: nr, fromLift });
  ok(nr && nr.t < CRANE, tag + 'near gull starts before onCraneStart (inside the frontal hold)', { near: nr && nr.t, crane: CRANE, margin: nr && +(CRANE - nr.t).toFixed(3) });
  ok(nr && nr.t - G[0].t >= 1.2 - 1e-6, tag + 'near-far gap >= 1.2 s', gaps(G));
}
// crane gull: plays 1.5 s after onCraneStart when >= 2.5 s since last gull; skipped otherwise (no wait)
{ const e = env({ withAmbience: true }); e.flow.w = 0; e.run(1.2); e.gulls.length = 0; e.a.gullIn = 1e9;
  e.flow.cranes[0]({ segment: 'toIsland', progress: .5, seconds: 3 }); const t0 = e.now(); e.run(2);
  ok(e.gulls.length === 1 && e.gulls[0].n === 'sfx_amb_gull_1' && near(e.gulls[0].t - t0, 1.5, 0.04) && near(e.gulls[0].v, 0.6), 'crane gull 1.5 s after onCraneStart (gap free) at 0.6', e.gulls);
  e.run(0.2); e.flow.cranes[0]({}); e.run(5);   // due 2.2 s after the previous gull (decided at onCraneStart)
  ok(e.gulls.length === 1, 'crane gull due 2.2 s after the previous one -> skipped, not delayed', e.gulls);
}
// near gull waits for the gap but is dropped if it would be > nearMaxLateS late
{ const e = env({ withAmbience: true }); e.flow.w = 0; e.run(1); e.gulls.length = 0; e.a.gullIn = 1e9;
  e.flow.cranes[0]({}); e.run(1.6); const tc = e.gulls[0] && e.gulls[0].t;
  e.flow.listeners[0]('full', 1); e.run(4);   // due 0.4 s later = 0.5 s after crane gull -> waits to +2.5
  ok(e.gulls.length === 2 && near(e.gulls[1].t - tc, 2.5, 0.04), 'near gull waits until 2.5 s after the previous gull', gaps(e.gulls));
  const A = e.amb.EXIT_AUDIO, keep = A.nearMaxLateS; A.nearMaxLateS = 1;
  e.flow.cranes[0]({}); e.run(1.6); const before = e.gulls.length;      // crane gull (gap was ok) -> new last gull
  e.flow.listeners[0]('full', 1); e.run(4);                           // would need +2.1 s wait > 1 s -> dropped
  ok(before === 3 && e.gulls.length === 3, 'near gull dropped when the wait exceeds nearMaxLateS', { before, after: e.gulls.length });
  A.nearMaxLateS = keep;
}
// soft lift: no near gull, no distant gulls (gust envelope does not count as exit wind)
{ const e = env({ withAmbience: true }); e.flow.w = 0; e.run(0.5); e.gulls.length = 0; e.a.gullIn = 99;
  e.mod.WindAudio.notifyApronLift('soft', 4); e.run(5);
  ok(e.gulls.length === 0, "'soft' -> no near gull, no distant gulls", e.gulls);
}
// random island gulls respect the 2.5 s gap (any queued gull also re-arms the random timer)
{ const e = env({ withAmbience: true }); e.flow.w = 0; e.run(0.5); e.gulls.length = 0;
  e.a.lastGullAt = e.a.clock - 1; const tLast = e.now() - 1; e.a.gullIn = 0.1; e.run(5);
  ok(e.gulls.length === 1 && e.gulls[0].t - tLast >= 2.5 - 1e-6 && near(e.gulls[0].v, 0.6), 'random gull due 1.1 s after the last gull -> postponed past the 2.5 s gap, vol 0.6', { since: e.gulls[0] && +(e.gulls[0].t - tLast).toFixed(2) });
  e.flow.cranes[0]({}); e.run(1.6); ok(e.gulls.length === 2 && e.a.gullIn >= 8 - 1e-6, 'crane gull re-arms the random timer (8..20 s)', +e.a.gullIn.toFixed(2));
}
// gated: muted -> no exit gulls, no waves floor; invisible world -> no waves floor
{ const e = env({ withAmbience: true }); e.GameAudio.instance.can = false; ramp(e, 0, 1, 3); e.flow.listeners[0]('full', 1); e.run(1);
  ok(e.gulls.length === 0 && !e.a.src.playing, 'canPlayAmbience false -> no exit gulls, no waves');
  const f = env({ withAmbience: true }); f.flow.visible = false; ramp(f, 0, 1, 3); f.run(1);
  ok(f.gulls.length === 0 && !f.a.src.playing, 'world invisible -> no waves floor, no exit gulls');
}
// music slider scales the wind/wave bed: 0 is silence now, 1 is the design full level (duck stays inside that level)
{ const e = env({ withAmbience: true }); let music = 1;
  e.GameAudio.instance.getMusicVolume = () => music;
  e.flow.w = 0; e.flow.wind = 1; e.run(3);
  const full = { soft: e.w.snapshot().soft, strong: e.w.snapshot().strong, waves: e.a.src.volume };
  ok(full.strong > 0.95 && full.soft > 0.7 && full.waves > 0.35, 'music 1: wind and waves at the design full level', full);
  music = 0; e.run(1 / 60);
  const z = e.w.snapshot();
  ok(z.soft === 0 && z.strong === 0 && !z.softPlaying && !z.strongPlaying && e.a.src.volume === 0 && !e.a.src.playing, 'music 0: wind and waves inaudible on the next frame', { wind: z, waves: e.a.src.volume, playing: e.a.src.playing });
  music = 1; e.run(1 / 60);
  ok(near(e.w.snapshot().strong, full.strong, 0.02) && near(e.w.snapshot().soft, full.soft, 0.02) && e.a.src.playing && near(e.a.src.volume, full.waves, 0.02), 'music back to 1 restores the design full level', { wind: e.w.snapshot(), waves: e.a.src.volume, full });
  // A1c (GGbot): the default slider 0.4 is the design level (was ×0.4 → ~12 dB under the bgm outdoors); below it the bed scales linearly.
  music = 0.4; e.run(1 / 60);
  ok(near(e.w.snapshot().strong, full.strong, 0.02) && near(e.a.src.volume, full.waves, 0.02), 'music 0.4 (default): design full level', { strong: e.w.snapshot().strong, waves: e.a.src.volume, full });
  music = 0.2; e.run(1 / 60);
  ok(near(e.w.snapshot().strong, full.strong * 0.5, 0.02) && near(e.a.src.volume, full.waves * 0.5, 0.02), 'music 0.2: half the design level, wind-duck ratio stays inside it', { strong: e.w.snapshot().strong, waves: e.a.src.volume, full });
}
console.log(fail ? 'FAILED ' + fail : 'ALL PASS wind-audio'); process.exitCode = fail ? 1 : 0;
