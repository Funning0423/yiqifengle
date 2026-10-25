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
/** Seconds per beat (STANCES.md). One table: Grok Bot may retune (meadow→skycity exceeds the 43.5 s target). */
export const TRANSITION_DURATIONS=Object.freeze({
 seg1:{nodeWalkI4toI6:15.6,a1DockWalk:3.0,a2Gangway:2.3,sitDown:1.2},
 seg2:{dockSettle:2.0,standUp:1.27,offBoat:2.7,jettyToM1:16.5},
 seg3:{toBasket:5.7,doorReach:1.8,intoBasket:2.6,turn180:1.5,sitDown:1.2,inflate:3.0,flight:20/* 运镜bot b19: visible meadow→skycity flight, ≤50 s cap */},
 seg4:{settle:1.5,standUp:1.27,pause:0.5,doorReach:1.8,stepDown:1.73,toPath:7.5},
 seg5a:{toBasket:8.0,doorReach:1.8,intoBasket:2.6,turn180:1.5,sitDown:1.2,inflate:3.0,liftoff:6.0,flight:10/* 运镜bot b19: 8–12 s, re-timed */},
 seg5b:{settle:1.5,standUp:1.27,pause:0.5,doorReach:1.8,stepDown:1.73,walkOut:7.7},
});
export function segmentTotals(D=TRANSITION_DURATIONS):Record<string,number>{const o:Record<string,number>={};
 for(const [k,v] of Object.entries(D))o[k]=Math.round(Object.values(v as Record<string,number>).reduce((a,b)=>a+b,0)*100)/100;
 o.meadowToSkycity=Math.round((o.seg3+o.seg4)*100)/100;o.skycityToLakeside=Math.round((o.seg5a+o.seg5b)*100)/100;return o;}
/** Her pose while the basket flies (运镜bot occlusion test, segment 6 8.65–19.85 s, and the meadow→skycity leg).
 *  b19: BOTH balloon legs are ridden SEATED: offset = seated controller root in the BASKET ROOT frame (floor top y 0), yaw in
 *  basket frame (0 = facing the door, +Z), clip sit_hold. Lakeside keeps its b15 stand_point-local root (0.032,−0.1,−0.099),
 *  which is the same point (stand_point sits at basket y 0.1). */
export const BASKET_RIDE_POSE=Object.freeze({
 lakeside:{offset:[0.032,-0.1,-0.099] as Vec,frame:'stand_point',clip:'sit_hold',yawDeg:0,eyeHeightM:1.0},
 meadowSkycity:{offset:[0.032,0,-0.099] as Vec,frame:'basket',clip:'sit_hold',yawDeg:0,eyeHeightM:1.0},
});
