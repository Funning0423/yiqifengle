import type {Vec} from '../world-r1/WorldFlowCore';
import type {JourneyLanding} from '../world-r1/RegionJourneyCore';
import type {AuthoredPose} from '../world-r1/CameraPose';
import {REGION_JOURNEY_LAYOUT,bridgePath,islandApproach,plus} from './RegionJourneyLayout';
/** Lakeside (r5h3) camera data: journey into the region, Landing A arrival and the board framing. Pure numbers and maths, no
 * engine imports, so tools/journey-integration/test-lakeside-camera.cjs checks exactly these values against the committed
 * region_lakeside GLBs placed by scene_r5h_slim_transforms.json. Coordinates marked Local are lakeside-root (Y-up, metres).
 * Route: island exit (same approach as 04→05) → 24 m rainbow bridge (same shape) → lands on the empty south bank (flat
 * 0.56–0.59 m from z 23 to 39) → walks 11.5 m straight toward the lake and stops 2.5 m from the shore, facing the board.
 * Landing A machinery (RegionJourneyCore.arrivalPose/journeyCamera) with per-route overrides: lens on HER RIGHT, no late
 * lift (no crane-up), lens settles over the last 6 m (zero velocity/acceleration when she stops), board centre as the focus
 * so the arrival frame already looks at the level she is about to play. */
export const LAKESIDE_CAMERA_LAYOUT={
 /** Root Y rotation (Cocos setRotationFromEuler(0,yawDeg,0)): lakeside -Z (toward the lake) becomes the bridge's world +Z. */
 yawDeg:180,
 /** World offset of the bridge landing from the island approach end: the 04→05 bridge length and level (meadowOffset). */
 offset:[0,0,24] as Vec,
 bridgeArchM:2,
 /** Bridge landing and walk on the south bank (Local). */
 landingLocal:[1.2,.58,36] as Vec,
 walkLocal:[[1.2,.58,30],[1.2,.58,24.5]] as ReadonlyArray<Vec>,
 /** Board centre (7×7 cells x −3.3…3.3, z 8.7…15.3) at piece height. */
 focusLocal:[0,.3,12] as Vec,
 /** Landing A overrides (all other arrival numbers = JOURNEY_CAMERA, i.e. the 08→09 Landing A values). */
 landing:{arrivalSideM:.8,arrivalLiftM:0,arrivalSettleM:6,anchorSmoothM:1.5} as JourneyLanding,
 /** Board framing: fixed 45° pitch over the board, whole board (rope ring incl. piece tops) at ±boardWidthNdc and its far
  * edge at boardTopFrac of the screen height (scene in the top third). The handoff camera (COCOS_HANDOFF §4, 720×1280) is
  * kept as the art reference only; its FOV is reused. */
 board:{pitchDeg:45,fovVerticalDeg:61.928,boardWidthNdc:.88,boardTopFrac:.34,aimY:0,
  extent:{x:4.4,zNear:16.5,zFar:7.7,topY:.8},minAspect:.4,maxAspect:.75},
} as const;
const rotY=(deg:number,p:Vec):Vec=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
/** Placement + route pieces for RegionJourneyAdapter: model.setRotationFromEuler(0,yawDeg,0); model.setWorldPosition(...root);
 * path=[...approach,...bridge.slice(1),...arrival]; route {focus,landing,startBlendM:0} as returned. */
export function lakesideJourney(start:Vec){
 const L=LAKESIDE_CAMERA_LAYOUT,approach=islandApproach(start),edge=approach[approach.length-1],landing=plus(edge,L.offset);
 const yawDeg=L.yawDeg,r=rotY(yawDeg,L.landingLocal),root:Vec=[landing[0]-r[0],landing[1]-r[1],landing[2]-r[2]];
 const toWorld=(p:Vec):Vec=>plus(rotY(yawDeg,p),root);
 const bridge=bridgePath(edge,toWorld(L.landingLocal),L.bridgeArchM),arrival=L.walkLocal.map(toWorld);
 return {yawDeg,root,toWorld,approach,bridge,arrival,focus:toWorld(L.focusLocal),landing:L.landing,startBlendM:0,speed:REGION_JOURNEY_LAYOUT.speedMps};
}
type V3=[number,number,number];
function frameBoard(pos:V3,aim:V3,aspect:number):{maxX:number;top:number;bottom:number}{
 const B=LAKESIDE_CAMERA_LAYOUT.board,E=B.extent,f=[aim[0]-pos[0],aim[1]-pos[1],aim[2]-pos[2]],fl=Math.hypot(f[0],f[1],f[2]);f[0]/=fl;f[1]/=fl;f[2]/=fl;
 const rl=Math.hypot(f[2],f[0]),r=[-f[2]/rl,0,f[0]/rl],up=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],t=Math.tan(B.fovVerticalDeg*Math.PI/360);
 let maxX=0,maxY=-9,minY=9;
 for(const x of [-E.x,E.x])for(const z of [E.zNear,E.zFar])for(const y of [0,E.topY]){const v=[x-pos[0],y-pos[1],z-pos[2]],d=v[0]*f[0]+v[1]*f[1]+v[2]*f[2];
  const sx=Math.abs((v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(d*t*aspect)),sy=(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(d*t);maxX=Math.max(maxX,sx);maxY=Math.max(maxY,sy);minY=Math.min(minY,sy);}
 return {maxX,top:(1-maxY)/2,bottom:(1-minY)/2};
}
/** Lakeside board-background camera for a viewport aspect (width/height). Aspects outside [minAspect,maxAspect] use the
 * nearest bound (wider screens just show more scenery at the sides). Solved, not tabulated: the distance along the 45° view
 * puts the board edge at ±boardWidthNdc, the aim point moves along the board axis to put the far edge at boardTopFrac. */
export function lakesideScenePose(aspect:number):AuthoredPose{
 if(!Number.isFinite(aspect)||aspect<=0)throw Error('Invalid lakeside aspect');
 const B=LAKESIDE_CAMERA_LAYOUT.board,a=Math.min(B.maxAspect,Math.max(B.minAspect,aspect)),p=B.pitchDeg*Math.PI/180,cz=(B.extent.zNear+B.extent.zFar)/2;
 const at=(aimZ:number,d:number):[V3,V3]=>{const aim:V3=[0,B.aimY,aimZ];return [[0,B.aimY+Math.sin(p)*d,aimZ+Math.cos(p)*d],aim];};
 const fit=(aimZ:number)=>{let lo=4,hi=80;for(let i=0;i<48;i++){const d=(lo+hi)/2,[pos,aim]=at(aimZ,d);if(frameBoard(pos,aim,a).maxX>B.boardWidthNdc)lo=d;else hi=d;}return hi;};
 let lo=cz-8,hi=cz+8;for(let i=0;i<40;i++){const m=(lo+hi)/2,[pos,aim]=at(m,fit(m));if(frameBoard(pos,aim,a).top<B.boardTopFrac)hi=m;else lo=m;}
 const aimZ=(lo+hi)/2,[pos,aim]=at(aimZ,fit(aimZ));
 return {position:[+pos[0].toFixed(4),+pos[1].toFixed(4),+pos[2].toFixed(4)],target:[+aim[0].toFixed(4),+aim[1].toFixed(4),+aim[2].toFixed(4)],fovVerticalDeg:B.fovVerticalDeg};
}
