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
 /** World offset of the sky platform LANDING point from the meadow exit (walk_path_08). d28ee16: [24,12,0] to the far
  * outer rim, then a 17.6 m walk round the post (+13.7 s, rejected). Build05 original: [0,12,24] to the inner anchor. */
 skycityOffset:[18,12,0] as Vec,
 /** World heading (deg, 0=+Z, 90=+X) of the rainbow bridge as it arrives at the landing; the city is turned so the
  * bridge meets the platform rim radially there. Same +X heading as d28ee16, so the bridge centreline does not move sideways. */
 skyHeadingDeg:90,
 /** Deck frame on the terminus platform: along = end→start (metres from anchor_cloudbridge_end), lateral = 90° left of
  * along, height above that anchor. Measured on env_sky_static_palette: deck radius ≈ 7.5 m centred at along −6.5,
  * centre post at along −8…−4 / |lateral| ≤ 1, city cloud-bridge deck +0.28 m from along 0.35, |lateral| ≤ 1.
  * The rim slab reaches r ≈ 8.1 m. The bridge now ends just outside the SIDE rim (r 8.33, next to the city's cloud bridge)
  * and the walk carries straight on across the deck to the cloud-bridge step: 8.6 m plus the unchanged 2.05 m entry,
  * instead of 17.6 m round the post.
  * v3.2 (option B): landing and walk mirrored to the platform's other side (lateral −; landing nudged to [−3,−7.9] to clear the foliage cards); the city turns so the
  * plaza is ahead-left of her on the deck and the right-side lens can frame it without crossing behind her. */
 skyLanding:[-3,-7.9,.06] as readonly [number,number,number],
 skyPlatformWalk:[[-.7,-2.29,.08],[-.2,-1.15,.15],[.05,-.8,.3]] as ReadonlyArray<readonly [number,number,number]>,
 /** The city's cloud-bridge deck starts 0.26 m ABOVE the platform just past anchor_cloudbridge_end. Step onto it 0.35 m in,
  * then keep the original 2.4 m arrival root. */
 skyStepOnto:[.35,-.6,.31] as readonly [number,number,number],
 /** v3 local lens keys for 08→09, metres from the rainbow bridge START (see RegionJourneyCore.LensKey). Under the sky
  * city the lens rises and pulls back so the city's grey underside stays ≤ 10% of the frame (lead review: 73–84 s). v3.2: sideM −2.4 = her RIGHT (was +2.4, her left);
  * at the 66° meadow-exit → bridge corner the lens swings wider right (−6.5 m) so it is right of behind for both headings. */
 skyLens:[{at:-8.5},{at:-4.5,upM:4.5,backM:6.6,lookM:1.6,sideM:-2.4},{at:1,upM:4.5,backM:6.6,lookM:1.6,sideM:-6.5},{at:5,upM:4.5,backM:6.6,lookM:1.6,sideM:-2.4},{at:15,upM:4.5,backM:6.6,lookM:1.6,sideM:-2.4},{at:19}] as ReadonlyArray<Readonly<{at:number;upM?:number;backM?:number;sideM?:number;lookM?:number}>>,
 bridgeWidthM:2.1,meadowBridgeArchM:2,skyBridgeArchM:2,speedMps:1.2,bridgeSamples:32,meadowExitPathIndex:8,skyEntryWalkM:2.4,
} as const;
export const plus=(a:Vec,b:Vec):Vec=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export function bridgePath(a:Vec,b:Vec,arch:number):Vec[]{const out:Vec[]=[];for(let i=0;i<=REGION_JOURNEY_LAYOUT.bridgeSamples;i++){const t=i/REGION_JOURNEY_LAYOUT.bridgeSamples;out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+Math.sin(Math.PI*t)*arch,a[2]+(b[2]-a[2])*t]);}return out;}
export function islandApproach(start:Vec):Vec[]{return [start,plus(start,REGION_JOURNEY_LAYOUT.islandApproach)];}
/** Deck-frame helpers from (already placed or unrotated) anchors. */
function deckFrame(end:Vec,gate:Vec){const dx=gate[0]-end[0],dz=gate[2]-end[2],h=Math.hypot(dx,dz)||1,u=[dx/h,dz/h],n=[-u[1],u[0]];
 const at=(a:number,l:number,lift:number):Vec=>[end[0]+u[0]*a+n[0]*l,end[1]+lift,end[2]+u[1]*a+n[1]*l];return {u,n,at};}
/** Horizontal direction the bridge travels as it reaches the landing: straight on toward the first deck waypoint. */
export function skyApproachDir(end:Vec,gate:Vec):[number,number]{const L=REGION_JOURNEY_LAYOUT,{at}=deckFrame(end,gate),a=at(L.skyLanding[0],L.skyLanding[1],0),w=L.skyPlatformWalk[0]??L.skyStepOnto,c=at(w[0],w[1],0),x=c[0]-a[0],z=c[2]-a[2],h=Math.hypot(x,z)||1;return [x/h,z/h];}
/** Y rotation (deg, Cocos setRotationFromEuler) that turns the inbound approach direction, measured UNROTATED, to skyHeadingDeg. */
export function skycityYawDeg(endLocal:Vec,startLocal:Vec):number{const [x,z]=skyApproachDir(endLocal,startLocal);return REGION_JOURNEY_LAYOUT.skyHeadingDeg-Math.atan2(x,z)*180/Math.PI;}
/** Deck route from already-placed anchors: side-rim landing → onto the cloud-bridge deck → the original arrival root
 * (2.4 m from anchor_cloudbridge_end toward anchor_cloudbridge_start, unchanged from Build05). `rim` = landing point. */
export function skyDeckRoute(end:Vec,gate:Vec):{rim:Vec;deck:Vec[];arrival:Vec}{
 const L=REGION_JOURNEY_LAYOUT,{at}=deckFrame(end,gate);
 const length=Math.hypot(gate[0]-end[0],gate[1]-end[1],gate[2]-end[2]),t=Math.min(1,L.skyEntryWalkM/length);
 return {rim:at(...L.skyLanding),deck:[...L.skyPlatformWalk.map(([a,l,lift])=>at(a,l,lift)),at(...L.skyStepOnto)],arrival:[end[0]+(gate[0]-end[0])*t,end[1]+(gate[1]-end[1])*t,end[2]+(gate[2]-end[2])*t]};
}
/** Route lens keys from bridge-relative metres to route metres. */
export function lensKeys(keys:ReadonlyArray<Readonly<{at:number;upM?:number;backM?:number;sideM?:number;lookM?:number}>>,bridgeStart:number){return keys.map(k=>({...k,at:k.at+bridgeStart}));}
