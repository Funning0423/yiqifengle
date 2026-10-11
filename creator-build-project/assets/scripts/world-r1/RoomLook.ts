import {fromLookAt,projectPoint,yawPitch} from './CameraPose';
import type {CameraPose,LookAtPose,V3} from './CameraPose';
/** Fixed-origin room inspection. No camera travel, zoom, route, character or persistence writes. */
export const ROOM_LOOK=Object.freeze({minYaw:-150,maxYaw:32,minPitch:-12,maxPitch:12,degreesPerScreen:110,doorInset:.10});
export class RoomLook {
 private yaw=0;private pitch=0;
 constructor(readonly home:LookAtPose){}
 reset(){this.yaw=0;this.pitch=0;}
 moved(){return Math.abs(this.yaw)+Math.abs(this.pitch)>1e-6;}
 angles(){return {yaw:this.yaw,pitch:this.pitch};}
 drag(dx:number,dy:number):boolean {
  if(![dx,dy].every(Number.isFinite))return false;
  this.yaw=Math.max(ROOM_LOOK.minYaw,Math.min(ROOM_LOOK.maxYaw,this.yaw+Math.max(-.35,Math.min(.35,dx))*ROOM_LOOK.degreesPerScreen));
  this.pitch=Math.max(ROOM_LOOK.minPitch,Math.min(ROOM_LOOK.maxPitch,this.pitch-Math.max(-.35,Math.min(.35,dy))*ROOM_LOOK.degreesPerScreen));return true;
 }
 pose():CameraPose {
  if(!this.moved())return fromLookAt(this.home);
  const a=yawPitch(fromLookAt(this.home).rotation),yaw=a.yaw+this.yaw*Math.PI/180,pitch=a.pitch+this.pitch*Math.PI/180,p=this.home.position;
  return fromLookAt({position:p,target:[p[0]+Math.cos(pitch)*Math.sin(yaw),p[1]+Math.sin(pitch),p[2]+Math.cos(pitch)*Math.cos(yaw)],fovVerticalDeg:this.home.fovVerticalDeg});
 }
 door(point:V3,aspect:number){
  if(!Number.isFinite(aspect)||aspect<=0)return {visible:false,x:.5,y:.5,direction:1};
  const p=projectPoint(this.pose(),aspect,point),x=(p.x+1)/2,y=(p.y+1)/2;
  const a=yawPitch(this.pose().rotation),rel=[point[0]-this.home.position[0],point[2]-this.home.position[2]];let delta=Math.atan2(rel[0],rel[1])-a.yaw;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
  return {visible:p.depth>.05&&x>ROOM_LOOK.doorInset&&x<1-ROOM_LOOK.doorInset&&y>.12&&y<.86,x,y,direction:delta<0?1:-1};
 }
}
