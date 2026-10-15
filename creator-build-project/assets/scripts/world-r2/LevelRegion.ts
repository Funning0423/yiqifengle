/** Scene identity only; no progress, recovery or storage access.
 * Mainline 05–08 and meadow challenge stages require the real meadow 3D lease.
 * Mainline 09–12 and sky challenge stages require the real sky-city 3D lease. */
export type RegionSelection = { provider?: string; stageId?: string } | null;
export const MEADOW_UNAVAILABLE = 'meadow-requires-live-3d-background';
export type LevelBackgroundKind = 'meadow' | 'skycity' | 'picture';
export function requiresMeadowScene(selection: RegionSelection): boolean {
 const id = String(selection?.stageId || '');
 return /^r05-meadow-/.test(id) || /^mainline-0[5-8]$/.test(id);
}
export function requiresSkycityScene(selection: RegionSelection): boolean {
 const id = String(selection?.stageId || '');
 return /^r05-sky-/.test(id) || /^mainline-(09|1[0-2])$/.test(id);
}
/** Live 3D lease versus the static island/tide picture. Meadow wins if both patterns ever overlapped. */
export function levelBackgroundKind(selection: RegionSelection): LevelBackgroundKind {
 if (requiresMeadowScene(selection)) return 'meadow';
 if (requiresSkycityScene(selection)) return 'skycity';
 return 'picture';
}
