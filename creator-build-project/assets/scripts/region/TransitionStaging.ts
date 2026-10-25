/** Transition staging table (GGbot best guess from scene geometry, 2026-10-25). ALL values are placeholders flagged for
 *  场景设计部 to tune — they have not delivered pier / gangplank / basket positions yet. Only data: no art, no new assets.
 *  Pier and gangplanks are procedural boxes drawn with the sailboat hull's existing material (TransitionProps.ts).
 *  Frames: 'island world' = WorldFlowOwner world (SAIL_I6 frame); 'boat local' = sailboat local (x right/port +, z forward);
 *  'basket local' = transport_balloon local (door wall +Z as in the lakeside mooring). Units: metres / degrees. */
import type {Vec} from '../world-r1/WorldFlowCore';
export const STAGING_PLACEHOLDER=true;
export const TRANSITION_STAGING=Object.freeze({
 /** Island pier (A1): a short plank pier from the boarding stop SAIL_I6 toward the boat; island has no pier model. */
 islandPier:{
  /** pier root = SAIL_I6 + this (island world). */ rootOffset:[0,-0.04,0] as Vec,
  /** pier ends this far short of the boat's deck point (m) along SAIL_I6→deck. */ endShortM:0.55,
  widthM:1.1,thickM:0.12,
  /** her walk height on the pier (island world y); null = the height of her last island stop (ground-continuous). */ walkY:null as number|null,
 },
 /** Island gangplank (A2): pier end → deck edge. */
 islandGangplank:{widthM:0.46,thickM:0.05,/** deck-edge point is deck point pulled back toward the pier by (m) */ deckInsetM:0.25},
 /** Meadow gangplank (A5): port step (boat) → landing_step (landing_jetty, existing). */
 meadowGangplank:{widthM:0.46,thickM:0.05,/** extra mid point lift (m) so feet clear the gunwale */ midLiftM:0.04},
 /** Balloon B1 (meadow) / C1 (skycity): door front, outside the basket, basket local. */
 basketDoorFront:[0,0,1.05] as Vec,
 /** door threshold (basket local); she passes it between door front and stand_point. */
 basketDoorSill:[0,0.02,0.55] as Vec,
 /** B5 (skycity) / C5 handled by the lakeside get-out: first step outside after the door (basket local). */
 basketStepOut:[0,0,1.25] as Vec,
 /** Walk speed for the short staged walks (m/s). */
 walkMps:1.1,
});
/** Her pose while the basket flies (for 运镜bot's occlusion test, 8.65–19.85 s of segment 6 and the B2/B3 meadow leg).
 *  offset = her controller root in basket `stand_point` local (m); yawDeg = her yaw in that frame; clip = the pose drawn.
 *  lakeside: seated (sit_hold), offset from 角色动画bot b15 stand-up v1b (she stands up with stand_up at touchdown);
 *  meadow→skycity: standing (idle_breathing_loop) on stand_point, yaw GIRL_YAW of BalloonTransit. */
export const BASKET_RIDE_POSE=Object.freeze({
 lakeside:{offset:[0.032,-0.1,-0.099] as Vec,clip:'sit_hold',yawDeg:'moored.seatYawDeg(startYaw)' as const,eyeHeightM:1.0},
 meadowSkycity:{offset:[0,0,0] as Vec,clip:'idle_breathing_loop',yawDeg:-76.6,eyeHeightM:1.45},
});
