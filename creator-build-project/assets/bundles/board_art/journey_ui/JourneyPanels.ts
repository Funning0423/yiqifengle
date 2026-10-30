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
const SHORT: Record<string, string> = { tide: '潮汐小径', meadow: '花粉草甸', sky: '天空回声', lake: '湖畔', coast: '海岸', snow: '雪山' };
const HINT: Record<string, string> = { tide: '', meadow: '主线 4 后开启', sky: '主线 8 后开启', lake: '主线 12 后开启', coast: '主线 12 后开启', snow: '湖畔通关后开启' };
export function createJourneyUi(h: JourneyUiHost) {
  const { Color, Graphics, UIOpacity, Vec3, isValid, tween } = h.cc;
  const { artSprite, makeLabel, measure, popupScale, pressable, uiNode, tintRgb, journeySeenDone, lastRegion, markRegionSeen, reducedMotion, seenRegions, setJourneySeenDone,
    REGION_DEFS, CHAPTERS, journeyRows, journeyProgress, focusRegion, journeyInput, endingSeals, SEAL_D } = h;
  /** SPEC §6 motion (registered in tools/ui-timing/known-timings.json). Panel enter/exit come from PopupKit (320/180 ms). */
  const JOURNEY_MOTION = { rowS: 0.2, rowStaggerS: 0.03, rowRisePt: 4, barGrowS: 0.6, sealDropS: 0.24, sealStaggerS: 0.08, sealDropPt: 10 } as const;
  /** Row right-hand text (SPEC §2.1). */
  function rowStatusText(r: RegionRow): string {
    const d = r;
    if (r.state === 'done') return r.done + '/' + r.total;
    if (r.state === 'progress') return r.done + '/' + r.total + ' ›';
    if (r.state === 'open') return '可前往 ›';
    if (r.state === 'locked') return HINT[d.id];
    return '继续旅行后揭晓';
  }
  function rowName(r: RegionRow): string { return r.state === 'far' ? '远方' : REGION_DEFS.find(x => x.id === r.id)!.name; }
  /** Chapter page: the ONE button (SPEC §3): 前往X / 继续 / 再访X / 尚未开启 (flat disabled). */
  function chapterButton(r: RegionRow): { text: string; enabled: boolean; flat: boolean } {
    const s = SHORT[r.id];
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
    const k = Math.max(0, Math.min(1, (t - i * JOURNEY_MOTION.rowStaggerS) / JOURNEY_MOTION.rowS)), e = 1 - Math.pow(1 - k, 3);
    return { alpha: e, dy: reduced ? 0 : JOURNEY_MOTION.rowRisePt * (1 - e) };
  }
  const WIN_W = 208, WIN_H = 136;
  /** Landscape / very short viewports: shrink the pt layout uniformly so the fixed-height panel keeps 8 pt margins. */
  function fitPt(v: { width: number; height: number }, hPt: number) { return Math.min(1, Math.max(0.3, (v.height - 16) / hPt)); }
  const hex = (c: number[], night: number) => tintRgb('ui', night, c);
  function rgba(c: number[], a: number) { return new Color(c[0], c[1], c[2], Math.round(255 * Math.max(0, Math.min(1, a)))); }
  /** Journey book (SPEC §2): fixed panel min(330, W−40) × 520 pt (466 when H < 700): progress, focus card, 5 compact rows. */
  function openJourney(stack: PopupStack, journey: any, challenges: Record<string, number> | null | undefined, openChapter: (id: string) => void, _r5Gates?: any, island?: { stages?: any; lastPlayed?: any } | null): PopupPanel {
    const v = stack.view(), sc = popupScale(v.width, v.height), K = 1 / sc, short = v.height < 700;
    const phPt = short ? 466 : 520, cardH = short ? 92 : 112, rowH = short ? 44 : 50, f = fitPt(v, phPt), pwPt = Math.min(330, Math.max(240, v.width - 40)) / f;
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
    const card = uiNode('Chapter-' + focusId, p.body, CW, CH), cp = p.at(0, cy); card.setPosition(cp[0], cp[1], 0);
    const face = uiNode('Face', card, CW, CH);
    p.tint.shape(face.addComponent(Graphics), (gg, night, a) => { gg.fillColor = rgba(hex([0xD9, 0xBF, 0x8C], night), a); gg.roundRect(-CW / 2, -CH / 2 - P(3), CW, CH, P(16)); gg.fill(); gg.fillColor = rgba(hex([0xFF, 0xF6, 0xE2], night), a); gg.roundRect(-CW / 2, -CH / 2, CW, CH, P(16)); gg.fill(); });
    const wW = P(short ? 104 : 120), wH = wW * 78 / 120, wx = -CW / 2 + P(10) + wW / 2;
    const win = artSprite(face, 'r2/region_' + focusId, wx, 0, wW, wH, 'Window'); p.tint.sprite(win, 'ui');
    const fs = artSprite(face, 'popup/reward_seal_' + focusId, wx - wW / 2 + P(8), wH / 2 - P(8), P(30), P(30), 'Seal'); p.tint.sprite(fs, 'ui');
    const tx = wx + wW / 2 + P(12), tw = CW / 2 - tx - P(10);
    p.tint.label(makeLabel(face, fd.name, tx, P(22), P(18), { align: 'left', width: tw, name: 'Name' }), 'brown');
    p.tint.label(makeLabel(face, fr.done + ' / ' + fr.total + ' 关', tx, 0, P(14), { align: 'left', width: tw, bold: false, name: 'Count' }), 'brown2');
    p.tint.label(makeLabel(face, chapterButton(fr).enabled ? (fr.state === 'done' ? '再访 ›' : fr.state === 'open' ? '前往 ›' : '继续 ›') : '尚未开启', tx, -P(22), P(14), { align: 'left', width: tw, name: 'Go' }), 'teal');
    if (fr.isNew) redDot(p, face, tx + Math.min(tw, measure(fd.name, P(18))) + P(6), P(30), P(7));
    pressable(card, face, () => { markRegionSeen(focusId); openChapter(focusId); });
    // Compact rows: the other 5 regions in CHAPTERS order.
    const list = rows.filter(r => r.id !== focusId), y0 = P(116) + CH + P(16), RW = Math.min(P(282), PW - P(48));
    const nodes: Node[] = [];
    list.forEach((r, i) => {
      const ry = y0 + i * P(rowH) + P(rowH) / 2, n = uiNode('Chapter-' + r.id, p.body, RW, P(rowH)), rp = p.at(0, ry); n.setPosition(rp[0], rp[1], 0);
      const c = uiNode('Face', n, RW, P(rowH)), hl = uiNode('Pressed', c, RW, P(rowH)); hl.active = false;
      p.tint.shape(hl.addComponent(Graphics), (gg, night, a) => { gg.fillColor = rgba(hex([0xE9, 0xD6, 0xAE], night), a * 0.67); gg.roundRect(-RW / 2, -P(rowH) / 2, RW, P(rowH), P(8)); gg.fill(); });
      if (i > 0) { const dash = uiNode('Divider', c, RW, 2); dash.setPosition(0, P(rowH) / 2, 0); p.tint.shape(dash.addComponent(Graphics), (gg, night, a) => { gg.fillColor = rgba(hex([0xE3, 0xCF, 0xA6], night), a); for (let x = -RW / 2; x < RW / 2; x += P(6)) gg.rect(x, -P(0.5), P(3), P(1)); gg.fill(); }); }
      const far = r.state === 'far', locked = r.state === 'locked', sx = -RW / 2 + P(20);
      if (far) blankSeal(p, c, sx, 0, P(32), 1); else { const s = artSprite(c, 'popup/reward_seal_' + r.id, sx, 0, P(32), P(32), 'Seal'); p.tint.sprite(s, 'ui', [255, 255, 255], locked ? 166 : 255); s.grayscale = locked; }
      const nm = rowName(r), nx = sx + P(24);
      p.tint.label(makeLabel(c, nm, nx, 0, P(16), { align: 'left', width: P(110), name: 'Name' }), far || locked ? 'brown2' : 'brown');
      if (r.isNew) redDot(p, c, nx + measure(nm, P(16)) + P(4), P(8), P(7));
      const st = rowStatusText(r), rx = RW / 2 - P(8) - (r.state === 'done' ? P(24) : 0);
      p.tint.label(makeLabel(c, st, rx, 0, P(locked ? 13 : 14), { align: 'right', width: P(150), bold: r.state === 'progress', name: 'Status' }), r.state === 'progress' || r.state === 'open' ? 'teal' : 'brown2');
      if (r.state === 'done') checkMark(p, c, RW / 2 - P(17), 0, P(18));
      if (r.tappable) pressable(n, c, () => { markRegionSeen(r.id); openChapter(r.id); }, { onPress: d => { if (isValid(hl, true)) hl.active = d; } });
      nodes.push(c);
    });
    // Motion (SPEC §6): rows 200 ms, 30 ms stagger, 4 pt rise; bar grows 600 ms only when the total changed since last open.
    const ops = nodes.map(c => c.addComponent(UIOpacity));
    const step = () => { for (let i = 0; i < nodes.length; i++) { const k = rowAppear(i, t, reduced); ops[i].opacity = Math.round(255 * k.alpha); nodes[i].setPosition(0, -P(k.dy), 0); }
      const s = barShown(from, prog.done, t, reduced); if (s !== shown) { shown = s; p.tint.repaint(g); } };
    step(); p.onTick(dt => { if (t > JOURNEY_MOTION.barGrowS + 0.4) return; t += dt; step(); });
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
    const p = stack.open({ name: 'ChapterPanel', width: PW, height: PH, title: c.name, titleArt: c.id === 'coast' || c.id === 'snow' ? null : 'r2/chapter_' + c.id, closable: true });
    const ww = PW - P(64), wh = ww * WIN_H / WIN_W; let y = P(56);
    const win = p.sprite('r2/region_' + c.id, 0, y + wh / 2, ww, wh); const row = a.row?.() || null; if (row && row.state === 'far') win.grayscale = true;
    const sealKey = 'popup/reward_seal_' + c.id; if (row?.state !== 'far') p.sprite(sealKey, -ww / 2 + P(22), y + P(22), P(40), P(40));
    y += wh + P(14);
    p.text(c.description, 0, y + P(10), P(15), 'brown2', { bold: false, width: PW - P(48), name: 'ChapterDescription' }); y += P(30);
    const gate = a.gate(), reason = gate?.reason, d = REGION_DEFS.find(x => x.id === c.id)!;
    const st: RegionRow = row || { id: c.id, done: 0, total: c.stages, state: gate?.ok ? 'open' : 'locked', hasData: true, isNew: false, tappable: true };
    const count = st.state === 'locked' || st.state === 'far' ? HINT[d.id] : st.done + ' / ' + st.total + ' 关';
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
    if (!enabled) p.text(blocked || (btn.enabled ? '暂不可进入' : HINT[d.id]), 0, by - P(40), P(13), 'brown2', { bold: false, width: PW - P(48), name: 'ChapterCondition' });
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
  /** Ending seals (SPEC §4): 6 holders on the arc; earned = seal art, else blank seal α0.85; drop-in 240 ms, 80 ms stagger. */
  function buildEndingSeals(parent: Node, tint: TintSet, ui: (p: Node, name: string, w: number, h: number) => Node, yOf: (dy: number) => number) {
    const reduced = reducedMotion(), m = JOURNEY_MOTION;
    endingSeals().forEach((sl, i) => {
      const holder = ui(parent, 'Seal-' + sl.id, SEAL_D, SEAL_D), p0 = new Vec3(sl.x, yOf(sl.dy), 0), op = holder.addComponent(UIOpacity);
      if (sl.earned) { const s = artSprite(holder, 'popup/reward_seal_' + sl.id, 0, 0, SEAL_D, SEAL_D, 'Art'); tint.sprite(s, 'ui'); }
      else blankSeal({ tint }, holder, 0, 0, SEAL_D, 0.85);
      if (reduced) { holder.setPosition(p0); op.opacity = 255; return; }
      op.opacity = 0; holder.setPosition(p0.x, p0.y + m.sealDropPt, 0); holder.setScale(0.9, 0.9, 1);
      tween(op).delay(i * m.sealStaggerS).to(m.sealDropS, { opacity: 255 }, { easing: 'cubicOut' }).start();
      tween(holder).delay(i * m.sealStaggerS).to(m.sealDropS, { position: p0, scale: new Vec3(1, 1, 1) }, { easing: 'cubicOut' }).start();
    });
  }
  return { version: JOURNEY_UI_VERSION, openJourney, openChapter, blankSeal, buildEndingSeals, rowStatusText, rowName, chapterButton, coastChapterHint, barShown, rowAppear, JOURNEY_MOTION };
}
export type JourneyUi = ReturnType<typeof createJourneyUi>;
(globalThis as any).__qfJourneyUi = { version: JOURNEY_UI_VERSION, create: createJourneyUi };
