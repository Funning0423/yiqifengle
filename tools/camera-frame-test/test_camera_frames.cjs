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
const T9=require('./t9_props.cjs'),S=require('./flow_sim.cjs'),K=require('./metrics.cjs'),G=require('./glb_geometry.cjs'),LR=require('./lens_rays.cjs'),A=require('./glb_anim.cjs'),fs=require('fs');
const args=process.argv.slice(2),jsonOut=args.includes('--json')?args[args.indexOf('--json')+1]:null;
// --walk-profile accel: synthetic walk-duration contract (what 角色动画bot will plug in): walkDuration = L/0.7 + 0.3 s and a
// trapezoidal speed profile (0.3 s linear accel and decel); the sim character reports walkProgress() = distance fraction.
// --no-walk-progress: same profile but the character reports nothing (camera falls back to time) - shows why it matters.
const RAMP=.3,V=.7,pathLen=p=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]);return L;};
const wp=args.includes('--walk-profile')?args[args.indexOf('--walk-profile')+1]:null;
// 'accel': 0.3 s ramp from rest and into a stop on EVERY walk action (worst case). 'chained': ramps only where she really starts
// from / comes to rest - no ramp where one walk action continues straight into the next (outCrossing->toIsland, toThreshold->
// inCrossing->toSeat), which is what a continuous walk animation does.
// Rests in the real flow (WorldFlowCore): she stops at the door (open) and before closing it; outCrossing->toIsland and
// toThreshold->inCrossing are continuous walks split only for camera/state bookkeeping.
const NO_RAMP_IN=['toIsland','inCrossing'],NO_RAMP_OUT=['outCrossing','toThreshold'];let named=[];const same=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2])<1e-4;
const nameOf=path=>{const n=named.find(([,q])=>q.length===path.length&&same(q[0],path[0])&&same(q[q.length-1],path[path.length-1]));return n?n[0]:null;};
const ramps=path=>{if(wp!=='chained')return [true,true];const n=nameOf(path);return [!NO_RAMP_IN.includes(n),!NO_RAMP_OUT.includes(n)];};
const profile=(q,T,path)=>{const [ri,ro]=ramps(path),r=Math.min(RAMP,T/2),ri_=ri?r:0,ro_=ro?r:0,vm=1/(T-(ri_+ro_)/2),t=q*T;
  if(t<ri_)return vm*t*t/(2*ri_);if(t>T-ro_){const u=T-t;return 1-vm*u*u/(2*ro_);}return vm*(t-ri_/2);};
const envOpts=wp==='accel'||wp==='chained'?{walkDuration:p=>{const [ri,ro]=ramps(p);return pathLen(p)/V+RAMP*((ri?1:0)+(ro?1:0))/2;},walkProfile:profile,reportWalkProgress:!args.includes('--no-walk-progress')}:{};
if(args.includes('--real-walk'))envOpts.realWalk=true;
if(envOpts.walkDuration)console.log('walk profile: synthetic',wp,'(0.3 s linear accel/decel ramps, walkDuration = L/0.7 + ramp/2 per ramp), walkProgress reported:',envOpts.reportWalkProgress);
const LIMITS={clearanceM:.15,roomLookViewM:.45,homeClearanceM:.07,cutTurnDeg:15,cutMoveM:.5,maxAngAccel:360,maxLinAccel:15,maxWeightStep:.05,settleV:.05,settleW:.5,
  // return-entry span: 0.75 deg/frame = 45 deg/s, 0.025 m/frame = 1.5 m/s, fov 0.15 deg/frame = 9 deg/s; standstill = v < 0.02 m/s and w < 0.5 deg/s
  entry:{turnDegPerFrame:.75,moveMPerFrame:.025,fovDegPerFrame:.15,angAccel:120,linAccel:3,stillV:.02,stillW:.5,maxStillS:.1,settleS:.05,
    // follow (Mac r4): lens within 45 deg of straight behind her, distance change <= 0.015 m/frame, follow starts >= 3 s before crossing-in
    follow:{maxOffBehindDeg:45,maxDistStepM:.015,minLeadS:3}},
  // return-brightness (light_proxy B in [0,1]): per-1/30 s step, and the swing (hysteresis) allowed at the door / over the return
  brightness:{maxStep:.04,maxEntrySwing:.1,maxReturnSwing:.1}};
(async()=>{
  if(envOpts.walkDuration){const c0=S.create().cfg;for(const k of ['toDoor','outCrossing','toIsland','toThreshold','inCrossing','toSeat'])if(c0[k])named.push([k,c0[k]]);}
  const env=S.create(envOpts),{C,cfg}=env,run=await S.run(env),F=run.frames,dt=run.dt;
  const checks=[];const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});};
  // World startup builds this rail (WorldFlowComponent.initialize). A throw there is the load-failure screen.
  {let err=null;try{const rail=env.M.IslandRail.createIslandRail(cfg),far=rail.pose();rail.nudge(-0.24,1);const mid=rail.pose();rail.nudge(-2,1);const near=rail.pose();rail.restore(1);const back=rail.pose();
    const cap=cfg.cameraIsland.position[1]+1e-3,lower=mid.position[1]<=far.position[1]+1e-3&&near.position[1]<=far.position[1]-1&&near.position[1]<=mid.position[1]+1e-3;
    const backOk=Math.abs(back.position[0]-far.position[0])<1e-4&&Math.abs(back.position[1]-far.position[1])<1e-4&&Math.abs(back.position[2]-far.position[2])<1e-4;
    if(!(lower&&backOk&&far.position[1]<=cap&&mid.position[1]<=cap&&near.position[1]<=cap))err='pull does not lower into the close-up and return to the settled wide shot';
  }catch(e){err=String(e&&e.message||e);}check('island-pull-startup',!err,{error:err});}
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
  const hp0=cfg.cameraHome.position;
  F.forEach((f,i)=>{const m=K.framing(C,f);const atHomePose=Math.hypot(f.cam.position[0]-hp0[0],f.cam.position[1]-hp0[1],f.cam.position[2]-hp0[2])<.25;
    // approved stable compositions (and lens within 0.25 m of cameraHome, same radius as the clearance exception) are checked against the physical screen
    const stable=f.state==='home'||f.state==='island'||atHomePose;
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
  // T9 props (GGbot 1653f02 signpost + beach palms) are merged when the T9 worktree is present (T9_ROOT); reported either way.
  let exitGeo=null; // shared with the B5.4.1 exit clearance check (one decode: heap)
  if(!args.includes('--no-geometry')){const base=await G.decode(),geoT9=base&&!args.includes('--no-t9')?await T9.merged(base):null,geo=geoT9||base;exitGeo=geo;
    console.log('geometry: island GLB'+(geoT9?' + T9 props '+T9.T9_SHA+' ('+T9.dir()+')':' (T9 props NOT loaded)'));
    if(!geo)check('collision',false,{skipped:'draco3d not found: cd tools/camera-frame-test && npm i --no-save draco3d@1.5.7 (or set DRACO3D)'});
    else{const I=G.index(geo),hp=cfg.cameraHome.position;let minClr={d:1},occl=[],near=null;
      F.forEach((f,i)=>{if(i%2)return;const p=f.cam.position,atHome=Math.hypot(p[0]-hp[0],p[1]-hp[1],p[2]-hp[2])<.25,c=I.clearance(p);const lim=atHome?LIMITS.homeClearanceM:LIMITS.clearanceM;
        if(c.d<lim&&!near)near={frame:i,t:+f.t.toFixed(3),state:f.state,clearance:+c.d.toFixed(3),mesh:c.who};if(!atHome&&c.d<minClr.d)minClr={d:+c.d.toFixed(3),mesh:c.who,frame:i,state:f.state};
        const r=f.root;for(const [part,h] of [['head',1.6],['chest',1.0],['feet',.1]]){const hit=I.occluded(p,[r[0],r[1]+h,r[2]]);if(hit)occl.push({frame:i,t:+f.t.toFixed(3),state:f.state,part,mesh:hit});}});
      check('collision:lens-clearance',!near,{firstViolation:near,minOutsideHome:minClr,limits:{clearanceM:LIMITS.clearanceM,homeM:LIMITS.homeClearanceM},glb:geo.sha.slice(0,16),decoder:geo.decoder});
      // T2+ room camera: every home variant lens must be INSIDE the room, no cutaway: up/down rays hit ceiling/floor and
      // >= 12 of 16 horizontal rays hit room/tower geometry within 12 m (window/door openings may take <= 25% of the
      // horizon), plus wall clearance >= homeClearanceM. Active variant gates; others reported.
      {const V=env.M.RegionCameraData.REGION_CAMERA,room=/^env_(interior|lighthouse)/;const res={};
        for(const [name,v] of Object.entries(V.home.variants)){if(!v)continue;const p=v.position;let open=[];
          const dirs=Array.from({length:16},(_,k)=>[Math.sin(k*Math.PI/8),0,Math.cos(k*Math.PI/8)]);
          for(const d of dirs){const hit=I.occluded(p,[p[0]+d[0]*12,p[1],p[2]+d[2]*12]);if(!hit||!room.test(hit))open.push(hit||'open');}
          const up=I.occluded(p,[p[0],p[1]+12,p[2]]),down=I.occluded(p,[p[0],p[1]-12,p[2]]),closed=!!up&&room.test(up)&&!!down&&room.test(down);
          const c=I.clearance(p);res[name]={inside:closed&&open.length<=4,openRays:open.length,openThrough:[...new Set(open)],ceilingFloor:closed,clearanceM:+c.d.toFixed(3),nearest:c.who,fov:v.fovVerticalDeg,fovInContract:v.fovVerticalDeg<=75};}
        const active=res[V.homePoseSource];check('room-camera-inside',!!active&&active.inside&&active.clearanceM>=LIMITS.homeClearanceM,{active:V.homePoseSource,variants:res});}
      // head AND chest must be visible on every sample (palms, T9 props, island); feet reported only.
      const head=occl.filter(o=>o.part==='head'),chest=occl.filter(o=>o.part==='chest'),hc=head.concat(chest);
      check('collision:line-of-sight',hc.length===0,{headOccludedSamples:head.length,chestOccludedSamples:chest.length,anyOccludedSamples:occl.length,first:hc.slice(0,6),byMesh:hc.reduce((a,o)=>(a[o.state+':'+o.part+':'+o.mesh]=(a[o.state+':'+o.part+':'+o.mesh]||0)+1,a),{}),feetOccluded:occl.length-hc.length,t9Props:!!geoT9});
      // Lens coverage (Mac round 2, f0f3a13: palm trunk swept across the LENS): 16x32 frustum rays every frame; any ray hitting
      // non-architecture geometry (props, palms, fences, bushes, T9) within LR.NEAR_M (1.0 m) fails. Room/tower architecture is
      // reported only (the lens lives in the room and crosses the door frame; covered by lens-clearance). Coverage within 2.5 m reported.
      {const ph=f=>f.state==='crossing-out'?'outbound':f.state==='island'?'islandIdle':f.state==='walking-home'||f.state==='crossing-in'?'return':'interior';
        const R={},hits=[];const add=(k,s,f,i)=>{const b=R[k]||(R[k]={frames:0,nearPropFrames:0,nearPropRays:0,nearArchFrames:0,maxCoverWithin2_5m:0,maxPropCoverWithin2_5m:0,meshes:{}});b.frames++;
          if(s.nearProps){b.nearPropFrames++;b.nearPropRays+=s.nearProps;if(hits.length<8)hits.push({frame:i,t:f?+f.t.toFixed(3):null,phase:k,near:s.near});}if(s.nearArch)b.nearArchFrames++;
          b.maxCoverWithin2_5m=Math.max(b.maxCoverWithin2_5m,+s.cover.toFixed(3));b.maxPropCoverWithin2_5m=Math.max(b.maxPropCoverWithin2_5m,+s.coverProps.toFixed(3));for(const m in s.near)b.meshes[m]=(b.meshes[m]||0)+1;};
        // the door leaf is dynamic (not in the GLB ray index): tested analytically at its per-frame angle (lens_rays.doorQuad)
        let leafMin={d:9},leafBad=null;F.forEach((f,i)=>{const q=LR.doorQuad(f.door,cfg.openDeg);add(ph(f),LR.sample(C,I,f.cam,K.SCREEN.aspect,[q]),f,i);
          const ld=LR.quadDist(f.cam.position,q);if(ld<leafMin.d)leafMin={d:+ld.toFixed(3),frame:i,t:+f.t.toFixed(3),state:f.state,door:+f.door.toFixed(2)};if(ld<LIMITS.clearanceM&&!leafBad)leafBad=leafMin;});
        check('collision:door-leaf-clearance',!leafBad,{minLensToLeafM:leafMin,limitM:LIMITS.clearanceM,note:'lens vs the posed door leaf quad, every frame'});
        {const q=LR.doorQuad(cfg.doorDrift?cfg.doorDrift.islandDeg:cfg.openDeg,cfg.openDeg);add('islandIdlePose',LR.sample(C,I,C.fromLookAt(cfg.cameraIsland,cfg.cameraIsland.fovVerticalDeg),K.SCREEN.aspect,[q]),null,-1);}
        check('collision:lens-near-geometry',hits.length===0,{nearM:LR.NEAR_M,coverM:LR.COVER_M,grid:LR.COLS+'x'+LR.ROWS,sampling:'every frame',archExempt:String(LR.ARCH),firstHits:hits,phases:R});}
      // Animated movers (Mac round 3 night gull wing on the return crane-down): every frame vs the swept envelope of the GLB
      // idle_loop (all phases; glb_anim.sweep): flying gulls within LR.FLYER_NEAR_M on any frustum ray or within
      // LR.FLYER_CLEAR_M of the lens fail; palm/animal sway within LR.NEAR_M on any ray fails (outside the room).
      {const sw=await A.sweep();if(!sw)check('collision:lens-near-movers',false,{skipped:'draco3d not found'});else{
        const If=G.index(sw,{ignore:/^(?!env_anim_seagull_fly)/}),Is=G.index(sw,{ignore:/^env_anim_seagull_fly/});let flyMin={d:9},bad=[],sway=[],maxFly=0;
        F.forEach((f,i)=>{const s=LR.sampleMovers(C,If,Is,f.cam,K.SCREEN.aspect),c=If.clearance(f.cam.position,LR.FLYER_CLEAR_M+1);
          if(c.d<flyMin.d)flyMin={d:+c.d.toFixed(3),mesh:c.who,frame:i,t:+f.t.toFixed(3),state:f.state};maxFly=Math.max(maxFly,s.flyerRays);
          if((s.flyerRays||c.d<LR.FLYER_CLEAR_M)&&bad.length<8)bad.push({frame:i,t:+f.t.toFixed(3),state:f.state,flyerRays:s.flyerRays,lensToOrbitM:+c.d.toFixed(3),who:s.who});
          if(s.swayRays&&sway.length<8)sway.push({frame:i,t:+f.t.toFixed(3),state:f.state,swayRays:s.swayRays,who:s.who});});
        check('collision:lens-near-movers',bad.length===0&&sway.length===0,{flyerNearM:LR.FLYER_NEAR_M,flyerClearM:LR.FLYER_CLEAR_M,swayNearM:LR.NEAR_M,clip:sw.clip,loopS:+sw.seconds.toFixed(3),
          phases:sw.phases,union:'all phases',movers:sw.names,minLensToFlyerOrbit:flyMin,maxFlyerRaysPerFrame:maxFly,flyerViolations:bad,swayViolations:sway,sampling:'every frame'});}}
      // Return brightness (Funning, Mac r4: "人从外面回到房间的时候，画面不能一亮一暗"): light_proxy.cjs replays the REAL
      // RoomLightingRig per frame (w, exterior key, day/night photometry, layer switches) and shades a 9x19 frustum grid of
      // the decoded GLB (shadow rays x shadowSaturation, hemisphere ambient, door leaf, HOME layers hide the exterior) at a
      // fixed exposure -> mean tone-mapped brightness B in [0,1], every 2nd frame from the first return frame to the home
      // settle (+0.5 s), day AND night. FAIL when
      //   - any step |B(i) - B(i-1)| (1/30 s) > LIMITS.brightness.maxStep (a pop: layer switch, light jump, door/occluder), or
      //   - from 1 s before crossing-in to the home settle B is not monotone within maxEntrySwing (smoothed over 5 samples):
      //     any dip that recovers or bump that falls back by >= maxEntrySwing (the "一亮一暗" at the door), or
      //   - over the whole return any such swing >= maxReturnSwing (int/v1 484d941 before this change: the R3 exterior-key sun
      //     swing on the walk home, -0.19 then +0.13 -> FAIL; after: largest swing 0.08, the seated-room content at the sit).
      // The proxy has no textures, so it overstates content swings indoors (Blender with the same rig state: <= 0.03).
      // Proxy of the picture (uniform albedo, no textures/GI): Blender renders with the same rig state are the acceptance
      // look (previews/运镜bot/return-follow).
      {const P=require('./light_proxy.cjs'),B=LIMITS.brightness,Ih={all:I,home:G.index(geo,{ignore:/^(?!env_(interior|int_|lighthouse_ext|window_blind))/})};
        const ci=F.findIndex(f=>f.state==='crossing-in'),hm=F.findIndex((f,k)=>k>ci&&f.state==='home'),r0=F.findIndex(f=>f.op==='returnHome'),end=Math.min(F.length-1,hm+Math.round(.5/dt));
        const res={};let ok=r0>=0&&ci>r0&&hm>ci;
        for(const night of [false,true]){const Ls=P.lights(F,night),idx=[];for(let i=r0;i<=end;i+=2)idx.push(i);
          const b=idx.map(i=>P.frame(C,Ih,F[i],Ls[i],K.SCREEN.aspect,cfg.openDeg));let step={v:0};
          for(let k=1;k<b.length;k++){const d=Math.abs(b[k]-b[k-1]);if(d>step.v)step={v:+d.toFixed(4),t:+F[idx[k]].t.toFixed(3),state:F[idx[k]].state};}
          const e0=idx.findIndex(i=>i>=ci-Math.round(1/dt)),e1=idx.findIndex(i=>i>=hm),eb=b.slice(e0,e1+1);
          const se=P.swings(eb,B.maxEntrySwing,5),sr=P.swings(b,B.maxReturnSwing,5),T=(sw,o)=>sw.turns.map(t=>({t:+F[idx[o+t.i]].t.toFixed(3),state:F[idx[o+t.i]].state,dir:t.dir,B:+t.v.toFixed(3)}));
          const mode=night?'night':'day',pass=step.v<=B.maxStep&&se.turns.length===0&&sr.turns.length===0;ok=ok&&pass;
          const q=k=>+b[Math.max(0,Math.min(b.length-1,k))].toFixed(3);
          res[mode]={pass,maxStep:step,entrySwings:T(se,e0),returnSwings:T(sr,0),B:{returnStart:q(0),crossingInMinus1s:q(e0),home:q(e1),min:+Math.min.apply(null,b).toFixed(3),max:+Math.max.apply(null,b).toFixed(3)},samples:b.length};}
        check('return-brightness',ok,{limits:B,sampling:'every 2nd frame, '+P.COLS+'x'+P.ROWS+' rays',...res});}
      // Room explore slide (Mac round 3 r1-s3/r1-s5: lens looked into the stair post / wall at the drag ends): RoomLook over the
      // FULL yaw x pitch range (yaw every 1 deg + both ends, pitch every 3 deg + both ends): every 16x32 frustum ray must meet
      // geometry no nearer than LIMITS.roomLookViewM; the door handle must still be on screen (RoomLook.door) somewhere in range.
      {const RL=env.M.RoomLook||require('./load_ts.cjs').load(['CameraPose','RegionCameraData','RoomLook']).RoomLook,RLC=RL.ROOM_LOOK,home=env.M.RegionCameraData.homePoseEntry();
        const handle=env.M.FirstsliceFacts.FIRSTSLICE.anchors.door_handle.position,lim=LIMITS.roomLookViewM;let worst={d:9},doorYaws=[],bad=[];
        const R=1.0,near=cam=>{const p=cam.position;let mn=9,who=null;for(const d of LR.rays(C,cam,K.SCREEN.aspect)){if(!I.occluded(p,[p[0]+d[0]*(R+.05),p[1]+d[1]*(R+.05),p[2]+d[2]*(R+.05)]))continue;
          for(let r=.05;r<=Math.min(R,mn)+1e-9;r+=.025){const h=I.occluded(p,[p[0]+d[0]*(r+.05),p[1]+d[1]*(r+.05),p[2]+d[2]*(r+.05)]);if(h){if(r<mn){mn=r;who=h;}break;}}}return {d:mn,who};};
        const ys=[];for(let y=Math.ceil(RLC.minYaw);y<=RLC.maxYaw;y++)ys.push(y);ys.push(RLC.minYaw,RLC.maxYaw);const ps=[];for(let q=RLC.minPitch;q<=RLC.maxPitch+1e-9;q+=3)ps.push(q);ps.push(RLC.maxPitch);
        for(const y of ys){for(const q of ps){const L=new RL.RoomLook(home);L.drag(0,0);L.yaw=y;L.pitch=q;const n=near(L.pose());if(n.d<worst.d)worst={d:+n.d.toFixed(3),yaw:y,pitch:q,mesh:n.who};if(n.d<lim&&bad.length<6)bad.push({yaw:y,pitch:q,nearestM:+n.d.toFixed(3),mesh:n.who});}
          const L=new RL.RoomLook(home);L.yaw=y;if(L.door(handle,K.SCREEN.aspect).visible)doorYaws.push(y);}
        check('room-look-clearance',!bad.length&&doorYaws.length>0,{limitM:lim,range:{yaw:[RLC.minYaw,RLC.maxYaw],pitch:[RLC.minPitch,RLC.maxPitch]},nearestInView:worst,violations:bad,
          doorVisibleYaws:doorYaws.length?[Math.min(...doorYaws),Math.max(...doorYaws)]:null,note:'lens fixed at cameraHome; distance along every frustum ray (16x32)'});}
      const palms=occl.filter(o=>/palm/.test(o.mesh)&&o.part!=='feet');check('occlusion:palms',palms.length===0,{headChestSamples:palms.length,byMesh:palms.reduce((a,o)=>(a[o.mesh]=(a[o.mesh]||0)+1,a),{}),sampling:'every 2nd frame'});}}
  // --- T2+ doorway-clean door drift (RegionCameraData doorDrift): open on every crossing frame, islandDeg on the island,
  // smooth (excluding the original linear opening-door / closing-door animations), and whenever the leaf is NOT fully open
  // the lens keeps >= 1.0 m (lens near limit) and she keeps >= 0.35 m from the posed leaf quad (lens_rays.doorQuad).
  {const dd=cfg.doorDrift,open=cfg.openDeg,lin=st=>st==='opening-door'||st==='closing-door';
    let maxStep=0,maxAcc=0,minLens={d:9},minHer=9;
    for(let i=2;i<F.length;i++){const f=F[i],d=f.door;
      if(!lin(f.state)&&!lin(F[i-1].state)&&!lin(F[i-2].state)){maxStep=Math.max(maxStep,Math.abs(d-F[i-1].door));maxAcc=Math.max(maxAcc,Math.abs((d-F[i-1].door)-(F[i-1].door-F[i-2].door)));}
      if(d<open-1e-6&&d>1e-6&&!lin(f.state)){const q=LR.doorQuad(d,open),l=LR.quadDist(f.cam.position,q);if(l<minLens.d)minLens={d:+l.toFixed(3),t:+f.t.toFixed(3),state:f.state,door:+d.toFixed(1)};
        minHer=Math.min(minHer,LR.quadDist([f.root[0],Math.min(1.0,LR.DOOR.height),f.root[2]],q));}}
    const isl=F.filter(f=>f.state==='island').map(f=>f.door),ci=F.filter(f=>f.state==='crossing-in').map(f=>f.door);
    const xoNear=F.filter(f=>f.state==='crossing-out'&&Math.hypot(f.root[0],f.root[2])<1.2).map(f=>f.door);
    const ok=!dd||(isl.length>0&&isl.every(v=>Math.abs(v-dd.islandDeg)<1e-6)&&ci.every(v=>v===open)&&xoNear.every(v=>v===open)&&maxStep<=1.0&&maxAcc<=0.05&&minLens.d>=LR.NEAR_M&&minHer>=0.35);
    check('door-drift',ok,dd?{islandDeg:dd.islandDeg,openDeg:open,islandDoor:Array.from(new Set(isl)),crossingInAllOpen:ci.every(v=>v===open),openWhileNearDoorOut:xoNear.every(v=>v===open),maxDegPerFrame:+maxStep.toFixed(3),maxDegPerFrame2:+maxAcc.toFixed(4),minLensToLeafWhileNotOpen:minLens,minHerToLeafM:+minHer.toFixed(3)}:{disabled:true});}
  // --- T2+ return entry, FOLLOW version (Funning, Mac r4: "从外面进回到灯塔的时候，镜头就一直跟随着人，等她坐下的时候再回到最初进入
  //游戏的那个机位"). Replaces the r3 one-shot move (lens backed into the room ahead of her and overtook her at the right
  // wall). Three parts:
  //  (1) continuity, from 1 s before crossing-in to the home settle: per-frame turn / move / fov bounded, bounded angular /
  //      linear acceleration, no stop-and-restart (only the final settle may stand still) - same limits as r3;
  //  (2) follow, from the end of the crane-down (her walk progress returnFollow.craneEnd on toThreshold) to the sit: the lens stays
  //      BEHIND her (horizontal lens direction within maxOffBehindDeg of straight behind her facing), never ahead of her
  //      along her path, at a steady distance (in.distance - 0.3 .. out.distance + 0.3, |d distance| <= 0.015 m/frame) and
  //      steady height; the follow must start >= 3 s before crossing-in (the whole walk up to and through the door);
  //  (3) the lens only leaves the follow (heads for cameraHome) once she is sitting, and lands on cameraHome exactly when the
  //      sit ends (the span's sit segment is the runtime sit length: actionSettleSeconds('sit') / actionSeconds('sit')).
  {const E=LIMITS.entry,RF=env.M.RegionCameraData.TRANSITION_CAMERA.returnFollow,ci=F.findIndex(f=>f.state==='crossing-in'),hm=F.findIndex((f,k)=>k>ci&&f.state==='home');
    const si=F.findIndex((f,k)=>k>ci&&f.state==='sitting'),r0=F.findIndex(f=>f.op==='returnHome');
    const a=Math.max(1,ci-Math.round(1/dt)),win=ci>0&&hm>ci?kin.filter(k=>k.i>=a&&k.i<=hm):[];
    let mt={v:0},mm={v:0},mf={v:0},aw={v:0},av={v:0},still=0,stillMax=0,stillAt=null;
    const at=(k,v)=>({v:+v.toFixed(3),t:+F[k.i].t.toFixed(3),state:F[k.i].state});
    for(const k of win){const turn=k.w*dt,move=k.v*dt,fv=Math.abs(k.fv)*dt;if(turn>mt.v)mt=at(k,turn);if(move>mm.v)mm=at(k,move);if(fv>mf.v)mf=at(k,fv);
      if(k.i>a+1){if(Math.abs(k.dw)>aw.v)aw=at(k,Math.abs(k.dw));if(Math.abs(k.dv)>av.v)av=at(k,Math.abs(k.dv));}
      const st=k.v<E.stillV&&k.w<E.stillW&&k.i<hm-Math.round(E.settleS/dt);if(st){still++;if(still>stillMax){stillMax=still;stillAt=+F[k.i].t.toFixed(3);}}else still=0;}
    const cont=win.length>0&&mt.v<=E.turnDegPerFrame&&mm.v<=E.moveMPerFrame&&mf.v<=E.fovDegPerFrame&&aw.v<=E.angAccel&&av.v<=E.linAccel&&stillMax*dt<=E.maxStillS;
    // (2) follow
    const hd=f=>Math.hypot(f.cam.position[0]-f.root[0],f.cam.position[2]-f.root[2]),off=f=>{const fx=Math.sin(f.yaw),fz=Math.cos(f.yaw),dx=f.cam.position[0]-f.root[0],dz=f.cam.position[2]-f.root[2],l=Math.hypot(dx,dz)||1;
      return Math.acos(Math.max(-1,Math.min(1,-(fx*dx+fz*dz)/l)))*180/Math.PI;};
    const FL=E.follow,dMin=Math.min(RF.in.distance,RF.out.distance)-.3,dMax=Math.max(RF.in.distance,RF.out.distance)+.3,hMin=Math.min(RF.in.height,RF.out.height)-.15,hMax=Math.max(RF.in.height,RF.out.height)+.15;
    // follow starts where the crane-down ends: her walk progress RF.craneEnd on toThreshold (nearest walking-home frame)
    const cp=env.W.pointOnPath(cfg.toThreshold,RF.craneEnd);let f0=-1,best=9;for(let i=Math.max(0,r0);i<ci&&r0>=0;i++){if(F[i].state!=='walking-home')continue;const e=Math.hypot(F[i].root[0]-cp[0],F[i].root[2]-cp[2]);if(e<best){best=e;f0=i;}}
    let fo={offBehindDeg:0,dRange:[9,0],dStep:0,hRange:[9,0],ahead:null,first:null};
    if(f0>0&&si>f0)for(let i=f0;i<si;i++){const f=F[i],d=hd(f),o=off(f),h=f.cam.position[1]-f.root[1];fo.offBehindDeg=Math.max(fo.offBehindDeg,o);fo.dRange=[Math.min(fo.dRange[0],d),Math.max(fo.dRange[1],d)];
      fo.hRange=[Math.min(fo.hRange[0],h),Math.max(fo.hRange[1],h)];if(i>f0)fo.dStep=Math.max(fo.dStep,Math.abs(d-hd(F[i-1])));
      if(o>90&&!fo.ahead)fo.ahead={t:+f.t.toFixed(3),state:f.state,offBehindDeg:+o.toFixed(1)};
      if((o>FL.maxOffBehindDeg||d<dMin||d>dMax||h<hMin||h>hMax)&&!fo.first)fo.first={t:+f.t.toFixed(3),state:f.state,offBehindDeg:+o.toFixed(1),distance:+d.toFixed(3),height:+h.toFixed(3)};}
    const leadS=f0>0&&ci>0?(ci-f0)*dt:0,follow=f0>0&&si>f0&&!fo.first&&!fo.ahead&&fo.dStep<=FL.maxDistStepM&&leadS>=FL.minLeadS;
    // (3) home landing: the sit segment is the runtime sit length; the lens leaves the follow band only once she sits
    const seated=cfg.seat.seatedControllerRoot,sd=si>0?F.findIndex((f,k)=>k>=si&&Math.hypot(f.root[0]-seated[0],f.root[1]-seated[1],f.root[2]-seated[2])<1e-3):-1;
    const sitS=si>0&&hm>si?(hm-si)*dt:null,seatedS=sd>0?(sd-si)*dt:null,landing=sitS!==null&&seatedS!==null&&Math.abs(sitS-seatedS)<=1.5*dt;
    check('return-entry-continuous',cont&&follow&&landing,{window:win.length?{from:+F[a].t.toFixed(3),to:+F[hm].t.toFixed(3)}:null,maxTurnPerFrameDeg:mt,maxMovePerFrameM:mm,maxFovPerFrameDeg:mf,
      maxAngAccelDegS2:aw,maxLinAccelMS2:av,longestStandstillS:+(stillMax*dt).toFixed(3),standstillEndsAt:stillAt,
      follow:{from:f0>0?+F[f0].t.toFixed(3):null,to:si>0?+F[si].t.toFixed(3):null,leadBeforeCrossingInS:+leadS.toFixed(2),maxOffBehindDeg:+fo.offBehindDeg.toFixed(1),distanceM:fo.dRange.map(v=>+v.toFixed(3)),band:[+dMin.toFixed(2),+dMax.toFixed(2)],
        maxDistStepM:+fo.dStep.toFixed(4),heightM:fo.hRange.map(v=>+v.toFixed(3)),aheadOfHer:fo.ahead,firstViolation:fo.first},
      homeLanding:{sitStart:si>0?+F[si].t.toFixed(3):null,settledHome:hm>0?+F[hm].t.toFixed(3):null,lensLandsAfterSitStartS:sitS===null?null:+sitS.toFixed(3),sheIsSeatedAfterS:seatedS===null?null:+seatedS.toFixed(3)},limits:E});}
  // --- T5 w driven by camera segments: monotone within each transition (Voice bot polls getRoomLightWeight per frame)
  {let bad=null;const seg=(f)=>f.op+':'+(f.state==='crossing-out'||f.state==='island'?'out':f.state==='walking-home'||f.state==='crossing-in'?'in':f.state);
    for(let i=2;i<F.length;i++){const a=F[i-2].weight,b=F[i-1].weight,c=F[i].weight;if(seg(F[i])!==seg(F[i-2]))continue;if((b-a)*(c-b)<-1e-9&&!bad)bad={frame:i,t:+F[i].t.toFixed(3),state:F[i].state};}
    const out=F.filter(f=>f.state==='crossing-out'),preRestore=out.length?out[out.length-1].weight:null;
    check('lighting-monotone',!bad&&preRestore!==null&&preRestore<=1e-6,{firstReversal:bad,weightLastOutboundFrame:preRestore});}
  // --- crane marks (audio ramps): crane-start precedes settled:island; report progress/seconds
  {const ev=run.cameraEvents||[],cs=ev.find(e=>e.kind==='crane-start'),si=ev.find(e=>e.kind==='settled'&&e.place==='island'),sh=ev.find(e=>e.kind==='settled'&&e.place==='home');
    const xo=run.states.find(s=>s.state==='crossing-out'),t0=xo?xo.frame*dt:null;
    check('crane-marks',!!cs&&!!si&&cs.frame<si.frame&&!!sh,{craneStart:cs&&{t:+cs.t.toFixed(3),sinceCrossingOut:+(cs.t-t0).toFixed(3),toIslandProgress:cs.progress,predictedSeconds:+cs.seconds.toFixed(3)},
      settledIsland:si&&{t:+si.t.toFixed(3),sinceCrossingOut:+(si.t-t0).toFixed(3)},craneSeconds:cs&&si?+(si.t-cs.t).toFixed(3):null,settledHome:sh&&{t:+sh.t.toFixed(3)}});}
  // --- exit B5.1 (Funning 2026-10-16 rejected B4's surge and stepped lift): after the doorway key the lens follows her,
  // then rises in one smooth ease. Checked on BOTH clocks (constant walk here, real walk driver below):
  // peak speed <= EXIT_LIMITS.peakMps, smoothed |accel| / |jerk| caps (no spikes/kinks), and the lens on her right side
  // (lateral offset on her right axis >= -EXIT_LIMITS.leftToleranceM). No cruise band, no door-angle condition.
  const EXIT_LIMITS={peakMps:4.7,clearM:1.1,accel:3.0,jerk:40,leftToleranceM:.15,smoothFrames:9};
  const exitKin=(frames,dtE,tFrom)=>{const ex=frames.filter(f=>f.state==='crossing-out'&&f.t>=tFrom-.5);const n=ex.length,h=EXIT_LIMITS.smoothFrames>>1;
    const w=[];for(let k=-h;k<=h;k++){let c=1;for(let q=0;q<k+h;q++)c=c*(2*h-q)/(q+1);w.push(c);}const ws=w.reduce((p,q)=>p+q,0);
    const P=ex.map((f,i)=>{let x=[0,0,0];for(let k=-h;k<=h;k++){const g=ex[Math.max(0,Math.min(n-1,i+k))].cam.position;for(let c=0;c<3;c++)x[c]+=g[c]*w[k+h]/ws;}return x;});
    const D=(A,i)=>A[Math.min(A.length-1,i+1)].map((v,c)=>(v-A[Math.max(0,i-1)][c])/(dtE*((i+1<A.length?1:0)+(i>0?1:0)||1)));
    const raw=ex.map((f,i)=>D(ex.map(g=>g.cam.position),i)),V=P.map((_,i)=>D(P,i)),A=V.map((_,i)=>D(V,i)),J=A.map((_,i)=>D(A,i)),L=v=>Math.hypot(v[0],v[1],v[2]);
    let peak={v:0,t:0},acc={v:0,t:0},jerk={v:0,t:0},left={v:0,t:null};
    ex.forEach((f,i)=>{if(f.t<tFrom-1e-6)return;const sp=L(raw[i]);if(sp>peak.v)peak={v:sp,t:f.t};if(i>=h&&i<n-h){const a=L(A[i]),j=L(J[i]);if(a>acc.v)acc={v:a,t:f.t};if(j>jerk.v)jerk={v:j,t:f.t};}
      const dx=f.cam.position[0]-f.root[0],dz=f.cam.position[2]-f.root[2],lat=dx*-Math.cos(f.yaw)+dz*Math.sin(f.yaw);if(Math.hypot(dx,dz)>.3&&-lat>left.v)left={v:-lat,t:f.t};});
    const r=o=>({v:+o.v.toFixed(3),t:o.t===null?null:+o.t.toFixed(3)});
    return {frames:ex.filter(f=>f.t>=tFrom-1e-6).length,peakMps:r(peak),maxAccel:r(acc),maxJerk:r(jerk),maxLeftM:r(left),
      ok:n>0&&peak.v<=EXIT_LIMITS.peakMps&&acc.v<=EXIT_LIMITS.accel&&jerk.v<=EXIT_LIMITS.jerk&&left.v<=EXIT_LIMITS.leftToleranceM};};
  {const xo=run.states.find(s=>s.state==='crossing-out'),t0=xo?xo.frame*dt:0,tDoor=t0+env.W.pathDuration(cfg.outCrossing,cfg.speed);
    const e=exitKin(F,dt,tDoor);console.log('exit-kinematics',JSON.stringify(e));
    check('exit-overlap',e.ok,{clock:'span time (constant walk)',limits:EXIT_LIMITS,...e});
    // B5.4.1: point clearance to every non-exempt mesh (lens_rays ARCH + door leaves exempt) >= EXIT_LIMITS.clearM, every frame from the doorway key to the settle
    {const gx=exitGeo;if(gx){const Ic=G.index(gx,{ignore:new RegExp(G.IGNORE.source+'|'+LR.ARCH.source+'|@(open|closed)$')});let mc={d:9,who:null,t:null};
      for(const f of F){if(f.t<tDoor-1e-6||f.state!=='crossing-out')continue;const c=Ic.clearance(f.cam.position,2);if(c.d<mc.d)mc={d:+c.d.toFixed(3),who:c.who,t:+f.t.toFixed(3)};}
      console.log('exit-clearance',JSON.stringify(mc));check('exit-prop-clearance',mc.d>=EXIT_LIMITS.clearM,{limitM:EXIT_LIMITS.clearM,exempt:String(LR.ARCH),...mc});}}
    const prevRest=process.env.QF_REAL_WALK_REST;process.env.QF_REAL_WALK_REST='1';
    const envR=S.create({realWalk:true}),runR=await S.run(envR,{script:['leaveHome'],fps:60});
    if(prevRest===undefined)delete process.env.QF_REAL_WALK_REST;else process.env.QF_REAL_WALK_REST=prevRest;
    const xoR=runR.states.find(s=>s.state==='crossing-out'),t0R=xoR?xoR.frame*runR.dt:0,tDoorR=t0R+envR.W.pathDuration(envR.cfg.outCrossing,envR.cfg.speed);
    const eR=exitKin(runR.frames,runR.dt,tDoorR);console.log('exit-peak',JSON.stringify(eR));
    check('exit-cruise-real',eR.ok,{clock:'walk distance (real walk driver)',limits:EXIT_LIMITS,...eR});}
  // --- wind strength (WorldFlowComponent.getWindStrength): 0 indoors; rises monotonically to EXACTLY 1 at the frontal
  // frame (camera in front of her); held; back to EXACTLY 0 at island settle and through island idle; per-frame step
  // <= WIND_EPS; listener fired only on change.
  {const WIND_EPS=.02,ev=run.cameraEvents||[],si=ev.find(e=>e.kind==='settled'&&e.place==='island'),xo=run.states.find(s=>s.state==='crossing-out');
    const w=F.map(f=>f.wind||0),t0=xo?xo.frame:0;let maxStep=0,stepAt=null;for(let i=1;i<F.length;i++){const s2=Math.abs(w[i]-w[i-1]);if(s2>maxStep){maxStep=s2;stepAt={frame:i,t:+F[i].t.toFixed(3),state:F[i].state};}}
    const peak=w.indexOf(1),pre=w.slice(t0,peak+1);let rev=null;for(let i=1;i<pre.length;i++)if(pre[i]<pre[i-1]-1e-12&&!rev)rev={frame:t0+i,t:+F[t0+i].t.toFixed(3)};
    const before=F.slice(0,t0).every(f=>(f.wind||0)===0),after=si?F.slice(si.frame).every(f=>(f.wind||0)===0):false,lastOne=w.lastIndexOf(1);
    const fr=peak>=0?F[peak]:null,frontDeg=f=>{const fx=Math.sin(f.yaw),fz=Math.cos(f.yaw),dx=f.cam.position[0]-f.root[0],dz=f.cam.position[2]-f.root[2],l=Math.hypot(dx,dz)||1;return Math.acos(Math.max(-1,Math.min(1,(fx*dx+fz*dz)/l)))*180/Math.PI;};
    const door=F.slice(t0).find(f=>f.root[2]>=0),hold=peak>=0?F.slice(peak,lastOne+1):[],holdFront=hold.length?Math.max(...hold.map(frontDeg)):null;
    const back=(()=>{let k=-1;for(let i=lastOne+1;i<F.length;i++)if(w[i]===0){k=i;break;}return k;})();
    const wev=run.windEvents||[],dup=wev.some((e,i)=>i&&e.s===wev[i-1].s),sec=f=>f?+(f.t-F[t0].t).toFixed(3):null;
    const timeline={secondsFromCrossingOut:{doorSill:sec(door),windAtDoor:door?+door.wind.toFixed(3):null,swingStart:null,frontal:sec(fr),holdEnd:lastOne>=0?sec(F[lastOne]):null,pauseSeconds:lastOne>=peak&&peak>=0?+((lastOne-peak)*dt).toFixed(3):null,backToZero:back>=0?sec(F[back]):null,islandSettle:si?+(si.t-F[t0].t).toFixed(3):null}};
    check('wind-strength',before&&peak>t0&&!rev&&after&&maxStep<=WIND_EPS&&!dup&&back>=0&&si&&back<=si.frame,{peakFrame:peak,monotoneRise:!rev,firstReversal:rev,maxStepPerFrame:+maxStep.toFixed(4),eps:WIND_EPS,stepAt,zeroIndoors:before,zeroAfterIslandSettle:after,listenerEvents:wev.length,duplicateEvents:dup,...timeline});
    // Voice bot AmbienceAudio (int/v1 e439b62) triggers seagulls on RISING crossings of 0.4 and 0.7: exactly once each per trip.
    const rising=th=>{let n=0;for(let i=1;i<w.length;i++)if(w[i-1]<th&&w[i]>=th)n++;return n;};
    check('wind-rising-crossings',rising(.4)===1&&rising(.7)===1,{'0.4':rising(.4),'0.7':rising(.7),expectedEach:1});
    // exit shot (B5.3): from wind peak to island settle the lens must never be behind her face plane (angle to her facing < 90 deg); no frontal-angle limit
    const tail=peak>=0?F.slice(peak,si?si.frame+1:F.length):[],tailMax=tail.length?Math.max(...tail.map(frontDeg)):null,last=F[si?si.frame:F.length-1];
    check('wind-frontal',!!fr&&tailMax!==null&&tailMax<90,{rule:'camera never behind her face (front angle < 90) from wind peak to island settle',frontalDegAtPeak:fr?+frontDeg(fr).toFixed(1):null,maxFrontDegPeakToSettle:tailMax===null?null:+tailMax.toFixed(1),frontDegAtSettle:last?+frontDeg(last).toFixed(1):null,limit:90});}
  const timeline=run.states.map(s=>({t:+(s.frame*dt).toFixed(3),state:s.state}));
  // --- T2+ leave from a dragged room view (door-facing, RoomLook extreme): ONE continuous move, no cut, in frame after rejoin
  if(!args.includes('--no-drag')){const env2=S.create(envOpts),h=env2.cfg.cameraHome,yaw=Math.atan2(0-h.position[0],0-h.position[2]);
    const from={position:[...h.position],target:[h.position[0]+Math.sin(yaw)*2.5,h.position[1],h.position[2]+Math.cos(yaw)*2.5],fovVerticalDeg:h.fovVerticalDeg};
    const r2=await S.run(env2,{script:[['leaveHome',{from}]]}),F2=r2.frames,k2=K.kinematics(C,F2,r2.dt);let cut2=null,maxW=0,maxDw2=0;
    for(const k of k2){const turn=k.w*r2.dt,move=k.v*r2.dt;maxW=Math.max(maxW,turn);maxDw2=Math.max(maxDw2,Math.abs(k.dw||0));if((turn>LIMITS.cutTurnDeg||move>LIMITS.cutMoveM)&&!cut2)cut2={frame:k.i,turnDeg:+turn.toFixed(2)};}
    const first=F2.find(f=>f.state==='standing');const rel=F2.filter(f=>f.state==='turning-out'||f.state==='walking-out').map(f=>K.framing(C,f)).map(m=>Math.min(m.topMargin,m.bottomMargin,m.sideMargin));
    check('drag-rejoin-continuous',!cut2&&maxDw2<=LIMITS.maxAngAccel&&rel.every(m=>m>=0)&&r2.results[0].result.ok,{from:'door-facing view at cameraHome',cut:cut2,maxTurnPerFrameDeg:+maxW.toFixed(3),maxAngAccelDegS2:+maxDw2.toFixed(1),minMarginAfterStand:+Math.min(...rel).toFixed(4),firstStandingFrame:first?.frame});}
  // --- the sim models GGbot's T5 rule "setLayers(HOME|BOTH) forces w=1"; make sure the real component still does it
  {const src=require('fs').readFileSync(require('path').join(__dirname,'../../creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts'),'utf8');
    const line=(src.match(/^\s*setLayers:\(layers:Layers\)=>\{[^\n]*$/m)||[''])[0];
    check('t5-setLayers-contract',/if\(layers\.interior\)this\.roomLighting\?\.setRoomLightWeight\(1\)/.test(line),{found:!!line});}
  const report={ok:checks.every(c=>c.ok),frames:F.length,fps:1/dt,timeline,checks,limits:LIMITS,safeArea:K.SAFE,screen:K.SCREEN,
    scope:'CPU simulation of real flow/routes/tracks; native rendering (materials, shaders, frame pacing) is out of scope.'};
  if(jsonOut)fs.writeFileSync(jsonOut,JSON.stringify(report,null,1));
  for(const c of checks)console.log((c.ok?'PASS ':'FAIL ')+c.name.padEnd(30)+JSON.stringify(c.detail));
  console.log(report.ok?'ALL PASS':'FAILED',F.length,'frames');process.exitCode=report.ok?0:1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=2;});
