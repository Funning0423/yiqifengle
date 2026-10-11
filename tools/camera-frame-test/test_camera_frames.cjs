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
const T9=require('./t9_props.cjs'),S=require('./flow_sim.cjs'),K=require('./metrics.cjs'),G=require('./glb_geometry.cjs'),LR=require('./lens_rays.cjs'),fs=require('fs');
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
if(envOpts.walkDuration)console.log('walk profile: synthetic',wp,'(0.3 s linear accel/decel ramps, walkDuration = L/0.7 + ramp/2 per ramp), walkProgress reported:',envOpts.reportWalkProgress);
const LIMITS={clearanceM:.15,homeClearanceM:.07,cutTurnDeg:15,cutMoveM:.5,maxAngAccel:360,maxLinAccel:15,maxWeightStep:.05,settleV:.05,settleW:.5};
(async()=>{
  if(envOpts.walkDuration){const c0=S.create().cfg;for(const k of ['toDoor','outCrossing','toIsland','toThreshold','inCrossing','toSeat'])if(c0[k])named.push([k,c0[k]]);}
  const env=S.create(envOpts),{C,cfg}=env,run=await S.run(env),F=run.frames,dt=run.dt;
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
  if(!args.includes('--no-geometry')){const base=await G.decode(),geoT9=base&&!args.includes('--no-t9')?await T9.merged(base):null,geo=geoT9||base;
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
        F.forEach((f,i)=>add(ph(f),LR.sample(C,I,f.cam,K.SCREEN.aspect),f,i));
        add('islandIdlePose',LR.sample(C,I,C.fromLookAt(cfg.cameraIsland,cfg.cameraIsland.fovVerticalDeg),K.SCREEN.aspect),null,-1);
        check('collision:lens-near-geometry',hits.length===0,{nearM:LR.NEAR_M,coverM:LR.COVER_M,grid:LR.COLS+'x'+LR.ROWS,sampling:'every frame',archExempt:String(LR.ARCH),firstHits:hits,phases:R});}
      const palms=occl.filter(o=>/palm/.test(o.mesh)&&o.part!=='feet');check('occlusion:palms',palms.length===0,{headChestSamples:palms.length,byMesh:palms.reduce((a,o)=>(a[o.mesh]=(a[o.mesh]||0)+1,a),{}),sampling:'every 2nd frame'});}}
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
  // --- outbound frontal swing distance: lens-to-girl horizontal distance from the first side key (distance >= 2 m; the
  // doorway-exit and near-behind keys before it follow her out of the door) to crane-start. Replaces the 3.5-5 m side
  // rail band: never closer than 2.0 m (no crowding), never further than 5.5 m when the crane takes over.
  {const cs=(run.cameraEvents||[]).find(e=>e.kind==='crane-start');const d=f=>Math.hypot(f.cam.position[0]-f.root[0],f.cam.position[2]-f.root[2]);
    const TC=env.M.RegionCameraData.TRANSITION_CAMERA,first=TC.railOut.find(k=>k.distance>=2),walkS=env.W.pathDuration(cfg.toIsland,cfg.speed);
    const t1=cs&&first?cs.t-(cs.progress-first.progress)*walkS:Infinity;const railOut=cs?F.filter(f=>f.state==='crossing-out'&&f.t>=t1&&f.t<=cs.t):[];const ds=railOut.map(d);
    check('rail-distance-band',ds.length>0&&Math.min(...ds)>=2.0&&Math.max(...ds)<=5.5,{swingSeconds:+(ds.length*dt).toFixed(2),outbound:ds.length?{min:+Math.min(...ds).toFixed(2),max:+Math.max(...ds).toFixed(2)}:null,band:[2.0,5.5]});}
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
    check('wind-frontal',!!fr&&frontDeg(fr)<=25&&holdFront!==null&&holdFront<=40,{frontalDegAtPeak:fr?+frontDeg(fr).toFixed(1):null,limit:25,maxDegDuringHold:holdFront===null?null:+holdFront.toFixed(1),holdLimit:40});}
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
