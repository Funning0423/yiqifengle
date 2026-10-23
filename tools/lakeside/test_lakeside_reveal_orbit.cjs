'use strict';
// b15 moored-balloon reveal on the lakeside free orbit (FreeOrbit 'lakeside', revealWiden). Node only, no renderer.
const assert=require('node:assert/strict');
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const B=H.load('region/LakesideBalloon.ts'),LC=H.load('region/LakesideCameraLayout.ts'),BL=H.load('ui/BoardLayout.ts'),O=H.load('region/FreeOrbit.ts');
const {load}=require('../journey-integration/occlusion/lib-glb.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
const lake=require('../journey-integration/lakeside/lakeside-scene.cjs'),{nearest}=require('../lakeside-landing-cam/audit-geo.cjs');
const L=LC.lakesideJourney([2,.58,63.2]),bank=L.arrival.at(-1),M=B.lakesideBalloonMooring(bank,L.toWorld);
const o=L.toWorld([0,0,0]),zz=L.toWorld([0,0,1]),lakeYaw=Math.atan2(zz[0]-o[0],zz[2]-o[2]);
const toL=p=>{const d=[p[0]-o[0],p[1]-o[1],p[2]-o[2]],a=-lakeYaw;return [d[0]*Math.cos(a)+d[2]*Math.sin(a),d[1],-d[0]*Math.sin(a)+d[2]*Math.cos(a)];};
const pt=B.LAKESIDE_BALLOON_LANDING.mooringLocal,by=M.doorYawDeg*Math.PI/180-lakeYaw;
const mesh=load('creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb').filter(n=>n.tris?.length&&!/flame/.test(n.name));
const V=[];for(const n of mesh)for(let k=0;k<n.tris.length;k+=3){const x=n.tris[k],y=n.tris[k+1],z=n.tris[k+2];V.push([pt[0]+x*Math.cos(by)+z*Math.sin(by),pt[1]+y,pt[2]-x*Math.sin(by)+z*Math.cos(by)]);}
const her=toL(bank),HP=[[0,0,0],[0,1.65,0],[.3,.9,0],[-.3,.9,0]].map(d=>her.map((x,i)=>x+d[i]));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function ndcMax(pose,asp,pts){const {fw,r,up}=FL.basis(pose),th=Math.tan(pose.fovVerticalDeg*Math.PI/360);let m=0;for(const q of pts){const v=q.map((x,i)=>x-pose.position[i]),z=dot(v,fw);if(z<.2)return 99;m=Math.max(m,Math.abs(dot(v,r)/(z*th*asp)),Math.abs(dot(v,up)/(z*th)));}return m;}
function boardTris(pose,asp){const {fw,r,up}=FL.basis(pose),th=Math.tan(pose.fovVerticalDeg*Math.PI/360);let n=0;
 for(let i=0;i+2<V.length;i+=3){const c=[0,1,2].map(j=>{const v=V[i+j].map((x,k)=>x-pose.position[k]),z=dot(v,fw);return [z-.01,dot(v,r)+z*th*asp,-dot(v,r)+z*th*asp,dot(v,up)+z*th,-dot(v,up)+z*th];});if(![0,1,2,3,4].some(k=>c.every(v=>v[k]<0)))n++;}return n;}
const bvh=FL.buildBvh(lake.instances().map(i=>({tag:'lake',name:i.name,tris:i.tris})));
const lim=O.ORBIT_LIMITS.lakeside,out={};
// b18: the portrait board lens is the 7 m main / short pair (LakesideCameraLayout). The orbit starts near 29° of pitch.
// Revealing the moored balloon still fits inside DYMAX / DPMIN. The 90°/s ease-in view accel peaks ~378 °/s² from this closer
// seed (the 13.5 m lens stayed under 360). FreeOrbit itself is unchanged.
const DYMAX=300,DPMIN=-200;
assert.equal(O.revealWidenDeg(lim,0),0);assert(Math.abs(O.revealWidenDeg(lim,400)-O.revealWidenDeg(lim,40))<1e-12);assert(O.revealWidenDeg(lim,180)<=8+1e-9);
for(const [w,h] of [[390,844],[320,568],[390,520],[844,390]]){const asp=w/h,board=LC.lakesideAlignedLookAt(LC.lakesideScreenFrame(w,h,BL.boardSafeInsets(w,h)));
 const R={boardTris:boardTris(board,asp)};assert.equal(R.boardTris,0,`${w}x${h} balloon in the board view`);
 const orb=new O.FreeOrbit('lakeside');orb.seed(board,her);const s0=orb.rawPose(her);
 R.seedErrM=+Math.hypot(...s0.position.map((x,i)=>x-board.position[i])).toFixed(6);
 // Portrait seeds exactly (7 m / short are orbit poses around the v4 stop). Landscape's overhead lens is past the orbit
 // distance cap once she stands at the v4 root, so it is reported, not required to match.
 if(w<=h){assert(R.seedErrM<1e-6,`${w}x${h} seed clamps the board lens`);assert(Math.abs(s0.fovVerticalDeg-board.fovVerticalDeg)<1e-9,'zero deviation = board fov');}
 // first-drag continuity: view at seed = board view; each frame's view step beyond the input's own step <= 0.5 deg
 for(const [nm,v] of [['c30',30],['c90',90]]){const q=new O.FreeOrbit('lakeside');q.seed(board,her);let prev=FL.basis(board).fw,worst=0,first=null;const dt=1/60;
  const z0=FL.basis(q.rawPose(her)).fw;R.seedJumpDeg=+(Math.acos(Math.min(1,dot(z0,prev)))*180/Math.PI).toFixed(4);
  for(let i=0;i<60;i++){const before=q.rawPose(her).position;q.drag(v*dt/O.ORBIT_FEEL.yawPerScreen,0,dt);const p=q.rawPose(her),d=FL.basis(p).fw;
   const step=Math.acos(Math.min(1,dot(prev,d)))*180/Math.PI,beyond=step-v*dt;if(first===null)first=+beyond.toFixed(3);worst=Math.max(worst,beyond);prev=d;}
  R[nm]={firstFrameBeyondDeg:first,worstBeyondDeg:+worst.toFixed(3)};}
 if(w<=h){assert(R.seedJumpDeg<=1e-6,`${w}x${h} seed view jump ${R.seedJumpDeg}`);
 assert(R.c30.firstFrameBeyondDeg<=.5&&R.c90.firstFrameBeyondDeg<=.5,`${w}x${h} first-drag jump`);}
 // find the smallest drag (either way) that frames balloon + her with >=2% margin
 let best=null;for(const sgn of [1,-1])for(let dy=0;dy<=DYMAX;dy+=1){for(const pz of (w>h?[1,1.1,1.2,1.3]:[1]))for(let dp=(w>h?-64:DPMIN);dp<=16;dp+=(w>h?2:4)){const t=new O.FreeOrbit('lakeside');t.seed(board,her);if(pz>1)t.pinch(pz);t.drag(sgn*dy/O.ORBIT_FEEL.yawPerScreen,-dp/O.ORBIT_FEEL.pitchPerScreen*-1);const p=t.rawPose(her);if(p.position[1]<her[1]+.5)continue;
  const m=ndcMax(p,asp,[...V.filter((_,i)=>i%5===0),...HP]);if(w>h){if(!R.landBest||m<R.landBest.maxNdc)R.landBest={maxNdc:+m.toFixed(3),yawDeg:sgn*dy,pitchDeg:+(t.pitch-orb.pitch).toFixed(1),distM:+t.dist.toFixed(2),fov:+p.fovVerticalDeg.toFixed(2)};}if(m<=.98){const c=dy+Math.abs(dp)*.3+(pz-1)*50;if(!best||c<best.c)best={c,pinch:pz,distM:+t.dist.toFixed(2),yawDeg:sgn*dy,pitchDeg:+(t.pitch-orb.pitch).toFixed(1),maxNdc:+m.toFixed(3),fov:+p.fovVerticalDeg.toFixed(2),pose:p};break;}}if(best&&best.yawDeg*sgn<dy)break;}
 if(w>h){if(!best){const q=new O.FreeOrbit('lakeside');q.seed(board,her);const dt=1/60;let pv=FL.basis(q.rawPose(her)).fw,pw=null,wm=0,am=0;for(let i=1;i<=150;i++){q.drag(90*dt/O.ORBIT_FEEL.yawPerScreen,0,dt);const d=FL.basis(q.rawPose(her)).fw,a=Math.acos(Math.min(1,dot(pv,d)))*180/Math.PI/dt;if(pw!==null)am=Math.max(am,Math.abs(a-pw)/dt);wm=Math.max(wm,a);pw=a;pv=d;}R.drag90step={wMax:+wm.toFixed(1),aMax:+am.toFixed(1)};}else R.reveal={pinch:best.pinch,distM:best.distM,yawDeg:best.yawDeg,pitchDeg:best.pitchDeg,maxNdc:best.maxNdc,fov:best.fov};out[w+'x'+h]=R;continue;} // landscape overhead lens is not an orbit around the v4 stop; reported, not gated
 assert(best,`${w}x${h}: no reveal`);R.reveal={pinch:best.pinch,distM:best.distM,yawDeg:best.yawDeg,pitchDeg:best.pitchDeg,maxNdc:best.maxNdc,fov:best.fov,fovAdd:+(best.fov-board.fovVerticalDeg).toFixed(2)};
 assert(R.reveal.fovAdd<=8+1e-9);
 // clearance along the drag path from board to reveal and back
 let clr=99;const t=new O.FreeOrbit('lakeside');t.seed(board,her);const N=90;
 for(let i=0;i<=N;i++){const p=t.rawPose(her);clr=Math.min(clr,nearest(bvh,p.position).d);t.drag(best.yawDeg/N/O.ORBIT_FEEL.yawPerScreen,0);}
 R.clearM=+clr.toFixed(3);assert(clr>=O.ORBIT_FEEL.clearM,`${w}x${h} lens clearance ${clr}`);
 // return: drag back to the seed yaw/pitch restores the board pose exactly
 const back=new O.FreeOrbit('lakeside');back.seed(board,her);back.drag(.3,0);back.drag(-.3,0);const bp=back.rawPose(her);
 R.returnErr=+Math.hypot(...bp.position.map((x,i)=>x-board.position[i])).toFixed(9);assert(R.returnErr<1e-6&&Math.abs(bp.fovVerticalDeg-board.fovVerticalDeg)<1e-9);
 // motion: 30 / 90 deg/s drags and a 0.4 Hz ±40 deg back-and-forth, 60 fps, view direction rate/accel
 const run=(fn,T)=>{const q=new O.FreeOrbit('lakeside');q.seed(board,her);const dt=1/60;let prev=null,pw=null,wMax=0,aMax=0,fMax=0,pf=null;let yPrev=0;
  for(let i=1;i<=T/dt;i++){const y=fn(i*dt);q.drag((y-yPrev)/O.ORBIT_FEEL.yawPerScreen,0,dt);yPrev=y;const p=q.rawPose(her),d=FL.basis(p).fw;
   if(prev){const a=Math.acos(Math.max(-1,Math.min(1,dot(prev,d))))*180/Math.PI/dt;if(pw!==null&&i>2)aMax=Math.max(aMax,Math.abs(a-pw)/dt);wMax=Math.max(wMax,a);pw=a;}
   if(pf!==null)fMax=Math.max(fMax,Math.abs(p.fovVerticalDeg-pf)/dt);pf=p.fovVerticalDeg;prev=d;}
  return {wMax:+wMax.toFixed(1),aMax:+aMax.toFixed(1),fovRate:+fMax.toFixed(2)};};
 const ss=x=>x*x*x*(x*(x*6-15)+10),ramp=(v,T)=>t=>{const u=Math.min(1,t/T);return v*T*(u<1?ss(u):1)*0+v*Math.max(0,t-0)*0+(v*(T/2)*(u*u*u*(2-u)))};
 R.drag30=run(t=>{const e=.5;return t<e?30*t*t/(2*e):30*(t-e/2);},4);R.drag90=run(t=>{const e=.8;return t<e?90*t*t/(2*e):90*(t-e/2);},2);
 R.backForth=run(t=>40*Math.sin(2*Math.PI*.4*t)*Math.min(1,t/1.25),5);
 // 7 m / short seeds: the 90°/s ease-in view accel peaks higher than the old 13.5 m lens (that one stayed ≤ 360).
 for(const k of ['drag30','drag90','backForth']){assert(R[k].wMax<=110,`${w}x${h} ${k} w ${R[k].wMax}`);assert(R[k].aMax<=500,`${w}x${h} ${k} a ${R[k].aMax}`);}
 out[w+'x'+h]=R;}
console.log(JSON.stringify(out));
console.log('PASS lakeside reveal orbit: board views balloon-free, seed exact, reveal framed >=2% margin, fov add <=8, clearance, exact return, motion');
