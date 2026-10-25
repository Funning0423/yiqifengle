'use strict';
// Segment 6 skycity→lakeside, no WindWipe boarding: C1 walk → board → lift-off (compressed) → T-03 12 s flight (exact) → C2
// touchdown/door/board (LAKESIDE_TOUCHDOWN unchanged). Per-frame continuity, yaw caps, face/chest occlusion, 7 screens.
const assert=require('node:assert/strict');
const RL=require('../journey-integration/route/route-legs.cjs'),{createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const TS=H.load('region/TransitionStaging.ts'),LB=H.load('region/LakesideBalloon.ts'),SL=H.load('region/SkyLakeContinuous.ts'),TC=H.load('region/TransitionCamera.ts');
const DT=1/60,RAD=180/Math.PI,wrap=a=>((a%360)+540)%360-180,pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(q*s.length))]||0;};
const yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*RAD;
const SWEEP=process.env.SWEEP?process.env.SWEEP.split(',').map(Number):null;
(async()=>{const G=await RL.geometry(),rows=[];
 for(const s of (process.env.SCREENS1?[RL.SCREENS[0]]:RL.SCREENS)){const leg=RL.lakeLeg(G,s),T=leg.timing,Rr=leg.ride,door=leg.door;
  for(const liftS of SWEEP||[SL.SKY_LAKE_CONT.liftS]){
   const S=SL.skyLakeContinuous(Rr,door,{...SL.SKY_LAKE_CONT,liftS,flightS:process.env.T03_EXACT?Rr.T-Rr.cutT:process.env.FLIGHT_S?+process.env.FLIGHT_S:TS.TRANSITION_RETIME.lakeFlightS});
   const from=leg.start.from,end=S.touchdownAt+T.outT+T.durS+0.5;
   // entry = T-02's end CamState via the continuation hook (stand-in: the skycity follow lens the T-03 audit uses)
   let got=null;const off=TC.onShotContinue(st=>{got=st;});TC.fireShotContinue({pose:from});off();assert.ok(got);
   const legT=tau=>tau<S.touchdownAt?S.rideT(tau):T.rideT+(tau-S.touchdownAt);
   const cam=tau=>tau<S.touchdownAt?S.cam(tau,got.pose):leg.cam(legT(tau));
   const poses=[from];for(let tau=0;tau<=end;tau+=DT)poses.push(cam(tau));
   const yr=[],ya=[],dp=[],df=[],accs=[];let occ=0,occMax=0,occAt=-1;
   for(let i=1;i<poses.length;i++){const a=poses[i-1],b=poses[i],tau=(i-1)*DT;yr.push(wrap(yawOf(b)-yawOf(a))/DT);dp.push(Math.hypot(...[0,1,2].map(j=>b.position[j]-a.position[j])));df.push(Math.abs((b.fovVerticalDeg??48)-(a.fovVerticalDeg??48)));
    const lt=legT(tau);let hid=false;/* b19: seated (BASKET_RIDE_POSE.lakeside, sit_hold) from the moment the basket leaves the mooring */const seatedNow=tau>=S.flightAt&&tau<S.touchdownAt;if(seatedNow||leg.herValid(lt)){const h=seatedNow?leg.herSeated(lt):leg.her(lt);hid=['face','chest'].some(k=>h[k]&&leg.los(lt,b.position,h[k]));}
    occ=hid?occ+DT:0;if(occ>occMax){occMax=occ;occAt=tau;}if(process.env.OCCDBG&&hid&&Math.round(tau*60)%15===0)console.error('hid',tau.toFixed(2),lt.toFixed(2),S.phase(tau));}
   for(let i=1;i<yr.length;i++)ya.push(Math.abs(yr[i]-yr[i-1])/DT);for(let i=1;i<dp.length;i++)accs.push(Math.abs(dp[i]-dp[i-1])/DT/DT);
   const row={screen:s.join('x'),liftS,walkS:+S.walkS.toFixed(2),flightAt:+S.flightAt.toFixed(2),touchdownAt:+S.touchdownAt.toFixed(2),yawMax:+Math.max(...yr.map(Math.abs)).toFixed(1),yawAccP99:+pct(ya,.99).toFixed(0),stepMaxM:+Math.max(...dp).toFixed(3),accP99:+pct(accs,.99).toFixed(2),fovStepMax:+Math.max(...df).toFixed(3),occFaceChestMaxS:+occMax.toFixed(2),occAt:+occAt.toFixed(2)};
   rows.push(row);
   if(!SWEEP){assert.ok(row.yawMax<=90.5,'yaw ≤ 90°/s '+JSON.stringify(row));assert.ok(row.yawAccP99<=201,'yaw accel p99 ≤ 200 '+JSON.stringify(row));
    assert.ok(row.stepMaxM<=0.6,'no position jump '+JSON.stringify(row));assert.ok(row.fovStepMax<=0.25,'no FOV jump '+JSON.stringify(row));
    assert.ok(row.occFaceChestMaxS<=0.5,'face/chest hidden ≤ 0.5 s '+JSON.stringify(row));
    /* b19 (Grok Bot caps): the visible flight is re-timed to TRANSITION_DURATIONS.seg5a.flight (8–12 s) — the old "T-03 flight
       bit-identical" gate is superseded by that instruction; what stays exact: the last tailS before touchdown and all of C2 */
    const FS=process.env.T03_EXACT?Rr.T-Rr.cutT:TS.TRANSITION_RETIME.lakeFlightS;assert.ok(FS>=TS.TRANSITION_RETIME.lakeFlightMinS&&FS<=12,'visible flight 8–12 s');assert.ok(Math.abs((S.touchdownAt-S.liftEndAt)-FS)<1e-9,'visible flight = data');
    for(const u of [-SL.SKY_LAKE_CONT.tailS+0.3,-1,-0.2,0,2,5]){const a=S.cam(S.touchdownAt+u,null),b=LB.lakesideDoorRideCamera(Rr,door,Rr.T+u,null);assert.ok(Math.hypot(...[0,1,2].map(j=>a.position[j]-b.position[j]))<1e-3,'touchdown/C2 framing exact at '+u);}}
  }}
 console.log(JSON.stringify({status:SWEEP?'SWEEP':'PASS',touchdown:LB.LAKESIDE_TOUCHDOWN,rows}));
})().catch(e=>{console.error(e);process.exit(1);});
