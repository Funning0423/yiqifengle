'use strict';
// Segment 6 skycity→lakeside, no WindWipe boarding: C1 walk → board → lift-off (compressed) → T-03 12 s flight (exact) → C2
// touchdown/door/board (LAKESIDE_TOUCHDOWN unchanged). Per-frame continuity, yaw caps, face/chest occlusion, 7 screens.
const assert=require('node:assert/strict');
const RL=require('../journey-integration/route/route-legs.cjs'),{createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const LB=H.load('region/LakesideBalloon.ts'),SL=H.load('region/SkyLakeContinuous.ts'),TC=H.load('region/TransitionCamera.ts');
const DT=1/60,RAD=180/Math.PI,wrap=a=>((a%360)+540)%360-180,pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(q*s.length))]||0;};
const yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*RAD;
const SWEEP=process.env.SWEEP?process.env.SWEEP.split(',').map(Number):null;
(async()=>{const G=await RL.geometry(),rows=[];
 for(const s of (process.env.SCREENS1?[RL.SCREENS[0]]:RL.SCREENS)){const leg=RL.lakeLeg(G,s),T=leg.timing,Rr=leg.ride,door=leg.door;
  for(const liftS of SWEEP||[SL.SKY_LAKE_CONT.liftS]){
   const S=SL.skyLakeContinuous(Rr,door,{...SL.SKY_LAKE_CONT,liftS});
   const from=leg.start.from,end=S.touchdownAt+T.outT+T.durS+0.5;
   // entry = T-02's end CamState via the continuation hook (stand-in: the skycity follow lens the T-03 audit uses)
   let got=null;const off=TC.onShotContinue(st=>{got=st;});TC.fireShotContinue({pose:from});off();assert.ok(got);
   const legT=tau=>tau<S.touchdownAt?S.rideT(tau):T.rideT+(tau-S.touchdownAt);
   const cam=tau=>tau<S.touchdownAt?S.cam(tau,got.pose):leg.cam(legT(tau));
   const poses=[from];for(let tau=0;tau<=end;tau+=DT)poses.push(cam(tau));
   const yr=[],ya=[],dp=[],df=[],accs=[];let occ=0,occMax=0,occAt=-1;
   for(let i=1;i<poses.length;i++){const a=poses[i-1],b=poses[i],tau=(i-1)*DT;yr.push(wrap(yawOf(b)-yawOf(a))/DT);dp.push(Math.hypot(...[0,1,2].map(j=>b.position[j]-a.position[j])));df.push(Math.abs((b.fovVerticalDeg??48)-(a.fovVerticalDeg??48)));
    const lt=legT(tau);let hid=false;if(leg.herValid(lt)){const h=leg.her(lt);hid=['face','chest'].some(k=>h[k]&&leg.los(lt,b.position,h[k]));}
    occ=hid?occ+DT:0;if(occ>occMax){occMax=occ;occAt=tau;}}
   for(let i=1;i<yr.length;i++)ya.push(Math.abs(yr[i]-yr[i-1])/DT);for(let i=1;i<dp.length;i++)accs.push(Math.abs(dp[i]-dp[i-1])/DT/DT);
   const row={screen:s.join('x'),liftS,walkS:+S.walkS.toFixed(2),flightAt:+S.flightAt.toFixed(2),touchdownAt:+S.touchdownAt.toFixed(2),yawMax:+Math.max(...yr.map(Math.abs)).toFixed(1),yawAccP99:+pct(ya,.99).toFixed(0),stepMaxM:+Math.max(...dp).toFixed(3),accP99:+pct(accs,.99).toFixed(2),fovStepMax:+Math.max(...df).toFixed(3),occFaceChestMaxS:+occMax.toFixed(2),occAt:+occAt.toFixed(2)};
   // C2 (sign removed, b53c8336): touchdown → board blend start (boardByS) frames HER + the LAKE: every frame she is fully in the
   // safe frame, ≥ 3 lake-surface samples (LAKESIDE_DOOR_LAKE_OFFS, the wide-lens search set) are on screen, her height ≥ 20 % of the frame
   {const moor=Rr.vehicle(Rr.T),lake=LB.LAKESIDE_DOOR_LAKE_OFFS.map(o=>[moor[0]+o[0],moor[1]+o[1],moor[2]+o[2]]),asp=s[0]/s[1];let hMin=9,lMin=99,inF=true;
    for(let tau=S.touchdownAt;tau<=S.touchdownAt+LB.lakesideBoardByS();tau+=DT){const c=cam(tau),lt=legT(tau),h=leg.her(lt),P=c.position;
     const f=(()=>{const q=c.target.map((x,i)=>x-P[i]),l=Math.hypot(...q);return q.map(x=>x/l);})(),rl=Math.hypot(f[0],f[2]),r=[-f[2]/rl,0,f[0]/rl],u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],th=Math.tan((c.fovVerticalDeg??48)*Math.PI/360);
     const nd=p=>{const v=p.map((x,i)=>x-P[i]),z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2];return [(v[0]*r[0]+v[2]*r[2])/(z*th*asp),(v[0]*u[0]+v[1]*u[1]+v[2]*u[2])/(z*th),z];};
     const pts=[h.root,h.head,h.face,h.chest].filter(Boolean).map(nd);if(pts.some(n=>n[2]<=0||Math.abs(n[0])>1||Math.abs(n[1])>1))inF=false;
     const ys=pts.map(n=>n[1]);if(!/seated/.test(h.pose||""))hMin=Math.min(hMin,(Math.max(...ys)-Math.min(...ys))/2)/* standing (out of the basket) */;
     if(process.env.DBG&&Math.round((tau-S.touchdownAt)*60)%30===0)console.error(s.join("x"),(tau-S.touchdownAt).toFixed(1),((Math.max(...ys)-Math.min(...ys))/2).toFixed(3),h.pose||"");
     lMin=Math.min(lMin,lake.filter(p=>{const n=nd(p);return n[2]>0&&Math.abs(n[0])<.95&&Math.abs(n[1])<.95;}).length);}
    row.c2HerFrac=+hMin.toFixed(3);row.c2LakeMin=lMin;row.c2InFrame=inF;}
   rows.push(row);
   if(!SWEEP){assert.ok(row.yawMax<=90.5,'yaw ≤ 90°/s '+JSON.stringify(row));assert.ok(row.yawAccP99<=201,'yaw accel p99 ≤ 200 '+JSON.stringify(row));
    assert.ok(row.stepMaxM<=0.6,'no position jump '+JSON.stringify(row));assert.ok(row.fovStepMax<=0.25,'no FOV jump '+JSON.stringify(row));
    assert.ok(row.occFaceChestMaxS<=0.5,'face/chest hidden ≤ 0.5 s '+JSON.stringify(row));
    for(const u of [0,3,6,11.9]){const a=S.cam(S.liftEndAt+u,null),b=LB.lakesideDoorRideCamera(Rr,door,Rr.cutT+u,null);assert.ok(Math.hypot(...[0,1,2].map(j=>a.position[j]-b.position[j]))<1e-9,'T-03 flight exact at +'+u);}
    assert.ok(row.c2InFrame,'C2: she is fully in frame '+JSON.stringify(row));assert.ok(row.c2LakeMin>=3,'C2: lake visible '+JSON.stringify(row));assert.ok(row.c2HerFrac>=LB.LAKESIDE_DOOR_HER_FRAC-0.005,'C2: her standing height ≥ LAKESIDE_DOOR_HER_FRAC (floor 7 %) '+JSON.stringify(row));
    assert.ok(Math.abs((S.touchdownAt-S.liftEndAt)-(Rr.T-Rr.cutT))<1e-9,'T-03 visible flight length kept');}
  }}
 const K6=SL.SKY_LAKE_CONT,vis=rows.length?null:null;void vis;
 // data-driven lift-off (场景设计部 trajectory, not delivered yet): synthetic stand-in — drift 4 m horizontally, then climb onto the
 // T-03 flight at flightSkipS. The camera must keep the caps and continuity on it (390x844).
 const liftRows=[];if(!SWEEP){const leg=RL.lakeLeg(G,RL.SCREENS[0]),Rr=leg.ride,door=leg.door,v0=Rr.flight.vehicle(0),vE=Rr.flight.vehicle(Rr.cutT-Rr.liftT),h=[vE[0]-v0[0],vE[2]-v0[2]],hl=Math.hypot(...h);
  const keys=[{t:0,pos:v0,yawDeg:0},{t:1.6,pos:[v0[0]+h[0]/hl*4,v0[1]+.4,v0[2]+h[1]/hl*4],yawDeg:0},{t:5,pos:vE,yawDeg:0}];
  assert.ok(SL.liftTrajJoinErr(Rr,keys)<1e-9);const S=SL.skyLakeContinuous(Rr,door,{...SL.SKY_LAKE_CONT,liftTraj:keys}),P=[];
  for(let tau=0;tau<=S.touchdownAt+1;tau+=DT)P.push(tau<S.touchdownAt?S.cam(tau,leg.start.from):leg.cam(leg.timing.rideT+(tau-S.touchdownAt)));
  const yr=[],dp=[],ya=[];for(let i=1;i<P.length;i++){yr.push(wrap(yawOf(P[i])-yawOf(P[i-1]))/DT);dp.push(Math.hypot(...[0,1,2].map(j=>P[i].position[j]-P[i-1].position[j])));}for(let i=1;i<yr.length;i++)ya.push(Math.abs(yr[i]-yr[i-1])/DT);
  const r={case:'liftTraj synthetic',yawMax:+Math.max(...yr.map(Math.abs)).toFixed(1),yawAccP99:+pct(ya,.99).toFixed(0),stepMaxM:+Math.max(...dp).toFixed(3)};liftRows.push(r);
  assert.ok(r.yawMax<=90.5&&r.yawAccP99<=201&&r.stepMaxM<=0.6,'data lift-off camera caps '+JSON.stringify(r));}
 console.log(JSON.stringify({status:SWEEP?'SWEEP':'PASS',liftRows,touchdown:LB.LAKESIDE_TOUCHDOWN,rows}));
})().catch(e=>{console.error(e);process.exit(1);});
