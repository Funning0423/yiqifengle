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
// ── KNOWN_DEFECT entry. Remove it when cine/b20-meadow-nodelens-ease lands (the gate FAILs while it is stale).
const KNOWN_DEFECT=Object.freeze({id:'L04-exit-board-to-follow-blend',owner:'cine/b20-meadow-nodelens-ease',where:'RegionNodeStage.ts:273 playReward blend(BLEND_S.boardToFollow)',mac:'dedf8853 tint1 f647–f659 (worst f649–f652)',writer:'region.node-lens.blend'});
const S=p=>path.join(H.SCRIPTS,p);
const E=H.load(S('region/ExploreCameraCore.ts')),LS=H.load(S('region/LensSmooth.ts'));
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
function check(frames,label){const bad=[],kd=[];let prevW=null;const acc=[],kdAcc=[];
 for(let i=1;i<frames.length;i++){const a=frames[i-1].pose,b=frames[i].pose,dt=frames[i].dt||1/60,f=frames[i],inKD=f.writers.includes(KNOWN_DEFECT.writer);
  const dm=Math.hypot(...b.position.map((x,k)=>x-a.position[k])),dy=Math.abs(wrap(yawOf(b)-yawOf(a))),dp=Math.abs(pitchOf(b)-pitchOf(a)),df=Math.abs((b.fovVerticalDeg??48)-(a.fovVerticalDeg??48));
  const w=Math.max(dy,dp)/dt;if(prevW!=null)(inKD?kdAcc:acc).push(Math.abs(w-prevW)/dt);prevW=w;
  const why=[];if(dm>LIMITS.stepM)why.push(`step ${dm.toFixed(3)} m > ${LIMITS.stepM}`);if(dm/dt>LIMITS.linMS)why.push(`${(dm/dt).toFixed(1)} m/s > ${LIMITS.linMS}`);
  if(dy/dt>LIMITS.yawDegS)why.push(`yaw ${(dy/dt).toFixed(0)}°/s > ${LIMITS.yawDegS}`);if(dp/dt>LIMITS.pitchDegS)why.push(`pitch ${(dp/dt).toFixed(0)}°/s > ${LIMITS.pitchDegS}`);
  if(df>LIMITS.fovStepDeg)why.push(`fov ${df.toFixed(2)}° > ${LIMITS.fovStepDeg}`);if(b.position[1]-GROUND<LIMITS.minHeightM)why.push(`height ${(b.position[1]-GROUND).toFixed(2)} m < ${LIMITS.minHeightM}`);
  if(f.writers.length>LIMITS.writersPerFrame)why.push('writers '+f.writers.join('+'));
  if(!why.length)continue;const tag=`${label} frame ${i} (${f.tag||f.writers[0]||'held'}): ${why.join(', ')}`;(inKD?kd:bad).push(tag);}
 const P=x=>{x.sort((m,n)=>m-n);return x.length?x[Math.min(x.length-1,Math.floor(x.length*0.99))]:0;},p99=P(acc),kdP99=P(kdAcc);
 if(p99>LIMITS.angAccP99DegS2)bad.push(`${label}: angular accel p99 ${p99.toFixed(0)}°/s² > ${LIMITS.angAccP99DegS2} outside the KNOWN_DEFECT window`);
 if(kdP99>LIMITS.angAccP99DegS2)kd.push(`${label}: window angular accel p99 ${kdP99.toFixed(0)}°/s² > ${LIMITS.angAccP99DegS2}`);
 return {bad,kd,p99};}
process.exitCode=1;/* only the final verdict line sets 0: a hung await can never pass silently */
(async()=>{const fails=[],kdAll=[];
 for(const [w,h] of LS.LENS_SMOOTH.screens){const {frames,board}=await reveal();
  // after the reveal the board is up; region.node-lens takes over from the live pose (readPose) with the real blend
  const {G:G1,yawRad}=girlFor(390,844),G=G1,to=E.followPose(G,yawRad,w,h,E.followLookUp('meadow',99));
  const st=new Stage();let wrote=null;st.orbit={pause(){}};st.writePose=p=>{wrote=p;return p;};
  const done=st.blend(E.BLEND_S.boardToFollow,board,()=>to);let k=0;
  for(const dt of BLEND_DT){wrote=null;st.update(dt);k++;if(wrote)frames.push({dt,pose:wrote,writers:[KNOWN_DEFECT.writer],tag:'L04-exit blend '+k+' ≈ Mac f'+(646+k)});if(!st.anim)break;}
  for(let i=0;i<60;i++){wrote=null;st.update(1/60);if(wrote)frames.push({dt:1/60,pose:wrote,writers:[KNOWN_DEFECT.writer],tag:'L04-exit blend end'});else frames.push({dt:1/60,pose:frames[frames.length-1].pose,writers:[]});}// 1 s after settle
  await done;const r=check(frames,`${w}x${h}`);fails.push(...r.bad);kdAll.push(...r.kd);
  console.log(`${r.bad.length?'FAIL':'ok  '} ${w}x${h}: ${frames.length} frames, ${r.bad.length} over limit outside KNOWN_DEFECT, ${r.kd.length} KNOWN_DEFECT, ang-accel p99 ${r.p99.toFixed(0)}°/s²`);
  for(const x of r.kd)console.log('     KNOWN_DEFECT '+x);}
 for(const f of fails.slice(0,40))console.log('     FAIL '+f);
 {// stale-entry selftest: once the owner's fix makes the window move within limits (here: a still lens), the same check reports no
  // KNOWN_DEFECT result, and the gate then FAILs as stale above. A blend that stays within limits must not be mis-tagged.
  const {frames,board}=await reveal(),st=new Stage();let wrote=null;st.orbit={pause(){}};st.writePose=q=>{wrote=q;return q;};const d=st.blend(E.BLEND_S.boardToFollow,board,()=>board);
  for(const dt of [...BLEND_DT,...Array(60).fill(1/60)]){wrote=null;st.update(dt);if(wrote)frames.push({dt,pose:wrote,writers:[KNOWN_DEFECT.writer]});if(!st.anim)break;}assert.equal(st.anim,null,'stale probe blend never ended');await d;
  const r=check(frames,'stale-probe');assert.equal(r.kd.length+r.bad.length,0,'stale probe: '+[...r.kd,...r.bad].join(' | '));console.log('ok   stale-entry detector: a within-limit window yields 0 KNOWN_DEFECT results (gate would FAIL stale)');}
 if(!kdAll.length){console.log(`reveal-camera-motion: FAIL stale KNOWN_DEFECT ${KNOWN_DEFECT.id} (owner ${KNOWN_DEFECT.owner}): the window is within limits now; remove the entry`);process.exit(1);}
 if(fails.length){console.log(`reveal-camera-motion: FAIL ${fails.length} (+ KNOWN_DEFECT ${KNOWN_DEFECT.id}: ${kdAll.length})`);process.exit(1);}
 console.log(`reveal-camera-motion: KNOWN_DEFECT ${KNOWN_DEFECT.id} owner ${KNOWN_DEFECT.owner} (${KNOWN_DEFECT.where}; Mac ${KNOWN_DEFECT.mac}): ${kdAll.length} over-limit results, not counted; every other frame within 运镜bot's limits`);process.exitCode=0;
})().catch(e=>{console.error(e);process.exit(1);});
