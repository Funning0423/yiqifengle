/** Journey book / chapter page / ending seals logic (UI设计部 new-regions SPEC v1.1 e05a034e, approved). Pure: no 'cc'.
 *  Progress counts stages (not regions); the denominator is Σ stages of the regions that have level data, never fixed. */
export type RegionKey = 'tide' | 'meadow' | 'sky' | 'lake' | 'coast' | 'snow' | 'rail' | 'cloud' | 'spring';
export type RowState = 'done' | 'progress' | 'open' | 'locked' | 'far';
/** SPEC §13.2: `requires` = all must hold; 'main:N' = mainline N has ≥1 star, a region id = that region fully cleared.
 *  `label` = the ≤5-char condition shown on a known-locked cell. */
export interface RegionUnlock { requires: ReadonlyArray<string>; label: string }
export interface RegionDef { id: RegionKey; name: string; short: string; subtitle?: string; description: string; stages: number; color: number[]; provider: 'mainline' | 'r5'; unlock: RegionUnlock }
/** 9 regions (SPEC §13 / nine/PLAN.md §3 names). Full name: focus card, region page; short: grid cells. */
export const REGION_DEFS: ReadonlyArray<RegionDef> = [
  { id: 'tide', name: '潮汐小径', short: '潮汐小径', description: '听潮声，捡起海浪送来的贝壳。', stages: 4, color: [0x5F, 0xA8, 0xC8], provider: 'mainline', unlock: { requires: [], label: '' } },
  { id: 'meadow', name: '花粉草甸', short: '花粉草甸', description: '走进风车草甸，听风铃，看看起伏的草浪。', stages: 4, color: [0x7D, 0xB5, 0x5A], provider: 'mainline', unlock: { requires: ['main:4'], label: '主线04后' } },
  { id: 'sky', name: '天空之城', short: '天空之城', subtitle: '天空回声', description: '连起光的回声，探索云上的远方。', stages: 4, color: [0x8E, 0x9F, 0xD6], provider: 'mainline', unlock: { requires: ['main:8'], label: '主线08后' } },
  { id: 'lake', name: '风铃湖畔', short: '风铃湖畔', description: '夕阳下的湖面，敲响漂在水上的风铃。', stages: 6, color: [0xE0, 0x9A, 0x5A], provider: 'r5', unlock: { requires: ['main:12'], label: '主线12后' } },
  { id: 'coast', name: '星光灯塔海岸', short: '灯塔海岸', description: '沿着海滩捡贝壳，一步步走向灯塔。', stages: 9, color: [0xE2, 0xB2, 0x5A], provider: 'r5', unlock: { requires: ['main:12'], label: '主线12后' } },
  { id: 'snow', name: '雪山风铃山口', short: '雪山山口', description: '踩着新雪，去山口听风铃。', stages: 6, color: [0x7F, 0x98, 0xCC], provider: 'r5', unlock: { requires: ['lake'], label: '湖畔通关后' } },
  { id: 'rail', name: '秋日铁路', short: '秋日铁路', description: '', stages: 6, color: [0xC9, 0x77, 0x3A], provider: 'r5', unlock: { requires: ['coast'], label: '海岸通关后' } },
  { id: 'cloud', name: '黎明云海', short: '黎明云海', description: '', stages: 8, color: [0xE8, 0xA0, 0xA8], provider: 'r5', unlock: { requires: ['snow'], label: '雪山通关后' } },
  { id: 'spring', name: '温泉谷', short: '温泉谷', description: '', stages: 8, color: [0x6F, 0xB8, 0xA8], provider: 'r5', unlock: { requires: ['rail', 'cloud'], label: '铁路云海后' } },
];
/** Same journey record as the provider (progress-journal LAKE_GATE_RECORD / COAST_GATE_RECORD = 11): mainline 12 ≥1 star. */
export const LAKE_GATE_RECORD = 11, COAST_GATE_RECORD = 11;
export const JOURNEY_SEEN_DONE_KEY = 'qfl.ui.journeySeenDone', SEEN_REGIONS_KEY = 'qfl.ui.seenRegions';
export interface StageRef { id: string; region: string }
export interface JourneyInput {
  records?: ReadonlyArray<{ bestStars?: number } | null | undefined> | null;   // mainline journey records[0..11]
  regionDone?: Readonly<Partial<Record<RegionKey, number>>> | null;            // r5 cleared stage counts (lake / coast / snow)
  stages?: ReadonlyArray<StageRef> | null;                                       // API.allStages || API.catalog (id + region)
  seen?: ReadonlyArray<string> | null;                                           // qfl.ui.seenRegions
  lastPlayed?: RegionKey | null;
}
const star = (r: any) => (Number(r?.bestStars) || 0) > 0;
/** A region has data when the provider lists ≥1 stage for it (mainline regions always do). */
export function hasData(id: RegionKey, stages: ReadonlyArray<StageRef> | null | undefined): boolean {
  const d = REGION_DEFS.find(r => r.id === id); if (!d) return false; if (d.provider === 'mainline') return true;
  return !!stages && stages.some(s => s && s.region === id);
}
export function regionDone(id: RegionKey, inp: JourneyInput): number {
  const i = REGION_DEFS.findIndex(r => r.id === id), d = REGION_DEFS[i];
  if (d.provider === 'mainline') { let n = 0; for (let k = i * 4; k < i * 4 + 4; k++) if (star(inp.records?.[k])) n++; return n; }
  return Math.max(0, Math.min(d.stages, Number(inp.regionDone?.[id]) || 0));
}
const def = (id: string) => REGION_DEFS.find(d => d.id === id);
/** One requirement holds: 'main:N' → mainline N ≥1 star; region id → that region has data, is open and fully cleared. */
function holds(req: string, inp: JourneyInput): boolean {
  const m = /^main:(\d+)$/.exec(req); if (m) return star(inp.records?.[Number(m[1]) - 1]);
  const d = def(req); return !!d && hasData(d.id, inp.stages) && regionUnlocked(d.id, inp) && regionDone(d.id, inp) >= d.stages;
}
export function regionUnlocked(id: RegionKey, inp: JourneyInput): boolean {
  const d = def(id); return !!d && !!d.unlock && d.unlock.requires.every(r => holds(r, inp));
}
export interface RegionRow { id: RegionKey; done: number; total: number; state: RowState; hasData: boolean; isNew: boolean; tappable: boolean }
export function regionRow(id: RegionKey, inp: JourneyInput): RegionRow {
  const d = def(id)!, data = hasData(id, inp.stages) && !!d.unlock, done = regionDone(id, inp);
  let state: RowState;
  if (!data) state = 'far';                                     // §13.2: no stage data / no unlock → 远方, not tappable, not counted
  else if (!regionUnlocked(id, inp)) state = 'locked';          // P3 (UI设计部 r4): data but locked → faint seal + condition label, never 远方
  else state = done >= d.stages ? 'done' : done > 0 ? 'progress' : 'open';
  const isNew = state === 'open' && !(inp.seen || []).includes(id);
  return { id, done, total: d.stages, state, hasData: data, isNew, tappable: state !== 'far' };
}
export function journeyRows(inp: JourneyInput): RegionRow[] { return REGION_DEFS.map(d => regionRow(d.id, inp)); }
export interface Segment { id: RegionKey; stages: number; done: number; color: number[]; x0: number; x1: number }
/** Segmented bar: only regions with data; widths = stages / total of the full bar (gaps drawn by the caller). */
export function journeyProgress(inp: JourneyInput): { done: number; total: number; segments: Segment[] } {
  const rows = REGION_DEFS.filter(d => hasData(d.id, inp.stages));
  const total = rows.reduce((a, d) => a + d.stages, 0); let x = 0, done = 0; const segments: Segment[] = [];
  for (const d of rows) { const n = regionUnlocked(d.id, inp) ? regionDone(d.id, inp) : 0, w = total ? d.stages / total : 0; segments.push({ id: d.id, stages: d.stages, done: n, color: d.color, x0: x, x1: x + w }); x += w; done += n; }
  return { done, total, segments };
}
/** Focus: last played (if tappable), else first progress/open region, else (all done) the last region with data. */
export function focusRegion(inp: JourneyInput, rows = journeyRows(inp)): RegionKey {
  if (inp.lastPlayed) { const r = rows.find(x => x.id === inp.lastPlayed); if (r && (r.state === 'progress' || r.state === 'open' || r.state === 'done')) return r.id; }
  const live = rows.find(r => r.state === 'progress' || r.state === 'open'); if (live) return live.id;
  const done = rows.filter(r => r.state === 'done'); return (done.length ? done[done.length - 1] : rows[0]).id;
}
/** Ending seals (SPEC §13.5): two rows 5 + 4, row 2 offset half a pitch and `gap` lower; each row droops 1.0·(i−c)². */
export function sealRows9(sp: number, gap: number, rows: 1 | 2 = 2): Array<{ x: number; dy: number }> {
  const out = [];
  if (rows === 1) { for (let i = 0; i < 9; i++) out.push({ x: (i - 4) * sp, dy: 0 }); return out; }   // UI设计部 r3 ④: one flat centred row, left→right
  for (let i = 0; i < 9; i++) { const c = i < 5 ? i - 2 : i - 6.5; out.push({ x: c * sp, dy: (i < 5 ? 0 : gap) + c * c }); } return out;
}
/** Ending seals earned: the 4 shipped regions are always shown earned on the ending (unchanged behaviour); the others only when the r5 journal claimed them (claimedRegions, noted by WorldNativeComposition.islandGates()). */
let claimedNoted: string[] = [];
export function noteClaimedRegions(list: unknown) { claimedNoted = Array.isArray(list) ? list.filter(x => typeof x === 'string') : []; }
export function endingSeals(geo: { sp: number; gap: number; rows?: 1 | 2 }, claimed: ReadonlyArray<string> = claimedNoted): Array<{ id: RegionKey; earned: boolean; x: number; dy: number }> {
  const pos = sealRows9(geo.sp, geo.gap, geo.rows ?? 2);
  return REGION_DEFS.map((d, i) => ({ id: d.id, earned: d.provider === 'mainline' || d.id === 'lake' ? true : claimed.includes(d.id), x: pos[i].x, dy: pos[i].dy }));
}
