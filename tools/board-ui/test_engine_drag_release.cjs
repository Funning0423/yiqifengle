'use strict';
// Actual UI TS + actual mainline controller. Explicit raw-input -> node-event model
// of official Cocos v3.8.8 (not a browser/device run). See DRAG-RELEASE-ADAPTER.md.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = process.env.QF_DRAG_SOURCE || path.resolve(__dirname, '../..');
const { createHarness } = require(path.join(ROOT, 'tools/board-ui/harness.cjs'));
const results = [], traces = [], source = path.join(ROOT, 'creator-build-project/assets/scripts/ManagedMobileBoardUI.ts');
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
const before = digest();
async function actual() {
  const H = createHarness(); H.cc.sys.localStorage.setItem('qfl.ui.seenTools', '["starlight","windbell","tidebottle"]');
  const { createPort } = require(path.join(ROOT, 'creator-build-project/assets/scripts/mainline-r1/adapter/mainline-port.js'));
  const mem = new Map(), port = createPort({ getItem: k => mem.get(k) || null, setItem: (k, v) => mem.set(k, String(v)) }), c = port.createController();
  const { createManagedMainlineBinding } = H.load('world-r2/ManagedMainlineBinding'), { ManagedMobileBoardUI } = H.load('ManagedMobileBoardUI');
  const u = new ManagedMobileBoardUI(); u.node = new H.cc.Node('owner'); u.node.components.push(u); H.cc._scene.addChild(u.node);
  u.initializeManaged({}, createManagedMainlineBinding(port, c, { exit: () => ({ ok: true }), resume: () => ({ ok: true }) }));
  await H.flush(); assert(u.host.command('startStage', 'mainline-01', { seed: 1 }).ok); u.update(0);
  return { H, u, c, mem };
}
// The dispatch route and event code are deliberately separate. Cocos 3.8.8
// mutates Event.type for an outside hit, but getEventCode() retains input type.
function deliver(H, n, raw, p, id = 1, options = {}) {
  const event = { ...H.event(p, id, raw), type: raw, target: n, currentTarget: n, simulate: false, ...options.event };
  let route = raw;
  if (raw === 'touch-end' && !n.getComponent(H.cc.UITransform).hitTest(event.getLocation(), event.windowId)) route = 'touch-cancel';
  event.type = route;
  if (options.mutate) options.mutate(event);
  traces.push({ source: n.name, raw, route, code: typeof event.getEventCode === 'function' ? (() => { try { return event.getEventCode(); } catch { return 'throws'; } })() : 'missing', id, point: p, simulate: event.simulate, scenario: options.mouse ? 'mouse-ID0 contract, no conversion chain' : 'touch contract' });
  n.emit(route, event); return event;
}
function begin(b, kind, options = {}) {
  const { H, u } = b, n = kind === 'piece' ? u.cells[23] : u.tools[0];
  const a = H.point(n), z = H.point(u.cells[kind === 'piece' ? 24 : 0]), id = options.id ?? 1;
  deliver(H, n, 'touch-start', a, id, options); deliver(H, n, 'touch-move', z, id, options);
  assert(kind === 'piece' ? u.dragStart : u.toolDrag, 'start owns a drag');
  return { n, a, z };
}
function state(c) { const a = c.snapshot().active; return { actions: a.actions, moves: a.moves, bombs: a.bombs }; }
function untouched(c) { assert.deepEqual(state(c), { actions: [], moves: 22, bombs: 2 }); }
function committed(c, kind) { assert.deepEqual(state(c), kind === 'piece' ? { actions: [['swap', 23, 24]], moves: 21, bombs: 2 } : { actions: [['bomb', 0]], moves: 22, bombs: 1 }); }
async function test(name, fn) { try { await fn(); results.push({ name, ok: true }); console.log('PASS', name); } catch (e) { results.push({ name, ok: false, error: e.stack }); console.error('FAIL', name, e.message); } }
(async () => {
  for (const kind of ['piece', 'tool']) for (const mouse of [false, true]) {
    await test(`${kind} ${mouse ? 'mouse-ID0' : 'touch'} raw-end/node-cancel commits exactly once`, async () => {
      const b = await actual(); try { const id = mouse ? 0 : 81, { n, z } = begin(b, kind, { mouse, id }); untouched(b.c); const event = deliver(b.H, n, 'touch-end', z, id, { mouse }); assert.equal(event.type, 'touch-cancel'); assert.equal(event.getEventCode(), 'touch-end'); committed(b.c, kind); deliver(b.H, n, 'touch-end', z, id, { mouse }); committed(b.c, kind); } finally { b.u.onDestroy(); }
    });
    await test(`${kind} ${mouse ? 'mouse-ID0' : 'touch'} genuine raw-cancel never commits`, async () => {
      const b = await actual(); try { const id = mouse ? 0 : 82, { n, z } = begin(b, kind, { mouse, id }); const event = deliver(b.H, n, 'touch-cancel', z, id, { mouse }); assert.equal(event.type, event.getEventCode()); untouched(b.c); assert.equal(b.u.dragStart, null); assert.equal(b.u.toolDrag, null); deliver(b.H, n, 'touch-end', z, id, { mouse }); untouched(b.c); } finally { b.u.onDestroy(); }
    });
  }
  for (const kind of ['piece', 'tool']) for (const coordinate of ['ui-y-down', 'screen-calibrated']) await test(`${kind} ${coordinate} raw release preserves calibrated endpoint`, async () => {
    const b = await actual(), { H, u } = b; try {
      const n = kind === 'piece' ? u.cells[23] : u.tools[0], a = H.point(n), z = H.point(u.cells[kind === 'piece' ? 24 : 0]);
      const opts = p => ({ event: { getUILocation: () => coordinate === 'ui-y-down' ? { x: p.x, y: H.state.viewport.height - p.y } : { x: 1, y: 1 } } });
      deliver(H, n, 'touch-start', a, 1, opts(a)); deliver(H, n, 'touch-move', z, 1, opts(z)); deliver(H, n, 'touch-end', z, 1, opts(z)); committed(b.c, kind);
    } finally { u.onDestroy(); }
  });
  for (const kind of ['piece', 'tool']) for (const bad of ['missing-code', 'throwing-code', 'wrong-code', 'missing-target', 'wrong-target', 'missing-current-target', 'wrong-current-target', 'missing-node-type', 'foreign-window', 'screen-miss-destination', 'screen-different-cell', 'outside-negative', 'outside-positive', 'nan-location', 'origin-rollback', 'stale-version', 'modal', 'node-hide', 'root-hide', 'game-hide', 'disable', 'rotate', 'rotate-back', 'safe-insets', 'destroy-node', 'destroy-board']) {
    await test(`${kind} guarded raw-end/node-cancel rejects ${bad}`, async () => {
      const b = await actual(), { H, u } = b; try {
        const { n, a, z } = begin(b, kind), opts = {}; let p = z;
        if (bad === 'missing-code') opts.mutate = e => { delete e.getEventCode; };
        if (bad === 'throwing-code') opts.mutate = e => { e.getEventCode = () => { throw Error('no raw code'); }; };
        if (bad === 'wrong-code') opts.mutate = e => { e.getEventCode = () => 'touch-move'; };
        if (bad === 'missing-target') opts.mutate = e => { delete e.target; };
        if (bad === 'wrong-target') opts.mutate = e => { e.target = u.cells[38]; };
        if (bad === 'missing-current-target') opts.mutate = e => { delete e.currentTarget; };
        if (bad === 'wrong-current-target') opts.mutate = e => { e.currentTarget = u.cells[38]; };
        if (bad === 'missing-node-type') opts.mutate = e => { delete e.type; };
        if (bad === 'foreign-window') opts.event = { windowId: 99 };
        if (bad === 'screen-miss-destination') opts.event = { getLocation: () => ({ x: 2000, y: 2000 }) };
        if (bad === 'screen-different-cell') opts.event = { getLocation: () => H.point(u.cells[kind === 'piece' ? 22 : 1]) };
        if (bad === 'outside-negative') p = { x: -100, y: -100 };
        if (bad === 'outside-positive') p = { x: 2000, y: 2000 };
        if (bad === 'nan-location') p = { x: NaN, y: NaN };
        if (bad === 'origin-rollback') opts.mutate = e => { e.getUILocation = () => a; e.getLocation = () => a; };
        if (bad === 'stale-version') u.snapshot.active.version = 999;
        if (bad === 'modal') u.popups.open({ name: 'GuardProbe', width: 240, height: 240, title: 'Guard' });
        if (bad === 'node-hide') { n.active = false; n.active = true; }
        if (bad === 'root-hide') { u.root.active = false; u.root.active = true; }
        if (bad === 'game-hide') { H.cc.game.emit(H.cc.Game.EVENT_HIDE); H.cc.game.emit(H.cc.Game.EVENT_SHOW); }
        if (bad === 'disable') { u.enabled = false; u.enabled = true; }
        if (bad === 'rotate' || bad === 'rotate-back') { H.setViewport(844, 390); u.layout(); if (bad === 'rotate-back') { H.setViewport(390, 844); u.layout(); } p = H.point(u.cells[kind === 'piece' ? 24 : 0]); }
        if (bad === 'safe-insets') { const original = u.safeInsets.bind(u); u.safeInsets = (w, h) => ({ ...original(w, h), left: 20, right: 25 }); u.layout(); p = H.point(u.cells[kind === 'piece' ? 24 : 0]); }
        if (bad === 'destroy-node') n.destroy();
        if (bad === 'destroy-board') u.onDestroy();
        deliver(H, n, 'touch-end', p, 1, opts); untouched(b.c);
      } finally { u.onDestroy(); }
    });
  }
  for (const kind of ['piece', 'tool']) for (const foreign of ['touch-start', 'touch-move', 'touch-end', 'touch-cancel']) await test(`${kind} foreign ${foreign} preserves owner without a commit`, async () => {
    const b = await actual(); try { const { n, a, z } = begin(b, kind); deliver(b.H, n, foreign, foreign === 'touch-start' ? a : z, 2); untouched(b.c); assert.equal((kind === 'piece' ? b.u.dragStart : b.u.toolDrag).pointer, 1); deliver(b.H, n, 'touch-end', z); committed(b.c, kind); } finally { b.u.onDestroy(); }
  });
  for (const kind of ['piece', 'tool']) await test(`${kind} unchanged layout preserves legal engine release`, async () => { const b = await actual(); try { const { n, z } = begin(b, kind); b.u.layout(); deliver(b.H, n, 'touch-end', z); committed(b.c, kind); } finally { b.u.onDestroy(); } });
  await test('source hash unchanged during tests', () => assert.equal(digest(), before));
  const report = { status: results.every(x => x.ok) ? 'PASS' : 'FAIL', source: ROOT, sourceSha256: before, testSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'), scope: 'Actual UI TS + mainline controller; source-derived two-layer Cocos 3.8.8 event double. No real browser/device events.', checks: results.length, failed: results.filter(x => !x.ok).length, results, traces };
  if (process.env.QF_DRAG_REPORT) fs.writeFileSync(process.env.QF_DRAG_REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, results: undefined, traces: undefined })); if (report.failed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 2; });
