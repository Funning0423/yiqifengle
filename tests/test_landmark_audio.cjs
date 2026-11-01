'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require(process.env.QF_TYPESCRIPT_MODULE || '/tmp/ts5/node_modules/typescript');
const base = path.resolve(__dirname, '../creator-build-project/assets/scripts'), cache = {};
function load(file) {
  if (cache[file]) return cache[file].exports;
  const m = new Module(file); cache[file] = m;
  m.require = id => load(path.normalize(path.join(path.dirname(file), id + '.ts')));
  m._compile(ts.transpileModule(fs.readFileSync(path.join(base, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, downlevelIteration: false } }).outputText, file);
  return m.exports;
}
const { LandmarkAudioCore, LandmarkLoopPair, landmarkGain, MAX_LANDMARK_SOURCES, LANDMARK_GAIN_BUDGET, LANDMARK_LOOP_DUP_S, LANDMARK_SEAM_S, LANDMARK_ENCODER_DELAY_SAMPLES } = load('audio/LandmarkAudioCore.ts');
const { CONFIRMED_LANDMARKS } = load('audio/SceneAudioTable.ts');
let checks = 0;
function check(message, fn) { fn(); checks++; console.log('PASS ' + message); }
function port() { return { ready: false, playing: false, volume: 0, prepares: 0, releases: 0, plays: 0,
  prepare() { this.prepares++; this.ready = true; }, play(loop) { this.playing = true; this.loop = loop; this.plays++; },
  release() { this.releases++; this.ready = false; this.playing = false; this.volume = 0; } }; }
function rig(specs) { return new LandmarkAudioCore(() => port(), () => 0, specs); }
check('smooth distance curve: inner, midpoint, outer and invalid', () => {
  assert.equal(landmarkGain(1, 3, 25), 1); assert.equal(landmarkGain(14, 3, 25), 0.5); assert.equal(landmarkGain(25, 3, 25), 0);
  assert.equal(landmarkGain(Infinity, 3, 25), 0); assert.equal(landmarkGain(NaN, 3, 25), 0); assert.equal(landmarkGain(-1, 3, 25), 0);
  assert.equal(landmarkGain(1, 3, 3), 0);
  let previous = 1; for (let d = 3; d <= 25; d += 0.1) { const g = landmarkGain(d, 3, 25); assert(g <= previous && g >= 0); previous = g; }
});
check('one-shot starts at its distance level (no fade-in on the call); leaving still fades over 2 s and releases', () => {
  const c = rig(), r = c.rows[0]; c.step(1, 'lakeside', { lakeWaterbirds: 0 }, true, 1); assert.equal(r.level, 1); assert(r.port.playing);
  c.step(1, 'lakeside', {}, true, 1); assert.equal(r.level, 0.5); assert(r.port.playing);
  c.step(1, 'lakeside', {}, true, 1); assert.equal(r.level, 0); assert(!r.port.ready && !r.port.playing); assert(!r.reserved);
  const s = CONFIRMED_LANDMARKS[0], d = (s.nearM + s.farM) / 2, c2 = rig(), r2 = c2.rows[0];
  c2.step(1 / 30, 'lakeside', { lakeWaterbirds: d }, true, 1); assert.equal(r2.level, landmarkGain(d, s.nearM, s.farM)); assert.equal(r2.port.plays, 1);
  assert(Math.abs(r2.port.volume - r2.level * s.vol) < 1e-9, 'first frame of the call is already at target volume');
});
check('loop: decode delay stays silent, then fades in over 2 s; re-entry reverses without jump', () => {
  const c = new LandmarkAudioCore(() => { const p = port(); p.prepare = () => {}; return p; }), r = c.rows[2];
  c.step(2, 'skycity', { skyStarring: 0 }, true, 1); assert.equal(r.level, 0);
  r.port.ready = true; c.step(0.5, 'skycity', { skyStarring: 0 }, true, 1); assert.equal(r.level, 0.25);
  c.step(0.25, 'skycity', {}, true, 1); assert.equal(r.level, 0.125);
  c.step(0.25, 'skycity', { skyStarring: 0 }, true, 1); assert.equal(r.level, 0.25);
});
check('scene switch and mute stop immediately; no phantom region sounds', () => {
  const c = rig(); c.step(2, 'skycity', { skyGardener: 0, skyStarring: 0 }, true, 1);
  assert.equal(c.rows.filter(r => r.port.playing).length, 2);
  c.step(0, 'meadow', { skyGardener: 0, skyStarring: 0 }, true, 1); assert(c.rows.every(r => !r.port.playing && !r.port.ready));
  c.step(2, 'skycity', { skyStarring: 0 }, true, 1); c.step(0, 'skycity', { skyStarring: 0 }, false, 1);
  assert(c.rows.every(r => !r.port.playing && !r.reserved));
});
check('global cap includes pending and fading voices, aggregate gain <= budget', () => {
  const specs = Array.from({ length: 5 }, (_, i) => Object.assign({}, CONFIRMED_LANDMARKS[2], { id: 'test' + i }));
  const c = rig(specs), d = {}; specs.forEach(s => d[s.id] = 0);
  for (let i = 0; i < 10; i++) {
    c.step(0.5, 'skycity', d, true, 1);
    assert(c.rows.filter(r => r.reserved).length <= MAX_LANDMARK_SOURCES);
    assert(c.rows.reduce((sum, r) => sum + r.port.volume, 0) <= LANDMARK_GAIN_BUDGET + 1e-9);
  }
  c.step(2, 'skycity', d, true, 0); assert(c.rows.every(r => r.port.volume === 0));
});
check('single shots do not overlap, obey cooldown; night waterbirds quarter rate', () => {
  function elapsed(night) { const c = rig(), r = c.rows[0]; c.step(2, 'lakeside', { lakeWaterbirds: 0 }, true, 1, night); r.port.playing = false;
    c.step(0, 'lakeside', { lakeWaterbirds: 0 }, true, 1, night); assert(!r.reserved);
    let seconds = 0; while (r.port.plays < 2 && seconds < 100) { c.step(1, 'lakeside', { lakeWaterbirds: 0 }, true, 1, night); seconds++; } return seconds; }
  assert.equal(elapsed(0), 14); assert.equal(elapsed(1), 56);
});
check('all approved clips exist, anchors match shipped scenes, startup hooks present', () => {
  for (const s of CONFIRMED_LANDMARKS) for (const clip of s.clips) assert(fs.existsSync(path.join(base, '../bundles', clip.bundle, clip.path + '.mp3')));
  const transforms = JSON.parse(fs.readFileSync(path.join(base, '../bundles/region_lakeside/scene_r5h_slim_transforms.json')));
  assert(transforms.instances.some(n => n.name === CONFIRMED_LANDMARKS[0].anchor));
  const glb = fs.readFileSync(path.join(base, '../bundles/region_skycity/env_skycity.glb'));
  const nodes = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12))).nodes;
  for (const s of CONFIRMED_LANDMARKS.slice(1)) assert(nodes.some(n => n.name === s.anchor));
  const source = fs.readFileSync(path.join(base, 'audio/LandmarkAudio.ts'), 'utf8');
  for (const hook of ['EVENT_AFTER_SCENE_LAUNCH', 'ambienceMounters', 'ambienceQuieters', 'canPlayAmbience', 'decRef()', 'ticket === this.ticket']) assert(source.includes(hook));
  assert(fs.readFileSync(path.join(base, 'audio/AmbienceNight.ts'), 'utf8').includes('LandmarkAudio.setNightSource'));
});
check('b15 mix: budget never cuts a single landmark; radii reach the walkable spots (ducks ~20 m, ring 20.4 m overhead)', () => {
  for (const s of CONFIRMED_LANDMARKS) assert(s.vol <= LANDMARK_GAIN_BUDGET, s.id + ' vol above budget');
  const by = id => CONFIRMED_LANDMARKS.find(s => s.id === id);
  assert(landmarkGain(20.2, by('lakeWaterbirds').nearM, by('lakeWaterbirds').farM) > 0.9);
  assert(landmarkGain(20.4, by('skyStarring').nearM, by('skyStarring').farM) === 1);
  assert(landmarkGain(3.9, by('skyGardener').nearM, by('skyGardener').farM) > 0.9);
});
function src(fileS) { return { volume: 0, playing: false, currentTime: 0, plays: 0, fail: false,
  play() { if (this.fail) return; if (!this.playing && this.currentTime >= fileS) this.currentTime = 0; this.playing = true; this.plays++; },
  pause() { this.playing = false; }, stop() { this.playing = false; this.currentTime = 0; },
  adv(dt) { if (this.playing) { this.currentTime += dt; if (this.currentTime >= fileS) { this.currentTime = fileS; this.playing = false; } } } }; }
check('star ring loop: two alternating sources, seam crossfade after encoder delay, never silent, file has the overlap tail', () => {
  const ring = CONFIRMED_LANDMARKS[2], fileS = ring.loopS + LANDMARK_LOOP_DUP_S, dt = 1 / 30;
  assert(ring.loopS === 16 && ring.sr === 24000);
  assert(LANDMARK_SEAM_S + LANDMARK_ENCODER_DELAY_SAMPLES / ring.sr + dt <= LANDMARK_LOOP_DUP_S, 'overlap tail covers seam + delay + one frame');
  const a = src(fileS), b = src(fileS), p = new LandmarkLoopPair(a, b, ring.loopS, ring.sr); p.start();
  let minSum = 1, t = 0;
  for (; t < 70; t += dt) { a.adv(dt); b.adv(dt); p.tick(dt, 0.5); const sum = (a.playing ? a.volume : 0) + (b.playing ? b.volume : 0); minSum = Math.min(minSum, sum / 0.5); }
  assert.equal(p.seams, 4); assert(minSum > 0.999, 'equal-gain seam keeps the sum at the target (' + minSum + ')'); assert(!p.xFailed);
  assert(a.plays + b.plays === 5 && a.plays >= 2 && b.plays >= 2, 'sources alternate');
  // pause/resume (visibility): position kept, no restart
  const pos = Math.max(a.currentTime, b.currentTime); p.pause(); assert(!p.playing); a.adv(1); b.adv(1); p.start();
  assert.equal(Math.max(a.currentTime, b.currentTime), pos); assert(p.playing);
  p.stop(); assert(!p.playing && a.volume === 0 && b.volume === 0 && a.currentTime === 0 && b.currentTime === 0);
  // partner never starts: falls back to restarting the main source instead of going silent for good
  const c = src(fileS), d = src(fileS); d.fail = true; const q = new LandmarkLoopPair(c, d, ring.loopS, ring.sr); q.start(); let silent = 0;
  for (t = 0; t < 40; t += dt) { c.adv(dt); q.tick(dt, 0.5); if (!c.playing) silent += dt; }
  assert(q.xFailed && silent < 0.1, 'fallback restart gap ' + silent.toFixed(3) + ' s');
  const wav = fs.statSync(path.join(base, '../bundles/region_skycity/audio/amb_sky_starring_loop.mp3')).size; assert(wav > 0);
});
check('core ticks every port after setting volume (loop seam runs at the faded volume)', () => {
  const seen = []; const c = new LandmarkAudioCore(spec => { const p = port(); p.tick = function (dt) { seen.push([spec.id, this.volume, dt]); }; return p; }, () => 0);
  c.step(0.5, 'skycity', { skyStarring: 0 }, true, 1);
  const ring = seen.filter(x => x[0] === 'skyStarring'); assert(ring.length === 1 && ring[0][2] === 0.5 && Math.abs(ring[0][1] - 0.25 * CONFIRMED_LANDMARKS[2].vol) < 1e-9);
  const src = fs.readFileSync(path.join(base, 'audio/LandmarkAudio.ts'), 'utf8');
  assert(src.includes('class LoopVoice') && src.includes('new LandmarkLoopPair') && src.includes('src.loop = false') && /spec\.loopS !== null \? new LoopVoice/.test(src));
});
console.log('landmark-audio: ' + checks + ' checks PASS');
