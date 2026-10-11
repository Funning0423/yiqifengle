// Runs the REAL WindAudio.ts + AmbienceAudio.ts (mocked cc, 60 fps) over a flow_sim exit timeline and dumps per-frame
// layer gains + one-shot events as JSON for render_exit_mix.py.
// Usage: node sim_exit.cjs --timeline exit50c_timeline.json [--apron-at 14.87] [--crane-at 15.567] [--repo <worktree>] [--out x.json]
'use strict';
const path = require('path'), fs = require('fs'), Module = require('module');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('repo', path.resolve(__dirname, '../../..')));
const DIR = path.join(ROOT, 'creator-build-project/assets/scripts/audio');
const VN = process.env.VB_TS || '/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/typescript';
const ts = require(VN);
const tr = (f) => ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, experimentalDecorators: true } }).outputText;
const tlPath = arg('timeline', 'exit50c_timeline.json');
const TL = JSON.parse(fs.readFileSync(fs.existsSync(tlPath) ? tlPath : path.join(__dirname, tlPath), 'utf8'));
const apronAt = Number(arg('apron-at', TL.events.apronLift)), craneAt = Number(arg('crane-at', TL.events.craneStart));
console.warn = () => {};
const onceCbs = [];
class AudioSource { constructor() { this.playOnAwake = true; this.loop = false; this.volume = 1; this.clip = null; this.playing = false; }
  play() { this.playing = true; this.startedAt = now; } stop() { this.playing = false; } pause() { this.playing = false; } destroy() { this.destroyed = true; } }
class Node { constructor() { this.comps = []; } addComponent(C) { const c = new C(); c.node = this; this.comps.push(c); if (c.onLoad) c.onLoad(); return c; } getComponent(C) { return this.comps.find(c => c instanceof C) || null; } }
function Component() {}
const flow = { valid: true, wind: 0, visible: true, w: 1, rig: true, listeners: [], cranes: [],
  getWindStrength() { return this.wind; }, isWorldVisible() { return this.visible; }, getRoomLightWeight() { return this.w; }, hasRoomLight() { return this.rig; },
  onCraneStart(cb) { this.cranes.push(cb); return () => {}; }, onApronLift(cb) { this.listeners.push(cb); return () => {}; } };
const audioNode = new Node(); let now = 0; const duck = [];
const GameAudio = { instance: { canPlayAmbience() { return true; }, node: audioNode, play(n, v) { oneShots.push({ t: now, clip: n, vol: v, centred: true }); }, setWindDuck(s) { duck.push([+now.toFixed(4), s]); } }, ensure() { return this.instance; } };
const oneShots = [];
const scene = { getComponentInChildren(n) { return n === 'WorldFlowComponent' ? flow : null; } };
const cc = { _decorator: { ccclass: () => (C) => C }, Component, AudioSource, AudioClip: class {}, isValid: (o) => !!o && o.valid !== false && o.destroyed !== true,
  resources: { load(p, T, cb) { cb(null, { p, addRef() {}, decRef() {} }); } }, director: { getScene: () => scene, once(ev, cb) { onceCbs.push(cb); } }, Director: { EVENT_AFTER_SCENE_LAUNCH: 'x' } };
const load = (file, extra) => { const m = new Module(file); m.filename = file; m.paths = []; const o = m.require.bind(m);
  m.require = (id) => id === 'cc' ? cc : id === './GameAudio' ? { GameAudio } : extra && extra[id] ? extra[id] : o(id); m._compile(tr(file), file); return m.exports; };
const amb = load(path.join(DIR, 'AmbienceAudio.ts'));
const wind = load(path.join(DIR, 'WindAudio.ts'), { './AmbienceAudio': amb });
const events = [];
amb.AmbienceAudio.onGullCall(e => events.push({ t: +now.toFixed(4), phase: e.phase, id: e.id, kind: e.kind, dist: e.dist, at: +e.at.toFixed(4), clip: e.clip, vol: e.vol, yaw: e.yawWorldDeg }));
onceCbs.forEach(cb => cb());
const W = audioNode.getComponent(wind.WindAudio), A = audioNode.getComponent(amb.AmbienceAudio);
A.gullIn = 1e9;   // random island gulls off for the exit window (exit wind suppresses them anyway)
const t0 = TL.frames[0][0]; now = t0;
const frames = []; let flap = false, crane = false; const flaps = [];
for (const [t, w, weight, layers] of TL.frames) {
  flow.wind = w; flow.w = weight; flow.visible = layers > 0;
  if (!flap && t >= apronAt) { flap = true; flow.listeners.forEach(cb => cb('full', 0.8)); flaps.push({ t: +now.toFixed(4), vol: 0.7 }); }
  if (!crane && t >= craneAt) { crane = true; flow.cranes.forEach(cb => cb({})); }
  now += 1 / 60; W.update(1 / 60); A.update(1 / 60);
  const srcs = audioNode.comps.filter(c => c instanceof AudioSource);
  const ws = W.diagnostics ? W.diagnostics() : {};
  frames.push({ t: +now.toFixed(4), soft: W.softSrc && W.softSrc.playing ? W.softSrc.volume : 0, strong: W.strongSrc && W.strongSrc.playing ? W.strongSrc.volume : 0,
    waves: A.src && A.src.playing ? A.src.volume : 0, s: W.s, sWind: W.sWind });
}
const flapSrc = W.flapSrc;
const out = { timeline: path.basename(tlPath), apronAt, craneAt, frameTimeOffset: 'frame t = scene t + 1/60 (update after the scene frame)', events, flaps, oneShots, duck: duck.length ? 'setWindDuck called' : 'no setWindDuck', frames };
const o = arg('out', null); if (o) fs.writeFileSync(o, JSON.stringify(out)); 
const starts = events.filter(e => e.phase === 'start');
console.log(JSON.stringify({ apronAt, craneAt, gulls: events.map(e => [e.phase, e.kind, e.dist, e.t, e.at]), starts: starts.map(e => ({ kind: e.kind, t: e.t, afterLift: +(e.t - apronAt).toFixed(3), beforeCrane: +(craneAt - e.t).toFixed(3) })) }, null, 0));
