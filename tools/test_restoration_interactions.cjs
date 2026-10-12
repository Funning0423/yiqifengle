'use strict';
// Board-UI sound wiring: the new board plays its own button / tool / back sounds (PopupKit + board pressables; no
// WarmButton on the board), and the real AudioBridge still observes the board (animation frames, result transition,
// chest claims) without doubling any click. Real ManagedMobileBoardUI + AudioBridge on the board-ui harness doubles.
const assert = require('node:assert/strict');
const { createBoard } = require('./board-ui/board-fixture.cjs');
const { createHarness } = require('./board-ui/harness.cjs');
const checks = [];
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { checks.push(name); console.log('PASS', name); });
const SEEN = JSON.stringify(['starlight', 'windbell', 'tidebottle']);
async function board(opts = {}) {
  const H = createHarness(); H.cc.sys.localStorage.setItem('qfl.ui.seenTools', SEEN);
  const b = createBoard({ harness: H, ...opts }); await H.flush(); b.render(); b.u.update(0); return b;
}
const sounds = H => H.audioLog.filter(x => x === 'button' || x === 'back' || x === 'tool');
function bridge(b) { const { AudioBridge } = b.H.load('audio/AudioBridge'), br = new AudioBridge(); br.node = new b.H.cc.Node('AudioBridgeHost'); br.onLoad(); return br; }
(async () => {
  await ok('tool slots: arm, switch and disarm each sound once; empty slot, open modal and read-only stay silent', async () => {
    const b = await board(), { H, u, s } = b; H.audioLog.length = 0;
    H.tap(u.tools[1]); H.tap(u.tools[2]); H.tap(u.tools[2]); assert.deepEqual(sounds(H), ['tool', 'tool', 'tool']);
    s.journey.inventory.tools.windBell = 0; b.render(); H.tap(u.tools[1]); assert.deepEqual(sounds(H), ['tool', 'tool', 'tool'], 'used-up tool is silent (toast only)');
    assert(/用完/.test(u.diagnostics().toast), u.diagnostics().toast);
    H.tap(u.pause); assert.deepEqual(sounds(H).slice(3), ['button']); H.tap(u.tools[2]); assert.equal(sounds(H).length, 4, 'tools under the pause panel are silent');
    b.u.popups.clear(); s.state = 'run.ready'; s.readOnly = true; b.render(); H.tap(u.tools[2]); assert.equal(sounds(H).length, 4, 'read-only is silent');
  });
  await ok('targetless regional tools dispatch and sound once; a repeat tap while resolving is rejected silently', async () => {
    for (const region of [0, 2]) {
      const b = await board({ provider: 'regional-r05', region }), { H, u, s, log } = b; H.audioLog.length = 0;
      H.tap(u.tools[0]); assert.equal(log.tools.length, 1); assert.equal(s.state, 'run.resolving'); assert.deepEqual(sounds(H), ['tool']);
      H.tap(u.tools[0]); assert.equal(log.tools.length, 1); assert.deepEqual(sounds(H), ['tool']);
    }
  });
  await ok('drag-to-cell is gameplay, not a click: no tool sound; cancel / outside / hide-show late release never dispatch', async () => {
    const b = await board(), { H, u, s, log } = b, E = H.cc.Node.EventType; H.audioLog.length = 0;
    const drag = (slot, p, o = {}) => { const n = u.tools[slot]; n.emit(E.TOUCH_START, H.event(H.point(n), o.id || 1)); n.emit(E.TOUCH_MOVE, H.event(p, o.id || 1)); if (o.mid) o.mid(); n.emit(o.cancel ? E.TOUCH_CANCEL : E.TOUCH_END, H.event(p, o.id || 1)); };
    drag(1, H.point(u.cells[24])); assert.deepEqual(log.tools, [['windBell', 24]]); assert.deepEqual(sounds(H), []);
    s.state = 'run.ready'; b.render();
    drag(2, { x: -100, y: -100 }); drag(2, H.point(u.cells[24]), { cancel: true }); drag(2, H.point(u.cells[24]), { id: 77, mid: () => { s.state = 'run.paused'; b.render(); s.state = 'run.ready'; b.render(); } });
    assert.equal(log.tools.length, 1); assert.deepEqual(sounds(H), []);
  });
  await ok('popup sounds: pause = button, popup × = back, Home = back; the AudioBridge tags no board / popup buttons (no doubles)', async () => {
    const b = await board(), { H, u } = b, br = bridge(b); H.audioLog.length = 0;
    H.tap(u.pause); H.tap(u.popups.find('PausePanel').root.find('Tile-设置')); H.tap(u.popups.find('SettingsPanel').root.find('Close')); b.step(0.3);
    assert.deepEqual(sounds(H), ['button', 'button', 'back']);
    br.scanButtons(); assert.equal(br.taggedNodes.size, 0, 'no WarmButton on the board or in PopupKit panels');
    H.tap(u.popups.find('PausePanel').root.find('Home')); assert.deepEqual(sounds(H).slice(-1), ['back']); br.onDestroy();
  });
  await ok('AudioBridge observation: one frame sound per visual token, result transition reported, a chest claimed while open sounds once', async () => {
    const b = await board(), { H, u, s } = b, br = bridge(b); H.audioLog.length = 0;
    br.update(0); assert(H.audioLog.includes('baseline'), 'new board → fresh render baseline'); assert(H.audioLog.includes('render:run.ready'));
    s.state = 'run.resolving'; s.visual = { token: 'mlv:1', kind: 'clear' }; br.update(0); br.update(0); s.visual = { token: 'mlv:2', kind: 'fall' }; br.update(0);
    assert.deepEqual(H.audioLog.filter(x => x.startsWith('frame:')), ['frame:mlv:1', 'frame:mlv:2']);
    s.state = 'result.saved'; s.active.status = 'won'; delete s.visual; br.update(0); assert(H.audioLog.includes('render:result.saved:won'));
    s.journey.chests = [{ level: 0, earned: true, opened: false }]; br.update(0); s.journey.chests = [{ level: 0, earned: true, opened: true }]; br.update(0); br.update(0);
    assert.deepEqual(H.audioLog.filter(x => x.startsWith('claim:')), ['claim:true']);
    br.onDestroy(); assert.equal(br.board, null);
  });
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, results: checks, scope: 'Real board-ui ManagedMobileBoardUI + AudioBridge with Cocos event doubles; no audible/device acceptance' }, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
