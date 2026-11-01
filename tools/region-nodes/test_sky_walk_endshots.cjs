'use strict';
// 运镜bot full9c (Grok Bot: S3>S4 + S4>S6 must be fixed, hard gates unchanged): skycity played walks (walkPair mainline-09..12 + playFinale)
// with the full9c rails GGbot wires into RegionNodeStage (outbox/20261029-full9c-final-cam/RegionNodeStage-finale-rail.diff): SkyRunLens.skyRailPose per walk.
// with the full9c rails GGbot wires into RegionNodeStage (outbox/20261029-full9c-final-cam/RegionNodeStage-finale-rail.diff): SkyRunLens.skyRailPose per walk.
// Validation (hard): harness writer == followPose(feet,yaw,w,h,followLookUp('skycity',99)) and its 390x844 margin is 0.144 (sane).
// HARD per walk, 7 screens: end margin ≥ 0.08, end head+chest seen (real mesh, star ring incl.), face not under the WeChat capsule, end 1.1 m
//  clearance 0 hits, NO frame of the walk / approach within 0.35 m (⇒ approach start clearance ≥ 0.35 m), blended lens ≤ 0.35 m/frame and
//  ≤ 120 °/s (LENS_SMOOTH.yawWalkDegS).
process.env.POLICY='rail'/* full9c: every played walk rides its rail (S4>S6: last run eases onto the stand shot) */;
const ev=require('./sky_run_lens_eval.cjs'),X=require('./explore-stage-harness.cjs'),{rig,H,S}=X,E=H.load(S('region/ExploreCameraCore.ts')),LS=H.load(S('region/LensSmooth.ts')),RLx=H.load(S('region/SkyRunLens.ts'));
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
(async()=>{const Rg=rig('skycity','S3',[0.2,0.034,-27.8],{modelAt:[0,0,0]}),st=Rg.st;st.yaw=()=>-145.6*Math.PI/180;st.viewport=()=>({w:390,h:844});st.lens='FollowWalk';st.tickLens(1/60);
 const v0=Rg.cam(),f0=E.followPose([0.2,0.034,-27.8],-145.6*Math.PI/180,390,844,E.followLookUp('skycity',99)),m0=LS.herMargin(v0.position,v0.target,v0.fovVerticalDeg,[0.2,0.034,-27.8],[[390,844]]);
 const vOk=d3(v0.position,f0.position)<1e-9&&d3(v0.target,f0.target)<1e-9&&m0>=0.08;
 const walks=(process.env.QF_ENDSHOT_WALKS||'S1>S2,S2>S3,S3>S4,S4>S6').split(',').map(w=>w.split('>')),res=await ev(walks),rows=[];
 for(const [k,v] of Object.entries(res)){const s=Object.values(v);const r={walk:k,endMarginMin:Math.min(...s.map(x=>x.endMargin)),endHiddenScreens:s.filter(x=>x.endHidden).length,capOnFace:s.some(x=>x.capOnFace),endC11Hits:Math.max(...s.map(x=>x.endC11)),framesWithin035:Math.max(...s.map(x=>x.framesWithin035)),maxStepM:Math.max(...s.map(x=>x.maxStepM)),yawPeakDegS:Math.max(...s.map(x=>x.yawPeakDegS)),walkMarginMin:Math.min(...s.map(x=>x.minMarginWalk)),longestFaceHiddenS:Math.max(...s.map(x=>x.longestFaceHiddenS)),longestChestHiddenS:Math.max(...s.map(x=>x.longestChestHiddenS))};
  r.ok=r.endMarginMin>=0.08&&r.endHiddenScreens===0&&!r.capOnFace&&r.endC11Hits===0&&r.framesWithin035===0&&r.maxStepM<=0.35&&r.yawPeakDegS<=LS.LENS_SMOOTH.yawWalkDegS;rows.push(r);}
 const ok=vOk&&rows.every(r=>r.ok);console.log(JSON.stringify({test:'sky-walk-endshots',validation:{writerEqualsFollowPose:vOk,margin390:+m0.toFixed(3)},railApproachM:RLx.SKY_RAIL_APPROACH_M??1.05,rows,status:ok?'PASS':'FAIL'},null,1));process.exit(ok?0:1);})().catch(e=>{console.error(e);process.exit(1);});
