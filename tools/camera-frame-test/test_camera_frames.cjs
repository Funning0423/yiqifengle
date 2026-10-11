#!/usr/bin/env node
'use strict';
/* T2/T3a(+) CPU frame test. Runs the REAL WorldFlow + routes + camera tracks (flow_sim.cjs) for home -> island -> home
 * at 60 fps and checks EVERY frame:
 *   in-frame   hat/feet/0.6 m body box inside the no-HUD safe area (586x1266; top = capsule bottom + 4% H)
 *   collision  lens clearance vs decoded GLB triangles (>= 0.15 m; cameraHome's approved 0.08 m excepted) and
 *              line of sight lens -> head / chest / feet
 *   continuity no hard cut (per-frame turn <= 15 deg, move <= 0.5 m), bounded angular / linear acceleration
 *   settle     arrival frames equal cameraIsland / cameraHome exactly, zero speed before restore()
 *   lighting   interior weight continuous (per-frame step <= 0.05), 0 on island, 1 at home
 * Usage: node test_camera_frames.cjs [--json out.json] [--no-geometry]
 * Exit 0 = all checks pass. Engine-free: says nothing about shaders/materials/frame time (native capture needed). */
const S=require('./flow_sim.cjs'),K=require('./metrics.cjs'),G=require('./glb_geometry.cjs'),fs=require('fs');
const args=process.argv.slice(2),jsonOut=args.includes('--json')?args[args.indexOf('--json')+1]:null;
const LIMITS={clearanceM:.15,homeClearanceM:.07,cutTurnDeg:15,cutMoveM:.5,maxAngAccel:360,maxLinAccel:15,maxWeightStep:.05,settleV:.05,settleW:.5};
(async()=>{
  const env=S.create(),{C,cfg}=env,run=await S.run(env),F=run.frames,dt=run.dt;
  const checks=[];const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});};
  // --- settle / stable poses
  const same=(a,b)=>Math.max(...a.position.map((v,i)=>Math.abs(v-b.position[i])),...a.rotation.map((v,i)=>Math.abs(v-b.rotation[i])),Math.abs(a.fovVerticalDeg-b.fovVerticalDeg));
  for(const [place,pose] of [['island',cfg.cameraIsland],['home',cfg.cameraHome]]){
    const i=F.findIndex((f,k)=>k>0&&f.state===place&&F[k-1].state!==place);const want=C.fromLookAt(pose,F[i]?.cam.fovVerticalDeg);
    const d=i>0?same(F[i].cam,{position:want.position,rotation:want.rotation,fovVerticalDeg:want.fovVerticalDeg??F[i].cam.fovVerticalDeg}):Infinity;
    const kin=K.kinematics(C,F.slice(Math.max(0,i-1),i+4),dt);const vmax=Math.max(...kin.map(k=>k.v)),wmax=Math.max(...kin.map(k=>k.w));
    check('settle:'+place,i>0&&d<1e-6&&vmax<=LIMITS.settleV&&wmax<=LIMITS.settleW,{frame:i,t:i>0?+F[i].t.toFixed(3):null,poseError:d,lastSpeed:+vmax.toFixed(4),lastAngSpeed:+wmax.toFixed(3)});
  }
  // --- framing on every frame (stable home/island are approved compositions: checked against the physical screen)
  const perState={};let worst={m:1};const out=[];
  F.forEach((f,i)=>{const m=K.framing(C,f);const stable=f.state==='home'||f.state==='island';
    const mm=m.behind?-1:Math.min(m.topMargin+(stable?K.SAFE.topFrac:0),m.bottomMargin+(stable?K.SAFE.bottomFrac:0),m.sideMargin+(stable?K.SAFE.sideFrac:0));
    const s=perState[f.state]||(perState[f.state]={frames:0,minMargin:1,outFrames:0});s.frames++;s.minMargin=Math.min(s.minMargin,+mm.toFixed(4));if(mm<0){s.outFrames++;out.push(i);}
    if(mm<worst.m)worst={m:+mm.toFixed(4),frame:i,t:+f.t.toFixed(3),state:f.state,hatTopPx:+m.hatTopPx.toFixed(1),feetPx:+m.feetPx.toFixed(1)};});
  check('in-frame',out.length===0,{outFrames:out.length,worst,perState});
  // --- continuity
  const kin=K.kinematics(C,F,dt);let cut=null,maxDw=0,maxDv=0,atW=null,atV=null;
  for(const k of kin){const turn=k.w*dt,move=k.v*dt;if((turn>LIMITS.cutTurnDeg||move>LIMITS.cutMoveM)&&!cut)cut={frame:k.i,t:+F[k.i].t.toFixed(3),turnDeg:+turn.toFixed(2),moveM:+move.toFixed(3)};
    if(Math.abs(k.dw)>maxDw){maxDw=Math.abs(k.dw);atW={frame:k.i,t:+F[k.i].t.toFixed(3),state:F[k.i].state};}if(Math.abs(k.dv)>maxDv){maxDv=Math.abs(k.dv);atV={frame:k.i,t:+F[k.i].t.toFixed(3),state:F[k.i].state};}}
  check('no-hard-cut',!cut,cut||{maxTurnPerFrameDeg:+(Math.max(...kin.map(k=>k.w))*dt).toFixed(3),maxMovePerFrameM:+(Math.max(...kin.map(k=>k.v))*dt).toFixed(4)});
  check('angular-velocity-continuity',maxDw<=LIMITS.maxAngAccel,{maxAngAccelDegS2:+maxDw.toFixed(1),limit:LIMITS.maxAngAccel,at:atW});
  check('linear-velocity-continuity',maxDv<=LIMITS.maxLinAccel,{maxLinAccelMS2:+maxDv.toFixed(2),limit:LIMITS.maxLinAccel,at:atV});
  // --- lighting
  let wStep=0,wAt=null;for(let i=1;i<F.length;i++){const d=Math.abs(F[i].weight-F[i-1].weight);if(d>wStep){wStep=d;wAt={frame:i,t:+F[i].t.toFixed(3),state:F[i].state};}}
  const island=F.filter(f=>f.state==='island'),home=F.filter(f=>f.state==='home');
  check('lighting-continuity',wStep<=LIMITS.maxWeightStep&&island.every(f=>f.weight===0)&&home.every(f=>f.weight===1),{maxWeightStepPerFrame:+wStep.toFixed(4),at:wAt,islandWeight:[...new Set(island.map(f=>f.weight))],homeWeight:[...new Set(home.map(f=>f.weight))]});
  // --- collision (decoded GLB)
  if(!args.includes('--no-geometry')){const geo=await G.decode();
    if(!geo)check('collision',false,{skipped:'draco3d not found: cd tools/camera-frame-test && npm i --no-save draco3d@1.5.7 (or set DRACO3D)'});
    else{const I=G.index(geo),hp=cfg.cameraHome.position;let minClr={d:1},occl=[],near=null;
      F.forEach((f,i)=>{if(i%2)return;const p=f.cam.position,atHome=Math.hypot(p[0]-hp[0],p[1]-hp[1],p[2]-hp[2])<.25,c=I.clearance(p);const lim=atHome?LIMITS.homeClearanceM:LIMITS.clearanceM;
        if(c.d<lim&&!near)near={frame:i,t:+f.t.toFixed(3),state:f.state,clearance:+c.d.toFixed(3),mesh:c.who};if(!atHome&&c.d<minClr.d)minClr={d:+c.d.toFixed(3),mesh:c.who,frame:i,state:f.state};
        const r=f.root;for(const [part,h] of [['head',1.6],['chest',1.0],['feet',.1]]){const hit=I.occluded(p,[r[0],r[1]+h,r[2]]);if(hit)occl.push({frame:i,t:+f.t.toFixed(3),state:f.state,part,mesh:hit});}});
      check('collision:lens-clearance',!near,{firstViolation:near,minOutsideHome:minClr,limits:{clearanceM:LIMITS.clearanceM,homeM:LIMITS.homeClearanceM},glb:geo.sha.slice(0,16),decoder:geo.decoder});
      const head=occl.filter(o=>o.part==='head');
      check('collision:line-of-sight',head.length===0,{headOccludedSamples:head.length,anyOccludedSamples:occl.length,first:occl.slice(0,6),byState:occl.reduce((a,o)=>(a[o.state+':'+o.part]=(a[o.state+':'+o.part]||0)+1,a),{})});}}
  const timeline=run.states.map(s=>({t:+(s.frame*dt).toFixed(3),state:s.state}));
  const report={ok:checks.every(c=>c.ok),frames:F.length,fps:1/dt,timeline,checks,limits:LIMITS,safeArea:K.SAFE,screen:K.SCREEN,
    scope:'CPU simulation of real flow/routes/tracks; native rendering (materials, shaders, frame pacing) is out of scope.'};
  if(jsonOut)fs.writeFileSync(jsonOut,JSON.stringify(report,null,1));
  for(const c of checks)console.log((c.ok?'PASS ':'FAIL ')+c.name.padEnd(30)+JSON.stringify(c.detail));
  console.log(report.ok?'ALL PASS':'FAILED',F.length,'frames');process.exitCode=report.ok?0:1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=2;});
