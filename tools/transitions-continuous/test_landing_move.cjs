'use strict';
// 运镜bot full9c 3b: the meadow→skycity balloon landing lens (BalloonTransit flight apply() + B5), modelled as the runtime, before
// (d3b8e5e4: flight lens to the end, then B5 min-jerk camEnd → door close-up over speedSafeS) and after (BalloonTransit-3b-landing.diff:
// ONE min-jerk move from LAND_PRE_S = 2 s of ride clock before the ride ends, ≥ LAND_MOVE_S = 5 s, B5 continues it). Per screen (7), from
// ride clock RIDE_DURATION − 6 s to B5 + 6 s at 60 Hz: HARD (after) longest still span (lens < 0.05 m/s and view < 2 °/s) ≤ 0.5 s
// once the move window starts; move ≥ 5 s; peak lens speed ≤ 11 m/s (LENS_MAX_MPS); no frame step > 3× the median moving step
// (cut-like swing); end pose == before end pose (same close-up, the night lens is not pulled closer). Timing code untouched (totals).
const {createHarness}=require('../board-ui/harness.cjs'),RL=require('../journey-integration/route/route-legs.cjs');
global.__QF_BALLOON_FLIGHT=JSON.parse(require('fs').readFileSync(require('path').resolve(__dirname,'../../creator-build-project/assets/bundles/region_transit_balloon/balloon_flightpath.json'),'utf8'));
const H=createHarness(),T=H.load('region/TransportLeg.ts'),TS=H.load('region/TransitionStaging.ts'),TM=H.load('region/TransitionStagingMath.ts'),BC=H.load('region/BasketCloseShot.ts'),AD=H.load('region/TransitionAnchorData.ts'),TC=H.load('region/TransitionCamera.ts'),BF=H.load('region/BalloonFlight.ts');
const {J}=RL,{add,rotY}=J,DT=1/60,R2D=180/Math.PI,yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*R2D,dirOf=p=>{const d=p.target.map((v,i)=>v-p.position[i]),l=Math.hypot(...d);return d.map(v=>v/l);};
const lerpPath=(pts,u)=>{const L=[];let tot=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][2]-pts[i-1][2]);L.push(d);tot+=d;}let s=Math.max(0,Math.min(1,u))*tot;
 for(let i=0;i<L.length;i++){if(s<=L[i]||i===L.length-1){const k=L[i]?Math.min(1,s/L[i]):1;return pts[i].map((v,j)=>v+(pts[i+1][j]-v)*k);}s-=L[i];}return pts[pts.length-1];};
const B=TS.TRANSITION_STAGING.basket,K=TS.TRANSITION_STAGING.skycity,D4=TS.TRANSITION_DURATIONS.seg4,boxes=AD.transitionOccluderBoxes(),RD=BF.RIDE_DURATION,PRE=2,MOVE=5;
const m6=add(rotY(180,[0.2,6.5,-25.6]),J.mOff),plan=T.balloonBeats(m6,[5.4,-0.11,43.8],J.sp('anchor_starcourt_center'),{walkInM:0,walkOutM:0,cityFrame:{yawDeg:J.yaw,origin:J.sOff}}),city=l=>add(rotY(J.yaw,l),J.sOff);
const out={rows:[],series:{}};let fails=0;
for(const [w,h] of RL.SCREENS){const v=plan.vehicle(plan.total),o=v.pos,y=v.yaw*R2D,Wb=l=>TM.basketToWorld(o,y,l),camEnd=plan.camera(plan.total,{w,h}),sp=BC.basketCloseSpot(Wb(B.doorOutB),o,boxes,undefined,[camEnd]);
 const st=D4.standUp+D4.pause,t1=st+D4.doorReach,t2=t1+D4.stepDown+1,p2=[city(K.stepDown),city(K.deckEdge),city(K.s0New)],seatAt=c=>{const e=plan.vehicle(BF.rideToFlightT(c));return TM.basketToWorld(e.pos,e.yaw*R2D,[0,0,0]);};
 const feet=b=>b<t1?Wb([0,0,0]):b<t2?lerpPath([Wb([0,0,0]),Wb(B.thresholdB),Wb(B.doorOutB),city(K.stepDown)],(b-t1)/(t2-t1)):lerpPath(p2,(b-t2)/3);
 const ss=BC.speedSafeS(camEnd.position,sp.position,BC.BASKET_CLOSE.blendOutS),Tm=Math.max(MOVE,PRE+ss),close=f=>BC.basketClosePose(sp.position,f);
 const before=[],after=[];for(let c=RD-6;c<=RD+6+1e-9;c+=DT){const inB5=c>RD,b=c-RD,f=inB5?feet(b):seatAt(c),pl=inB5?camEnd:plan.camera(BF.rideToFlightT(c),{w,h});
  before.push({c,p:inB5?TC.blendPose(camEnd,close(f),TC.minJerk(b/ss)):pl});const tau=c-(RD-PRE);after.push({c,p:tau>=0?TC.blendPose(pl,close(f),TC.minJerk(tau/Tm)):pl});}
 const stat=(S,from)=>{let still=0,run=0,vmax=0,steps=[],yawMax=0,stillAt=null;for(let i=1;i<S.length;i++){const a=S[i-1].p,b=S[i].p,d=Math.hypot(...b.position.map((x,k)=>x-a.position[k])),dv=Math.acos(Math.min(1,dirOf(a).reduce((s,x,k)=>s+x*dirOf(b)[k],0)))*R2D;
   if(S[i].c<from)continue;vmax=Math.max(vmax,d/DT);yawMax=Math.max(yawMax,dv/DT);if(d/DT>0.05)steps.push(d);if(d/DT<0.05&&dv/DT<2){run+=DT;if(run>still){still=run;stillAt=S[i].c-RD;}}else run=0;}
  steps.sort((x,y)=>x-y);const med=steps[steps.length>>1]||0;return {longestStillS:+still.toFixed(2),stillEndsAtB5S:stillAt==null?null:+stillAt.toFixed(2),peakMS:+vmax.toFixed(2),peakViewDegS:+yawMax.toFixed(1),maxStepOverMedian:+(steps.at(-1)/(med||1)).toFixed(2)};};
 const sb=stat(before,RD-PRE),sa=stat(after,RD-PRE),endErr=Math.hypot(...after.at(-1).p.position.map((x,k)=>x-before.at(-1).p.position[k])),dist=Math.hypot(...camEnd.position.map((x,k)=>x-sp.position[k]));
 const ok=sa.longestStillS<=0.5&&Tm>=MOVE&&sa.peakMS<=11&&sa.maxStepOverMedian<=3&&endErr<1e-6;if(!ok)fails++;
 out.rows.push({screen:w+'x'+h,swingM:+dist.toFixed(1),beforeBlendS:+ss.toFixed(2),afterMoveS:+Tm.toFixed(2),before:sb,after:sa,endPoseSame:endErr<1e-6,ok});
 if(w===390&&h===844)out.series={before:before.map(s=>s.p),after:after.map(s=>s.p),c0:RD-6,dt:DT,her:before.map(s=>s.c>RD?feet(s.c-RD):seatAt(s.c))};}
if(process.argv.includes('--json'))require('fs').writeFileSync(process.argv[process.argv.indexOf('--json')+1],JSON.stringify(out));
for(const r of out.rows)console.log(JSON.stringify(r));console.log(JSON.stringify({test:'landing-move',status:fails?'FAIL':'PASS'}));process.exit(fails?1:0);
