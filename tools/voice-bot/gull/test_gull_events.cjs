// Box test for AmbienceAudio gull call events (mocked cc). Usage: node tools/voice-bot/gull/test_gull_events.cjs
// scheduling / lead, id pairing, per-frame pan from camera yaw, near-yaw choice, requestGullCall gap, night rate/volume, ES5.
'use strict';
const path = require('path'), fs = require('fs'), Module = require('module');
const ROOT = path.resolve(__dirname, '../../..');
const DIR = path.join(ROOT, 'creator-build-project/assets/scripts/audio');
const AMB = path.join(DIR, 'AmbienceAudio.ts'), NIGHT = path.join(DIR, 'AmbienceNight.ts');
const VN = process.env.VB_TS || '/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/typescript';
const ts = require(VN);
const tr = (f) => ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, experimentalDecorators: true } }).outputText;
const ambJs = tr(AMB);
let fail = 0, n = 0; const ok = (c, m, d) => { n++; console.log((c ? 'PASS ' : 'FAIL ') + m + (d === undefined ? '' : ' ' + JSON.stringify(d))); if (!c) fail++; };
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;
const DT = 1 / 60;
const warns = []; console.warn = (...a) => warns.push(String(a[0]));

function env(opts = {}) {
  const onceCbs = [], loads = [];
  class AudioSource { constructor() { this.playOnAwake = true; this.loop = false; this.volume = 1; this.clip = null; this.playing = false; this.plays = 0; }
    play() { this.playing = true; this.plays++; } stop() { this.playing = false; } pause() { this.playing = false; } destroy() { this.destroyed = true; } }
  class Node { constructor() { this.comps = []; } addComponent(C) { const c = new C(); c.node = this; this.comps.push(c); if (c.onLoad) c.onLoad(); return c; }
    getComponent(C) { return this.comps.find(c => c instanceof C) || null; } }
  function Component() {}
  const cam = { node: { valid: true, forward: { x: 0, y: 0, z: -1 } } };   // yaw 180
  const flow = { valid: true, w: 0, visible: true, rig: true, cranes: [], worldCamera: opts.noCamera ? null : cam,
    isWorldVisible() { return this.visible; }, getRoomLightWeight() { return this.w; }, hasRoomLight() { return this.rig; },
    onCraneStart(cb) { this.cranes.push(cb); return () => {}; } };
  const audioNode = new Node(); let now = 0;
  const GameAudio = { instance: { can: true, canPlayAmbience() { return this.can; }, node: audioNode, plays: [], play(nm, v) { this.plays.push({ t: now, n: nm, v }); } }, ensure() { return this.instance; } };
  const scene = { getComponentInChildren(nm) { return nm === 'WorldFlowComponent' ? flow : null; } };
  const cc = { _decorator: { ccclass: () => (C) => C }, Component, AudioSource, AudioClip: class {},
    isValid: (o) => !!o && o.valid !== false && o.destroyed !== true,
    resources: { load(p, T, cb) { loads.push(p); if (opts.noLR && p.indexOf('gull_lr') >= 0) return cb(new Error('missing'), null); cb(null, { p, refs: 0, addRef() { this.refs++; }, decRef() { this.refs--; } }); } },
    director: { getScene: () => scene, once(ev, cb) { onceCbs.push(cb); } }, Director: { EVENT_AFTER_SCENE_LAUNCH: 'x' } };
  const m = new Module(AMB); m.filename = AMB; m.paths = []; const o = m.require.bind(m);
  m.require = (id) => id === 'cc' ? cc : id === './GameAudio' ? { GameAudio } : o(id); m._compile(ambJs, AMB);
  const amb = m.exports, A = amb.AmbienceAudio;
  A.windExit = 0;
  if (opts.rnd) A.rnd = opts.rnd;
  onceCbs.forEach(cb => cb());
  const a = audioNode.getComponent(A);
  const ev = []; const off = A.onGullCall(e => ev.push(Object.assign({ now: +now.toFixed(4) }, e)));
  const run = (sec) => { for (let t = 0; t < sec - 1e-9; t += DT) { now += DT; a.update(DT); } };
  const setYaw = (deg) => { const r = deg * Math.PI / 180; cam.node.forward = { x: Math.sin(r), y: 0, z: Math.cos(r) }; };
  return { amb, A, a, flow, cam, setYaw, GameAudio, run, ev, off, loads, now: () => now, starts: () => ev.filter(e => e.phase === 'start'), sched: () => ev.filter(e => e.phase === 'scheduled') };
}
const G0 = env().amb.GULL_EVENTS;

// ---- pure helpers
{ const { amb } = env(); const { gullPan, cameraYawDeg, panGains, findGullSlot, nightGullScale, nearGullYaw } = amb;
  ok(near(cameraYawDeg({ x: 0, z: 1 }), 0) && near(cameraYawDeg({ x: 1, z: 0 }), 90) && near(cameraYawDeg({ x: 0, z: -1 }), 180) && near(cameraYawDeg({ x: -1, z: 0 }), 270) && cameraYawDeg({ x: 0, z: 0 }) === null, 'cameraYawDeg: atan2(x,z), 0=+Z 90=+X (beam / camera-track convention)');
  ok(near(gullPan(90, 180), 0.5) && near(gullPan(270, 180), -0.5) && near(gullPan(180, 180), 0) && near(gullPan(0, 180), 0) && gullPan(90, null) === 0, 'gullPan = 0.5*sin(camYaw - yaw): +X gull right of a -Z camera, behind = centre, no camera = centre');
  const c = panGains(0), r = panGains(0.5), l = panGains(-0.5);
  ok(near(c.l, 1) && near(c.r, 1) && r.r > r.l && near(r.l * r.l + r.r * r.r, 2) && near(l.l, r.r) && near(l.r, r.l), 'panGains: equal power, centre = 1/1 (same as the old centred mono), mirror-symmetric', { r });
  ok(findGullSlot(5, 0, [0], 2.5) === 5 && findGullSlot(1, 4, [0], 2.5) === 2.5 && findGullSlot(1, 1, [0], 2.5) === -1 && findGullSlot(3, 10, [0, 4], 2.5) === 6.5, 'findGullSlot: >= 2.5 s from every taken time, maxLate respected');
  ok(near(nightGullScale(0).rate, 1) && near(nightGullScale(1).rate, 0.4) && near(nightGullScale(0.5).rate, 0.7) && near(nightGullScale(1).vol, Math.pow(10, -3 / 20)) && near(nightGullScale(0).vol, 1), 'nightGullScale: rate x0.4 and -3 dB at night, lerped by weight');
  let inside = true, side = true; for (let i = 0; i < 200; i++) { const q = i / 200, y = nearGullYaw(350, 0, () => q), d = ((y - 350 + 540) % 360) - 180; if (Math.abs(d) > 60 + 1e-6) inside = false;
    const y2 = nearGullYaw(350, 20, () => q), d2 = ((y2 - 350 + 540) % 360) - 180; if (d2 < 5 - 1e-6 || d2 > 60 + 1e-6) side = false; }
  ok(inside, 'near yaw within +-60 deg of camera yaw (wraps across 0/360)'); ok(side, 'camera turning (+20 deg/s) -> near yaw on the turning side, 5..60 deg');
  ok(nearGullYaw(350, -20, () => 0.5) < 350 && nearGullYaw(350, -20, () => 0.5) > 290, 'camera turning the other way -> the other side');
}

// ---- random island gull: decided 2.5 s ahead, start at the scheduled time, ids pair
{ const e = env({ rnd: () => 0.5 }); e.run(30);
  const s = e.sched(), st = e.starts();
  ok(s.length >= 2 && s.every(x => x.kind === 'random' && near(x.leadS, G0.randomLeadS, DT + 1e-6)), 'random gulls: scheduled 2.5 s ahead', s.map(x => x.leadS));
  ok(st.length >= 2 && st.every(x => { const p = s.find(y => y.id === x.id); return p && p.now < x.now && near(x.at, p.at, DT + 1e-6) && x.yawWorldDeg === p.yawWorldDeg && x.dist === p.dist && x.distM === p.distM && x.durS === p.durS; }),
    'start pairs with an earlier scheduled event (same id; yaw/dist/distM/durS fixed; start.at within a frame of scheduled.at)');
  ok(new Set(st.map(x => x.id)).size === st.length && st.every(x => x.leadS === 0), 'ids unique, start leadS 0');
  ok(st.every(x => (x.dist === 'near') === (x.clip === 'sfx_amb_gull_1') && x.durS > 3.1 && x.durS < 3.5), 'dist: gull_1 near, 2/3 far; durS ~3.3', st.map(x => [x.clip, x.dist, x.durS]));
  ok(st.every(x => (x.dist === 'near' ? x.distM >= 6 && x.distM <= 12 : x.distM >= 30 && x.distM <= 60)), 'distM ranges: near 6..12, far 30..60');
  // interval with rnd 0.5: 14 s between starts (day)
  ok(st.length >= 2 && near(st[1].at - st[0].at, 14, 2 * DT), 'day interval 8..20 s (rnd 0.5 -> 14 s)', st.map(x => x.at));
}
// ---- night: rate x0.4 (35 s), volume -3 dB; weight lerps
{ const e = env({ rnd: () => 0.5 }); e.A.setNightSource(() => 1); e.run(80); const st = e.starts();
  ok(st.length >= 2 && near(st[1].at - st[0].at, 14 / 0.4, 2 * DT), 'night (w=1): random interval 14 -> 35 s (rate 40% of day)', st.map(x => +x.at.toFixed(2)));
  ok(st.every(x => near(x.vol, 0.6 * Math.pow(10, -3 / 20), 1e-3)), 'night: random gull vol 0.6 -> 0.425 (-3 dB)', st.map(x => x.vol));
  ok(e.sched().every(x => near(x.leadS, 2.5, DT + 1e-6)), 'night: still decided 2.5 s ahead');
  const h = env({ rnd: () => 0.5 }); h.A.setNightSource(() => 0.5); h.run(60); const sh = h.starts();
  ok(sh.length >= 2 && near(sh[1].at - sh[0].at, 14 / 0.7, 2 * DT), 'w=0.5: interval 20 s (rate 70%)', sh.map(x => +x.at.toFixed(2)));
  const b = env({ rnd: () => 0.5 }); b.A.setNightSource(() => { throw Error('x'); }); b.run(20); ok(b.starts().length >= 1 && near(b.starts()[0].vol, 0.6), 'night source throwing -> day');
  ok(fs.readFileSync(NIGHT, 'utf8').indexOf("import { propNightWeight } from '../world-r2/IslandPropsLayout'") >= 0 && /setNightSource\(propNightWeight\)/.test(fs.readFileSync(NIGHT, 'utf8')), 'AmbienceNight.ts wires IslandPropsLayout.propNightWeight');
}
// ---- exit gulls: near decided at onApronLift, crane at onCraneStart, distant at the crossing (+0.5 s)
{ const e = env(); e.a.gullIn = 1e9; e.run(1);
  e.A.notifyApronFull(); e.run(DT); const s1 = e.sched().slice(-1)[0];
  ok(s1 && s1.kind === 'near' && s1.dist === 'near' && near(s1.leadS, 0.4 - DT, DT + 1e-6), "near: decided at onApronLift('full'), lead ~0.4 s when the gap is free", s1 && s1.leadS);
  e.run(1); const st1 = e.starts().slice(-1)[0]; ok(st1 && st1.id === s1.id, 'near: starts with the same id');
  e.A.notifyApronFull(); e.run(DT); const s2 = e.sched().slice(-1)[0];
  ok(s2 && s2.id !== s1.id && near(s2.at - st1.at, 2.5, 1e-6) && s2.leadS > 1, 'near after a recent gull: start pushed to the 2.5 s gap -> longer lead (exit: ~1.1 s after apron lift)', s2 && { lead: s2.leadS });
  e.run(4);
  e.flow.cranes[0]({}); const sc = e.sched().slice(-1)[0];
  ok(sc && sc.kind === 'crane' && near(sc.leadS, 1.5), 'crane: decided at onCraneStart, 1.5 s ahead', sc && sc.leadS);
  e.run(2); ok(e.starts().slice(-1)[0].id === sc.id, 'crane: starts with the same id');
  const d = env(); d.a.gullIn = 1e9; d.run(1); d.A.setWindExit(0.2); d.run(0.5); d.A.setWindExit(0.45); d.run(DT);
  const sd = d.sched().slice(-1)[0]; ok(sd && sd.kind === 'distant' && sd.dist === 'far' && near(sd.leadS, 0.5), 'distant (wind crosses 0.4): decided at the crossing, 0.5 s lead', sd && sd.leadS);
  d.run(1); ok(d.starts().length === 1 && d.starts()[0].id === sd.id, 'distant: starts');
  const c = env(); c.a.gullIn = 1e9; c.run(1); c.A.setWindExit(0.2); c.run(0.5); c.A.setWindExit(0.45); c.run(DT); c.A.setWindExit(0.2); c.run(1);
  const cx = c.ev.filter(x => x.phase === 'cancelled'); ok(cx.length === 1 && cx[0].id === c.sched()[0].id && c.starts().length === 0, "distant: wind falls back before the start -> 'cancelled' (same id), no sound");
  const m = env(); m.a.gullIn = 1e9; m.run(1); m.A.notifyApronFull(); m.run(DT); m.GameAudio.instance.can = false; m.run(1);
  ok(m.ev.filter(x => x.phase === 'cancelled').length === 1 && m.starts().length === 0, "muted before the start -> 'cancelled'");
  const r = env({ rnd: () => 0.5 }); r.run(13); ok(r.sched().length === 1 && r.starts().length === 0, 'random gull scheduled'); r.A.setWindExit(0.3); r.run(0.5);
  ok(r.ev.filter(x => x.phase === 'cancelled').length === 1, "exit wind begins during the random lead -> random gull 'cancelled'");
}
// ---- pan from camera yaw, every frame
{ const e = env(); e.a.gullIn = 1e9; e.run(1);
  const id = e.A.requestGullCall('far', 90); const v = e.a.voices[0];
  ok(id !== null && v && v.l.playing && v.r.playing && v.l.clip.p.indexOf('_L') > 0 && v.r.clip.p.indexOf('_R') > 0, 'request plays through the L/R pair');
  const vol = e.starts().slice(-1)[0].vol;
  e.run(DT); const g1 = { l: v.l.volume, r: v.r.volume };
  const exp = e.amb.panGains(0.5); ok(near(g1.l, vol * exp.l) && near(g1.r, vol * exp.r) && g1.r > g1.l, 'camera yaw 180, gull yaw 90 (+X): right-heavy, pan +0.5', g1);
  e.setYaw(0); e.run(DT); ok(near(v.l.volume, vol * exp.r) && near(v.r.volume, vol * exp.l), 'camera turns to yaw 0 mid-call: same gull now left-heavy (pan recomputed every frame)', { l: v.l.volume, r: v.r.volume });
  e.setYaw(90); e.run(DT); ok(near(v.l.volume, vol) && near(v.r.volume, vol), 'camera facing the gull: centre (1/1 x vol)');
  e.setYaw(270); e.run(DT); ok(near(v.l.volume, vol) && near(v.r.volume, vol), 'gull behind the camera: centre (sin 180 = 0)');
  e.setYaw(45); e.run(DT); ok(near(v.r.volume - v.l.volume, vol * (e.amb.panGains(0.5 * Math.sin(-45 * Math.PI / 180)).r - e.amb.panGains(0.5 * Math.sin(-45 * Math.PI / 180)).l)), 'yaw 45: partial pan follows sin(rel)');
  e.run(4); ok(!v.l.playing && !v.r.playing && !v.call, 'voice released after durS');
  const nc = env({ noCamera: true }); nc.a.gullIn = 1e9; nc.run(1); nc.A.requestGullCall('near', 30); nc.run(DT); const w = nc.a.voices[0];
  ok(near(w.l.volume, 0.5) && near(w.r.volume, 0.5), 'no camera: centred');
  const fb = env({ noLR: true }); fb.a.gullIn = 1e9; fb.run(1); fb.A.requestGullCall('near', 30);
  ok(fb.a.voices.length === 0 && fb.GameAudio.instance.plays.length === 1 && fb.GameAudio.instance.plays[0].n === 'sfx_amb_gull_1', 'L/R clips missing -> falls back to GameAudio.play (centred), events still fire', fb.GameAudio.instance.plays);
  const mu = env(); mu.a.gullIn = 1e9; mu.run(1); mu.A.requestGullCall('near', 0); mu.run(0.5); mu.GameAudio.instance.can = false; mu.run(DT);
  ok(!mu.a.voices[0].l.playing && !mu.a.voices[0].r.playing, 'mute mid-call stops both voices');
  // near gulls are placed in front of the camera at scheduling time; turning camera -> turning side
  const ny = env(); ny.a.gullIn = 1e9; ny.run(1); ny.setYaw(100); ny.run(0.2); ny.A.notifyApronFull(); ny.run(DT); const y1 = ny.sched()[0].yawWorldDeg;
  ok(Math.abs(((y1 - 100 + 540) % 360) - 180) <= 60, 'near gull yaw within +-60 deg of the camera at scheduling', y1);
  const nt = env(); nt.a.gullIn = 1e9; nt.run(1); let yaw = 100; for (let k = 0; k < 30; k++) { yaw += 30 * DT; nt.setYaw(yaw); nt.run(DT); }
  nt.A.notifyApronFull(); nt.run(DT); const d2 = ((nt.sched()[0].yawWorldDeg - yaw + 540) % 360) - 180;
  ok(d2 >= 5 - 0.6 && d2 <= 60 + 0.6, 'camera rotating +30 deg/s -> near gull on the turning side', +d2.toFixed(1));
}
// ---- requestGullCall: gap, gating, events
{ const e = env(); e.a.gullIn = 1e9; e.run(1);
  const id1 = e.A.requestGullCall('near', 10); const p = e.ev.filter(x => x.id === id1);
  ok(typeof id1 === 'number' && p.length === 2 && p[0].phase === 'scheduled' && p[1].phase === 'start' && p[0].leadS === 0 && p[0].at === p[1].at && p[0].yawWorldDeg === 10 && p[0].kind === 'request', 'request: returns id, scheduled == start immediately, uses the given yaw', p);
  e.run(1); ok(e.A.requestGullCall('far', 200) === null, 'request 1 s after the last gull -> null'); e.run(1.4); ok(e.A.requestGullCall('far', 200) === null, '2.4 s -> null');
  e.run(0.2); const id2 = e.A.requestGullCall('far', 200); ok(typeof id2 === 'number' && id2 !== id1 && e.starts().slice(-1)[0].dist === 'far', '>= 2.5 s -> plays (far)');
  e.run(3); e.A.notifyApronFull(); e.run(DT); ok(e.A.requestGullCall('near', 0) === null, 'a scheduled gull starting within 2.5 s blocks a request (keeps the min gap)');
  ok(e.A.requestGullCall('near', NaN) === null && e.A.requestGullCall('mid', 0) === null, 'bad args -> null');
  const g = env(); g.a.gullIn = 1e9; g.run(1); g.GameAudio.instance.can = false; g.run(DT); ok(g.A.requestGullCall('near', 0) === null, 'ambience not allowed (muted / no gesture / hidden) -> null');
  const i = env(); i.a.gullIn = 1e9; i.flow.w = 1; i.run(1); ok(i.A.requestGullCall('near', 0) === null && i.ev.length === 0, 'indoors -> null, no events');
  const v = env(); v.a.gullIn = 1e9; v.flow.visible = false; v.run(1); ok(v.A.requestGullCall('near', 0) === null, 'world not visible (level / sky city) -> null');
  const x = env(); x.a.gullIn = 1e9; x.flow.w = 1; x.A.setWindExit(0.5); x.run(1); x.ev.length = 0; x.a.lastGullAt = -1e9; x.a.pending = [];
  ok(typeof x.A.requestGullCall('near', 0) === 'number', 'exit wind segment (crossing the door, w still 1) counts as outdoor');
  // unsubscribe + __worldIntegration
  const u = env(); u.a.gullIn = 1e9; u.run(1); u.off(); u.A.requestGullCall('near', 0); ok(u.ev.length === 0, 'unsubscribe stops events');
  globalThis.__worldIntegration = { snapshot() {} }; const w = env(); w.run(DT);
  ok(globalThis.__worldIntegration.onGullCall === w.A.onGullCall && globalThis.__worldIntegration.requestGullCall === w.A.requestGullCall && typeof globalThis.__worldIntegration.gullClock === 'function', '__worldIntegration.onGullCall / requestGullCall / gullClock attached');
  globalThis.__worldIntegration = { snapshot() {} }; w.run(DT); ok(globalThis.__worldIntegration.onGullCall === w.A.onGullCall, 're-attached after Boot recreates __worldIntegration');
  const evs = []; const off2 = globalThis.__worldIntegration.onGullCall(z => evs.push(z.phase)); w.a.gullIn = 1e9; w.run(1); globalThis.__worldIntegration.requestGullCall('far', 45); off2();
  ok(evs.join() === 'scheduled,start', 'via __worldIntegration: scheduled,start', evs); delete globalThis.__worldIntegration;
  const th = env(); th.A.onGullCall(() => { throw Error('boom'); }); th.a.gullIn = 1e9; th.run(1); ok(typeof th.A.requestGullCall('near', 0) === 'number' && th.starts().length === 1, 'a throwing listener does not break audio or other listeners');
  // destroy
  const ds = env(); ds.a.gullIn = 1e9; ds.run(1); ds.A.requestGullCall('near', 0); ds.a.onDestroy(); ok(ds.A.requestGullCall('near', 0) === null && ds.a.voices.length === 0, 'destroy: voices released, requests null');
}
// ---- ES5 (loose): no Map/Set/for-of/spread in the new audio files; transpiles clean
{ const bad = []; for (const f of [AMB, NIGHT]) { const s = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    if (/new (Map|Set)\b/.test(s)) bad.push(path.basename(f) + ': Map/Set'); if (/\.\.\.[A-Za-z_(]/.test(s)) bad.push(path.basename(f) + ': spread');
    const fo = s.match(/for\s*\(\s*(const|let|var)\s+\w+\s+of\s+([^)]+)\)/g) || []; fo.forEach(x => { if (!/of\s*\[/.test(x)) bad.push(path.basename(f) + ': ' + x); });
    const r = ts.transpileModule(fs.readFileSync(f, 'utf8'), { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, experimentalDecorators: true } });
    if (r.diagnostics && r.diagnostics.length) bad.push(path.basename(f) + ': diagnostics'); }
  ok(bad.length === 0, 'ES5-safe (loose): no Map/Set, no spread, for-of only over array literals', bad);
}
// ---- assets
{ const D = path.join(ROOT, 'creator-build-project/assets/resources/audio_sfx/gull_lr'); const fl = ['1', '2', '3'].map(i => ['L', 'R'].map(s => 'sfx_amb_gull_' + i + '_' + s + '.mp3')).reduce((x, y) => x.concat(y), []);
  ok(fl.every(f => fs.existsSync(path.join(D, f)) && fs.existsSync(path.join(D, f + '.meta'))) && fs.existsSync(D + '.meta'), 'gull_lr assets + metas present', fl);
  const uu = fl.map(f => JSON.parse(fs.readFileSync(path.join(D, f + '.meta'), 'utf8')).uuid); ok(new Set(uu).size === 6, 'unique uuids'); }
console.log(fail ? 'FAILED ' + fail + ' / ' + n : 'ALL PASS gull-events (' + n + ' checks)');
process.exit(fail ? 1 : 0);
