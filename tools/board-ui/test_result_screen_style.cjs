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
  { // UI设计部 condition (b): the black caption on the preview stills/videos (work/rsv2/drive.py) is preview tooling only.
    const fs = require('node:fs'), path = require('node:path'), root = path.resolve(__dirname, '../../creator-build-project');
    const CAPTION = ['非实机', 'harness 合成', '动效预览', '布局/动效', 'SPEC v2.2 布局'], hits = [];
    const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { if (!['library', 'temp', 'local', 'build', 'node_modules'].includes(e.name)) walk(f); continue; }
      if (!/\.(ts|js|json|meta|txt|html|css|md|plist|fnt)$/.test(e.name)) continue; const t = fs.readFileSync(f, 'utf8'); for (const c of CAPTION) if (t.includes(c)) hits.push(path.relative(root, f) + ': ' + c); } };
    for (const d of ['assets', 'build-templates', 'build-resources', 'settings']) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
    assert.deepEqual(hits, [], 'preview caption text never ships'); report.previewCaptionShipped = hits.length; }
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
    if (!compact) { assert.equal(d.guide.chest.w, 180, 'SPEC v2.1 chest 180 wide'); assert.equal(d.guide.chest.h, 147, 'chest_v3 aspect 400×327'); assert.equal(d.guide.chest.halo, 220); }
    else assert(d.guide.chest.w <= 120 && d.guide.chest.h <= 104.5, 'compact chest ≤ 120 wide');
    const tb = box(tap); assert(tb.w >= 44 && tb.h >= 44, 'hit area ≥ 44'); assert.equal(tb.w, d.guide.chest.hit);
    assert(d.guide.pulsing, 'ready chest pulses'); assert(!p.root.find('ResultChestRays').activeInHierarchy, 'rays only after opening');
    for (const x of all.filter(x => x)) assert(['过关啦', '630 分', '下一关', '回小岛'].includes(x), 'SPEC v2.2: closed page shows only 过关啦 / score / 下一关 / 回小岛, got ' + x);
    // SPEC 16:35: glow hugs the chest (r74 closed, ≤ 0.45 × chest width); panel 9-slice inset 212, edge ≈ 23 pt, plain paper.
    const hb0 = box(halo); assert(hb0.w <= 0.9 * d.guide.chest.w + 0.5, 'glow radius ≤ 0.45 × chest width'); if (!compact) assert(Math.abs(hb0.w / 2 / halo.scale.x - 74) < 0.5 || Math.abs(hb0.w / 2 - 74) < 4, 'glow r74');
    const pf = p.body.getChildByName('PanelFrame'), psf = pf.getComponent(H.cc.Sprite).spriteFrame;
    assert.equal(psf.insetLeft, 212); assert(Math.abs(212 * Math.abs(pf.scale.x) - 23) < 0.5, 'panel edge ≈ 23');
    assert(!p.root.find('InnerLight'), 'no warm light layer inside the panel');
    const s0 = halo.scale.x; settle(16); assert.notEqual(halo.scale.x, s0, 'halo breathes');
    // 4) buttons: equal width, 56 (52 compact), art 0.6, shadow ≥ 4, ≥ 40 from the screen edge on 390, gap 16, bottom clearance.
    const next = p.root.find('Next'), home = p.root.find('Home'), nb = box(next), hb = box(home), ns = screen(next, w, h), hs = screen(home, w, h);
    assert.equal(nb.w, hb.w); assert.equal(nb.h, compact ? 52 : 56); assert.equal(ns.y, hs.y); assert.equal(d.action.artScale, 0.6);
    for (const b of [next, home]) { const s = b.getChildByName('ActionShadow'); assert(s && s.active && s.__offset >= 4 && b.children.indexOf(s) === 0); }
    const leftEdge = ns.x - nb.w / 2, rightEdge = w - (hs.x + hb.w / 2), gap = (hs.x - hb.w / 2) - (ns.x + nb.w / 2);
    if (w === 390) { assert.equal(nb.w, 128, '(350 − 2 × (23 + 16) − 16) / 2'); assert(leftEdge >= 40 && rightEdge >= 40, 'side margin ≥ 40'); }
    { // UI设计部 condition (a): 16 pt from the panel's inner edge (9-slice border ≈ 23 pt) on the sides and the bottom, drop shadow included.
      const fr = p.body.getChildByName('PanelFrame'), fb = box(fr), fs = screen(fr, w, h), edge = 212 * Math.abs(fr.scale.x);
      const inL = fs.x - fb.w / 2 + edge, inR = fs.x + fb.w / 2 - edge, inB = fs.y + fb.h / 2 - edge;
      for (const [b, bb, bs] of [[next, nb, ns], [home, hb, hs]]) { const sh = b.getChildByName('ActionShadow').__offset;
        const l = bs.x - bb.w / 2 - inL, r = inR - (bs.x + bb.w / 2), bot = inB - (bs.y + bb.h / 2 + sh);
        report.pad = report.pad || {}; report.pad[key + ':' + b.name] = { left: +l.toFixed(2), right: +r.toFixed(2), bottom: +bot.toFixed(2) };
        assert(Math.min(l, r) >= 16 - 0.5 && bot >= 16 - 0.5, key + ' ' + b.name + ' 16 pt from the inner edge ' + JSON.stringify(report.pad[key + ':' + b.name])); }
      assert(Math.abs(report.pad[key + ':Next'].left - 16) < 0.5 && Math.abs(report.pad[key + ':Home'].right - 16) < 0.5, 'exactly 16 at the sides'); }
    assert(Math.abs(gap - 16) < 0.5, 'gap 16');
    const bottomGap = h - 34 - (ns.y + nb.h / 2); assert(bottomGap >= 24, 'clear of the bottom safe line');
    report[key] = { chest: { ...d.guide.chest, centre: screen(tap, w, h) }, next: { ...ns, w: nb.w, h: nb.h }, home: { ...hs, w: hb.w, h: hb.h }, sideMargin: +leftEdge.toFixed(1), gap: +gap.toFixed(1), bottomToSafe: +bottomGap.toFixed(1) };
    { // condition (c): visual chest centre = the 3D frame centre less CHEST_FRAME.offsetY (2.8% of the frame side) ≈ y 485 on 390×844.
      const rig = p.root.find('ResultChest3D'), side = box(rig).w, vc = screen(rig, w, h).y + 0.028 * side;
      report[key + ':chestVisualCentre'] = +vc.toFixed(1); if (w === 390) assert(Math.abs(vc - 485) <= 1, 'chest visual centre ≈ 485, got ' + vc); }
    // tap the chest: one claim of everything, double tap ignored.
    H.tap(tap); H.tap(tap); assert.deepEqual(calls, ['chest', 'regionReward'], 'one tap claims everything once');
    assert.equal(tap.activeInHierarchy, false);
    stack.clear(); settle();
    // Provisional spec: leaving before opening auto-claims first, without a popup, exactly once.
    const c2 = []; const q0 = P.openResult(stack, model('ready', c2), null); settle(); H.tap(q0.root.find('Next'));
    assert.deepEqual(c2, ['chest', 'regionReward', 'Next'], 'Next before opening claims first'); stack.clear(); settle();
    // 2) open: lid open, rewards float above the chest as icons only (SPEC v2.2), bob; no unlock hint.
    const c3 = []; const q = P.openResult(stack, model('claimed', c3), null); settle(10);
    const e = q.resultDiagnostics(); assert.equal(e.chestOpen, true); assert(e.chest && e.chest.angle <= -110, 'open lid');
    const f = q.root.find('ResultFloat-1'); assert(f && f.activeInHierarchy, 'reward floats'); assert(!q.root.find('ResultChestTap') || !q.root.find('ResultChestTap').activeInHierarchy);
    const chest = q.root.find('ResultChestHalo'); assert(world(f).y > world(chest).y, 'reward above the chest');
    assert(!f.getChildByName('ResultRewardState-1') || !f.getChildByName('ResultRewardState-1').activeInHierarchy, 'SPEC v2.2: icons only, no reward names'); assert(f.getChildByName('ResultFloatPlate') && f.getChildByName('ResultFloatPlate').active, 'RewardBadge behind the existing icon'); if (!compact) assert.equal(e.float[0].icon, 68, 'badge 68');
    assert(q.root.find('ResultChestRays').activeInHierarchy, 'rays once open');
    const y1 = world(f).y; settle(20); const y2 = world(f).y; assert.notEqual(y1, y2, 'gentle bob'); assert(Math.abs(y2 - (world(f.parent).y + e.float[0].y)) <= 3.5, 'bob ±3');
    { const t = texts(q.root).filter(x => x); for (const x of t) assert(['过关啦', '630 分', '下一关', '回小岛'].includes(x) || /^\d+$/.test(x), 'SPEC v2.2 text list only, got ' + x); assert(!t.includes('主线 05 · 潮汐挑战已开放'), 'no unlock hint'); } assert(!q.root.find('ResultPageNumber').activeInHierarchy, 'one page open');
    report[key].float = { ...screen(f, w, h), icon: e.float[0].icon };
    { // CountBadge: only for count > 1, Ø24 at +(24, 26) from the badge centre, the number is the only text added.
      stack.clear(); settle(); const mm = model('claimed', []); mm.rewards = mm.rewards.map((r, i) => i === 1 ? { ...r, count: 2 } : r);
      const q2 = P.openResult(stack, mm, null); settle(10); const f2 = q2.root.find('ResultFloat-1'), cb = f2 && f2.getChildByName('ResultCountBadge-1');
      assert(cb && cb.activeInHierarchy, 'count badge for ×2'); assert.equal(cb.getChildByName('ResultCount').getComponent(H.cc.Label).string, '2');
      assert.equal(cb.getComponent(H.cc.UITransform).width, 24); { const ic = q2.resultDiagnostics().float[0].icon; assert(Math.abs(cb.position.x - 24 * ic / 68) < 1e-6, 'badge +24 right (scaled with the 68 badge)'); }
      assert(!q2.root.find('ResultCountBadge-0') || !q2.root.find('ResultCountBadge-0').activeInHierarchy, 'no badge for a single item');
    }
    stack.clear(); settle();
  }
  console.log(JSON.stringify({ status: 'PASS', report }, null, 1));
})().catch(e => { console.error(e); process.exitCode = 1; });
