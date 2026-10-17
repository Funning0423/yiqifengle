import type {Pose} from '../world-r1/WorldFlowCore';
import {meadowScenePose} from './MeadowSceneData';
import {REGION_NODES,type RegionId,type Vec} from './RegionNodes';
import {skycityVisitPose} from './SkycityVisitPose';

export type BoardPoseResult=Pose|'default';
const MEADOW_STAND:Vec=[0.2,1.22,20];
const SKY_A:Vec=[0.2,0.04,30.2];
const SKY_B:Vec=[0.2,0.08,-17];

function yawDelta(fromDeg:number,toDeg:number):number{return (toDeg-fromDeg)*Math.PI/180;}
function rotY(p:Vec,origin:Vec,rad:number):Vec{
 const c=Math.cos(rad),s=Math.sin(rad),x=p[0]-origin[0],z=p[2]-origin[2];
 return [origin[0]+c*x+s*z,p[1],origin[2]-s*x+c*z];
}
/**
 * Rigidly hang the region's existing board camera on this node's stand and facing.
 * Nodes marked `default` (or the island, whose board is a 2D picture) keep the current lease.
 */
export function nodeBoardPose(region:RegionId,key:string,w:number,h:number):BoardPoseResult{
 const node=REGION_NODES[region].nodes.find(n=>n.key===key);
 if(!node||region==='island'||!node.boardPose||node.boardPose==='default')return 'default';
 if(!(w>0&&h>0))return 'default';
 const aspect=w/h;
 if(region==='meadow'){
  const base=meadowScenePose(aspect);
  const rad=yawDelta(0,node.faceDeg);
  const shift:Vec=[node.at[0]-MEADOW_STAND[0],node.at[1]-MEADOW_STAND[1],node.at[2]-MEADOW_STAND[2]];
  const position=rotY([base.position[0]+shift[0],base.position[1]+shift[1],base.position[2]+shift[2]],node.at,rad);
  const target=rotY([base.target[0]+shift[0],base.target[1]+shift[1],base.target[2]+shift[2]],node.at,rad);
  return {position,target,fovVerticalDeg:base.fovVerticalDeg};
 }
 const base=skycityVisitPose(SKY_A,SKY_B,aspect);
 const shift:Vec=[node.at[0]-SKY_A[0],node.at[1]-SKY_A[1],node.at[2]-SKY_A[2]];
 return {position:[base.position[0]+shift[0],base.position[1]+shift[1],base.position[2]+shift[2]],target:[base.target[0]+shift[0],base.target[1]+shift[1],base.target[2]+shift[2]],fovVerticalDeg:base.fovVerticalDeg};
}
export function boardPoseId(region:RegionId,key:string):string{
 const node=REGION_NODES[region].nodes.find(n=>n.key===key);
 return node?.boardPose||(region==='island'?'island-2d':'default');
}
