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
const { LandmarkAudioCore, landmarkGain, MAX_LANDMARK_SOURCES, LANDMARK_GAIN_BUDGET } = load('audio/LandmarkAudioCore.ts');
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
check('entry and exit each complete within 2 seconds; exit releases', () => {
  const c = rig(), r = c.rows[0]; c.step(1, 'lakeside', { lakeWaterbirds: 0 }, true, 1); assert.equal(r.level, 0.5);
  c.step(1, 'lakeside', { lakeWaterbirds: 0 }, true, 1); assert.equal(r.level, 1);
  c.step(1, 'lakeside', {}, true, 1); assert.equal(r.level, 0.5); assert(r.port.playing);
  c.step(1, 'lakeside', {}, true, 1); assert.equal(r.level, 0); assert(!r.port.ready && !r.port.playing); assert(!r.reserved);
});
check('decode delay stays silent, then fades; re-entry reverses without jump', () => {
  const c = new LandmarkAudioCore(() => { const p = port(); p.prepare = () => {}; return p; }), r = c.rows[0];
  c.step(2, 'lakeside', { lakeWaterbirds: 0 }, true, 1); assert.equal(r.level, 0);
  r.port.ready = true; c.step(0.5, 'lakeside', { lakeWaterbirds: 0 }, true, 1); assert.equal(r.level, 0.25);
  c.step(0.25, 'lakeside', {}, true, 1); assert.equal(r.level, 0.125);
  c.step(0.25, 'lakeside', { lakeWaterbirds: 0 }, true, 1); assert.equal(r.level, 0.25);
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
console.log('landmark-audio: ' + checks + ' checks PASS');
