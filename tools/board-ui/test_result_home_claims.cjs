'use strict';
// Audit b0020ed HIGH: 回小岛 before opening the chest must persist the claims before leaving.
// MEDIUM: the result screen never opens a RewardPanel. Runs the real ManagedMobileBoardUI + the real enqueueResultBatch.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const ts = require('../qf-env.cjs').typescript();
const { createHarness } = require('./harness.cjs');
const { createBoard, snapshot } = require('./board-fixture.cjs');
const src = fs.readFileSync(path.join(ROOT, 'creator-build-project/assets/scripts/WorldIntegrationBoot.ts'), 'utf8');
const a = src.indexOf('function enqueueResultBatch'), b = src.indexOf('/** end enqueueResultBatch */');
const enqueueResultBatch = new Function(ts.transpileModule(src.slice(a, b), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText + '\nreturn enqueueResultBatch;')();
assert(/actions\.afterClaims=/.test(src), 'host hands the board an afterClaims hook');
const delay = ms => new Promise(r => setTimeout(r, ms));
function reveal(p, name) { const n = p.root.find(name); let x = n; while (x) { x.active = true; x = x.parent; } return n; }
(async () => {
  const H = createHarness();
  H.cc.sys.localStorage.setItem('qfl.ui.seenTools', '["starlight","windbell","tidebottle","tidenet"]');
  const s = snapshot(); s.state = 'result.saved'; s.active.status = 'won';
  s.journey.chests = [{ level: 0, earned: true, opened: false }]; s.journey.regionRewards = [{ region: 0, unlocked: true, claimed: false }];
  const bd = createBoard({ width: 390, height: 844, harness: H, snapshot: s }); await H.flush();
  // Host double: the save is a durable record; the session is gone after exit, so a late claim is rejected (the bug).
  const save = { opened: false, region: false, tideNet: 0 }; let session = true; const order = [];
  let busy = false; const invoke = async fn => { if (busy) return; busy = true; try { await fn(); } finally { busy = false; } };
  const enqueue = enqueueResultBatch(run => { void invoke(run); });
  const claim = (key, fn) => () => enqueue(async () => { await delay(5); if (!session) { order.push(key + ':rejected'); return { ok: false, reason: 'not-mainline' }; } fn(); order.push(key + ':saved'); return { ok: true }; });
  bd.u.setHostActions({
    chest: { visible: true, run: claim('chest', () => { save.opened = true; s.journey.chests[0].opened = true; }) },
    regionReward: { visible: true, run: claim('region', () => { save.region = true; save.tideNet += 1; s.journey.regionRewards[0].claimed = true; }) },
    afterClaims: { visible: true, run: then => enqueue(() => then()) },
  });
  const realCommand = bd.u.command.bind(bd.u);
  bd.u.command = (name, ...args) => { if (name === 'requestExit') { order.push('exit'); session = false; return { ok: true }; } return realCommand(name, ...args); };
  bd.render(); bd.step(1);
  const p = bd.u.popups.find('ResultPanel'); assert(p, 'result panel up');
  H.tap(reveal(p, 'Home'));
  await delay(60); await H.flush(); bd.render(); bd.step(1);
  assert.deepEqual(order, ['chest:saved', 'region:saved', 'exit'], '回小岛 claims are written before leaving');
  assert.deepEqual(save, { opened: true, region: true, tideNet: 1 }, 'save + inventory persisted on the 回小岛 path');
  assert(!bd.u.popups.find('RewardPanel'), 'no RewardPanel after leaving via 回小岛');
  // Chest tap on a fresh result: rewards change while the result is up -> still no RewardPanel.
  const s2 = snapshot(); s2.state = 'result.saved'; s2.active.status = 'won'; s2.journey.chests = [{ level: 0, earned: true, opened: false }];
  const b2 = createBoard({ width: 390, height: 844, harness: H, snapshot: s2 }); await H.flush();
  b2.u.setHostActions({ chest: { visible: true, run: () => Promise.resolve().then(() => { s2.journey.chests[0].opened = true; s2.journey.inventory.tools.windBell = (s2.journey.inventory.tools.windBell || 0) + 1; b2.render(); }) } });
  b2.render(); b2.step(1);
  for (let i = 0; i < 5; i++) { const q = b2.u.popups.find('ResultPanel'); const t = q && q.root.find('ResultChestTap'); if (t) H.tap(reveal(q, 'ResultChestTap')); await H.flush(); b2.step(0.5); assert(!b2.u.popups.names().includes('RewardPanel'), 'RewardPanel never opened on the result screen (' + i + ')'); }
  assert(s2.journey.chests[0].opened, 'chest claimed');
  console.log(JSON.stringify({ status: 'PASS', checks: ['home claims persisted before exit', 'no RewardPanel on result'] }));
})().catch(e => { console.error(e); process.exitCode = 1; });
