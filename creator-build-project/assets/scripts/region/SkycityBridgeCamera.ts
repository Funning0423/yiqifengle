import type {JourneyBoardEnd,JourneyLanding,LensKey} from '../world-r1/RegionJourneyCore';
import {lensKeys} from './RegionJourneyLayout';
/** 运镜bot (r5, cine/skycity-bridge-r2-cam): the 08→09 lens for 场景设计部's sky-city plan B r2 (rainbow-bridge/IMPLEMENTATION.md §8:
 *  one continuous climb meadow exit → rainbow bridge (left turn R 64.5 m, 30° held mid-span) → star-court front-rim lawn; she stops
 *  right of the tool row). Replaces REGION_JOURNEY_LAYOUT.skyLens / REGION_BOARD_LANDING.blendM.skycity for that route only; the
 *  r4 route (cloud-bridge deck) keeps both, byte-for-byte.
 *  - Follow: JOURNEY_CAMERA rig (6.6 m back, 3.4 m up), 3.0 m to her RIGHT (default 2.4) from 8 m before the bridge, so the lens
 *    stays right of behind (F7b) through the 41° meadow corner and up to the last 10 m. Measured against the full sky-city GLB,
 *    raising / pulling the lens back on the climb does not lower the island-underside share (≥ 11% in every variant tried) and
 *    costs sky, so the rig height is kept.
 *  - anchorSmoothM 2: the lens anchors on her route smoothed ±2 m (RegionJourneyCore.smoothRoutePoint), so the meadow corner and
 *    the ramp/bridge grade changes give continuous lens acceleration (≤ 1.4 m/s², was 17.6 m/s² unsmoothed).
 *  - Board end = CRANE (RegionJourneyCore.boardEndCrane) over the last boardBlendM = 20 m (≈ 16.7 s; on every portrait screen it
 *    starts inside the 30° section of the bridge): her-relative offset swings (orbit) from the follow rig to the board camera's
 *    offset from her stop, the anchor settles onto her stop over the last 5 m, the view keeps her framed (weight e²) and turns to
 *    the board view at the end; the pose at her stop IS the board camera (swap delta 0).
 *  Route wiring (sky-city branch of RegionJourneyAdapter.prepare, plan B): no `focus` (Landing A is not used on this route),
 *  `...skyB2RouteCamera(routeLength(approach), routeLength(path), board)` → lens, landing {anchorSmoothM}, board (with crane). */
export const SKY_B2_CAMERA={
 /** metres from the rainbow bridge START (as REGION_JOURNEY_LAYOUT.skyLens). */
 lens:[{at:-12},{at:-8,sideM:-3}] as ReadonlyArray<LensKey>,
 anchorSmoothM:2,
 boardBlendM:20,
 crane:{settleM:5,aimK:2,orbit:1},
} as const;
export type SkyB2RouteCamera=Readonly<{lens:LensKey[];landing:JourneyLanding;board?:JourneyBoardEnd}>;
/** Lens keys, landing and board end for one plan-B route. approachM = route metres before the bridge, totalM = route length.
 *  The crane never starts before the bridge (blendM ≤ totalM − approachM); without a board pose the route keeps the follow lens. */
export function skyB2RouteCamera(approachM:number,totalM:number,board?:JourneyBoardEnd):SkyB2RouteCamera{
 const C=SKY_B2_CAMERA,blendM=Math.min(C.boardBlendM,totalM-approachM);
 const out={lens:lensKeys(C.lens,approachM),landing:{anchorSmoothM:C.anchorSmoothM}};
 return board&&Number.isFinite(blendM)&&blendM>C.crane.settleM?{...out,board:{position:board.position,target:board.target,fovVerticalDeg:board.fovVerticalDeg,blendM,crane:{...C.crane}}}:out;}
