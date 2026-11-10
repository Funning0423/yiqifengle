'use strict';
// 峡湾极光栈道: enter after the hot spring, finish, save, return without the balloon,
// and the board plane sitting on the pier. Pure Node. No Cocos render, device, or WeChat.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..'), A = path.join(ROOT, 'creator-build-project/assets'), R = path.join(A, 'scripts/regional-r05/runtime');
const { createHarness } = require('../board-ui/harness.cjs'), H = createHarness();
const API = require(R + '/index.js'), Journal = require(R + '/progress-journal.js'), Host = require(R + '/campaign-host.js');
const Lake = require(R + '/lakeside-levels-data.js'), Snow = require(R + '/snowpass-levels-data.js'), Rail = require(R + '/rail-levels-data.js'), Cloud = require(R + '/cloud-levels-data.js'), Spring = require(R + '/spring-levels-data.js'), Fjord = require(R + '/fjord-levels-data.js');
const WIT = JSON.parse(fs.readFileSync(path.join(__dirname, 'witnesses.json'), 'utf8'));
const CLOUDW = JSON.parse(fs.readFileSync(path.join(__dirname, '../cloudsea/witnesses.json'), 'utf8'));
const RAILW = JSON.parse(fs.readFileSync(path.join(__dirname, '../rail/witnesses.json'), 'utf8'));
const SNOW = JSON.parse(fs.readFileSync(path.join(__dirname, '../snowpass/witnesses.json'), 'utf8'));
const LAKEW = JSON.parse(fs.readFileSync(path.join(__dirname, '../lakeside/calibration-report.json'), 'utf8'));
const SPRINGW = JSON.parse(fs.readFileSync(path.join(__dirname, '../hotspring/witnesses.json'), 'utf8'));
let n = 0; const t = (m, f) => { f(); n++; console.log('PASS', m); };
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; };
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

t('eight fjord stages are playable data, off the shipped catalog, ids r10-fjord-01..08', () => {
  assert.equal(Fjord.length, 8);
  assert.deepEqual(Fjord.map(s => s.id), ['r10-fjord-01', 'r10-fjord-02', 'r10-fjord-03', 'r10-fjord-04', 'r10-fjord-05', 'r10-fjord-06', 'r10-fjord-07', 'r10-fjord-08']);
  assert.deepEqual(Fjord.map(s => s.ordinal), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(API.catalog.some(s => s.region === 'fjord'), false);
  assert.equal(API.allStages.filter(s => s.region === 'fjord').length, 8);
  assert.equal(API.allStages.filter(s => s.region === 'spring').length, 8);
  assert.equal(API.allStages.filter(s => s.region === 'cloud').length, 8);
  const J = H.load('ui/JourneyCore');
  assert.equal(J.REGION_DEFS.reduce((a, d) => a + d.stages, 0), 87);
  assert.equal(J.REGION_DEFS.find(d => d.id === 'fjord').stages, 8);
  assert.equal(J.REGION_DEFS.find(d => d.id === 'fjord').short.length <= 4, true);
  assert.deepEqual(J.REGION_DEFS.find(d => d.id === 'fjord').unlock.requires, ['spring']);
  assert.equal(J.REGION_DEFS.find(d => d.id === 'spring').stages, 8);
  for (const s of Fjord) {
    assert.equal(s.region, 'fjord'); assert(s.rules.chimes && s.rules.chimes.length); assert.equal(s.tool, null);
    assert(!s.rules.phaseCycle && !s.rules.windCycle);
    assert(s.config.moves <= 24 && s.config.moves >= 14, s.id + ' moves ' + s.config.moves);
    const run = API.createSession(s.id); assert.equal(run.snapshot().region, 'fjord'); assert.equal(run.snapshot().guide.goalName, '风铃');
  }
  const combo = s => {
    const parts = ['chimes'];
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
  };
  const combos = Fjord.map(combo);
  assert.equal(new Set(combos).size, 8, combos.join(' | '));
  assert(Fjord.filter(s => (s.config.beacons || []).length > 0).length >= 1);
  console.log(' combos', combos.join(' | '));
});
t('the region snapshot passes the current beacon to the board, and regional bombs stay at 0', () => {
  const lit = API.createSession('r10-fjord-03', 4);
  const shot = lit.snapshot();
  assert.equal(shot.beaconTarget.index, 17);
  assert.equal(shot.beaconTarget.cursor, 0);
  assert.equal(shot.beaconTarget.total, 2);
  assert.deepEqual(shot.beaconRoute, [17, 31]);
  const second = API.createSession('r10-fjord-07', 1);
  assert.equal(second.snapshot().beaconTarget.index, 16);
  assert.deepEqual(second.snapshot().beaconRoute, [16, 18]);
  const spring = API.createSession('r09-spring-01');
  assert.equal(spring.snapshot().beaconTarget, null);
  assert.deepEqual(spring.snapshot().beaconRoute, []);
  assert.equal(spring.engine.bombs, 0);
  assert.equal(lit.engine.bombs, 0);
});
t('witnesses win inside the move budget; the fjord stays locked until the hot spring is saved', () => {
  const store = mem(), platform = Host.createStorage(store), j = journey(12);
  const prov = new Provider({ platform, journey: j });
  clearPack(prov, Lake, LAKEW.map(x => ({ id: x.id, witness: x.witness })));
  clearPack(prov, Snow, SNOW);
  clearPack(prov, Rail, RAILW);
  clearPack(prov, Cloud, CLOUDW);
  assert.equal(new Journal(platform, j).isUnlocked('r10-fjord-01'), false, 'cloud clears do not open the fjord');
  clearPack(prov, Spring, SPRINGW);
  assert.equal(new Journal(platform, j).isUnlocked('r10-fjord-01'), true);
  assert.equal(new Journal(platform, j).isUnlocked('r10-fjord-02'), false);
  const before = new Journal(mem(), journey(12));
  assert.equal(before.isUnlocked('r10-fjord-01'), false, 'no spring records');
  const w0 = WIT[0].witness[0];
  assert(prov.startStage('r10-fjord-01', { seed: w0.seed }).ok); play(prov, w0.actions);
  assert.equal(prov.snapshot().active.status, 'won'); assert.equal(prov.snapshot().result.completionRecorded, true);
  assert.equal(prov.snapshot().progress.records['r10-fjord-01'].clears, 1);
  assert.equal(prov.requestExit().ok, true);
  const cold = new Provider({ platform, journey: j });
  assert.equal(cold.snapshot().progress.records['r10-fjord-01'].clears, 1);
  assert.equal(new Journal(platform, j).isUnlocked('r10-fjord-02'), true);
  const w1 = WIT[1].witness[0];
  assert(cold.startStage('r10-fjord-02', { seed: w1.seed }).ok); play(cold, w1.actions);
  const opened = cold.startStage('r10-fjord-03', { seed: 4 }); assert(opened.ok, JSON.stringify(opened));
  assert.equal(cold.snapshot().active.beaconTarget.index, 17);
  assert.deepEqual(cold.snapshot().active.beaconRoute, [17, 31]);
  assert.equal(cold.snapshot().active.bombs, 0);
  for (const pack of WIT) for (const x of pack.witness) { const s = API.createSession(pack.id, x.seed); for (const a of x.actions) assert(s.act(a), pack.id + ' ' + x.seed); assert.equal(s.engine.status, 'won', pack.id + ' ' + x.seed); }
});
t('journey: fjord opens after the hot spring is fully saved, and stays 远方 until the stage list has fjord', () => {
  const J = H.load('ui/JourneyCore');
  const rec = k => Array.from({ length: 12 }, (_, i) => ({ bestStars: i < k ? 1 : 0 }));
  const shipped = API.catalog.map(s => ({ id: s.id, region: s.region }));
  const withFjord = API.allStages.map(s => ({ id: s.id, region: s.region }));
  const far = J.regionRow('fjord', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6, cloud: 8, spring: 8 }, stages: shipped });
  assert.equal(far.state, 'far'); assert.equal(far.hasData, false); assert.equal(far.tappable, false);
  const locked = J.regionRow('fjord', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6, cloud: 8, spring: 7 }, stages: withFjord });
  assert.equal(locked.state, 'locked'); assert.equal(locked.hasData, true);
  const open = J.regionRow('fjord', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6, cloud: 8, spring: 8 }, stages: withFjord });
  assert.equal(open.state, 'open'); assert.equal(open.tappable, true); assert.equal(open.total, 8);
  const done = J.regionRow('fjord', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6, cloud: 8, spring: 8, fjord: 8 }, stages: withFjord });
  assert.equal(done.state, 'done');
  const bar = J.journeyProgress({ records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6, cloud: 8, spring: 8 }, stages: withFjord });
  assert.equal(bar.segments.some(s => s.id === 'fjord'), true);
  assert.equal(bar.segments.some(s => s.id === 'spring'), true);
  assert.equal(bar.total, 12 + 6 + 6 + 6 + 8 + 8 + 8 + 8 + 8 + 8);
});
t('board plane is the pier: no gap, no sink, footprint inside the flat top', () => {
  const D = H.load('region/FjordSceneData'), C = H.load('world-r1/CameraPose');
  assert.equal(D.fjordBoardGap(), 0);
  assert.equal(D.fjordBoardOnPlatform(), true);
  assert.equal(D.FJORD_PLATFORM.y, 1.25);
  const y = D.FJORD_PLATFORM.y;
  for (let i = 0; i < 49; i++) { const c = D.fjordCellCenter(i); assert.equal(c[1], y); assert(c[0] > D.FJORD_PLATFORM.minX && c[0] < D.FJORD_PLATFORM.maxX); assert(c[2] > D.FJORD_PLATFORM.minZ && c[2] < D.FJORD_PLATFORM.maxZ); }
  const b = D.fjordBoardBounds();
  assert.equal(b.min[1], y); assert.equal(b.max[1], y);
  assert(b.min[0] > D.FJORD_PLATFORM.minX && b.max[0] < D.FJORD_PLATFORM.maxX && b.min[2] > D.FJORD_PLATFORM.minZ && b.max[2] < D.FJORD_PLATFORM.maxZ);
  for (const a of [9 / 19.5, 9 / 16, 3 / 4, 1]) { const look = D.fjordBoardLook(a); assert.equal(C.validateCameraPose(C.fromLookAt(look)), null, String(a)); }
});
t('wiring: RegionLoader, scene route, journey enter, return without the balloon leg', () => {
  const LR = H.load('world-r2/LevelRegion'), RL = H.load('region/RegionLoader');
  const def = RL.REGIONS.fjord;
  assert.equal(def.bundle, 'region_fjord');
  assert.equal(def.prefabName, 'env_fjord');
  assert.equal(def.prefabUuid, undefined);
  assert.equal(RL.REGIONS.spring.bundle, 'region_hotspring');
  for (const s of Fjord) assert(LR.requiresFjordScene({ stageId: s.id }), s.id);
  for (const id of ['r04-lake-01', 'r05-tide-01', 'r05-meadow-01', 'r05-sky-01', 'r06-snow-01', 'r07-rail-01', 'r08-cloud-01', 'r09-spring-01', 'mainline-12']) assert(!LR.requiresFjordScene({ stageId: id }), id);
  for (const s of Spring) assert(!LR.requiresFjordScene({ stageId: s.id }), s.id);
  const comp = fs.readFileSync(path.join(A, 'scripts/world-r2/WorldNativeComposition.ts'), 'utf8');
  const boot = fs.readFileSync(path.join(A, 'scripts/WorldIntegrationBoot.ts'), 'utf8');
  assert(/r10-fjord-\\d\+/.test(comp) && /createFjordBoardBackground\(context\)/.test(comp));
  assert(/createHotspringBoardBackground\(context\):\/\^r10-fjord-\\d\+\$\/\.test\(String\(context\.selection\?\.stageId\|\|''\)\)\?createFjordBoardBackground\(context\)/.test(comp));
  assert(/const onShelf=\/\^r06-snow-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)\|\|\/\^r07-rail-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)\|\|\/\^r08-cloud-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)\|\|\/\^r09-spring-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)\|\|\/\^r10-fjord-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)/.test(comp));
  assert(/if\(!onShelf\)\{const arrived=await this\.ensureRegion\(region\)/.test(comp));
  assert(/this\.button\('fjord','峡湾栈道',\(\)=>this\.composition\.enterRegion\('fjord'\)\)/.test(boot));
  assert(/this\.button\('spring','温泉谷',\(\)=>this\.composition\.enterRegion\('spring'\)\)/.test(boot));
  for (const file of ['LakesideBalloon.ts', 'BalloonFlight.ts', 'BalloonTransit.ts']) {
    const src = fs.readFileSync(path.join(A, 'scripts/region', file), 'utf8');
    assert(!/region_fjord|r10-fjord|env_fjord/.test(src), file);
  }
});
t('random-play win rate steps between 0.90 and 0.60, with an up and a down, and the fjord is a little harder than the hot spring', () => {
  const N = 36, rates = [];
  for (const s of Fjord) {
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
