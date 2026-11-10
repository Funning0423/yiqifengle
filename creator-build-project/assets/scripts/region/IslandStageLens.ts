/** 运镜bot b20 (方案 E, island I4 at [4.1,0.112,2.7], scene c651ba8c): stage-04 node lenses, pure (no cc).
 *  ENTRY (I3>I4 reward walk): the board lens stays where it is and only pans to keep her framed (the old 0.6 s blend to the
 *  follow close-up was ~46 m in 0.6 s). DEPARTURE (I4>I6, then LiveHandoff into the sail): from the live lens (push-in end) a
 *  tangent line + arc round I6 (+x side), Chaikin-smoothed, arc-length on a trapezoid clock over the walk, aim on her planned
 *  (smoothed) position, ending exactly on the follow pose at I6 before she boards. Limits (Grok Bot, per real dt, 7 screens):
 *  yaw/pitch <= 90 deg/s, angular accel p99 <= 200 deg/s^2, <= 8 m/s, <= 0.5 m/frame, fov <= 1.5 deg/frame; gate: island-stage04-lens. */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
export const ISLAND_STAGE_LENS=Object.freeze({preS:0.4,rampS:1.0,endS:0.2,arcM:8,arcY:4.5,k1:0.8,k2:1.0,smooth:4,walkMps:1.2,panInS:0.6,herLookM:1.1,
 /* exit pose (b20 7eecdca8, skinned palms): 'hero' = on the island v2.2 hero axis, sea side of I6, she walks toward the lens with the
    lighthouse behind her; >= 3 m from all (skinned) geometry. The old follow@I6 sat 1.62 m (1.38 m after the palm move) from palm_young_01. */
 end:'hero' as 'hero'|'follow',heroAzDeg:-15,heroDistM:6,heroUpM:3.2,heroAimM:1.2,heroBowM:8,
 /* entry dodge: a there-and-back lens offset (world m) peaking while she passes palm_lean_01, back on the board pose by the walk end */
 entOff:[0,0,0] as readonly number[],entRiseS:1.5,entFallS:1.5});
type V=[number,number,number];
const sub=(a:readonly number[],b:readonly number[]):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const unit=(v:readonly number[]):V=>{const n=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/n,v[1]/n,v[2]/n];};
const mj=(u:number)=>{const x=Math.max(0,Math.min(1,u));return x*x*x*(10-15*x+6*x*x);};
function slerp(a:V,b:V,u:number):V{const d=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])),w=Math.acos(d);if(w<1e-6||u>=1)return b;if(u<=0)return a;const s=Math.sin(w),p=Math.sin((1-u)*w)/s,q=Math.sin(u*w)/s;return [a[0]*p+b[0]*q,a[1]*p+b[1]*q,a[2]*p+b[2]*q];}
function cum(path:readonly Vec[]):number[]{const c=[0];for(let i=1;i<path.length;i++)c.push(c[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1],path[i][2]-path[i-1][2]));return c;}
function along(path:readonly Vec[],c:readonly number[],d:number):V{const L=c[c.length-1],x=Math.max(0,Math.min(L,d));let i=1;while(i<c.length-1&&c[i]<x)i++;const a=path[i-1],b=path[i],s=(x-c[i-1])/Math.max(1e-9,c[i]-c[i-1]);return [a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s,a[2]+(b[2]-a[2])*s];}
/** Her planned position t s after she starts (walk at walkMps), smoothed over +-0.6 s so path corners never kick the aim. */
function herAt(path:readonly Vec[],c:readonly number[],t:number):V{const v=ISLAND_STAGE_LENS.walkMps,o:V=[0,0,0];let ws=0;for(let k=-10;k<=10;k++){const w=1-Math.abs(k)/11,q=along(path,c,(t+k*0.06)*v);o[0]+=q[0]*w;o[1]+=q[1]*w;o[2]+=q[2]*w;ws+=w;}return [o[0]/ws,o[1]/ws+ISLAND_STAGE_LENS.herLookM,o[2]/ws];}
/** Her heading at the walk end (radians, atan2(dx,dz)), averaged over the last 1.2 m. */
export function endHeading(path:readonly Vec[]):number{const c=cum(path),L=c[c.length-1],a=along(path,c,L-1.2),b=along(path,c,L);return Math.atan2(b[0]-a[0],b[2]-a[2]);}
/** The hero-axis exit pose for a walk ending at C (fov kept from the follow pose). */
export function heroEnd(walk:readonly Vec[],fov=48):Pose{const K=ISLAND_STAGE_LENS,C=walk[walk.length-1],a=K.heroAzDeg*Math.PI/180;
 return {position:[C[0]+K.heroDistM*Math.sin(a),C[1]+K.heroUpM,C[2]+K.heroDistM*Math.cos(a)] as Vec,target:[C[0],C[1]+K.heroAimM,C[2]] as Vec,fovVerticalDeg:fov};}
export type StageLens={seconds:number;preS:number;at:(t:number)=>Pose;end:Pose};
/** DEPARTURE. from = live lens on the reveal frame; walk = her planned walk (world); follow = the follow pose at the walk end. t=0 is the
 *  reveal; she starts walking at preS; the lens lands on follow at preS+walkS-endS and holds. */
export function islandDepartLens(from:Pose,walk:readonly Vec[],follow0:Pose):StageLens{
 const K=ISLAND_STAGE_LENS,hero=K.end==='hero',follow=hero?heroEnd(walk,follow0.fovVerticalDeg??48):follow0,c=cum(walk),walkS=c[c.length-1]/K.walkMps,W=K.preS+walkS-K.endS,C=walk[walk.length-1],R=K.arcM,P=from.position;
 const az=(p:readonly number[])=>Math.atan2(p[0]-C[0],p[2]-C[2]);const D=Math.hypot(P[0]-C[0],P[2]-C[2]);
 let a0=az(P)+(D>R?Math.acos(R/D):0),a1=az(follow.position);while(a1<a0)a1+=2*Math.PI;
 const Wa:V=[C[0]+R*Math.sin(a0),K.arcY,C[2]+R*Math.cos(a0)];let pts:V[]=[];
 if(hero){const Q=follow.position,lx=-(Q[2]-P[2]),lz=Q[0]-P[0],ln=Math.hypot(lx,lz)||1;for(let i=0;i<=60;i++){const u=i/60,b=K.heroBowM*Math.sin(Math.PI*u)/ln;pts.push([P[0]+(Q[0]-P[0])*u+lx*b,P[1]+(Q[1]-P[1])*u,P[2]+(Q[2]-P[2])*u+lz*b]);}}
 else{for(let i=0;i<=30;i++){const u=i/30;pts.push([P[0]+(Wa[0]-P[0])*u,P[1]+(Wa[1]-P[1])*u,P[2]+(Wa[2]-P[2])*u]);}
 const rE=Math.hypot(follow.position[0]-C[0],follow.position[2]-C[2]);
 for(let i=1;i<=60;i++){const u=i/60,a=a0+(a1-a0)*u,r=R+(rE-R)*mj(u);pts.push([C[0]+r*Math.sin(a),K.arcY+(follow.position[1]-K.arcY)*mj(u),C[2]+r*Math.cos(a)]);}}
 for(let k=0;k<K.smooth;k++){const q:V[]=[pts[0]];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];q.push([.75*a[0]+.25*b[0],.75*a[1]+.25*b[1],.75*a[2]+.25*b[2]],[.25*a[0]+.75*b[0],.25*a[1]+.75*b[1],.25*a[2]+.75*b[2]]);}q.push(pts[pts.length-1]);pts=q;}
 pts[pts.length-1]=[follow.position[0],follow.position[1],follow.position[2]];
 const pc=cum(pts),len=pc[pc.length-1],RA=K.rampS,v=1/(W-RA);
 const trap=(t:number)=>t<=0?0:t>=W?1:t<RA?v*t*t/(2*RA):t>W-RA?1-v*(W-t)*(W-t)/(2*RA):v*(t-RA/2);
 const d0=unit(sub(from.target,from.position)),dF=unit(sub(follow.target,follow.position)),f0=from.fovVerticalDeg??48,f1=follow.fovVerticalDeg??48;
 const end:Pose={position:[...follow.position] as Vec,target:[...follow.target] as Vec,fovVerticalDeg:f1};
 const at=(t:number):Pose=>{if(t>=W)return end;const p=along(pts,pc,trap(t)*len),look=herAt(walk,c,t-K.preS);
  let d=slerp(d0,unit(sub(look,p)),mj(t/K.k1));d=slerp(d,dF,mj((t-(W-K.k2))/K.k2));
  return {position:p as Vec,target:[p[0]+d[0]*10,p[1]+d[1]*10,p[2]+d[2]*10],fovVerticalDeg:f0+(f1-f0)*mj(t/W)};};
 return {seconds:K.preS+walkS,preS:K.preS,at,end};
}
/** ENTRY. board = the lens on screen when the reward walk starts; the position stays, the aim eases onto her (panInS) and follows her
 *  planned walk; the reward's own followToBoard blend brings it back (a few degrees). */
export function islandEntryPan(board:Pose,walk:readonly Vec[]):StageLens{
 const K=ISLAND_STAGE_LENS,c=cum(walk),walkS=c[c.length-1]/K.walkMps,d0=unit(sub(board.target,board.position)),P=board.position;
 const at=(t:number):Pose=>{const b=mj(t/K.entRiseS)*mj((walkS-t)/K.entFallS),O=K.entOff,Q:V=[P[0]+O[0]*b,P[1]+O[1]*b,P[2]+O[2]*b];const d=slerp(d0,unit(sub(herAt(walk,c,t),Q)),mj(t/K.panInS));return {position:Q,target:[Q[0]+d[0]*10,Q[1]+d[1]*10,Q[2]+d[2]*10],fovVerticalDeg:board.fovVerticalDeg};};
 return {seconds:walkS,preS:0,at,end:at(walkS)};
}
/** Wiring helper for RegionNodeStage: a per-frame writer (dt clamp 0.1 s, the stage's own clock). */
export function stageLensClock(l:StageLens,t0=0):(dt?:number)=>Pose{let t=t0;return (dt=0)=>{t+=Math.max(0,Math.min(0.1,dt));return l.at(t);};}
