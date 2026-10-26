'use strict';
// 运镜bot full2-cam E: basket in/out close-ups of the meadow→skycity balloon (BalloonTransit B1 / B5), modelled as the runtime:
// B1 lens = basketClosePose(spot beside door A, her feet) while she walks to the door, reaches, steps in; min-jerk onto
// plan.camera(0) over min(blendS, sitDown·.9) once she is in.  B5 lens = min-jerk from plan.camera(total) onto the close pose
// beside door B (blendS), tracking her through door B, the step down and the deck to S0.  Per screen (7):
//  K1 her height ≥25 % of the frame on the hold (B1: door → stepped in ; B5: blend done → door B → step down)
//  K2 yaw: standing ≤90°/s (p99 accel ≤200°/s²), walking ≤120°/s (≤300°/s²); B1 end == ride lens at 0 (≤1 mm)
//  K3 face/chest hidden (meadow / sky-city mesh + balloon mesh) longest run ≤0.5 s
//  K4 lens never inside a transition occluder box, ≥1.1 m from them
// C2 lakeside get-out (Grok Bot option B → close-up, RegionJourneyAdapter hold + BasketCloseShot.c2ClosePose), touchdown clock s:
//  stand-up 1.27 s, door reach (tail T0), walk_start_stepdown, exit walk at exitWalkMps; option-B lens = door wide held, board
//  blend from lakesideBoardBlendAtS. K1 her ≥25 % from the door (stand-up end + T0) to the step landing (C2_CLOSE.pullAtS);
//  K2 yaw caps (walking from the step-down), per-frame translation ≤ blendLensMS/60 + the option-B lens's own step; K3; K4;
//  K5 capsule (WeChat menu button model 87×32 at right 7, top status+4; status 47 if h ≥ 780 else 20) never covers her face;
//  K6 skycity→lakeside total (lake-leg touchdown + board takeover) ≤ 50 s; reported: end of pull-back vs the option-B wide.
const {createHarness}=require('../board-ui/harness.cjs'),RL=require('../journey-integration/route/route-legs.cjs');
const H=createHarness(),T=H.load('region/TransportLeg.ts'),TS=H.load('region/TransitionStaging.ts'),TM=H.load('region/TransitionStagingMath.ts'),
 BC=H.load('region/BasketCloseShot.ts'),AD=H.load('region/TransitionAnchorData.ts'),TC=H.load('region/TransitionCamera.ts');
const {J}=RL,{add,rotY}=J,DT=1/60,R2D=180/Math.PI,wrap=a=>((a%360)+540)%360-180,yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*R2D;
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(q*s.length))]||0;};
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};
const lerpPath=(pts,u)=>{const L=[];let tot=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][2]-pts[i-1][2]);L.push(d);tot+=d;}let s=Math.max(0,Math.min(1,u))*tot;
 for(let i=0;i<L.length;i++){if(s<=L[i]||i===L.length-1){const k=L[i]?Math.min(1,s/L[i]):1;return pts[i].map((v,j)=>v+(pts[i+1][j]-v)*k);}s-=L[i];}return pts[pts.length-1];};
const nrm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);},crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const dBox=(p,b)=>{const lo=b.slice(0,3),hi=b.slice(3,6);let s=0,inside=true;for(let i=0;i<3;i++){const d=Math.max(lo[i]-p[i],0,p[i]-hi[i]);if(d>0)inside=false;s+=d*d;}return inside?-1:Math.sqrt(s);};
(async()=>{const G=await RL.geometry(),B=TS.TRANSITION_STAGING.basket,K=TS.TRANSITION_STAGING.skycity,D3=TS.TRANSITION_DURATIONS.seg3,D4=TS.TRANSITION_DURATIONS.seg4,boxes=AD.transitionOccluderBoxes(),rows=[];
 const m6=add(rotY(180,[0.2,6.5,-25.6]),J.mOff),plan=T.balloonBeats(m6,[5.4,-0.11,43.8],J.sp('anchor_starcourt_center'),{walkInM:0,walkOutM:0,cityFrame:{yawDeg:J.yaw,origin:J.sOff}});
 const city=l=>add(rotY(J.yaw,l),J.sOff);
 for(const [w,h] of RL.SCREENS){const shots=[];
  {// B1
   const v=plan.vehicle(0),o=v.pos,y=v.yaw*R2D,W=l=>TM.basketToWorld(o,y,l),cam0=plan.camera(0,{w,h}),mBoxes=BC.meadowLensBoxesWorld(l=>add(rotY(180,l),J.mOff))/* full8: as runtime (meadow node) */,sp=BC.basketCloseSpot(W(B.doorOut),o,[...boxes,...mBoxes],undefined,[cam0]);
   const toDoor=[m6,W(B.outside),W(B.doorOut)],len=toDoor.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-toDoor[i][0],p[2]-toDoor[i][2]),0),walkS=Math.max(D3.toBasket*Math.min(1,len/6),len/TS.TRANSITION_STAGING.walkMps);
   const t1=walkS+D3.doorReach,inAt=t1+D3.intoBasket,bl=Math.min(BC.BASKET_CLOSE.blendS,D3.sitDown*.9),end=inAt+D3.sitDown;
   const feet=t=>t<walkS?lerpPath(toDoor,t/walkS):t<t1?W(B.doorOut):t<inAt?lerpPath([W(B.doorOut),W(B.threshold),W(B.p0)],(t-t1)/D3.intoBasket):W(B.p0);
   const bin=sp?BC.speedSafeS(cam0.position,sp.position,BC.b1InS(walkS)):BC.b1InS(walkS),cam=t=>{const c=TC.blendPose(cam0,BC.basketClosePose(sp.position,feet(t)),TC.minJerk(t/bin));return t<inAt?c:TC.blendPose(c,cam0,TC.minJerk((t-inAt)/bl));};
   shots.push({id:'B1 meadow in',sp,cam,feet,end,hold:[walkS,inAt],stepUntil:inAt/* full8: 77 ms step is HARD up to the step-in; the close→cam0 return (≤ sitDown·.9 so the flight starts on cam0) is reported (st77back) */,walk:t=>t<walkS||(t>=t1&&t<inAt),los:(a,b)=>RL.hit(G.meadow,a,b)||RL.balHit(o,y,v.roll,a,b),
    tail:()=>{const p=cam(end),q=cam0;return Math.max(...[0,1,2].map(i=>Math.abs(p.position[i]-q.position[i])));}});}
  {// B5
   const v=plan.vehicle(plan.total),o=v.pos,y=v.yaw*R2D,W=l=>TM.basketToWorld(o,y,l),camEnd=plan.camera(plan.total,{w,h}),sp=BC.basketCloseSpot(W(B.doorOutB),o,boxes,undefined,[camEnd]);
   const seat=W([0,0,0]),st=D4.standUp+D4.pause,t1=st+D4.doorReach,t2=t1+D4.stepDown+1,p2=[city(K.stepDown),city(K.deckEdge),city(K.s0New)],l2=Math.hypot(p2[1][0]-p2[0][0],p2[1][2]-p2[0][2])+Math.hypot(p2[2][0]-p2[1][0],p2[2][2]-p2[1][2]);
   const end=t2+Math.min(D4.toPath,Math.max(1.5,l2/TS.TRANSITION_STAGING.walkMps));
   const feet=t=>t<t1?seat:t<t2?lerpPath([seat,W(B.thresholdB),W(B.doorOutB),city(K.stepDown)],(t-t1)/(t2-t1)):lerpPath(p2,(t-t2)/(end-t2));
   const cam=t=>TC.blendPose(camEnd,BC.basketClosePose(sp.position,feet(t)),TC.minJerk(t/(sp?BC.speedSafeS(camEnd.position,sp.position,BC.BASKET_CLOSE.blendOutS):BC.BASKET_CLOSE.blendOutS)));
   shots.push({id:'B5 skycity out',sp,cam,feet,end,hold:[Math.max(st,sp?BC.speedSafeS(camEnd.position,sp.position,BC.BASKET_CLOSE.blendOutS):BC.BASKET_CLOSE.blendOutS),t2],walk:t=>t>=t1,los:(a,b)=>RL.hit(G.cityB,a,b)||RL.balHit(o,y,v.roll,a,b),tail:()=>0});}
  for(const S of shots){if(!S.sp){ok(false,`${S.id} ${w}x${h} no clear close-up spot`);continue;}
   {/* full8: lens step on a dropped 77 ms frame ≤ 0.875 m (≤ ~11 m/s) */let st77=0,stB=0;for(let t=0;t+.077<=S.end+1e-9;t+=DT){const a=S.cam(t).position,b=S.cam(t+.077).position,d=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);if(S.stepUntil===undefined||t+.077<=S.stepUntil)st77=Math.max(st77,d);else stB=Math.max(stB,d);}S.st77=+st77.toFixed(3);S.st77back=+stB.toFixed(3);ok(st77<=.875,`${S.id} ${w}x${h} 77 ms step ${st77.toFixed(3)} m > 0.875`);}
   let herMin=9,ys=[],prevY=null,prevV=null,maxW=0,maxS=0,accW=[],accS=[],run=0,runMax=0,clr=99,inBox=false;
   for(let t=0;t<=S.end+1e-9;t+=DT){const p=S.cam(t),f=S.feet(t),yy=yawOf(p);
    if(t>=S.hold[0]&&t<=S.hold[1])herMin=Math.min(herMin,BC.herHeightFrac(p,f));
    if(prevY!==null){const vv=wrap(yy-prevY)/DT,wk=S.walk(t);if(wk)maxW=Math.max(maxW,Math.abs(vv));else maxS=Math.max(maxS,Math.abs(vv));
     if(prevV!==null)(wk?accW:accS).push(Math.abs(vv-prevV)/DT);prevV=vv;}prevY=yy;
    const pts=RL.standPts(f),hid=S.los(p.position,pts.face)||S.los(p.position,pts.chest);run=hid?run+DT:0;runMax=Math.max(runMax,run);
    for(const b of boxes){const d=dBox(p.position,b);if(d<0)inBox=true;else clr=Math.min(clr,d);}}
   const r={id:S.id,scr:`${w}x${h}`,her:+(herMin*100).toFixed(1),yawS:+maxS.toFixed(1),p99S:+pct(accS,.99).toFixed(0),yawW:+maxW.toFixed(1),p99W:+pct(accW,.99).toFixed(0),hid:+runMax.toFixed(2),clr:+clr.toFixed(2),tail:+S.tail().toFixed(4),st77:S.st77,st77back:S.st77back};rows.push(r);
   ok(herMin>=.25,`${r.id} ${r.scr} her ${r.her}% <25`);ok(maxS<=90&&pct(accS,.99)<=200,`${r.id} ${r.scr} standing yaw ${r.yawS}°/s p99 ${r.p99S}`);
   ok(maxW<=120&&pct(accW,.99)<=300,`${r.id} ${r.scr} walking yaw ${r.yawW}°/s p99 ${r.p99W}`);ok(runMax<=.5,`${r.id} ${r.scr} hidden ${r.hid}s`);
   ok(!inBox&&clr>=1.1,`${r.id} ${r.scr} clearance ${r.clr}`);ok(r.tail<=.001,`${r.id} ${r.scr} B1 end ≠ ride lens (${r.tail} m)`);}}

 {// C2
  const LB=H.load('region/LakesideBalloon.ts'),LC=H.load('region/LakesideCameraLayout.ts'),BLy=H.load('ui/BoardLayout.ts'),Core=H.load('world-r1/RegionJourneyCore.ts'),TCAM=TC.TRANSITION_CAM;
  const S6=add(rotY(J.yaw,[0.2,0.032,-27.8]),J.sOff),L=LC.lakesideJourney(S6),shore=L.arrival[L.arrival.length-1],M=LB.lakesideBalloonMooring(shore,L.toWorld),SD=LB.LAKESIDE_STEPDOWN,K=BC.C2_CLOSE,c2=[];
  const lakeTD=+(process.env.QF_LAKE_TOUCHDOWN||34.48)/* lake-leg-c touchdownAt (same on all screens) */,standS=1.266667,sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  for(const [w,h] of RL.SCREENS){const fr=LC.lakesideScreenFrame(w,h,BLy.boardSafeInsets(w,h)),lan=LC.lakesideScreenLanding(L,fr,LC.LAKESIDE_CAMERA_LAYOUT.stopLocal);
   const E=Core.arrivalPose([shore,L.toWorld([...LC.LAKESIDE_CAMERA_LAYOUT.stopLocal])],L.focus,lan),land={position:E.position,target:E.target,fovVerticalDeg:lan.arrivalFovDeg};
   const wide=LB.lakesideDoorWideLens(M.walk,M.mooring,land,w/h,{...BLy.boardSafeInsets(w,h),h}),door=wide?wide.lens:LB.lakesideDoorLens(M.walk,M.mooring,w/h,undefined,undefined,{...BLy.boardSafeInsets(w,h),h});
   const KL=LB.LAKESIDE_BALLOON_LANDING,TS5=TS.skyMooring5a||TS.TRANSITION_STAGING.skyMooring5a,R=LB.lakesideBalloonRide([S6,...TS5.walkWorld.slice(1).map(p=>[...p])],L.toWorld([...KL.launchLocal]),M.mooring,land);
   const sp=BC.basketCloseSpot(M.start,M.mooring,boxes,undefined,[door]);if(!sp){ok(false,`C2 ${w}x${h} no spot`);continue;}
   const seat=[M.mooring[0],M.start[1],M.mooring[2]],P0=M.start,sy=Math.sin(M.startYawRad),cy=Math.cos(M.startYawRad),tDoor=standS+M.T0,tStep=standS+M.walkStartAt,tWalk=tStep+SD.durationS;
   const restPts=[[P0[0]+sy*SD.forwardEnd,P0[1],P0[2]+cy*SD.forwardEnd],...M.walk.slice(1)],mps=LB.LAKESIDE_BALLOON_LANDING.exitWalkMps,walkedAt=s=>s<tStep?0:s<tWalk?LB.stepdownRootAt(s-tStep)[0]:SD.forwardEnd+(s-tWalk)*mps;
   const feet=s=>s<0?(v=>[v[0],v[1]+.1,v[2]])(R.vehicle(R.T+s)):s<standS?seat.map((v,i)=>v+(P0[i]-v)*(s/standS)):s<tStep?P0:s<tWalk?(r=>[P0[0]+sy*r[0],P0[1]+r[1],P0[2]+cy*r[0]])(LB.stepdownRootAt(s-tStep)):lerpPath(restPts,Math.min(1,(s-tWalk)*mps/Math.max(1e-3,restPts.slice(1).reduce((a,p,i)=>a+Math.hypot(p[0]-restPts[i][0],p[2]-restPts[i][2]),0))));
   const blendAt=LB.lakesideBoardBlendAtS(),wk=walkedAt(blendAt),dur=LB.lakesideBoardBlendDurS(door,land,wk,LB.lakesideBoardEntryM(M.walk,land,w/h,wk),M.mps),end=blendAt+dur;
   const orig=s=>s<0?LB.lakesideDoorRideCamera(R,door,R.T+s,null):s<blendAt?door:LB.lakesideDoorBlendPose(door,land,Math.min(1,(s-blendAt)/dur),feet(s),LB.LAKESIDE_TOUCHDOWN.blendAimPull);
   const cam=s=>BC.c2ClosePose(s,orig(s),BC.basketClosePose(sp.position,feet(s)));
   const sb=h>=780?47:20,cap={x:w-7-87,y:sb+4,w:87,h:32};
   const scr=(p,q)=>{const f=nrm(sub3(p.target,p.position)),r=nrm(crs(f,[0,1,0])),u=crs(r,f),d=sub3(q,p.position),z=dot3(d,f),ty=Math.tan(p.fovVerticalDeg*Math.PI/360),tx=ty*w/h;return z<=0?null:[(1+dot3(d,r)/z/tx)*w/2,(1-dot3(d,u)/z/ty)*h/2];};
   let herMin=9,maxS=0,maxW=0,accS=[],accW=[],prevY=null,prevV=null,run=0,runMax=0,clr=99,inB=false,capGap=1e9,stepOver=0,prevP=null,prevO=null;
   for(let s=K.inAtS-.5;s<=end+1e-9;s+=DT){const p=cam(s),o=orig(s),f=feet(s),pts=RL.standPts(f),yy=yawOf(p),wk2=s>=tStep;
    if(s>=tDoor&&s<=K.pullAtS)herMin=Math.min(herMin,BC.herHeightFrac(p,f));
    if(prevY!==null){const vv=wrap(yy-prevY)/DT;if(wk2)maxW=Math.max(maxW,Math.abs(vv));else maxS=Math.max(maxS,Math.abs(vv));if(prevV!==null)(wk2?accW:accS).push(Math.abs(vv-prevV)/DT);prevV=vv;}prevY=yy;
    if(prevP){const st=Math.hypot(...sub3(p.position,prevP.position)),os=Math.hypot(...sub3(o.position,prevO.position));stepOver=Math.max(stepOver,st-(TCAM.blendLensMS*DT+os));}prevP=p;prevO=o;
    const los=q=>RL.hit(G.lake,p.position,q)||RL.balHit(s<0?R.vehicle(R.T+s):M.mooring,M.doorYawDeg,0,p.position,q);const hh=los(pts.face)||los(pts.chest);run=hh?run+DT:0;runMax=Math.max(runMax,run);
    for(const b of boxes){const d=dBox(p.position,b);if(d<0)inB=true;else clr=Math.min(clr,d);}
    const fp=scr(p,pts.face);if(fp){const dx=Math.max(cap.x-fp[0],0,fp[0]-(cap.x+cap.w)),dy=Math.max(cap.y-fp[1],0,fp[1]-(cap.y+cap.h));capGap=Math.min(capGap,Math.hypot(dx,dy));}}
   const pe=cam(K.pullAtS+K.pullS),dv=(a,b)=>{const A=nrm(sub3(a.target,a.position)),B=nrm(sub3(b.target,b.position));return Math.acos(Math.max(-1,Math.min(1,dot3(A,B))))*180/Math.PI;};
   const r={scr:`${w}x${h}`,herDoorPct:+(herMin*100).toFixed(1),herWidePct:+(BC.herHeightFrac(door,P0)*100).toFixed(1),yawS:+maxS.toFixed(1),p99S:+pct(accS,.99).toFixed(0),yawW:+maxW.toFixed(1),p99W:+pct(accW,.99).toFixed(0),
    stepOverCapM:+Math.max(0,stepOver).toFixed(4),hid:+runMax.toFixed(2),clr:+clr.toFixed(2),capsuleGapPx:+capGap.toFixed(0),segS:+(lakeTD+end).toFixed(2),
    endVsWideM:+Math.hypot(...sub3(pe.position,door.position)).toFixed(2),endVsWideDeg:+dv(pe,door).toFixed(1),endVsOptionBPathM:+Math.hypot(...sub3(pe.position,orig(K.pullAtS+K.pullS).position)).toFixed(3)};c2.push(r);
   ok(herMin>=.25,`C2 ${r.scr} her ${r.herDoorPct}% <25`);ok(maxS<=90&&pct(accS,.99)<=200,`C2 ${r.scr} standing yaw ${r.yawS} p99 ${r.p99S}`);ok(maxW<=120&&pct(accW,.99)<=300,`C2 ${r.scr} walking yaw ${r.yawW} p99 ${r.p99W}`);
   ok(stepOver<=1e-3,`C2 ${r.scr} translation over cap ${r.stepOverCapM}`);ok(runMax<=.5,`C2 ${r.scr} hidden ${r.hid}`);ok(!inB&&clr>=1.1,`C2 ${r.scr} clearance ${r.clr}`);ok(capGap>0,`C2 ${r.scr} capsule covers her face`);ok(lakeTD+end<=50,`C2 ${r.scr} segment ${r.segS}s >50`);}
  console.table(c2);}
 {// K7 wiring: every BasketCloseShot / occluder name the runtime files use is imported (the harness does not type-check; a
  // missing import is a ReferenceError on device — 1bea977a/08e7ed77 shipped two, fixed in the C2 commit)
  const fs=require('fs'),src=f=>fs.readFileSync(require('path').join(__dirname,'../../creator-build-project/assets/scripts/region',f),'utf8');
  for(const [f,names] of [['RegionJourneyAdapter.ts',['basketCloseSpot','basketClosePose','boardFeetAt','c2ClosePose','C2_CLOSE','SKYCITY_LENS_OCCLUDERS','transitionOccluderBoxes']],['BalloonTransit.ts',['basketCloseSpot','basketClosePose','b1InS','BASKET_CLOSE','transitionOccluderBoxes']]]){
   const t=src(f),imp=[...t.matchAll(/^import\s*\{([^}]*)\}/gm)].flatMap(m=>m[1].split(',').map(x=>x.trim().replace(/^type\s+/,'')));
   for(const n of names)ok(!new RegExp('\\b'+n+'\\b').test(t)||imp.includes(n),`K7 ${f} uses ${n} without importing it`);}}
 console.table(rows);console.log(fail?`basket-close FAIL (${fail})`:'basket-close PASS');process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
