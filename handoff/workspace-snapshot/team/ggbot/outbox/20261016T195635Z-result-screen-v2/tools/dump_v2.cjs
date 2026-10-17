// usage: node dump_v2.cjs <repoRoot> <w> <h> <day|night> <outdir> <fps>   -> frames f_###.json (ready 4 s, tap, open 2.6 s)
const [ROOT, W, Hh, mode, outdir, FPS] = process.argv.slice(2);
const fs = require('fs'); fs.mkdirSync(outdir, { recursive: true });
if (mode === 'night') globalThis.__worldDayNight = { snapshot: () => ({ mode: 'night' }) };
const { createHarness } = require(ROOT + '/tools/board-ui/harness.cjs');
(async () => {
  const H = createHarness(), A = H.load('ui/BoardArt'), K = H.load('ui/PopupKit'), P = H.load('ui/BoardPanels');
  await Promise.all(['board', 'popup', 'r2'].map(d => A.BoardArt.shared().load(d)));
  const w = +W, h = +Hh, fps = +FPS, dt = 1 / fps;
  H.state.viewport = { width: w, height: h, safeInsets: { top: 47, bottom: 34, left: 0, right: 0, capsule: { top: 51, bottom: 87, left: w - 93, right: w - 6 } } };
  const owner = new H.cc.Node('Probe'); H.cc._scene.addChild(owner); const stack = new K.PopupStack(owner, () => H.state.viewport);
  const mk = st => ({ kind: 'win', score: 630, stars: 3, movesUsed: 11, movesLeft: 11, goalsLeft: [], chestHint: false, unlockHint: '主线 05 · 潮汐挑战已开放', next: () => {}, home: () => {}, rewards: [
    { id: 'chest', label: '打开宝箱', icon: 'popup/chest_closed', iconKind: 'chest', state: st, claim: st === 'ready' ? () => {} : undefined },
    { id: 'regionReward', label: '潮汐网', icon: '', tool: 'tideNet', iconKind: 'tool', state: st, claim: st === 'ready' ? () => {} : undefined }] });
  let n = 0;
  const snap = (p, state) => {
    const ops = [];
    const visit = (nd, wx, wy, sx, sy, op) => {
      if (!nd.active) return;
      const o = nd.getComponent(H.cc.UIOpacity); const a = op * (o ? o.opacity / 255 : 1);
      const nx = wx + nd.position.x * sx, ny = wy + nd.position.y * sy, nsx = sx * nd.scale.x, nsy = sy * nd.scale.y;
      const ui = nd.getComponent(H.cc.UITransform), rot = nd.eulerAngles ? nd.eulerAngles.z : 0;
      const base = { name: nd.name, x: nx, y: ny, sx: nsx, sy: nsy, w: ui ? ui.width : 0, h: ui ? ui.height : 0, ax: ui ? ui.anchorX : .5, ay: ui ? ui.anchorY : .5, a, rot };
      const g = nd.getComponent(H.cc.Graphics); if (g && g.ops.length) ops.push({ ...base, t: 'g', ops: g.ops });
      const s = nd.getComponent(H.cc.Sprite);
      if (s && s.spriteFrame) { const tex = s.spriteFrame._texture; const path = tex && (tex.path || tex.image?.path || tex._image?.path || tex.nativeUrl || (tex._mipmaps && tex._mipmaps[0]?.path)); ops.push({ ...base, t: 's', path: path || null, type: s.type, color: { ...s.color }, gray: s.grayscale, ins: [s.spriteFrame.insetLeft, s.spriteFrame.insetRight, s.spriteFrame.insetTop, s.spriteFrame.insetBottom] }); }
      const l = nd.getComponent(H.cc.Label); if (l && l.string) ops.push({ ...base, t: 'l', str: l.string, fs: l.fontSize, lh: l.lineHeight, color: { ...l.color }, align: l.horizontalAlign, bold: l.isBold });
      for (const c of nd.children) visit(c, nx, ny, nsx, nsy, a);
    };
    visit(p.root, 0, 0, 1, 1, 1);
    const d = p.resultDiagnostics();
    fs.writeFileSync(`${outdir}/f_${String(n++).padStart(3, '0')}.json`, JSON.stringify({ w, h, mode, state, angle: d.chest ? d.chest.angle : 0, ops }));
  };
  let p = P.openResult(stack, mk('ready'), null);
  for (let i = 0; i < 4 * fps; i++) { stack.update(dt); snap(p, 'ready'); }
  H.tap(p.root.find('ResultChestTap')); stack.clear(); for (let i = 0; i < 4; i++) stack.update(.025);
  p = P.openResult(stack, mk('claimed'), null); for (let i = 0; i < 12; i++) stack.update(.025); // panel entry (not part of this clip)
  for (let i = 0; i < 2.6 * fps; i++) { stack.update(dt); snap(p, 'claimed'); }
  console.log('frames', n);
})().catch(e => { console.error(e); process.exit(1); });
