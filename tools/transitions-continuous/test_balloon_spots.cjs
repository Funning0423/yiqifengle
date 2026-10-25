'use strict';
// 运镜bot b19: the three balloon spots read from 场景设计部's transition-anchors.json via BalloonLegData (no hard-coded yaw / door side /
// walk / beat seconds), and the C1 data lift-off fed into SkyLakeContinuous: basket on the keys, continuous join into the flight,
// touchdown exact, lens caps on 7 screens. Old-yaw lens content: framing/occlusion vs the NEW mooring is re-blocked when the
// second-door yaws arrive (REPORT rows below).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),BD=H.load('region/BalloonLegData.ts'),SL=H.load('region/SkyLakeContinuous.ts'),TS=H.load('region/TransitionStaging.ts'),RL=require('../journey-integration/route/route-legs.cjs');
const A=JSON.parse(fs.readFileSync(path.join(__dirname,'transition-anchors.json'),'utf8')).segments,sp=BD.balloonSpots(A);
for(const s of [sp.meadowBoard,sp.skyBoard,sp.lakeExit]){assert.ok(s.basket&&s.basket.pos.length===3,s.id+' basket');assert.ok(s.seat,s.id+' seat');assert.ok(s.beats.length,s.id+' beats');}
assert.ok(sp.skyBoard.entryDoor,'sky entry door');assert.ok(sp.lakeExit.exitDoor,'lake exit door');assert.ok(sp.skyBoard.liftKeys&&sp.skyBoard.liftKeys.length>=2,'lift keys');
const P=BD.skyLakeParamsFrom(sp.skyBoard),DT=1/60,R2D=180/Math.PI,wrap=a=>((a%360)+540)%360-180,yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*R2D;
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(q*s.length))]||0;};
(async()=>{const G=await RL.geometry(),rows=[];
 for(const scr of RL.SCREENS){const leg=RL.lakeLeg(G,scr),Rr=leg.ride;
  const S=SL.skyLakeContinuous(Rr,leg.door,{...SL.SKY_LAKE_CONT,doorS:P.doorS,stepInS:P.stepInS,walkS:P.walkS,liftTraj:P.liftTraj,riderYawDeg:P.riderYawDeg,flightS:TS.TRANSITION_RETIME.lakeFlightS});
  // basket follows the keys exactly during the lift, and is continuous (≤ 0.6 m/frame) everywhere
  for(const k of P.liftTraj){const b=S.basket(S.flightAt+k.t-P.liftTraj[0].t-1e-9*(k===P.liftTraj.at(-1)));assert.ok(Math.hypot(...[0,1,2].map(j=>b[j]-k.pos[j]))<1e-3,'basket on lift key t='+k.t);}
  let bStep=0,prev=null;for(let tau=S.flightAt;tau<=S.touchdownAt+1;tau+=DT){const b=S.basket(tau);if(prev)bStep=Math.max(bStep,Math.hypot(...[0,1,2].map(j=>b[j]-prev[j])));prev=b;}
  const td=S.basket(S.touchdownAt),tv=Rr.vehicle(Rr.T);assert.ok(Math.hypot(...[0,1,2].map(j=>td[j]-tv[j]))<1e-6,'touchdown exact');
  const ps=[];for(let tau=S.flightAt-1;tau<=S.touchdownAt+1;tau+=DT)ps.push(S.cam(tau,null));const yr=[],ya=[],dp=[];
  for(let i=1;i<ps.length;i++){yr.push(wrap(yawOf(ps[i])-yawOf(ps[i-1]))/DT);dp.push(Math.hypot(...[0,1,2].map(j=>ps[i].position[j]-ps[i-1].position[j])));}for(let i=1;i<yr.length;i++)ya.push(Math.abs(yr[i]-yr[i-1])/DT);
  rows.push({screen:scr.join('x'),walkS:P.walkS,doorS:P.doorS,stepInS:+P.stepInS.toFixed(2),liftS:S.liftEndAt-S.flightAt,windowS:S.touchdownAt-S.flightAt,flightVisS:+S.flightVisS.toFixed(2),liftJoinM:+S.liftJoinM.toFixed(2),
   basketStepMaxM:+bStep.toFixed(3),lensYawMax:+Math.max(...yr.map(Math.abs)).toFixed(1),lensYawAccP99:+pct(ya,.99).toFixed(0),lensStepMaxM:+Math.max(...dp).toFixed(3),riderYawDeg:P.riderYawDeg,basketYawDeg:P.basketYawDeg});
  assert.ok(S.touchdownAt-S.flightAt>=TS.TRANSITION_RETIME.lakeFlightMinS-1e-9,'lift + visible flight ≥ min window');assert.ok(bStep<=0.6,'basket continuous');}
 console.log(JSON.stringify({status:'PASS',note:'lens caps REPORT only until the new yaws: lens content is T-03 re-based onto the data basket',spots:{meadow:sp.meadowBoard,sky:{...sp.skyBoard,liftKeys:sp.skyBoard.liftKeys.length},lake:sp.lakeExit},rows}));
})().catch(e=>{console.error(e);process.exit(1);});
