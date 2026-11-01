'use strict';
/* reveal-camera-motion (Grok Bot, Oct 30): no camera write may exceed 运镜bot's per-frame limits from the level 04 enter-level push-in
 * p=0, through the board reveal and the level 04 exit shot (RegionNodeStage.playReward board→follow blend, RegionNodeStage.ts:273,
 * BLEND_S.boardToFollow 0.6 s, push-in end → follow pose 60.8 m / 171°, then LiveHandoff into the sail), until 1 s after the node
 * lens settles. Mac dedf8853 tint1: f646 world.setCamera 2.6 m snap (fixed in reveal-restore 96dfbd33); f647–f659 = the L04-exit
 * blend (worst f649–f652: 6.3–12.6 m, 17–71° per frame).
 * Drives the REAL WorldFlowCore + RegionJourneyCore (island → enterLevel mainline-04 → reveal) and the REAL RegionNodeStage.blend +
 * update anim stepping (transpiled out of the class) with the real ExploreCameraCore blendPose/followPose, on the Mac's per-frame dt,
 * for all 7 LENS_SMOOTH.screens.
 * KNOWN_DEFECT (Grok Bot, Oct 30, fallback b): the L04-exit blend window is reported as KNOWN_DEFECT with its measured values every
 * run, owner cine/b20-meadow-nodelens-ease; not a PASS, not counted as FAIL. Any other frame over a limit FAILs. If the window comes
 * back within limits while the entry still exists, the gate FAILs (stale entry: remove KNOWN_DEFECT). */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHarness}=require('../board-ui/harness.cjs');const H=createHarness();const ts=require('../qf-env.cjs').typescript();
// ── limits: 运镜bot, Oct 30 2026 (standing-shot cap = LensSmooth.LENS_SMOOTH.yawOursDegS 90 / yawAccDegS2 200). One block, edit here.
const LIMITS=Object.freeze({yawDegS:90,pitchDegS:90,angAccP99DegS2:200,linMS:8,stepM:0.5/* push-in max 0.407 m */,fovStepDeg:1.5,minHeightM:1.5,writersPerFrame:1});
// ── KNOWN_DEFECT L04-exit-board-to-follow-blend REMOVED (b20 walk merge, 运镜bot l04-lens-r2 方案 E + RNS-island-stage04-lens.diff):
// the L04 exit no longer blends 0.6 s board→follow; RegionNodeStage.playReward drives IslandStageLens.islandDepartLens (board lens →
// tangent line + arc along her uncut I4→I6 walk → follow at I6), one writer (skyRail clock). This gate now drives that REAL lens
// (the same functions playReward calls, nodes from REGION_NODES) on the Mac per-frame dt; every frame must be within the limits.
const EXIT={writer:'region.node-lens.island-depart',where:'RegionNodeStage.playReward islandDepartLens (方案 E)'};
const S=p=>path.join(H.SCRIPTS,p);
// Exit min height (Grok Bot 2026-10-30, real rule): camera >= 1.5 m above WHATEVER is straight below it = max(terrain, prop/foliage
// tops, her path ground), by a vertical ray down at the camera XZ through the skin-corrected island fixture (journey-scene.cjs, the
// same meshes the clearance gates use: env_island_main + props_merged + palms/lighthouse/animals + placed beach palms). Non-solid FX
// (seagulls in flight, smoke, light beam/glow, glass, blind cards) are not "below".
const JS=require('./journey-scene.cjs'),BELOW=JS.island.filter(o=>!/seagull_fly|smoke|beam|glow|glass|blind_cards/.test(o.name));
for(const o of BELOW)o.bb??=JS.bbox(o.tris);
function below(p){let y=-Infinity,tag='none';for(const o of BELOW){const b=o.bb;if(p[0]<b[0][0]||p[0]>b[1][0]||p[2]<b[0][2]||p[2]>b[1][2]||b[0][1]>p[1])continue;
 const t=JS.rayHit(p,[0,-1,0],p[1]-b[0][1]+1,o.tris);if(t!==null&&p[1]-t>y){y=p[1]-t;tag=o.tag+':'+o.name;}}return {y,tag};}
const E=H.load(S('region/ExploreCameraCore.ts')),LS=H.load(S('region/LensSmooth.ts')),IL=H.load(S('region/IslandStageLens.ts')),NW=H.load(S('region/NodeWalker.ts'));
// wiring proof: the live playReward must call islandDepartLens on the island departure, else this gate would test dead code
assert.match(fs.readFileSync(S('world-r2/RegionNodeStage.ts'),'utf8'),/const dep=isl&&spec\.departure\?islandDepartLens\(board,isl,followPose\(isl\[isl\.length-1\],endHeading\(isl\)/,'RegionNodeStage.playReward no longer drives islandDepartLens on the L04 exit');
assert.equal(LS.LENS_SMOOTH.yawOursDegS,LIMITS.yawDegS,'yaw cap drifted from LensSmooth.yawOursDegS');assert.equal(LS.LENS_SMOOTH.yawAccDegS2,LIMITS.angAccP99DegS2,'accel cap drifted from LensSmooth.yawAccDegS2');
// real RegionNodeStage.blend + update (anim stepping only)
const src=fs.readFileSync(S('world-r2/RegionNodeStage.ts'),'utf8'),sf=ts.createSourceFile('s.ts',src,ts.ScriptTarget.ES2020,true);
const cls=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name&&n.name.text==='RegionNodeStage');
const m=n=>{const x=cls.members.find(y=>y.name&&y.name.getText(sf)===n);assert.ok(x,'RegionNodeStage.'+n);return x.getText(sf);};
const upd=m('update').replace(/\{[\s\S]*$/,'').trim();// keep only the anim line of update()
const body=src.split('\n').find(l=>l.includes('if(this.anim){this.anim.t+=dt;'));assert.ok(body,'RegionNodeStage.update anim line');
const out=ts.transpileModule(`class Stage{${m('blend')}\n${upd}{${body}}};module.exports=Stage;`,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const sb={module:{exports:{}},blendPose:E.blendPose,setTimeout:()=>0,Promise};vm.runInNewContext(out,sb);const Stage=sb.module.exports;
// Mac dedf8853 tint1 per-frame dt (s): push-in f634→f645, blend f647→f659 (QF_CAM_TRACE t)
const PUSH_DT=[0.046,0.081,0.067,0.05,0.083,0.063,0.064,0.07,0.06,0.046,0.086],BLEND_DT=[0.033,0.033,0.075,0.035,0.034,0.063,0.024,0.03,0.056,0.028,0.035,0.041,0.063];
const R=180/Math.PI,yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*R,pitchOf=p=>{const d=p.target.map((x,i)=>x-p.position[i]);return Math.asin(d[1]/Math.hypot(...d))*R;};
const wrap=a=>((a%360)+540)%360-180;
async function reveal(){// real WorldFlowCore + RegionJourneyCore: frames written from push-in p=0 to the board reveal
 const {WorldFlow}=H.load('world-r1/WorldFlowCore'),{RegionJourneyController}=H.load('world-r1/RegionJourneyCore');
 const pose={position:[-12,15.5,48],target:[-11,14,44],fovVerticalDeg:42},end={position:[-11.338,14.736,45.605],target:[-10.5,13.4,41.8],fovVerticalDeg:36},zero=[0,0,0];
 const seat={position:zero,back:[0,0,-1],yawRad:0,seatedFoot:zero,standingFoot:zero,seatedControllerRoot:zero,standingControllerRoot:zero};
 const config={seat,toDoor:[zero,[0,0,1]],outCrossing:[[0,0,1],[0,0,2]],toIsland:[[0,0,2],[0,0,3]],toThreshold:[[0,0,3],[0,0,2]],inCrossing:[[0,0,2],[0,0,1]],toSeat:[[0,0,1],zero],cameraHome:pose,cameraToDoor:[pose,pose],cameraInside:pose,cameraOutside:pose,cameraIsland:pose,openDeg:90,speed:1};
 let camera=pose,rec=false;const frames=[];
 const actor={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:zero,seatedRoot:zero,seatYawRad:0,clearanceRadiusM:.1},advance(){},walkProgress:()=>1,perform:async()=>{},cancelAndReset(){},setVisible(){},dispose(){}};
 const world={setCamera:p=>{camera=p;if(rec)frames.push({dt:1/60,pose:p,writers:['world.setCamera']});},setLayers(){},setDoor(){},cancelTransient(){},assertStaticWorld(){},dispose(){},animateCamera:async()=>{},animateDoor:async()=>{},
  playEnterLevel:async()=>{rec=true;const T=PUSH_DT.reduce((a,b)=>a+b,0);let t=0;camera=pose;frames.push({dt:0,pose,writers:['enter-level']});/* tick(0): path[0] */
   for(const dt of PUSH_DT){t+=dt;const s=Math.min(1,t/T),e=s*s*(3-2*s),lp=(a,b)=>a.map((x,i)=>x+(b[i]-x)*e);camera={position:lp(pose.position,end.position),target:lp(pose.target,end.target),fovVerticalDeg:42+(36-42)*e};frames.push({dt,pose:camera,writers:['enter-level']});}}};
 const journey=new RegionJourneyController({readCamera:()=>camera,prepare:async(from,to,start)=>({route:{from,to,path:[start,[start[0],start[1]+1,start[2]+4],[start[0],start[1]+1,start[2]+8]],bridgeStart:1,bridgeEnd:6,speed:1},show(){},dispose(){}})});
 const flow=new WorldFlow({config,character:actor,journey,skycity:{enter:async()=>({show(){},hide(){},dispose(){}})},levels:{enter:async()=>({requestExit:()=>({ok:true}),hide(){},showPaused(){},resume:()=>({ok:true}),dispose(){},isSettledResult:()=>false,reveal(){}})},loadWorld:async()=>world});
 assert((await flow.load()).ok);assert((await flow.leaveHome()).ok);
 const r=await flow.enterLevel('mainline-04');assert(r.ok,JSON.stringify(r));assert.equal(flow.snapshot().state,'level');
 return {frames,board:camera};}
// meadow follow target fitted to the Mac f659 settle pose (5.114,3.631,-11.896, yaw −173.4°) at 390×844; the girl stands on meadow ground
function girlFor(w,h){const yawRad=wrap(-173.4+180)/R,o=E.followPose([0,0,0],yawRad,w,h,0),G=[5.114-o.position[0],3.631-o.position[1]-0,-11.896-o.position[2]];return {G,yawRad};}
const {G:G0}=girlFor(390,844);const GROUND=G0[1];
function check(frames,label){const bad=[],kd=[];let prevW=null;const acc=[],kdAcc=[];const KNOWN_DEFECT={writer:'\u0000none'};let minH=null;
 for(let i=1;i<frames.length;i++){const a=frames[i-1].pose,b=frames[i].pose,dt=frames[i].dt||1/60,f=frames[i],inKD=f.writers.includes(KNOWN_DEFECT.writer);
  const dm=Math.hypot(...b.position.map((x,k)=>x-a.position[k])),dy=Math.abs(wrap(yawOf(b)-yawOf(a))),dp=Math.abs(pitchOf(b)-pitchOf(a)),df=Math.abs((b.fovVerticalDeg??48)-(a.fovVerticalDeg??48));
  const w=Math.max(dy,dp)/dt;if(prevW!=null)(inKD?kdAcc:acc).push(Math.abs(w-prevW)/dt);prevW=w;
  const why=[];if(dm>LIMITS.stepM)why.push(`step ${dm.toFixed(3)} m > ${LIMITS.stepM}`);if(dm/dt>LIMITS.linMS)why.push(`${(dm/dt).toFixed(1)} m/s > ${LIMITS.linMS}`);
  if(dy/dt>LIMITS.yawDegS)why.push(`yaw ${(dy/dt).toFixed(0)}°/s > ${LIMITS.yawDegS}`);if(dp/dt>LIMITS.pitchDegS)why.push(`pitch ${(dp/dt).toFixed(0)}°/s > ${LIMITS.pitchDegS}`);
  if(df>LIMITS.fovStepDeg)why.push(`fov ${df.toFixed(2)}° > ${LIMITS.fovStepDeg}`);let gY=GROUND,gTag='ground';if(f.ground!=null){const u=below(b.position);gY=Math.max(u.y,f.ground);gTag=u.y>=f.ground?u.tag:'her path ground';}
  const hgt=b.position[1]-gY;if(f.ground!=null&&(minH==null||hgt<minH.h))minH={h:hgt,tag:gTag,frame:i};
  if(hgt<LIMITS.minHeightM)why.push(`height ${hgt.toFixed(2)} m < ${LIMITS.minHeightM} above ${gTag}`);
  if(f.writers.length>LIMITS.writersPerFrame)why.push('writers '+f.writers.join('+'));
  if(!why.length)continue;const tag=`${label} frame ${i} (${f.tag||f.writers[0]||'held'}): ${why.join(', ')}`;(inKD?kd:bad).push(tag);}
 const P=x=>{x.sort((m,n)=>m-n);return x.length?x[Math.min(x.length-1,Math.floor(x.length*0.99))]:0;},p99=P(acc),kdP99=P(kdAcc);
 if(p99>LIMITS.angAccP99DegS2)bad.push(`${label}: angular accel p99 ${p99.toFixed(0)}°/s² > ${LIMITS.angAccP99DegS2} outside the KNOWN_DEFECT window`);
 if(kdP99>LIMITS.angAccP99DegS2)kd.push(`${label}: window angular accel p99 ${kdP99.toFixed(0)}°/s² > ${LIMITS.angAccP99DegS2}`);
 return {bad,kd,p99,minH};}
process.exitCode=1;/* only the final verdict line sets 0: a hung await can never pass silently */
(async()=>{const fails=[],kdAll=[];
 for(const [w,h] of LS.LENS_SMOOTH.screens){const {frames,board}=await reveal();
  // after the reveal the board is up; the L04 exit is the REAL island departure lens from that board pose (as playReward builds it)
  const pl=NW.planWalk('island','I4','I6');assert.equal(pl.segments.length,1,'I4>I6 must be one uncut walk');const isl=pl.segments[0].path,L=NW.pathLength(isl);
  const dep=IL.islandDepartLens(board,isl,E.followPose(isl[isl.length-1],IL.endHeading(isl),w,h,E.followLookUp('island',99)));
  let t=0;const herY=tt=>NW.pointAlong(isl,Math.max(0,Math.min(L,(tt-dep.preS)*1.2)))[1];
  for(const dt of [...BLEND_DT,...Array(Math.ceil((dep.seconds+1)*60)).fill(1/60)]){t+=dt;if(t>dep.seconds+1)break;frames.push({dt,pose:dep.at(Math.min(t,dep.seconds)),writers:[EXIT.writer],ground:herY(t),tag:'L04-exit island-depart t='+t.toFixed(3)});}
  const done=Promise.resolve();
  await done;const r=check(frames,`${w}x${h}`);fails.push(...r.bad);kdAll.push(...r.kd);
  console.log(`${r.bad.length?'FAIL':'ok  '} ${w}x${h}: ${frames.length} frames (push-in + reveal + L04 exit ${EXIT.where}), ${r.bad.length} over limit, ang-accel p99 ${r.p99.toFixed(0)}°/s², exit min height ${r.minH?r.minH.h.toFixed(2)+' m above '+r.minH.tag+' (frame '+r.minH.frame+')':'n/a'}`);}
 for(const f of fails.slice(0,40))console.log('     FAIL '+f);
 {// self-check (height): a still camera 1.0 m above the highest palm crown, and 1.2 m above a prop top, must FAIL
  const palm=BELOW.filter(o=>/palm/.test(o.name)).map(o=>{const c=[(o.bb[0][0]+o.bb[1][0])/2,o.bb[1][1]+50,(o.bb[0][2]+o.bb[1][2])/2],u=below(c);return {o,c,u};}).filter(x=>/palm/.test(x.u.tag)).sort((a,b)=>b.u.y-a.u.y)[0];
  assert.ok(palm,'self-check: no palm crown found');const cam=[palm.c[0],palm.u.y+1.0,palm.c[2]],pose={position:cam,target:[cam[0],cam[1]-1,cam[2]+10],fovVerticalDeg:48};
  const r=check([{dt:0,pose,writers:[],ground:-5},{dt:1/60,pose,writers:['probe'],ground:-5}],'height-probe');
  assert.ok(r.bad.some(x=>/height 1\.00 m < 1\.5 above .*palm/.test(x)),'self-check: camera 1.0 m above '+palm.u.tag+' crown passed: '+r.bad.join('|'));
  const prop=BELOW.find(o=>o.name==='env_lighthouse_ext'),pc=[(prop.bb[0][0]+prop.bb[1][0])/2,prop.bb[1][1]+50,(prop.bb[0][2]+prop.bb[1][2])/2],pu=below(pc),pp={position:[pc[0],pu.y+1.2,pc[2]],target:[pc[0],pu.y,pc[2]+10],fovVerticalDeg:48};
  const r2=check([{dt:0,pose:pp,writers:[],ground:-5},{dt:1/60,pose:pp,writers:['probe'],ground:-5}],'prop-probe');assert.ok(r2.bad.some(x=>/height 1\.20 m/.test(x)),'self-check: camera 1.2 m above prop '+pu.tag+' passed');
  console.log('ok   self-check: camera 1.0 m above '+palm.u.tag+' crown and 1.2 m above '+pu.tag+' FAIL the height rule');}
 {// self-check: the legacy 0.6 s board→follow blend (pre-方案 E RegionNodeStage.ts:273) on the same frames must FAIL this gate
  const {frames,board}=await reveal(),st=new Stage();let wrote=null;st.orbit={pause(){}};st.writePose=q=>{wrote=q;return q;};
  const pl=NW.planWalk('island','I4','I6').segments[0].path,to=E.followPose(pl[0],0,390,844,E.followLookUp('island',99));const d=st.blend(E.BLEND_S.boardToFollow,board,()=>to);
  for(const dt of [...BLEND_DT,...Array(60).fill(1/60)]){wrote=null;st.update(dt);if(wrote)frames.push({dt,pose:wrote,writers:['legacy.blend'],ground:pl[0][1]});if(!st.anim)break;}await d;
  const r=check(frames,'legacy-probe');assert.ok(r.bad.length>0,'self-check: the legacy L04-exit blend passed the limits');console.log('ok   self-check: legacy 0.6 s L04-exit blend FAILs ('+r.bad.length+' over limit)');}
 if(fails.length){console.log(`reveal-camera-motion: FAIL ${fails.length}`);process.exit(1);}
 console.log(`reveal-camera-motion: PASS every frame within 运镜bot's limits (push-in p=0 → reveal → L04 exit ${EXIT.where}), no KNOWN_DEFECT`);process.exitCode=0;
})().catch(e=>{console.error(e);process.exit(1);});
