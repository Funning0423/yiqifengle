import type { RouteConfig, Vec, Pose } from './WorldFlowCore';
/** Source samples are preserved. Only explicit, documented joins are authored here. */
export function createFirstsliceRoutes(facts:any,reference:{seatedRoot:Vec;standingRoot:Vec;walkEndRoot:Vec;seatYawRad:number}):RouteConfig {
  if(facts.units!=='m'||facts.up!=='+Y'||facts.outdoorForward!=='+Z')throw Error('Unsupported asset axes/units');
  const a=(name:string):Vec=>{const p=facts.anchors[name]?.position;if(!p||p.length!==3||!p.every(Number.isFinite))throw Error('Missing anchor '+name);return [...p] as unknown as Vec;};
  const range=(prefix:string,first:number,last:number):Vec[]=>Array.from({length:last-first+1},(_,i)=>a(prefix+'_'+String(i+first).padStart(2,'0')));
  const cameraHome:Pose={position:[-1.1,1.8,-2.9],target:[.35,.85,-4.1]};
  const toDoor:Vec[]=[reference.standingRoot,reference.walkEndRoot,...range('exit_path',3,4),a('door_stand_point')];
  const directions=toDoor.slice(1).map((p,i)=>{const dx=p[0]-toDoor[i][0],dz=p[2]-toDoor[i][2],d=Math.hypot(dx,dz);return [dx/d,dz/d];});
  const lengths=toDoor.slice(1).map((p,i)=>Math.hypot(p[0]-toDoor[i][0],p[2]-toDoor[i][2]));
  const total=lengths.reduce((a,b)=>a+b,0);let travelled=0;
  const cameraToDoor:Pose[]=toDoor.map((p,i)=>{
    const before=directions[Math.max(0,i-1)],after=directions[Math.min(directions.length-1,i)];
    const x=before[0]+after[0],z=before[1]+after[1],n=Math.hypot(x,z),fx=x/n,fz=z/n;
    if(i>0)travelled+=lengths[i-1];
    return {position:[p[0]-fz*.32-fx*.26,1.55,p[2]+fx*.32-fz*.26],target:[p[0]+fx*.7,1.1,p[2]+fz*.7],progress:travelled/total};
  });
  const cameraInside:Pose=cameraToDoor[cameraToDoor.length-1];
  const cameraOutside:Pose={position:[-.58,1.65,1.6],target:[-.2,1.1,2.6]};
  const cameraIsland:Pose={position:[-3.4,2.3,6.6],target:[-1.5,1.05,4.5]};
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
    cameraHome,cameraToDoor,cameraInside,cameraOutside,cameraIsland,openDeg:facts.door.openDeg,speed:.7,
  };
}
