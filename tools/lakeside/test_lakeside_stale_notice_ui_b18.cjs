'use strict';
// b18 (UI设计部 2026-10-25): the stale-board notice 「关卡已调整，从头开始」 — provider side (process-wide, in-memory, cleared once shown)
// and board side (real ManagedMobileBoardUI on the board-ui harness): shown once after presentForPlay on the board toast (plate→tray band,
// not over the goal bar / move counter), fade 0.3 s in, 2 s hold, 0.3 s out, no button / popup / touch blocker, NightTint on the toast.
const assert = require('node:assert/strict'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..'), R = ROOT + '/creator-build-project/assets/scripts/regional-r05/runtime';
const Store = require(R + '/durable-store.js'), Provider = require(R + '/board-session-provider.js');
const { createHarness } = require('../board-ui/harness.cjs');
const MainPort = require(ROOT + '/creator-build-project/assets/scripts/mainline-r1/adapter/mainline-port.js');
let n = 0; const t = async (m, f) => { await f(); n++; console.log('PASS', m); };
const TEXT = '关卡已调整，从头开始';
(async () => {
  await t('copy: 10 字, ≤ 14', () => { assert.equal(Provider.STALE_NOTICE, TEXT); assert.equal([...TEXT].length, 10); });
  await t('repairs are pooled process-wide (any Store may load first) and cleared by clearNotice', () => {
    Store.clearRepairs();
    const mem = new Map([['k', '"bad"']]), plat = { load: k => mem.has(k) ? mem.get(k) : null, save: (k, v) => mem.set(k, JSON.stringify(v)) };
    const s = new Store(plat, 'k', v => { if (v === 'bad') throw Error('x'); }, () => ({ value: null, dropped: [{ stageId: 'r04-lake-02' }] }));
    assert.deepEqual(Store.pendingRepairs(), [{ stageId: 'r04-lake-02' }]); assert.deepEqual(s.repaired, [{ stageId: 'r04-lake-02' }]);
    const fake = { staleNotice: { text: TEXT } }; Provider.prototype.clearNotice.call(fake); assert.equal(fake.staleNotice, null); assert.deepEqual(Store.pendingRepairs(), []); });
  const H = createHarness(), values = new Map(), store = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, String(v)) };
  H.cc.sys.localStorage.setItem('qfl.ui.seenTools', JSON.stringify(['starlight', 'windbell', 'tidebottle']));
  const port = MainPort.createPort(store), c = port.createController();
  const { createManagedMainlineBinding } = H.load('world-r2/ManagedMainlineBinding'), { ManagedMobileBoardUI } = H.load('ManagedMobileBoardUI');
  const make = async deferred => { const u = new ManagedMobileBoardUI(); u.node = new H.cc.Node('owner'); u.node.components.push(u); H.cc._scene.addChild(u.node);
    if (deferred) u.deferPresentation = true;
    const b = createManagedMainlineBinding(port, c, { exit: () => ({ ok: true }), resume: () => undefined }); let cleared = 0; b.clearNotice = () => { cleared++; };
    u.initializeManaged({}, b); await H.flush(); if (!c.snapshot().active) assert(u.host.command('startStage', 'mainline-01', { seed: 1 }).ok);
    const real = () => u.snapshot; return { u, cleared: () => cleared, withNotice: (stageIds) => { const s = Object.assign({}, real(), { state: 'run.ready', notice: { text: TEXT, stageIds: stageIds || [real().active.stageId] } }); u.snapshot = s; return s; } }; };
  const op = u => u.toast.getComponent(H.cc.UIOpacity).opacity;
  await t('board: once, 0.3 s in / 2 s hold / 0.3 s out, flag cleared at once, never again; toast has no input blocker', async () => {
    const { u, cleared, withNotice } = await make(false); withNotice();
    u.update(0); assert.equal(u.toastLabel.string, TEXT); assert.equal(cleared(), 1, 'cleared immediately');
    u.update(0.15); assert(Math.abs(op(u) - Math.round(255 * 0.5)) <= 1, 'half way through the 0.3 s fade-in: ' + op(u));
    u.update(0.2); assert.equal(op(u), 255); u.update(1.9); assert.equal(op(u), 255, 'still holding at 2.25 s');
    u.update(0.04); assert.equal(op(u), 255, 'hold until 2.3 s'); u.update(0.15); assert(op(u) > 0 && op(u) < 255, 'fading out');
    u.update(0.2); assert.equal(op(u), 0); assert.equal(u.toastT, -1);
    withNotice(); for (let i = 0; i < 5; i++) u.update(0.5); assert.equal(cleared(), 1, 'once per run'); assert.equal(op(u), 0);
    const all = (x, o = []) => { o.push(x); for (const ch of x.children) all(ch, o); return o; };
    assert(!all(u.toast).some(x => (x.components || []).some(k => /BlockInput|Button/.test(k?.constructor?.name || ''))), 'no blocker / button');
    assert.equal(u.popups.any(), false, 'no popup'); });
  await t('board: not before presentForPlay (entry shot + transition), not for another stage, not under a modal', async () => {
    const { u, cleared, withNotice } = await make(true); withNotice(); for (let i = 0; i < 3; i++) u.update(0.2); assert.equal(cleared(), 0, 'hidden before present');
    withNotice(['some-other-stage']); u.presented = true; u.update(0.1); assert.equal(cleared(), 0, 'other stage');
    withNotice(); u.update(0.1); assert.equal(cleared(), 1); assert.equal(u.toastLabel.string, TEXT); });
  await t('priority: a tool tip during the notice waits — notice stays (text + timing), tip shown after it fades', async () => {
    const { u, withNotice } = await make(false); withNotice(); u.update(0); assert.equal(u.toastLabel.string, TEXT);
    u.update(1); u.say('选一个棋子'); assert.equal(u.toastLabel.string, TEXT, 'not replaced'); assert.equal(op(u), 255);
    u.say('点一下要敲掉的棋子'); u.armedTool = null; u.update(0.5); assert.equal(u.toastLabel.string, TEXT); assert.equal(op(u), 255, 'not cut short');
    u.update(0.79); assert.equal(u.toastLabel.string, TEXT); u.update(0.4); // 2.69 s: notice gone → queued tip (latest) starts
    assert.equal(u.toastLabel.string, '点一下要敲掉的棋子'); assert.equal(u.toastT, 0); u.update(0.1); assert(op(u) > 0);
    u.say('另一条'); assert.equal(u.toastLabel.string, '另一条', 'normal tips replace each other again'); });
  await t('position + night: the notice uses the shared Toast (BoardLayout.toast band, under the plate, over the tray) with tint', async () => {
    const { u } = await make(false); const g = u.geo; assert(g && g.toast, 'layout');
    const plateB = g.plate.y + g.plate.height / 2, trayT = g.tray.y - g.tray.height / 2, top = g.toast.y - g.toast.height / 2, bot = g.toast.y + g.toast.height / 2;
    assert(top >= plateB - 1e-6, 'below the info plate (goals + moves)'); assert(bot <= trayT + 1e-6, 'above the tray');
    const src = require('node:fs').readFileSync(ROOT + '/creator-build-project/assets/scripts/ManagedMobileBoardUI.ts', 'utf8');
    assert.match(src, /this\.tint\.label\(this\.toastLabel, 'brown'\)/); assert.match(src, /paintToast[^\n]*this\.tint\.weight\(\)/);
    assert.match(src, /this\.say\(String\(s\.notice\.text\), 0\.3\)/); });
  console.log('lakeside-stale-notice-ui-b18', n, 'PASS');
})().catch(e => { console.error(e); process.exit(1); });
