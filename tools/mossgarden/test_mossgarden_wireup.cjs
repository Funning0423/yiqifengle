'use strict';
// 石灯苔庭: enter after the harbor, finish, save, return without the balloon,
// and the board plane painted into the court. Pure Node. No Cocos render, device, or WeChat.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..'), A = path.join(ROOT, 'creator-build-project/assets'), R = path.join(A, 'scripts/regional-r05/runtime');
const { createHarness } = require('../board-ui/harness.cjs'), H = createHarness();
const API = require(R + '/index.js'), Journal = require(R + '/progress-journal.js'), Host = require(R + '/campaign-host.js');
const Lake = require(R + '/lakeside-levels-data.js'), Snow = require(R + '/snowpass-levels-data.js'), Rail = require(R + '/rail-levels-data.js'), Cloud = require(R + '/cloud-levels-data.js'), Spring = require(R + '/spring-levels-data.js'), Fjord = require(R + '/fjord-levels-data.js'), Oasis = require(R + '/oasis-levels-data.js'), Harbor = require(R + '/harbor-levels-data.js'), Moss = require(R + '/mossgarden-levels-data.js');
const WIT = JSON.parse(fs.readFileSync(path.join(__dirname, 'witnesses.json'), 'utf8'));
const HARBORW = JSON.parse(fs.readFileSync(path.join(__dirname, '../harbor/witnesses.json'), 'utf8'));
const OASISW = JSON.parse(fs.readFileSync(path.join(__dirname, '../oasis/witnesses.json'), 'utf8'));
const FJORDW = JSON.parse(fs.readFileSync(path.join(__dirname, '../fjord/witnesses.json'), 'utf8'));
const CLOUDW = JSON.parse(fs.readFileSync(path.join(__dirname, '../cloudsea/witnesses.json'), 'utf8'));
const RAILW = JSON.parse(fs.readFileSync(path.join(__dirname, '../rail/witnesses.json'), 'utf8'));
const SNOW = JSON.parse(fs.readFileSync(path.join(__dirname, '../snowpass/witnesses.json'), 'utf8'));
const LAKEW = JSON.parse(fs.readFileSync(path.join(__dirname, '../lakeside/calibration-report.json'), 'utf8'));
const SPRINGW = JSON.parse(fs.readFileSync(path.join(__dirname, '../hotspring/witnesses.json'), 'utf8'));
const seedMossgardenUnlock = require(A + '/scripts/world-r2/mossgarden-unlock-seed.js');
let n = 0; const t = (m, f) => { f(); n++; console.log('PASS', m); };
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), size: () => m.size }; };
const journey = done => ({ readOnly: false, records: Array.from({ length: 12 }, (_, i) => ({ bestStars: i < done ? 2 : 0, clears: i < done ? 1 : 0 })) });
function flush(c) { let k = 0; while (c.snapshot().visual) { const tok = c.snapshot().visual.token; assert(c.finishVisualStep(tok).ok); assert(++k < 200); } }
function play(c, actions) { for (const a of actions) { const q = c.previewAction(a); assert(q.ok, JSON.stringify(q)); const r = c.commitAction(q.token); assert(r.ok && r.saved, JSON.stringify(r)); flush(c); } }
const Provider = require(R + '/board-session-provider.js');
function prng(s) { return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; }
function randomWin(stage, seed, ps) {
  const s = API.createSession(stage.id, seed); const rnd = prng(ps); let used = 0;
  while (s.engine.status === 'playing' && used < stage.config.moves + 2) {
    const acts = s.legalActions({ tools: false }); if (!acts.length) break;
    assert(s.act(acts[Math.floor(rnd() * acts.length)])); used++;
  }
  return s.engine.status === 'won';
}
function clearPack(prov, stages, witnesses) {
  for (const stage of stages) {
    const pack = witnesses.find(x => x.id === stage.id);
    const w = pack.witness[0];
    assert(prov.startStage(stage.id, { seed: w.seed }).ok, stage.id);
    play(prov, w.actions);
    assert.equal(prov.snapshot().result.completionRecorded, true, stage.id);
  }
}
function combo(s) {
  const parts = [];
  if ((s.rules.chimes || []).length) parts.push('chimes');
  if ((s.config.moss || []).length) parts.push('moss');
  if ((s.config.roots || []).some(r => r.layers > 1)) parts.push('roots-layered');
  else if ((s.config.roots || []).length) parts.push('roots');
  if ((s.config.beacons || []).length) parts.push('beacons');
  if ((s.config.starters || []).length) parts.push('starters:' + s.config.starters.map(x => x.special).sort().join(','));
  if (s.config.goals.lines) parts.push('lines');
  if (s.config.goals.specials) parts.push('specials');
  const types = Object.keys(s.config.goals).filter(k => /^type\d$/.test(k));
  if (types.length) parts.push('type' + types.length);
  return parts.join('+');
}

t('eight mossgarden stages are playable data, off the shipped catalog, ids r13-mossgarden-01..08', () => {
  assert.equal(Moss.length, 8);
  assert.deepEqual(Moss.map(s => s.id), ['r13-mossgarden-01', 'r13-mossgarden-02', 'r13-mossgarden-03', 'r13-mossgarden-04', 'r13-mossgarden-05', 'r13-mossgarden-06', 'r13-mossgarden-07', 'r13-mossgarden-08']);
  assert.deepEqual(Moss.map(s => s.ordinal), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(API.catalog.some(s => s.region === 'mossgarden'), false);
  assert.equal(API.allStages.filter(s => s.region === 'mossgarden').length, 8);
  assert.equal(API.allStages.filter(s => s.region === 'harbor').length, 8);
  const J = H.load('ui/JourneyCore');
  assert.equal(J.REGION_DEFS.reduce((a, d) => a + d.stages, 0), 87);
  assert.equal(J.REGION_DEFS.find(d => d.id === 'mossgarden').stages, 8);
  assert.equal(J.REGION_DEFS.find(d => d.id === 'mossgarden').short.length <= 4, true);
  assert.equal(J.REGION_DEFS.find(d => d.id === 'mossgarden').unlock.label.length <= 5, true);
  assert.deepEqual(J.REGION_DEFS.find(d => d.id === 'mossgarden').unlock.requires, ['harbor']);
  assert.equal(J.REGION_DEFS.find(d => d.id === 'harbor').stages, 8);
  for (const s of Moss) {
    assert.equal(s.region, 'mossgarden'); assert(Array.isArray(s.rules.chimes)); assert.equal(s.tool, null);
    assert(!s.rules.phaseCycle && !s.rules.windCycle);
    assert((s.config.starters || []).length <= 2, s.id);
    assert(s.config.moves <= 24 && s.config.moves >= 14, s.id + ' moves ' + s.config.moves);
    const run = API.createSession(s.id); assert.equal(run.snapshot().region, 'mossgarden'); assert(run.snapshot().guide.goalName);
  }
  assert(Moss.filter(s => s.rules.chimes.length > 0).length <= 3);
  assert(Moss.filter(s => s.rules.chimes.length > 0).length >= 1);
  const combos = Moss.map(combo);
  assert.equal(new Set(combos).size, 8, combos.join(' | '));
  assert(Moss.filter(s => (s.config.beacons || []).length > 0).length >= 1);
  const harborCombos = Harbor.map(combo), oasisCombos = Oasis.map(combo);
  Moss.forEach((s, i) => {
    assert.notEqual(combos[i], harborCombos[i], s.id + ' matches harbor ' + combos[i]);
    assert.notEqual(combos[i], oasisCombos[i], s.id + ' matches oasis ' + combos[i]);
  });
  console.log(' combos', combos.join(' | '));
});
t('the region snapshot passes the current beacon to the board, and regional bombs stay at 0', () => {
  const beaconLevels = Moss.filter(s => (s.config.beacons || []).length > 0);
  assert(beaconLevels.length >= 1);
  for (const s of beaconLevels) {
    const shot = API.createSession(s.id, s.seedBank[0]).snapshot();
    assert.equal(shot.beaconTarget.index, s.config.beacons[0]);
    assert.equal(shot.beaconTarget.cursor, 0);
    assert.equal(shot.beaconTarget.total, s.config.beacons.length);
    assert.deepEqual(shot.beaconRoute, s.config.beacons);
    assert.equal(shot.goals && API.createSession(s.id, s.seedBank[0]).engine.bombs, 0);
  }
  const quiet = Moss.find(s => !(s.config.beacons || []).length);
  assert.equal(API.createSession(quiet.id).snapshot().beaconTarget, null);
  assert.deepEqual(API.createSession(quiet.id).snapshot().beaconRoute, []);
  assert.equal(API.createSession('r12-harbor-01').engine.bombs, 0);
});
t('witnesses win inside the move budget; the moss garden stays locked until the harbor is saved', () => {
  const store = mem(), platform = Host.createStorage(store), j = journey(12);
  const prov = new Provider({ platform, journey: j });
  clearPack(prov, Lake, LAKEW.map(x => ({ id: x.id, witness: x.witness })));
  clearPack(prov, Snow, SNOW);
  clearPack(prov, Rail, RAILW);
  clearPack(prov, Cloud, CLOUDW);
  clearPack(prov, Spring, SPRINGW);
  clearPack(prov, Fjord, FJORDW);
  clearPack(prov, Oasis, OASISW);
  assert.equal(new Journal(platform, j).isUnlocked('r13-mossgarden-01'), false, 'oasis clears do not open the moss garden');
  clearPack(prov, Harbor, HARBORW);
  assert.equal(new Journal(platform, j).isUnlocked('r13-mossgarden-01'), true);
  assert.equal(new Journal(platform, j).isUnlocked('r13-mossgarden-02'), false);
  const before = new Journal(mem(), journey(12));
  assert.equal(before.isUnlocked('r13-mossgarden-01'), false, 'no harbor records');
  const w0 = WIT[0].witness[0];
  assert(prov.startStage('r13-mossgarden-01', { seed: w0.seed }).ok); play(prov, w0.actions);
  assert.equal(prov.snapshot().active.status, 'won'); assert.equal(prov.snapshot().result.completionRecorded, true);
  assert.equal(prov.snapshot().progress.records['r13-mossgarden-01'].clears, 1);
  assert.equal(prov.requestExit().ok, true);
  const cold = new Provider({ platform, journey: j });
  assert.equal(cold.snapshot().progress.records['r13-mossgarden-01'].clears, 1);
  assert.equal(new Journal(platform, j).isUnlocked('r13-mossgarden-02'), true);
  const w1 = WIT[1].witness[0];
  assert(cold.startStage('r13-mossgarden-02', { seed: w1.seed }).ok); play(cold, w1.actions);
  const third = Moss[2];
  const opened = cold.startStage(third.id, { seed: third.seedBank[0] }); assert(opened.ok, JSON.stringify(opened));
  if ((third.config.beacons || []).length) {
    assert.equal(cold.snapshot().active.beaconTarget.index, third.config.beacons[0]);
    assert.deepEqual(cold.snapshot().active.beaconRoute, third.config.beacons);
  }
  assert.equal(cold.snapshot().active.bombs, 0);
  for (const pack of WIT) for (const x of pack.witness) { const s = API.createSession(pack.id, x.seed); for (const a of x.actions) assert(s.act(a), pack.id + ' ' + x.seed); assert.equal(s.engine.status, 'won', pack.id + ' ' + x.seed); }
});
t('journey: moss garden opens after the harbor is fully saved, and stays 远方 until the stage list has mossgarden', () => {
  const J = H.load('ui/JourneyCore');
  const rec = k => Array.from({ length: 12 }, (_, i) => ({ bestStars: i < k ? 1 : 0 }));
  const shipped = API.catalog.map(s => ({ id: s.id, region: s.region }));
  const withMoss = API.allStages.map(s => ({ id: s.id, region: s.region }));
  const far = J.regionRow('mossgarden', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6, cloud: 8, spring: 8, fjord: 8, oasis: 8, harbor: 8 }, stages: shipped });
  assert.equal(far.state, 'far'); assert.equal(far.hasData, false); assert.equal(far.tappable, false);
  const locked = J.regionRow('mossgarden', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6, cloud: 8, spring: 8, fjord: 8, oasis: 8, harbor: 7 }, stages: withMoss });
  assert.equal(locked.state, 'locked'); assert.equal(locked.hasData, true);
  const open = J.regionRow('mossgarden', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6, cloud: 8, spring: 8, fjord: 8, oasis: 8, harbor: 8 }, stages: withMoss });
  assert.equal(open.state, 'open'); assert.equal(open.tappable, true); assert.equal(open.total, 8);
  const done = J.regionRow('mossgarden', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6, cloud: 8, spring: 8, fjord: 8, oasis: 8, harbor: 8, mossgarden: 8 }, stages: withMoss });
  assert.equal(done.state, 'done');
  const bar = J.journeyProgress({ records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6, cloud: 8, spring: 8, fjord: 8, oasis: 8, harbor: 8 }, stages: withMoss });
  assert.equal(bar.segments.some(s => s.id === 'mossgarden'), true);
  assert.equal(bar.segments.some(s => s.id === 'harbor'), true);
  assert.equal(bar.total, 12 + 6 + 6 + 6 + 8 + 8 + 8 + 8 + 8 + 8);
});
t('board plane is the court: no gap, no sink, footprint inside the flat floor', () => {
  const D = H.load('region/MossgardenSceneData'), C = H.load('world-r1/CameraPose');
  assert.equal(D.mossgardenBoardGap(), 0);
  assert.equal(D.mossgardenBoardOnCourt(), true);
  assert.equal(D.MOSSGARDEN_COURT.y, 0);
  const y = D.MOSSGARDEN_COURT.y;
  for (let i = 0; i < 49; i++) { const c = D.mossgardenCellCenter(i); assert.equal(c[1], y); assert(c[0] > D.MOSSGARDEN_COURT.minX && c[0] < D.MOSSGARDEN_COURT.maxX); assert(c[2] > D.MOSSGARDEN_COURT.minZ && c[2] < D.MOSSGARDEN_COURT.maxZ); }
  const b = D.mossgardenBoardBounds();
  assert.equal(b.min[1], y); assert.equal(b.max[1], y);
  assert(b.min[0] > D.MOSSGARDEN_COURT.minX && b.max[0] < D.MOSSGARDEN_COURT.maxX && b.min[2] > D.MOSSGARDEN_COURT.minZ && b.max[2] < D.MOSSGARDEN_COURT.maxZ);
  for (const a of [9 / 19.5, 9 / 16, 3 / 4, 1]) { const look = D.mossgardenBoardLook(a); assert.equal(C.validateCameraPose(C.fromLookAt(look)), null, String(a)); }
});
t('wiring: RegionLoader, scene route, journey enter, return without the balloon leg', () => {
  const LR = H.load('world-r2/LevelRegion'), RL = H.load('region/RegionLoader');
  const def = RL.REGIONS.mossgarden;
  assert.equal(def.bundle, 'region_mossgarden');
  assert.equal(def.prefabName, 'env_mossgarden');
  assert.equal(def.prefabUuid, undefined);
  assert.equal(RL.REGIONS.harbor.bundle, 'region_harbor');
  for (const s of Moss) assert(LR.requiresMossgardenScene({ stageId: s.id }), s.id);
  for (const id of ['r04-lake-01', 'r05-tide-01', 'r05-meadow-01', 'r05-sky-01', 'r06-snow-01', 'r07-rail-01', 'r08-cloud-01', 'r09-spring-01', 'r10-fjord-01', 'r11-oasis-01', 'r12-harbor-01', 'mainline-12']) assert(!LR.requiresMossgardenScene({ stageId: id }), id);
  for (const s of Harbor) assert(!LR.requiresMossgardenScene({ stageId: s.id }), s.id);
  const comp = fs.readFileSync(path.join(A, 'scripts/world-r2/WorldNativeComposition.ts'), 'utf8');
  const boot = fs.readFileSync(path.join(A, 'scripts/WorldIntegrationBoot.ts'), 'utf8');
  assert(/r13-mossgarden-\\d\+/.test(comp) && /createMossgardenBoardBackground\(context\)/.test(comp));
  assert(/createHarborBoardBackground\(context\):\/\^r13-mossgarden-\\d\+\$\/\.test\(String\(context\.selection\?\.stageId\|\|''\)\)\?createMossgardenBoardBackground\(context\)/.test(comp));
  assert(/\/\^r13-mossgarden-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)/.test(comp));
  assert(/if\(!onShelf\)\{const arrived=await this\.ensureRegion\(region\)/.test(comp));
  assert(/this\.button\('mossgarden','石灯苔庭',\(\)=>this\.composition\.enterRegion\('mossgarden'\)\)/.test(boot));
  assert(/this\.button\('harbor','海港台地',\(\)=>this\.composition\.enterRegion\('harbor'\)\)/.test(boot));
  for (const file of ['LakesideBalloon.ts', 'BalloonFlight.ts', 'BalloonTransit.ts']) {
    const src = fs.readFileSync(path.join(A, 'scripts/region', file), 'utf8');
    assert(!/region_mossgarden|r13-mossgarden|env_mossgarden/.test(src), file);
  }
});
t('qfPre=unlock-mossgarden replays onto the given profile and does not touch another store', () => {
  const keys = H.load('world-r2/PreTransitionKeys');
  const spec = keys.PRE_SPECS.find(s => s.key === 'unlock-mossgarden');
  assert(spec, 'missing unlock-mossgarden');
  assert.equal(spec.place, 'island');
  assert.equal(spec.finish, true);
  assert.equal(spec.checkpoint, 12);
  const run = fs.readFileSync(path.join(A, 'scripts/world-r2/PreTransitionRun.ts'), 'utf8');
  assert(/spec\.key==='unlock-mossgarden'/.test(run) && /seedMossgardenUnlock\(\(this\.d\.composition as any\)\.testProfile,\{allowQa:true\}\)/.test(run));
  assert.throws(() => seedMossgardenUnlock({ platform: mem(), journey: journey(12) }, {}), /test-build-only/);
  const real = mem(), isolated = mem();
  const seeded = seedMossgardenUnlock({ platform: Host.createStorage(isolated), journey: journey(12) }, { allowQa: true });
  assert.equal(seeded.cleared.length, 58);
  assert.equal(new Journal(Host.createStorage(isolated), journey(12)).isUnlocked('r13-mossgarden-01'), true);
  assert.equal(real.size(), 0, 'real store was not opened');
  assert.equal(new Journal(Host.createStorage(real), journey(12)).isUnlocked('r13-mossgarden-01'), false);
});
t('random-play win rate steps between 0.90 and 0.60, with an up and a down', () => {
  const N = 36, rates = [];
  for (const s of Moss) {
    let w = 0, n = 0;
    for (const seed of s.seedBank) for (let i = 1; i <= N; i++) { n++; if (randomWin(s, seed, i * 7919)) w++; }
    const avg = w / n; rates.push(avg);
    assert(avg >= 0.60 && avg <= 0.90, s.id + ' ' + avg.toFixed(3));
    assert(s.config.moves <= 24 && s.config.moves >= 14, s.id);
  }
  assert(rates[1] < rates[0] - 0.08, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[2] > rates[1] + 0.04, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[3] < rates[2] - 0.1, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[4] > rates[3] + 0.08, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[5] < rates[4] - 0.04, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[6] > rates[5] + 0.08, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[7] < rates[6] - 0.08, rates.map(x => x.toFixed(3)).join(' '));
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  assert(mean < 0.76, mean.toFixed(3));
  console.log(' rates', rates.map(x => +x.toFixed(3)).join(' → '));
});
console.log(JSON.stringify({ status: 'PASS', cases: n, scope: 'Pure logic + Cocos doubles. Not a device render.' }));
