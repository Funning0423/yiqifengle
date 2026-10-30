/** new-regions journey UI, lazy part (board_art subpackage). Cocos Creator puts every script inside a bundle folder into
 *  that bundle's own index.js / game.js and removes it from the main package; loading the bundle runs it
 *  (docs.cocos.com/creator/3.8/manual/en/asset/bundle.html "Scripts in the Asset Bundle"; WeChat: bundle with
 *  compression "Mini Game Subpackage" → subpackages/board_art, editor/publish/subpackage.html).
 *  The docs advise against script references across bundles, so this file imports TYPES only (erased at compile) and
 *  receives every runtime dependency (cc classes, PopupKit, UiPrefs, JourneyCore) from the main package's host
 *  (ui/JourneyUi.ts). On load it registers itself on globalThis.__qfJourneyUi. */
import type { Node } from 'cc';
import type { PopupPanel, PopupStack, TintSet } from '../../../scripts/ui/PopupKit';
import type { RegionKey, RegionRow } from '../../../scripts/ui/JourneyCore';
import type { ChapterActions } from '../../../scripts/ui/IslandPanels';
import type { JourneyUiHost } from '../../../scripts/ui/JourneyUi';
export const JOURNEY_UI_VERSION = 1;
export function createJourneyUi(h: JourneyUiHost) {
  const { Color, Graphics, UIOpacity, Vec3, isValid, tween } = h.cc;
  const { artSprite, makeLabel, measure, popupScale, pressable, uiNode, tintRgb, journeySeenDone, lastRegion, markRegionSeen, reducedMotion, seenRegions, setJourneySeenDone,
    REGION_DEFS, CHAPTERS, journeyRows, journeyProgress, focusRegion, journeyInput, endingSeals } = h;
  const defOf = (id: string) => REGION_DEFS.find(d => d.id === id)!;
  /** SPEC §13.6/13.7 motion (registered in tools/ui-timing/known-timings.json): journey.gridStagger = gridS 200 ms,
   *  journey.gridStaggerStep = gridStepS 20 ms, journey.progressFill = barGrowS 600 ms, ending.sealDrop = sealDropS 240 ms,
   *  ending.sealDropStep = sealStepS 60 ms; all easeOutCubic. popup.in/out = PopupMotion OPEN_S / CLOSE_S (320/180). */
  const JOURNEY_MOTION = { gridS: 0.2, gridStepS: 0.02, gridRisePt: 4, barGrowS: 0.6, sealDropS: 0.24, sealStepS: 0.06, sealDropPt: 10 } as const;
  /** Grid cell status (SPEC §13.1): 完成 n/n ✓ · 进行中 x/n · 可前往 · 未开启 = condition label · 远方 = · · · */
  function rowStatusText(r: RegionRow): string {
    if (r.state === 'done') return r.done + '/' + r.total + ' ✓';
    if (r.state === 'progress') return r.done + '/' + r.total;
    if (r.state === 'open') return '可前往';
    if (r.state === 'locked') return defOf(r.id).unlock.label;
    return '· · ·';
  }
  /** Grid name: short name (远方 when far). Focus card / region page use the full name. */
  function rowName(r: RegionRow): string { return r.state === 'far' ? '远方' : defOf(r.id).short; }
  /** Chapter page: the ONE button (SPEC §3): 前往X / 继续 / 再访X / 尚未开启 (flat disabled). */
  function chapterButton(r: RegionRow): { text: string; enabled: boolean; flat: boolean } {
    const s = defOf(r.id).short;
    if (r.state === 'open') return { text: '前往' + s, enabled: true, flat: false };
    if (r.state === 'progress') return { text: '继续', enabled: true, flat: false };
    if (r.state === 'done') return { text: '再访' + s, enabled: true, flat: false };
    return { text: '尚未开启', enabled: false, flat: true };
  }
  /** Coast chapter hint: C1–C6 海岸漫游, C7+ 灯塔夜航. */
  function coastChapterHint(done: number): string { return done >= 6 ? '灯塔夜航' : '海岸漫游'; }
  /** Bar growth from the last seen value, only when it changed (reduced → jump). Returns the shown done at time t. */
  function barShown(from: number, to: number, t: number, reduced: boolean): number {
    if (reduced || from === to) return to; const k = Math.max(0, Math.min(1, t / JOURNEY_MOTION.barGrowS)); const e = 1 - Math.pow(1 - k, 3); return from + (to - from) * e;
  }
  function rowAppear(i: number, t: number, reduced: boolean): { alpha: number; dy: number } {
    const k = Math.max(0, Math.min(1, (t - i * JOURNEY_MOTION.gridStepS) / JOURNEY_MOTION.gridS)), e = 1 - Math.pow(1 - k, 3);
    return { alpha: e, dy: reduced ? 0 : JOURNEY_MOTION.gridRisePt * (1 - e) };
  }
  const WIN_W = 208, WIN_H = 136;
  /** Landscape / very short viewports: shrink the pt layout uniformly so the fixed-height panel keeps 8 pt margins. */
  function fitPt(v: { width: number; height: number }, hPt: number) { return Math.min(1, Math.max(0.3, (v.height - 16) / hPt)); }
  const hex = (c: number[], night: number) => tintRgb('ui', night, c);
  function rgba(c: number[], a: number) { return new Color(c[0], c[1], c[2], Math.round(255 * Math.max(0, Math.min(1, a)))); }
  /** Journey book (SPEC §13.1): fixed panel min(330, W−40) × 514 pt (458 when H < 700): progress, focus card, 3×3 seal grid. */
  function openJourney(stack: PopupStack, journey: any, challenges: Record<string, number> | null | undefined, openChapter: (id: string) => void, _r5Gates?: any, island?: { stages?: any; lastPlayed?: any } | null): PopupPanel {
    const v = stack.view(), sc = popupScale(v.width, v.height), K = 1 / sc, short = v.height < 700;
    const phPt = short ? 458 : 514, cardH = short ? 92 : 112, cellH = short ? 64 : 76, sealD = short ? 28 : 32, f = fitPt(v, phPt), pwPt = Math.min(330, Math.max(240, v.width - 40)) / f;
    const inp = journeyInput(journey, challenges, { stages: island?.stages ?? h.defaultStages(), lastPlayed: island?.lastPlayed ?? lastRegion() });
    const P = (x: number) => x * K * f, PW = P(pwPt), PH = P(phPt);
    const p = stack.open({ name: 'JourneyPanel', width: PW, height: PH, title: '旅程册', titleArt: 'r2/title_journey', closable: true });
    const rows = journeyRows(inp), prog = journeyProgress(inp), focusId = focusRegion(inp, rows), reduced = reducedMotion();
    const prev = journeySeenDone(), from = prev == null ? prog.done : Math.min(prev, prog.done); setJourneySeenDone(prog.done);
    p.text('旅程 ' + prog.done + ' / ' + prog.total, 0, P(78), P(15), 'brown', { name: 'JourneyTotal', width: PW - P(48) });
    // Segmented bar (drawn in code): only regions with data; 2 pt seams in the panel face colour.
    const BW = PW - P(48), BH = P(10), bar = uiNode('JourneyBar', p.body, BW, BH), bp = p.at(0, P(96)); bar.setPosition(bp[0], bp[1], 0);
    const g = bar.addComponent(Graphics); let shown = from, t = 0;
    p.tint.shape(g, (gg, night, a) => {
      const x0 = -BW / 2, y0 = -BH / 2, seam = P(2), k = prog.done ? shown / prog.done : 0;
      gg.fillColor = rgba(hex([0xCD, 0xB9, 0x90], night), a); gg.roundRect(x0, y0 - P(1.5), BW, BH, P(5)); gg.fill();
      gg.fillColor = rgba(hex([0xE6, 0xD7, 0xB8], night), a); gg.roundRect(x0, y0, BW, BH, P(5)); gg.fill();
      for (let i = 0; i < prog.segments.length; i++) { const s = prog.segments[i], sx = x0 + s.x0 * BW, sw = (s.x1 - s.x0) * BW, fw = sw * (s.stages ? s.done / s.stages : 0) * k;
        if (fw > 0.5) { gg.fillColor = rgba(hex(s.color, night), a); gg.rect(sx, y0, fw, BH); gg.fill(); }
        if (i > 0) { gg.fillColor = rgba(hex([0xF8, 0xED, 0xD3], night), a); gg.rect(sx - seam / 2, y0 - P(1.5), seam, BH + P(1.5)); gg.fill(); } }
    });
    // Focus card: whole card taps into the region page.
    const fr = rows.find(r => r.id === focusId)!, fd = REGION_DEFS.find(d => d.id === focusId)!, CW = PW - P(48), CH = P(cardH), cy = P(116) + CH / 2;
    const card = uiNode('Focus-' + focusId, p.body, CW, CH), cp = p.at(0, cy); card.setPosition(cp[0], cp[1], 0);
    const face = uiNode('Face', card, CW, CH);
    p.tint.shape(face.addComponent(Graphics), (gg, night, a) => { gg.fillColor = rgba(hex([0xD9, 0xBF, 0x8C], night), a); gg.roundRect(-CW / 2, -CH / 2 - P(3), CW, CH, P(16)); gg.fill(); gg.fillColor = rgba(hex([0xFF, 0xF6, 0xE2], night), a); gg.roundRect(-CW / 2, -CH / 2, CW, CH, P(16)); gg.fill(); });
    const wW = P(short ? 104 : 120), wH = wW * 78 / 120, wx = -CW / 2 + P(10) + wW / 2;
    const win = artSprite(face, 'r2/region_' + focusId, wx, 0, wW, wH, 'Window'); p.tint.sprite(win, 'ui');
    const fs = artSprite(face, 'popup/reward_seal_' + focusId, wx - wW / 2 + P(8), wH / 2 - P(8), P(30), P(30), 'Seal'); p.tint.sprite(fs, 'ui');
    const tx = wx + wW / 2 + P(12), tw = CW / 2 - tx - P(10);
    p.tint.label(makeLabel(face, fd.name, tx, P(fd.subtitle ? 28 : 22), P(fd.name.length > 4 ? 17 : 18), { align: 'left', width: tw, name: 'Name' }), 'brown');
    if (fd.subtitle) p.tint.label(makeLabel(face, '章节 · ' + fd.subtitle, tx, P(10), P(12), { align: 'left', width: tw, bold: false, name: 'Subtitle' }), 'brown2');
    p.tint.label(makeLabel(face, fr.done + ' / ' + fr.total + ' 关', tx, fd.subtitle ? -P(8) : 0, P(14), { align: 'left', width: tw, bold: false, name: 'Count' }), 'brown2');
    p.tint.label(makeLabel(face, chapterButton(fr).enabled ? (fr.state === 'done' ? '再访 ›' : fr.state === 'open' ? '前往 ›' : '继续 ›') : '尚未开启', tx, -P(22), P(14), { align: 'left', width: tw, name: 'Go' }), 'teal');
    if (fr.isNew) redDot(p, face, tx + Math.min(tw, measure(fd.name, P(18))) + P(6), P(30), P(7));
    pressable(card, face, () => { markRegionSeen(focusId); openChapter(focusId); });
    // 3×3 seal grid (SPEC §13.1): all 9 regions; whole cell taps (≥44 pt); focus region = 2 pt teal ring; far = not tappable.
    const IW = PW - P(48), GW = (IW - P(16)) / 3, GH = P(cellH), gy0 = P(116) + CH + P(12), nodes: Node[] = [];
    rows.forEach((r, i) => {
      const col = i % 3, row = Math.floor(i / 3), cx = -IW / 2 + GW / 2 + col * (GW + P(8)), cyc = gy0 + row * (GH + P(8)) + GH / 2;
      const n = uiNode('Chapter-' + r.id, p.body, GW, GH), q = p.at(cx, cyc); n.setPosition(q[0], q[1], 0);
      const c = uiNode('Face', n, GW, GH), far = r.state === 'far', locked = r.state === 'locked', focus = r.id === focusId; let down = false;
      const bg = c.addComponent(Graphics);
      p.tint.shape(bg, (gg, night, a) => { gg.fillColor = rgba(hex(down ? [0xEF, 0xE2, 0xC4] : far ? [0xF3, 0xE9, 0xD2] : [0xFB, 0xF3, 0xE0], night), a); gg.roundRect(-GW / 2, -GH / 2, GW, GH, P(12)); gg.fill();
        if (focus) { gg.strokeColor = rgba(hex([0x37, 0x7F, 0x6C], night), a); gg.lineWidth = P(2); gg.roundRect(-GW / 2 + P(1), -GH / 2 + P(1), GW - P(2), GH - P(2), P(11)); gg.stroke(); } });
      const top = GH / 2, sy = top - P(short ? 3 : 4) - P(sealD) / 2;
      if (far) { /* §13.2: no data → 远方 with no seal at all (UI设计部 r2); milestone-far keeps the faint seal (§13.1 淡章) */ if (r.hasData) blankSeal(p, c, 0, sy, P(sealD), 0.8); } else { const sp = artSprite(c, 'popup/reward_seal_' + r.id, 0, sy, P(sealD), P(sealD), 'Seal'); p.tint.sprite(sp, 'ui', [255, 255, 255], locked ? 166 : 255); sp.grayscale = locked; }
      const nm = rowName(r), ny = top - P(short ? 38 : 46), sty = top - P(short ? 53 : 63);
      p.tint.label(makeLabel(c, nm, 0, ny, P(12.5), { width: GW - P(4), name: 'Name' }), far || locked ? 'brown2' : 'brown');
      p.tint.label(makeLabel(c, rowStatusText(r), 0, sty, P(11), { width: GW - P(4), bold: r.state === 'progress' || r.state === 'open', name: 'Status' }), r.state === 'progress' || r.state === 'open' ? 'teal' : 'brown2');
      if (r.isNew) redDot(p, c, GW / 2 - P(9), top - P(9), P(7));
      if (r.tappable) pressable(n, c, () => { markRegionSeen(r.id); openChapter(r.id); }, { onPress: d => { down = d; p.tint.repaint(bg); } });
      nodes.push(c);
    });
    // Motion (SPEC §13.6): cells 200 ms, 20 ms step, 4 pt rise (top-left → bottom-right); bar grows 600 ms only when the total changed since last open.
    const ops = nodes.map(c => c.addComponent(UIOpacity));
    const step = () => { for (let i = 0; i < nodes.length; i++) { const k = rowAppear(i, t, reduced); ops[i].opacity = Math.round(255 * k.alpha); nodes[i].setPosition(0, -P(k.dy), 0); }
      const s = barShown(from, prog.done, t, reduced); if (s !== shown) { shown = s; p.tint.repaint(g); } };
    step(); p.onTick(dt => { if (t > JOURNEY_MOTION.barGrowS + 0.2) return; t += dt; step(); });
    return p;
  }
  function redDot(p: PopupPanel, parent: Node, x: number, y: number, d: number) {
    const n = uiNode('RedDot', parent, d, d); n.setPosition(x, y, 0);
    p.tint.shape(n.addComponent(Graphics), (g, night, a) => { g.fillColor = rgba(hex([0xE2, 0x55, 0x3A], night), a); g.circle(0, 0, d / 2); g.fill(); });
  }
  function checkMark(p: PopupPanel, parent: Node, x: number, y: number, d: number) {
    const n = uiNode('Check', parent, d, d); n.setPosition(x, y, 0);
    p.tint.shape(n.addComponent(Graphics), (g, night, a) => { g.fillColor = rgba(hex([0x37, 0x7F, 0x6C], night), a); g.circle(0, 0, d / 2); g.fill();
      g.strokeColor = rgba([255, 255, 255], a); g.lineWidth = d * 0.13; g.moveTo(-d * 0.24, 0); g.lineTo(-d * 0.06, -d * 0.18); g.lineTo(d * 0.26, d * 0.18); g.stroke(); });
  }
  /** Blank seal (SPEC §5): 12-sided wooden ring with a faint wind relief, drawn in code (no art). */
  function blankSeal(p: { tint: TintSet }, parent: Node, x: number, y: number, d: number, alpha: number, name = 'BlankSeal'): Node {
    const n = uiNode(name, parent, d, d); n.setPosition(x, y, 0);
    p.tint.shape(n.addComponent(Graphics), (g, night, a) => {
      const aa = a * alpha, r = d / 2, poly = (rr: number) => { for (let i = 0; i <= 12; i++) { const t = Math.PI * 2 * i / 12 + Math.PI / 12, px = Math.cos(t) * rr, py = Math.sin(t) * rr; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.close(); };
      g.fillColor = rgba(hex([0xC9, 0xAE, 0x82], night), aa); poly(r); g.fill();
      g.fillColor = rgba(hex([0xEF, 0xE2, 0xC4], night), aa); poly(r * 0.74); g.fill();
      g.strokeColor = rgba(hex([0xD8, 0xC4, 0x9C], night), aa); g.lineWidth = Math.max(1, d * 0.05);
      for (let k = -1; k <= 1; k++) { const yy = k * r * 0.24; g.moveTo(-r * 0.42, yy); g.bezierCurveTo(-r * 0.14, yy + r * 0.16, r * 0.14, yy - r * 0.16, r * 0.42, yy); } g.stroke();
    });
    return n;
  }
  /** Region page (SPEC §3): 330×430 pt, region window, description, count / state line, ONE 240×52 button:
   *  前往X / 继续 / 再访X / 尚未开启 (flat disabled). Provider gate reasons still block (shown above the button). tide/sky extras stay. */
  function openChapter(stack: PopupStack, id: string, a: ChapterActions): PopupPanel {
    const c = CHAPTERS.find(x => x.id === id) || CHAPTERS[0], extra = id === 'tide' || id === 'sky';
    const v = stack.view(), K = 1 / popupScale(v.width, v.height), hPt = 430 + (extra ? 52 : 0) + 56, f = fitPt(v, hPt), P = (x: number) => x * K * f;
    const PW = P(Math.min(330, Math.max(240, v.width - 40)) / f), PH = P(hPt);
    const p = stack.open({ name: 'ChapterPanel', width: PW, height: PH, title: c.name, titleArt: c.id === 'tide' || c.id === 'meadow' || c.id === 'lake' ? 'r2/chapter_' + c.id : null, closable: true });
    const ww = PW - P(64), wh = ww * WIN_H / WIN_W; let y = P(56);
    const win = p.sprite('r2/region_' + c.id, 0, y + wh / 2, ww, wh); const row = a.row?.() || null; if (row && row.state === 'far') win.grayscale = true;
    const sealKey = 'popup/reward_seal_' + c.id; if (row?.state !== 'far') p.sprite(sealKey, -ww / 2 + P(22), y + P(22), P(40), P(40));
    y += wh + P(14);
    p.text(c.description, 0, y + P(10), P(15), 'brown2', { bold: false, width: PW - P(48), name: 'ChapterDescription' }); y += P(30);
    const gate = a.gate(), reason = gate?.reason, d = REGION_DEFS.find(x => x.id === c.id)!;
    const st: RegionRow = row || { id: c.id, done: 0, total: c.stages, state: gate?.ok ? 'open' : 'locked', hasData: true, isNew: false, tappable: true };
    const count = st.state === 'locked' || st.state === 'far' ? d.unlock.label : st.done + ' / ' + st.total + ' 关';
    p.text(count, 0, y, P(14), 'brown2', { bold: false, width: PW - P(48), name: 'ChapterCount' }); y += P(22);
    // Stars stay on the region page (SPEC §8): mainline x/12 and the region's challenge marks x/4.
    const ss = d.provider === 'mainline' && st.state !== 'locked' && st.state !== 'far' ? a.stats?.() : null;
    if (ss) { p.text('★ ' + ss.stars + '/12 · 挑战 ' + ss.challenges + '/4', 0, y, P(14), 'brown2', { bold: false, width: PW - P(48), name: 'ChapterStars' }); y += P(22); }
    if (c.id === 'coast' && st.hasData && st.state !== 'locked') { p.text(coastChapterHint(st.done), 0, y, P(14), 'teal', { width: PW - P(48), name: 'CoastChapter' }); y += P(22); }
    if (extra) { y += P(10);
      if (id === 'sky') p.button('secondary', '前往天空城 · 3D 场景', 0, y + P(21), P(240), P(42), () => a.skycity(), { fontSize: P(15), name: 'VisitSkycity' });
      if (id === 'tide') { const open = a.r4Open(); const b = p.button('secondary', open ? '旧日潮汐' : '旧日潮汐 · 未开启', 0, y + P(21), P(240), P(42), () => { if (a.r4Open()) a.legacyTide(); }, { fontSize: P(15), name: 'LegacyTide' }); b.setEnabled(open); }
      y += P(52); }
    const btn = chapterButton(st), blocked = reason === 'completion-unsaved' ? '先保存当前成绩' : ['finish-or-discard-current-attempt', 'pending-stage-start'].indexOf(reason) >= 0 ? '请先继续当前挑战' : null;
    const enabled = btn.enabled && !!gate?.ok, by = PH - P(26) - P(26);
    if (!enabled) p.text(blocked || (btn.enabled ? '暂不可进入' : d.unlock.label), 0, by - P(40), P(13), 'brown2', { bold: false, width: PW - P(48), name: 'ChapterCondition' });
    if (enabled) p.button('primary', btn.text, 0, by, P(240), P(52), () => { if (a.gate()?.ok) a.enter(); }, { fontSize: P(18), name: 'Continue-' + c.id });
    else flatDisabled(p, btn.enabled ? '暂不可进入' : '尚未开启', 0, by, P(240), P(52), 'Continue-' + c.id);
    p.button('secondary', '返回章节', 0, PH - P(4), P(140), P(36), () => p.close(a.back), { fontSize: P(14), name: 'BackToChapters', sound: 'back' });
    return p;
  }
  /** SPEC §3: no 3D button when not open; flat #E6D7B8 pill with #7A5A3A text, not tappable. */
  function flatDisabled(p: PopupPanel, text: string, x: number, y: number, w: number, h: number, name: string) {
    const n = uiNode(name, p.body, w, h), q = p.at(x, y); n.setPosition(q[0], q[1], 0);
    p.tint.shape(n.addComponent(Graphics), (g, night, a) => { g.fillColor = rgba(hex([0xE6, 0xD7, 0xB8], night), a); g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.fill(); });
    p.tint.label(makeLabel(n, text, 0, 0, h * 0.34, { width: w - 16, name: 'Label' }), 'brown2');
    (n as any).__disabled = true; return n;
  }
  /** Ending seals (SPEC §13.5): 9 holders in two rows 5+4, no backing plate; each seal carries a small soft shadow
   *  (colour 44,28,14, seal alpha × 0.42, ~2.2 pt blur, 2.5 pt down); unearned = cream blank seal (readable).
   *  Drop-in 240 ms each, 60 ms step, easeOutCubic. */
  function buildEndingSeals(parent: Node, tint: TintSet, ui: (p: Node, name: string, w: number, h: number) => Node, geo: { d: number; sp: number; gap: number; y: number }, yOf: (y: number) => number) {
    const reduced = reducedMotion(), m = JOURNEY_MOTION, d = geo.d;
    endingSeals(geo).forEach((sl, i) => {
      const holder = ui(parent, 'Seal-' + sl.id, d, d), p0 = new Vec3(sl.x, yOf(geo.y + sl.dy), 0), op = holder.addComponent(UIOpacity);
      const sh = ui(holder, 'Shadow', d, d); sh.setPosition(0, -2.5, 0);
      tint.shape(sh.addComponent(Graphics), (g, night, a) => { for (let k = 0; k < 4; k++) { g.fillColor = new Color(44, 28, 14, Math.round(255 * a * 0.42 / 4)); g.circle(0, 0, d * 0.47 + k * 0.75); g.fill(); } });
      if (sl.earned) { const s = artSprite(holder, 'popup/reward_seal_' + sl.id, 0, 0, d, d, 'Art'); tint.sprite(s, 'ui'); }
      else blankSeal({ tint }, holder, 0, 0, d, 1);
      if (reduced) { holder.setPosition(p0); op.opacity = 255; return; }
      op.opacity = 0; holder.setPosition(p0.x, p0.y + m.sealDropPt, 0); holder.setScale(0.9, 0.9, 1);
      tween(op).delay(i * m.sealStepS).to(m.sealDropS, { opacity: 255 }, { easing: 'cubicOut' }).start();
      tween(holder).delay(i * m.sealStepS).to(m.sealDropS, { position: p0, scale: new Vec3(1, 1, 1) }, { easing: 'cubicOut' }).start();
    });
  }
  return { version: JOURNEY_UI_VERSION, openJourney, openChapter, blankSeal, buildEndingSeals, rowStatusText, rowName, chapterButton, coastChapterHint, barShown, rowAppear, JOURNEY_MOTION };
}
export type JourneyUi = ReturnType<typeof createJourneyUi>;
(globalThis as any).__qfJourneyUi = { version: JOURNEY_UI_VERSION, create: createJourneyUi };
