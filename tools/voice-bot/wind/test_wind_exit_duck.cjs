// Box test (mocked cc): WindAudio exit-cinematic duck (-12 dB, 0.5 s fades) and release on every exit path.
// Usage: node tools/voice-bot/wind/test_wind_exit_duck.cjs   (typescript: VB_TS, else first resolvable fallback)
'use strict';
const path = require('path'), fs = require('fs'), Module = require('module');
const ROOT = path.resolve(__dirname, '../../..');
const DIR = path.join(ROOT, 'creator-build-project/assets/scripts/audio');
const SRC = path.join(DIR, 'WindAudio.ts'), AMB = path.join(DIR, 'AmbienceAudio.ts');
const cands = [process.env.VB_TS, '/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/typescript', '/tmp/ts5/node_modules/typescript', 'typescript'].filter(Boolean);
let ts = null; for (const c of cands) { try { ts = require(c); break; } catch { /* next */ } }
if (!ts) { console.error('typescript not found; set VB_TS'); process.exit(2); }
const tr = (f) => ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, experimentalDecorators: true } }).outputText;
const js = tr(SRC), ambJs = tr(AMB);
let fail = 0, n = 0; const ok = (c, m, d) => { n++; console.log((c ? 'PASS ' : 'FAIL ') + m + (d === undefined ? '' : ' ' + JSON.stringify(d))); if (!c) fail++; };
const near = (a, b, e = 2e-3) => Math.abs(a - b) <= e;
const DUCK = Math.pow(10, -12 / 20);

function env() {
  const onceCbs = [];
  class AudioSource { constructor() { this.volume = 1; this.clip = null; this.playing = false; } play() { this.playing = true; } stop() { this.playing = false; } pause() { this.playing = false; } destroy() { this.destroyed = true; } }
  class Node { constructor() { this.comps = []; this.valid = true; } addComponent(C) { const c = new C(); c.node = this; this.comps.push(c); if (c.onLoad) c.onLoad(); return c; } getComponent(C) { return this.comps.find(c => c instanceof C) || null; } }
  function Component() {}
  const flow = { valid: true, wind: 1, visible: true, state: 'home', w: 1, rig: true,
    getWindStrength() { return this.wind; }, isWorldVisible() { return this.visible; }, getRoomLightWeight() { return this.w; }, hasRoomLight() { return this.rig; },
    commands() { const f = this; return { snapshot: () => ({ state: f.state }) }; } };
  let present = true;
  const audioNode = new Node();
  const GameAudio = { instance: { can: true, canPlayAmbience() { return this.can; }, node: audioNode, play() {}, setWindDuck() {} }, ensure() { return this.instance; } };
  const scene = { getComponentInChildren(nm) { return nm === 'WorldFlowComponent' && present ? flow : null; } };
  const cc = { _decorator: { ccclass: () => (C) => C }, Component, AudioSource, AudioClip: class {},
    isValid: (o) => !!o && o.valid !== false && o.destroyed !== true,
    resources: { load(p, T, cb) { cb(null, { p, addRef() {}, decRef() {} }); } },
    director: { getScene: () => scene, once(ev, cb) { onceCbs.push(cb); } }, Director: { EVENT_AFTER_SCENE_LAUNCH: 'x' } };
  delete global.__voiceWind;
  const load = (file, code, extra) => { const m = new Module(file); m.filename = file; m.paths = []; const o = m.require.bind(m);
    m.require = (id) => id === 'cc' ? cc : id === './GameAudio' ? { GameAudio } : extra && extra[id] ? extra[id] : o(id); m._compile(code, file); return m.exports; };
  const amb = load(AMB, ambJs); const mod = load(SRC, js, { './AmbienceAudio': amb });
  onceCbs.splice(0, 1); onceCbs.forEach(cb => cb());
  const w = audioNode.getComponent(mod.WindAudio);
  const run = (sec, dt = 1 / 60) => { for (let t = 0; t < sec - 1e-9; t += dt) w.update(dt); };
  return { mod, w, flow, run, GameAudio, setPresent: v => { present = v; if (!v) flow.valid = false; } };
}
const g = e => e.w.snapshot().exitDuckGain;
const soft = e => e.w.snapshot().soft;
const FULL_SOFT = 0.75;

{ const e = env();
  ok(near(e.mod.exitDuckGain(1), DUCK, 1e-6) && e.mod.exitDuckGain(0) === 1 && e.mod.EXIT_DUCK_FADE_S === 0.5, 'gain curve: 0 dB -> -12 dB, fade 0.5 s');
  e.run(3); ok(near(soft(e), FULL_SOFT) && g(e) === 1, 'home: no duck, soft at full', e.w.snapshot());
  e.flow.state = 'standing'; e.run(0.25); ok(near(g(e), e.mod.exitDuckGain(0.5), 0.02), 'duck fades in: half-way (-6 dB) after 0.25 s', g(e));
  e.run(0.3); ok(near(g(e), DUCK) && near(soft(e), FULL_SOFT * DUCK), 'full -12 dB after 0.5 s', e.w.snapshot());
  for (const st of ['turning-out', 'walking-out', 'opening-door', 'crossing-out']) { e.flow.state = st; e.run(0.5); }
  ok(near(g(e), DUCK), 'stays ducked through all exit states');
  e.flow.state = 'island'; e.run(0.25); ok(g(e) > DUCK + 0.1 && g(e) < 0.99, 'island reached: fades back (mid)', g(e));
  e.run(0.3); ok(g(e) === 1 && near(soft(e), FULL_SOFT), 'restored to 0 dB after 0.5 s');
}
{ const e = env(); e.run(1); e.flow.state = 'crossing-out'; e.run(1); ok(near(g(e), DUCK), 'sail/skip: ducked before release');
  e.mod.WindAudio.releaseExitDuck(); e.run(0.55); ok(g(e) === 1, 'releaseExitDuck() (sail transition start / skip) restores while state still crossing-out');
  e.run(2); ok(g(e) === 1, 'no re-duck after release while still in exit state');
  e.flow.state = 'island'; e.run(0.1); e.flow.state = 'standing'; e.run(0.6); ok(near(g(e), DUCK), 'next exit ducks again (release flag cleared)');
  global.__voiceWind.releaseExitDuck(); e.run(0.6); ok(g(e) === 1, 'globalThis.__voiceWind.releaseExitDuck works');
}
{ const e = env(); e.run(1); e.flow.state = 'walking-out'; e.run(1);
  e.flow.state = 'home'; e.run(0.55); ok(g(e) === 1, 'abort (cancelled leaveHome -> back to home) restores');
  e.flow.state = 'opening-door'; e.run(1); e.flow.state = 'error'; e.run(0.55); ok(g(e) === 1, 'failure (state error) restores');
}
{ const e = env(); e.run(1); e.flow.state = 'walking-out'; e.run(1);
  e.setPresent(false); e.run(0.05); ok(e.w.snapshot().exitDuck === 0, 'scene change (WorldFlowComponent gone) resets duck immediately');
}
{ const e = env(); e.run(1); e.flow.state = 'walking-out'; e.run(1);
  e.GameAudio.instance.can = false; e.run(0.05); ok(e.w.snapshot().exitDuck === 0, 'muted/hidden (not allowed) resets duck');
  e.GameAudio.instance.can = true; e.flow.state = 'disposed'; e.run(0.6); ok(g(e) === 1, 'disposed state not ducked');
}
{ const e = env(); e.run(1); e.flow.state = 'walking-out'; e.run(1); e.w.onDestroy(); ok(e.w.snapshot().exitDuck === 0, 'component destroy resets duck'); }
{ const e = env(); e.flow.commands = () => { throw Error('World not initialized'); }; e.flow.state = 'standing'; e.run(1); ok(g(e) === 1, 'commands() throwing -> treated as not exiting'); }
console.log(JSON.stringify({ status: fail ? 'FAIL' : 'PASS_MOCK', cases: n, failed: fail, creatorBuild: 'NOT_RUN', deviceListening: 'NOT_RUN' }));
process.exit(fail ? 1 : 0);
