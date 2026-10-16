'use strict';
// R2: on small screens (≤700 tall) the floating reward badges of the open chest sit 14 pt higher than the base layout.
const assert = require('node:assert/strict'), { createHarness } = require('./harness.cjs');
(async () => {
  const H = createHarness(), A = H.load('ui/BoardArt'), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
  await Promise.all(['board', 'popup', 'r2'].map(d => A.BoardArt.shared().load(d)));
  const owner = new H.cc.Node('FloatLiftProbe'); H.cc._scene.addChild(owner); const stack = new K.PopupStack(owner, () => H.state.viewport);
  const settle = () => { for (let i = 0; i < 40; i++) stack.update(.025); };
  const model = { kind: 'win', score: 630, stars: 3, movesUsed: 11, movesLeft: 11, goalsLeft: [], chestHint: false, next: () => {}, home: () => {},
    rewards: [{ id: 'chest', label: '打开宝箱', icon: 'popup/chest_closed', iconKind: 'chest', state: 'claimed' }, { id: 'regionReward', label: '潮汐网', icon: '', tool: 'tideNet', iconKind: 'tool', state: 'claimed' }] };
  const out = {};
  for (const [w, h, lift] of [[320, 568, 14], [375, 667, 14], [390, 844, 0]]) {
    H.state.viewport = { width: w, height: h, safeInsets: { top: 47, bottom: 34, left: 0, right: 0 } };
    const p = P.openResult(stack, model, null); settle(); const d = p.resultDiagnostics();
    assert.equal(d.floatLift, lift, w + 'x' + h + ' lift'); assert(d.float.length >= 1, 'badges placed');
    out[w + 'x' + h] = { lift: d.floatLift, badgeY: d.float[0].y }; stack.clear(); settle();
  }
  console.log(JSON.stringify({ status: 'PASS', ...out }));
})().catch(e => { console.error(e); process.exit(1); });
