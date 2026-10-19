'use strict';
// 运镜bot r5 room camera (docs/r5/room-keepinside, docs/r5/room-orbit):
//  1. keepInside sits ≥0.30 m inside the measured inner walls (fixtures/room-keepinside/inner_walls.json, from
//     tools/camera-render/room-keepinside/bl_room_keepinside.py; chords between wall hits stay inside a convex room).
//  2. Room look: every yaw/pitch/arm gives a lens ≥0.25 m from the walls and never a face-hugging close-up (lens ≥1.0 m from
//     her look point, or looking out from the room centre), with and without the world's collider boxes.
//  3. Colliders: a box holding her and the lens is ignored; indoors the room shell / merged furniture / lighthouse exterior
//     are ignored by name; outdoor solves are bit-identical to FreeOrbit @a79ee49a (fixtures/.../outdoor_solve_baseline.json).
//  4. Motion: yaw/pitch/pinch sweeps, real drag flicks, the first drag off the authored home lens and a return after a
//     cinematic, at 30/60/120 fps: linear accel ≤3 m/s², camera-added angular accel ≤110°/s² (the raw view accel is the
//     hand's own and is reported), no jumps (speed ≤4 m/s), the whole time ≥0.25 m from the walls and ≥1.0 m from her.
//  5. The view follows the hand (r6): lag behind the input's own view ≤10°; after the hand stops the view settles within
//     0.3 s with no overshoot — drags at 30°/s and 90°/s and fast back-and-forth, at 30/60/120 fps.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load}=require('./load.cjs');
const C=load('region/FreeOrbit.ts'),R=load('world-r1/CharacterReference.ts');
const FX=path.join(__dirname,'fixtures/room-keepinside'),J=f=>JSON.parse(fs.readFileSync(path.join(FX,f),'utf8'));
const W=J('inner_walls.json'),WORLD=J('world_boxes.json').boxes,BASE=J('outdoor_solve_baseline.json').cases;
const BOX_MARGIN=0.30,LENS_MARGIN=0.25,NO_HUG_M=1.0,LIN_MAX=3,ANG_MAX=110,LAG_MAX=10,SETTLE_S=0.3,OWN_TURN_MAX=200;
const poly=W.polygonXZ;
function inside(x,z){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
function edgeGap(x,z){let m=1e9;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i],dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L));m=Math.min(m,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz))}return m}
function wallGap(p){if(!inside(p[0],p[2]))return -edgeGap(p[0],p[2]);return Math.min(edgeGap(p[0],p[2]),p[1]-W.floorY,W.ceilingY-p[1])}
const L=C.ORBIT_LIMITS.home,keep=L.keepInside,seat=R.CHARACTER_REFERENCE.seatedRoot,feet=[seat[0],seat[1],seat[2]],her=[seat[0],seat[1]+L.lookM,seat[2]];
const dist3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),unit=(a,b)=>{const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],n=Math.hypot(...d);return d.map(v=>v/n)};
const out={status:'PASS'};
// 1) bounds
let boxGap=1e9;
for(let x=keep.min[0];x<=keep.max[0]+1e-9;x+=0.05)for(const z of [keep.min[2],keep.max[2]])for(const y of [keep.min[1],keep.max[1]])boxGap=Math.min(boxGap,wallGap([x,y,z]));
for(let z=keep.min[2];z<=keep.max[2]+1e-9;z+=0.05)for(const x of [keep.min[0],keep.max[0]])for(const y of [keep.min[1],keep.max[1]])boxGap=Math.min(boxGap,wallGap([x,y,z]));
assert.ok(boxGap>=BOX_MARGIN,'keepInside box is '+boxGap.toFixed(3)+' m from the inner walls');
out.keepInside=keep;out.boxMarginM=+boxGap.toFixed(3);out.roomLook=L.roomLook;out.feel=C.ROOM_LOOK_FEEL;
// 2) static goals (a fresh orbit snaps to its goal)
function goal(yaw,pitch,dist,boxes){const o=new C.FreeOrbit('home');o.yaw=yaw;o.pitch=pitch;o.dist=dist;const p=o.solve(feet,boxes,seat[1]);return {p,w:o.roomWeight,arm:o.roomArmM}}
let worstWall=null,worstHer=null;const yaws=[];
for(const boxes of [[],WORLD])for(let yaw=0;yaw<360;yaw+=5)for(const pitch of [L.pitchMinDeg,10,L.pitchMaxDeg])for(const dist of [L.distMin,2.3,L.distMax]){
 const g=goal(yaw,pitch,dist,boxes),q=g.p.position,wg=wallGap(q),dh=dist3(q,her);
 assert.ok(wg>=LENS_MARGIN,`yaw ${yaw} pitch ${pitch} dist ${dist}: lens ${q.map(v=>v.toFixed(2))} ${wg.toFixed(3)} m from the walls`);
 assert.ok(dh>=NO_HUG_M,`yaw ${yaw} pitch ${pitch} dist ${dist}: lens ${dh.toFixed(2)} m from her (face hug)`);
 if(!worstWall||wg<worstWall.m)worstWall={yaw,pitch,dist,boxes:boxes.length>0,m:+wg.toFixed(3)};
 if(!worstHer||dh<worstHer.m)worstHer={yaw,pitch,dist,boxes:boxes.length>0,m:+dh.toFixed(3)};
 if(boxes.length&&yaw%45===0&&pitch===10&&dist===L.distMax)yaws.push({yaw,w:+g.w.toFixed(3),wallArmM:+g.arm.toFixed(2),lens:q.map(v=>+v.toFixed(3)),toHerM:+dh.toFixed(2),wallGapM:+wg.toFixed(3)});}
out.worstWall=worstWall;out.worstToHer=worstHer;out.yawsWithWorldBoxes=yaws;
{const pv=new C.FreeOrbit('home').orbitPivot(feet);assert.ok(C.roomEdge(pv[0],pv[2],keep,C.ROOM_LOOK_FEEL.insetM).s<0,'orbit pivot is inside the inset keepInside (else every yaw is the room-centre view)');
 const orb=yaws.filter(y=>y.w<0.5).map(y=>y.yaw);assert.ok(orb.includes(0)&&orb.includes(315),'yaw 0 and 315 still orbit her (w<0.5): '+orb);out.orbitYaws=orb;}
// 3) colliders
const hb={min:[-3,-1,-6],max:[3,4,0]},inB=[0,1,-2],outB=[9,1,9];
assert.equal(C.orbitIgnoresBox(hb,her,inB,false),true,'box holding her and the lens is not a collider');
assert.equal(C.orbitIgnoresBox(hb,her,outB,false),false,'box holding only her still counts');
assert.equal(C.orbitIgnoresBox({min:[5,0,5],max:[6,1,6],name:'env_interior_props_merged'},her,inB,true),true,'indoor room volume by name');
assert.equal(C.orbitIgnoresBox({min:[5,0,5],max:[6,1,6],name:'env_interior_props_merged'},her,inB,false),false,'outdoors names do not matter');
for(const yaw of [0,270,315]){const a=dist3(goal(yaw,10,L.distMax,WORLD).p.position,her);assert.ok(a>=1.2,'world boxes no longer collapse the arm (was ~0.6 m) at yaw '+yaw+' ('+a.toFixed(2)+')')}
let diff=0;
for(const c of BASE){const o=new C.FreeOrbit(c.place);o.yaw=c.yaw;o.pitch=c.pitch;o.dist=c.dist;
 const world=WORLD.filter(b=>!/^env_int|interior|lighthouse/.test(b.name)).map(b=>({min:b.min,max:b.max}));
 const p=o.solve(c.feet,world.concat(c.boxes),c.groundY,c.xz||undefined);
 const d=Math.max(dist3(p.position,c.expect.position),dist3(p.target,c.expect.target));if(d>1e-9)diff++;}
assert.equal(diff,0,'outdoor solves changed in '+diff+' of '+BASE.length+' cases');
out.outdoorRegression={cases:BASE.length,changed:diff,places:['island','meadow','skycity','lakeside']};
// 4) motion
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],angle=(a,b)=>Math.atan2(Math.hypot(...cross(a,b)),a[0]*b[0]+a[1]*b[1]+a[2]*b[2])*180/Math.PI;
// angular velocity (rad/s) of the CAMERA between frames i and i+1: the lens is a look-at with world up (fromLookAt), so
// its orientation is the frame (right, up, forward) of the view vector; ω = axis·angle of the relative rotation / dt.
// (A bare vector's minimal rotation would show a constant-rate yaw sweep at nonzero pitch as accelerating.)
function camFrame(f){const r=cross(f,[0,1,0]),n=Math.hypot(...r)||1,rr=r.map(v=>v/n);return [rr,cross(rr,f),f]}
function omega(fr,k,i,dt){const A=camFrame(fr[i][k]),B=camFrame(fr[i+1][k]),M=[[0,0,0],[0,0,0],[0,0,0]];
 for(let q=0;q<3;q++)for(let r=0;r<3;r++)for(let c=0;c<3;c++)M[r][c]+=B[q][r]*A[q][c];
 const tr=M[0][0]+M[1][1]+M[2][2],ang=Math.acos(Math.max(-1,Math.min(1,(tr-1)/2))),ax=[M[2][1]-M[1][2],M[0][2]-M[2][0],M[1][0]-M[0][1]],sn=Math.hypot(...ax);
 return sn<1e-12?[0,0,0]:ax.map(v=>v/sn*ang/dt)}
// Angular accel: the view now follows the input itself, so its raw accel includes the hand's own (an instant 90°/s
// start is thousands of °/s²; reported, not asserted). The bar (ANG_MAX) is asserted on (a) what the camera adds on top
// of the input's view g (return follower, first-drag fade): d/dt(ω_view − ω_g), and (b) the raw view accel while the hand
// moves at a steady rate (sweeps; the framing/blend geometry's own accel). Lag is measured against g.
function measure(frames,dt,name){let lin=0,angRaw=0,angCam=0,angSteady=0,ownSpeed=0,vmax=0,minWall=9,minHer=9,lag=0;
 for(const f of frames){minWall=Math.min(minWall,wallGap(f.p));minHer=Math.min(minHer,dist3(f.p,her));if(f.g&&!f.ret)lag=Math.max(lag,angle(f.f,f.g))}
 for(let i=1;i<frames.length;i++)vmax=Math.max(vmax,dist3(frames[i].p,frames[i-1].p)/dt);
 // the camera's own turn rate (no view jump): |ω_view − ω_g|, or the whole turn where the frame has no g (a seed / cinematic pose)
 for(let i=0;i<frames.length-1;i++){const a=omega(frames,'f',i,dt);let x;if(frames[i].g&&frames[i+1].g){const b=omega(frames,'g',i,dt);x=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])}else x=Math.hypot(...a);ownSpeed=Math.max(ownSpeed,x*180/Math.PI)}
 for(let i=1;i<frames.length-1;i++){const a=[0,1,2].map(k=>(frames[i+1].p[k]-2*frames[i].p[k]+frames[i-1].p[k])/dt/dt);lin=Math.max(lin,Math.hypot(...a));
  const w1=omega(frames,'f',i-1,dt),w2=omega(frames,'f',i,dt);angRaw=Math.max(angRaw,Math.hypot(w2[0]-w1[0],w2[1]-w1[1],w2[2]-w1[2])/dt*180/Math.PI);
  if(frames[i-2]&&frames[i+2]&&frames[i-2].steady&&frames[i+2].steady)angSteady=Math.max(angSteady,Math.hypot(w2[0]-w1[0],w2[1]-w1[1],w2[2]-w1[2])/dt*180/Math.PI);
  if(frames[i-1].g&&frames[i].g&&frames[i+1].g){const g1=omega(frames,'g',i-1,dt),g2=omega(frames,'g',i,dt);angCam=Math.max(angCam,Math.hypot(w2[0]-w1[0]-g2[0]+g1[0],w2[1]-w1[1]-g2[1]+g1[1],w2[2]-w1[2]-g2[2]+g1[2])/dt*180/Math.PI)}}
 const r={name,fps:Math.round(1/dt),peakLinAccMS2:+lin.toFixed(2),cameraAngAccDegS2:+angCam.toFixed(1),rawViewAngAccDegS2:+angRaw.toFixed(0),steadyViewAngAccDegS2:+angSteady.toFixed(1),cameraTurnDegS:+ownSpeed.toFixed(1),viewLagDeg:+lag.toFixed(2),peakSpeedMS:+vmax.toFixed(2),minWallGapM:+minWall.toFixed(3),minToHerM:+minHer.toFixed(2)};
 assert.ok(lin<=LIN_MAX,name+' linear accel '+r.peakLinAccMS2);assert.ok(angCam<=ANG_MAX,name+' camera angular accel '+r.cameraAngAccDegS2);assert.ok(angSteady<=ANG_MAX,name+' view accel at a steady hand '+r.steadyViewAngAccDegS2);
 assert.ok(lag<=LAG_MAX,name+' view lag '+r.viewLagDeg);assert.ok(ownSpeed<=OWN_TURN_MAX,name+' view jump: the camera itself turns '+r.cameraTurnDegS+' °/s');
 assert.ok(minWall>=LENS_MARGIN,name+' wall gap '+r.minWallGapM);assert.ok(minHer>=NO_HUG_M,name+' '+r.minToHerM+' m from her while moving');assert.ok(vmax<=4,name+' speed '+r.peakSpeedMS+' (jump)');return r}
// g: the view the player's own yaw/pitch/arm asks for (static goal at the input) — the lag reference
function inputDir(o){const pr=o.pitch*Math.PI/180,yr=o.yaw*Math.PI/180,cp=Math.cos(pr);return [-Math.sin(yr)*cp,-Math.sin(pr),-Math.cos(yr)*cp]}
function frame(o){const p=o.solve(feet,WORLD,seat[1]);const g=o.roomGoalAt(o.orbitPivot(feet),o.yaw,o.pitch,o.dist,WORLD,seat[1]).dir;return {p:p.position,f:unit(p.position,p.target),g:[g[0],g[1],g[2]],u:inputDir(o),w:o.roomWeight,ret:o.mode==='returning'}}
function sweep(fps,seconds,set,steady){const o=new C.FreeOrbit('home'),dt=1/fps,fr=[];o.mode='free';set(o,0);fr.push(frame(o));for(let t=dt;t<=seconds+1e-9;t+=dt){set(o,t);o.step(dt);const f=frame(o);f.steady=!!steady&&steady(t);fr.push(f)}return fr}
const motion=[];
for(const fps of [30,60,120]){
 for(const rate of [30,90,160])for(const pitch of [L.pitchMinDeg,10,L.pitchMaxDeg])motion.push(measure(sweep(fps,720/rate+2,(o,t)=>{o.yaw=Math.min(720,rate*t);o.pitch=pitch;o.dist=L.distMax},t=>t<720/rate),1/fps,`yaw sweep ${rate}°/s pitch ${pitch}`));
 for(const yaw of [0,60,120,200,260,300])motion.push(measure(sweep(fps,6,(o,t)=>{o.yaw=yaw;o.pitch=Math.max(L.pitchMinDeg,Math.min(L.pitchMaxDeg,L.pitchMinDeg+40*Math.abs(Math.sin(t))));o.dist=L.distMax}),1/fps,`pitch swing yaw ${yaw}`));
 for(const yaw of [0,270,315])motion.push(measure(sweep(fps,6,(o,t)=>{o.yaw=yaw;o.pitch=10;o.dist=L.distMin+(L.distMax-L.distMin)*Math.abs(Math.sin(t*1.5))}),1/fps,`pinch yaw ${yaw}`));
 // real input: authored home lens, then flicks through the drag API (finger events every frame, then inertia)
 {const o=new C.FreeOrbit('home'),dt=1/fps,fr=[];const home={position:[-1.32022071,1.38613379,-2.11374307],target:[-0.04,1.22,-4.45],fovVerticalDeg:60};
  o.seed(home,feet);fr.push({p:home.position,f:unit(home.position,home.target)});
  for(let i=0;i<Math.round(8*fps);i++){const t=i*dt;if(t<0.5||(t>2&&t<2.4)||(t>4&&t<4.2))o.drag(t<0.5?0.012:t<2.4?-0.03:0.06,0.002,dt);else o.release();o.step(dt);fr.push(frame(o))}
  const r=measure(fr,dt,'authored lens → drag flicks');r.firstDragViewTurnDeg=+angle(fr[0].f,fr[1].f).toFixed(3);r.firstDragLensStepM=+dist3(fr[0].p,fr[1].p).toFixed(4);
  assert.ok(r.firstDragViewTurnDeg<=Math.max(1,0.012*128*1.05),'first drag turns the view by more than the drag itself: '+r.firstDragViewTurnDeg);motion.push(r);}
 // a cinematic ends somewhere else; the orbit returns from there (drag is ignored until the view is back)
 {const o=new C.FreeOrbit('home'),dt=1/fps,fr=[];o.drag(0.3,0,dt);o.release();for(let i=0;i<fps;i++){o.step(dt);frame(o)}o.pause();
  const cine={position:[0.6,1.9,-1.2],target:[0.43,1.0,-4.2],fovVerticalDeg:60};o.beginReturn(cine);fr.push({p:cine.position,f:unit(cine.position,cine.target)});
  let back=null;for(let i=0;i<5*fps;i++){o.step(dt);fr.push(frame(o));if(back===null&&o.mode==='free')back=+(i*dt).toFixed(3)}
  const r=measure(fr,dt,'return after cinematic');r.viewBackAfterS=back;assert.ok(back!==null,'return never handed the view back');motion.push(r);}
}
const peak=k=>Math.max(...motion.map(m=>m[k]));
out.motion={cases:motion.length,peakLinAccMS2:peak('peakLinAccMS2'),peakCameraAngAccDegS2:peak('cameraAngAccDegS2'),peakRawViewAngAccDegS2:peak('rawViewAngAccDegS2'),peakViewLagDeg:peak('viewLagDeg'),peakSpeedMS:peak('peakSpeedMS'),minWallGapM:Math.min(...motion.map(m=>m.minWallGapM)),minToHerM:Math.min(...motion.map(m=>m.minToHerM)),rows:motion};
// 5) view follows the hand: lag ≤10° while dragging; after the hand stops the view settles within 0.3 s, no overshoot
function settleAfter(fr,iStop,dt,dirSign){const fin=fr[fr.length-1].f;let settle=null,over=0;
 for(let i=iStop;i<fr.length;i++){const a=angle(fr[i].f,fin);if(settle===null&&a<0.5){let ok=true;for(let k=i;k<fr.length;k++)if(angle(fr[k].f,fin)>=0.5){ok=false;break}if(ok)settle=(i-iStop)*dt}
  // overshoot: the view passes the final heading in the direction it was moving
  const yv=Math.atan2(fr[i].f[0],fr[i].f[2]),yf=Math.atan2(fin[0],fin[2]);let d=(yv-yf)*180/Math.PI;while(d>180)d-=360;while(d<-180)d+=360;over=Math.max(over,dirSign*d)}
 return {settleS:settle===null?null:+settle.toFixed(3),overshootDeg:+Math.max(0,over).toFixed(3)}}
const follow=[];
for(const fps of [30,60,120]){const dt=1/fps;
 for(const rate of [30,90]){const o=new C.FreeOrbit('home'),fr=[];o.yaw=0;o.pitch=10;o.dist=L.distMax;fr.push(frame(o));const n=Math.round(360/rate/dt);
  // finger down the whole time: drag per frame, then still (drag 0) for 1 s, then lift
  for(let i=0;i<n;i++){o.drag(rate*dt/C.ORBIT_FEEL.yawPerScreen,0,dt);o.step(dt);fr.push(frame(o))}const iStop=fr.length-1;
  for(let i=0;i<fps;i++){o.drag(0,0,dt);o.step(dt);fr.push(frame(o))}
  const m=measure(fr,dt,`follow ${rate}°/s`),st=settleAfter(fr,iStop,dt,-1);follow.push(Object.assign({case:`drag ${rate}°/s`,fps},{viewLagDeg:m.viewLagDeg},st,{cameraAngAccDegS2:m.cameraAngAccDegS2,peakLinAccMS2:m.peakLinAccMS2,minWallGapM:m.minWallGapM,minToHerM:m.minToHerM}))}
 {const o=new C.FreeOrbit('home'),fr=[];o.yaw=200;o.pitch=10;o.dist=L.distMax;fr.push(frame(o));let last=1;
  // fast back-and-forth: 150°/s, direction flips every 0.15 s, plus a pitch wobble; then still, then lift
  for(let t=0;t<2.4;t+=dt){const s=Math.floor(t/0.15)%2?-1:1;last=s;o.drag(s*150*dt/C.ORBIT_FEEL.yawPerScreen,Math.sin(t*9)*40*dt/C.ORBIT_FEEL.pitchPerScreen,dt);o.step(dt);fr.push(frame(o))}const iStop=fr.length-1;
  for(let i=0;i<fps;i++){o.drag(0,0,dt);o.step(dt);fr.push(frame(o))}
  const m=measure(fr,dt,'follow back-and-forth'),st=settleAfter(fr,iStop,dt,last>0?-1:1);follow.push(Object.assign({case:'back-and-forth 150°/s at yaw 200 (room-centre zone)',fps},{viewLagDeg:m.viewLagDeg},st,{cameraAngAccDegS2:m.cameraAngAccDegS2,peakLinAccMS2:m.peakLinAccMS2,minWallGapM:m.minWallGapM,minToHerM:m.minToHerM}))}
 {const o=new C.FreeOrbit('home'),fr=[];o.yaw=340;o.pitch=10;o.dist=L.distMax;fr.push(frame(o));let last=1;
  // fast back-and-forth: 150°/s, direction flips every 0.15 s, plus a pitch wobble; then still, then lift
  for(let t=0;t<2.4;t+=dt){const s=Math.floor(t/0.15)%2?-1:1;last=s;o.drag(s*150*dt/C.ORBIT_FEEL.yawPerScreen,Math.sin(t*9)*40*dt/C.ORBIT_FEEL.pitchPerScreen,dt);o.step(dt);fr.push(frame(o))}const iStop=fr.length-1;
  for(let i=0;i<fps;i++){o.drag(0,0,dt);o.step(dt);fr.push(frame(o))}
  const m=measure(fr,dt,'follow back-and-forth'),st=settleAfter(fr,iStop,dt,last>0?-1:1);follow.push(Object.assign({case:'back-and-forth 150°/s at yaw 340 (orbit zone)',fps},{viewLagDeg:m.viewLagDeg},st,{cameraAngAccDegS2:m.cameraAngAccDegS2,peakLinAccMS2:m.peakLinAccMS2,minWallGapM:m.minWallGapM,minToHerM:m.minToHerM}))}}
for(const f of follow){assert.ok(f.viewLagDeg<=LAG_MAX,f.case+' '+f.fps+' fps lag '+f.viewLagDeg);assert.ok(f.settleS!==null&&f.settleS<=SETTLE_S,f.case+' '+f.fps+' fps settle '+f.settleS);assert.ok(f.overshootDeg<=0.05,f.case+' '+f.fps+' fps overshoot '+f.overshootDeg)}
out.follow=follow;
// regression: the old box put the yaw-270 lens through the round wall (plain orbit, no room look)
const oldLimits=Object.assign({},L,{keepInside:{min:[-1.85,0.7,-4.72],max:[1.05,2.2,-1.55]},roomLook:undefined});
const o=new C.FreeOrbit('home');o.limits=oldLimits;o.yaw=270;o.pitch=10;o.dist=L.distMax;const old270=wallGap(o.solve(feet,[],seat[1]).position);
assert.ok(old270<LENS_MARGIN,'old box fails at yaw 270');out.old270WallGapM=+old270.toFixed(3);
console.log(JSON.stringify(out,null,1));
