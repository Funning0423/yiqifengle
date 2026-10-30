/** 运镜bot cine/b20-coast-board-lens — official coast board lens (option B: the board lives in the 3D coast scene).
 *  Engine-free (plain Node testable). Source of the numbers: tools/coast-board-lens/lens.py + table.py on the real r5d meshes
 *  (scene/b19-coast-scene @bb238126, coast root (-0.6,-0.845,21.5) yaw 180 under island scene_root).
 *  Default = 场景设计部 D2 (r5d game view): pos (-0.6,15.3333,13.3593), quat (0,0.851965,0.523599,0) (pitch 63.148), vfov 50, look
 *  point (-0.6,-0.845,21.55). Only the DISTANCE along that look line changes per aspect, and only where the proposal fails:
 *  r2 item 3 (Grok Bot ruling (i)): the shortest distance (1 mm) at which the playable cells and her face keep >= 8 pt from the
 *  screen sides and the per-screen keep-out bands (coastKeepout; compact HUD on portrait h<=600). Old 0.08 frame rule: landscape only.
 *  Single writer: this module never writes the camera. The coast arrival push-in (journey S7) ends exactly on coastBoardPose();
 *  WorldFlowComponent's enter-level then holds when the live lens already equals it (no write), otherwise pushes into it
 *  within COAST_MOTION_LIMITS (coastPushSeconds). After the reveal nothing writes. */
import { remapProgress, rotationFromLookAt } from '../world-r1/CameraPose';
import type { LookAtPose, V3, TrackOptions } from '../world-r1/CameraPose';
import { boardLayout } from '../ui/BoardLayout';
export const COAST_BOARD_LENS=Object.freeze({quat:[0,0.851965,0.523599,0] as readonly number[],lookWorld:[-0.6,-0.845,21.55] as V3,proposedDistance:18.1335,fovVerticalDeg:50,margin:0.08,
  coastRoot:[-0.6,-0.845,21.5] as V3,coastYawDeg:180});
/** Frozen per-aspect distances (m) for the 7 test screens; other sizes solve with the same rule. */
/** Frozen per-aspect distances (m) for the 7 test screens (r2 item 3 final, tools/coast-board-lens/final_poses.py): the shortest
 *  distance at which coastBoardKeepoutFits holds. Other portrait sizes solve with the same rule. */
export const COAST_BOARD_DISTANCE:Readonly<Record<string,number>>=Object.freeze({'390x844':18.649,'414x896':18.608,'360x780':18.73,'375x667':19.546,'320x568':16.995,'390x520':17.725,'768x1024':15.878});
/** Grok Bot limits, per real dt. */
export const COAST_MOTION_LIMITS=Object.freeze({yawPitchDegS:90,angAccP99DegS2:200,speedMS:8,stepMPerFrame:0.5,fovDegPerFrame:1.5});
/** The generic enter-level ease (WorldFlowComponent playEnterLevel). */
export const COAST_PUSH_EASE:TrackOptions=Object.freeze({easeIn:0.14,easeOut:0.4});
/** Convex hull (world, 1 mm) of board_rim + 49 piece meshes, and her body at the stop (head top, feet, face +-0.28 m). */
const FIT_BOARD:readonly V3[]=[[2.419,-0.26,24.692],[2.579,-0.331,24.773],[2.46,-0.331,24.811],[2.497,-0.26,24.661],[2.4,-0.235,24.53],[2.567,-0.26,24.508],[2.694,-0.331,24.501],[2.651,-0.331,24.67],[2.549,-0.26,24.596],[1.33,-0.165,24.767],[1.353,-0.139,24.688],[1.476,-0.105,24.475],[-3.75,-0.165,24.671],[-3.702,-0.165,24.755],[-3.668,-0.139,24.68],[-3.517,-0.105,24.486],[2.545,-0.129,21.44],[2.481,-0.105,21.482],[2.54,-0.129,21.53],[-3.526,-0.105,21.472],[1.476,-0.105,20.474],[-3.729,-0.165,20.691],[-3.647,-0.139,20.688],[-3.6,-0.129,20.478],[-3.524,-0.105,20.475],[-3.708,-0.214,19.942],[-3.68,-0.237,19.567],[-3.644,-0.285,19.182],[2.4,-0.376,18.53],[2.644,-0.501,18.213],[-0.579,-0.311,18.099],[-1.535,-0.129,18.41],[-1.518,-0.105,18.485],[-2.553,-0.129,18.402],[-2.525,-0.105,18.474],[-3.6,-0.376,18.53],[-3.813,-0.501,18.191],[-4.55,-0.825,24.67],[-4.545,-0.825,24.757],[-4.431,-0.695,24.744],[-4.435,-0.695,24.67],[-4.431,-0.955,24.744],[-4.435,-0.955,24.67],[-4.418,-0.955,24.818],[-4.506,-0.825,24.928],[-4.53,-0.825,24.844],[-4.418,-0.695,24.818],[-4.398,-0.955,24.89],[-4.369,-0.695,24.959],[-4.398,-0.695,24.89],[-4.369,-0.955,24.959],[-4.473,-0.825,25.008],[-4.333,-0.955,25.024],[-4.43,-0.825,25.085],[-4.333,-0.695,25.024],[-4.29,-0.955,25.085],[-4.38,-0.825,25.156],[-4.322,-0.825,25.222],[-4.24,-0.695,25.14],[-4.29,-0.695,25.085],[-4.24,-0.955,25.14],[-4.185,-0.695,25.19],[-4.256,-0.825,25.28],[-4.124,-0.955,25.233],[-4.185,-0.955,25.19],[-4.185,-0.825,25.33],[-4.124,-0.695,25.233],[-4.059,-0.695,25.269],[-4.059,-0.955,25.269],[-4.108,-0.825,25.373],[-4.028,-0.825,25.406],[-3.99,-0.695,25.298],[-3.99,-0.955,25.298],[-3.918,-0.695,25.318],[-3.918,-0.955,25.318],[-3.944,-0.825,25.43],[-3.832,-0.695,25.332],[-3.832,-0.955,25.332],[-3.832,-0.825,25.447],[2.57,-0.825,25.45],[2.57,-0.695,25.335],[2.57,-0.955,25.335],[2.657,-0.825,25.445],[2.644,-0.955,25.331],[2.718,-0.695,25.318],[2.644,-0.695,25.331],[2.718,-0.955,25.318],[2.744,-0.825,25.43],[2.79,-0.695,25.298],[2.828,-0.825,25.406],[2.908,-0.825,25.373],[2.859,-0.695,25.269],[2.859,-0.955,25.269],[2.79,-0.955,25.298],[2.985,-0.825,25.33],[2.924,-0.695,25.233],[2.924,-0.955,25.233],[2.985,-0.695,25.19],[2.985,-0.955,25.19],[3.056,-0.825,25.28],[3.04,-0.695,25.14],[3.04,-0.955,25.14],[3.122,-0.825,25.222],[3.18,-0.825,25.156],[3.09,-0.695,25.085],[3.09,-0.955,25.085],[3.133,-0.695,25.024],[3.133,-0.955,25.024],[3.23,-0.825,25.085],[3.169,-0.695,24.959],[3.169,-0.955,24.959],[3.273,-0.825,25.008],[3.198,-0.695,24.89],[3.198,-0.955,24.89],[3.306,-0.825,24.928],[3.218,-0.695,24.818],[3.218,-0.955,24.818],[3.33,-0.825,24.844],[3.232,-0.695,24.732],[3.232,-0.955,24.732],[3.347,-0.825,24.732],[3.35,-0.825,18.33],[3.235,-0.695,18.33],[3.235,-0.955,18.33],[3.231,-0.695,18.256],[3.345,-0.825,18.243],[3.218,-0.695,18.182],[3.231,-0.955,18.256],[3.33,-0.825,18.156],[3.198,-0.695,18.11],[3.198,-0.955,18.11],[3.218,-0.955,18.182],[3.306,-0.825,18.072],[3.273,-0.825,17.992],[3.169,-0.695,18.041],[3.169,-0.955,18.041],[3.133,-0.695,17.976],[3.133,-0.955,17.976],[3.23,-0.825,17.915],[3.09,-0.955,17.915],[3.18,-0.825,17.844],[3.09,-0.695,17.915],[3.04,-0.955,17.86],[3.122,-0.825,17.778],[3.056,-0.825,17.72],[3.04,-0.695,17.86],[2.985,-0.955,17.81],[2.924,-0.695,17.767],[2.985,-0.695,17.81],[2.985,-0.825,17.67],[2.859,-0.695,17.731],[2.924,-0.955,17.767],[2.908,-0.825,17.627],[2.79,-0.695,17.702],[2.859,-0.955,17.731],[2.828,-0.825,17.594],[2.718,-0.695,17.682],[2.718,-0.955,17.682],[2.79,-0.955,17.702],[2.744,-0.825,17.57],[2.632,-0.695,17.668],[2.632,-0.825,17.553],[-3.77,-0.825,17.55],[-3.77,-0.695,17.665],[2.632,-0.955,17.668],[-3.77,-0.955,17.665],[-3.844,-0.695,17.669],[-3.844,-0.955,17.669],[-3.857,-0.825,17.555],[-3.918,-0.695,17.682],[-3.918,-0.955,17.682],[-3.944,-0.825,17.57],[-3.99,-0.695,17.702],[-3.99,-0.955,17.702],[-4.028,-0.825,17.594],[-4.059,-0.955,17.731],[-4.108,-0.825,17.627],[-4.185,-0.825,17.67],[-4.124,-0.695,17.767],[-4.059,-0.695,17.731],[-4.124,-0.955,17.767],[-4.185,-0.955,17.81],[-4.256,-0.825,17.72],[-4.322,-0.825,17.778],[-4.185,-0.695,17.81],[-4.24,-0.955,17.86],[-4.29,-0.695,17.915],[-4.24,-0.695,17.86],[-4.29,-0.955,17.915],[-4.38,-0.825,17.844],[-4.333,-0.695,17.976],[-4.333,-0.955,17.976],[-4.43,-0.825,17.915],[-4.473,-0.825,17.992],[-4.369,-0.695,18.041],[-4.369,-0.955,18.041],[-4.398,-0.695,18.11],[-4.398,-0.955,18.11],[-4.506,-0.825,18.072],[-4.418,-0.695,18.182],[-4.418,-0.955,18.182],[-4.53,-0.825,18.156],[-4.547,-0.825,18.268],[-4.432,-0.695,18.268],[-4.432,-0.955,18.268]];
const FIT_HER:readonly V3[]=[[-0.6,0.774,16.35],[-0.6,-0.826,16.35],[-0.32,0.574,16.35],[-0.88,0.574,16.35]];
const toWorld=(p:V3):V3=>{const a=COAST_BOARD_LENS.coastYawDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),r=COAST_BOARD_LENS.coastRoot;return [c*p[0]+s*p[2]+r[0],p[1]+r[1],-s*p[0]+c*p[2]+r[2]];};
export function coastBoardTarget():V3{return COAST_BOARD_LENS.lookWorld;}
const FWD=(()=>{const [x,y,z,w]=COAST_BOARD_LENS.quat,v=[0,0,-1],c1=[y*v[2]-z*v[1]+w*v[0],z*v[0]-x*v[2]+w*v[1],x*v[1]-y*v[0]+w*v[2]],c2=[y*c1[2]-z*c1[1],z*c1[0]-x*c1[2],x*c1[1]-y*c1[0]],f=[v[0]+2*c2[0],v[1]+2*c2[1],v[2]+2*c2[2]],l=Math.hypot(f[0],f[1],f[2]);return [f[0]/l,f[1]/l,f[2]/l] as V3;})();
export function coastBoardPoseAt(distance:number):LookAtPose{
  const t=COAST_BOARD_LENS.lookWorld;return {position:[t[0]-FWD[0]*distance,t[1]-FWD[1]*distance,t[2]-FWD[2]*distance],target:t,fovVerticalDeg:COAST_BOARD_LENS.fovVerticalDeg};
}
/** BoardLayout.boardLayout portrait band with boardSafeInsets defaults (top 47, bottom 34, capsule top+4..top+36). */
export function coastBoardBand(w:number,h:number){const top=47,bottom=34,pauseY=top+20,plateBottom=pauseY+29+60;return {lo:plateBottom+Math.max(24,44),hi:h-Math.max(bottom,12)-80-52};}
function project(pose:LookAtPose,asp:number,p:V3){
  const f0=[pose.target[0]-pose.position[0],pose.target[1]-pose.position[1],pose.target[2]-pose.position[2]],fl=Math.hypot(f0[0],f0[1],f0[2]),f=f0.map(x=>x/fl);
  let r=[-f[2],0,f[0]];const rl=Math.hypot(r[0],r[2]);r=[r[0]/rl,0,r[2]/rl];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
  const v=[p[0]-pose.position[0],p[1]-pose.position[1],p[2]-pose.position[2]],z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2],th=Math.tan((pose.fovVerticalDeg??50)*Math.PI/360);
  return {x:0.5+(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/z/(th*asp)/2,y:0.5-(v[0]*u[0]+v[1]*u[1]+v[2]*u[2])/z/th/2,z};
}
export function coastBoardFits(distance:number,w:number,h:number):boolean{
  const pose=coastBoardPoseAt(distance),asp=w/h,m=COAST_BOARD_LENS.margin-2e-4/* 1 mm hull rounding */,b=coastBoardBand(w,h);
  for(const p of FIT_HER){const q=project(pose,asp,p);if(!(q.z>0)||Math.min(q.x,1-q.x,q.y,1-q.y)<m)return false;}
  for(const p of FIT_BOARD){const q=project(pose,asp,p);if(!(q.z>0)||Math.min(q.x,1-q.x)<m||q.y<m||q.y>1-m)return false;}
  void b; // HUD band is advisory (coastBoardInBand), not a fit rule
  return true;
}
export function coastBoardInBand(distance:number,w:number,h:number):boolean{const pose=coastBoardPoseAt(distance),b=coastBoardBand(w,h);return FIT_BOARD.every(p=>{const y=project(pose,w/h,p).y*h;return y>=b.lo&&y<=b.hi;});}
/** Keep-out bands (pt, y down): portrait h<=600 -> UI设计部 c2d10462 compact HUD (top [0,131], tool hot-zone top h-94);
 *  otherwise the current HUD (BoardLayout.boardLayout, boardSafeInsets defaults): top = hint banner bottom (BoardKit topNoGo),
 *  tool hot-zone top = toolsY-32. */
export function coastKeepout(w:number,h:number):{top:number;tool:number;compact:boolean}{
  if(w<h*1.1&&h<=600)return {top:131,tool:h-94,compact:true};
  const L=boardLayout(w,h,{top:47,bottom:34,left:0,right:0,capsule:{left:w-93,top:51,right:w-6,bottom:83}});
  return {top:Math.round((L.toast.y+L.toast.height/2)*10)/10,tool:L.tools.y-32,compact:false};
}
/** Coast-local playable cell grid (7x7, 1 m cells, slab top y 0.12) and her face at the stop. */
const CELL_Y=0.12,FACE:V3=[-0.6,0.57421625,16.35];
const EDGE:readonly V3[]=[[-3.5,-3.5],[3.5,-3.5],[-3.5,3.5],[3.5,3.5]].map(([x,z])=>toWorld([x,CELL_Y,z]));
/** Projected cell centres (pt), row 0 = far row. */
export function coastCellCentres(distance:number,w:number,h:number):[number,number][]{
  const pose=coastBoardPoseAt(distance),out:[number,number][]=[];
  for(let r=0;r<7;r++)for(let c=0;c<7;c++){const q=project(pose,w/h,toWorld([c-3,CELL_Y,r-3]));out.push([q.x*w,q.y*h]);}
  return out;
}
/** Grok Bot margin rule: playable-cell outer edge >= 8 pt from the screen sides and the keep-out bands (the stone frame may
 *  leave the screen, symmetric in x by construction: yaw 0, look x = board centre); her face >= 8 pt from both bands. */
export function coastBoardKeepoutFits(distance:number,w:number,h:number,gap=8):boolean{
  const pose=coastBoardPoseAt(distance),k=coastKeepout(w,h);
  for(const p of EDGE){const q=project(pose,w/h,p),x=q.x*w,y=q.y*h;if(!(q.z>0)||x<gap||x>w-gap||y<k.top+gap||y>k.tool-gap)return false;}
  const f=project(pose,w/h,FACE),fx=f.x*w,fy=f.y*h;return f.z>0&&fy>=k.top+gap&&fy<=k.tool-gap&&fx>=gap&&fx<=w-gap;
}
/** Tap rule (PLAN 2.3 nearest-centre): far-row short side of the valid area inside the 44 pt box, and wrong taps of 2000
 *  seeded uniform +-8 pt taps per cell. */
export function coastBoardTap(distance:number,w:number,h:number):{farShortPt:number;wrongTaps:number;taps:number}{
  const C=coastCellCentres(distance,w,h),near=(x:number,y:number)=>{let b=0,bd=Infinity;for(let j=0;j<49;j++){const d=(C[j][0]-x)**2+(C[j][1]-y)**2;if(d<bd){bd=d;b=j;}}return b;};
  let ss=Infinity;for(let i=0;i<7;i++){const ext=[0,0];for(let a=0;a<2;a++)for(const sg of [1,-1]){let t=0;while(t<22){const x=C[i][0]+(a===0?sg*(t+0.05):0),y=C[i][1]+(a===1?sg*(t+0.05):0);if(near(x,y)!==i)break;t+=0.05;}ext[a]+=t;}ss=Math.min(ss,ext[0],ext[1]);}
  let seed=7,bad=0;const rnd=()=>{seed=(seed*1103515245+12345)>>>0;return seed/4294967296;};
  for(let i=0;i<49;i++)for(let n=0;n<2000;n++)if(near(C[i][0]+(rnd()*16-8),C[i][1]+(rnd()*16-8))!==i)bad++;
  return {farShortPt:Math.round(ss*10)/10,wrongTaps:bad,taps:49*2000};
}
export function coastBoardDistance(w:number,h:number):number{
  const k=Math.round(w)+'x'+Math.round(h);if(k in COAST_BOARD_DISTANCE)return COAST_BOARD_DISTANCE[k];
  const fits=w<h?coastBoardKeepoutFits:coastBoardFits;let lo=6,hi=80;if(!fits(hi,w,h))return hi;
  for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(fits(mid,w,h))hi=mid;else lo=mid;}return Math.ceil(hi*1000)/1000;
}
/** The official board pose for a logical viewport (pt). */
export function coastBoardPose(w:number,h:number):LookAtPose{return coastBoardPoseAt(coastBoardDistance(w,h));}
/** Live lens equals the board pose (position 1 mm, view direction 1e-6, fov 1e-3): enter-level holds and writes nothing. */
export function samePose(live:{position:V3;rotation:readonly number[];fovVerticalDeg:number},to:LookAtPose):boolean{
  const q=rotationFromLookAt(to.position,to.target),d=Math.abs(q[0]*live.rotation[0]+q[1]*live.rotation[1]+q[2]*live.rotation[2]+q[3]*live.rotation[3]);
  return Math.hypot(live.position[0]-to.position[0],live.position[1]-to.position[1],live.position[2]-to.position[2])<=1e-3&&d>=1-1e-6&&Math.abs(live.fovVerticalDeg-(to.fovVerticalDeg??live.fovVerticalDeg))<=1e-3;
}
const lerp=(a:V3,b:V3,p:number):V3=>[a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p,a[2]+(b[2]-a[2])*p];
/** Motion of the 2-key linear look-at push (createCameraTrack, COAST_PUSH_EASE) sampled at dt. */
export function pushMotion(from:LookAtPose,to:LookAtPose,seconds:number,dt=1/60){
  const n=Math.max(2,Math.ceil(seconds/dt)),ang:number[][]=[],pos:V3[]=[],fov:number[]=[];
  for(let i=0;i<=n;i++){const p=remapProgress(Math.min(1,i*dt/seconds),COAST_PUSH_EASE),P=lerp(from.position,to.position,p),T=lerp(from.target,to.target,p),f=[T[0]-P[0],T[1]-P[1],T[2]-P[2]],l=Math.hypot(f[0],f[1],f[2]);
    ang.push([Math.atan2(f[0],f[2])*180/Math.PI,Math.asin(f[1]/l)*180/Math.PI]);pos.push(P);fov.push((from.fovVerticalDeg??50)+((to.fovVerticalDeg??50)-(from.fovVerticalDeg??50))*p);}
  let speed=0,step=0,rate=0,fovStep=0;const acc:number[]=[];let prev:number[]|null=null;
  for(let i=1;i<=n;i++){let dy=ang[i][0]-ang[i-1][0];dy=((dy+540)%360)-180;const w=[dy/dt,(ang[i][1]-ang[i-1][1])/dt],s=Math.hypot(pos[i][0]-pos[i-1][0],pos[i][1]-pos[i-1][1],pos[i][2]-pos[i-1][2]);
    step=Math.max(step,s);speed=Math.max(speed,s/dt);rate=Math.max(rate,Math.abs(w[0]),Math.abs(w[1]));fovStep=Math.max(fovStep,Math.abs(fov[i]-fov[i-1]));
    if(prev)acc.push(Math.max(Math.abs(w[0]-prev[0]),Math.abs(w[1]-prev[1]))/dt);prev=w;}
  acc.sort((a,b)=>a-b);const p99=acc.length?acc[Math.min(acc.length-1,Math.floor(0.99*(acc.length-1)))]:0;
  return {speed,step,rate,fovStep,accP99:p99};
}
export function pushWithinLimits(m:ReturnType<typeof pushMotion>):boolean{const L=COAST_MOTION_LIMITS;return m.rate<=L.yawPitchDegS&&m.accP99<=L.angAccP99DegS2&&m.speed<=L.speedMS&&m.step<=L.stepMPerFrame&&m.fovStep<=L.fovDegPerFrame;}
/** Shortest push time >= base (0.05 s steps, <= 12 s) that keeps the push inside the limits at 60 and 30 fps. */
export function coastPushSeconds(from:LookAtPose,to:LookAtPose,base:number):number{
  for(let s=base;s<=12+1e-9;s+=0.05)if(pushWithinLimits(pushMotion(from,to,s,1/60))&&pushWithinLimits(pushMotion(from,to,s,1/30)))return Math.round(s*1000)/1000;
  return 12;
}
