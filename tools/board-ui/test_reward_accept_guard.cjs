'use strict';
// 收下 ignores taps while the reward popup is opening, then accepts one later press.
const assert = require('node:assert/strict');
const { createHarness } = require('./harness.cjs');
(async () => {
  const H = createHarness();
  const { BoardArt } = H.load('ui/BoardArt');
  const { PopupStack } = H.load('ui/PopupKit');
  const { openReward, REWARD_ACCEPT_GUARD_S } = H.load('ui/CommonPanels');
  await BoardArt.shared().load('popup');
  const layer = new H.cc.Node('Layer');
  H.cc._scene.addChild(layer);
  const stack = new PopupStack(layer, () => ({ width: 390, height: 844 }));
  const p = openReward(stack, [{ kind: 'memento', count: 1, label: '潮汐印记', seal: 'popup/reward_seal_tide' }], null, { chest: false, description: '地区印记已收下。' });
  const accept = p.root.find('Accept');
  assert(accept, '收下 is on the reward popup');
  for (let i = 0; i < 8; i++) H.tap(accept, 100 + i);
  assert(p.alive && !p.isClosing, 'opening burst does not dismiss 收下');
  const early = Math.floor((REWARD_ACCEPT_GUARD_S - 0.12) * 30);
  for (let i = 0; i < early; i++) stack.update(1 / 30);
  H.tap(accept, 2);
  assert(p.alive && !p.isClosing, '收下 still ignores taps before the guard ends');
  for (let i = 0; i < 12; i++) stack.update(1 / 30);
  H.tap(accept, 3);
  assert(p.isClosing, 'one press after the guard collects the reward');
  for (let i = 0; i < 12; i++) stack.update(1 / 30);
  assert(!p.alive, '收下 closes the reward popup');
  console.log(JSON.stringify({ status: 'PASS', guardSeconds: REWARD_ACCEPT_GUARD_S, burstIgnored: 8 }));
})().catch(e => { console.error(e); process.exit(1); });
