'use strict';
// 运镜bot full2-cam E: basket in/out close-ups of the meadow→skycity balloon (BalloonTransit B1 / B5), modelled as the runtime:
// B1 lens = basketClosePose(spot beside door A, her feet) while she walks to the door, reaches, steps in; min-jerk onto
// plan.camera(0) over min(blendS, sitDown·.9) once she is in.  B5 lens = min-jerk from plan.camera(total) onto the close pose
// beside door B (blendS), tracking her through door B, the step down and the deck to S0.  Per screen (7):
//  K1 her height ≥25 % of the frame on the hold (B1: door → stepped in ; B5: blend done → door B → step down)
//  K2 yaw: standing ≤90°/s (p99 accel ≤200°/s²), walking ≤120°/s (≤300°/s²); B1 end == ride lens at 0 (≤1 mm)
//  K3 face/chest hidden (meadow / sky-city mesh + balloon mesh) longest run ≤0.5 s
//  K4 lens never inside a transition occluder box, ≥1.1 m from them
const {createHarness}=require('../board-ui/harness.cjs'),RL=require('../journey-integration/route/route-legs.cjs');
const H=createHarness(),T=H.load('region/TransportLeg.ts'),TS=H.load('region/TransitionStaging.ts'),TM=H.load('region/TransitionStagingMath.ts'),
 BC=H.load('region/BasketCloseShot.ts'),AD=H.load('region/TransitionAnchorData.ts'),TC=H.load('region/TransitionCamera.ts');
const {J}=RL,{add,rotY}=J,DT=1/60,R2D=180/Math.PI,wrap=a=>((a%360)+540)%360-180,yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*R2D;
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(q*s.length))]||0;};
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};
const lerpPath=(pts,u)=>{const L=[];let tot=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][2]-pts[i-1][2]);L.push(d);tot+=d;}let s=Math.max(0,Math.min(1,u))*tot;
 for(let i=0;i<L.length;i++){if(s<=L[i]||i===L.length-1){const k=L[i]?Math.min(1,s/L[i]):1;return pts[i].map((v,j)=>v+(pts[i+1][j]-v)*k);}s-=L[i];}return pts[pts.length-1];};
const dBox=(p,b)=>{const lo=b.slice(0,3),hi=b.slice(3,6);let s=0,inside=true;for(let i=0;i<3;i++){const d=Math.max(lo[i]-p[i],0,p[i]-hi[i]);if(d>0)inside=false;s+=d*d;}return inside?-1:Math.sqrt(s);};
(async()=>{const G=await RL.geometry(),B=TS.TRANSITION_STAGING.basket,K=TS.TRANSITION_STAGING.skycity,D3=TS.TRANSITION_DURATIONS.seg3,D4=TS.TRANSITION_DURATIONS.seg4,boxes=AD.transitionOccluderBoxes(),rows=[];
 const m6=add(rotY(180,[0.2,6.5,-25.6]),J.mOff),plan=T.balloonBeats(m6,[5.4,-0.11,43.8],J.sp('anchor_starcourt_center'),{walkInM:0,walkOutM:0,cityFrame:{yawDeg:J.yaw,origin:J.sOff}});
 const city=l=>add(rotY(J.yaw,l),J.sOff);
 for(const [w,h] of RL.SCREENS){const shots=[];
  {// B1
   const v=plan.vehicle(0),o=v.pos,y=v.yaw*R2D,W=l=>TM.basketToWorld(o,y,l),cam0=plan.camera(0,{w,h}),sp=BC.basketCloseSpot(W(B.doorOut),o,boxes,undefined,[cam0]);
   const toDoor=[m6,W(B.outside),W(B.doorOut)],len=toDoor.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-toDoor[i][0],p[2]-toDoor[i][2]),0),walkS=Math.max(D3.toBasket*Math.min(1,len/6),len/TS.TRANSITION_STAGING.walkMps);
   const t1=walkS+D3.doorReach,inAt=t1+D3.intoBasket,bl=Math.min(BC.BASKET_CLOSE.blendS,D3.sitDown*.9),end=inAt+D3.sitDown;
   const feet=t=>t<walkS?lerpPath(toDoor,t/walkS):t<t1?W(B.doorOut):t<inAt?lerpPath([W(B.doorOut),W(B.threshold),W(B.p0)],(t-t1)/D3.intoBasket):W(B.p0);
   const bin=BC.b1InS(walkS),cam=t=>{const c=TC.blendPose(cam0,BC.basketClosePose(sp.position,feet(t)),TC.minJerk(t/bin));return t<inAt?c:TC.blendPose(c,cam0,TC.minJerk((t-inAt)/bl));};
   shots.push({id:'B1 meadow in',sp,cam,feet,end,hold:[walkS,inAt],walk:t=>t<walkS||(t>=t1&&t<inAt),los:(a,b)=>RL.hit(G.meadow,a,b)||RL.balHit(o,y,v.roll,a,b),
    tail:()=>{const p=cam(end),q=cam0;return Math.max(...[0,1,2].map(i=>Math.abs(p.position[i]-q.position[i])));}});}
  {// B5
   const v=plan.vehicle(plan.total),o=v.pos,y=v.yaw*R2D,W=l=>TM.basketToWorld(o,y,l),camEnd=plan.camera(plan.total,{w,h}),sp=BC.basketCloseSpot(W(B.doorOutB),o,boxes,undefined,[camEnd]);
   const seat=W([0,0,0]),st=D4.standUp+D4.pause,t1=st+D4.doorReach,t2=t1+D4.stepDown+1,p2=[city(K.stepDown),city(K.deckEdge),city(K.s0New)],l2=Math.hypot(p2[1][0]-p2[0][0],p2[1][2]-p2[0][2])+Math.hypot(p2[2][0]-p2[1][0],p2[2][2]-p2[1][2]);
   const end=t2+Math.min(D4.toPath,Math.max(1.5,l2/TS.TRANSITION_STAGING.walkMps));
   const feet=t=>t<t1?seat:t<t2?lerpPath([seat,W(B.thresholdB),W(B.doorOutB),city(K.stepDown)],(t-t1)/(t2-t1)):lerpPath(p2,(t-t2)/(end-t2));
   const cam=t=>TC.blendPose(camEnd,BC.basketClosePose(sp.position,feet(t)),TC.minJerk(t/BC.BASKET_CLOSE.blendOutS));
   shots.push({id:'B5 skycity out',sp,cam,feet,end,hold:[Math.max(st,BC.BASKET_CLOSE.blendOutS),t2],walk:t=>t>=t1,los:(a,b)=>RL.hit(G.cityB,a,b)||RL.balHit(o,y,v.roll,a,b),tail:()=>0});}
  for(const S of shots){if(!S.sp){ok(false,`${S.id} ${w}x${h} no clear close-up spot`);continue;}
   let herMin=9,ys=[],prevY=null,prevV=null,maxW=0,maxS=0,accW=[],accS=[],run=0,runMax=0,clr=99,inBox=false;
   for(let t=0;t<=S.end+1e-9;t+=DT){const p=S.cam(t),f=S.feet(t),yy=yawOf(p);
    if(t>=S.hold[0]&&t<=S.hold[1])herMin=Math.min(herMin,BC.herHeightFrac(p,f));
    if(prevY!==null){const vv=wrap(yy-prevY)/DT,wk=S.walk(t);if(wk)maxW=Math.max(maxW,Math.abs(vv));else maxS=Math.max(maxS,Math.abs(vv));
     if(prevV!==null)(wk?accW:accS).push(Math.abs(vv-prevV)/DT);prevV=vv;}prevY=yy;
    const pts=RL.standPts(f),hid=S.los(p.position,pts.face)||S.los(p.position,pts.chest);run=hid?run+DT:0;runMax=Math.max(runMax,run);
    for(const b of boxes){const d=dBox(p.position,b);if(d<0)inBox=true;else clr=Math.min(clr,d);}}
   const r={id:S.id,scr:`${w}x${h}`,her:+(herMin*100).toFixed(1),yawS:+maxS.toFixed(1),p99S:+pct(accS,.99).toFixed(0),yawW:+maxW.toFixed(1),p99W:+pct(accW,.99).toFixed(0),hid:+runMax.toFixed(2),clr:+clr.toFixed(2),tail:+S.tail().toFixed(4)};rows.push(r);
   ok(herMin>=.25,`${r.id} ${r.scr} her ${r.her}% <25`);ok(maxS<=90&&pct(accS,.99)<=200,`${r.id} ${r.scr} standing yaw ${r.yawS}°/s p99 ${r.p99S}`);
   ok(maxW<=120&&pct(accW,.99)<=300,`${r.id} ${r.scr} walking yaw ${r.yawW}°/s p99 ${r.p99W}`);ok(runMax<=.5,`${r.id} ${r.scr} hidden ${r.hid}s`);
   ok(!inBox&&clr>=1.1,`${r.id} ${r.scr} clearance ${r.clr}`);ok(r.tail<=.001,`${r.id} ${r.scr} B1 end ≠ ride lens (${r.tail} m)`);}}
 console.table(rows);console.log(fail?`basket-close FAIL (${fail})`:'basket-close PASS');process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
