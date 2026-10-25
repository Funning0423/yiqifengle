'use strict';
// 运镜bot full2-cam task 5.4: the meadow yard fence (env_meadow.glb meadow_fence_merged, b19 wall (3.1,−21.0)→(8.3,−25.4)) and
// its west gate (2.6,−20.8): NodeWalker M4→M6 and M5→M6 walks through the gate, then the B1 boarding close-up.
//  walk  lens = ExploreCameraCore.followPose (her heading, eased 0.25 s like the follow yaw), per screen; she walks at 1.2 m/s
//  board lens = BalloonTransit B1 (BasketCloseShot spot beside door A, blended in from the ride lens 0) — as test basket-close
// Gates: G1 face/chest hidden by the fence (walk) or fence + meadow + basket mesh (board) longest run ≤0.5 s;
//        G2 lens never inside the fence (distance > 0.05 m, walk) and ≥1.1 m from it on the scripted B1 shot.
const RL=require('../journey-integration/route/route-legs.cjs'),LD=require('./lib-dock-mesh.cjs'),{J}=RL,{add,rotY}=J;
const H=J.H,NW=H.load(J.S+'region/NodeWalker.ts'),EC=H.load(J.S+'region/ExploreCameraCore.ts'),T=H.load(J.S+'region/TransportLeg.ts'),TS=H.load(J.S+'region/TransitionStaging.ts'),
 TM=H.load(J.S+'region/TransitionStagingMath.ts'),BC=H.load(J.S+'region/BasketCloseShot.ts'),AD=H.load(J.S+'region/TransitionAnchorData.ts'),TC=H.load(J.S+'region/TransitionCamera.ts');
const DT=1/60,R2D=180/Math.PI,wrap=a=>((a%360)+540)%360-180,W=p=>add(rotY(180,p),J.mOff);let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};
const lerpPath=(pts,s)=>{for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][2]-pts[i-1][2]);if(s<=d||i===pts.length-1){const k=d?Math.min(1,s/d):1;return {p:pts[i-1].map((v,j)=>v+(pts[i][j]-v)*k),yaw:Math.atan2(pts[i][0]-pts[i-1][0],pts[i][2]-pts[i-1][2])};}s-=d;}};
const plen=pts=>pts.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-pts[i][0],p[2]-pts[i][2]),0);
(async()=>{const G=await RL.geometry(),fn=J.loadGlb(J.B+'region_meadow/env_meadow.glb').find(x=>x.name==='meadow_fence_merged'),FT=[];
 for(let k=0;k<fn.tris.length;k+=9)FT.push([0,3,6].map(o=>W([fn.tris[k+o],fn.tris[k+o+1],fn.tris[k+o+2]])));const fence=LD.group({meadow_fence_merged:FT}),gate=W([2.6,0,-20.8]),rows=[];
 const m6=W([0.2,6.5,-25.6]),plan=T.balloonBeats(m6,[5.4,-0.11,43.8],J.sp('anchor_starcourt_center'),{walkInM:0,walkOutM:0,cityFrame:{yawDeg:J.yaw,origin:J.sOff}}),B=TS.TRANSITION_STAGING.basket,D3=TS.TRANSITION_DURATIONS.seg3;
 for(const [w,h] of RL.SCREENS){
  for(const [a,b] of [['M4','M6'],['M5','M6']]){const pts=NW.planWalk('meadow',a,b).segments.flatMap(s=>s.path).map(W),L=plen(pts);let yaw=null,run=0,runMax=0,minD=99,gateD=99,gateHid=0;
   for(let s=0;s<=L+1e-9;s+=1.2*DT){const q=lerpPath(pts,s);yaw=yaw===null?q.yaw:yaw+wrap((q.yaw-yaw)*R2D)/R2D*Math.min(1,DT/.25);const p=EC.followPose(q.p,yaw,w,h,0),her=RL.standPts(q.p);
    const hh=fence.hit(p.position,her.face)||fence.hit(p.position,her.chest);run=hh?run+DT:0;runMax=Math.max(runMax,run);const d=fence.dist(p.position,5);minD=Math.min(minD,d);
    const g=Math.hypot(q.p[0]-gate[0],q.p[2]-gate[2]);if(g<gateD)gateD=g;if(g<1.5&&hh)gateHid+=DT;}
   const r={shot:`walk ${a}→${b}`,scr:`${w}x${h}`,lenM:+L.toFixed(1),passGateM:+gateD.toFixed(2),hiddenS:+runMax.toFixed(2),hiddenNearGateS:+gateHid.toFixed(2),fenceClearM:+minD.toFixed(2)};rows.push(r);
   ok(runMax<=.5,`${r.shot} ${r.scr} hidden ${r.hiddenS}s`);ok(minD>.05,`${r.shot} ${r.scr} lens in fence (${r.fenceClearM})`);}
  {const v=plan.vehicle(0),o=v.pos,y=v.yaw*R2D,Wb=l=>TM.basketToWorld(o,y,l),cam0=plan.camera(0,{w,h}),boxes=AD.transitionOccluderBoxes(),sp=BC.basketCloseSpot(Wb(B.doorOut),o,boxes,undefined,[cam0]);
   const toDoor=[m6,Wb(B.outside),Wb(B.doorOut)],len=plen(toDoor),walkS=Math.max(D3.toBasket*Math.min(1,len/6),len/TS.TRANSITION_STAGING.walkMps),t1=walkS+D3.doorReach,inAt=t1+D3.intoBasket,end=inAt+D3.sitDown,bin=BC.b1InS(walkS),bl=Math.min(BC.BASKET_CLOSE.blendS,D3.sitDown*.9);
   const feet=t=>t<walkS?lerpPath(toDoor,t/walkS*len).p:t<t1?Wb(B.doorOut):lerpPath([Wb(B.doorOut),Wb(B.threshold),Wb(B.p0)],(t-t1)/D3.intoBasket*plen([Wb(B.doorOut),Wb(B.threshold),Wb(B.p0)])).p;
   const cam=t=>{const c=TC.blendPose(cam0,BC.basketClosePose(sp.position,feet(t)),TC.minJerk(t/bin));return t<inAt?c:TC.blendPose(c,cam0,TC.minJerk((t-inAt)/bl));};
   let run=0,runMax=0,minD=99,fh=0;for(let t=0;t<=end;t+=DT){const p=cam(t),her=RL.standPts(feet(t)),los=q=>fence.hit(p.position,q)||RL.hit(G.meadow,p.position,q)||RL.balHit(o,y,v.roll,p.position,q);
    const f1=fence.hit(p.position,her.face)||fence.hit(p.position,her.chest);if(f1)fh+=DT;const hh=f1||los(her.face)||los(her.chest);run=hh?run+DT:0;runMax=Math.max(runMax,run);minD=Math.min(minD,fence.dist(p.position,30));}
   const r={shot:'B1 boarding close-up',scr:`${w}x${h}`,lenM:+len.toFixed(1),passGateM:'-',hiddenS:+runMax.toFixed(2),hiddenNearGateS:+fh.toFixed(2),fenceClearM:+minD.toFixed(2)};rows.push(r);
   ok(runMax<=.5,`B1 ${r.scr} hidden ${r.hiddenS}s`);ok(minD>=1.1,`B1 ${r.scr} fence clearance ${r.fenceClearM}`);}}
 console.table(rows);console.log(fail?`fence-gate FAIL (${fail})`:'fence-gate PASS');process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
