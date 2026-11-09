'use strict';
// 黎明云海: enter (journal gate + RegionLoader), finish (witness), save (journal receipt + cold restore), return (requestExit),
// and the board plane sitting on the terrace. Pure Node. No Cocos render, device, or WeChat.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..'), A = path.join(ROOT, 'creator-build-project/assets'), R = path.join(A, 'scripts/regional-r05/runtime');
const { createHarness } = require('../board-ui/harness.cjs'), H = createHarness();
const API = require(R + '/index.js'), Journal = require(R + '/progress-journal.js'), Host = require(R + '/campaign-host.js');
const Lake = require(R + '/lakeside-levels-data.js'), Snow = require(R + '/snowpass-levels-data.js'), Rail = require(R + '/rail-levels-data.js'), Cloud = require(R + '/cloud-levels-data.js');
const WIT = JSON.parse(fs.readFileSync(path.join(__dirname, 'witnesses.json'), 'utf8'));
const RAILW = JSON.parse(fs.readFileSync(path.join(__dirname, '../rail/witnesses.json'), 'utf8'));
const SNOW = JSON.parse(fs.readFileSync(path.join(__dirname, '../snowpass/witnesses.json'), 'utf8'));
const LAKEW = JSON.parse(fs.readFileSync(path.join(__dirname, '../lakeside/calibration-report.json'), 'utf8'));
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

t('eight cloud stages are playable data, off the shipped catalog, ids r08-cloud-01..08', () => {
  assert.equal(Cloud.length, 8);
  assert.deepEqual(Cloud.map(s => s.id), ['r08-cloud-01', 'r08-cloud-02', 'r08-cloud-03', 'r08-cloud-04', 'r08-cloud-05', 'r08-cloud-06', 'r08-cloud-07', 'r08-cloud-08']);
  assert.deepEqual(Cloud.map(s => s.ordinal), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(API.catalog.some(s => s.region === 'cloud'), false);
  assert.equal(API.allStages.filter(s => s.region === 'cloud').length, 8);
  for (const s of Cloud) {
    assert.equal(s.region, 'cloud'); assert(s.rules.chimes && s.rules.chimes.length); assert.equal(s.tool, null);
    assert(!s.rules.phaseCycle && !s.rules.windCycle && !s.rules.beaconRoute);
    assert(s.config.moves <= 22 && s.config.moves >= 14, s.id + ' moves ' + s.config.moves);
    const run = API.createSession(s.id); assert.equal(run.snapshot().region, 'cloud'); assert.equal(run.snapshot().guide.goalName, '风铃');
  }
});
t('witnesses win inside the move budget; the cloud sea stays locked until all six rail stages are saved', () => {
  const store = mem(), platform = Host.createStorage(store), j = journey(12);
  const prov = new Provider({ platform, journey: j });
  clearPack(prov, Lake, LAKEW.map(x => ({ id: x.id, witness: x.witness })));
  clearPack(prov, Snow, SNOW);
  assert.equal(new Journal(platform, j).isUnlocked('r08-cloud-01'), false, 'snow clears do not open the cloud sea');
  clearPack(prov, Rail, RAILW);
  assert.equal(new Journal(platform, j).isUnlocked('r08-cloud-01'), true);
  assert.equal(new Journal(platform, j).isUnlocked('r08-cloud-02'), false);
  const before = new Journal(mem(), journey(12));
  assert.equal(before.isUnlocked('r08-cloud-01'), false, 'no rail records');
  const w0 = WIT[0].witness[0];
  assert(prov.startStage('r08-cloud-01', { seed: w0.seed }).ok); play(prov, w0.actions);
  assert.equal(prov.snapshot().active.status, 'won'); assert.equal(prov.snapshot().result.completionRecorded, true);
  assert.equal(prov.snapshot().progress.records['r08-cloud-01'].clears, 1);
  assert.equal(prov.requestExit().ok, true);
  const cold = new Provider({ platform, journey: j });
  assert.equal(cold.snapshot().progress.records['r08-cloud-01'].clears, 1);
  assert.equal(new Journal(platform, j).isUnlocked('r08-cloud-02'), true);
  for (const pack of WIT) for (const x of pack.witness) { const s = API.createSession(pack.id, x.seed); for (const a of x.actions) assert(s.act(a), pack.id + ' ' + x.seed); assert.equal(s.engine.status, 'won', pack.id + ' ' + x.seed); }
});
t('journey: cloud opens after the railway is fully saved, and stays 远方 until the stage list has cloud', () => {
  const J = H.load('ui/JourneyCore');
  const rec = k => Array.from({ length: 12 }, (_, i) => ({ bestStars: i < k ? 1 : 0 }));
  const shipped = API.catalog.map(s => ({ id: s.id, region: s.region }));
  const withCloud = API.allStages.map(s => ({ id: s.id, region: s.region }));
  const far = J.regionRow('cloud', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6 }, stages: shipped });
  assert.equal(far.state, 'far'); assert.equal(far.hasData, false); assert.equal(far.tappable, false);
  const locked = J.regionRow('cloud', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 5 }, stages: withCloud });
  assert.equal(locked.state, 'locked'); assert.equal(locked.hasData, true);
  const snowOnly = J.regionRow('cloud', { records: rec(12), regionDone: { lake: 6, snow: 6 }, stages: withCloud });
  assert.equal(snowOnly.state, 'locked');
  const open = J.regionRow('cloud', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6 }, stages: withCloud });
  assert.equal(open.state, 'open'); assert.equal(open.tappable, true); assert.equal(open.total, 8);
  const done = J.regionRow('cloud', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6, cloud: 8 }, stages: withCloud });
  assert.equal(done.state, 'done');
  const bar = J.journeyProgress({ records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6 }, stages: withCloud });
  assert.equal(bar.segments.some(s => s.id === 'cloud'), true);
});
t('board plane is the terrace: no gap, no sink, footprint inside the flat top', () => {
  const D = H.load('region/CloudseaSceneData'), C = H.load('world-r1/CameraPose');
  assert.equal(D.cloudseaBoardGap(), 0);
  assert.equal(D.cloudseaBoardOnPlatform(), true);
  const y = D.CLOUDSEA_PLATFORM.y;
  for (let i = 0; i < 49; i++) { const c = D.cloudseaCellCenter(i); assert.equal(c[1], y); assert(c[0] > D.CLOUDSEA_PLATFORM.minX && c[0] < D.CLOUDSEA_PLATFORM.maxX); assert(c[2] > D.CLOUDSEA_PLATFORM.minZ && c[2] < D.CLOUDSEA_PLATFORM.maxZ); }
  const b = D.cloudseaBoardBounds();
  assert.equal(b.min[1], y); assert.equal(b.max[1], y);
  assert(b.min[0] > D.CLOUDSEA_PLATFORM.minX && b.max[0] < D.CLOUDSEA_PLATFORM.maxX && b.min[2] > D.CLOUDSEA_PLATFORM.minZ && b.max[2] < D.CLOUDSEA_PLATFORM.maxZ);
  for (const a of [9 / 19.5, 9 / 16, 3 / 4, 1]) { const look = D.cloudseaBoardLook(a); assert.equal(C.validateCameraPose(C.fromLookAt(look)), null, String(a)); }
});
t('wiring: RegionLoader, scene route, journey enter, return without the balloon leg', () => {
  const LR = H.load('world-r2/LevelRegion'), RL = H.load('region/RegionLoader');
  const def = RL.REGIONS.cloud;
  assert.equal(def.bundle, 'region_cloudsea');
  assert.equal(def.prefabName, 'env_cloudsea');
  assert.equal(def.prefabUuid, undefined);
  for (const s of Cloud) assert(LR.requiresCloudseaScene({ stageId: s.id }), s.id);
  for (const id of ['r04-lake-01', 'r05-tide-01', 'r05-meadow-01', 'r05-sky-01', 'r06-snow-01', 'r07-rail-01', 'mainline-12']) assert(!LR.requiresCloudseaScene({ stageId: id }), id);
  for (const s of Rail) assert(!LR.requiresCloudseaScene({ stageId: s.id }), s.id);
  const comp = fs.readFileSync(path.join(A, 'scripts/world-r2/WorldNativeComposition.ts'), 'utf8');
  const boot = fs.readFileSync(path.join(A, 'scripts/WorldIntegrationBoot.ts'), 'utf8');
  assert(/r08-cloud-\\d\+/.test(comp) && /createCloudseaBoardBackground\(context\)/.test(comp));
  assert(/requiresLakesideScene\(context\.selection\)\?createLakesideBoardBackground\(context\)/.test(comp));
  assert(/createRailBoardBackground\(context\):\/\^r08-cloud-\\d\+\$\/\.test\(String\(context\.selection\?\.stageId\|\|''\)\)\?createCloudseaBoardBackground\(context\)/.test(comp));
  assert(/const onShelf=\/\^r06-snow-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)\|\|\/\^r07-rail-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)\|\|\/\^r08-cloud-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)/.test(comp));
  assert(/if\(!onShelf\)\{const arrived=await this\.ensureRegion\(region\)/.test(comp));
  assert(/this\.button\('cloud','黎明云海',\(\)=>this\.composition\.enterRegion\('cloud'\)\)/.test(boot));
  assert(/this\.button\('rail','秋日铁路',\(\)=>this\.composition\.enterRegion\('rail'\)\)/.test(boot));
  for (const file of ['LakesideBalloon.ts', 'BalloonFlight.ts', 'BalloonTransit.ts']) {
    const src = fs.readFileSync(path.join(A, 'scripts/region', file), 'utf8');
    assert(!/region_cloudsea|r08-cloud|env_cloudsea/.test(src), file);
  }
});
t('random-play win rate steps between about 0.90 and 0.60, with an up and a down, and moves stay between 14 and 22', () => {
  const N = 36, rates = [];
  for (const s of Cloud) {
    let w = 0, n = 0;
    for (const seed of s.seedBank) for (let i = 1; i <= N; i++) { n++; if (randomWin(s, seed, i * 7919)) w++; }
    const avg = w / n; rates.push(avg);
    assert(avg >= 0.58 && avg <= 0.94, s.id + ' ' + avg.toFixed(3));
    assert(s.config.moves <= 22 && s.config.moves >= 14, s.id);
  }
  assert(rates[1] < rates[0] - 0.08, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[2] > rates[1] + 0.04, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[3] < rates[2] - 0.1, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[4] > rates[3] + 0.08, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[5] < rates[4] - 0.04, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[6] > rates[5] + 0.08, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[7] < rates[6] - 0.08, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[0] >= 0.86 && rates[3] <= 0.72 && rates[3] >= 0.56 && rates[7] >= 0.56);
  console.log(' rates', rates.map(x => +x.toFixed(3)).join(' → '));
});
console.log(JSON.stringify({ status: 'PASS', cases: n, scope: 'Pure logic + Cocos doubles. Not a device render.' }));
