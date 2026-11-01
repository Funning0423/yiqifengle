'use strict';
// R1 (77b76c3 audit): tapping the chest repaints the result (closeResult → openResult). The claimed panel must keep the
// tapped panel's live 3D chest (no 2D-fallback frames, no shrink) and ease the score row into place (no one-frame jump).
// Actual BoardPanels TS on the in-memory Cocos doubles (harness.cjs); logical units, not a device render.
const assert = require('node:assert/strict');
const { createHarness } = require('./harness.cjs');
(async () => {
  const H = createHarness(), A = H.load('ui/BoardArt'), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
  await Promise.all(['board', 'popup', 'r2'].map(dir => A.BoardArt.shared().load(dir)));
  A.BoardArt.shared().chestPrefab = async () => new H.cc.Prefab(); // harness double: the GLB itself is not under test
  const owner = new H.cc.Node('ResultHandoffProbe'); H.cc._scene.addChild(owner);
  const stack = new K.PopupStack(owner, () => H.state.viewport);
  const settle = (n = 40, dt = .025) => { for (let i = 0; i < n; i++) stack.update(dt); };
  const flush = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };
  const model = state => ({ kind: 'win', score: 630, stars: 3, movesUsed: 11, movesLeft: 11, goalsLeft: [], chestHint: false, unlockHint: '主线 05 · 潮汐挑战已开放', next: () => {}, home: () => {},
    rewards: [{ id: 'chest', label: '打开宝箱', icon: 'popup/chest_closed', iconKind: 'chest', state, claim: state === 'ready' ? () => {} : undefined },
      { id: 'regionReward', label: '潮汐网', icon: '', tool: 'tideNet', iconKind: 'tool', state, claim: state === 'ready' ? () => {} : undefined }] });
  const activeScore = root => { const v = n => { if (!n.activeInHierarchy) return null; if (n.name === 'Score') return n; for (const c of n.children) { const r = v(c); if (r) return r; } return null; }; return v(root); };
  const wy = n => n.worldPosition.y;
  const HOST = w => ({ top: 47, bottom: 34, left: 0, right: 0, capsule: { top: 51, bottom: 87, left: w - 93, right: w - 6 } });
  const out = {};
  for (const [w, h] of [[390, 844], [320, 568]]) {
    H.state.viewport = { width: w, height: h, safeInsets: HOST(w) };
    const p = P.openResult(stack, model('ready'), null); settle(); await flush(); settle(4);
    const d0 = p.resultDiagnostics(); if (d0.chest.state !== 'ready') throw Error('harness chest: '+JSON.stringify(d0.chest));
    const a0scale = p.root.find('PopupPanel').scale.x;
    const rig0 = p.root.find('ResultChest3D'), y0 = wy(activeScore(p.root));
    p.resultChestTapped(); settle(2);
    stack.clear(); const q = P.openResult(stack, model('claimed'), null); // same frame as the host repaint, before any load can finish
    const rig1 = q.root.find('ResultChest3D'), flat = q.root.find('ResultChestArt');
    assert.equal(rig1, rig0, 'claimed panel adopts the live 3D chest');
    assert(rig1.activeInHierarchy, '3D chest visible on the first claimed frame');
    assert(!flat || !flat.activeInHierarchy, 'no 2D fallback (small chest) frames');
    const body = q.root.find('PopupPanel'); assert(Math.abs(body.scale.x - a0scale) < 1e-6, 'no pop-in: scale '+body.scale.x+' vs '+a0scale);
    assert.equal(body.getComponent(H.cc.UIOpacity).opacity, 255, 'no fade-in on the repaint');
    const e = q.resultDiagnostics(); assert(e.chest.state === 'ready' && e.chest.t < 0.5, 'lid keeps animating from the tap, not restarted closed/open');
    const s = activeScore(q.root), first = wy(s); assert(Math.abs(first - y0) < 0.6, 'score starts where it was: ' + first + ' vs ' + y0);
    q.update(0.1); const mid = wy(s); settle(20); const end = wy(s);
    if (Math.abs(end - y0) > 1) assert(Math.abs(mid - y0) > 0.5 && Math.abs(mid - end) > 0.5, 'score moves through intermediate positions');
    out[w + 'x' + h] = { scoreFrom: +y0.toFixed(1), scoreMid: +mid.toFixed(1), scoreTo: +end.toFixed(1) };
    { // force a 66 pt score offset (the harness lays both states out alike; the device moved the score 66 pt)
      stack.clear(); settle(); H.state.viewport = { width: w, height: h, safeInsets: HOST(w) };
      const a = P.openResult(stack, model('ready'), null); settle(); await flush(); settle(4); a.root.setPosition(a.root.position.x, a.root.position.y - 66, 0); const rigA = a.root.find('ResultChest3D'); const ya = wy(activeScore(a.root));
      a.resultChestTapped(); settle(2); stack.clear();
      const b = P.openResult(stack, model('claimed'), null), sb = activeScore(b.root), adoptedF = b.root.find('ResultChest3D') === rigA, f0 = wy(sb); b.update(0.1); const f1 = wy(sb); settle(20); const f2 = wy(sb);
      assert(Math.abs(f2 - ya) > 1, 'forced layout must move the score'); assert(Math.abs(f0 - ya) < 0.6, 'eased: starts at the old y '+JSON.stringify({ya,f0,f1,f2,adoptedF}));
      assert(Math.abs(f1 - ya) > 0.5 && Math.abs(f1 - f2) > 0.5, 'eased: intermediate at 0.1 s');
      out[w + 'x' + h].forced = { from: +ya.toFixed(1), at0: +f0.toFixed(1), at100ms: +f1.toFixed(1), to: +f2.toFixed(1) }; H.state.viewport = { width: w, height: h, safeInsets: HOST(w) }; }
    // a later repaint without a recent tap must not adopt anything stale
    const now = Date.now; Date.now = () => now() + 4000;
    try { stack.clear(); const r = P.openResult(stack, model('claimed'), null); settle(); await flush();
      assert.notEqual(r.root.find('ResultChest3D'), rig0, 'no stale handoff after 3 s'); stack.clear(); settle(); } finally { Date.now = now; }
  }
  { // R1a/R1b: the claim batch repaints TWICE back-to-back (chest claimed, then the region reward) with no frame between.
    H.state.viewport = { width: 390, height: 844, safeInsets: HOST(390) };
    const p = P.openResult(stack, model('ready'), null); settle(); await flush(); settle(4);
    const rig0 = p.root.find('ResultChest3D'), y0 = wy(activeScore(p.root)); p.resultChestTapped(); settle(1);
    const mid = model('claimed'); mid.rewards[1] = { ...mid.rewards[1], state: 'ready', claim: () => {} };
    stack.clear(); P.openResult(stack, mid, null); stack.clear(); const q = P.openResult(stack, model('claimed'), null);
    assert.equal(q.root.find('ResultChest3D'), rig0, 'rig survives the double repaint');
    const s = activeScore(q.root), a0 = wy(s); assert(Math.abs(a0 - y0) < 0.6, 'R1a: score starts at the tapped y after a double repaint: ' + a0 + ' vs ' + y0);
    q.update(0.025); const a1 = wy(s); settle(20); const a2 = wy(s);
    assert(Math.abs(a2 - y0) > 30, 'harness reproduces the open-state score move'); assert(Math.abs(a1 - a2) > 5, 'R1a: one frame later still easing, not jumped: ' + a1 + ' → ' + a2);
    const stars = []; const v = n => { if (/^Star/.test(n.name) && n.activeInHierarchy) stars.push(n); n.children.forEach(v); }; v(q.root);
    stack.update(0.0); for (const n of stars) { const o = n.getComponent(H.cc.UIOpacity); assert(!o || o.opacity === 255, 'R1b: star ' + n.name + ' visible on the first frame, no re-drop'); }
    out.doubleRepaint = { from: +y0.toFixed(1), frame1: +a1.toFixed(1), to: +a2.toFixed(1), stars: stars.length }; stack.clear(); settle();
  }
  assert(Math.abs(P.scoreEaseAt(0)) < 1e-9 && P.scoreEaseAt(P.SCORE_EASE_S) === 1 && P.scoreEaseAt(0.1) > 0.4 && P.scoreEaseAt(0.1) < 1);
  console.log(JSON.stringify({ status: 'PASS', ...out }));
})().catch(e => { console.error(e); process.exit(1); });
