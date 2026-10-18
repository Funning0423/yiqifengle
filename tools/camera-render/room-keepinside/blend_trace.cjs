'use strict';
// 运镜bot r5: frame-by-frame trace of the room look (real FreeOrbit: goal blend + rate-limited goal + tracker) for a yaw
// sweep 0→360° at RATE °/s, pitch 10°, arm 3.35 m, FPS, with the world colliders. node blend_trace.cjs OUT.json [rate] [fps]
const fs=require('node:fs'),path=require('node:path');const {load}=require('../../region-nodes/load.cjs');
const C=load('region/FreeOrbit.ts'),R=load('world-r1/CharacterReference.ts'),seat=R.CHARACTER_REFERENCE.seatedRoot,L=C.ORBIT_LIMITS.home;
const FX=path.join(__dirname,'../../region-nodes/fixtures/room-keepinside'),boxes=JSON.parse(fs.readFileSync(path.join(FX,'world_boxes.json'),'utf8')).boxes,W=JSON.parse(fs.readFileSync(path.join(FX,'inner_walls.json'),'utf8'));
const rate=+(process.argv[3]||30),fps=+(process.argv[4]||60),dt=1/fps,feet=[seat[0],seat[1],seat[2]],her=[seat[0],seat[1]+L.lookM,seat[2]];
const poly=W.polygonXZ;function edgeGap(x,z){let m=1e9;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i],dx=b[0]-a[0],dz=b[1]-a[1],LL=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/LL));m=Math.min(m,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz))}return m}
const o=new C.FreeOrbit('home');o.mode='free';o.yaw=0;o.pitch=10;o.dist=L.distMax;o.solve(feet,boxes,seat[1]);
const fr=[];const T=360/rate+3;for(let t=0;t<=T;t+=dt){o.yaw=Math.min(360,rate*t);o.step(dt);const p=o.solve(feet,boxes,seat[1]);const n=Math.hypot(p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]);
 fr.push({t:+t.toFixed(4),yawInput:o.yaw,w:o.roomWeight,p:p.position,f:[0,1,2].map(k=>(p.target[k]-p.position[k])/n),wall:edgeGap(p.position[0],p.position[2]),her:Math.hypot(p.position[0]-her[0],p.position[1]-her[1],p.position[2]-her[2])})}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
for(let i=1;i<fr.length-1;i++){const a=[0,1,2].map(k=>(fr[i+1].p[k]-2*fr[i].p[k]+fr[i-1].p[k])/dt/dt);fr[i].lin=Math.hypot(...a);fr[i].speed=Math.hypot(...[0,1,2].map(k=>(fr[i+1].p[k]-fr[i-1].p[k])/2/dt));
 const w1=cross(fr[i-1].f,fr[i].f),w2=cross(fr[i].f,fr[i+1].f);fr[i].ang=Math.hypot(w2[0]-w1[0],w2[1]-w1[1],w2[2]-w1[2])/dt/dt*180/Math.PI;fr[i].angVel=Math.hypot(...w2)/dt*180/Math.PI}
fs.writeFileSync(process.argv[2],JSON.stringify({rate,fps,polygon:poly,keep:L.keepInside,center:L.roomLook.center,her,frames:fr}));
const lagOf=f=>{const vy=Math.atan2(f.f[0],f.f[2])*180/Math.PI;return Math.abs(((f.yawInput+180-vy)%360+540)%360-180)};const end=fr.filter(f=>f.t>=360/rate);
const pk=k=>Math.max(...fr.filter(f=>f[k]!==undefined).map(f=>f[k]));console.log(JSON.stringify({rate,fps,frames:fr.length,peakLin:+pk('lin').toFixed(2),peakAng:+pk('ang').toFixed(1),peakSpeed:+pk('speed').toFixed(2),minWall:+Math.min(...fr.map(f=>f.wall)).toFixed(3),minHer:+Math.min(...fr.map(f=>f.her)).toFixed(2),peakAngVel:+pk('angVel').toFixed(1),maxViewLagDeg:+Math.max(...fr.map(lagOf)).toFixed(1),lagAtStopDeg:+lagOf(end[0]).toFixed(1),lag3sAfterStopDeg:+lagOf(end[end.length-1]).toFixed(1)}));
