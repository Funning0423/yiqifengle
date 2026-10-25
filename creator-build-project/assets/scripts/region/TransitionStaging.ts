/** Transition staging = 场景设计部 b19 data (scene/b19-transition-spaces 0197512: tools/transition-spaces/stances.json +
 *  STANCES.md), copied here as code constants (no runtime JSON load). Frames as STANCES.md: island = sail-journey world;
 *  meadow = env_meadow local; skycity = env_skycity local; boat = transport_sailboat root (+z bow, +x port); basket =
 *  transport_balloon root (floor top y 0, door wall +Z). Geometry (island_dock, sail_gangway, balloon_step_stool,
 *  sky_mooring_deck) arrives later as its own SHA: TransitionProps draws swappable placeholders ONLY when those named nodes
 *  are absent. Durations live in TRANSITION_DURATIONS (one table, Grok Bot may retune). */
import type {Vec} from '../world-r1/WorldFlowCore';
export const STAGING_SOURCE='scene/b19-transition-spaces 0197512';
export const TRANSITION_STAGING=Object.freeze({
 /** Segment 1 (island frame). */
 island:{
  /** I4 → … : the baked I4–I6 edge's waypoint, then the dock ramp. */
  toDock:[[0.5,0.002,7.3],[-0.5,0,7.7],[-1.4,0,8.2],[-1.45,-0.18,8.9]] as Vec[],
  i6New:[-1.5,-0.18,9.3] as Vec,i6YawDeg:0,
  dockMid:[-1.5,-0.18,11.6] as Vec,dockBoard:[-1.402,-0.14,12.222] as Vec,dockBoardYawDeg:88.8,
  dockDeck:{x:[-2.5,-1.1],z:[8.9,14.4],top:-0.18},dockRamp:{x:[-1.7,-1.1],z:[8.2,8.9],top:[0,-0.18]},
  /** boat frame, starboard: gunwale → hatch step → floor → sit start; seated root (0,0.06,−0.55). */
  boardBoat:[[-0.70,0.60,0.15],[-0.12,0.33,0.15],[0,0.06,-0.04],[0,0.06,-0.15]] as Vec[],
 },
 /** Segment 2 (boat frame, port) → landing_step (existing SAIL_LANDING_STEP_LOCAL). */
 meadowLanding:{standUpEnd:[0,0.06,-0.056] as Vec,offBoat:[[0.12,0.33,0.15],[0.70,0.60,0.15],[1.30,0.35,0.15]] as Vec[]},
 gangway:{lengthM:0.75,widthM:0.5,hingeIsland:[-0.70,0.56,0.15] as Vec,hingeMeadow:[0.70,0.56,0.15] as Vec,downDegIsland:14,downDegMeadow:-20},
 /** Segments 3 / 4 / 5a basket staging (basket frame). */
 basket:{outside:[-0.45,0,1.50] as Vec,outsideYawDeg:164.7,doorOut:[0,0,1.25] as Vec,stool:[0,-0.05,1.05] as Vec,threshold:[0,0,0.84] as Vec,
  p0:[0.03,0,0.395] as Vec,seat:[0.032,0,-0.099] as Vec,seatYawDeg:0,doorHinge:[0.4,0,0.84] as Vec,doorOpenDeg:100,doorS:0.8},
 /** Segment 3 (meadow frame): new launch point (old one clips wind_bell_frame / windmill sweep) — NOT applied, flight path is 运镜bot's. */
 meadow:{m4:[3,5.84,-16.4] as Vec,toBasket:[[3,6.322,-20.4],[2.6,6.341,-20.8],[2.6,6.45,-21.7]] as Vec[],launch:[3.6,6.60,-23.4] as Vec,basketObstacleR:1.1},
 /** Segment 4 (skycity frame): mooring deck, step-down landing, deck front edge, new S0. Basket root y 0.01 (+0.12 m vs flight end key). */
 skycity:{stepDown:[5.192,-0.02,42.262] as Vec,deckEdge:[5.107,-0.02,41.519] as Vec,s0New:[5.25,-0.084,40.6] as Vec,s0YawDeg:177.6,s1:[5.4,-0.087,37.0] as Vec,basketRootY:0.01},
 /** Segment 5a mooring (skycity frame) — pending Grok Bot; NOT applied (lakeside keeps lakesideBalloonMooring). */
 skyMooring5a:{pos:[2.8,0.01,-37.8] as Vec,yawDeg:0,pending:true},
 walkMps:0.9,basketWalkMps:0.8,
});
/** Compression retime (Grok Bot 2026-10-25: caps island→meadow ≤45 s, meadow→skycity ≤50 s, skycity→lakeside ≤40 s).
 *  Flight/sail shot lengths only: consumed by the EXISTING clock remaps (BalloonFlight rideToFlightT, SkyLakeContinuous
 *  liftWarp) — path geometry untouched. Her action beats below stay at natural speed (clips 1.0×, walk speed unchanged).
 *   meadowRideS     meadow→skycity ride clock (was 30). 20 s needs >90°/s camera yaw with the 0–12 s seam cues kept at
 *                   rate 1 (sweep: 20 s 198°/s, 22 s 121°/s, 24 s 80.6°/s) → 24 s is the shortest within the 90°/s cap.
 *   meadowRideTailS rate-1 tail before the end of the ride (touchdown at meadowRideS−1; was 5).
 *   meadowRideRampS smoothstep rate ramp (was 2; 3 keeps the rate C1 step < 0.02/frame at cruise ×3.0; yaw max 80.6°/s).
 *   lakeLiftS       screen seconds of T-03's 18 s hidden lift-off (was 6; 运镜bot sweep: 5 s → 66.9°/s on 390×844).
 *   lakeFlightS     T-03 visible flight, retimed from its 12 s with rate-1 ends (≥ 8 s, Grok Bot). */
export const TRANSITION_RETIME=Object.freeze({meadowRideS:24,meadowRideTailS:3,meadowRideRampS:3,lakeLiftS:5,lakeFlightS:8,lakeFlightMinS:8,
 caps:{islandToMeadow:45,meadowToSkycity:50,skycityToLakeside:40}});
/** Seconds per beat (STANCES.md). One table (Grok Bot may retune). Compress: the pauses after stand_up are dead time → 0;
 *  flight / liftoff come from TRANSITION_RETIME. Action beats unchanged. */
export const TRANSITION_DURATIONS=Object.freeze({
 seg1:{nodeWalkI4toI6:15.6,a1DockWalk:3.0,a2Gangway:2.3,sitDown:1.2},
 seg2:{dockSettle:2.0,standUp:1.27,offBoat:2.7,jettyToM1:16.5},
 seg3:{toBasket:5.7,doorReach:1.8,intoBasket:2.6,turn180:1.5,sitDown:1.2,inflate:3.0,flight:TRANSITION_RETIME.meadowRideS},
 seg4:{settle:1.5,standUp:1.27,pause:0,doorReach:1.8,stepDown:1.73,toPath:7.5},
 seg5a:{toBasket:8.0,doorReach:1.8,intoBasket:2.6,turn180:1.5,sitDown:1.2,inflate:3.0,liftoff:TRANSITION_RETIME.lakeLiftS,flight:TRANSITION_RETIME.lakeFlightS},
 seg5b:{settle:1.5,standUp:1.27,pause:0,doorReach:1.8,stepDown:1.73,walkOut:7.7},
});
/** Plain sum of every beat (no overlap) — kept for comparison with the 59aa0bbc table. */
export function segmentTotals(D=TRANSITION_DURATIONS):Record<string,number>{const o:Record<string,number>={};
 for(const [k,v] of Object.entries(D))o[k]=Math.round(Object.values(v as Record<string,number>).reduce((a,b)=>a+b,0)*100)/100;
 o.meadowToSkycity=Math.round((o.seg3+o.seg4)*100)/100;o.skycityToLakeside=Math.round((o.seg5a+o.seg5b)*100)/100;return o;}
/** B5 deck walk as BalloonTransit plays it: min(table, max(1.5, path / walkMps)) over stepDown → deckEdge → new S0. */
export function b5ToPathS(cap:number=TRANSITION_DURATIONS.seg4.toPath):number{const K=TRANSITION_STAGING.skycity,p=[K.stepDown,K.deckEdge,K.s0New];let L=0;
 for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]);return Math.min(cap,Math.max(1.5,L/TRANSITION_STAGING.walkMps));}
export type Beat={id:string;t0:number;t1:number;overlapsWith?:string};
const r2=(x:number)=>Math.round(x*100)/100;
/** Overlap-aware timeline (what the compressed runtime plays). Overlaps:
 *  · ignition + inflate start with the walk to the basket (seg3 B1, seg5a C1); only the remainder (if the walk + door + step-in
 *    is shorter than the fill) delays liftoff;
 *  · door close runs inside sit_down (closeS 0.6 < sit 1.2) and liftoff starts the frame she is seated;
 *  · settle = the last 1.0 s of the ride clock (BALLOON_DOOR settleT0..T1), already inside the flight (59aa0bbc's table added
 *    it again on top); stand_up + door_reach follow the settle with no pause.
 *  walkS overrides (real path seconds, e.g. T-03 R.walkS for the lakeside mooring) recompute the totals from data. */
export function transitionTimeline(D=TRANSITION_DURATIONS,o:{lakeWalkS?:number;meadowWalkS?:number}={}){
 const seq=(beats:Array<[string,number]>,t=0):Beat[]=>beats.map(([id,d])=>{const b={id,t0:r2(t),t1:r2(t+d)};t+=d;return b;});
 const s1=seq(Object.entries(D.seg1)),s2=seq(Object.entries(D.seg2));
 const m=D.seg3,mw=o.meadowWalkS??m.toBasket,mIn=mw+m.doorReach+m.intoBasket+m.turn180+m.sitDown,mIgn=Math.max(0,m.inflate-mIn);
 const s3=[...seq([['toBasket',mw],['doorReach',m.doorReach],['intoBasket',m.intoBasket],['turn180',m.turn180],['sitDown',m.sitDown],['igniteRemainder',mIgn],['flight',m.flight]]),
  {id:'inflate',t0:0,t1:r2(m.inflate),overlapsWith:'toBasket'},{id:'doorClose',t0:r2(mIn-m.sitDown),t1:r2(mIn-m.sitDown+0.6),overlapsWith:'sitDown'},
  {id:'settle',t0:r2(mIn+mIgn+m.flight-1),t1:r2(mIn+mIgn+m.flight),overlapsWith:'flight'}];
 const k=D.seg4,s4=seq([['standUp',k.standUp],['pause',k.pause],['doorReach',k.doorReach],['stepDown',k.stepDown+1.0/* BalloonTransit walks stepDown+1.0 */],['toPath',b5ToPathS(k.toPath)]]);
 const l=D.seg5a,lw=o.lakeWalkS??l.toBasket,lIn=lw+l.doorReach+l.intoBasket+l.turn180+l.sitDown,lIgn=Math.max(0,l.inflate-lIn);
 const s5a=[...seq([['toBasket',lw],['doorReach',l.doorReach],['intoBasket',l.intoBasket],['turn180',l.turn180],['sitDown',l.sitDown],['igniteRemainder',lIgn],['liftoff',l.liftoff],['flight',l.flight]]),
  {id:'inflate',t0:r2(Math.max(0,lw-l.inflate)),t1:r2(Math.max(0,lw-l.inflate)+l.inflate),overlapsWith:'toBasket'}];
 const b=D.seg5b,s5b=seq([['settle',b.settle],['standUp',b.standUp],['pause',b.pause],['doorReach',b.doorReach],['stepDown',b.stepDown],['walkOut',b.walkOut]]);
 const end=(x:Beat[])=>Math.max(...x.map(e=>e.t1));
 const tot={seg1:end(s1),seg2:end(s2),seg3:end(s3),seg4:end(s4),seg5a:end(s5a),seg5b:end(s5b)} as Record<string,number>;
 tot.islandToMeadow=r2(tot.seg1+tot.seg2);tot.meadowToSkycity=r2(tot.seg3+tot.seg4);tot.skycityToLakeside=r2(tot.seg5a+tot.seg5b);
 return {beats:{seg1:s1,seg2:s2,seg3:s3,seg4:s4,seg5a:s5a,seg5b:s5b},totals:tot,igniteAfterSit:{meadow:r2(mIgn),lake:r2(lIgn)}};}
/** Her pose while the basket flies (运镜bot occlusion test, segment 6 8.65–19.85 s, and the meadow→skycity leg).
 *  b19: BOTH balloon legs are ridden SEATED: offset = seated controller root in the BASKET ROOT frame (floor top y 0), yaw in
 *  basket frame (0 = facing the door, +Z), clip sit_hold. Lakeside keeps its b15 stand_point-local root (0.032,−0.1,−0.099),
 *  which is the same point (stand_point sits at basket y 0.1). */
export const BASKET_RIDE_POSE=Object.freeze({
 lakeside:{offset:[0.032,-0.1,-0.099] as Vec,frame:'stand_point',clip:'sit_hold',yawDeg:0,eyeHeightM:1.0},
 meadowSkycity:{offset:[0.032,0,-0.099] as Vec,frame:'basket',clip:'sit_hold',yawDeg:0,eyeHeightM:1.0},
});
