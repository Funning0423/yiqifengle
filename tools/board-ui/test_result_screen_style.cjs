'use strict';
// Result screen (Funning 2026-10-16): 3D bottom buttons, region item icon cards, chest stays open after claiming.
// Actual BoardPanels TS on the in-memory Cocos doubles (harness.cjs). Logical UI units, not device pixels or rendering.
const assert = require('node:assert/strict');
const { createHarness } = require('./harness.cjs');
(async () => {
  const H = createHarness(), A = H.load('ui/BoardArt'), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
  await Promise.all(['board', 'popup', 'r2'].map(dir => A.BoardArt.shared().load(dir)));
  const owner = new H.cc.Node('ResultStyleProbe'); H.cc._scene.addChild(owner);
  const stack = new K.PopupStack(owner, () => H.state.viewport);
  const settle = () => { for (let i = 0; i < 40; i++) stack.update(.025); };
  const model = (chest, region) => ({ kind: 'win', score: 630, stars: 3, movesUsed: 11, movesLeft: 11, goalsLeft: [], chestHint: false, next: () => {}, home: () => {},
    rewards: [
      { id: 'chest', label: chest === 'claimed' ? '宝箱已打开' : '打开宝箱', icon: 'popup/chest_closed', iconKind: 'chest', state: chest, claim: chest === 'ready' ? () => {} : undefined },
      { id: 'regionReward', label: region === 'claimed' ? '已领取' : '潮汐网', icon: '', tool: 'tideNet', iconKind: 'tool', state: region, claim: region === 'ready' ? () => {} : undefined },
    ] });
  const box = n => { const ui = n.getComponent(H.cc.UITransform); return { w: ui.width * Math.abs(n.scale.x), h: ui.height * Math.abs(n.scale.y) }; };
  const world = n => { let x = 0, y = 0; for (let c = n; c; c = c.parent) { x += c.position.x; y += c.position.y; } return { x, y }; };
  const report = { buttons: {}, cards: {}, chest: {} };
  const HOST = (w, h) => ({ top: 47, bottom: 34, left: 0, right: 0, capsule: { top: 51, bottom: 87, left: w - 93, right: w - 6 } });
  for (const [w, h, insets] of [[390, 844, true], [390, 844, false], [320, 568, false], [375, 667, true]]) {
    H.state.viewport = insets ? { width: w, height: h, safeInsets: HOST(w, h) } : { width: w, height: h }; const p = P.openResult(stack, model('ready', 'ready'), null); settle();
    const next = p.root.find('Next'), home = p.root.find('Home'); assert(next && home);
    const nb = box(next), hb = box(home), nw = world(next), hw = world(home);
    // 2) bottom buttons: same height 56, identical widths, same row, plate art 0.6, drop shadow >= 4.
    assert.equal(nb.h, 56, 'Next is 56 high'); assert.equal(hb.h, 56, 'Home is 56 high');
    assert.equal(nb.w, hb.w, '下一关 and 回小岛 have identical widths'); assert.equal(nw.y, hw.y, 'one row');
    assert(Math.abs(nw.x + hw.x) < 0.5, 'row centred');
    for (const b of [next, home]) {
      const s = b.getChildByName('ActionShadow'); assert(s && s.active, 'drop shadow under ' + b.name);
      assert(s.__offset >= 4, 'shadow offset >= 4'); assert.equal(b.children.indexOf(s), 0, 'shadow drawn behind the face');
    }
    const d = p.resultDiagnostics(); assert.equal(d.action.artScale, 0.6); assert.equal(d.action.height, 56); assert(d.action.shadow >= 4);
    const plate = next.getChildByName('Face').getChildByName('Plate'), claim = p.root.find('ClaimAll').getChildByName('Face').getChildByName('Plate');
    assert(plate.scale.x > 0 && claim.scale.x > 0);
    report.buttons[w + 'x' + h + (insets ? '-wx' : '')] = { next: { x: +nw.x.toFixed(1), y: +nw.y.toFixed(1), w: nb.w, h: nb.h }, home: { x: +hw.x.toFixed(1), y: +hw.y.toFixed(1), w: hb.w, h: hb.h } };
    // 3) region item is an icon card: icon above its name, rays behind, no long claim button, shadow.
    const pageCount = Number(p.root.find('ResultPageNumber').getComponent(H.cc.Label).string.split('/')[1]) || 1; const pager = p.root.find('ResultPageNumber').active;
    const card = p.root.find('ResultRewardCard-1'); assert(card && card.activeInHierarchy, 'region item renders as a card on the first page (pages ' + (pager ? pageCount : 1) + ', panel ' + p.height + ')');
    assert(!pager, 'whole result fits on one page');
    const cb = box(card); assert(cb.w <= 120 && cb.w >= 96, 'card about 120 wide'); assert(cb.h >= 64 && cb.h <= 132, 'card height');
    const name = card.getChildByName('ResultRewardState-1'), rays = card.getChildByName('ResultRewardCardRays');
    assert(name && rays && rays.active, 'name + rays'); assert.equal(name.getComponent(H.cc.Label).string, '潮汐网');
    const icon = card.children.find(n => n !== name && n !== rays && n.name !== 'stamp_claimed'); assert(icon, 'icon inside card');
    assert(icon.position.y > name.position.y, 'icon above name');
    const ib = box(icon); assert(Math.abs(icon.position.x) + ib.w / 2 <= cb.w / 2 + 0.5 && Math.abs(icon.position.y) + ib.h / 2 <= cb.h / 2 + 0.5, 'icon inside the card');
    const shadow = card.parent.getChildByName('ResultRewardCardShadow-1'); assert(shadow && shadow.__offset >= 4, 'card shadow >= 4');
    const toolClaim = p.root.find('Claim-regionReward'); assert(!toolClaim || !toolClaim.activeInHierarchy, 'no separate long claim bar for the region item');
    // same style as the chest: the chest hero is centred, rays behind it.
    const chestArt = p.root.find('ResultChestArt'), cr = p.root.find('ResultChestRays'); assert(chestArt && cr);
    const ca = box(chestArt); assert(Math.abs(world(chestArt).x - world(p.body).x) < 0.5, 'chest centred');
    report.cards[w + 'x' + h + (insets ? '-wx' : '')] = { w: cb.w, h: cb.h, icon: +ib.w.toFixed(1) }; report.chest[w + 'x' + h + (insets ? '-wx' : '')] = { w: +ca.w.toFixed(1), h: +ca.h.toFixed(1) };
    if (w === 390) assert(ca.w >= 240 && ca.h >= 216, 'chest hero at least 240 × 216 on 390 × 844 (annotation ①)');
    // 4) before claiming the chest is closed.
    assert.equal(d.chestOpen, false); assert(d.chest && d.chest.t === 0, 'ready chest is closed');
    stack.clear(); settle();
    const q = P.openResult(stack, model('claimed', 'claimed'), null); settle();
    const e = q.resultDiagnostics(); assert.equal(e.chestOpen, true); assert(e.chest && e.chest.t >= 0.5 && e.chest.angle <= -110, 'claimed chest shows the open lid');
    assert(!q.root.find('ClaimAll') || !q.root.find('ClaimAll').activeInHierarchy, '全部领取 gone after claiming');
    const claimedCard = q.root.find('ResultRewardCard-1'); assert(claimedCard.children.some(n => n.name === 'stamp_claimed'), 'claimed card carries the stamp');
    stack.clear(); settle();
  }
  console.log(JSON.stringify({ status: 'PASS', report }, null, 1));
})().catch(e => { console.error(e); process.exitCode = 1; });
