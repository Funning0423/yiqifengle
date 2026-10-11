'use strict';
// Board-UI tool bar (INTEGRATION §2): at most 3 slots in priority order (星光 > 风语铃 > 潮汐瓶 > regional), no pearl,
// no permanent tool names, count badge, tap-to-arm / drag-to-cell, multitouch owner pointer, hide/late-end and empty
// stock, the three regional tools. Real ManagedMobileBoardUI on the board-ui harness (Cocos doubles, no rendering).
const assert = require('node:assert/strict');
const { createBoard } = require('./board-fixture.cjs');
const { createHarness } = require('./harness.cjs');
const checks = [];
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { checks.push(name); console.log('PASS', name); });
const SEEN = JSON.stringify(['starlight', 'windbell', 'tidebottle']);
async function board(opts = {}) {
  const H = createHarness(); H.cc.sys.localStorage.setItem('qfl.ui.seenTools', SEEN);
  const b = createBoard({ harness: H, ...opts }); await H.flush(); b.render(); b.u.update(0); return b;
}
const E = n => n.constructor.EventType;
function drag(b, slot, target, o = {}) {
  const { H, u } = b, n = u.tools[slot], id = o.id || 1, start = H.point(n), p = typeof target === 'number' ? H.point(u.cells[target]) : target;
  n.emit(E(n).TOUCH_START, H.event(start, id)); n.emit(E(n).TOUCH_MOVE, H.event(p, id));
  if (o.cancel) n.emit(E(n).TOUCH_CANCEL, H.event(p, id, 'cancel')); else n.emit(E(n).TOUCH_END, H.event(p, id));
}
(async () => {
  await ok('bar: priority order, max 3, no pearl, no permanent names, count badges; frozen for the run', async () => {
    const b = await board(), { u, s } = b;
    assert.deepEqual(u.diagnostics().toolBar, ['bomb', 'windBell', 'tideBottle']);
    assert.equal(u.tools.filter(n => n.active).length, 3);
    for (const n of u.tools) { assert(!n.find('ToolLabel'), 'no permanent tool name'); assert(!n.find('pearl')); }
    assert.deepEqual(u.tools.map(n => n.find('Quantity').getComponent(b.H.cc.Label).string), ['2', '2', '2']);
    assert(!JSON.stringify(u.diagnostics().toolBar).includes('pearl'));
    s.journey.inventory.tools.windBell = 0; s.active.actions.push(['swap', 0, 1]); b.render();
    assert.deepEqual(u.diagnostics().toolBar, ['bomb', 'windBell', 'tideBottle'], 'used-up tool keeps its slot');
    assert.equal(u.tools[1].find('Quantity').getComponent(b.H.cc.Label).string, '+');
    assert.equal(u.tools[1].find('OriginalToolArt').getComponent(b.H.cc.Sprite).grayscale, true);
    const f = await board(); f.s.journey.inventory.tools = { windBell: 0, tideBottle: 0, tideNet: 3 }; f.s.active.bombs = 0; f.s.active.attemptId = 'fresh'; f.render();
    assert.deepEqual(f.u.diagnostics().toolBar, ['tideNet'], 'only tools in stock at the start of a run');
  });
  await ok('tap arms a targeted tool (toast prompt), cell tap uses it; tapping again disarms with no cost', async () => {
    const b = await board(), { H, u, log } = b;
    H.tap(u.tools[1]); assert.equal(u.armedTool, 'windBell'); assert.equal(u.diagnostics().toast, '风语铃 · 点选目标');
    H.tap(u.tools[1]); assert.equal(u.armedTool, null); assert.equal(u.diagnostics().toast, '已收回，道具没有消耗');
    H.tap(u.tools[2]); H.tap(u.cells[24]); assert.deepEqual(log.tools, [['tideBottle', 24]]); assert.equal(u.armedTool, null);
    assert(H.audioLog.includes('tool'), 'tool tap sound');
  });
  await ok('drag to a cell uses the tool; drag outside / cancel keep it; second finger is ignored; hide/late-end cancels', async () => {
    const b = await board(), { H, u, s, log } = b, ready = () => { s.state = 'run.ready'; u.render(s); };
    drag(b, 2, 24); assert.deepEqual(log.tools, [['tideBottle', 24]]); ready();
    drag(b, 1, { x: 1, y: 1 }); assert.equal(log.tools.length, 1); assert.equal(u.diagnostics().toast, '已收回，道具没有消耗');
    drag(b, 1, 24, { cancel: true }); assert.equal(log.tools.length, 1);
    const a = u.tools[1], c = u.tools[2], target = H.point(u.cells[24]);
    a.emit(E(a).TOUCH_START, H.event(H.point(a), 7)); c.emit(E(c).TOUCH_START, H.event(H.point(c), 8)); c.emit(E(c).TOUCH_MOVE, H.event(target, 8)); c.emit(E(c).TOUCH_END, H.event(target, 8));
    assert.equal(log.tools.length, 1, 'other finger cannot finish the drag');
    a.emit(E(a).TOUCH_MOVE, H.event(target, 7)); a.emit(E(a).TOUCH_END, H.event(target, 7)); assert.deepEqual(log.tools[1], ['windBell', 24]); ready();
    a.emit(E(a).TOUCH_START, H.event(H.point(a), 9)); a.emit(E(a).TOUCH_MOVE, H.event(target, 9)); u.host.hide(); u.host.show(); a.emit(E(a).TOUCH_END, H.event(target, 9));
    assert.equal(log.tools.length, 2, 'hide cancels a drag in flight'); ready();
    const ghost = u.root.find('ToolDragGhost'); assert(ghost && !ghost.active, 'drag ghost hidden after the drag');
    s.journey.inventory.tools.windBell = 0; u.render(s); H.tap(a); assert.equal(log.tools.length, 2); assert.equal(u.armedTool, null);
    assert.equal(u.diagnostics().toast, '这件道具已用完，可从已获得的宝箱或地区礼物领取');
  });
  await ok('no tool input while paused / read-only / a popup is open', async () => {
    const b = await board(), { H, u, s, log } = b;
    s.readOnly = true; u.render(s); H.tap(u.tools[1]); assert.equal(u.armedTool, null); drag(b, 2, 24); assert.equal(log.tools.length, 0);
    s.readOnly = false; u.render(s); H.tap(u.pause); assert.equal(s.state, 'run.paused'); drag(b, 2, 24); assert.equal(log.tools.length, 0);
  });
  await ok('regional tools: one slot, tideAnchor / prismShift fire at once, sunSeed targets a cell', async () => {
    for (let region = 0; region < 3; region++) {
      const b = await board({ provider: 'regional-r05', region }), { H, u, log } = b;
      assert.equal(u.tools.filter(n => n.active).length, 1); H.tap(u.tools[0]); if (region === 1) H.tap(u.cells[17]);
      assert.deepEqual(log.tools, [[['tideAnchor', 'sunSeed', 'prismShift'][region], region === 1 ? 17 : -1]]); u.onDestroy();
    }
  });
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, scope: 'Real board-ui ManagedMobileBoardUI tool bar on Cocos memory doubles; no rendering or device touch' }));
})().catch(e => { console.error(e); process.exit(1); });
