/** Scene identity only; no progress, recovery or storage access.
 * Mainline 05–08 and meadow challenge stages require the real meadow 3D lease. */
export type RegionSelection = { provider?: string; stageId?: string } | null;
export const MEADOW_UNAVAILABLE = 'meadow-requires-live-3d-background';
export function requiresMeadowScene(selection: RegionSelection): boolean {
 const id = String(selection?.stageId || '');
 return /^r05-meadow-/.test(id) || /^mainline-0[5-8]$/.test(id);
}
