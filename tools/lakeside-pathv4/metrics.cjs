'use strict';
// b18 path v4 + foot-lock + 6 m lens metrics (offline, pure TS modules + committed lakeside GLBs). Prints JSON; exits 1 on a FAIL.
const Jn=require('../journey-integration/journey-scene.cjs'),LKS=require('../journey-integration/lakeside/lakeside-scene.cjs'),{groundAt}=require('./terrain.cjs');
const {H,S,rotY,add,sub,yaw,sOff}=Jn,LC=H.load(S+'region/LakesideCameraLayout.ts'),LB=H.load(S+'region/LakesideBalloon.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts'),BL=H.load(S+'ui/BoardLayout.ts');
const S6=add(rotY(yaw,[0.2,0.032,-27.8]),sOff),LJ=LC.lakesideJourney(S6),toL=p=>rotY(-LJ.yawDeg,sub(p,LJ.root)),out={},fail=[];
const chk=(k,ok)=>{if(!ok)fail.push(k);};
// 1 path
const shore=LJ.arrival[LJ.arrival.length-1],M=LB.lakesideBalloonMooring(shore,LJ.toWorld);
const W=M.walk.map(toL),end=W[W.length-1];
out.path={stepMismatchMm:+(M.stepMismatchM*1000).toFixed(2),lengthM:+M.length.toFixed(4),points:W.length,endLocal:end.map(v=>+v.toFixed(4)),
 endYawDeg:+(Math.atan2(W[W.length-1][0]-W[W.length-2][0],W[W.length-1][2]-W[W.length-2][2])*180/Math.PI).toFixed(2),walkS:+M.walkS.toFixed(3),minZ:+Math.min(...W.map(p=>p[2])).toFixed(3)};
chk('stepMismatch',M.stepMismatchM<.01);chk('end',Math.hypot(end[0]-3.2531,end[2]-25.0904)<.002);
// 2 terrain: walk y vs ray (lake-local), densely along the walk (skip P0 on the board)
let pen=0,hov=0;const R=Core.routeLength?null:null;
for(let i=2;i<W.length;i++){const a=W[i-1],b=W[i];for(let k=0;k<=8;k++){const u=k/8,x=a[0]+(b[0]-a[0])*u,z=a[2]+(b[2]-a[2])*u,y=a[1]+(b[1]-a[1])*u,g=groundAt(x,z);pen=Math.max(pen,g-y);hov=Math.max(hov,y-g);}}
// step-down branch (adapter formula) vs ground
const P0=M.start,P0L=toL(P0),SD=LB.LAKESIDE_STEPDOWN,hd=-84*Math.PI/180;let spen=0,spenOld=0;
for(let t=0;t<=SD.durationS+1e-9;t+=1/60){const r=LB.stepdownRootAt(t),drop=Math.max(0,Math.min(1,r[1]/-.03)),yB=P0[1]+r[1],yG=M.groundYAt(r[0]),y=yB+(yG-(P0[1]-.03))*drop;
 const x=P0L[0]+Math.sin(hd)*r[0],z=P0L[2]+Math.cos(hd)*r[0];if(drop>=1){const g=groundAt(x,z)+LJ.root[1],dip=Math.min(0,r[1]+.03)/* the clip's own landing dip below the step (−6 mm), authored */;spen=Math.max(spen,g+dip-y);spenOld=Math.max(spenOld,g+dip-yB);}}
out.terrain={walkPenetrationMm:+(pen*1000).toFixed(2),walkHoverMm:+(hov*1000).toFixed(2),stepdownPenetrationMm:+(spen*1000).toFixed(2),stepdownPenetrationOldMm:+(spenOld*1000).toFixed(2)};
chk('terrainPen',pen<=.002&&spen<=.002);
// 3 foot-lock replay: 0.8 m/s along the walk, yaw = damped heading (look-ahead 0.3 m), contacts alternating every `step` s
function replay(step,mode){const Wl=M.walk,L=M.length,dt=1/60,v=.8;let lock=[0,0],yOld=null,foot='L',lastEmit=0,mt=0,maxL=0,drift=0,st=null;
 for(let t=0;t*v<=L-SD.forwardEnd;t+=dt){mt+=dt;const s=SD.forwardEnd+t*v,a=Jn.sampleRoute(Wl,Math.max(0,s-.3)),b=Jn.sampleRoute(Wl,Math.min(L,s+.3)),y=Math.atan2(b[0]-a[0],b[2]-a[2]);
  if(mt-lastEmit>=step){lastEmit=mt;foot=foot==='L'?'R':'L';st=null;}
  const sw=LB.footLockSwing(mt,lastEmit),yo=yOld===null?y:yOld;
  if(mode==='old'){lock=LB.footLockStep(lock,foot,yo,y,dt);/* old 5-arg: exp relax when steady, lastFoot never null */}
  else lock=LB.footLockStep(lock,foot,yo,y,dt,sw);
  yOld=y;const lx=foot==='L'?LB.FOOT_LOCK_HALF_W:-LB.FOOT_LOCK_HALF_W,sole=[lock[0]+lx*Math.cos(y),lock[1]-lx*Math.sin(y)];
  if(!st)st=sole;drift=Math.max(drift,Math.hypot(sole[0]-st[0],sole[1]-st[1]));maxL=Math.max(maxL,Math.hypot(lock[0],lock[1]));}
 return {maxOffsetMm:+(maxL*1000).toFixed(1),endOffsetMm:+(Math.hypot(lock[0],lock[1])*1000).toFixed(2),maxStanceSoleDriftMm:+(drift*1000).toFixed(1)};}
// old algorithm = exp relax whenever yaw steady (emulated: swing flag forced off and relax applied)
function replayOld(step){const Wl=M.walk,L=M.length,dt=1/60,v=.8;let lock=[0,0],yOld=null,foot='L',lastEmit=0,mt=0,maxL=0,drift=0,st=null;
 for(let t=0;t*v<=L-SD.forwardEnd;t+=dt){mt+=dt;const s=SD.forwardEnd+t*v,a=Jn.sampleRoute(Wl,Math.max(0,s-.3)),b=Jn.sampleRoute(Wl,Math.min(L,s+.3)),y=Math.atan2(b[0]-a[0],b[2]-a[2]);
  if(mt-lastEmit>=step){lastEmit=mt;foot=foot==='L'?'R':'L';st=null;}const yo=yOld===null?y:yOld;let x=lock[0],z=lock[1];
  if(Math.abs(y-yo)>1e-6){const lx=foot==='L'?.09:-.09;x+=lx*(Math.cos(yo)-Math.cos(y));z+=-lx*Math.sin(yo)+lx*Math.sin(y);}else{const k=Math.exp(-dt/.35);x*=k;z*=k;}lock=[x,z];yOld=y;
  const lx=foot==='L'?.09:-.09,sole=[lock[0]+lx*Math.cos(y),lock[1]-lx*Math.sin(y)];if(!st)st=sole;drift=Math.max(drift,Math.hypot(sole[0]-st[0],sole[1]-st[1]));maxL=Math.max(maxL,Math.hypot(lock[0],lock[1]));}
 return {maxOffsetMm:+(maxL*1000).toFixed(1),endOffsetMm:+(Math.hypot(lock[0],lock[1])*1000).toFixed(2),maxStanceSoleDriftMm:+(drift*1000).toFixed(1)};}
out.footLock={};for(const st of [.4,.5,.6])out.footLock['step'+st]={new:replay(st,'new'),old:replayOld(st)};
for(const k in out.footLock)chk('footLockEnd '+k,out.footLock[k].new.endOffsetMm<=2);
// 4 cameras on the 7 portrait screens
const screens=[[390,844],[360,780],[414,896],[320,568],[390,520],[375,667],[430,932]];
const inst=LKS.instances().filter(i=>!/cloud/i.test(i.glb));
const unit=(a,b)=>{const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(...d);return d.map(x=>x/l);};
function clearance(p){let m=1e9;for(const I of inst){const b=I.box;const dx=Math.max(b[0][0]-p[0],0,p[0]-b[1][0]),dy=Math.max(b[0][1]-p[1],0,p[1]-b[1][1]),dz=Math.max(b[0][2]-p[2],0,p[2]-b[1][2]);if(Math.hypot(dx,dy,dz)>m)continue;const t=I.tris;for(let k=0;k<t.length;k+=9){const q=Jn.ptTri?null:null;for(let j=0;j<9;j+=3){const d=Math.hypot(t[k+j]-p[0],t[k+j+1]-p[1],t[k+j+2]-p[2]);if(d<m)m=d;}}}return m;}
function segHit(a,b){const d=sub(b,a),L=Math.hypot(...d);let hit=null;for(const I of inst){if(/terrain|water|lake/i.test(I.glb)&&false)continue;const t=I.tris;for(let k=0;k<t.length;k+=9){const v0=[t[k],t[k+1],t[k+2]],e1=[t[k+3]-v0[0],t[k+4]-v0[1],t[k+5]-v0[2]],e2=[t[k+6]-v0[0],t[k+7]-v0[1],t[k+8]-v0[2]];
  const pv=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*pv[0]+e1[1]*pv[1]+e1[2]*pv[2];if(Math.abs(det)<1e-12)continue;const iv=1/det,tv=sub(a,v0),u=(tv[0]*pv[0]+tv[1]*pv[1]+tv[2]*pv[2])*iv;if(u<0||u>1)continue;
  const qv=[tv[1]*e1[2]-tv[2]*e1[1],tv[2]*e1[0]-tv[0]*e1[2],tv[0]*e1[1]-tv[1]*e1[0]],w=(d[0]*qv[0]+d[1]*qv[1]+d[2]*qv[2])*iv;if(w<0||u+w>1)continue;const s=(e2[0]*qv[0]+e2[1]*qv[1]+e2[2]*qv[2])*iv;if(s>1e-4&&s<1-1e-3){hit=I.name;return hit;}}}return hit;}
out.cameras=[];const endL=LC.LAKESIDE_CAMERA_LAYOUT.stopLocal,face=-58*Math.PI/180,fw=[Math.sin(face),Math.cos(face)];
for(const [w,h] of screens){const frame=LC.lakesideScreenFrame(w,h,BL.boardSafeInsets?BL.boardSafeInsets(w,h):{top:0,bottom:0,left:0,right:0,capsule:null}),lan=LC.lakesideScreenLanding({landing:LC.LAKESIDE_CAMERA_LAYOUT.landing},frame,endL);
 const stopW=LJ.toWorld(endL),E=Core.arrivalPose([shore,stopW],LJ.focus,lan),B=LC.lakesideAlignedLookAt(frame),Bw={position:LJ.toWorld(B.position),target:LJ.toWorld(B.target)};
 const d0=unit(E.position,E.target),d1=unit(Bw.position,Bw.target),ang=Math.acos(Math.min(1,d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2]))*180/Math.PI,dp=Math.hypot(...sub(E.position,Bw.position));
 const P=B.position,f=unit(P,B.target),rl=Math.hypot(f[0],f[2]),r=[-f[2]/rl,0,f[0]/rl],up=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],th=Math.tan(B.fovVerticalDeg*Math.PI/360),asp=w/h;
 const proj=q=>{const v=sub(q,P),z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2];return [(1+(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*asp))*w/2,(1-(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th))*h/2];};
 const pts=[];for(const y of [0,.9,1.15,1.5,1.65])for(const dx of [-.2,.2])pts.push(proj([endL[0]+r[0]*dx,endL[1]+y,endL[2]+r[2]*dx]));
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),box=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)].map(v=>Math.round(v));
 const camSide=Math.sign(fw[0]*(P[2]-endL[2])-fw[1]*(P[0]-endL[0]))/* + = camera on her right (facing fw, y up, lake-local) */;
 const occ={};for(const [k,y] of [['head',1.5],['chest',1.15],['face',1.42]])occ[k]=segHit(P,[endL[0],endL[1]+y,endL[2]]);
 const lens=h/w>=2?'main6m':'short';const cl=clearance(P);const tray=BL.boardLayout(w,h,BL.boardSafeInsets?BL.boardSafeInsets(w,h):{top:0,bottom:0,left:0,right:0,capsule:null},2).tray;
 out.cameras.push({screen:w+'x'+h,lens,position:P,target:B.target,fov:B.fovVerticalDeg,swapViewDeg:+ang.toFixed(4),swapPosCm:+(dp*100).toFixed(3),clearanceM:+cl.toFixed(2),herBoxPx:box,herWidthFrac:+((box[2]-box[0])/w).toFixed(3),inFrame:box[0]>=0&&box[2]<=w&&box[1]>=0&&box[3]<=h,trayBottomPx:Math.round(tray.y+tray.height/2),camOnHerRight:camSide>0,occluders:occ});
 chk('swap '+w+'x'+h,ang<=.1&&dp<=.01);chk('clear '+w+'x'+h,cl>=1.1);chk('occ '+w+'x'+h,!occ.head&&!occ.chest&&!occ.face);chk('width '+w+'x'+h,(box[2]-box[0])/w<=.8);}
// 5 door lens → board blend smoothness (390x844), 60 fps, old (walk/time min progress + sin pull) vs new (time + smoothstep pull)
{const frame=LC.lakesideScreenFrame(390,844,BL.boardSafeInsets(390,844)),lan=LC.lakesideScreenLanding({landing:LC.LAKESIDE_CAMERA_LAYOUT.landing},frame,endL),E=Core.arrivalPose([shore,LJ.toWorld(endL)],LJ.focus,lan),land={position:E.position,target:E.target,fovVerticalDeg:lan.arrivalFovDeg};
 const door=LB.lakesideDoorLens(M.walk,M.mooring,390/844),bS=LB.lakesideDoorBlendS(door,land),entry=LB.lakesideBoardEntryM(M.walk,land,390/844,LB.LAKESIDE_DOOR_HOLD.outM),v=M.length/M.walkS,dur=LB.lakesideDoorBlendDurS(bS,LB.LAKESIDE_DOOR_HOLD.outM,entry,v);
 const run=(uAt)=>{const dt=1/60,P=[],D=[];for(let t=0;t<=dur+.5;t+=dt){const u=uAt(t),s=Math.min(M.length,LB.LAKESIDE_DOOR_HOLD.outM+v*t),g=Jn.sampleRoute(M.walk,s),p=LB.lakesideDoorBlendPose(door,land,u,g);P.push(p.position);D.push(unit(p.position,p.target));}
  let a=0,aa=0,v0=0;for(let i=2;i<P.length;i++){const acc=Math.hypot(...[0,1,2].map(k=>P[i][k]-2*P[i-1][k]+P[i-2][k]))*3600;a=Math.max(a,acc);
   const w1=Math.acos(Math.min(1,D[i].reduce((s,x,k)=>s+x*D[i-1][k],0))),w0=Math.acos(Math.min(1,D[i-1].reduce((s,x,k)=>s+x*D[i-2][k],0)));aa=Math.max(aa,Math.abs(w1-w0)*3600*180/Math.PI);}
  const w01=Math.acos(Math.min(1,D[1].reduce((s,x,k)=>s+x*D[0][k],0)))*60*180/Math.PI;return {maxAccMs2:+a.toFixed(3),maxAngAccDegS2:+aa.toFixed(1),startAngVelDegS:+w01.toFixed(3),endPose:P[P.length-1]};};
 out.blend={durS:+dur.toFixed(3),specS:+bS.toFixed(3),entryM:+entry.toFixed(3),new:run(t=>Math.min(1,t/dur))};
 {// old (35129170): u = max(u, min(walk progress, t/specS)), aim pull = sin(pi u) on the raw u
  const saved=LB.lakesideDoorBlendPose;const smooth=x=>x*x*x*(x*(x*6-15)+10);
  const oldPose=(a,b,u,her)=>{const x=Math.max(0,Math.min(1,u)),e=smooth(x),p={position:a.position.map((v,i)=>v+(b.position[i]-v)*e)};const d0=unit(a.position,a.target),d1=unit(b.position,b.target);const dd=d0.map((v,i)=>v+(d1[i]-v)*e),l=Math.hypot(...dd);let d=dd.map(v=>v/l);
   if(x>0&&x<1){const k=.8*Math.sin(Math.PI*x),hh=unit(p.position,[her[0],her[1]+1,her[2]]);d=d.map((v,i)=>v+(hh[i]-v)*k);const m=Math.hypot(...d);d=d.map(v=>v/m);}return {position:p.position,target:p.position.map((v,i)=>v+d[i]*8)};};
  LB.lakesideDoorBlendPose=oldPose;let uo=0;out.blend.old=run(t=>{const s=LB.LAKESIDE_DOOR_HOLD.outM+v*t;uo=Math.max(uo,Math.min(1,(s-LB.LAKESIDE_DOOR_HOLD.outM)/(entry-LB.LAKESIDE_DOOR_HOLD.outM),t/bS));return uo;});LB.lakesideDoorBlendPose=saved;delete out.blend.old.endPose;}
 const nw=out.blend.new;delete nw.endPose;chk('blendStart',nw.startAngVelDegS<1);}
out.fail=fail;console.log(JSON.stringify(out,null,1));process.exit(fail.length?1:0);
