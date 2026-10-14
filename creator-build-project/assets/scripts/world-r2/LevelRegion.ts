/** Scene identity only; no progress, recovery or storage access.
 * Mainline 05–08 are the second region. Keep them unavailable until the
 * approved meadow model, Creator prefab identity, camera and full background
 * lease are integrated. A changed level number is not a scene transition. */
export type RegionSelection = { provider?: string; stageId?: string } | null;
export const MEADOW_UNAVAILABLE = 'meadow-scene-not-integrated';
export function requiresMeadowScene(selection: RegionSelection): boolean {
  const id = String(selection?.stageId || '');
  return /^r05-meadow-/.test(id) || /^mainline-0[5-8]$/.test(id);
}
export function boardSceneRequirement(selection: RegionSelection): { ok: boolean; reason?: string } {
  return requiresMeadowScene(selection) ? { ok: false, reason: MEADOW_UNAVAILABLE } : { ok: true };
}
