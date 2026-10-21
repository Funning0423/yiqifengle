import type {Pose, Vec} from '../world-r1/WorldFlowCore';
import {FreeOrbit, ORBIT_FEEL} from './FreeOrbit';
/** QA only (qaShot region 'lakeside'): phases of the b15 balloon → shore tail and the free-look reveal pose. Pure, no engine. */
export type LakesideQaPhase='door'|'walk'|'reveal';
export function lakesideQaPhase(v:unknown):LakesideQaPhase{return v==='walk'||v==='reveal'?v:'door';}
/** Which tail mark (published by RegionJourneyAdapter on globalThis.__qaLakeside.mark) each phase freezes after, and how long (s, game time). */
export const LAKESIDE_QA_FREEZE:Readonly<Record<LakesideQaPhase,{mark:'door'|'walk'|'shore';afterS:number}>>={door:{mark:'door',afterS:.9},walk:{mark:'walk',afterS:2.2},reveal:{mark:'shore',afterS:.3}};
/** Moored balloon proxy (transport_balloon.glb bbox x/z ±2.9, y 0…10.4): envelope ellipsoid + basket corners, local to the basket origin. */
export function balloonProxy(at:Vec):Vec[]{
 const out:Vec[]=[];
 for(let i=0;i<8;i++)for(let j=0;j<=4;j++){const a=i/8*Math.PI*2,e=(j/4-.5)*Math.PI,c=Math.cos(e);out.push([at[0]+Math.cos(a)*c*2.9,at[1]+7.0+Math.sin(e)*3.4,at[2]+Math.sin(a)*c*2.9]);}
 for(const x of [-.8,.8])for(const z of [-.8,.8])for(const y of [0,1.2])out.push([at[0]+x,at[1]+y,at[2]+z]);
 return out;
}
function maxNdc(p:Pose,asp:number,pts:readonly Vec[]):number{
 const f=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],fl=Math.hypot(f[0],f[1],f[2])||1;f[0]/=fl;f[1]/=fl;f[2]/=fl;
 let r=[-f[2],0,f[0]];const rl=Math.hypot(r[0],r[2])||1;r=[r[0]/rl,0,r[2]/rl];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const th=Math.tan((p.fovVerticalDeg||48)*Math.PI/360);let m=0;
 for(let i=0;i<pts.length;i++){const q=pts[i],v=[q[0]-p.position[0],q[1]-p.position[1],q[2]-p.position[2]],z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2];if(z<.2)return 99;
  m=Math.max(m,Math.abs((v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*asp)),Math.abs((v[0]*u[0]+v[1]*u[1]+v[2]*u[2])/(z*th)));}
 return m;
}
/** Free look on the lakeside orbit (revealWiden, seedAimBlend) from `board`: the smallest drag that frames the balloon + her
 *  inside `fit` of the frame. Returns the orbit pose after that drag (same as a player's drag would give), or null. */
export function lakesideRevealPose(board:Pose,feet:Vec,balloon:Vec,aspect:number,fit=.98):{pose:Pose;yawDeg:number;pitchDeg:number;maxNdc:number}|null{
 const her:Vec[]=[[feet[0],feet[1],feet[2]],[feet[0],feet[1]+1.65,feet[2]]],pts=balloonProxy(balloon).concat(her);
 let best:{pose:Pose;yawDeg:number;pitchDeg:number;maxNdc:number;c:number}|null=null;
 for(const sgn of [1,-1])for(let dy=0;dy<=230;dy+=2){for(let dp=-48;dp<=48;dp+=2){
  const o=new FreeOrbit('lakeside');o.seed(board,feet);
  // drag in small steps so seedAimBlend sees the accumulated input exactly as a finger would
  const n=Math.max(1,Math.ceil(dy/2));for(let k=0;k<n;k++)o.drag(sgn*dy/n/ORBIT_FEEL.yawPerScreen,dp/n/ORBIT_FEEL.pitchPerScreen);
  const p=o.rawPose(feet);if(p.position[1]<feet[1]+.5)continue;const m=maxNdc(p,aspect,pts);
  if(m<=fit){const c=dy+Math.abs(dp)*.3;if(!best||c<best.c)best={pose:p,yawDeg:sgn*dy,pitchDeg:-dp,maxNdc:m,c};break;}}
  if(best&&Math.abs(best.yawDeg)<dy)break;}
 return best?{pose:best.pose,yawDeg:best.yawDeg,pitchDeg:best.pitchDeg,maxNdc:best.maxNdc}:null;
}
