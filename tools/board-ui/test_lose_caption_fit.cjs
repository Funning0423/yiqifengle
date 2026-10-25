'use strict';
// b18 (UI设计部): lose-panel subtitle ResultMessage = failHint (or the old line); one line, 17 pt default, shrinks to ≥15 pt when too
// wide, never wraps or ellipsises. Real BoardPanels TS on the Cocos doubles (harness.cjs).
const assert = require('node:assert/strict');
const { createHarness } = require('./harness.cjs');
(async () => {
  const H = createHarness(), A = H.load('ui/BoardArt'), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
  await Promise.all(['board', 'popup', 'r2'].map(dir => A.BoardArt.shared().load(dir)));
  const owner = new H.cc.Node('LoseCaptionProbe'); H.cc._scene.addChild(owner);
  const stack = new K.PopupStack(owner, () => H.state.viewport);
  const find = (n, name) => { if (n.name === name) return n; for (const c of n.children) { const f = find(c, name); if (f) return f; } return null; };
  const pt = px => +(px / P.LOSE_CAPTION_PX_PER_PT).toFixed(2);
  const open = failHint => { stack.clear?.(); const p = P.openResult(stack, { kind: 'lose', score: 0, stars: 0, movesUsed: 14, movesLeft: 0, goalsLeft: [], chestHint: false, rewards: [], failHint, replay: () => {}, home: () => {} }, null);
    const l = find(p.body, 'ResultMessage').getComponent(H.cc.Label); const r = { s: l.string, pt: pt(l.fontSize), wrap: l.enableWrapText, overflow: l.overflow }; p.destroy(); return r; };
  let n = 0; const t = (m, f) => { f(); n++; console.log('PASS', m); };
  t('17 pt default = the size the panel already used (28 design px); old line unchanged without a hint', () => {
    assert.equal(P.LOSE_CAPTION_PT.default, 17); assert.equal(P.LOSE_CAPTION_PT.min, 15); assert.equal(17 * P.LOSE_CAPTION_PX_PER_PT, 28);
    const r = open(undefined); assert.equal(r.s, P.LOSE_CAPTION_DEFAULT); assert.equal(r.pt, 17); });
  t('every lake failHint fits at 17 pt on one line, shown as is', () => {
    for (const s of require('../../creator-build-project/assets/scripts/regional-r05/runtime/lakeside-levels-data.js')) { const r = open(s.failHint); assert.equal(r.s, s.failHint); assert.equal(r.pt, 17); assert.equal(r.wrap, false); assert.equal(r.overflow, H.cc.Label.Overflow.NONE); } });
  t('too wide → shrinks in 0.5 pt steps, never below 15 pt, no ellipsis, no wrap', () => {
    const w = P.LOSE_CAPTION_W, px = P.LOSE_CAPTION_PX_PER_PT;
    const c18 = '一'.repeat(18), c20 = '一'.repeat(20), c40 = '一'.repeat(40);
    // 18 CJK × 17 pt × px > 480 → needs ≤ 15.5 pt-ish; check against the pure rule
    for (const s of [c18, c20, c40]) { const r = open(s); assert(r.pt <= 17 && r.pt >= 15, s.length + ':' + r.pt); assert.equal(r.s, s, 'no ellipsis'); assert(!/…|\.\.\./.test(r.s)); assert.equal(r.wrap, false);
      if (r.pt > 15) assert(K.measure(s, r.pt * px) <= w); if (r.pt < 17) assert(K.measure(s, (r.pt + 0.5) * px) > w); }
    assert.equal(open(c40).pt, 15, 'floor at 15 pt');
    assert.equal(P.loseCaptionSize('一'.repeat(10)), 28); });
  console.log('lose-caption-fit', n, 'PASS');
})().catch(e => { console.error(e); process.exit(1); });
