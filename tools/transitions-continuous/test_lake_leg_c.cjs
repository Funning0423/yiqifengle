'use strict';
// 运镜bot full2-cam task 4: the GAME's lake ride at mooring C (RegionJourneyAdapter atC wiring), modelled exactly as the adapter:
// R = lakesideBalloonRide([S6, ...skyMooring5a.walkWorld], T-03 launch, lakeside mooring, landing) ; SkyLakeContinuous with
// liftTraj = TransitionAnchorData.SKY_5A_LIFT_KEYS and walkCam = SkyWalkShot (T-02 finale → walk) ; basket at sl.basket(tau),
// yaw lakeBasketYaw(mooring −68.19 → landing doorYawDeg). Per screen (7):
//  W1 basket moored on C (≤1 mm) at yaw = mooring yaw; touchdown at the lakeside mooring, yaw = moored.doorYawDeg (door2 local 96.189)
//  W2 lens caps: walk ≤120°/s (p99 ≤300°/s²), board/lift/flight ≤90°/s (p99 ≤200°/s²); step ≤0.6 m/frame; no jump at touchdown hand-over
//  W3 face/chest hidden (lake + sky + balloon mesh, her seated/standing) longest run ≤0.5 s, walk → touchdown
//  W4 lens never inside an occluder box; ≥1.1 m from them on the scripted walk/board; runtime data file in sync with the JSONs
const fs=require('fs'),path=require('path'),{createHarness}=require('../board-ui/harness.cjs'),RL=require('../journey-integration/route/route-legs.cjs');
const H=createHarness(),SL=H.load('region/SkyLakeContinuous.ts'),TS=H.load('region/TransitionStaging.ts'),LB=H.load('region/LakesideBalloon.ts'),LC=H.load('region/LakesideCameraLayout.ts'),
 BL=H.load('ui/BoardLayout.ts'),SW=H.load('region/SkyWalkShot.ts'),AD=H.load('region/TransitionAnchorData.ts'),Core=H.load('world-r1/RegionJourneyCore.ts'),FS=H.load('region/SkyFinaleShot.ts'),SO=H.load('region/SkycityLensOccluders.ts');
const {J}=RL,{add,rotY,sub}=J;const DT=1/60,R2D=180/Math.PI,wrap=a=>((a%360)+540)%360-180,yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*R2D;
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(q*s.length))]||0;};
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};
(async()=>{const G=await RL.geometry(),M5=TS.TRANSITION_STAGING.skyMooring5a,D5=TS.TRANSITION_DURATIONS.seg5a,boxes=AD.transitionOccluderBoxes(),rows=[];
 const S6=add(rotY(J.yaw,[0.2,0.032,-27.8]),J.sOff),L=LC.lakesideJourney(S6),K=LB.LAKESIDE_BALLOON_LANDING;
 const fin={position:SW.skyLocalToWorld(M5,FS.SKY_FINALE_POSE_LOCAL.position),target:SW.skyLocalToWorld(M5,FS.SKY_FINALE_POSE_LOCAL.target),fovVerticalDeg:FS.SKY_FINALE_POSE_LOCAL.fovVerticalDeg};
 for(const [w,h] of RL.SCREENS){
  const shore=L.arrival[L.arrival.length-1],fr=LC.lakesideScreenFrame(w,h,BL.boardSafeInsets(w,h)),lan=LC.lakesideScreenLanding(L,fr,LC.LAKESIDE_CAMERA_LAYOUT.stopLocal);
  const E=Core.arrivalPose([shore,L.toWorld([...LC.LAKESIDE_CAMERA_LAYOUT.stopLocal])],L.focus,lan),land={position:E.position,target:E.target,fovVerticalDeg:lan.arrivalFovDeg};
  const M=LB.lakesideBalloonMooring(shore,L.toWorld),R=LB.lakesideBalloonRide([S6,...M5.walkWorld.slice(1).map(p=>[...p])],L.toWorld([...K.launchLocal]),M.mooring,land);
  const wide=LB.lakesideDoorWideLens(M.walk,M.mooring,land,w/h,{...BL.boardSafeInsets(w,h),h}),door=wide?wide.lens:LB.lakesideDoorLens(M.walk,M.mooring,w/h,undefined,undefined,{...BL.boardSafeInsets(w,h),h});
  const stepInS=(D5.intoBasket||TS.lakeBoardS())+D5.turn180+D5.sitDown,inW=R.walkS+D5.doorReach+stepInS,ign=Math.max(0,D5.inflate-inW);
  const Wk=SW.skyWalkShot(M5.walkWorld,M5.walkMps,2,[...boxes,...SW.skyBoxesToWorld(M5,SO.SKYCITY_LENS_OCCLUDERS,M5.walkWorld)],SW.finaleCity(fin),{...SW.SKY_WALK_SHOT,plan:AD.SKY_5A_WALK_PLAN},fin),walkCam=tau=>Wk.pose(Wk.gazeS+tau*Wk.walkS/R.walkS);
  const S=SL.skyLakeContinuous(R,door,{...SL.SKY_LAKE_CONT,doorS:D5.doorReach,stepInS,igniteS:ign,liftS:D5.liftoff,flightS:TS.TRANSITION_RETIME.lakeFlightS,placeholder:false,liftTraj:AD.SKY_5A_LIFT_KEYS,walkCam});
  const yawAt=tau=>SL.lakeBasketYaw(S,tau,M5.worldYawDeg,M.doorYawDeg);
  const b0=S.basket(0);ok(Math.hypot(...sub(b0,M5.world))<1e-3,`${w}x${h} W1 basket at C ${b0}`);ok(Math.abs(wrap(yawAt(0)-M5.worldYawDeg))<1e-9,'W1 moored yaw');
  const td=S.basket(S.touchdownAt-1e-6);ok(Math.hypot(...sub(td,R.vehicle(R.T)))<0.02,`${w}x${h} W1 touchdown ${Math.hypot(...sub(td,R.vehicle(R.T)))}`);ok(Math.abs(wrap(yawAt(S.touchdownAt)-M.doorYawDeg))<1e-6,'W1 landing yaw');
  const landLocal=wrap(M.doorYawDeg-L.yawDeg);
  // her: walk (SkyWalkShot timeline), board (door-stand → seat), seated (basket seat, rotates with basket)
  const seatLocal=add(RL.STAND_POINT,[TS.TRANSITION_STAGING.basket.seat[0],-.1,TS.TRANSITION_STAGING.basket.seat[2]])/* = adapter board(): seat local, her yaw rel to the basket */,SH=RL.SIT_HOLD,rel=M.seatYawDeg(M.startYawRad*R2D);
  const doorStand=M5.walkWorld.at(-1);
  const herAt=tau=>{if(tau<S.walkS){const s=Wk.her(Wk.gazeS+tau*Wk.walkS/R.walkS);return RL.standPts(s.feet);}
   const b=S.basket(tau),y=yawAt(tau),W=p=>RL.balToWorld(b,y,0,add(seatLocal,rotY(rel,p)));
   if(tau<S.walkS+D5.doorReach)return RL.standPts(doorStand);
   if(tau<S.walkS+D5.doorReach+stepInS-D5.sitDown){const u=(tau-S.walkS-D5.doorReach)/(stepInS-D5.sitDown),st=W([0,0,0]);return RL.standPts([doorStand[0]+(st[0]-doorStand[0])*u,doorStand[1],doorStand[2]+(st[2]-doorStand[2])*u]);}
   return {face:W(SH.face),chest:W(SH.chest),seated:true};};
  const from={position:add(S6,[-4,3,-4]),target:add(S6,[0,1.2,0]),fovVerticalDeg:48};
  const ps=[],hid=[];let inBox=0,minBox=9e9;
  for(let tau=0;tau<=S.touchdownAt+1;tau+=DT){const p=S.cam(tau,from);ps.push({tau,p});
   for(const x of boxes){const d=[0,1,2].map(k=>Math.max(x[k]-p.position[k],0,p.position[k]-x[k+3]));const dd=Math.hypot(...d);if(dd===0)inBox++;if(tau<S.flightAt)minBox=Math.min(minBox,dd);}
   if(tau<=S.touchdownAt){const her=herAt(tau),b=S.basket(tau),y=yawAt(tau);const los=q=>RL.hit(G.lake,p.position,q)||RL.balHit(b,y,0,p.position,q);const hh=los(her.face)||los(her.chest);if(process.env.QF_DBG&&hh&&w===390&&h===844)console.log("hit",tau.toFixed(2),JSON.stringify(hh).slice(0,60),p.position.map(v=>v.toFixed(2)).join(","),her.face.map(v=>v.toFixed(2)).join(","));hid.push(!!hh);}}
  let run=0,maxRun=0,at=0;hid.forEach((x,i)=>{run=x?run+DT:0;if(run>maxRun){maxRun=run;at=i*DT;}});if(process.env.QF_DBG)console.log(w+"x"+h,"hidden run ends",at.toFixed(2),S.phase(at));
  const yr=[],ya=[],dp=[],ph=[];for(let i=1;i<ps.length;i++){yr.push(wrap(yawOf(ps[i].p)-yawOf(ps[i-1].p))/DT);dp.push(Math.hypot(...sub(ps[i].p.position,ps[i-1].p.position)));ph.push(S.phase(ps[i].tau));}
  for(let i=1;i<yr.length;i++)ya.push(Math.abs(yr[i]-yr[i-1])/DT);
  const sel=(pred,a)=>a.filter((_,i)=>pred(ph[i]));const walkY=sel(x=>x==='C1-walk',yr),restY=sel(x=>x!=='C1-walk',yr),walkA=sel(x=>x==='C1-walk',ya),restA=sel(x=>x!=='C1-walk',ya);
  const r={screen:w+'x'+h,walkS:+S.walkS.toFixed(2),flightAt:+S.flightAt.toFixed(2),touchdownAt:+S.touchdownAt.toFixed(2),walkYawMax:+Math.max(...walkY.map(Math.abs)).toFixed(1),walkAccP99:+pct(walkA,.99).toFixed(0),
   yawMax:+Math.max(...restY.map(Math.abs)).toFixed(1),accP99:+pct(restA,.99).toFixed(0),stepMaxM:+Math.max(...dp).toFixed(3),faceChestHiddenMaxS:+maxRun.toFixed(2),lensInBox:inBox,boxClearMinM:+minBox.toFixed(2),liftJoinM:+S.liftJoinM.toFixed(2),landYawLocal:+wrap(landLocal).toFixed(3)};
  rows.push(r);
  ok(r.walkYawMax<=120&&r.walkAccP99<=300,`${r.screen} W2 walk ${r.walkYawMax}/${r.walkAccP99}`);ok(r.yawMax<=90&&r.accP99<=200,`${r.screen} W2 ride ${r.yawMax}/${r.accP99}`);ok(r.stepMaxM<=0.6,`${r.screen} W2 step ${r.stepMaxM}`);
  ok(r.faceChestHiddenMaxS<=0.5,`${r.screen} W3 hidden ${r.faceChestHiddenMaxS}`);ok(r.lensInBox===0,`${r.screen} W4 in box`);ok(r.boxClearMinM>=1.1,`${r.screen} W4 clearance ${r.boxClearMinM}`);
  const hand=Math.hypot(...sub(S.cam(S.touchdownAt+DT,from).position,S.cam(S.touchdownAt-DT,from).position));ok(hand<=0.6,`${r.screen} W2 touchdown hand ${hand}`);}
 // W4 sync: regenerate in memory and compare
 {const cp=require('child_process');const f=path.join(__dirname,'../../creator-build-project/assets/scripts/region/TransitionAnchorData.ts'),cur=fs.readFileSync(f,'utf8');cp.execFileSync(process.execPath,[path.join(__dirname,'gen-anchor-data.cjs')]);ok(fs.readFileSync(f,'utf8')===cur,'W4 TransitionAnchorData.ts out of sync (run gen-anchor-data.cjs)');}
 // wiring
 {const ad=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts'),'utf8');
  ok(/atC=continuousTransitions\(\)&&M5\.option==='C'/.test(ad)&&/M5\.walkWorld\.slice\(1\)/.test(ad)&&/liftTraj:SKY_5A_LIFT_KEYS,walkCam/.test(ad)&&/sl\.basket\(tau\)/.test(ad)&&/lakeBasketYaw\(sl,tau,M5\.worldYawDeg,moored\.doorYawDeg\)/.test(ad),'wiring: game lake ride at C');}
 console.table(rows);const out={status:fail?'FAIL':'PASS',label:'NOT_ENGINE proxy',rows};fs.mkdirSync(path.join(__dirname,'../journey-integration/reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../journey-integration/reports/lake-leg-c.json'),JSON.stringify(out,null,1)+'\n');
 console.log(JSON.stringify({status:out.status}));process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
