'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), scripts = root + '/creator-build-project/assets/scripts';
const Campaign = require(scripts + '/mainline-r1/runtime/region-campaign');
const Main = require(scripts + '/mainline-r1/runtime/mainline-controller');
const Session = require(scripts + '/mainline-r1/runtime/mainline-session');
const Port = require(scripts + '/mainline-r1/adapter/mainline-port');
const API = require(scripts + '/regional-r05/runtime/index');
const R5 = require(scripts + '/regional-r05/runtime/board-session-provider');
const Host = require(scripts + '/regional-r05/runtime/campaign-host');
const W = require('./verified-mainline.json').entries;
const RW = require(root + '/tools/persistence-fixtures/verified-replays.json');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const checks = [];
function check(name, fn) { const detail = fn(); checks.push({name, status: 'PASS', ...detail}); console.log('PASS', name); }
function memory(initial) {
  const map = new Map(initial || []), writes = []; let fault = null;
  const platform = {load: key => map.get(key) ?? null, save(key, value) {
    const mode = fault && fault(key, value); writes.push(key);
    if (mode === 'before') throw Error('TEST before-write');
    map.set(key, JSON.stringify(value));
    if (mode === 'after') throw Error('TEST after-write');
    return true;
  }};
  return {map, platform, writes, fault: f => {fault = f;}, bytes: () => JSON.stringify([...map].sort()), copy: () => [...map]};
}
function flush(c) { let n = 0; while (c.snapshot().visual) {
  const token = c.snapshot().visual.token; assert(c.finishVisualStep(token).ok); assert(!c.finishVisualStep(token).ok); assert(++n < 250);
}}
function act(c, action, mayFail = false) {
  const q = c.previewAction(action); assert(q.ok, JSON.stringify(q)); const r = c.commitAction(q.token);
  assert(!c.commitAction(q.token).ok, 'duplicate action token');
  if (!mayFail) assert(r.ok && r.saved !== false, JSON.stringify(r));
  if (r.ok && r.saved !== false) flush(c); return r;
}
const witness = (level, bankIndex = 0) => W.filter(x => x.level === level)[bankIndex];
function play(c, level, bankIndex = 0) { const w = witness(level, bankIndex); assert(c.startStage(w.stageId, {seed: w.seed}).ok); for (const a of w.actions) act(c, a); assert(c.snapshot().result.completionRecorded); return c.snapshot(); }
let earnedBaseline, prefixBaselines = [];
check('catalog preserves frozen budgets, exact goals, stage identity and seed banks', () => {
  assert.equal(Campaign.stages.length, 12);
  Campaign.stages.forEach((stage, level) => {
    assert.equal(stage.level, level); assert.equal(stage.id, Session.stageId(level));
    assert.equal(stage.moves, Session.Engine.levels[level].moves);
    assert.deepEqual(stage.goals, Session.Engine.levels[level].goals);
    assert.deepEqual(stage.goalOrder, Object.keys(stage.goals));
    assert(stage.goalOrder.length <= 4);
    assert.deepEqual(stage.seedBank, W.filter(x => x.level === level).map(x => x.seed));
    assert(Object.isFrozen(stage) && Object.isFrozen(stage.goals));
  });
  assert.equal(Campaign.stage('mainline-05').name, '风车下的花环');
  assert.equal(Campaign.stage('mainline-09').chapterName, '天空之城');
  assert.equal(Campaign.stage('mainline-13'), null);
  assert.equal(Campaign.stage('mainline-04evil'), null);
  return {stages: 12, budgetAndRulesChanged: false};
});
check('36 shipped mainline openings win without tools; every action prefix cold-restores', () => {
  let actions = 0, restores = 0;
  for (const w of W) {
    let run = new Session(w.level, w.seed); const before = run.checkpoint();
    assert.equal(before.contentSignature, w.contentSignature);
    for (const a of w.actions) {
      assert(['swap', 'activate'].includes(a[0])); assert(run.act(a, false)); actions++;
      const cp = run.checkpoint(), cold = Session.restore(cp); restores++;
      assert.deepEqual(cold.checkpoint(), cp); run = cold;
    }
    assert.equal(run.engine.status, 'won'); assert.equal(run.engine.moves, w.movesRemaining);
    assert.equal(run.engine.score, w.score); assert.equal(hash(run.checkpoint().expectedState), w.expectedStateSHA256);
    assert.equal(run.engine.bombs, 2, 'zero bomb consumption');
  }
  return {openings: W.length, actions, prefixRestores: restores};
});
check('24 meadow/sky challenge seeds replay all goals and cold-recover every prefix', () => {
  let openings = 0, actions = 0, toolActions = 0;
  for (const stage of API.catalog.filter(x => x.region !== 'tide')) for (const seed of stage.seedBank) {
    const w = RW[stage.id].find(x => x.seed === seed); assert(w, stage.id + ':' + seed);
    let run = API.createSession(stage.id, seed);
    for (const a of w.actions) { assert(run.act(a)); actions++; if (a[0] === 'tool') toolActions++;
      const cp = run.checkpoint(); run = API.restore(cp); assert.deepEqual(run.checkpoint(), cp);
    }
    assert.equal(run.engine.status, 'won'); assert(Object.values(run.engine.goals).every(x => x === 0));
    assert.equal(run.checkpoint().expectedState, w.expectedState); openings++;
  }
  return {openings, actions, includedStageToolActions: toolActions, externalInventoryUsed: false};
});
check('actual 12-stage progression, 4/8 entry versus 8/12 challenge gates, reward claims, cold storage', () => {
  const m = memory(); let c = new Main({platform: m.platform}); prefixBaselines.push(m.copy());
  for (let level = 0; level < 12; level++) {
    const before = c.snapshot(); assert.equal(before.campaign.regions[1].unlocked, level >= 4);
    assert.equal(before.campaign.regions[2].unlocked, level >= 8);
    assert.equal(before.campaign.regions[1].challengeUnlocked, level >= 8);
    assert.equal(before.campaign.regions[2].challengeUnlocked, level >= 12);
    if (level < 11) assert(!c.startStage(Session.stageId(level + 1), {seed: 1}).ok, 'cannot skip');
    const s = play(c, level);
    assert.equal(s.journey.records[level].clears, 1);
    assert.equal(s.active.name, Campaign.stages[level].name);
    assert.equal(Port.present(s).uiTitle, Campaign.stages[level].name);
    assert(s.rewardHandoff && s.rewardHandoff.chest.pending);
    assert.equal(s.rewardHandoff.nextRegion, level === 3 ? 'meadow' : level === 7 ? 'skycity' : null);
    assert.equal(s.campaign.regions[1].unlocked, level >= 3);
    assert.equal(s.campaign.regions[2].unlocked, level >= 7);
    const region = Math.floor(level / 4);
    if (level % 4 === 0) {
      assert(s.rewardHandoff.regionGift.pending);
      assert(c.claimRegion(region).ok); assert.equal(c.snapshot().rewardHandoff.regionGift.pending, false);
      const bytes = m.bytes(); assert(c.claimRegion(region).duplicate); assert.equal(m.bytes(), bytes);
    }
    assert(c.openChest(level).ok); assert(!c.snapshot().rewardHandoff.chest.pending);
    const bytes = m.bytes(); assert(c.openChest(level).duplicate); assert(c.finish().duplicate); assert.equal(m.bytes(), bytes);
    if (level < 11) { const t = Campaign.transition(s.journey, s.active.stageId, Session.stageId(level + 1));
      assert(t.ok); assert.equal(t.requiresTravel, level === 3 || level === 7); }
    const stored = m.bytes(); c = new Main({platform: m.platform}); assert.equal(m.bytes(), stored);
    assert(c.snapshot().result.completionRecorded); prefixBaselines.push(m.copy());
  }
  assert(c.snapshot().campaign.completed); assert.equal(c.snapshot().campaign.nextStageId, null);
  assert.equal(c.snapshot().nextStageId, null); earnedBaseline = m.copy();
  return {stages: 12, regionBoundaryTransitions: 2, rewardClaims: 15, writes: m.writes.length};
});
check('malformed, unavailable, read-only and sparse counter projections fail closed with no mutation', () => {
  const good = new Main({platform: memory(earnedBaseline).platform}).snapshot().journey;
  const bad = [null, {}, {readOnly: false, records: []}, {...good, readOnly: true}, {...good, readOnly: undefined},
    {...good, records: Array(12)}, {...good, records: good.records.slice(0, 11)},
    {...good, records: good.records.map((x, i) => i === 2 ? {...x, bestStars: 4} : x)},
    {...good, records: good.records.map((x, i) => i === 2 ? {...x, clears: 0} : x)}];
  for (const view of bad) { const bytes = JSON.stringify(view); for (const r of ['island', 'meadow', 'skycity']) assert(!Campaign.canEnterRegion(view, r).ok);
    assert(!Campaign.transition(view, 'mainline-04', 'mainline-05').ok); assert(Campaign.inspect(view).regions.every(x => !x.unlocked)); assert.equal(JSON.stringify(view), bytes); }
  const sparse = {...good, records: good.records.map((r, i) => i === 0 ? {bestStars: 0, clears: 0} : r), completed: 12, unlocked: 11};
  assert(!Campaign.canEnterRegion(sparse, 'meadow').ok); assert(!Campaign.canEnterRegion(sparse, 'skycity').ok);
  assert(!Campaign.transition(good, 'mainline-04', 'mainline-09').ok); assert(!Campaign.transition(good, 'mainline-08', 'mainline-05').ok);
  assert(!Campaign.canEnterRegion(good, '__proto__').ok); assert(Campaign.canEnterRegion(good, 'sky').ok);
  const readOnlyView = {readOnly: false, records: good.records};
  assert(Campaign.inspect(readOnlyView).regions.every(r => r.gift.claimed === null && !r.gift.pending));
  return {invalidViews: bad.length, sparseCountersCannotUnlock: true};
});
check('boundary winning-journal failures cannot unlock meadow/sky; cold retry records exactly once', () => {
  const cases = [];
  for (const level of [3, 7]) {
    const m = memory(prefixBaselines[level]), c = new Main({platform: m.platform}), w = witness(level);
    assert(c.startStage(w.stageId, {seed: w.seed}).ok);
    w.actions.slice(0, -1).forEach(a => act(c, a));
    m.fault(k => k === Main.PROGRESS_KEY ? 'before' : null);
    const failed = act(c, w.actions.at(-1), true); assert(!failed.ok);
    const s = c.snapshot(); assert.equal(s.state, 'result.unsaved'); assert.equal(s.rewardHandoff, null);
    assert.equal(s.nextStageId, null); assert(!Campaign.transition(s.journey, w.stageId, Session.stageId(level + 1)).ok);
    assert(!Campaign.canEnterRegion(s.journey, level === 3 ? 'meadow' : 'skycity').ok);
    assert(!c.openChest(level).ok); assert(!c.requestExit().ok);
    m.fault(null); const cold = new Main({platform: m.platform}); const fixed = cold.snapshot();
    assert(fixed.result.completionRecorded); assert.equal(fixed.journey.records[level].clears, 1);
    assert(Campaign.transition(fixed.journey, w.stageId, Session.stageId(level + 1)).ok);
    const bytes = m.bytes(); assert(cold.finish().duplicate); assert.equal(m.bytes(), bytes);
    cases.push({stageId: w.stageId, recoveredNext: fixed.nextStageId});
  }
  return {cases};
});
check('mid-level cold reopen preserves board and needs explicit resume; late tokens do not write', () => {
  let actions = 0;
  for (const level of [4, 7, 8, 11]) {
    const m = memory(prefixBaselines[level]); let c = new Main({platform: m.platform}); const w = witness(level);
    assert(c.startStage(w.stageId, {seed: w.seed}).ok);
    for (const action of w.actions) {
      const p = c.previewAction(action); assert(p.ok); assert(c.commitAction(p.token).ok);
      const old = c, token = old.snapshot().visual?.token, cp = old.session.checkpoint();
      c = new Main({platform: m.platform}); assert.deepEqual(c.session.checkpoint(), cp);
      if (c.snapshot().active.status === 'playing') {
        assert.equal(c.snapshot().state, 'run.paused'); assert(!c.previewAction(action).ok); assert(c.resume().ok);
      }
      const bytes = m.bytes(); assert(!c.commitAction(p.token).ok); if (token) assert(!c.finishVisualStep(token).ok); assert.equal(m.bytes(), bytes);
      actions++;
    }
    assert(c.snapshot().result.completionRecorded); assert.equal(c.snapshot().journey.records[level].clears, 1);
  }
  return {coldReopens: actions};
});
check('meadow/sky chest and region-gift writes: before/after faults, retry, duplicate and cold claims', () => {
  const cases = [];
  for (const level of [4, 8]) for (const method of ['openChest', 'claimRegion']) for (const mode of ['before', 'after']) {
    const m = memory(prefixBaselines[level]), c = new Main({platform: m.platform}); play(c, level);
    const index = method === 'openChest' ? level : Math.floor(level / 4), before = m.bytes();
    m.fault(k => k === Main.PROGRESS_KEY ? mode : null); const first = c[method](index);
    if (mode === 'before') { assert(!first.ok); assert.equal(m.bytes(), before); }
    else assert(first.ok);
    m.fault(null); let cold = new Main({platform: m.platform}); const retried = cold[method](index); assert(retried.ok);
    assert.equal(!!retried.duplicate, mode === 'after');
    const bytes = m.bytes(), duplicate = cold[method](index); assert(duplicate.ok && duplicate.duplicate); assert.equal(m.bytes(), bytes);
    cold = new Main({platform: m.platform}); assert(cold[method](index).duplicate); assert.equal(m.bytes(), bytes);
    cases.push({level, method, mode, duplicateGrants: duplicate.newlyGrantedRewards.length});
  }
  return {cases};
});
check('meadow/sky challenges progress in order, recover proof receipts and claim one regional memento', () => {
  const main = new Main({platform: memory(earnedBaseline).platform}), journey = main.journey.readOnlyView();
  const m = memory(); let c = new R5({platform: m.platform, journey}), actions = 0;
  for (const region of ['meadow', 'sky']) {
    assert(!c.claimMemento(region).ok); const stages = API.catalog.filter(x => x.region === region);
    assert(!c.startStage(stages[1].id, {seed: stages[1].seedBank[0]}).ok);
    for (const stage of stages) {
      const w = RW[stage.id][0]; assert(Host.inspectSelection({platform: m.platform, journey}, {stageId: stage.id, seed: w.seed}).ok);
      assert(c.startStage(stage.id, {seed: w.seed}).ok);
      for (const a of w.actions) { act(c, a); actions++; }
      assert(c.snapshot().result.completionRecorded); const bytes = m.bytes(); assert(c.finish().duplicate); assert.equal(m.bytes(), bytes);
      c = new R5({platform: m.platform, journey}); assert.equal(c.snapshot().progress.records[stage.id].clears, 1);
    }
    m.fault((k, value) => k === R5.PROGRESS_KEY && value.claimedRegions.includes(region) ? 'before' : null);
    assert(!c.claimMemento(region).ok); assert(!c.snapshot().progress.claimedRegions.includes(region)); m.fault(null);
    const retry = c.retrySave(); assert(retry.ok && retry.newlyGranted.length === 1);
    const bytes = m.bytes(); c = new R5({platform: m.platform, journey}); const dup = c.claimMemento(region);
    assert(dup.ok && dup.duplicate && dup.newlyGranted.length === 0); assert.equal(m.bytes(), bytes);
  }
  return {stages: 8, actions, regionalMementos: 2};
});
check('corrupt journey/checkpoint and stale concurrent writer preserve original bytes and lock regions', () => {
  let cases = 0;
  for (const key of [Main.KEY, Main.PROGRESS_KEY]) for (const data of ['{bad-json', '{"version":99}']) {
    const m = memory(earnedBaseline); m.map.set(key, data); const bytes = m.bytes(), c = new Main({platform: m.platform});
    assert(c.snapshot().readOnly); assert(c.snapshot().regions.every(x => !x.unlocked)); assert.equal(c.snapshot().rewardHandoff, null);
    assert(!c.startStage('mainline-05', {seed: 1}).ok); assert(!c.claimRegion(1).ok); assert.equal(m.bytes(), bytes); cases++;
  }
  const m = memory(prefixBaselines[4]), a = new Main({platform: m.platform}), b = new Main({platform: m.platform});
  assert(a.startStage('mainline-05', {seed: 1}).ok); const bytes = m.bytes();
  assert(!b.startStage('mainline-05', {seed: 1}).ok); assert(b.snapshot().regions.every(x => !x.unlocked)); assert.equal(m.bytes(), bytes);
  return {corruptCases: cases, staleWriterProtected: true};
});
const report = {status: 'PASS', scope: 'Node real rule engines/controllers; isolated Map persistence with injected faults. No Cocos renderer, browser, device or visual acceptance.', checks};
fs.writeFileSync(path.join(__dirname, 'test-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS ${checks.length} region-level suites`);
