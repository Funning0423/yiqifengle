import {fromLookAt,projectPoint,yawPitch} from './CameraPose';
import type {CameraPose,LookAtPose,V3} from './CameraPose';
/** Fixed-origin room inspection. No camera travel, zoom, route, character or persistence writes.
 * T2+ (Funning 2026-10-11): look-around only; ~50 deg per screen width measured on device (was ~86 deg at 110).
 * Yaw range (Mac round 3 r1-s3/r1-s5): the lens never moves (home clearance 7.9 cm), but at the old ends (-150 / +32) the
 * frustum looked straight into the stair post / doorway wall: geometry at 0.20-0.25 m filled up to 20% of the frame.
 * Pulled in so every frustum ray (16x32, pitch -12..12) meets geometry no nearer than 0.50 m at -140 and 0.60 m at +14
 * (test_camera_frames room-look-clearance: >= 0.45 m over the whole range). The door is still found by dragging: the
 * handle enters the frame at yaw ~-112 and stays visible to the new end (x 0.16 there). Old: minYaw -150, maxYaw 32. */
export const ROOM_LOOK=Object.freeze({minYaw:-140,maxYaw:14,minPitch:-12,maxPitch:12,degreesPerScreen:64,doorInset:.10});
/** Window-tap exit (Funning 2026-10-15 v3 sill tip, prototype): rear arched window glass env_rear_window_glass in
 * room_no_original_chair.glb: x -0.574..0.674, y 1.222..2.749, z -5.125. The tip sits on the sill under the glass bottom edge and never
 * covers the glass; the whole glass quad is also tappable. Only shown while the look rests on the default (window) view. */
export const WINDOW_GUIDE=Object.freeze({glass:{x0:-0.574,x1:0.674,y0:1.222,y1:2.749,z:-5.125},maxYaw:6,maxPitch:6});
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
 /** Projected glass quad (fractions, y up like door()) and the sill point (glass bottom centre); visible near the default view only. */
 window(aspect:number){
  const none={visible:false,x:.5,y:.5,glass:{x0:0,y0:0,x1:0,y1:0}};if(!Number.isFinite(aspect)||aspect<=0)return none;
  const g=WINDOW_GUIDE.glass,pose=this.pose(),pts=[[g.x0,g.y0],[g.x1,g.y0],[g.x0,g.y1],[g.x1,g.y1]].map(([x,y])=>projectPoint(pose,aspect,[x,y,g.z]));
  if(pts.some(p=>!(p.depth>.05)))return none;
  const xs=pts.map(p=>(p.x+1)/2),ys=pts.map(p=>(p.y+1)/2),glass={x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)};
  const sill=projectPoint(pose,aspect,[(g.x0+g.x1)/2,g.y0,g.z]),x=(sill.x+1)/2,y=(sill.y+1)/2;
  return {visible:Math.abs(this.yaw)<=WINDOW_GUIDE.maxYaw&&Math.abs(this.pitch)<=WINDOW_GUIDE.maxPitch&&x>.05&&x<.95&&y>.1&&y<.9,x,y,glass};
 }
 door(point:V3,aspect:number){
  if(!Number.isFinite(aspect)||aspect<=0)return {visible:false,x:.5,y:.5,direction:1};
  const p=projectPoint(this.pose(),aspect,point),x=(p.x+1)/2,y=(p.y+1)/2;
  const a=yawPitch(this.pose().rotation),rel=[point[0]-this.home.position[0],point[2]-this.home.position[2]];let delta=Math.atan2(rel[0],rel[1])-a.yaw;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
  return {visible:p.depth>.05&&x>ROOM_LOOK.doorInset&&x<1-ROOM_LOOK.doorInset&&y>.12&&y<.86,x,y,direction:delta<0?1:-1};
 }
}
