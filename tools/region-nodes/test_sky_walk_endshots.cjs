'use strict';
// 运镜bot full9c: skycity walk END shots after NodeWalker ends on the node (GGbot cdf61cc5/ae7ea56d). The lens is the REAL runtime
// writer: RegionNodeStage.tickLens (transpiled by explore-stage-harness) in FollowWalk with the orbit not engaged — the reward / finale
// walk branch: followPose(girl, yaw, w, h, followLookUp('skycity', 99)) → occlude() (skycity: unguarded) → writePose. Skycity model frame
// (rigid placement: followPose is equivariant), mesh = route-legs skyJ (Cw = skyMooring5a placement).
// V (validation, hard): the harness writer equals followPose(...,0) and the t02/playFinale start pose followPose(S6,−145.6°,8) is the
//   same function t02 F4 starts from; margins are the real frame (lookUp 0 → 0.144 on 390x844, not the lookUp-8 −0.275 artifact).
// NOT IN THE SUITE YET: fails today on S3>S4 (star ring hides her, before and after) and S4>S6 (palette block) — see the full9c endshot report.
// HARD per walk (planWalk, every skycity pair) on 7 screens at the end shot: herMargin ≥ 0.08, head + chest seen (real mesh), face not
//   under the WeChat capsule, 26-ray 1.1 m clearance 0 hits; over the last run (10 Hz) no lens within 0.35 m of the mesh;
//   yaw: the final-run heading change ≤ the largest turn the same walk set had before (QF_ENDSHOT_MAXTURN, default 135°).
const X=require('./explore-stage-harness.cjs');const {rig,H,S}=X;const NW=H.load(S('region/NodeWalker.ts')),RN=H.load(S('region/RegionNodes.ts')),E=H.load(S('region/ExploreCameraCore.ts')),
 LS=H.load(S('region/LensSmooth.ts')),F=H.load(S('region/SkyFinaleShot.ts')),SW=H.load(S('region/SkyWalkShot.ts')),TS=H.load(S('region/TransitionStaging.ts'));
const RL=require('../journey-integration/route/route-legs.cjs');const M=TS.TRANSITION_STAGING.skyMooring5a,SCR=LS.LENS_SMOOTH.screens;
const D26=[];for(const x of[-1,0,1])for(const y of[-1,0,1])for(const z of[-1,0,1])if(x||y||z){const L=Math.hypot(x,y,z);D26.push([x/L,y/L,z/L]);}
const R=180/Math.PI,wrap=a=>((a+540)%360)-180,d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const lensAt=(feet,yawRad,w,h)=>{const Rg=rig('skycity','S3',feet.slice(),{modelAt:[0,0,0]}),st=Rg.st;st.yaw=()=>yawRad;st.viewport=()=>({w,h});st.lens='FollowWalk';st.exploring=true;st.tickLens(1/60);return Rg.cam();};
(async()=>{const geo=await RL.geometry(),W=p=>SW.skyLocalToWorld(M,p),hit=(a,b)=>RL.hit(geo.skyJ,W(a),W(b));
 // V: real writer == followPose(...,0); lookUp-0 margin sane
 const v0=lensAt([0.2,0.034,-27.8],-145.6/R,390,844),f0=E.followPose([0.2,0.034,-27.8],-145.6/R,390,844,E.followLookUp('skycity',99));
 const vOk=d3(v0.position,f0.position)<1e-9&&d3(v0.target,f0.target)<1e-9,mSane=LS.herMargin(v0.position,v0.target,v0.fovVerticalDeg,[0.2,0.034,-27.8],[[390,844]]);
 const keys=RN.REGION_NODES.skycity.nodes.map(n=>n.key),rows=[],maxTurn=Number(process.env.QF_ENDSHOT_MAXTURN||135);
 for(const a of keys)for(const b of keys){if(a===b)continue;let pl;try{pl=NW.planWalk('skycity',a,b);}catch{continue;}if(!pl?.segments?.length)continue;
  const sg=pl.segments,last=sg[sg.length-1].path,feet=last[last.length-1],pa=last[last.length-2],yaw=Math.atan2(feet[0]-pa[0],feet[2]-pa[2]);
  const prev=sg.length>1?sg[sg.length-2].path:null,pp=prev?prev[prev.length-2]:null,turn=pp?Math.abs(wrap((yaw-Math.atan2(pa[0]-pp[0],pa[2]-pp[2]))*R)):0;
  const scr=SCR.map(([w,h])=>{const p=lensAt(feet,yaw,w,h),m=LS.herMargin(p.position,p.target,p.fovVerticalDeg,feet,[[w,h]]),fa=[feet[0],feet[1]+1.5,feet[2]],v=F.ndc(p.position,p.target,p.fovVerticalDeg,w,h,fa),px=v?(v[0]+1)/2*w:-1,py=v?(1-v[1])/2*h:-1;
   return {screen:w+'x'+h,m:+m.toFixed(3),cap:!!v&&px>=w-7-87-4&&py<=92,head:!!hit(p.position,[feet[0],feet[1]+1.45,feet[2]]),chest:!!hit(p.position,[feet[0],feet[1]+1.05,feet[2]]),c11:D26.filter(d=>hit(p.position,p.position.map((q,i)=>q+d[i]*1.1))).length};});
  let near=0;const L=NW.pathLength(last);for(let s=0;s<=L;s+=0.12){const q=NW.pointAlong(last,s),p=lensAt(q,yaw,390,844);near+=D26.some(d=>hit(p.position,p.position.map((x,i)=>x+d[i]*0.35)))?1:0;}
  const r={walk:a+'>'+b,feet:feet.map(v=>+v.toFixed(3)),yawDeg:+(yaw*R).toFixed(1),lastTurnDeg:+turn.toFixed(1),minMargin:Math.min(...scr.map(s=>s.m)),capOnFace:scr.some(s=>s.cap),occluded:scr.filter(s=>s.head||s.chest).map(s=>s.screen),c11Hits:Math.max(...scr.map(s=>s.c11)),framesWithin035:near};
  r.ok=r.minMargin>=0.08&&!r.capOnFace&&!r.occluded.length&&r.c11Hits===0&&r.framesWithin035===0&&r.lastTurnDeg<=maxTurn;rows.push(r);}
 /* gated = the skycity walks the runtime plays with this writer (walkPair mainline-09..12 + playFinale); the rest are report-only (QF_ENDSHOT_WALKS=all) */const only=process.env.QF_ENDSHOT_WALKS==='all'?null:(process.env.QF_ENDSHOT_WALKS||'S1>S2,S2>S3,S3>S4,S4>S6').split(','),gated=only?rows.filter(r=>only.includes(r.walk)):rows;
 const ok=vOk&&mSane>=0.08&&gated.every(r=>r.ok);
 console.log(JSON.stringify({test:'sky-walk-endshots',validation:{writerEqualsFollowPose:vOk,lookUp0Margin390:+mSane.toFixed(3),t02StartIs:'followPose(S6,-145.6°,390x844,8) (finale blend target, t02 F4 from)'},rows,failing:gated.filter(r=>!r.ok).map(r=>r.walk),status:ok?'PASS':'FAIL'},null,1));process.exit(ok?0:1);})().catch(e=>{console.error(e);process.exit(1);});
