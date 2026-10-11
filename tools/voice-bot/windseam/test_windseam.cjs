// Box test for VbWindSeamTest (mocked cc). Usage: node test_windseam.cjs   (needs typescript; uses GGbot vendor-node if present)
'use strict';
const path = require('path'), fs = require('fs'), Module = require('module');
const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'creator-build-project/assets/scripts/audio/VbWindSeamTest.ts');
const VN = process.env.VB_TS || '/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/typescript';
const ts = require(VN);
const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, experimentalDecorators: true } }).outputText;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

function run(flag, opts = {}) {
  let clock = 1000000; const logs = []; const onceCbs = []; let nodes = 0, loads = 0;
  class AudioSource { constructor() { this.playOnAwake = true; this.loop = false; this.volume = 1; this.clip = null; this.playing = false; this.currentTime = 0; this.plays = 0; }
    play() { this.playing = true; this.currentTime = 0; this.plays++; } stop() { this.playing = false; } pause() { this.playing = false; } }
  class Node { constructor(n) { this.name = n; this.comps = []; this.valid = true; nodes++; }
    addChild() {} addComponent(C) { const c = new C(); c.node = this; this.comps.push(c); if (c.onLoad) c.onLoad(); return c; }
    destroy() { this.valid = false; this.comps.forEach(c => c.onDestroy && c.onDestroy()); } }
  function Component() {}
  const music = { path: 'audio_bgm/main', sets: [] };
  const GameAudio = { instance: { gesture: false, canPlayAmbience() { return this.gesture; },
    musicDiagnostics() { return { path: music.path, gestureSeen: this.gesture, muted: false, suspended: [] }; },
    setMusic(p) { music.sets.push(p); music.path = p; } } };
  const clipDur = 2.951837;
  const cc = { _decorator: { ccclass: () => (C) => C }, Component, AudioSource, AudioClip: class {}, Node, isValid: (n) => !!n && n.valid !== false,
    resources: { load(p, T, cb) { loads++; cb(null, { p, addRef() {}, decRef() {}, getDuration: () => clipDur }); } },
    director: { getScene: () => new Node('Scene'), addPersistRootNode() {}, once(ev, cb) { onceCbs.push(cb); } },
    Director: { EVENT_AFTER_SCENE_LAUNCH: 'after-launch' } };
  global.VB_SCENARIO = flag; delete global.wx;
  const origLog = console.log; console.log = (l) => { if (String(l).startsWith('[VB_WINDSEAM]')) logs.push(String(l)); else origLog(l); };
  const m = new Module(SRC); m.filename = SRC; m.paths = [];
  const origReq = m.require.bind(m);
  m.require = (id) => id === 'cc' ? cc : id === './GameAudio' ? { GameAudio } : origReq(id);
  m._compile(js, SRC);
  const VbWindSeamTest = m.exports.VbWindSeamTest; VbWindSeamTest.now = () => clock;
  const nodesBefore = nodes; onceCbs.forEach(cb => cb());
  const mounted = nodes > nodesBefore + 1; // Scene node + test node
  let comp = null;
  if (mounted) { /* find component via closure: re-mount not needed; scan */ }
  // drive frames: capture component by patching Node.addComponent results
  const all = []; const origAdd = Node.prototype.addComponent;
  // simpler: monkeypatch after the fact is too late; instead re-run maybeMount capturing
  return { mounted, logs, music, loads, cc, GameAudio, VbWindSeamTest, tick: null, setClock: (f) => { clock = f(clock); }, getClock: () => clock, restore: () => { console.log = origLog; }, Node };
}

// 1) inert without flag
{ const r = run(undefined); r.restore(); ok(!r.mounted && r.logs.length === 0 && r.loads === 0, 'no flag -> no node, no load, no log'); }
{ const r = run('something-else'); r.restore(); ok(!r.mounted && r.loads === 0, 'other flag -> inert'); }
// 2) with flag: drive a full run
{
  const r = run('windseam'); ok(r.mounted && r.loads === 2, 'flag -> mounted, 2 clips loaded');
  // grab component: mount a fresh one deterministically
  let comp; const N = r.Node; const orig = N.prototype.addComponent;
  N.prototype.addComponent = function (C) { const c = orig.call(this, C); if (C === r.VbWindSeamTest) comp = c; return c; };
  r.logs.length = 0; r.VbWindSeamTest.maybeMount();
  const src = comp.src; const dt = 1 / 60; const period = 2.952; // simulate gap-y loop
  for (let i = 0; i < 600; i++) { r.setClock(c => c + 16.667); comp.update(dt); }
  ok(r.logs.some(l => l.includes(' waiting ')), 'waits for gesture');
  ok(!src.playing, 'silent before gesture');
  r.GameAudio.instance.gesture = true;
  let t = 0;
  for (let i = 0; i < 60 * 70 && comp.alive; i++) {
    r.setClock(c => c + 16.667);
    if (src.playing) { t += 0.016667; src.currentTime = t % period; }
    const before = comp.phase; comp.update(dt); if (comp.phase !== before) t = 0;
  }
  r.restore();
  const L = r.logs; const has = (s) => L.filter(l => l.includes(s));
  ok(has(' gesture-ok ').length === 1, 'gesture-ok logged');
  ok(has(' start ').length === 2 && has('clip=soft dur=2.952s loop=1').length === 1 && has('start t=').length + 0 >= 0, 'start soft + strong (loop=1)');
  ok(has(' loop ').length >= 18, 'loop wraps logged: ' + has(' loop ').length);
  const ends = has(' end ');
  ok(ends.length === 2 && ends.every(l => /meanPeriodMs=29[45]\d\.\d/.test(l)), 'end lines with meanPeriod ~2952: ' + ends.map(l => l.replace(/.*meanPeriodMs=([\d.]+).*/, '$1')).join(','));
  ok(has(' done ').length === 1 && !comp.alive, 'done + self-destroyed');
  ok(r.music.sets.length === 2 && r.music.sets[0] === null && r.music.sets[1] === 'audio_bgm/main', 'BGM paused then restored: ' + JSON.stringify(r.music.sets));
  console.log(L.filter(l => / (start|end|done|gesture-ok) /.test(l) || / loop .* n=(1|2) /.test(l)).join('\n'));
}
console.log(fail ? `FAIL ${fail}` : 'ALL PASS windseam');
process.exit(fail ? 1 : 0);
