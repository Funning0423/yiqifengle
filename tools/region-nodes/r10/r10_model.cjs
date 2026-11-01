'use strict';
// 运镜bot r10 spec model (docs/r5/room-orbit/R10_SPEC.md). A pure function pose(θ, pitch, dist) of the input built from
// the real room geometry and the exported FreeOrbit helpers @d1a491c1 (roomArm, softMin, softClamp, frameCentre,
// roomViewDir, ORBIT_LIMITS.home). One weight w(θ) blends lens position, aim point and framing. Also an r9-style model
// (approximation: the r9 code is not visible here) for comparison: position/framing from the old narrow-band static goal
// (roomGoalAt), view direction slerped over a 60° band.
const fs=require('node:fs'),path=require('node:path');
const {load}=require('../load.cjs');
const C=load('region/FreeOrbit.ts'),REF=load('world-r1/CharacterReference.ts');
const L=C.ORBIT_LIMITS.home,R=L.roomLook,BOX=L.keepInside,INSET=C.ROOM_LOOK_FEEL.insetM,seat=REF.CHARACTER_REFERENCE.seatedRoot;
const FX=path.join(__dirname,'../fixtures/room-keepinside'),J=f=>JSON.parse(fs.readFileSync(path.join(FX,f),'utf8'));
const HER_PTS=J('her_seated_points.json').points,WALLS=J('inner_walls.json').polygonXZ,WORLD=J('world_boxes.json').boxes;
const HER_C=(()=>{const mn=[9,9,9],mx=[-9,-9,-9];for(const q of HER_PTS)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],q[k]);mx[k]=Math.max(mx[k],q[k])}return [0,1,2].map(k=>(mn[k]+mx[k])/2)})();
const FEET=[seat[0],seat[1],seat[2]],O0=new C.FreeOrbit('home'),LOOK=O0.orbitPivot(FEET),LC=R.lensCentreOffset||[0,0,0],LO=[LOOK[0]+LC[0],LOOK[1]+LC[1],LOOK[2]+LC[2]];
const ABOX={min:[BOX.min[0],BOX.min[1],BOX.min[2]-(R.armGrowZM||0)],max:BOX.max,cornerM:BOX.cornerM};
const ASPECT=390/844,TAN_V=Math.tan(L.fovDeg/2*Math.PI/180),TAN_H=TAN_V*ASPECT,SAFE=0.9;
const D2R=Math.PI/180,wrap180=d=>{let x=d;while(x>180)x-=360;while(x<-180)x+=360;return x};
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],nrm=a=>Math.hypot(a[0],a[1],a[2]),unit=a=>{const n=nrm(a)||1;return [a[0]/n,a[1]/n,a[2]/n]};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
// Blend profiles s(u), u in [0,1]: value and the band curvature factor are evaluated numerically by the checker.
const PROFILES={
 smoothstep:u=>u*u*(3-2*u),
 smootherstep:u=>u*u*u*(u*(u*6-15)+10),
 // bang-bang on (u² s')' / u (the optimum of max|u s'' + 2 s'| when the mismatch grows 1:1 across the band): s' = c/2
 // up to u1 = 1/√2, then c(1/u² − 1)/2; c = 1/(√2 − 1). C1 at u1, s'(1) = 0.
 bangbang:u=>{const c=1/(Math.SQRT2-1),u1=Math.SQRT1_2;return u<=u1?c/2*u:c/2*u1+c/2*((1/u1-1/u)-(u-u1))},
};
const sat=t=>t<=0?0:t>=1?1:t;
// r10 parameters (R10_SPEC.md §3). edgeA/edgeB: the orbit core [edgeA, edgeB] (w = 0, input yaw, degrees); W: band width
// on each side; satW: the orbit lens yaw stops over satW past the core edge (ψ: slope 1 → 0, C1, constant decel);
// gazeM: room gaze point distance; profile: blend profile.
const R10={edgeA:330,edgeB:14,W:50,satW:30,gazeM:1.9,profile:'smootherstep',envK:3};   // envK: plan envelope exponent (§2.3); aimQ (default 1) only for the rejected variant
function outside(theta,P){const a=wrap180(theta-P.edgeA),b=wrap180(theta-P.edgeB),span=wrap180(P.edgeB-P.edgeA);const c=wrap180(theta-P.edgeA);
 if(c>=0&&c<=span+1e-9)return {e:0,side:0};const ea=-a,eb=b;return ea>0&&(eb<=0||ea<eb)?{e:ea,side:-1}:{e:eb,side:1}}
function weight(theta,P){const o=outside(theta,P);return PROFILES[P.profile](sat(o.e/P.W))}
function orbitYaw(theta,P){const o=outside(theta,P);if(o.side===0)return theta;const t=o.e/P.satW,psi=t<1?t-t*t/2:0.5;return (o.side<0?P.edgeA:P.edgeB)+o.side*P.satW*psi}
// Orbit lens. r10: the wall arm is replaced by an analytic plan envelope (R10_SPEC.md §2.3): one p-norm over the three
// inset walls the orbit can face (east, west, north) and the requested distance,
//   ρh = softMin(dist·cos(pitch), E(ψ)),  1/E^k = Σ_i (max(0, n_i·d(ψ)) / g_i)^k,   d(ψ) = (sin ψ, cos ψ), g_i = inset wall gap from LO,
// a C1 superellipse inside the inset box (p-norm ≥ max-norm, so ρh ≤ the exact wall arm: inside by construction) whose
// curvature is bounded, unlike the wall-sliding exact arm (roomArm: ~0.3 m per degree near the side walls).
const GAPS=(()=>{const lo=[BOX.min[0]+INSET,BOX.min[2]+INSET],hi=[BOX.max[0]-INSET,BOX.max[2]-INSET];return {E:hi[0]-LO[0],W:LO[0]-lo[0],N:hi[1]-LO[2]}})();
function envH(yaw,pitch,dist,k){const s=Math.sin(yaw*D2R),c=Math.cos(yaw*D2R),pp=x=>x>0?Math.pow(x,k):0;
 const walls=Math.pow(pp(s/GAPS.E)+pp(-s/GAPS.W)+pp(c/GAPS.N),-1/k);   // plan wall envelope (horizontal radius)
 return C.softMin(dist*Math.cos(pitch*D2R),walls)}                      // the requested distance joins with FreeOrbit's softMin (softK)
function orbitLens(yaw,pitch,dist,P){const pr=pitch*D2R,yr=yaw*D2R,cp=Math.cos(pr),u=[Math.sin(yr)*cp,Math.sin(pr),Math.cos(yr)*cp];
 const d=P&&P.envK?envH(yaw,pitch,dist,P.envK)/cp:C.softMin(dist,C.roomArm(LO,yaw,pitch,ABOX,INSET));
 return [LO[0]+u[0]*d,C.softClamp(LO[1]+u[1]*d,BOX.min[1]+INSET,Math.min(BOX.max[1]-INSET,R.lensMaxY||1e9)),LO[2]+u[2]*d]}
function herAim(q){const h=C.frameCentre(q,unit(sub(HER_C,q)),LOOK,R.framePts),r=nrm(sub(HER_C,q));return [q[0]+h[0]*r,q[1]+h[1]*r,q[2]+h[2]*r]}
// r10 pose: lens = lerp(orbitLens(orbitYaw(θ)), roomCentre, w); aim = lerp(herAim(orbit lens), gaze, w); view = aim − lens.
function poseR10(theta,pitch,dist,P=R10){const w=weight(theta,P),lo=orbitLens(orbitYaw(theta,P),pitch,dist,P),c=R.center;
 const lens=lerp(lo,c,w),gaze=(()=>{const g=C.roomViewDir(theta,pitch,R);return [c[0]+g[0]*P.gazeM,c[1]+g[1]*P.gazeM,c[2]+g[2]*P.gazeM]})();
 const aim=lerp(herAim(lo),gaze,P.aimQ?Math.pow(w,P.aimQ):w);return {w,lens,f:unit(sub(aim,lens)),aim}}
// r9-style: lens from the old static goal (narrow arm band, no follower), view = slerp(look at her, room view, s(60° band)).
function slerp(a,b,t){const c=Math.max(-1,Math.min(1,dot(a,b))),om=Math.acos(c);if(om<1e-6)return a;const s0=Math.sin((1-t)*om)/Math.sin(om),s1=Math.sin(t*om)/Math.sin(om);return unit([a[0]*s0+b[0]*s1,a[1]*s0+b[1]*s1,a[2]*s0+b[2]*s1])}
const R9={edgeA:330,edgeB:14,W:60,profile:'smoothstep'};
function poseR9(theta,pitch,dist){const g=O0.roomGoalAt(LOOK,theta,pitch,dist,[],0),lens=g.pos,w=weight(theta,R9);
 const hv=C.frameCentre(lens,unit(sub(HER_C,lens)),LOOK,R.framePts),gv=C.roomViewDir(theta,pitch,R);return {w,wPos:g.w,lens,f:slerp(hv,gv,w)}}
function camFrame(f){const r=unit(cross(f,[0,1,0]));return [r,cross(r,f),f]}
function onScreen(p,f,q){const [r,u]=camFrame(f),d=sub(q,p),z=dot(d,f);if(z<=0.05)return {x:9,y:9,e:9};const x=dot(d,r)/z/TAN_H,y=dot(d,u)/z/TAN_V;return {x,y,e:Math.max(Math.abs(x),Math.abs(y))}}
function herEdge(p,f){let e=0;for(const q of HER_PTS)e=Math.max(e,onScreen(p,f,q).e);return e}
function omegaPer(a,b,h){const A=camFrame(a),B=camFrame(b);const M=[[0,0,0],[0,0,0],[0,0,0]];for(let q=0;q<3;q++)for(let r=0;r<3;r++)for(let c=0;c<3;c++)M[r][c]+=B[q][r]*A[q][c];
 const tr=M[0][0]+M[1][1]+M[2][2],ang=Math.acos(Math.max(-1,Math.min(1,(tr-1)/2))),ax=[M[2][1]-M[1][2],M[0][2]-M[2][0],M[1][0]-M[0][1]],sn=nrm(ax);return sn<1e-12?[0,0,0]:ax.map(v=>v/sn*ang/D2R/h)}
function wallGap(x,z){let m=1e9;for(let i=0,j=WALLS.length-1;i<WALLS.length;j=i++){const a=WALLS[j],b=WALLS[i],dx=b[0]-a[0],dz=b[1]-a[1],LL=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/LL));m=Math.min(m,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz))}return m}
function herGap(p){let m=1e9;for(const q of HER_PTS)m=Math.min(m,nrm(sub(p,q)));return m}
module.exports={GAPS,envH,LO,C,L,R,BOX,HER_C,HER_PTS,LOOK,WORLD,PROFILES,R10,R9,weight,orbitYaw,orbitLens,poseR10,poseR9,onScreen,herEdge,omegaPer,wallGap,herGap,camFrame,sub,nrm,unit,dot,wrap180,D2R,SAFE};
