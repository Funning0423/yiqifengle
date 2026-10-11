import type { RouteConfig, Vec, Pose } from './WorldFlowCore';
import { islandPoseEntry, homePoseEntry, characterPoseEntry, REGION_CAMERA, INTERIOR_CAMERA_CLEARANCE } from './RegionCameraData';
import { assertAuthoredPose } from './CameraPose';
/** v1.3: authored poses must carry position+target+fovVerticalDeg; validated (finite, roll 0, fov range) at route creation. */
const dataPose=(e:any,name:string):Pose=>{const a=assertAuthoredPose(e,name);return {position:[a.position[0],a.position[1],a.position[2]],target:[a.target[0],a.target[1],a.target[2]],fovVerticalDeg:a.fovVerticalDeg};};
/** Source samples are preserved. Only explicit, documented joins are authored here. */
export function createFirstsliceRoutes(facts:any,reference:{seatedRoot:Vec;standingRoot:Vec;walkEndRoot:Vec;seatYawRad:number}):RouteConfig {
  if(facts.units!=='m'||facts.up!=='+Y'||facts.outdoorForward!=='+Z')throw Error('Unsupported asset axes/units');
  const a=(name:string):Vec=>{const p=facts.anchors[name]?.position;if(!p||p.length!==3||!p.every(Number.isFinite))throw Error('Missing anchor '+name);return [...p] as unknown as Vec;};
  const range=(prefix:string,first:number,last:number):Vec[]=>Array.from({length:last-first+1},(_,i)=>a(prefix+'_'+String(i+first).padStart(2,'0')));
  // 0007 v1.2: home/island stable poses are DATA (RegionCameraData.ts, homePoseSource/islandPoseSource switches).
  const home=homePoseEntry(),island=islandPoseEntry(),girl=characterPoseEntry();
  const cameraHome:Pose=dataPose(home,'home');
  const toDoor:Vec[]=[reference.standingRoot,reference.walkEndRoot,...range('exit_path',3,4),a('door_stand_point')];
  const lengths=toDoor.slice(1).map((p,i)=>Math.hypot(p[0]-toDoor[i][0],p[2]-toDoor[i][2]));
  const total=lengths.reduce((a,b)=>a+b,0);let travelled=0;
  // Only lens positions change: preserve source target, arclength progress and 60-degree FOV.
  if(toDoor.length!==INTERIOR_CAMERA_CLEARANCE.followPositions.length)throw Error('Interior clearance route needs re-audit');
  const cameraToDoor:Pose[]=toDoor.map((p,i)=>{
    if(i>0)travelled+=lengths[i-1];
    return {position:INTERIOR_CAMERA_CLEARANCE.followPositions[i],target:[p[0],.85,p[2]],fovVerticalDeg:60,progress:travelled/total};
  });
  const cameraInside:Pose=cameraToDoor[cameraToDoor.length-1];
  const cameraOutside:Pose={position:INTERIOR_CAMERA_CLEARANCE.outsidePosition,target:[-.2,1.1,2.6]};
  const cameraIsland:Pose=dataPose(island,'island');
  const cameraCharacter:Pose=dataPose(girl,'character');
  // Intermediate targets/FOV remain on the ORIGINAL linear blend at their original total progress.
  // Inherited outside FOV is 60 on exit but island FOV (42) on return; do not turn return into a zoom jump.
  const guarded=(start:Pose,end:Pose,guards:readonly {position:Vec;progress:number}[],fallbackFov:number):Pose[]=>[
    {...start,progress:0},
    ...guards.map(g=>({position:g.position,progress:g.progress,
      target:start.target.map((v,i)=>v+(end.target[i]-v)*g.progress) as unknown as Vec,
      fovVerticalDeg:(start.fovVerticalDeg??fallbackFov)+((end.fovVerticalDeg??fallbackFov)-(start.fovVerticalDeg??fallbackFov))*g.progress})),
    {...end,progress:1},
  ];
  const cameraHomeToDoor=REGION_CAMERA.homePoseSource==='sitting-room'
    ? guarded(cameraHome,cameraToDoor[0],[INTERIOR_CAMERA_CLEARANCE.homeGuard],cameraHome.fovVerticalDeg!)
    : [cameraHome,cameraToDoor[0]];
  const cameraCrossOut=guarded(cameraInside,cameraOutside,INTERIOR_CAMERA_CLEARANCE.doorGuards,cameraInside.fovVerticalDeg!);
  const returnGuards=[...INTERIOR_CAMERA_CLEARANCE.doorGuards].reverse().map(g=>({position:g.position,progress:1-g.progress}));
  const cameraCrossIn=guarded(cameraOutside,cameraInside,returnGuards,cameraIsland.fovVerticalDeg!);

  return {
    seat:{position:a('seat_anchor'),back:a('seat_back'),yawRad:facts.anchors.seat_anchor.properties.yaw_rad,seatedFoot:a('seated_foot_anchor'),standingFoot:a('stand_up_foot_anchor'),seatedControllerRoot:reference.seatedRoot,standingControllerRoot:reference.standingRoot},
    // Use the audited lower-reference controller route, never use a foot anchor as root/pelvis.
    toDoor,
    outCrossing:[a('door_stand_point'),a('exit_point'),...range('exit_path',6,7)],
    toIsland:range('exit_path',7,17),
    // Preserve the real 2.97 mm endpoint gap as an explicit connector, never rename the anchors.
    toThreshold:[a('exit_path_17'),...range('return_path',0,7)],
    inCrossing:[a('return_path_07'),a('return_path_08'),a('entrance_point')],
    toSeat:[a('entrance_point'),...range('return_path',10,15),reference.standingRoot],
    cameraHome,cameraHomeToDoor,cameraToDoor,cameraInside,cameraOutside,cameraCrossOut,cameraCrossIn,cameraIsland,cameraCharacter,openDeg:facts.door.openDeg,speed:.7,
    islandYawRad:(island.characterYawDeg??0)*Math.PI/180,
  };
}
