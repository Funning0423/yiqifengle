import type {Vec} from '../world-r1/WorldFlowCore';
/** Pure journey placement (no engine imports) so the occlusion test samples the exact production numbers.
 * Metre scale, rigid placement only. Build05 occlusion fix (Oi FAIL 2026-10-16):
 *  - 04→05: the old straight +Z approach put the bridge's first metres under beach_palm_tall's canopy and through
 *    env_prop_palm_lean_01's trunk. The approach now ends 0.8 m to +X, which threads the 2.1 m bridge between both trunks.
 *  - 08→09: the rainbow bridge used to land on anchor_cloudbridge_end, which is the INNER edge of the city's round terminus
 *    platform, so its last ~17 m climbed under that platform and its 4.4 m centre post (character up to 6 m below the
 *    env_sky_static_palette top; Oi measured 2.27 m at 32.22 m). The bridge now lands on the platform's OUTER rim,
 *    walks around the post on the deck to the same anchor, and the city sits beside the meadow exit (+X) instead of
 *    over the meadow's far half, where the windmill pierced the city. The final 2.4 m entry is unchanged. */
export const REGION_JOURNEY_LAYOUT={
 /** Island approach end, relative to the standing root (exit_path_17). Was [0,0,3.2]. */
 islandApproach:[0.8,0,3.2] as Vec,
 /** Kept for older readers: forward component of islandApproach. */
 islandApproachM:3.2,
 meadowOffset:[0,0,24] as Vec,
 /** World offset of the sky platform's OUTER rim from the meadow exit (walk_path_08). Was [0,12,24] to the inner anchor. */
 skycityOffset:[24,12,0] as Vec,
 /** World heading (deg, 0=+Z, 90=+X) of the city's own cloud bridge (end→start). Must equal the skycityOffset heading
  * so the rainbow bridge arrives head-on at the rim. Was an implicit 0 (yaw 215 on this GLB). */
 skyHeadingDeg:90,
 /** Deck frame on the terminus platform: along = end→start, lateral = 90° left of along. Measured on
  * env_sky_static_palette: deck radius ≈ 7.5 m centred 6.5 m outward from anchor_cloudbridge_end, post radius ≈ 2.2 m. */
 skyPlatformRimM:13.6,
 /** [along, lateral, height above anchor_cloudbridge_end]. The deck is domed (+0.21 m near the post), so each
  * waypoint carries its measured deck height + ~3 cm; linear segments between them stay on or just above the deck. */
 skyPlatformWalk:[[-10,3.4,.2],[-6.5,3.8,.24],[-3,3.4,.14]] as ReadonlyArray<readonly [number,number,number]>,
 skyRimLiftM:.02,
 /** The city's cloud-bridge deck starts 0.26 m ABOVE the platform right after anchor_cloudbridge_end (a step the old
  * straight entry walked through). Cross it onto the deck 0.35 m in, then keep the original 2.4 m arrival root. */
 skyStepOnto:[.35,0,.31] as readonly [number,number,number],
 bridgeWidthM:2.1,meadowBridgeArchM:2,skyBridgeArchM:2,speedMps:1.2,bridgeSamples:32,meadowExitPathIndex:8,skyEntryWalkM:2.4,
} as const;
export const plus=(a:Vec,b:Vec):Vec=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export function bridgePath(a:Vec,b:Vec,arch:number):Vec[]{const out:Vec[]=[];for(let i=0;i<=REGION_JOURNEY_LAYOUT.bridgeSamples;i++){const t=i/REGION_JOURNEY_LAYOUT.bridgeSamples;out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+Math.sin(Math.PI*t)*arch,a[2]+(b[2]-a[2])*t]);}return out;}
export function islandApproach(start:Vec):Vec[]{return [start,plus(start,REGION_JOURNEY_LAYOUT.islandApproach)];}
/** Y rotation (deg, Cocos setRotationFromEuler) that turns the city's end→start direction, measured UNROTATED, to skyHeadingDeg. */
export function skycityYawDeg(endLocal:Vec,startLocal:Vec):number{const a=Math.atan2(startLocal[0]-endLocal[0],startLocal[2]-endLocal[2])*180/Math.PI;return REGION_JOURNEY_LAYOUT.skyHeadingDeg-a;}
/** Deck route from already-placed anchors. rim → around the post → onto the cloud-bridge deck → the original arrival root
 * (2.4 m from anchor_cloudbridge_end toward anchor_cloudbridge_start, unchanged from Build05). */
export function skyDeckRoute(end:Vec,gate:Vec):{rim:Vec;deck:Vec[];arrival:Vec}{
 const L=REGION_JOURNEY_LAYOUT,dx=gate[0]-end[0],dz=gate[2]-end[2],h=Math.hypot(dx,dz)||1,u=[dx/h,dz/h],n=[-u[1],u[0]];
 const at=(a:number,l:number,lift:number):Vec=>[end[0]+u[0]*a+n[0]*l,end[1]+lift,end[2]+u[1]*a+n[1]*l];
 const length=Math.hypot(gate[0]-end[0],gate[1]-end[1],gate[2]-end[2]),t=Math.min(1,L.skyEntryWalkM/length);
 return {rim:at(-L.skyPlatformRimM,0,L.skyRimLiftM),deck:[...L.skyPlatformWalk.map(([a,l,lift])=>at(a,l,lift)),at(...L.skyStepOnto)],arrival:[end[0]+(gate[0]-end[0])*t,end[1]+(gate[1]-end[1])*t,end[2]+(gate[2]-end[2])*t]};
}
