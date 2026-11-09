'use strict';
// 秋日铁路: enter (journal gate + RegionLoader), finish (witness), save (journal receipt + cold restore), return (requestExit),
// and the board plane sitting on the platform. Pure Node. No Cocos render, device, or WeChat.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..'), A = path.join(ROOT, 'creator-build-project/assets'), R = path.join(A, 'scripts/regional-r05/runtime');
const { createHarness } = require('../board-ui/harness.cjs'), H = createHarness();
const API = require(R + '/index.js'), Journal = require(R + '/progress-journal.js'), Host = require(R + '/campaign-host.js');
const Lake = require(R + '/lakeside-levels-data.js'), Snow = require(R + '/snowpass-levels-data.js'), Rail = require(R + '/rail-levels-data.js');
const WIT = JSON.parse(fs.readFileSync(path.join(__dirname, 'witnesses.json'), 'utf8'));
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

t('six rail stages are playable data, off the shipped catalog, ids r07-rail-01..06', () => {
  assert.equal(Rail.length, 6);
  assert.deepEqual(Rail.map(s => s.id), ['r07-rail-01', 'r07-rail-02', 'r07-rail-03', 'r07-rail-04', 'r07-rail-05', 'r07-rail-06']);
  assert.deepEqual(Rail.map(s => s.ordinal), [1, 2, 3, 4, 5, 6]);
  assert.equal(API.catalog.some(s => s.region === 'rail'), false);
  assert.equal(API.allStages.filter(s => s.region === 'rail').length, 6);
  for (const s of Rail) {
    assert.equal(s.region, 'rail'); assert(s.rules.chimes && s.rules.chimes.length); assert.equal(s.tool, null);
    assert(!s.rules.phaseCycle && !s.rules.windCycle && !s.rules.beaconRoute);
    assert(s.config.moves <= 22 && s.config.moves >= 12, s.id + ' moves ' + s.config.moves);
    const run = API.createSession(s.id); assert.equal(run.snapshot().region, 'rail'); assert.equal(run.snapshot().guide.goalName, '风铃');
  }
});
t('witnesses win inside the move budget; the railway stays locked until all six snow stages are saved', () => {
  const store = mem(), platform = Host.createStorage(store), j = journey(12);
  const prov = new Provider({ platform, journey: j });
  for (const lake of Lake) { const w = LAKEW.find(x => x.id === lake.id).witness[0]; assert(prov.startStage(lake.id, { seed: w.seed }).ok, lake.id); play(prov, w.actions); assert.equal(prov.snapshot().result.completionRecorded, true, lake.id); }
  for (const pack of SNOW) { const w = pack.witness[0]; assert(prov.startStage(pack.id, { seed: w.seed }).ok, pack.id); play(prov, w.actions); assert.equal(prov.snapshot().result.completionRecorded, true, pack.id); }
  assert.equal(new Journal(platform, j).isUnlocked('r07-rail-01'), true);
  assert.equal(new Journal(platform, j).isUnlocked('r07-rail-02'), false);
  const before = new Journal(mem(), journey(12));
  assert.equal(before.isUnlocked('r07-rail-01'), false, 'no snow records');
  const lakesOnly = mem(), lp = Host.createStorage(lakesOnly);
  const lakesProv = new Provider({ platform: lp, journey: j });
  for (const lake of Lake) { const w = LAKEW.find(x => x.id === lake.id).witness[0]; assert(lakesProv.startStage(lake.id, { seed: w.seed }).ok); play(lakesProv, w.actions); }
  assert.equal(new Journal(lp, j).isUnlocked('r07-rail-01'), false, 'lake clears do not open the railway');
  const w0 = WIT[0].witness[0];
  assert(prov.startStage('r07-rail-01', { seed: w0.seed }).ok); play(prov, w0.actions);
  assert.equal(prov.snapshot().active.status, 'won'); assert.equal(prov.snapshot().result.completionRecorded, true);
  assert.equal(prov.snapshot().progress.records['r07-rail-01'].clears, 1);
  assert.equal(prov.requestExit().ok, true);
  const cold = new Provider({ platform, journey: j });
  assert.equal(cold.snapshot().progress.records['r07-rail-01'].clears, 1);
  assert.equal(new Journal(platform, j).isUnlocked('r07-rail-02'), true);
  for (const pack of WIT) for (const x of pack.witness) { const s = API.createSession(pack.id, x.seed); for (const a of x.actions) assert(s.act(a), pack.id + ' ' + x.seed); assert.equal(s.engine.status, 'won', pack.id + ' ' + x.seed); }
});
t('journey: rail opens after snow is fully saved, and stays 远方 until the stage list has rail', () => {
  const J = H.load('ui/JourneyCore');
  const rec = k => Array.from({ length: 12 }, (_, i) => ({ bestStars: i < k ? 1 : 0 }));
  const shipped = API.catalog.map(s => ({ id: s.id, region: s.region }));
  const withRail = API.allStages.map(s => ({ id: s.id, region: s.region }));
  const far = J.regionRow('rail', { records: rec(12), regionDone: { lake: 6, snow: 6 }, stages: shipped });
  assert.equal(far.state, 'far'); assert.equal(far.hasData, false); assert.equal(far.tappable, false);
  const locked = J.regionRow('rail', { records: rec(12), regionDone: { lake: 6, snow: 5 }, stages: withRail });
  assert.equal(locked.state, 'locked'); assert.equal(locked.hasData, true);
  const coastOnly = J.regionRow('rail', { records: rec(12), regionDone: { lake: 6, coast: 9 }, stages: withRail });
  assert.equal(coastOnly.state, 'locked');
  const open = J.regionRow('rail', { records: rec(12), regionDone: { lake: 6, snow: 6 }, stages: withRail });
  assert.equal(open.state, 'open'); assert.equal(open.tappable, true); assert.equal(open.total, 6);
  const done = J.regionRow('rail', { records: rec(12), regionDone: { lake: 6, snow: 6, rail: 6 }, stages: withRail });
  assert.equal(done.state, 'done');
  const bar = J.journeyProgress({ records: rec(12), regionDone: { lake: 6, snow: 6 }, stages: withRail });
  assert.equal(bar.segments.some(s => s.id === 'rail'), true);
});
t('board plane is the platform: no gap, no sink, footprint inside the flat top', () => {
  const D = H.load('region/RailSceneData'), C = H.load('world-r1/CameraPose');
  assert.equal(D.railBoardGap(), 0);
  assert.equal(D.railBoardOnPlatform(), true);
  const y = D.RAIL_PLATFORM.y;
  for (let i = 0; i < 49; i++) { const c = D.railCellCenter(i); assert.equal(c[1], y); assert(c[0] > D.RAIL_PLATFORM.minX && c[0] < D.RAIL_PLATFORM.maxX); assert(c[2] > D.RAIL_PLATFORM.minZ && c[2] < D.RAIL_PLATFORM.maxZ); }
  const b = D.railBoardBounds();
  assert.equal(b.min[1], y); assert.equal(b.max[1], y);
  assert(b.min[0] > D.RAIL_PLATFORM.minX && b.max[0] < D.RAIL_PLATFORM.maxX && b.min[2] > D.RAIL_PLATFORM.minZ && b.max[2] < D.RAIL_PLATFORM.maxZ);
  for (const a of [9 / 19.5, 9 / 16, 3 / 4, 1]) { const look = D.railBoardLook(a); assert.equal(C.validateCameraPose(C.fromLookAt(look)), null, String(a)); }
});
t('wiring: RegionLoader, scene route, journey enter, return without the balloon leg', () => {
  const LR = H.load('world-r2/LevelRegion'), RL = H.load('region/RegionLoader');
  const def = RL.REGIONS.rail;
  assert.equal(def.bundle, 'region_rail');
  assert.equal(def.prefabName, 'env_rail');
  assert.equal(def.prefabUuid, undefined);
  for (const s of Rail) assert(LR.requiresRailScene({ stageId: s.id }), s.id);
  for (const id of ['r04-lake-01', 'r05-tide-01', 'r05-meadow-01', 'r05-sky-01', 'r06-snow-01', 'mainline-12']) assert(!LR.requiresRailScene({ stageId: id }), id);
  for (const s of Snow) assert(!LR.requiresRailScene({ stageId: s.id }), s.id);
  const comp = fs.readFileSync(path.join(A, 'scripts/world-r2/WorldNativeComposition.ts'), 'utf8');
  const boot = fs.readFileSync(path.join(A, 'scripts/WorldIntegrationBoot.ts'), 'utf8');
  assert(/r07-rail-\\d\+/.test(comp) && /createRailBoardBackground\(context\)/.test(comp));
  assert(/requiresLakesideScene\(context\.selection\)\?createLakesideBoardBackground\(context\)/.test(comp));
  assert(/createSnowpassBoardBackground\(context\):\/\^r07-rail-\\d\+\$\/\.test\(String\(context\.selection\?\.stageId\|\|''\)\)\?createRailBoardBackground\(context\):\/\^r08-cloud-\\d\+\$\/\.test\(String\(context\.selection\?\.stageId\|\|''\)\)\?createCloudseaBoardBackground\(context\)/.test(comp));
  assert(/const onShelf=\/\^r06-snow-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)\|\|\/\^r07-rail-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)\|\|\/\^r08-cloud-\\d\+\$\/\.test\(String\(selection\.stageId\|\|''\)\)/.test(comp));
  assert(/if\(!onShelf\)\{const arrived=await this\.ensureRegion\(region\)/.test(comp));
  assert(/this\.button\('rail','秋日铁路',\(\)=>this\.composition\.enterRegion\('rail'\)\)/.test(boot));
  assert(/this\.button\('snow','雪山山口',\(\)=>this\.composition\.enterRegion\('snow'\)\)/.test(boot));
  const balloon = fs.readFileSync(path.join(A, 'scripts/region/LakesideBalloon.ts'), 'utf8');
  assert(!/region_rail|r07-rail|env_rail/.test(balloon));
});
t('random-play win rate steps between about 0.90 and 0.60, with an up and a down, and no 40-move stage', () => {
  const N = 36, rates = [];
  for (const s of Rail) {
    let w = 0, n = 0;
    for (const seed of s.seedBank) for (let i = 1; i <= N; i++) { n++; if (randomWin(s, seed, i * 7919)) w++; }
    const avg = w / n; rates.push(avg);
    assert(avg >= 0.58 && avg <= 0.94, s.id + ' ' + avg.toFixed(3));
    assert(s.config.moves < 40, s.id);
  }
  assert(rates[1] < rates[0] - 0.08, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[2] > rates[1] + 0.04, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[3] < rates[2] - 0.1, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[4] > rates[3] + 0.08, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[5] < rates[4] - 0.04, rates.map(x => x.toFixed(3)).join(' '));
  assert(rates[0] >= 0.86 && rates[3] <= 0.72 && rates[3] >= 0.56);
  console.log(' rates', rates.map(x => +x.toFixed(3)).join(' → '));
});
console.log(JSON.stringify({ status: 'PASS', cases: n, scope: 'Pure logic + Cocos doubles. Not a device render.' }));
