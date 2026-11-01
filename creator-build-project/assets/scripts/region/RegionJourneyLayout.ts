import type {Vec} from '../world-r1/WorldFlowCore';
/** Pure journey placement (no engine imports) so the occlusion test samples the exact production numbers.
 * Metre scale, rigid placement only. Build05 occlusion fix (Oi FAIL 2026-10-16):
 *  - 04→05: the old straight +Z approach put the bridge's first metres under beach_palm_tall's canopy and through
 *    env_prop_palm_lean_01's trunk. The approach now ends 0.8 m to +X, which threads the 2.1 m bridge between both trunks.
 *  - 08→09: the old walking leg used to land on anchor_cloudbridge_end, which is the INNER edge of the city's round terminus
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
 /** Sail only: estuary M0 sits this far from dock I6. Bridge mode still uses meadowOffset. */
 sailMeadowOffset:[0,0,52] as Vec,
 /** Last metres of the sail route follow the river centreline. */
 sailRiverEntryM:12,
 /** World offset of the sky platform LANDING point from the meadow exit (walk_path_08). d28ee16: [24,12,0] to the far
  * outer rim, then a 17.6 m walk round the post (+13.7 s, rejected). Build05 original: [0,12,24] to the inner anchor. */
 skycityOffset:[18,12,0] as Vec,
 /** World heading (deg, 0=+Z, 90=+X) of the placement span as it reaches the landing; the city is turned so the
  * bridge meets the platform rim radially there. Same +X heading as d28ee16, so the bridge centreline does not move sideways. */
 skyHeadingDeg:90,
 /** Deck frame on the terminus platform: along = end→start (metres from anchor_cloudbridge_end), lateral = 90° left of
  * along, height above that anchor. Measured on env_sky_static_palette: deck radius ≈ 7.5 m centred at along −6.5,
  * centre post at along −8…−4 / |lateral| ≤ 1, city cloud-bridge deck +0.28 m from along 0.35, |lateral| ≤ 1.
  * The rim slab reaches r ≈ 8.1 m. The bridge now ends just outside the SIDE rim (r 8.33, next to the city's cloud bridge)
  * and the walk carries straight on across the deck to the cloud-bridge step: 8.6 m plus the unchanged 2.05 m entry,
  * instead of 17.6 m round the post. */
 skyLanding:[-3.47,7.78,.06] as readonly [number,number,number],
 skyPlatformWalk:[[-.29,1.3,.08],[-.05,.8,.3]] as ReadonlyArray<readonly [number,number,number]>,
 /** The city's cloud-bridge deck starts 0.26 m ABOVE the platform just past anchor_cloudbridge_end. Step onto it 0.35 m in,
  * then keep the original 2.4 m arrival root. */
 skyStepOnto:[.35,0,.31] as readonly [number,number,number],
 /** v3 local lens keys for 08→09, metres from the travel segment START (see RegionJourneyCore.LensKey). Under the sky
  * city the lens rises and pulls back so the city's grey underside stays ≤ 10% of the frame (lead review: 73–84 s). v3.2: sideM −2.4 = her RIGHT (was +2.4, her left);
  * at the 66° meadow-exit → bridge corner the lens swings wider right so it is right of behind for both headings.
  * Landing A final: on her right the lens sits higher/further (6.5–7 m up, 9 m back, 0.5–1.2 m right, a short 8 m swing right at
  * the 66° corner) and ramps up from 11 m before the bridge, keeping the underside ≤ 10% (F3) and the night sky in view (F4) with no lift. */
 skyLens:[{at:-11},{at:-7,upM:6.5,backM:9,lookM:2.4,sideM:-1.2},{at:-0.2,upM:6.5,backM:9,lookM:2.4,sideM:-8},{at:1.3,upM:6.5,backM:9,lookM:2.4,sideM:-5.5},{at:4.5,upM:7,backM:9,lookM:2.4,sideM:-1},{at:8,upM:6.5,backM:9,lookM:2.4,sideM:-0.5},{at:15,upM:6.5,backM:9,lookM:2.4,sideM:-0.5},{at:19}] as ReadonlyArray<Readonly<{at:number;upM?:number;backM?:number;sideM?:number;lookM?:number}>>,
 bridgeWidthM:2.1,meadowBridgeArchM:2,skyBridgeArchM:2,speedMps:1.2,bridgeSamples:32,meadowExitPathIndex:8,skyEntryWalkM:2.4,
 /** Meadow → sky city balloon placement. liftM is +40 (the §10 cap): +30 leaves the rock strata below meadow terrain + 8 m. */
 balloonSkyOffset:{liftM:40,rangeM:45,groundClearM:8} as const,
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
/** 04→05 landing (r4.1, 3 tools, hint banner above the tray per GGbot 260ea02): her stand line after the arrival,
 *  meadow model coordinates (= board copy local), y = meadow_terrain top (≤ 0.8 m apart, feet within 3 cm). The old arrival
 *  walk_path_01 → 02 sat under the left tool icon. From player_spawn she walks 6.5 m up the left of the trodden path into the
 *  lower-left of the board view, between the tray and the tool row (left of the icons). She STOPS where THIS screen's board UI
 *  leaves her most room (RegionBoardLanding.regionGirlStand: tray, goal plate, 3 tool icons + ring/badge, hint banner at its
 *  max width, pause, capsule, safe bands) among the stops whose 08→09 walk keeps O5 (meadowExitExtraM ≤ MEADOW_EXIT_BUDGET_M).
 *  The line keeps to the strip where the 08→09 follow lens stays on her right (F7b) when she sets off from it. */
export const MEADOW_STAND_LOCAL:ReadonlyArray<Vec>=[[-0.267,1.304,19.333],[-0.533,1.347,18.667],[-0.8,1.429,18.0],[-1.033,1.505,17.417],[-1.267,1.575,16.833],[-1.5,1.641,16.25],[-1.5,1.667,16.0],[-1.25,1.722,15.5],[-1.0,1.778,15.0],[-0.8,1.829,14.5],[-0.8,1.88,14.0]];
/** O5 (lead: 08→09 ≤ Build05 + 3 s at 1.2 m/s). Leaving from walk_path_02 the r4 route is already +2.64 s, so a stand may add at
 *  most (3 - 2.64) s x 1.2 m/s = 0.432 m to the 08→09 walk; test-journey-occlusion O5 checks the total. */
export const MEADOW_EXIT_BUDGET_M=0.432;
/** 08→09 leaves the meadow from wherever she stands: the meadow exit anchors (walk_path_03..08, world) still ahead of her.
 *  Her spot is projected (x/z) onto the polyline walk_path_02..08; anchors less than 1 m past that point are behind her. She
 *  then heads for the first anchor ahead whose onward path turns ≤ meadowRejoinTurnDeg from her heading to it, so the follow
 *  lens never has to swing round a sharp corner right after set-off (08→09 framing F1/F7b). Standing on walk_path_02 (the old
 *  landing) gives 03..08: byte-for-byte the old route. */
export const MEADOW_REJOIN={aheadM:1,turnDeg:45} as const;
export function meadowExitFrom(start:Vec,path02to08:ReadonlyArray<Vec>):Vec[]{
 const P=path02to08,cp=(p:Vec):Vec=>[p[0],p[1],p[2]];if(P.length<2)return P.slice(1).map(cp);
 const arc:number[]=[0];for(let i=1;i<P.length;i++)arc.push(arc[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]));
 let best=Infinity,s0=0;
 for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],dx=b[0]-a[0],dz=b[2]-a[2],l2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((start[0]-a[0])*dx+(start[2]-a[2])*dz)/l2)),
  d=Math.hypot(a[0]+dx*t-start[0],a[2]+dz*t-start[2]);if(d<best-1e-9){best=d;s0=arc[i-1]+t*Math.sqrt(l2);}}
 const head=(a:Vec,b:Vec)=>Math.atan2(b[0]-a[0],b[2]-a[2]),turn=(x:number,y:number)=>{let d=Math.abs(x-y)%(2*Math.PI);return (d>Math.PI?2*Math.PI-d:d)*180/Math.PI;};
 let k=-1;for(let i=1;i<P.length;i++)if(arc[i]>s0+MEADOW_REJOIN.aheadM){if(k<0)k=i;if(i===P.length-1||turn(head(start,P[i]),head(P[i],P[i+1]))<=MEADOW_REJOIN.turnDeg){k=i;break;}}
 return k<0?[cp(P[P.length-1])]:P.slice(k).map(cp);}

/** Extra 08→09 walk (m, x/z) when she leaves from `start` instead of walk_path_02 (path02to08[0]). */
export function meadowExitExtraM(start:Vec,path02to08:ReadonlyArray<Vec>):number{
 const L=(p:ReadonlyArray<Vec>)=>{let s=0;for(let i=1;i<p.length;i++)s+=Math.hypot(p[i][0]-p[i-1][0],p[i][2]-p[i-1][2]);return s;};
 return L([start,...meadowExitFrom(start,path02to08)])-L(path02to08);}
