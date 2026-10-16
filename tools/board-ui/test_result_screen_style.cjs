'use strict';
// Result screen v2 (Funning 2026-10-16 + UI设计部 SPEC.md ui-design/result-screen): one chest, light guide, tap the chest
// to claim, rewards float above the open chest, bottom 「下一关」「回小岛」 home-style and clear of the edges.
// Actual BoardPanels TS on the in-memory Cocos doubles (harness.cjs). Logical UI units, not device pixels or rendering.
const assert = require('node:assert/strict');
const { createHarness } = require('./harness.cjs');
(async () => {
  const H = createHarness(), A = H.load('ui/BoardArt'), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
  await Promise.all(['board', 'popup', 'r2'].map(dir => A.BoardArt.shared().load(dir)));
  const owner = new H.cc.Node('ResultStyleProbe'); H.cc._scene.addChild(owner);
  const stack = new K.PopupStack(owner, () => H.state.viewport);
  const settle = (n = 40) => { for (let i = 0; i < n; i++) stack.update(.025); };
  const model = (state, calls) => ({ kind: 'win', score: 630, stars: 3, movesUsed: 11, movesLeft: 11, goalsLeft: [], chestHint: false, unlockHint: '主线 05 · 潮汐挑战已开放',
    next: () => calls.push('Next'), home: () => calls.push('Home'),
    rewards: [
      { id: 'chest', label: '打开宝箱', icon: 'popup/chest_closed', iconKind: 'chest', state, claim: state === 'ready' ? () => calls.push('chest') : undefined },
      { id: 'regionReward', label: '潮汐网', icon: '', tool: 'tideNet', iconKind: 'tool', state, claim: state === 'ready' ? () => calls.push('regionReward') : undefined },
    ] });
  const box = n => { const ui = n.getComponent(H.cc.UITransform); return { w: ui.width * Math.abs(n.scale.x), h: ui.height * Math.abs(n.scale.y) }; };
  const world = n => { let x = 0, y = 0; for (let c = n; c; c = c.parent) { x += c.position.x; y += c.position.y; } return { x, y }; };
  const screen = (n, w, h) => { const q = world(n); return { x: +(q.x + w / 2).toFixed(1), y: +(h / 2 - q.y).toFixed(1) }; };
  const texts = root => { const out = []; const v = n => { if (!n.activeInHierarchy) return; const l = n.getComponent(H.cc.Label); if (l && l.string) out.push(l.string); n.children.forEach(v); }; v(root); return out; };
  const HOST = w => ({ top: 47, bottom: 34, left: 0, right: 0, capsule: { top: 51, bottom: 87, left: w - 93, right: w - 6 } });
  const report = {};
  for (const [w, h] of [[390, 844], [375, 667], [320, 568]]) {
    const key = w + 'x' + h, compact = h <= 700; H.state.viewport = { width: w, height: h, safeInsets: HOST(w) };
    const calls = []; const p = P.openResult(stack, model('ready', calls), null); settle();
    const all = texts(p.root);
    // 1) removed: 全部领取, item cards, 成绩已保存, paging.
    assert(!all.some(t => t.includes('全部领取')), 'no 全部领取'); assert(!all.some(t => t.includes('已保存')), 'no 成绩已保存');
    assert(!p.root.find('ClaimAll'), 'no ClaimAll button'); assert(!p.root.find('ResultRewardCard-1'), 'no item card module');
    assert(!p.root.find('ResultPageNumber').activeInHierarchy, 'one page');
    assert(!all.includes('潮汐网'), 'the item stays inside the closed chest');
    // the chest: centred, spec size, halo, pulsing guide, hint, hit area >= 44 and covering the halo.
    const d = p.resultDiagnostics(), tap = p.root.find('ResultChestTap'), halo = p.root.find('ResultChestHalo');
    assert(tap && tap.activeInHierarchy && halo && halo.activeInHierarchy);
    assert(Math.abs(world(tap).x - world(p.body).x) < 0.5, 'chest centred');
    if (!compact) { assert.equal(d.guide.chest.w, 180, 'SPEC v2.1 chest 180 wide'); assert.equal(d.guide.chest.h, 156); assert.equal(d.guide.chest.halo, 220); }
    else assert(d.guide.chest.w <= 120 && d.guide.chest.h <= 104.5, 'compact chest ≤ 120 wide');
    const tb = box(tap); assert(tb.w >= 44 && tb.h >= 44, 'hit area ≥ 44'); assert.equal(tb.w, d.guide.chest.hit);
    assert(d.guide.pulsing, 'ready chest pulses'); assert(!p.root.find('ResultChestRays').activeInHierarchy, 'rays only after opening');
    assert(all.includes('✦ 点宝箱领取 ✦'), 'hint under the chest'); assert(!all.includes('主线 05 · 潮汐挑战已开放'), 'unlock hint waits for the open chest');
    const s0 = halo.scale.x; settle(16); assert.notEqual(halo.scale.x, s0, 'halo breathes');
    // 4) buttons: equal width, 56 (52 compact), art 0.6, shadow ≥ 4, ≥ 40 from the screen edge on 390, gap 16, bottom clearance.
    const next = p.root.find('Next'), home = p.root.find('Home'), nb = box(next), hb = box(home), ns = screen(next, w, h), hs = screen(home, w, h);
    assert.equal(nb.w, hb.w); assert.equal(nb.h, compact ? 52 : 56); assert.equal(ns.y, hs.y); assert.equal(d.action.artScale, 0.6);
    for (const b of [next, home]) { const s = b.getChildByName('ActionShadow'); assert(s && s.active && s.__offset >= 4 && b.children.indexOf(s) === 0); }
    const leftEdge = ns.x - nb.w / 2, rightEdge = w - (hs.x + hb.w / 2), gap = (hs.x - hb.w / 2) - (ns.x + nb.w / 2);
    if (w === 390) { assert.equal(nb.w, 141, 'spec width 141'); assert(leftEdge >= 40 && rightEdge >= 40, 'side margin ≥ 40'); }
    assert(Math.abs(gap - 16) < 0.5, 'gap 16');
    const bottomGap = h - 34 - (ns.y + nb.h / 2); assert(bottomGap >= 24, 'clear of the bottom safe line');
    report[key] = { chest: { ...d.guide.chest, centre: screen(tap, w, h) }, next: { ...ns, w: nb.w, h: nb.h }, home: { ...hs, w: hb.w, h: hb.h }, sideMargin: +leftEdge.toFixed(1), gap: +gap.toFixed(1), bottomToSafe: +bottomGap.toFixed(1) };
    // tap the chest: one claim of everything, double tap ignored.
    H.tap(tap); H.tap(tap); assert.deepEqual(calls, ['chest', 'regionReward'], 'one tap claims everything once');
    assert.equal(tap.activeInHierarchy, false);
    stack.clear(); settle();
    // Provisional spec: leaving before opening auto-claims first, without a popup, exactly once.
    const c2 = []; const q0 = P.openResult(stack, model('ready', c2), null); settle(); H.tap(q0.root.find('Next'));
    assert.deepEqual(c2, ['chest', 'regionReward', 'Next'], 'Next before opening claims first'); stack.clear(); settle();
    // 2) open: lid open, rewards float above the chest with icon + name, bob, unlock hint shown.
    const c3 = []; const q = P.openResult(stack, model('claimed', c3), null); settle(10);
    const e = q.resultDiagnostics(); assert.equal(e.chestOpen, true); assert(e.chest && e.chest.angle <= -110, 'open lid');
    const f = q.root.find('ResultFloat-1'); assert(f && f.activeInHierarchy, 'reward floats'); assert(!q.root.find('ResultChestTap') || !q.root.find('ResultChestTap').activeInHierarchy);
    const chest = q.root.find('ResultChestHalo'); assert(world(f).y > world(chest).y, 'reward above the chest');
    assert.equal(f.getChildByName('ResultRewardState-1').getComponent(H.cc.Label).string, '潮汐网'); assert(f.getChildByName('ResultFloatPlate') && f.getChildByName('ResultFloatPlate').active, 'RewardBadge behind the existing icon'); if (!compact) assert.equal(e.float[0].icon, 68, 'badge 68');
    assert(q.root.find('ResultChestRays').activeInHierarchy, 'rays once open');
    const y1 = world(f).y; settle(20); const y2 = world(f).y; assert.notEqual(y1, y2, 'gentle bob'); assert(Math.abs(y2 - (world(f.parent).y + e.float[0].y)) <= 3.5, 'bob ±3');
    assert(texts(q.root).includes('主线 05 · 潮汐挑战已开放'), 'unlock hint after opening'); assert(!q.root.find('ResultPageNumber').activeInHierarchy, 'one page open');
    report[key].float = { ...screen(f, w, h), icon: e.float[0].icon };
    stack.clear(); settle();
  }
  console.log(JSON.stringify({ status: 'PASS', report }, null, 1));
})().catch(e => { console.error(e); process.exitCode = 1; });
