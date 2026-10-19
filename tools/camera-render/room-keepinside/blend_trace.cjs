'use strict';
// 运镜bot r5/r6 (r8: + wIn, view blend s, fov, target, input dir, her centre): frame-by-frame trace of the room look (real FreeOrbit) with the world colliders.
//   node blend_trace.cjs OUT.json sweep RATE FPS     yaw 0→360° at RATE °/s (finger held), pitch 10°, arm 3.35 m, then 1 s still
//   node blend_trace.cjs OUT.json backforth 150 FPS  150°/s drags flipping every 0.15 s from yaw 340, then 1 s still
// Per frame: blend w, lens, view, view lag vs the input's own view (deg), lens lag vs the input's static goal (m), lens
// speed / linear accel, camera (roll-free look-at) angular accel, wall gap, distance to her.
const fs=require('node:fs'),path=require('node:path');const {load}=require('../../region-nodes/load.cjs');
const C=load('region/FreeOrbit.ts'),R=load('world-r1/CharacterReference.ts'),seat=R.CHARACTER_REFERENCE.seatedRoot,L=C.ORBIT_LIMITS.home;
const FX=path.join(__dirname,'../../region-nodes/fixtures/room-keepinside'),boxes=JSON.parse(fs.readFileSync(path.join(FX,'world_boxes.json'),'utf8')).boxes,W=JSON.parse(fs.readFileSync(path.join(FX,'inner_walls.json'),'utf8'));
const HER_C=(()=>{const pts=JSON.parse(fs.readFileSync(path.join(__dirname,'../../region-nodes/fixtures/room-keepinside/her_seated_points.json'),'utf8')).points,mn=[9,9,9],mx=[-9,-9,-9];for(const q of pts)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],q[k]);mx[k]=Math.max(mx[k],q[k])}return [0,1,2].map(k=>(mn[k]+mx[k])/2)})();   // her body centre (same as test_room_keepinside)
const mode=process.argv[3]||'sweep',rate=+(process.argv[4]||30),fps=+(process.argv[5]||60),dt=1/fps,feet=[seat[0],seat[1],seat[2]],her=[seat[0],seat[1]+L.lookM,seat[2]];
const poly=W.polygonXZ;function edgeGap(x,z){let m=1e9;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i],dx=b[0]-a[0],dz=b[1]-a[1],LL=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/LL));m=Math.min(m,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz))}return m}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],angle=(a,b)=>Math.atan2(Math.hypot(...cross(a,b)),a[0]*b[0]+a[1]*b[1]+a[2]*b[2])*180/Math.PI;
function camFrame(f){const r=cross(f,[0,1,0]),n=Math.hypot(...r)||1,rr=r.map(v=>v/n);return [rr,cross(rr,f),f]}
function omega(a,b){const A=camFrame(a),B=camFrame(b),M=[[0,0,0],[0,0,0],[0,0,0]];for(let q=0;q<3;q++)for(let r=0;r<3;r++)for(let c=0;c<3;c++)M[r][c]+=B[q][r]*A[q][c];
 const tr=M[0][0]+M[1][1]+M[2][2],ang=Math.acos(Math.max(-1,Math.min(1,(tr-1)/2))),ax=[M[2][1]-M[1][2],M[0][2]-M[2][0],M[1][0]-M[0][1]],sn=Math.hypot(...ax);return sn<1e-12?[0,0,0]:ax.map(v=>v/sn*ang/dt)}
const o=new C.FreeOrbit('home'),fr=[];o.yaw=mode==='sweep'?0:340;o.pitch=10;o.dist=L.distMax;
function rec(t,moving){const p=o.solve(feet,boxes,seat[1]),n=Math.hypot(p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]),g=o.roomGoalAt(o.orbitPivot(feet),o.yaw,o.pitch,o.dist,boxes,seat[1]);const G=o.roomGoalPos;
 const f=[0,1,2].map(k=>(p.target[k]-p.position[k])/n);fr.push({t:+t.toFixed(4),moving,yawInput:o.yaw,w:o.roomWeight,wIn:g.w,s:o.roomViewBlend,fov:p.fovVerticalDeg,target:p.target,goalDir:g.dir,herC:HER_C,p:p.position,f,viewLag:angle(f,g.dir),goal:g.pos,inner:[G[0],G[1],G[2]],posLag:Math.hypot(p.position[0]-g.pos[0],p.position[1]-g.pos[1],p.position[2]-g.pos[2]),wall:edgeGap(p.position[0],p.position[2]),her:Math.hypot(p.position[0]-her[0],p.position[1]-her[1],p.position[2]-her[2])})}
rec(0,false);let t=0;
if(mode==='sweep'){const n=Math.round(360/rate/dt);for(let i=0;i<n;i++){o.drag(rate*dt/C.ORBIT_FEEL.yawPerScreen,0,dt);o.step(dt);t+=dt;rec(t,true)}}
else for(let i=0;i<Math.round(2.4/dt);i++){const s=Math.floor(i*dt/0.15)%2?-1:1;o.drag(s*rate*dt/C.ORBIT_FEEL.yawPerScreen,0,dt);o.step(dt);t+=dt;rec(t,true)}
const tStop=t;for(let i=0;i<fps;i++){o.drag(0,0,dt);o.step(dt);t+=dt;rec(t,false)}
for(let i=1;i<fr.length-1;i++){const a=[0,1,2].map(k=>(fr[i+1].p[k]-2*fr[i].p[k]+fr[i-1].p[k])/dt/dt);fr[i].lin=Math.hypot(...a);fr[i].speed=Math.hypot(...[0,1,2].map(k=>(fr[i+1].p[k]-fr[i-1].p[k])/2/dt));
 const w1=omega(fr[i-1].f,fr[i].f),w2=omega(fr[i].f,fr[i+1].f);fr[i].angVel=Math.hypot(...w2)*180/Math.PI;fr[i].ang=Math.hypot(w2[0]-w1[0],w2[1]-w1[1],w2[2]-w1[2])/dt*180/Math.PI}
// settle: after the hand stops, time until the view is within 0.5° of its final direction (and stays)
const fin=fr[fr.length-1].f,after=fr.filter(f=>f.t>=tStop-1e-9);let settle=null;for(let i=0;i<after.length;i++)if(after.slice(i).every(f=>angle(f.f,fin)<0.5)){settle=after[i].t-tStop;break}
fs.writeFileSync(process.argv[2],JSON.stringify({mode,rate,fps,tStop,polygon:poly,keep:L.keepInside,center:L.roomLook.center,her,frames:fr}));
const pk=(k,F)=>Math.max(...(F||fr).filter(f=>f[k]!==undefined).map(f=>f[k]));
console.log(JSON.stringify({mode,rate,fps,frames:fr.length,maxViewLagDeg:+pk('viewLag').toFixed(3),settleS:settle===null?null:+settle.toFixed(3),maxLensLagM:+pk('posLag').toFixed(3),lensLag1sAfterStopM:+fr[fr.length-1].posLag.toFixed(3),peakLin:+pk('lin').toFixed(2),peakSpeed:+pk('speed').toFixed(2),peakViewTurnDegS:+pk('angVel').toFixed(1),minWall:+Math.min(...fr.map(f=>f.wall)).toFixed(3),minHer:+Math.min(...fr.map(f=>f.her)).toFixed(2)}));
