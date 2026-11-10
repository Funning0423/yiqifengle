/** Scene identity only; no progress, recovery or storage access.
 * Mainline 05–08 and meadow challenge stages require the real meadow 3D lease. */
export type RegionSelection = { provider?: string; stageId?: string } | null;
export const MEADOW_UNAVAILABLE = 'meadow-requires-live-3d-background';
export function requiresMeadowScene(selection: RegionSelection): boolean {
 const id = String(selection?.stageId || '');
 return /^r05-meadow-/.test(id) || /^mainline-0[5-8]$/.test(id);
}

/** 风铃湖畔 challenges (r04-lake-*) render the live region_lakeside scene. */
export function requiresLakesideScene(selection:RegionSelection):boolean {
 const id=String(selection?.stageId||'');return /^r0[45]-lake-\d+$/.test(id)||/^mainline-1[3-6]$/.test(id)/* b18: mainline 13–16 = 风铃湖畔 */;
}

/** 雪山风铃山口 (r06-snow-*) renders the live region_snowpass scene. The board sits on the snow shelf. */
export function requiresSnowpassScene(selection:RegionSelection):boolean {
 const id=String(selection?.stageId||'');return /^r06-snow-\d+$/.test(id);
}

/** 秋日铁路 (r07-rail-*) renders the live region_rail scene. The board sits on the station platform. */
export function requiresRailScene(selection:RegionSelection):boolean {
 const id=String(selection?.stageId||'');return /^r07-rail-\d+$/.test(id);
}

/** 黎明云海 (r08-cloud-*) renders the live region_cloudsea scene. The board sits on the cloud terrace. */
export function requiresCloudseaScene(selection:RegionSelection):boolean {
 const id=String(selection?.stageId||'');return /^r08-cloud-\d+$/.test(id);
}

/** 温泉谷 (r09-spring-*) renders the live region_hotspring scene. The board sits on the wooden deck. */
export function requiresHotspringScene(selection:RegionSelection):boolean {
 const id=String(selection?.stageId||'');return /^r09-spring-\d+$/.test(id);
}

/** 峡湾极光栈道 (r10-fjord-*) renders the live region_fjord scene. The board sits on the wooden pier. */
export function requiresFjordScene(selection:RegionSelection):boolean {
 const id=String(selection?.stageId||'');return /^r10-fjord-\d+$/.test(id);
}

/** 沙漠绿洲庭院 (r11-oasis-*) renders the live region_oasis scene. The board is painted into the sand-brick court. */
export function requiresOasisScene(selection:RegionSelection):boolean {
 const id=String(selection?.stageId||'');return /^r11-oasis-\d+$/.test(id);
}

/** 白阶海港台地 (r12-harbor-*) renders the live region_harbor scene. The board is painted into the limestone terrace. */
export function requiresHarborScene(selection:RegionSelection):boolean {
 const id=String(selection?.stageId||'');return /^r12-harbor-\d+$/.test(id);
}

/** 石灯苔庭 (r13-mossgarden-*) renders the live region_mossgarden scene. The board is painted into the raked court. */
export function requiresMossgardenScene(selection:RegionSelection):boolean {
 const id=String(selection?.stageId||'');return /^r13-mossgarden-\d+$/.test(id);
}

export function requiresSkycityScene(selection:RegionSelection):boolean {
 const id=String(selection?.stageId||'');return /^r05-sky-/.test(id)||/^mainline-(09|1[0-2])$/.test(id);
}
