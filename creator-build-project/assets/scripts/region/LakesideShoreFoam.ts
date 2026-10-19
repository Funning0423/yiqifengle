import { EffectAsset, Material, MeshRenderer, Node, Vec4, isValid, resources } from 'cc';
import { LAKE_FOAM, lakesideShoreLight } from '../render/ShoreFoamCore';
import { SHORE_FOAM_EFFECT, shoreFoamMaterial } from '../render/ShoreFoam';
import { lakesideModeLighting, type LakesideDayNight } from './LakesideSceneData';
import { lakesideDayNightMode } from './LakesideJourneyAtmosphere';
/** r5 S3 lakeside shore wash: LK_shore_foam.glb is the shore ribbon (tools/scene-fx/lakeside_shore_ribbon.cjs). Every mount
 *  (board lease and island->lakeside journey) gives its ribbon one shore-foam.effect material (USE_CC_TIME: the swash runs on
 *  the shader clock; USE_LIT: lit by the lakeside main light + ambient, so dusk / night follow the scene). Day / night light
 *  scales are the water's own (applyLakesideWaterMode calls applyLakesideShoreMode). Alpha blend: the static merge skips it,
 *  enableLakesideInstancing leaves it alone. If the effect does not load the ribbon is switched off (never the palette ring). */
export const LAKESIDE_SHORE_GLB = 'LK_shore_foam.glb';
const shoreSet = new WeakSet<Material>();
let shoreMats: Material[] = [];
export function isLakesideShoreMaterial(m: Material | null | undefined): boolean { return !!m && shoreSet.has(m); }
function writeMode(m: Material, mode: LakesideDayNight): void {
  const M = lakesideModeLighting(mode), l = lakesideShoreLight(M.waterMainLightScale, M.waterAmbientScale);
  m.setProperty('lightParams', new Vec4(l[0], l[1], l[2], l[3]));
}
/** Day / night: the same mode the water is written for. Returns how many live shore materials were written. */
export function applyLakesideShoreMode(mode: LakesideDayNight): number {
  const live: Material[] = []; let n = 0;
  for (let i = 0; i < shoreMats.length; i++) { const m = shoreMats[i]; if (!isValid(m, true)) continue; live.push(m); try { writeMode(m, mode); n++; } catch (e) { /* keep going */ } }
  shoreMats = live; return n;
}
function loadEffect(): Promise<EffectAsset | null> {
  return new Promise<EffectAsset | null>(function (ok) {
    try { resources.load(SHORE_FOAM_EFFECT, EffectAsset, (e: Error | null, fx: EffectAsset) => { if (e || !fx) { console.warn('[QF_LAKESIDE] ' + JSON.stringify({ event: 'shore-foam-effect-failed', error: String(e) })); ok(null); } else ok(fx); }); }
    catch (e) { ok(null); }
  });
}
function off(nodes: Node[]): void { for (let i = 0; i < nodes.length; i++) { const rs = nodes[i].getComponentsInChildren(MeshRenderer); for (let k = 0; k < rs.length; k++) rs[k].enabled = false; } }
/** Never throws. take() holds the material for the caller's lifetime (released with the other mounted assets). */
export async function mountLakesideShore(nodes: Node[], take: <T extends { addRef(): unknown; decRef(): unknown }>(a: T) => T): Promise<number> {
  if (!nodes.length) return 0;
  const fx = await loadEffect(); let n = 0;
  try {
    if (!fx) { off(nodes); return 0; }
    const m = take(shoreFoamMaterial(fx, LAKE_FOAM, { USE_CC_TIME: true, USE_LIT: true }));
    shoreSet.add(m); shoreMats.push(m); writeMode(m, lakesideDayNightMode());
    for (let i = 0; i < nodes.length; i++) {
      if (!isValid(nodes[i], true)) continue;
      const rs = nodes[i].getComponentsInChildren(MeshRenderer);
      for (let k = 0; k < rs.length; k++) { const r = rs[k]; r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; r.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF; for (let s = 0; s < r.sharedMaterials.length; s++) { r.setSharedMaterial(m, s); n++; } }
    }
  } catch (e) { off(nodes); console.warn('[QF_LAKESIDE] ' + JSON.stringify({ event: 'shore-foam-failed', error: String(e) })); return 0; }
  return n;
}
