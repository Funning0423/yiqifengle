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
  await ok('regional reward art: tideNet / sunSeed / starShears use the r2 slices; mainline stays on the square board slices', async () => {
    const b = await board(), { H, u } = b, Art = H.load('ui/BoardArt'), lib = Art.BoardArt.shared();
    const bomb = u.tools[0].find('OriginalToolArt'), bombUi = bomb.getComponent(H.cc.UITransform), slot = bombUi.width;
    assert.equal(bomb.getComponent(H.cc.Sprite).spriteFrame, lib.frame('board/tool_starlight'));
    assert.equal(bombUi.width, bombUi.height, 'square mainline art stays square');
    b.s.journey.inventory.tools = { windBell: 0, tideBottle: 0, tideNet: 2, sunSeed: 0, starShears: 0 };
    b.s.active.bombs = 0; b.s.active.attemptId = 'region-art'; b.render();
    assert.deepEqual(u.diagnostics().toolBar, ['tideNet']);
    const net = u.tools[0].find('OriginalToolArt'), netUi = net.getComponent(H.cc.UITransform), dim = lib.size('r2/tool_tidenet');
    assert.equal(net.getComponent(H.cc.Sprite).spriteFrame, lib.frame('r2/tool_tidenet'));
    assert.equal(netUi.width, slot);
    assert(Math.abs(netUi.height / netUi.width - dim.height / dim.width) < 1e-9, 'tide net keeps the slice aspect');
    const meadow = await board({ provider: 'regional-r05', region: 1 });
    const seed = meadow.u.tools[0].find('OriginalToolArt');
    assert.equal(seed.getComponent(meadow.H.cc.Sprite).spriteFrame, meadow.H.load('ui/BoardArt').BoardArt.shared().frame('r2/tool_sunseed'));
    const tide = await board({ provider: 'regional-r05', region: 0 });
    const anchor = tide.u.tools[0].find('OriginalToolArt').getComponent(tide.H.cc.Sprite);
    assert.notEqual(anchor.spriteFrame, tide.H.load('ui/BoardArt').BoardArt.shared().frame('r2/tool_tidenet'));
  });
  await ok('drag ghost tracks the pointer every frame with no lift; cancel never spends the tool', async () => {
    const b = await board(), { H, u, log } = b, E = H.cc.Node.EventType;
    const n = u.tools[1], id = 3, start = H.point(n), p = H.point(u.cells[24]);
    n.emit(E.TOUCH_START, H.event(start, id));
    n.emit(E.TOUCH_MOVE, H.event(p, id));
    const ghost = u.root.find('ToolDragGhost'), info = u.layoutInfo;
    const at = (q) => ({ x: q.x - info.width / 2, y: q.y - info.height / 2 });
    assert(ghost && ghost.active, 'ghost is visible while the finger is down');
    assert(Math.abs(ghost.worldPosition.x - at(p).x) < 1e-4 && Math.abs(ghost.worldPosition.y - at(p).y) < 1e-4, 'ghost sits on the pointer, not above it');
    assert.equal(log.tools.length, 0, 'holding does not use the tool');
    let finger = { x: p.x + 36, y: p.y - 18 };
    H.cc.input.getAllTouches = () => [{ getID: () => id, getUILocation: () => ({ x: finger.x, y: finger.y }) }];
    u.update(1 / 60);
    assert(Math.abs(ghost.worldPosition.x - at(finger).x) < 1e-4 && Math.abs(ghost.worldPosition.y - at(finger).y) < 1e-4, 'next frame follows the live finger');
    assert.equal(log.tools.length, 0, 'a frame while held does not clear');
    n.emit(E.TOUCH_CANCEL, H.event(p, id, E.TOUCH_END));
    assert.equal(log.tools.length, 0, 'cancel over a cell is not a release, even when its code says end');
    assert.equal(u.toolDrag, null);
    assert.equal(ghost.active, false, 'cancel puts the ghost away');
    n.emit(E.TOUCH_END, H.event(p, id));
    assert.equal(log.tools.length, 0, 'a later end after cancel does not spend the tool');
  });
  await ok('press-hold: the piece follows the finger, swaps only on release over a neighbor, and an armed tool cannot eat the drag', async () => {
    const b = await board(), { H, u, log } = b, E = H.cc.Node.EventType;
    const n = u.cells[0], from = H.point(n), mid = { x: from.x + 20, y: from.y }, neighbor = H.point(u.cells[1]);
    const home = { x: n.position.x, y: n.position.y }, info = u.layoutInfo;
    const at = (q) => ({ x: q.x - info.width / 2, y: q.y - info.height / 2 });
    const ghostOf = () => u.root.find('PieceDragGhost');
    H.tap(u.tools[1]); assert.equal(u.armedTool, 'windBell');
    n.emit(E.TOUCH_START, H.event(from, 4));
    n.emit(E.TOUCH_MOVE, H.event(mid, 4));
    const ghost = ghostOf();
    assert(ghost && ghost.active, 'piece follows while the finger is down');
    assert(Math.abs(ghost.worldPosition.x - at(mid).x) < 1e-4 && Math.abs(ghost.worldPosition.y - at(mid).y) < 1e-4, 'ghost sits on the finger');
    assert.equal(n.find('ProjectPieceArt').active, false, 'the held piece leaves its cell');
    assert.equal(n.position.x, home.x); assert.equal(n.position.y, home.y);
    assert.equal(log.commands.length, 0, 'no swap while held');
    assert.equal(log.tools.length, 0, 'armed tool is not spent by holding a piece');
    assert.equal(u.armedTool, null, 'a piece drag drops the sticky tool arm');
    let finger = { x: neighbor.x, y: neighbor.y };
    H.cc.input.getAllTouches = () => [{ getID: () => 4, getUILocation: () => ({ x: finger.x, y: finger.y }) }];
    u.update(1 / 60);
    assert(Math.abs(ghost.worldPosition.x - at(finger).x) < 1e-4 && Math.abs(ghost.worldPosition.y - at(finger).y) < 1e-4, 'next frame follows the live finger');
    assert.equal(log.commands.length, 0, 'a frame while held does not swap or clear');
    n.emit(E.TOUCH_CANCEL, H.event(finger, 9));
    assert(u.dragStart, 'a different finger cancel does not take the drag back');
    n.emit(E.TOUCH_CANCEL, H.event(finger, 4, E.TOUCH_END));
    assert.equal(log.commands.length, 0, 'cancel is not a release, even when its code says end');
    assert.equal(log.tools.length, 0);
    assert.equal(u.dragStart, null);
    assert.equal(ghost.active, false, 'cancel puts the ghost away');
    assert.equal(n.find('ProjectPieceArt').active, true, 'cancel puts the piece back');
    n.emit(E.TOUCH_END, H.event(neighbor, 4));
    assert.equal(log.commands.length, 0, 'end after cancel does not swap');
    H.cc.input.getAllTouches = () => [];
    H.tap(u.tools[2]); assert.equal(u.armedTool, 'tideBottle');
    n.emit(E.TOUCH_START, H.event(from, 5));
    n.emit(E.TOUCH_MOVE, H.event(neighbor, 5));
    assert.equal(log.commands.length, 0, 'still holding: no swap yet');
    n.emit(E.TOUCH_END, H.event(neighbor, 5));
    assert.deepEqual(log.commands.map(c => c[0]), ['previewAction', 'commitAction']);
    assert.equal(log.tools.length, 0, 'drag-swap does not spend the armed tool');
    assert.equal(u.armedTool, null);
    assert.equal(ghostOf().active, false);
    assert.equal(n.find('ProjectPieceArt').active, true);
    const elsewhere = H.point(u.cells[2]), before = log.commands.length;
    n.emit(E.TOUCH_START, H.event(from, 6));
    n.emit(E.TOUCH_MOVE, H.event(elsewhere, 6));
    assert(ghostOf().active, 'piece follows toward a non-neighbor');
    n.emit(E.TOUCH_END, H.event(elsewhere, 6));
    assert.equal(log.commands.length, before, 'release off a neighbor puts the piece back');
    assert.equal(ghostOf().active, false);
    assert.equal(n.find('ProjectPieceArt').active, true);
    log.commands.length = 0;
    H.tap(n); H.tap(u.cells[1]);
    assert.deepEqual(log.commands.map(c => c[0]), ['previewAction', 'commitAction'], 'a tap pair still swaps, it is just not the only path');
  });
  await ok('tray drag: ghost follows the live finger every frame and the tool is used only on touch end', async () => {
    const b = await board(), { H, u, log } = b, E = H.cc.Node.EventType;
    const n = u.tools[0], id = 11, start = H.point(n), cell = H.point(u.cells[10]), info = u.layoutInfo;
    const at = (q) => ({ x: q.x - info.width / 2, y: q.y - info.height / 2 });
    H.tap(u.tools[1]); assert.equal(u.armedTool, 'windBell');
    n.emit(E.TOUCH_START, H.event(start, id));
    assert.equal(log.tools.length, 0, 'pressing the tray does not use the tool');
    H.cc.input.getAllTouches = () => [{ getID: () => id, getUILocation: () => ({ x: cell.x, y: cell.y }) }];
    u.update(1 / 60);
    const ghost = u.root.find('ToolDragGhost');
    assert(ghost && ghost.active, 'ghost follows without a node move event');
    assert(Math.abs(ghost.worldPosition.x - at(cell).x) < 1e-4 && Math.abs(ghost.worldPosition.y - at(cell).y) < 1e-4, 'ghost sits on the live finger');
    assert.equal(log.tools.length, 0, 'a frame while held does not clear');
    assert.equal(u.armedTool, null, 'dragging does not leave a sticky arm');
    u.update(1 / 60);
    assert.equal(log.tools.length, 0, 'another held frame still does not clear');
    n.emit(E.TOUCH_CANCEL, H.event(cell, id, E.TOUCH_END));
    assert.equal(log.tools.length, 0, 'cancel over a cell is not a use');
    assert.equal(u.toolDrag, null);
    assert.equal(ghost.active, false);
    n.emit(E.TOUCH_END, H.event(cell, id));
    assert.equal(log.tools.length, 0, 'end after cancel does not use the tool');
    H.cc.input.getAllTouches = () => [{ getID: () => id, getUILocation: () => ({ x: cell.x, y: cell.y }) }];
    n.emit(E.TOUCH_START, H.event(start, id));
    u.update(1 / 60);
    assert.equal(log.tools.length, 0);
    H.cc.input.getAllTouches = () => [];
    n.emit(E.TOUCH_END, H.event(cell, id));
    assert.deepEqual(log.tools, [['bomb', 10]]);
    const meadow = await board({ provider: 'regional-r05', region: 1 });
    drag(meadow, 0, 17);
    assert.deepEqual(meadow.log.tools, [['sunSeed', 17]], 'regional tray tools drag onto a cell too');
  });
  await ok('piece swap waits for a real touch end; cancel does not swap or clear', async () => {
    const b = await board(), { H, u, log } = b, E = H.cc.Node.EventType;
    const n = u.cells[0], from = H.point(n), to = { x: from.x + 40, y: from.y };
    n.emit(E.TOUCH_START, H.event(from));
    n.emit(E.TOUCH_MOVE, H.event(to));
    assert.equal(log.commands.length, 0, 'finger still down: no swap yet');
    u.update(1 / 60);
    assert.equal(log.commands.length, 0, 'a frame while held does not start a clear');
    n.emit(E.TOUCH_CANCEL, H.event(to, 1, E.TOUCH_END));
    assert.equal(log.commands.length, 0, 'cancel does not swap');
    n.emit(E.TOUCH_END, H.event(to));
    assert.equal(log.commands.length, 0, 'end after cancel does not swap');
    n.emit(E.TOUCH_START, H.event(from));
    n.emit(E.TOUCH_MOVE, H.event(to));
    n.emit(E.TOUCH_END, H.event(to));
    assert.deepEqual(log.commands.map(c => c[0]), ['previewAction', 'commitAction']);
  });
  await ok('layout points and UI points both land on their cells; the reported bomb points are the top row', async () => {
    const b = await board(), { H, u } = b, tiles = u.measureLayout().tiles, half = 18;
    for (let i = 0; i < 49; i++) {
      const lay = tiles[i], ui = H.point(u.cells[i]);
      assert.equal(u.cellAt(lay.x, lay.y, true), i, 'layout ' + i);
      assert.equal(u.cellAt(ui.x, ui.y, false), i, 'ui ' + i);
      for (const dx of [-half, half]) for (const dy of [-half, half]) {
        assert.equal(u.cellAt(lay.x + dx, lay.y + dy, true), i, 'layout offset ' + i);
        assert.equal(u.cellAt(ui.x + dx, ui.y + dy, false), i, 'ui offset ' + i);
      }
    }
    assert.equal(u.cellAt(1, 1, false), -1);
    assert.equal(u.cellAt(1, 1, true), -1);
    assert.equal(u.cellAt(67, 265, true), 0);
    assert.equal(u.cellAt(110, 265, true), 1);
    assert.equal(u.cellAt(152, 265, true), 2);
    assert.equal(u.layoutYDown(u.cells[0], tiles[0].x, tiles[0].y), true);
    assert.equal(u.layoutYDown(u.cells[0], H.point(u.cells[0]).x, H.point(u.cells[0]).y), false);
  });
  await ok('hold a piece and release on a layout-space neighbor swaps; a slide inside the cell stays a tap', async () => {
    const b = await board(), { H, u, s, log } = b, E = H.cc.Node.EventType, info = u.layoutInfo;
    const down = (q) => ({ x: q.x - info.width / 2, y: info.height / 2 - q.y });
    const release = (from, to, id) => {
      const n = u.cells[from], start = u.measureLayout().tiles[from], end = u.measureLayout().tiles[to];
      log.commands.length = 0; H.cc.input.getAllTouches = () => [];
      n.emit(E.TOUCH_START, H.event(start, id));
      n.emit(E.TOUCH_MOVE, H.event(end, id));
      const ghost = u.root.find('PieceDragGhost');
      assert(ghost && ghost.active, 'piece follows in layout space');
      assert(Math.abs(ghost.worldPosition.x - down(end).x) < 1e-4 && Math.abs(ghost.worldPosition.y - down(end).y) < 1e-4, 'ghost uses the y-down world');
      assert.equal(log.commands.length, 0, 'no swap while the finger is down');
      u.update(1 / 60);
      assert.equal(log.commands.length, 0, 'a held frame does not swap');
      n.emit(E.TOUCH_END, H.event(end, id));
      assert.deepEqual(log.commands[0], ['previewAction', ['swap', from, to]]);
      assert.deepEqual(log.commands[1], ['commitAction', 't']);
      assert.equal(ghost.active, false);
    };
    release(0, 1, 21);
    release(0, 7, 22);
    release(1, 2, 23);
    release(1, 8, 24);
    const n = u.cells[0], start = u.measureLayout().tiles[0], field = { x: 110, y: 265 };
    log.commands.length = 0;
    n.emit(E.TOUCH_START, H.event(start, 25));
    n.emit(E.TOUCH_MOVE, H.event(field, 25));
    assert.equal(log.commands.length, 0);
    n.emit(E.TOUCH_END, H.event(field, 25));
    assert.deepEqual(log.commands[0], ['previewAction', ['swap', 0, 1]]);
    log.commands.length = 0;
    n.emit(E.TOUCH_START, H.event(start, 26));
    n.emit(E.TOUCH_MOVE, H.event(field, 26));
    n.emit(E.TOUCH_CANCEL, H.event(field, 26, E.TOUCH_END));
    assert.equal(log.commands.length, 0, 'cancel over a neighbor does not swap');
    assert.equal(u.dragStart, null);
    n.emit(E.TOUCH_END, H.event(field, 26));
    assert.equal(log.commands.length, 0, 'end after cancel does not swap');
    const slide = (index, id) => {
      const cell = u.cells[index], from = H.point(cell), mid = { x: from.x + 20, y: from.y };
      cell.emit(E.TOUCH_START, H.event(from, id));
      cell.emit(E.TOUCH_MOVE, H.event(mid, id));
      cell.emit(E.TOUCH_END, H.event(mid, id));
    };
    s.state = 'run.ready'; b.render(); log.commands.length = 0; u.selected = -1;
    slide(23, 27);
    assert.equal(log.commands.length, 0, 'sliding inside the cell does not swap');
    assert.equal(u.selected, 23);
    slide(24, 28);
    assert.deepEqual(log.commands[0], ['previewAction', ['swap', 23, 24]]);
    assert.deepEqual(log.commands[1], ['commitAction', 't']);
  });
  await ok('drag a bomb from the tray onto the reported cells and release calls useTool', async () => {
    const b = await board(), { H, u, s, log } = b, E = H.cc.Node.EventType, info = u.layoutInfo;
    const n = u.tools[0], slot = u.measureLayout().targets.bomb;
    const down = (q) => ({ x: q.x - info.width / 2, y: info.height / 2 - q.y });
    const drops = [[67, 265, 0], [110, 265, 1], [152, 265, 2]];
    for (const [x, y, index] of drops) {
      s.state = 'run.ready'; s.active.bombs = 2; b.render(); log.tools.length = 0;
      const id = 30 + index, point = { x, y };
      n.emit(E.TOUCH_START, H.event(slot, id));
      H.cc.input.getAllTouches = () => [{ getID: () => id, getUILocation: () => point }];
      u.update(1 / 60);
      const ghost = u.root.find('ToolDragGhost');
      assert(ghost && ghost.active, 'bomb follows before release');
      assert(Math.abs(ghost.worldPosition.x - down(point).x) < 1e-4 && Math.abs(ghost.worldPosition.y - down(point).y) < 1e-4);
      assert.equal(log.tools.length, 0, 'holding over the cell does not use the bomb');
      u.update(1 / 60);
      assert.equal(log.tools.length, 0);
      H.cc.input.getAllTouches = () => [];
      n.emit(E.TOUCH_END, H.event(point, id));
      assert.deepEqual(log.tools, [['bomb', index]]);
      assert.equal(s.active.bombs, 1);
      assert.equal(ghost.active, false);
    }
    s.state = 'run.ready'; s.active.bombs = 2; b.render(); log.tools.length = 0;
    const point = { x: 67, y: 265 };
    n.emit(E.TOUCH_START, H.event(slot, 40));
    n.emit(E.TOUCH_MOVE, H.event(point, 40));
    n.emit(E.TOUCH_CANCEL, H.event(point, 40, E.TOUCH_END));
    assert.equal(log.tools.length, 0, 'cancel on a layout cell does not use the bomb');
    assert.equal(u.toolDrag, null);
    n.emit(E.TOUCH_END, H.event(point, 40));
    assert.equal(log.tools.length, 0, 'end after cancel does not use the bomb');
    assert.equal(s.active.bombs, 2);
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
