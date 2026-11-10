'use strict';
/* COAST01 candidate only. Does not play r06-coast-02..09 and does not claim a win rate.
 * Compatibility matrix is printed at the end; each assert cites the runtime it actually executed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const R = path.join(ROOT, 'creator-build-project/assets/scripts/regional-r05/runtime');
const SCRIPTS = path.join(ROOT, 'creator-build-project/assets/scripts');

function mem() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
function journey(done) {
  return { readOnly: false, records: Array.from({ length: 12 }, (_, i) => ({ bestStars: i < done ? 2 : 0 })) };
}

const missingLegacy = [
  'src/commonr2/x/fixed/shared/coastal-content.js',
  'tools/coast/coastal-content.js',
].filter((p) => !fs.existsSync(path.join(ROOT, p)));
assert.equal(missingLegacy.length, 2, 'legacy coastal-content.js must stay absent');
assert.equal(fs.existsSync(path.join(ROOT, 'creator-build-project/assets/bundles/region_coast/models/coast_board.glb')), true, 'asset bytes are present');
assert.equal(fs.existsSync(path.join(ROOT, 'creator-build-project/assets/bundles/region_coast/models/coast_board.glb.meta')), true, 'Creator-generated meta present (scene/coast01-creator-import)');

const API = require(path.join(R, 'index.js'));
const Journal = require(path.join(R, 'progress-journal.js'));
const Host = require(path.join(R, 'campaign-host.js'));
const Engine = require(path.join(SCRIPTS, 'r4-cloud-compat/runtime/engine.js'));
const catalog = require(path.join(R, 'catalog-data.js'));

assert.equal(API.catalog.filter((s) => s.region === 'coast').length, 0, 'shipped catalog has no coast rows');
assert.equal(API.catalog.filter((s) => s.region === 'lake').length, 6, 'lake catalog unchanged');
assert.deepEqual(API.coastPlayable.map((s) => s.id).slice(0, 1), ['r06-coast-01']);
assert.ok(API.coastPlayable.length >= 7, 'M3 registers COAST06/07');
assert.equal(API.coastPlayable[0].config.moves, 19);
assert.deepEqual(API.coastPlayable[0].seedBank, [22, 9, 13]);
assert.equal(API.getStage('r06-coast-01').name, '寄给海风');
assert.ok(API.getStage('r06-coast-02'));
assert.ok(API.getStage('r06-coast-03'));
assert.ok(API.getStage('r06-coast-04'));
assert.ok(API.getStage('r06-coast-05'));
assert.ok(API.getStage('r06-coast-06'));
assert.ok(API.getStage('r06-coast-07'));
for (let n = 8; n <= 9; n++) assert.equal(API.getStage('r06-coast-0' + n), null, 'coast-0' + n + ' not live');
assert.equal(API.getStage('restaurant'), null);

const tide = catalog.find((s) => s.id === 'r05-tide-01');
assert.ok(tide.rules.shells.every((p) => Number.isInteger(p.index) && Number.isInteger(p.layers)), 'shipped tide schema is shells{index,layers}');
const c1 = API.getStage('r06-coast-01');
assert.deepEqual(c1.rules, {}, 'COAST01 does not use shells');
assert.deepEqual(c1.config.goals, { type5: 18 });
assert.equal(c1.config.moves, 19);
assert.equal(c1.legacyMoves, 26);
assert.equal(c1.calibration.status, 'draft-moves-untested');
assert.equal(c1.tool, null);
assert.equal(JSON.stringify(c1).includes('randomWin'), false, 'no shipped win rate');

const lake = API.createSession('r04-lake-01', 4);
assert.equal(lake.snapshot().region, 'lake');
assert.equal(lake._coastAlias, undefined, 'lake session is not the coast alias');

delete globalThis.__qfCoastBoardKit;
delete globalThis.location;
const s0 = API.createSession('r06-coast-01', 22);
const shot = s0.snapshot();
assert.equal(shot.region, 'coast');
assert.equal(shot.goals.type5, 18);
assert.equal(shot.goals.pearls, undefined, 'empty tide shells must not add a pearl goal');
assert.equal(shot.moves, 19);
assert.equal(shot.tool.kind, null);
assert.equal(shot.guide.goalName, '贝壳');
assert.equal(shot.guide.rule.includes('灯标'), false, 'COAST01 guide is not the beacon rule');
assert.equal(s0.engine.status, 'playing');
const first = s0.legalActions({ tools: false })[0];
assert.ok(first, 'COAST01 has a legal action');
assert.equal(s0.act(first), true);
assert.ok(s0.engine.moves < 19, 'a committed action spends a move');
assert.notEqual(s0.engine.status, undefined);
const cp = s0.checkpoint();
const back = API.restore(cp);
assert.equal(back.engine.moves, s0.engine.moves);
assert.equal(back.snapshot().region, 'coast');
assert.equal(back.engine.goals.type5, s0.engine.goals.type5);

const pers = (done) => Host.createPersistence(mem(), journey(done));
assert.equal(Host.inspectSelection(pers(11), { stageId: 'r06-coast-01', seed: 22 }).reason, 'stage-locked');
assert.deepEqual(Host.inspectSelection(pers(12), { stageId: 'r06-coast-01', seed: 22 }), { ok: true, resume: false });
assert.equal(Host.inspectSelection(pers(12), { stageId: 'r06-coast-02', seed: 22 }).reason, 'unverified-r5-stage-or-seed');
assert.equal(Host.inspectSelection(pers(12), { stageId: 'r06-coast-09', seed: 16 }).reason, 'unverified-r5-stage-or-seed');
const Provider = require(path.join(R, 'board-session-provider.js'));
const SOLVE = [['swap', 15, 22], ['swap', 2, 9], ['swap', 3, 4], ['swap', 25, 26], ['swap', 18, 19]];
function greedy(seed) {
  const s = API.createSession('r06-coast-01', seed);
  const actions = [];
  while (s.engine.status === 'playing' && actions.length < s.stage.config.moves) {
    let best = null, bv = 1e9;
    for (const a of s.legalActions({ tools: false })) {
      const f = s.fork(); if (!f._act(a)) continue;
      const v = f.engine.status === 'won' ? -1 : (f.engine.goals.type5 ?? 99);
      if (v < bv) { bv = v; best = a; }
    }
    if (!best || !s.act(best)) break;
    actions.push(best);
  }
  return { status: s.engine.status, moves: s.engine.moves, type5: s.engine.goals.type5, actions };
}
const solved = greedy(22);
assert.equal(solved.status, 'won', 'one legal greedy solve of the untouched stage');
assert.deepEqual(solved.actions, SOLVE);
assert.equal(solved.moves, 14);
assert.equal(solved.type5, 0);
assert.equal(solved.actions.length, 5);
const replay = API.createSession('r06-coast-01', 22);
for (const a of SOLVE) assert.equal(replay.act(a), true);
assert.equal(replay.engine.status, 'won');
assert.equal(API.restore(replay.checkpoint()).engine.status, 'won');
const storage = Host.createStorage(mem());
const started = new Provider({ platform: storage, journey: journey(12), stageId: 'r06-coast-01', seed: 22 });
assert.equal(started.session.stage.id, 'r06-coast-01');
assert.equal(started.snapshot().regions.includes('coast'), false, 'chapter region list stays tide/meadow/sky/lake');
function drain(p) { let g = 0; while (p.snapshot().state === 'run.resolving' && g++ < 40) { const v = p.snapshot().visual; assert.ok(v); assert.equal(p.finishVisualStep(v.token).ok, true); } }
for (const a of SOLVE) {
  drain(started);
  if (started.snapshot().state === 'run.paused') started.resume();
  const prev = started.previewAction(a);
  assert.equal(prev.ok, true, prev.reason);
  assert.equal(started.commitAction(prev.token).ok, true);
}
drain(started);
const saved = started.snapshot();
assert.equal(saved.state, 'result.saved');
assert.equal(saved.result.outcome, 'won');
assert.equal(saved.result.completionRecorded, true);
assert.equal(saved.result.firstClear, true);
const journal = new Journal(storage, journey(12));
assert.equal(journal.data.records['r06-coast-01'].clears, 1);
assert.equal(journal.data.records['r06-coast-01'].bestMoves, 14);
assert.equal(started.requestExit().ok, true);
assert.equal(new Journal(storage, journey(12)).data.records['r06-coast-01'].clears, 1);
const dropped = started.discardActive();
assert.equal(dropped.ok, true, dropped.reason || '');
assert.equal(started.session, null, 'leaving the saved board drops the live attempt');
const re = started.startStage('r06-coast-01', { seed: 22 });
assert.equal(re.ok, true, re.reason || '');
assert.equal(started.session.engine.status, 'playing');
assert.equal(started.session.engine.moves, 19, 'the registered budget is 19 after m1b retune');
assert.equal(new Journal(storage, journey(12)).data.records['r06-coast-01'].clears, 1, 'the saved clear survives the fresh entry');
const j = new Journal(Host.createStorage(mem()), journey(12));
assert.equal(j.claim('coast').reason, 'region-incomplete');
assert.equal(j.claim('lake').reason, 'region-incomplete');

assert.equal(API.getStage('r06-coast-01').calibration.status, 'draft-moves-untested');
assert.equal(c1.config.moves, 19);
assert.equal(c1.legacyMoves, 26);

// Beacon semantics on the shipped engine, not on a shipped coast-09 stage.
const draft = [8, 24, 12, 24, 40];
const uniqueAlt = [8, 24, 12, 25, 40];
assert.equal(API.getStage('r06-coast-09'), null, 'COAST09 is not registered yet');
assert.ok(API.coastPlayable.some((st) => Array.isArray(st.config.beacons) && st.config.beacons.length), 'COAST02 beacon lesson is registered');
function beaconEngine(route) {
  return new Engine(0, () => 0.17, { moves: 30, goals: { beacons: route.length }, moss: [], roots: [], beacons: route.slice() });
}
const eng = beaconEngine(draft);
assert.deepEqual(eng.beaconRoute, draft, 'engine keeps a repeated index; it does not unique the route');
assert.equal(eng.beaconTarget().index, 8);
let plan = eng._buildPlan(new Set([8, 24, 12, 40]), [], [], [], 'probe');
assert.equal(plan.beaconHit, 8, 'one beacon per wave even if the blast covers later route cells');
assert.equal(eng.clearWave(plan).beaconHit, 8);
assert.equal(eng.beaconCursor, 1);
assert.equal(eng.beaconTarget().index, 24);
plan = eng._buildPlan(new Set([24, 12]), [], [], [], 'probe');
assert.equal(plan.beaconHit, 24);
eng.clearWave(plan);
assert.equal(eng.beaconCursor, 2);
assert.equal(eng.beaconTarget().index, 12);
plan = eng._buildPlan(new Set([12]), [], [], [], 'probe');
eng.clearWave(plan);
assert.equal(eng.beaconTarget().index, 24, 'the second route entry 24 is visited only after the cursor reaches it');
plan = eng._buildPlan(new Set([24]), [], [], [], 'probe');
eng.clearWave(plan);
assert.equal(eng.beaconTarget().index, 40);
const alt = beaconEngine(uniqueAlt);
assert.equal(alt.beaconRoute.length, 5);
assert.equal(new Set(alt.beaconRoute).size, 5);
assert.equal(API.getStage('r06-coast-09'), null, 'unique-index alternative is not a shipped level');

const toolsSrc = fs.readFileSync(path.join(SCRIPTS, 'world-r2/ManagedTools.ts'), 'utf8');
assert.equal(toolsSrc.includes('退潮铃'), false);
assert.equal(toolsSrc.includes('tideAnchor'), true, 'shipped regional tool name is 潮汐锚');
assert.equal(fs.readFileSync(path.join(R, 'rule-guide.js'), 'utf8').includes('退潮铃'), false);
assert.equal(fs.existsSync(path.join(ROOT, 'tools/coast-scene/build_coast.py')), false, '退潮铃 prop script is not in this tree');

const art = fs.readFileSync(path.join(SCRIPTS, 'ui/BoardArt.ts'), 'utf8');
assert.match(art, /piece_strawberry.*piece_leaf.*piece_blueberry.*piece_flower.*piece_acorn.*piece_shell/s);
const kitSrc = fs.readFileSync(path.join(SCRIPTS, 'ui/BoardKit.ts'), 'utf8');
assert.match(kitSrc, /\['conch', 'star', 'coral', 'float', 'scallop', 'badge'\]\.map\(n => 'board\/piece_' \+ n\)/);
assert.match(kitSrc, /anchor: \[-0\.6, -0\.845, 21\.5\]/);

const { createHarness } = require('../board-ui/harness.cjs');
const { createBoard, snapshot } = require('../board-ui/board-fixture.cjs');
function freshBoard(on, region) {
  const H = createHarness();
  if (on === false) { globalThis.__qfCoastBoardKit = false; globalThis.location = { search: '?qfcoastkit=0' }; }
  else { delete globalThis.__qfCoastBoardKit; delete globalThis.location; }
  const snap = snapshot('regional-r05', 1);
  snap.active.region = region;
  snap.active.goals = { type5: 18 };
  snap.active.goalOrder = ['type5'];
  const b = createBoard({ harness: H, provider: 'regional-r05', snapshot: snap, width: 390, height: 844 });
  return { H, b };
}
(async () => {
  const errors = [];
  const orig = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); orig.apply(console, a); };
  {
    const { H, b } = freshBoard(true, 'coast');
    b.render(); await H.flush();
    const K = H.load('ui/BoardKit'), B = H.load('ui/BoardProjection');
    assert.equal(B.coastBoardKitFromFlag(), true, 'default ON');
    assert.equal(K.boardKitFor('coast').id, 'coast');
    assert.equal(K.boardKitFor('restaurant').id, 'default');
    assert.equal(b.u.boardFrame.getChildByName('Tray').active, false, 'tray hidden on the projected surface');
    assert.ok(b.u.kitGridCache && b.u.kitGridCache.projected);
    const pb = B.projectBoard(K.COAST_KIT, 390, 844);
    assert.equal(b.u.cellAt(pb.centers[24].x, pb.centers[24].y, true), 24);
    assert.equal(b.u.cellAt(pb.centers[0].x, pb.centers[0].y, true), 0);
    const shell = H.load('ui/BoardArt').BoardArt.shared().frame('board/piece_shell');
    assert.ok(shell, 'default shell frame loaded');
    assert.equal(b.u.cells[5].getChildByName('ProjectPieceArt').getComponent(H.cc.Sprite).spriteFrame, shell, 'kit ON type5 tile is the shell');
    assert.equal(b.u.goalNodes[0].getChildByName('GoalPieceArt').getComponent(H.cc.Sprite).spriteFrame, shell, 'kit ON goal icon is the shell');
    assert.equal(K.coastObjectiveKey(5), 'board/piece_shell');
    assert.equal(K.kitGoalArt(K.COAST_KIT, 'type5', {}), 'board/piece_shell');
    assert.equal(K.COAST_KIT.pieceKeys[5], 'board/piece_badge', 'historical slot 5 stays badge; it is not the objective');
    assert.deepEqual(K.COAST_KIT.pieceKeys.slice(0, 5), ['board/piece_conch', 'board/piece_star', 'board/piece_coral', 'board/piece_float', 'board/piece_scallop']);
    const root = { position: [-0.6, -0.845, 21.5], yawDeg: 180, scale: 1 };
    const yaw = root.yawDeg * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
    const world = (p) => [root.position[0] + (c * p[0] + s * p[2]), root.position[1] + p[1], root.position[2] + (-s * p[0] + c * p[2])];
    const centre = world([0, 0, 0]);
    const tile = K.kitTileWorld(K.COAST_KIT, 24);
    assert.ok(Math.abs(centre[0] + 0.6) < 1e-9 && Math.abs(centre[1] + 0.845) < 1e-9 && Math.abs(centre[2] - 21.5) < 1e-9, 'board centre world is the layout root, not y=-0.6');
    assert.ok(Math.abs(tile[0] - centre[0]) < 1e-9 && Math.abs(tile[2] - centre[2]) < 1e-9);
    assert.ok(Math.abs(tile[1] - (centre[1] + K.COAST_KIT.board.topY)) < 1e-9);
    assert.ok(Math.abs(tile[1] + 0.725) < 1e-9);
    assert.notEqual(tile[1], -0.6);
    const walk = world([0, 0.6, 12.1]);
    assert.ok(Math.abs(walk[1] + 0.245) < 1e-9, 'S0 local y 0.6 is a walk point, not the slab');
    const Pieces = H.load('ui/CoastBoardPieces');
    const ctx = { parent: new H.cc.Node('coast-parent'), selection: { provider: 'r5', stageId: 'r06-coast-01' }, token: { check() {}, wait: (p) => p, onCancel() { return () => {}; }, cancelled: false } };
    delete globalThis.__qfCoastBoardKit; delete globalThis.location;
    await assert.rejects(() => Pieces.createCoastBoardBackground(ctx), (e) => e instanceof Pieces.CoastEntryRejected && e.reason === 'coast-resources-unavailable');
    assert.equal(ctx.parent.children.length, 0);
    globalThis.__qfCoastBoardKit = false; globalThis.location = { search: '?qfcoastkit=0' };
    // kit off = the pre-kit look: the 2D tray on the island board picture (never a coast scene mount).
    let kitOffLease = null; try { kitOffLease = await Pieces.createCoastBoardBackground(ctx); } catch (e) { assert.ok(!(e instanceof Pieces.CoastEntryRejected), 'kit off never rejects as a coast entry: ' + String(e && e.reason)); }
    if (kitOffLease && kitOffLease.dispose) kitOffLease.dispose();
    assert.equal(ctx.parent.getChildByName('CoastLiveScene'), null, 'kit off never mounts the coast scene');
    assert.ok(errors.some((line) => line.includes('[QF_COAST]') && line.includes('"kitOn":true') && line.includes('"engineLoaded":false')), errors.join('\n'));
    assert.ok(errors.some((line) => line.includes('[QF_COAST]') && line.includes('kit-off: coast scene not mounted')), errors.join('\n'));
    assert.ok(errors.some((line) => line.includes('missing data/coast_layout')), 'harness assetManager does not import the layout');
    const ui = fs.readFileSync(path.join(SCRIPTS, 'ManagedMobileBoardUI.ts'), 'utf8');
    const init = ui.indexOf('initializeManaged');
    const lakeFlag = ui.indexOf('lakesideBoardKitFromFlag()', init);
    const coastFlag = ui.indexOf('coastBoardKitFromFlag()', init);
    const initCall = ui.indexOf('this.initialize(fixture', init);
    assert.ok(lakeFlag > init && coastFlag > lakeFlag && coastFlag < initCall, 'both flags run before board initialize');
    const coastBg = fs.readFileSync(path.join(SCRIPTS, 'ui/CoastBoardPieces.ts'), 'utf8');
    const fn = coastBg.indexOf('export const createCoastBoardBackground');
    const flagAt = coastBg.indexOf('coastBoardKitFromFlag()', fn);
    const body = coastBg.slice(fn);
    assert.ok(fn > 0 && flagAt > fn, 'coast background reads the flag first');
    const islandUses = body.split('\n').filter((l) => l.includes('createIslandBoardBackground'));
    assert.ok(islandUses.length === 1 && islandUses[0].includes('if (!on)'), 'only an explicit kit-off uses the island picture; a missing coast scene does not become it');
    assert.equal(body.includes('coast-kit-projected'), false);
    const wnc = fs.readFileSync(path.join(SCRIPTS, 'world-r2/WorldNativeComposition.ts'), 'utf8');
    assert.ok(wnc.indexOf('requiresCoastScene(context.selection)?createCoastBoardBackground') < wnc.indexOf('requiresMeadowScene(context.selection)?meadowBoardWithGuest'), 'coast background is chosen before the island/meadow fallback');
    assert.ok(wnc.includes("getStage('r06-coast-01')"), 'enterRegion(coast) resolves COAST01 without adding it to catalog');
    const sel = wnc.slice(wnc.indexOf('private selectionRegion'), wnc.indexOf('private async ensureRegion'));
    assert.ok(!sel.includes("'coast'"), 'selectionRegion has no coast arm; r06-coast-01 stays island');
    const keys = H.load('world-r2/PreTransitionKeys');
    assert.equal(keys.preTransitionKey('?qfPre=coast-dev', {}), 'coast-dev');
    assert.equal(keys.preTransitionKey('?qfPre=coast-dev', { wx: { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }) } }), null, 'formal/release build does not open the dev entry');
    const keySrc = fs.readFileSync(path.join(SCRIPTS, 'world-r2/PreTransitionKeys.ts'), 'utf8');
    const at = keySrc.indexOf("key:'coast-dev'");
    assert.ok(at > keySrc.lastIndexOf('/*QF_TRIAL_BEGIN*/', at) && at < keySrc.indexOf('/*QF_TRIAL_END*/', at), 'coast-01 lives in the stripped trial region');
    const runSrc = fs.readFileSync(path.join(SCRIPTS, 'world-r2/PreTransitionRun.ts'), 'utf8');
    const runAt = runSrc.indexOf("spec.key==='coast-dev'");
    assert.ok(runAt > 0 && runSrc.includes("enterRegion('coast')"));
    assert.equal(keys.preSpec('coast-dev').stage, 'r06-coast-01');
    const reg = API.getStage('r06-coast-01');
    assert.equal(keys.preSpec('coast-dev').stage, reg.id);
    assert.equal(reg.config.moves, 19);
    assert.equal(reg.config.goals.type5, 18);
    assert.ok(reg.seedBank.includes(22));
    assert.ok(runAt > runSrc.lastIndexOf('/*QF_TRIAL_BEGIN*/', runAt) && runAt < runSrc.indexOf('/*QF_TRIAL_END*/', runAt));
    const os = require('node:os'), cp = require('node:child_process');
    const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coast-formal-'));
    const destScripts = path.join(stageDir, 'assets/scripts/world-r2');
    fs.mkdirSync(destScripts, { recursive: true });
    for (const name of ['PreTransitionKeys.ts', 'PreTransitionRun.ts', 'QaSkip.ts']) fs.copyFileSync(path.join(SCRIPTS, 'world-r2', name), path.join(destScripts, name));
    const strip = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools/build-guard/strip-probes.cjs'), '--stage', stageDir, '--formal'], { encoding: 'utf8' });
    assert.equal(strip.status, 0, strip.stdout + strip.stderr);
    const strippedKeys = fs.readFileSync(path.join(destScripts, 'PreTransitionKeys.ts'), 'utf8');
    const strippedRun = fs.readFileSync(path.join(destScripts, 'PreTransitionRun.ts'), 'utf8');
    assert.equal(strippedKeys.includes('coast-dev'), false);
    assert.equal(strippedRun.includes('coast-dev'), false);
    assert.equal(strippedRun.includes("enterRegion('coast')"), false);
    assert.equal(strippedRun.includes('dev-enter-coast01'), false);
    assert.equal(strippedKeys.includes('r06-coast-01'), false);
    assert.equal(strippedRun.includes('PreTransitionRunner'), false);
    assert.equal(strippedRun.includes('__qfPreTransition'), false);
    assert.equal(strippedKeys.includes('preTransitionKey'), false);
    assert.equal(strippedKeys.includes('QF_TRIAL'), false);
    assert.equal(strippedRun.includes('QF_TRIAL'), false);
    const ts = require(process.env.QF_TYPESCRIPT_MODULE);
    for (const text of [strippedKeys, strippedRun]) {
      const out = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
      assert.ok(out.outputText.length > 0);
      assert.equal(out.outputText.includes('coast-dev'), false);
    }
    fs.rmSync(stageDir, { recursive: true, force: true });
    const level = fs.readFileSync(path.join(SCRIPTS, 'world-r2/LevelRegion.ts'), 'utf8');
    assert.match(level, /r06-coast-0\[1-9\]/);
  }
  {
    errors.length = 0;
    const off = freshBoard(false, 'coast');
    off.b.render();
    assert.equal(off.b.u.boardFrame.getChildByName('Tray').active, true, 'explicit OFF keeps the 2D tray');
    assert.equal(off.b.u.kitGridCache, null);
    const shellOff = off.H.load('ui/BoardArt').BoardArt.shared().frame('board/piece_shell');
    assert.equal(off.b.u.cells[5].getChildByName('ProjectPieceArt').getComponent(off.H.cc.Sprite).spriteFrame, shellOff, 'kit OFF type5 tile is the shell');
    assert.equal(off.b.u.goalNodes[0].getChildByName('GoalPieceArt').getComponent(off.H.cc.Sprite).spriteFrame, shellOff, 'kit OFF goal icon is the shell');
  }
  {
    const H = createHarness();
    delete globalThis.__qfCoastBoardKit; delete globalThis.location;
    const B = H.load('ui/BoardProjection');
    globalThis.__qfLakesideBoardKit = undefined;
    delete globalThis.__qfLakesideBoardKit;
    assert.equal(B.lakesideBoardKitFromFlag(), true, 'lakeside trial default stays ON');
    globalThis.location = { search: '?qflakesidekit=0' };
    assert.equal(B.lakesideBoardKitFromFlag(), false, 'lakeside explicit OFF still works');
    delete globalThis.location;
    globalThis.__qfCoastBoardKit = true;
    globalThis.location = { search: '?qfcoastkit=0' };
    assert.equal(B.coastBoardKitFromFlag(), false, 'query 0 overrides global true');
    delete globalThis.__qfCoastBoardKit;
    globalThis.location = { search: '?qfcoastkit=1&qflakesidekit=0' };
    assert.equal(B.coastBoardKitFromFlag(), true);
    assert.equal(B.lakesideBoardKitFromFlag(), false);
  }
  console.error = orig;
  const matrix = {
    legacyFile: 'missing src/commonr2/x/fixed/shared/coastal-content.js',
    liveStage: 'r06-coast-01..07 on coastPlayable; catalog coast count 0; r06-coast-08..09 not getStage',
    type5: 'objective and both kit states render board/piece_shell. Historical pieceKeys[5] remains board/piece_badge and is not the goal. Slots 0..4 were not reordered',
    beacon: 'one current cell per wave (engine.js beaconHit); repeat index 24 advances only when the cursor reaches that entry',
    coast09: 'draft [8,24,12,24,40] is supported by the engine and is not shipped; unique alternative [8,24,12,25,40] is not shipped',
    schema: 'tide ships rules.shells{index,layers}; COAST01 ships config.goals/moss/roots and rules {}',
    tideBell: '退潮铃 is not a tool; coast tool is null; 潮汐锚 remains the tide tool',
    kitVsLevel: 'coastBoardKitFromFlag default ON is not coastPlayable; explicit ?qfcoastkit=0 keeps the 2D tray',
    surface: 'measured board centre world [-0.6,-0.845,21.5]; tile centre Y -0.725 (topY 0.12); -0.6 is world X; S0 is not the slab',
    resources: '14 asset bytes from f9c5656a export are on disk; 14+5+2 metas generated by Creator 3.8.8; engine load checked on device builds, not here',
    moves: '19 after m1b random-play retune (legacyMoves 26 kept); goals/seed unchanged',
  };
  console.log('coast01-candidate: PASS');
  console.log(JSON.stringify(matrix, null, 2));
})().catch((e) => { console.error('FAIL', e && e.stack || e); process.exit(1); });
