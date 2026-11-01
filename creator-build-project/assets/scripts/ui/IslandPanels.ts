import { Color, Graphics } from 'cc';
import { PopupPanel, PopupStack, uiNode } from './PopupKit';
import { tintRgb } from './NightTint';
/** Island-only panels (c-popups round2 compose_lite.journey_lite / compose2.island_rest): journey book, chapter page and
 *  the island rest opened from the cabin. Layout numbers are 750-design px. */
import { REGION_DEFS, RegionKey, RegionRow, JourneyInput, journeyRows } from './JourneyCore';
import { seenRegions } from './UiPrefs';
export type ChapterId = RegionKey;
/** new-regions SPEC §13: 9 regions; `stages` = stages counted by the journey bar, `color` = region colour. */
export const CHAPTERS: ReadonlyArray<{ id: ChapterId; name: string; short: string; subtitle?: string; description: string; stages: number; color: number[] }> = REGION_DEFS.map(d => ({ id: d.id, name: d.name, short: d.short, subtitle: d.subtitle, description: d.description, stages: d.stages, color: d.color }));
/** 风铃湖畔 has no mainline stages of its own: it opens after mainline 12 (journey record 11, same as the provider's
 *  progress-journal LAKE_GATE_RECORD) and has 6 challenge stages. */
export const LAKE_GATE_RECORD = 11, LAKE_STAGES = 6;
export function chapterMilestone(region: number): number { return CHAPTERS[region]?.id === 'lake' ? LAKE_GATE_RECORD + 1 : (region + 1) * 4; }
export interface ChapterSummary { stars: number; challenges: number; locked: boolean; done: number; total: number; state: RegionRow['state'] }
/** Island data (overlay → panels): mainline journey + the composition's islandGates() (challenges counts, stage refs). */
export function journeyInput(journey: any, challenges: Record<string, number> | null | undefined, gates?: any): JourneyInput {
  return { records: Array.isArray(journey?.records) ? journey.records : [], regionDone: (challenges || {}) as any,
    stages: Array.isArray(gates?.stages) ? gates.stages : null, seen: seenRegions(), lastPlayed: gates?.lastPlayed || null };
}
/** Mainline stars (x/12 per region, levels region*4..+3) and challenge marks stay on the chapter page; done/total/state per SPEC §2.1. */
export function chapterSummary(journey: any, challenges: Record<string, number> | null | undefined, region: number, gate?: any, stages?: any): ChapterSummary {
  const records: any[] = Array.isArray(journey?.records) ? journey.records : [];
  const c = CHAPTERS[region], r5 = REGION_DEFS[region]?.provider === 'r5';
  let stars = 0; if (!r5) for (let i = region * 4; i < region * 4 + 4; i++) stars += Math.max(0, Math.min(3, Number(records[i]?.bestStars) || 0));
  const required = r5 && c?.id !== 'lake' ? LAKE_GATE_RECORD : chapterMilestone(region) - 1;
  const row = journeyRows({ records, regionDone: challenges as any, stages: stages || defaultStages() }).find(x => x.id === c?.id);
  let locked = gate ? !gate.ok : !records[required]?.bestStars; if (row && (row.state === 'locked' || row.state === 'far')) locked = true;
  return { stars, challenges: Math.max(0, Math.min(r5 ? c.stages : 4, Number(challenges?.[c?.id]) || 0)), locked, done: row?.done || 0, total: c?.stages || 0, state: row?.state || 'far' };
}
/** Without a stage list (tests / older callers) the shipped regions count as having data; coast / snow do not. */
export function defaultStages() { return [{ id: 'r05-lake-01', region: 'lake' }]; }
export interface ChapterActions { gate: () => any; r4Open: () => boolean; enter: () => void; skycity: () => void; legacyTide: () => void; back: () => void; row?: () => RegionRow | null; stats?: () => { stars: number; challenges: number } | null }
/** Journey book / region page / ending seals: lazy UI in bundles/board_art/journey_ui, reached through ui/JourneyUi.ts. */
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
