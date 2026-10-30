/** Journey book / chapter page / ending seals logic (UI设计部 new-regions SPEC v1.1 e05a034e, approved). Pure: no 'cc'.
 *  Progress counts stages (not regions); the denominator is Σ stages of the regions that have level data, never fixed. */
export type RegionKey = 'tide' | 'meadow' | 'sky' | 'lake' | 'coast' | 'snow';
export type RowState = 'done' | 'progress' | 'open' | 'locked' | 'far';
export interface RegionDef { id: RegionKey; name: string; short: string; description: string; stages: number; color: number[]; provider: 'mainline' | 'r5'; lockedHint: string }
export const REGION_DEFS: ReadonlyArray<RegionDef> = [
  { id: 'tide', name: '潮汐小径', short: '潮汐小径', description: '听潮声，捡起海浪送来的贝壳。', stages: 4, color: [0x5F, 0xA8, 0xC8], provider: 'mainline', lockedHint: '' },
  { id: 'meadow', name: '花粉草甸', short: '花粉草甸', description: '走进风车草甸，听风铃，看看起伏的草浪。', stages: 4, color: [0x7D, 0xB5, 0x5A], provider: 'mainline', lockedHint: '主线 4 后开启' },
  { id: 'sky', name: '天空回声', short: '天空回声', description: '连起光的回声，探索云上的远方。', stages: 4, color: [0x8E, 0x9F, 0xD6], provider: 'mainline', lockedHint: '主线 8 后开启' },
  { id: 'lake', name: '风铃湖畔', short: '湖畔', description: '夕阳下的湖面，敲响漂在水上的风铃。', stages: 6, color: [0xE0, 0x9A, 0x5A], provider: 'r5', lockedHint: '主线 12 后开启' },
  { id: 'coast', name: '海岸', short: '海岸', description: '沿着海滩捡贝壳，一步步走向灯塔。', stages: 9, color: [0xE2, 0xB2, 0x5A], provider: 'r5', lockedHint: '主线 12 后开启' },
  { id: 'snow', name: '雪山隘口', short: '雪山', description: '踩着新雪，去山口听风铃。', stages: 6, color: [0x7F, 0x98, 0xCC], provider: 'r5', lockedHint: '湖畔通关后开启' },
];
/** Same journey record as the provider (progress-journal LAKE_GATE_RECORD / COAST_GATE_RECORD = 11): mainline 12 ≥1 star. */
export const LAKE_GATE_RECORD = 11, COAST_GATE_RECORD = 11;
export const JOURNEY_SEEN_DONE_KEY = 'qfl.ui.journeySeenDone', SEEN_REGIONS_KEY = 'qfl.ui.seenRegions';
/** SPEC §6 motion (registered in tools/ui-timing/known-timings.json). Panel enter/exit come from PopupKit (320/180 ms). */
export const JOURNEY_MOTION = { rowS: 0.2, rowStaggerS: 0.03, rowRisePt: 4, barGrowS: 0.6, sealDropS: 0.24, sealStaggerS: 0.08, sealDropPt: 10 } as const;
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
export function regionUnlocked(id: RegionKey, inp: JourneyInput): boolean {
  const r = inp.records;
  switch (id) {
    case 'tide': return true;
    case 'meadow': return star(r?.[3]);
    case 'sky': return star(r?.[7]);
    case 'lake': return star(r?.[LAKE_GATE_RECORD]);
    case 'coast': return star(r?.[COAST_GATE_RECORD]);           // parallel with the lake (SPEC §2.2)
    case 'snow': return regionUnlocked('lake', inp) && regionDone('lake', inp) >= 6;
  }
}
/** The region whose own progress opens `id` (the "next milestone"): known-locked when that one is open, else far. */
const GATE_OWNER: Readonly<Record<RegionKey, RegionKey | null>> = { tide: null, meadow: 'tide', sky: 'meadow', lake: 'sky', coast: 'sky', snow: 'lake' };
export interface RegionRow { id: RegionKey; done: number; total: number; state: RowState; hasData: boolean; isNew: boolean; tappable: boolean }
export function regionRow(id: RegionKey, inp: JourneyInput): RegionRow {
  const d = REGION_DEFS.find(r => r.id === id)!, data = hasData(id, inp.stages), done = regionDone(id, inp);
  const owner = GATE_OWNER[id], known = !owner || regionUnlocked(owner, inp);
  let state: RowState;
  if (!data) state = known ? 'locked' : 'far';                  // no level data: only 未开启 / 远方, never open (SPEC §2.2)
  else if (!regionUnlocked(id, inp)) state = known ? 'locked' : 'far';
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
/** Row right-hand text (SPEC §2.1). */
export function rowStatusText(r: RegionRow): string {
  const d = REGION_DEFS.find(x => x.id === r.id)!;
  if (r.state === 'done') return r.done + '/' + r.total;
  if (r.state === 'progress') return r.done + '/' + r.total + ' ›';
  if (r.state === 'open') return '可前往 ›';
  if (r.state === 'locked') return d.lockedHint;
  return '继续旅行后揭晓';
}
export function rowName(r: RegionRow): string { return r.state === 'far' ? '远方' : REGION_DEFS.find(x => x.id === r.id)!.name; }
/** Chapter page: the ONE button (SPEC §3): 前往X / 继续 / 再访X / 尚未开启 (flat disabled). */
export function chapterButton(r: RegionRow): { text: string; enabled: boolean; flat: boolean } {
  const s = REGION_DEFS.find(x => x.id === r.id)!.short;
  if (r.state === 'open') return { text: '前往' + s, enabled: true, flat: false };
  if (r.state === 'progress') return { text: '继续', enabled: true, flat: false };
  if (r.state === 'done') return { text: '再访' + s, enabled: true, flat: false };
  return { text: '尚未开启', enabled: false, flat: true };
}
/** Coast chapter hint: C1–C6 海岸漫游, C7+ 灯塔夜航. */
export function coastChapterHint(done: number): string { return done >= 6 ? '灯塔夜航' : '海岸漫游'; }
/** Ending seals (SPEC §4): n slots Ø40, pitch 48, ends droop Δy = 1.2·(i−c)². x/y in pt relative to the row centre. */
export function sealArc(n: number): Array<{ x: number; dy: number }> { const c = (n - 1) / 2, out = []; for (let i = 0; i < n; i++) out.push({ x: (i - c) * 48, dy: 1.2 * (i - c) * (i - c) }); return out; }
export const SEAL_D = 40;
export function sealArcWidth(n: number): number { return n > 0 ? (n - 1) * 48 + SEAL_D : 0; }
/** Bar growth from the last seen value, only when it changed (reduced → jump). Returns the shown done at time t. */
export function barShown(from: number, to: number, t: number, reduced: boolean): number {
  if (reduced || from === to) return to; const k = Math.max(0, Math.min(1, t / JOURNEY_MOTION.barGrowS)); const e = 1 - Math.pow(1 - k, 3); return from + (to - from) * e;
}
export function rowAppear(i: number, t: number, reduced: boolean): { alpha: number; dy: number } {
  const k = Math.max(0, Math.min(1, (t - i * JOURNEY_MOTION.rowStaggerS) / JOURNEY_MOTION.rowS)), e = 1 - Math.pow(1 - k, 3);
  return { alpha: e, dy: reduced ? 0 : JOURNEY_MOTION.rowRisePt * (1 - e) };
}
/** Ending seals earned (SPEC §4): the 4 shipped regions are always shown earned on the ending (unchanged behaviour);
 *  coast / snow only when the r5 journal claimed them (claimedRegions, noted by WorldNativeComposition.islandGates()). */
let claimedNoted: string[] = [];
export function noteClaimedRegions(list: unknown) { claimedNoted = Array.isArray(list) ? list.filter(x => typeof x === 'string') : []; }
export function endingSeals(claimed: ReadonlyArray<string> = claimedNoted): Array<{ id: RegionKey; earned: boolean; x: number; dy: number }> {
  const arc = sealArc(REGION_DEFS.length);
  return REGION_DEFS.map((d, i) => ({ id: d.id, earned: d.id === 'coast' || d.id === 'snow' ? claimed.includes(d.id) : true, x: arc[i].x, dy: arc[i].dy }));
}
