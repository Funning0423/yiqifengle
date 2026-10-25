'use strict';
// b18 (UI设计部 2026-10-25): lose-panel subtitle ResultMessage = failHint (or the old line), drawn by the result relayout in pt:
// 16 pt default, 0.5 pt steps down to 15 pt, ONE line, no wrap, no ellipsis, width ≤ inner - 4. Real BoardPanels TS on the
// Cocos doubles (harness.cjs); node geometry, not a device render.
const assert = require('node:assert/strict');
const { createHarness } = require('./harness.cjs');
(async () => {
  const H = createHarness(), A = H.load('ui/BoardArt'), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
  await Promise.all(['board', 'popup', 'r2'].map(dir => A.BoardArt.shared().load(dir)));
  const owner = new H.cc.Node('LoseCaptionProbe'); H.cc._scene.addChild(owner);
  const stack = new K.PopupStack(owner, () => H.state.viewport);
  const all = (n, out = []) => { out.push(n); for (const c of n.children) all(c, out); return out; };
  const live = n => { for (let q = n; q; q = q.parent) if (q.active === false) return false; return true; };
  const width = s => Array.from(s).reduce((w, ch) => w + (ch === ' ' ? 0.5 : 1), 0);
  const open = (failHint, vw = 390, vh = 844) => { H.setViewport(vw, vh); stack.clear?.(); H.flush?.();
    const p = P.openResult(stack, { kind: 'lose', score: 0, stars: 0, movesUsed: 14, movesLeft: 0, goalsLeft: [], chestHint: false, rewards: [], failHint, replay: () => {}, home: () => {} }, null);
    H.flush?.();
    const msgs = all(p.root || p.body).filter(n => /^ResultMessage/.test(n.name) && n.getComponent(H.cc.Label) && live(n));
    assert.equal(msgs.length, 1, 'exactly one visible ResultMessage label (' + vw + 'x' + vh + ')');
    const l = msgs[0].getComponent(H.cc.Label), ui = msgs[0].getComponent(H.cc.UITransform);
    const flow = all(p.body).find(n => n.name === 'ResultFlow-ResultMessage-0');
        const r = { s: l.string, pt: l.fontSize, wrap: l.enableWrapText, lines: l.string.split('\n').length, boxW: ui.width, ems: width(l.string), relayout: !!flow, overflow: l.overflow };
    p.destroy(); return r; };
  let n = 0; const t = (m, f) => { f(); n++; console.log('PASS', m); };
  t('16 pt default, min 15, step 0.5; px-per-pt conversion is gone', () => {
    assert.equal(P.LOSE_CAPTION_PT.default, 16); assert.equal(P.LOSE_CAPTION_PT.min, 15); assert.equal(P.LOSE_CAPTION_PT.step, 0.5);
    assert.equal(P.LOSE_CAPTION_PX_PER_PT, undefined); assert.equal(P.LOSE_CAPTION_W, undefined); assert.equal(P.loseCaptionSize, undefined); });
  t('no failHint → old line, unchanged text, one line', () => { for (const [w, h] of [[320, 568], [390, 844]]) { const r = open(undefined, w, h); assert.equal(r.s, P.LOSE_CAPTION_DEFAULT); assert(r.relayout, 'drawn by relayout'); assert(r.pt >= 15 && r.pt <= 16); assert.equal(r.lines, 1); assert.equal(r.wrap, false); } });
  t('every lake failHint: rendered once, 15–16 pt, one line, fits inner at 320 and 390', () => {
    for (const s of require('../../creator-build-project/assets/scripts/regional-r05/runtime/lakeside-levels-data.js')) {
      assert([...s.failHint].length <= 14, s.id);
      for (const [w, h] of [[320, 568], [390, 844]]) { const r = open(s.failHint, w, h), inner = r.boxW + 4; assert(inner < Math.min(350, w - (w >= 360 ? 40 : 24)), 'inner within the panel at ' + w);
        assert.equal(r.s, s.failHint, 'failHint, not scoreText'); assert(r.pt >= 15 && r.pt <= 16, r.pt); assert.equal(r.lines, 1); assert.equal(r.wrap, false);
        assert(r.ems * r.pt <= inner - 4, s.id + ' ' + w + ': ' + r.ems * r.pt + ' > ' + (inner - 4)); } } });
  t('14 字 at 320 stays one line within inner', () => { const r = open('一'.repeat(14), 320, 568); console.log('  320 inner-4 =', r.boxW, 'pt', r.pt); assert(r.pt >= 15 && r.pt <= 16); assert(14 * r.pt <= r.boxW); assert.equal(r.lines, 1); });
  t('too wide → 0.5 pt steps, floor 15 pt, no ellipsis, no wrap', () => {
    // 320: panel inner-4 ≤ 268 (asserted via boxW). 17 字 × 16 = 272 > 268, × 15.5 = 263.5 → 15.5; 40 字 → floor 15.
    const a = open('一'.repeat(18), 320, 568); assert.equal(a.pt, P.loseCaptionPt(a.s, a.boxW, (s, pt) => width(s) * pt)); assert(a.pt < 16); assert.equal(a.lines, 1);
    const b = open('一'.repeat(40), 320, 568); assert.equal(b.pt, 15); assert.equal(b.s, '一'.repeat(40)); assert(!/…/.test(b.s)); assert.equal(b.lines, 1); assert.equal(b.wrap, false);
    assert.equal(P.loseCaptionPt('一'.repeat(17), 268, (s, pt) => width(s) * pt), 15.5); });
  console.log('lose-caption-fit', n, 'PASS');
})().catch(e => { console.error(e); process.exit(1); });
