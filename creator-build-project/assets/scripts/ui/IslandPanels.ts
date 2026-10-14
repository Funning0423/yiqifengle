import { Color, Graphics, UITransform } from 'cc';
import { PopupPanel, PopupStack, uiNode } from './PopupKit';
import { tintRgb } from './NightTint';
/** Island-only panels (c-popups round2 compose_lite.journey_lite / compose2.island_rest): journey book, chapter page and
 *  the island rest opened from the cabin. Layout numbers are 750-design px. */
export const CHAPTERS: ReadonlyArray<{ id: 'tide' | 'meadow' | 'sky'; name: string; description: string }> = [
  { id: 'tide', name: '潮汐小径', description: '听潮声，捡起海浪送来的贝壳。' },
  { id: 'meadow', name: '花粉草甸', description: '花粉草甸挑战 · 棋盘沿用小岛背景，3D 场景尚未接入。' },
  { id: 'sky', name: '天空回声', description: '连起光的回声，探索云上的远方。' },
];
export interface ChapterSummary { stars: number; challenges: number; locked: boolean }
/** Mainline stars only (x/12 per region, levels region*4..+3); challenge marks x/4; a region is locked until the mainline reaches it. */
export function chapterSummary(journey: any, challenges: Record<string, number> | null | undefined, region: number, gate?: any): ChapterSummary {
  const records: any[] = Array.isArray(journey?.records) ? journey.records : [];
  let stars = 0; for (let i = region * 4; i < region * 4 + 4; i++) stars += Math.max(0, Math.min(3, Number(records[i]?.bestStars) || 0));
  const required = region * 4 + 3;
  return { stars, challenges: Math.max(0, Math.min(4, Number(challenges?.[CHAPTERS[region].id]) || 0)), locked: gate ? !gate.ok : !records[required]?.bestStars };
}
const SIGN_W = 544, SIGN_H = 176, GAP = 32, WIN_W = 208, WIN_H = 136;
export function openJourney(stack: PopupStack, journey: any, challenges: Record<string, number> | null | undefined, openChapter: (id: string) => void, gates?: any[]): PopupPanel {
  const ph = 104 + 3 * SIGN_H + 2 * GAP + 72, p = stack.open({ name: 'JourneyPanel', height: ph, title: '旅程册', titleArt: 'r2/title_journey', closable: true });
  for (let i = 0; i < CHAPTERS.length; i++) {
    const c = CHAPTERS[i], s = chapterSummary(journey, challenges, i, gates?.find(x => x.region === c.id)), cy = 104 + i * (SIGN_H + GAP) + SIGN_H / 2, ix = -SIGN_W / 2 + 24, tx = ix + WIN_W + 24;
    const b = p.button('secondary', '', 0, cy, SIGN_W, SIGN_H, () => openChapter(c.id), { name: 'Chapter-' + c.id });
    const face = b.node.getChildByName('Face')!; face.getChildByName('Plate')!.active = false;
    const sign = p.sprite('r2/sign_plank_3s', 0, 0, SIGN_W, SIGN_H, 'ui', face); sign.node.setPosition(0, 0, 0); sign.node.setSiblingIndex(0); sign.grayscale = s.locked;
    const win = p.sprite('r2/region_' + c.id, ix + WIN_W / 2, cy, WIN_W, WIN_H); win.grayscale = s.locked;
    const seal = p.sprite('popup/reward_seal_' + c.id, ix + 12, cy - WIN_H / 2 + 12, 64, 64); seal.grayscale = s.locked;
    if (s.locked) p.sprite('r2/icon_lock', ix + WIN_W / 2, cy, undefined, 64);
    const title = p.sprite('r2/chapter_' + c.id, 0, cy - 40); const tw = title.node.getComponent(UITransform)!.width; title.node.setPosition(tx + tw / 2, p.at(0, cy - 40)[1], 0); title.grayscale = s.locked;
    if (s.locked) { p.text('挑战需通关主线 ' + String((i + 1) * 4).padStart(2, '0'), tx, cy + 16, 24, 'grey', { align: 'left', width: 260, bold: false }); continue; }
    p.sprite('popup/star_full', tx + 16, cy + 8, 32, 32); p.text(s.stars + '/12', tx + 40, cy + 8, 24, 'brown', { align: 'left', width: 120 });
    const label = '挑战 ' + s.challenges + '/4', pill = uiNode('ChallengePill', p.body, 200, 36), pp = p.at(tx, cy + 52); pill.setPosition(pp[0], pp[1], 0);
    const w = 44 + label.length * 22;
    p.tint.shape(pill.addComponent(Graphics), (g, night, a) => {
      const fill = tintRgb('ui', night, [236, 244, 240]), edge = tintRgb('ui', night, [100, 168, 164]), flag = tintRgb('ui', night, [58, 120, 118]), al = Math.round(255 * a);
      g.fillColor = new Color(fill[0], fill[1], fill[2], al); g.roundRect(0, -18, w, 36, 18); g.fill();
      g.strokeColor = new Color(edge[0], edge[1], edge[2], al); g.lineWidth = 2; g.roundRect(0, -18, w, 36, 18); g.stroke();
      g.strokeColor = new Color(flag[0], flag[1], flag[2], al); g.lineWidth = 3; g.moveTo(16, 10); g.lineTo(16, -10); g.stroke();
      g.fillColor = new Color(flag[0], flag[1], flag[2], al); g.moveTo(17, 10); g.lineTo(29, 6); g.lineTo(17, 1); g.close(); g.fill();
    });
    p.text(label, tx + 30, cy + 52, 24, 'teal', { align: 'left', width: 200 });
  }
  return p;
}
export interface ChapterActions { gate: () => any; r4Open: () => boolean; enter: () => void; skycity: () => void; legacyTide: () => void; back: () => void }
/** Chapter page (no dedicated art yet): region window, the new description, the provider gate's button. */
export function openChapter(stack: PopupStack, id: string, a: ChapterActions): PopupPanel {
  const c = CHAPTERS.find(x => x.id === id) || CHAPTERS[0], extra = id === 'tide' || id === 'sky';
  const ph = 104 + 208 + 32 + 40 + 48 + 104 + (extra ? 24 + 96 : 0) + 24 + 96 + 72, p = stack.open({ name: 'ChapterPanel', height: ph, title: c.name, titleArt: 'r2/chapter_' + c.id, closable: true });
  p.sprite('r2/region_' + c.id, 0, 104 + 104, 320, 320 * WIN_H / WIN_W);
  p.text(c.description, 0, 104 + 208 + 32 + 20, 28, 'brown2', { bold: false, width: 600, name: 'ChapterDescription' });
  const gate = a.gate(), reason = gate?.reason;
  const blocked = reason === 'stage-locked' ? '需通关主线 ' + String((CHAPTERS.indexOf(c) + 1) * 4).padStart(2, '0') : reason === 'completion-unsaved' ? '先保存当前成绩' : ['finish-or-discard-current-attempt', 'pending-stage-start'].indexOf(reason) >= 0 ? '请先继续当前挑战' : '暂不可进入';
  let y = 104 + 208 + 32 + 40 + 48 + 52;
  const go = p.button('primary', gate?.ok ? '继续挑战' : blocked, 0, y, 480, 104, () => { if (a.gate()?.ok) a.enter(); }, { fontSize: 36, name: 'Continue-' + c.id }); go.setEnabled(!!gate?.ok);
  y += 52;
  if (id === 'sky') { y += 24 + 48; p.button('secondary', '前往天空城 · 3D 场景', 0, y, 480, 96, () => a.skycity(), { fontSize: 32, name: 'VisitSkycity' }); y += 48; }
  if (id === 'tide') { y += 24 + 48; const open = a.r4Open(); const b = p.button('secondary', open ? '旧日潮汐' : '旧日潮汐 · 未开启', 0, y, 480, 96, () => { if (a.r4Open()) a.legacyTide(); }, { fontSize: 32, name: 'LegacyTide' }); b.setEnabled(open); y += 48; }
  y += 24 + 48; p.button('secondary', '返回章节', 0, y, 480, 96, () => p.close(a.back), { fontSize: 32, name: 'BackToChapters', sound: 'back' });
  return p;
}
/** 海岛小憩 (opened by tapping the cabin): day / night windows (night = the day picture × K_SEA × 0.9), one primary button. */
export function openRest(stack: PopupStack, night: boolean, toggle: () => void): PopupPanel {
  const w = 232, h = 184, ph = 104 + 200 + 24 + 40 + 48 + 104 + 72, p = stack.open({ name: 'RestPanel', height: ph, title: '海岛小憩', titleArt: 'r2/title_rest', closable: true });
  const cy = 104 + h / 2 + 8;
  for (let k = 0; k < 2; k++) {
    const isNight = k === 1, cur = isNight === night, cx = (k - 0.5) * 264;
    p.well(cx, cy, w + 8, h + 8, cur ? [240, 196, 96] : [196, 166, 118], 24);
    const pic = p.sprite('r2/region_tide', cx, cy, w, h, isNight ? 'none' : 'ui'), sea = tintRgb('sea', 1);
    p.tint.setBase(pic, isNight ? [Math.round(sea[0] * 0.9), Math.round(sea[1] * 0.9), Math.round(sea[2] * 0.9)] : [255, 255, 255], cur ? 255 : 184);
    const label = isNight ? '夜色' : '晴昼', lw = label.length * 26 + 48, lx = cx - lw / 2;
    p.sprite(isNight ? 'popup/icon_moon' : 'popup/icon_sun', lx + 20, cy + h / 2 + 40, undefined, 40);
    p.text(label, lx + 48, cy + h / 2 + 40, 26, cur ? 'brown' : 'brown2', { align: 'left', width: 120 });
  }
  const arrow = uiNode('RestArrow', p.body, 28, 28), ap = p.at(0, 104 + 100); arrow.setPosition(ap[0], ap[1], 0);
  p.tint.shape(arrow.addComponent(Graphics), (g, n, a) => { const c = tintRgb('ui', n, [160, 128, 84]); g.fillColor = new Color(c[0], c[1], c[2], Math.round(255 * a)); g.moveTo(-12, 12); g.lineTo(14, 0); g.lineTo(-12, -12); g.close(); g.fill(); });
  p.button('primary', night ? '迎接晴昼' : '看看夜色', 0, 104 + 200 + 24 + 40 + 48 + 52, 440, 104, () => p.close(toggle), { icon: night ? 'popup/icon_sun' : 'popup/icon_moon', fontSize: 36, name: 'DayNight' });
  return p;
}
