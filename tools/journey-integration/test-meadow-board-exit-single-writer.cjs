'use strict';
// b21 meadow-board-exit-single-writer (Mac c88320c1, FINDINGS §2 B: fr 7949/9900/12072). Each meadow board lens frames its own
// node; entering a level ran RegionJourneyCore.restore() in the same frame as region.node-lens and re-placed the sail-arrival
// checkpoint (-9.247,11.337,57.032 fov 49.426): MULTI=2, JUMP 10.9-11.5 m, FOV +6.
// Runs the REAL WorldFlowCore + RegionJourneyCore (meadow journey checkpoint), RegionNodeStage's REAL handJourneyLive() source
// and WorldFlowComponent's REAL holds() rule (same pose => no write), then replays: node lens on the per-node board lens (Mac
// poses) -> board pan write -> enterLevel (restore) in the SAME frame -> enter-level push-in from the live lens at 60 / 30 /
// uneven dt (LCG [1/90,1/45]). Asserts per frame: exactly one writer, step <= 0.5 m, speed <= 8 m/s, yaw/pitch <= 90 deg/s,
// turn accel p99 <= 200 deg/s^2, fov <= 1.5 deg/frame. Must-fail: without the handover the same replay FAILs (negative).
// QF_NODE_STAGE_FILE=<c88320c1 RegionNodeStage.ts> => FAIL (no handover).
const assert=require('assert'),fs=require('fs'),path=require('path');
const SRC=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const NS=process.env.QF_NODE_STAGE_FILE||path.join(SRC,'world-r2/RegionNodeStage.ts'),ns=fs.readFileSync(NS,'utf8');
const wfc=fs.readFileSync(path.join(SRC,'world-r1/WorldFlowComponent.ts'),'utf8');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const tr=c=>ts.transpileModule(c,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
// --- real handover source (RegionNodeStage) ---
function handSource(src){const i=src.indexOf(' private handJourneyLive():boolean{');if(i<0)return null;const j=src.indexOf('\n }\n',i);return src.slice(i,j+3).replace(' private ',' ');}
const wired=s=>/else if\(this\.region==='meadow'&&this\.lens==='Board'\)this\.handJourneyLive\(\)/.test(s)&&/this\.orbit\.armBoard\(\);\n  if\(this\.region==='meadow'\)this\.handJourneyLive\(\)/.test(s);
// --- real holds() (WorldFlowComponent, frozen: read only) ---
const hi=wfc.indexOf('const holds=(cp:CameraPose):boolean=>');assert.ok(hi>=0,'WorldFlowComponent holds() moved');
assert.ok(/if\(holds\(cp\)\)\{placed=pose;placedN=cameraWriteLog\.writes;return/.test(wfc),'WorldFlowComponent setCamera no longer skips a held pose');
const D=Math.PI/180;
function rotOf(p){const f=p.target.map((x,i)=>x-p.position[i]),l=Math.hypot(...f);return {yaw:Math.atan2(-f[0],-f[2])/D,pitch:Math.asin(f[1]/l)/D};}
function poseYP(pos,yaw,pitch,fov){const y=yaw*D,p=pitch*D,f=[-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p)];return {position:pos.slice(),target:pos.map((x,i)=>x+f[i]*10),fovVerticalDeg:fov};}
const same=(a,b)=>Math.hypot(...a.position.map((x,i)=>x-b.position[i]))<=1e-3&&Math.abs(a.fovVerticalDeg-b.fovVerticalDeg)<=1e-3&&Math.abs(rotOf(a).yaw-rotOf(b).yaw)<1e-4&&Math.abs(rotOf(a).pitch-rotOf(b).pitch)<1e-4;
const ARRIVAL=poseYP([-9.247,11.337,57.032],171.469,-12.994,49.426);// RegionJourneyCore checkpoint (Mac fr 7949 restore pose)
const BOARD=[poseYP([-5.893,11.302,66.516],171.469,-12.994,43.426),poseYP([-7.715,11.512,67.893],171.469,-12.994,43.426),poseYP([-14.503,12.355,65.97],171.469,-12.994,43.426)];// node lens on M2/M3/M4 (Mac fr 7934/9888/12060)
function lcg(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return 1/90+(s/4294967296)*(1/45-1/90);};}
async function replay(handSrc,board,dtMode){
 const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness(),{WorldFlow}=H.load('world-r1/WorldFlowCore'),{RegionJourneyController}=H.load('world-r1/RegionJourneyCore');
 const zero=[0,0,0],seat={position:zero,back:[0,0,-1],yawRad:0,seatedFoot:zero,standingFoot:zero,seatedControllerRoot:zero,standingControllerRoot:zero};
 const config={seat,toDoor:[zero,[0,0,1]],outCrossing:[[0,0,1],[0,0,2]],toIsland:[[0,0,2],[0,0,3]],toThreshold:[[0,0,3],[0,0,2]],inCrossing:[[0,0,2],[0,0,1]],toSeat:[[0,0,1],zero],cameraHome:ARRIVAL,cameraToDoor:[ARRIVAL,ARRIVAL],cameraInside:ARRIVAL,cameraOutside:ARRIVAL,cameraIsland:ARRIVAL,openDeg:90,speed:1};
 let fr=0,camera=ARRIVAL;const writes=[];
 const write=(p,source)=>{if(same(p,camera))return false/* holds(): the camera already shows it */;camera=p;writes.push({fr,source,p});return true;};
 let push=null;
 const actor={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:zero,seatedRoot:zero,seatYawRad:0,clearanceRadiusM:.1},advance(){},walkProgress:()=>1,perform:async()=>{},cancelAndReset(){},setVisible(){},dispose(){}};
 const world={setCamera:p=>write(p,'RegionJourneyCore:restore'),setLayers(){},setDoor(){},cancelTransient(){},assertStaticWorld(){},dispose(){},animateCamera:async(seq)=>{const e=seq&&seq[seq.length-1];if(e&&e.position)camera=e;},animateDoor:async()=>{},
  playEnterLevel:async()=>{push={from:camera,t:0};}};
 const journey=new RegionJourneyController({readCamera:()=>camera,prepare:async(from,to,start)=>({route:{from,to,path:[start,[start[0],start[1]+1,start[2]+4],[start[0],start[1]+1,start[2]+8]],bridgeStart:1,bridgeEnd:6,speed:1},show(){},dispose(){}})});
 const flow=new WorldFlow({config,character:actor,journey,skycity:{enter:async()=>({show(){},hide(){},dispose(){}})},levels:{enter:async()=>({requestExit:()=>({ok:true}),hide(){},showPaused(){},resume:()=>({ok:true}),dispose(){},isSettledResult:()=>false,reveal(){}})},loadWorld:async()=>world});
 assert((await flow.load()).ok);assert((await flow.leaveHome()).ok);assert((await flow.travelRegion('meadow')).ok);
 journey.camera=ARRIVAL;camera=ARRIVAL;// checkpoint = the sail-arrival lens (Mac restore pose), on screen
 // node lens (RegionNodeStage): writePose + its handover, exactly as compiled from the source under test
 const Stage=handSrc?new Function('return '+tr('(class{'+handSrc+'})').trim().replace(/;$/,''))():class{handJourneyLive(){return false;}};
 const stage=new Stage();stage.flow=()=>({flow});stage.region='meadow';stage.lens='Board';
 const nodeWrite=p=>{if(write(p,'region.node-lens')&&handSrc&&stage.region==='meadow'&&stage.lens==='Board')stage.handJourneyLive();};
 const series=[];const next=dtMode==='60'?()=>1/60:dtMode==='30'?()=>1/30:lcg(0x5eed);
 // fold end: the board lens frames her new node (restoreBoard -> handJourneyLive)
 fr=1;const p0=camera,dt0=next();stage.lens='FollowWalk';const steps=12;
 for(let k=1;k<=steps;k++){fr++;const u=k/steps,s=u*u*u*(u*(u*6-15)+10);const p={position:p0.position.map((x,i)=>x+(board.position[i]-x)*s),target:p0.target.map((x,i)=>x+(board.target[i]-x)*s),fovVerticalDeg:p0.fovVerticalDeg+(board.fovVerticalDeg-p0.fovVerticalDeg)*s};// (stand-in for the fold tail; motion not judged here)
  write(p,'region.node-lens');}
 stage.lens='Board';if(handSrc)stage.handJourneyLive();
 // the exit frame: a board pan write, then WorldFlowCore.restore() (-> RegionJourneyCore.restore) in the SAME frame, then enterLevel
 fr+=1;const exitFr=fr,before=camera;const pan=poseYP(board.position.map((x,i)=>x+(i===0?0.08:0)),rotOf(board).yaw,rotOf(board).pitch,board.fovVerticalDeg);nodeWrite(pan);
 flow.restore()/* WorldFlowCore.restore (board closed, stable meadow, visible): RegionJourneyCore.restore re-places the checkpoint */;
 const r=flow.enterLevel('mainline-06');
 await new Promise(res=>setImmediate(res));
 const exitWrites=writes.filter(w=>w.fr===exitFr);
 // enter-level push-in (WorldFlowComponent: from the LIVE camera, 0.78 s, easeIn .14 / easeOut .4): 2.6 m in, FOV -6
 assert.ok(push,'enter-level push-in never started');const from=push.from,dir=from.target.map((x,i)=>(x-from.position[i])/10),T=0.78;
 const end={position:from.position.map((x,i)=>x+dir[i]*2.6),target:from.target.map((x,i)=>x+dir[i]*2.6),fovVerticalDeg:from.fovVerticalDeg-6};
 series.push({t:0,p:before});series.push({t:dt0,p:camera});let t=0,tt=dt0;
 while(t<T){const dt=next();t=Math.min(T,t+dt);tt+=dt;fr++;const u=t/T,s=u*u*u*(u*(u*6-15)+10);write({position:from.position.map((x,i)=>x+(end.position[i]-x)*s),target:from.target.map((x,i)=>x+(end.target[i]-x)*s),fovVerticalDeg:from.fovVerticalDeg+(end.fovVerticalDeg-from.fovVerticalDeg)*s},'enter-level');series.push({t:tt,p:camera});}
 await r;
 return {exitWrites,series,writes};
}
function judge(res){const bad=[];const n=res.exitWrites.length;if(n!==1)bad.push('exit frame has '+n+' camera writes ('+res.exitWrites.map(w=>w.source).join(', ')+'); exactly one writer');
 let maxStep=0,maxV=0,maxW=0,maxF=0;const acc=[];let prevW=null;
 for(let i=1;i<res.series.length;i++){const a=res.series[i-1],b=res.series[i],dt=b.t-a.t;const d=Math.hypot(...b.p.position.map((x,k)=>x-a.p.position[k]));const ra=rotOf(a.p),rb=rotOf(b.p);const dy=Math.abs(((rb.yaw-ra.yaw+540)%360)-180),dp=Math.abs(rb.pitch-ra.pitch),w=Math.max(dy,dp)/dt;
  maxStep=Math.max(maxStep,d);maxV=Math.max(maxV,d/dt);maxW=Math.max(maxW,w);maxF=Math.max(maxF,Math.abs(b.p.fovVerticalDeg-a.p.fovVerticalDeg));if(prevW!==null)acc.push(Math.abs(w-prevW)/dt);prevW=w;}
 acc.sort((x,y)=>x-y);const p99=acc.length?acc[Math.min(acc.length-1,Math.floor(acc.length*0.99))]:0;
 if(maxStep>0.5)bad.push('step '+maxStep.toFixed(3)+' m > 0.5');if(maxV>8)bad.push('speed '+maxV.toFixed(2)+' m/s > 8');if(maxW>90)bad.push('view '+maxW.toFixed(1)+' deg/s > 90');if(p99>200)bad.push('turn accel p99 '+p99.toFixed(1)+' > 200');if(maxF>1.5)bad.push('fov '+maxF.toFixed(2)+' deg/frame > 1.5');
 return {bad,maxStep,maxV,maxW,p99,maxF};}
(async()=>{
 const hs=handSource(ns);const ok=!!hs&&wired(ns);
 // negative (must-fail): the c88320c1 order, no handover
 {const res=await replay(null,BOARD[0],'60');const j=judge(res);assert.ok(j.bad.length>0,'must-fail replay passed: the gate cannot see the c88320c1 cut');
  console.log('ok   must-fail (no handover, c88320c1 order): '+j.bad.join('; '));}
 if(!ok){console.error('FAIL RegionNodeStage has no meadow board handover (handJourneyLive + Board-lens/restoreBoard wiring): restore cuts to the arrival checkpoint');process.exit(1);}
 const out=[];
 for(const b of BOARD)for(const m of ['60','30','lcg']){const res=await replay(hs,b,m),j=judge(res);
  if(j.bad.length){console.error('FAIL board '+b.position.join(',')+' dt '+m+': '+j.bad.join('; '));process.exit(1);}
  out.push(j);console.log('ok   board '+b.position.join(',')+' dt '+m+': 1 writer on the exit frame; step '+j.maxStep.toFixed(3)+' m, '+j.maxV.toFixed(2)+' m/s, view '+j.maxW.toFixed(1)+' deg/s, accel p99 '+j.p99.toFixed(1)+', fov '+j.maxF.toFixed(2)+'/frame');}
 if(process.env.QF_MBX_JSON)fs.writeFileSync(process.env.QF_MBX_JSON,JSON.stringify(out));
 console.log('meadow-board-exit-single-writer: PASS');
})().catch(e=>{console.error(e);process.exit(1);});

// --- walk tail (Mac fr 7949 / 9900 / 12072: region.node-lens snapped 0.88 / 0.63 / 0.53 m in ONE frame, the frame before restore) ---
// The fold clock ends at walkS while her walk resolves later; c88320c1 froze the lens and the end write snapped to her stand.
// Compiles RegionNodeStage's REAL rideWalkTail() and drives it with update()'s anim loop; she walks the last 0.88 m at 1.2 m/s.
function tailSource(src){const i=src.indexOf(' private async rideWalkTail(');if(i<0)return null;const j=src.indexOf('\n }\n',i);return src.slice(i,j+3).replace(' private async ',' async ');}
const tailWired=s=>(s.match(/await this\.rideWalkTail\(walk,\(\)=>meadowFoldPose\(fold,this\.girl\(\),walkS\)\)/g)||[]).length===2;
async function tail(src,dtMode){
 const next=dtMode==='60'?()=>1/60:dtMode==='30'?()=>1/30:lcg(0xbeef);
 const off=[0.2,4.1,9.6];let her=[0,0,0];const pose=()=>({position:her.map((x,i)=>x+off[i]),target:her.slice(),fovVerticalDeg:43.426});
 let cam=pose(),steps=[];const W=s=>{const d=Math.hypot(...s.position.map((x,i)=>x-cam.position[i]));steps.push(d);cam=s;};
 const St=src?new Function('return '+tr('(class{'+src+'})').trim().replace(/;$/,''))():class{async rideWalkTail(){}};
 const st=new St();st.anim=null;st.orbit={pause(){}};st.writePose=W;
 const remain=0.88;let walked=0,resolveWalk;const walk=new Promise(r=>resolveWalk=r);
 const p=st.rideWalkTail(walk,pose);let t=0;
 for(let k=0;k<2000&&walked<remain;k++){await Promise.resolve();const dt=next();t+=dt;walked=Math.min(remain,walked+1.2*dt);her=[walked,0,0];
  if(st.anim){st.anim.t+=dt;if(st.anim.t<st.anim.seconds)st.anim.sample(st.anim.t);else{const d=st.anim.done;st.anim=null;d();}}}
 resolveWalk();await p;W(pose())/* meadowRewardFold's end write: she stands on the node */;
 return Math.max(...steps);}
(async()=>{await new Promise(r=>setTimeout(r,0));
 const neg=await tail(null,'60');assert.ok(neg>0.5,'must-fail tail replay passed ('+neg+')');console.log('ok   must-fail walk tail (no ride, c88320c1): end write snaps '+neg.toFixed(3)+' m in one frame');
 const ts_=tailSource(ns);if(!ts_||!tailWired(ns)){console.error('FAIL RegionNodeStage does not ride her walk tail on both meadow folds: the end write snaps up to 0.88 m');process.exit(1);}
 for(const m of ['60','30','lcg']){const mx=await tail(ts_,m);if(mx>0.5){console.error('FAIL walk tail dt '+m+': '+mx.toFixed(3)+' m/frame');process.exit(1);}console.log('ok   walk tail dt '+m+': max step '+mx.toFixed(3)+' m/frame (one writer: region.node-lens)');}
 console.log('meadow-board-exit-walk-tail: PASS');
})().catch(e=>{console.error(e);process.exit(1);});
