// usage: node dump.cjs <repoRoot> <w> <h> <day|night> <ready|claimed> <out.json>
const [ROOT, W, Hh, mode, state, out] = process.argv.slice(2);
const fs = require('fs');
if (mode === 'night') globalThis.__worldDayNight = { snapshot: () => ({ mode: 'night' }) };
const { createHarness } = require(ROOT + '/tools/board-ui/harness.cjs');
(async () => {
  const H = createHarness(), A = H.load('ui/BoardArt'), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
  await Promise.all(['board', 'popup', 'r2'].map(d => A.BoardArt.shared().load(d)));
  const w = +W, h = +Hh;
  H.state.viewport = { width: w, height: h, safeInsets: { top: 47, bottom: 34, left: 0, right: 0, capsule: { top: 51, bottom: 87, left: w - 93, right: w - 6 } } };
  const owner = new H.cc.Node('Probe'); H.cc._scene.addChild(owner); const stack = new K.PopupStack(owner, () => H.state.viewport);
  const claimed = state === 'claimed';
  const m = { kind: 'win', score: 630, stars: 3, movesUsed: 11, movesLeft: 11, goalsLeft: [], chestHint: false, next: () => {}, home: () => {}, rewards: [
    { id: 'chest', label: claimed ? '宝箱已打开' : '打开宝箱', icon: 'popup/chest_closed', iconKind: 'chest', state: claimed ? 'claimed' : 'ready', claim: claimed ? undefined : () => {} },
    { id: 'regionReward', label: claimed ? '地区道具已领取' : '领取地区道具', icon: '', tool: 'tideNet', iconKind: 'tool', state: claimed ? 'claimed' : 'ready', claim: claimed ? undefined : () => {} }] };
  // the new branch names the tool by its item name on the card
  if (fs.readFileSync(ROOT + '/creator-build-project/assets/scripts/ui/BoardPanels.ts', 'utf8').includes('ResultRewardCardRays') ) m.rewards[1].label = '潮汐网';
  const p = P.openResult(stack, m, null); for (let i = 0; i < 80; i++) stack.update(.025);
  const ops = [];
  const visit = (n, wx, wy, sx, sy, op) => {
    if (!n.active) return;
    const o = n.getComponent(H.cc.UIOpacity); const a = op * (o ? o.opacity / 255 : 1);
    const nx = wx + n.position.x * sx, ny = wy + n.position.y * sy, nsx = sx * n.scale.x, nsy = sy * n.scale.y;
    const ui = n.getComponent(H.cc.UITransform), rot = n.eulerAngles ? n.eulerAngles.z : 0;
    const base = { name: n.name, x: nx, y: ny, sx: nsx, sy: nsy, w: ui ? ui.width : 0, h: ui ? ui.height : 0, ax: ui ? ui.anchorX : .5, ay: ui ? ui.anchorY : .5, a, rot };
    const g = n.getComponent(H.cc.Graphics); if (g && g.ops.length) ops.push({ ...base, t: 'g', ops: g.ops });
    const s = n.getComponent(H.cc.Sprite);
    if (s && s.spriteFrame) { const tex = s.spriteFrame._texture; const path = tex && (tex.path || tex.image?.path || tex._image?.path || tex.nativeUrl || (tex._mipmaps && tex._mipmaps[0]?.path)); ops.push({ ...base, t: 's', path: path || null, type: s.type, color: { ...s.color }, gray: s.grayscale, ins: [s.spriteFrame.insetLeft, s.spriteFrame.insetRight, s.spriteFrame.insetTop, s.spriteFrame.insetBottom], chest3d: n.name === 'ResultChest3D' }); }
    if (n.name === 'ResultChest3D') ops.push({ ...base, t: 'chest3d', open: (p.resultDiagnostics?.().chest?.t ?? 0) >= 0.5 });
    const l = n.getComponent(H.cc.Label); if (l && l.string) ops.push({ ...base, t: 'l', str: l.string, fs: l.fontSize, lh: l.lineHeight, color: { ...l.color }, align: l.horizontalAlign, bold: l.isBold });
    for (const c of n.children) visit(c, nx, ny, nsx, nsy, a);
  };
  visit(p.root, 0, 0, 1, 1, 1);
  // flat chest art hides once the 3D chest is ready in the engine; in this preview the 3D chest is substituted.
  fs.writeFileSync(out, JSON.stringify({ w, h, mode, state, ops }));
  console.log('ops', ops.length);
})().catch(e => { console.error(e); process.exit(1); });
