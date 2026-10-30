'use strict';
// coast-board-lens gate (运镜bot cine/b20-coast-board-lens). Default pose = 场景设计部 D2 (r5d game view); distance-only per aspect.
// 1) region/CoastBoardLens.ts: 7-screen distances = scene_d2_table.json (python, real r5d mesh); the TS solver reproduces them;
//    margin >=0.08 for board + her; proposal kept where it already passes.
// 2) arrival push-in (journey S7, tools/coast-transition-draft/out_v4/<screen>/frames.csv): last frame == coastBoardPose(w,h);
//    first frame == live island lens; motion limits per real dt over S7: yaw/pitch <=90 deg/s, ang accel p99 <=200, <=8 m/s,
//    <=0.5 m/frame, fov <=1.5 deg/frame; ground >=1.5 m, solids >=0.5 m (gates.json).
// 3) enter-level with the board pose set (diff 01 applied to a temp copy of WorldFlowComponent.ts): live == board pose -> 0 writes;
//    live elsewhere -> only 'world.enterLevel' writes, <=1 per frame, last == board pose, within limits; after the reveal 0 writes.
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts');
const tr=src=>ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
const mods={};function load(rel){if(mods[rel])return mods[rel].exports;const m={exports:{}};mods[rel]=m;const dir=path.dirname(rel);
 new Function('module','exports','require',tr(fs.readFileSync(path.join(S,rel+'.ts'),'utf8')))(m,m.exports,r=>r.startsWith('.')?load(path.join(dir,r)):require(r));return m.exports;}
const CP=load('world-r1/CameraPose'),CB=load('region/CoastBoardLens');
const T=JSON.parse(fs.readFileSync(path.join(__dirname,'scene_d2_table.json'),'utf8'));
const L=CB.COAST_MOTION_LIMITS;let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}};
// 1
for(const r of T.screens){const [w,h]=r.screen.split('x').map(Number),d=CB.coastBoardDistance(w,h),p=CB.coastBoardPose(w,h).position;
 ok(Math.abs(d-r.distance_m)<1e-9,r.screen+' table '+d+' vs '+r.distance_m);
 ok(Math.hypot(p[0]-r.pos[0],p[1]-r.pos[1],p[2]-r.pos[2])<2e-3,r.screen+' pos '+p);
 ok(r.final_pass&&r.final.board_margin>=0.08&&r.final.her_margin>=0.08&&!r.final.menu_over_face&&r.final.menu_over_cells===0,r.screen+' python checks');
 ok(CB.coastBoardFits(d,w,h),r.screen+' TS fit at '+d);
 if(d>T.proposal.distance+1e-6)ok(!CB.coastBoardFits(d-0.02,w,h),r.screen+' TS: not the shortest distance');
 else ok(Math.abs(d-T.proposal.distance)<1e-3&&r.as_proposed_pass,r.screen+' proposal kept only if it passes');
 const q=CP.rotationFromLookAt(p,CB.coastBoardTarget());ok(Math.abs(Math.abs(q[0]*0+q[1]*0.851965+q[2]*0.523599+q[3]*0)-1)<1e-5,r.screen+' quat != D2');}
console.log('ok   1 pose table: 7 screens, distance-only, margins >=0.08, menu clear');
// 2
const OUTV4=path.join(ROOT,'tools/coast-transition-draft/out_v4');
for(const r of T.screens){const dir=path.join(OUTV4,r.screen),[w,h]=r.screen.split('x').map(Number);
 const rows=fs.readFileSync(path.join(dir,'frames.csv'),'utf8').trim().split('\n').slice(1).map(l=>l.split(',').map(Number)),g=JSON.parse(fs.readFileSync(path.join(dir,'gates.json'),'utf8')),e=JSON.parse(fs.readFileSync(path.join(dir,'end_pose.json'),'utf8'));
 const last=rows[rows.length-1],to=CB.coastBoardPose(w,h);
 ok(Math.hypot(last[3]-to.position[0],last[4]-to.position[1],last[5]-to.position[2])<1e-4&&Math.hypot(last[6]-to.target[0],last[7]-to.target[1],last[8]-to.target[2])<1e-4&&Math.abs(last[9]-to.fovVerticalDeg)<1e-9,r.screen+' S7 last frame != board pose');
 ok(g.first_frame_eq_live===true,r.screen+' first frame != live lens');ok(g.travel_ground_min>=1.5&&g.travel_solid_min>=0.5,r.screen+' clearance');
 const s7=rows.filter(x=>x[1]>=e.s7_start-1e-9);let vmax=0,smax=0,wmax=0,fmax=0;const acc=[];let pw=null;
 for(let i=1;i<s7.length;i++){const a=s7[i-1],b=s7[i],dt=b[1]-a[1],st=Math.hypot(b[3]-a[3],b[4]-a[4],b[5]-a[5]);
  const ang=x=>{const f=[x[6]-x[3],x[7]-x[4],x[8]-x[5]],l=Math.hypot(...f);return [Math.atan2(f[0],f[2])*180/Math.PI,Math.asin(f[1]/l)*180/Math.PI];};
  const A=ang(a),B=ang(b),dy=((B[0]-A[0]+540)%360)-180,wv=[dy/dt,(B[1]-A[1])/dt];
  vmax=Math.max(vmax,st/dt);smax=Math.max(smax,st);wmax=Math.max(wmax,Math.abs(wv[0]),Math.abs(wv[1]));fmax=Math.max(fmax,Math.abs(b[9]-a[9]));
  if(pw)acc.push(Math.max(Math.abs(wv[0]-pw[0]),Math.abs(wv[1]-pw[1]))/dt);pw=wv;}
 acc.sort((a,b)=>a-b);const p99=acc[Math.floor(0.99*(acc.length-1))];
 ok(vmax<=L.speedMS&&smax<=L.stepMPerFrame&&wmax<=L.yawPitchDegS&&p99<=L.angAccP99DegS2&&fmax<=L.fovDegPerFrame,`${r.screen} S7 motion v ${vmax.toFixed(2)} step ${smax.toFixed(3)} w ${wmax.toFixed(1)} acc99 ${p99.toFixed(1)} fov ${fmax.toFixed(3)}`);
 console.log(`ok   2 ${r.screen} S7 ${(e.total-e.s7_start).toFixed(2)} s: v ${vmax.toFixed(2)} m/s, step ${smax.toFixed(3)} m, yaw/pitch ${wmax.toFixed(1)} deg/s, acc p99 ${p99.toFixed(1)}, fov ${fmax.toFixed(3)}; ends on board pose`);}
// 3
const WFC=path.join(S,'world-r1/WorldFlowComponent.ts'),DIFF=path.join(ROOT,'..','team/cinematic/outbox/20261030-coast-board-lens/01-WorldFlowComponent-enter-level-board-pose.diff');
const diffFile=process.env.QF_COAST_LENS_DIFF||(fs.existsSync(DIFF)?DIFF:path.join(__dirname,'01-WorldFlowComponent-enter-level-board-pose.diff'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cbl-'));fs.mkdirSync(path.join(tmp,'creator-build-project/assets/scripts/world-r1'),{recursive:true});
const tf=path.join(tmp,'creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts');fs.copyFileSync(WFC,tf);
let src=fs.readFileSync(tf,'utf8');if(!src.includes('setEnterLevelEnd(')){cp.execFileSync('git',['apply','--unsafe-paths','--directory=.',diffFile],{cwd:tmp});src=fs.readFileSync(tf,'utf8');}
fs.rmSync(tmp,{recursive:true,force:true});
const cut=(a,b,from=0)=>{const i=src.indexOf(a,from);assert.ok(i>=0,'source moved: '+a);const j=src.indexOf(b,i);assert.ok(j>i,'source moved: '+b);return src.slice(i,j+b.length);};
const runM=cut('  private run(seconds:number','\n  }\n').replace('private run','run'),loop=cut('    for(const j of Array.from(this.jobs)) {','\n    }\n');
const look=cut('  private enterLevelLook():Pose[]|null {','\n  }\n').replace('private enterLevelLook','enterLevelLook');
const block=cut('          if(this.enterLevelEnd){','\n          }\n');
const code=`class W{constructor(camera){this.jobs=new Set();this.worldCamera=camera;this.enterLevelEnd=null;}noteCinematic(){}
 ${runM}
 ${look}
 step(frameDt){${loop}}
 play(camera,token){const ENTER_LEVEL_SHOT_S=0.78;${block} return 'generic';}}
module.exports=W;`;
const js=tr(code);
function run(livePose,w,h,dt){const writes=[];const director={fr:100,getTotalFrames(){return this.fr;}};
 const node={worldPosition:{x:0,y:0,z:0},worldRotation:{x:0,y:0,z:0,w:1},setWorldPosition(x,y,z){this.worldPosition={x,y,z};},setWorldRotation(x,y,z,w){this.worldRotation={x,y,z,w};}};
 const camera={node,fov:45};const cam0=CP.fromLookAt(livePose);node.worldPosition={x:cam0.position[0],y:cam0.position[1],z:cam0.position[2]};node.worldRotation={x:cam0.rotation[0],y:cam0.rotation[1],z:cam0.rotation[2],w:cam0.rotation[3]};camera.fov=cam0.fovVerticalDeg;
 globalThis.cc={director};const hook=CP.cameraWriteHook;const prev=hook.trace;hook.trace=s=>writes.push({fr:director.fr,s,p:[node.worldPosition.x,node.worldPosition.y,node.worldPosition.z],fov:camera.fov});
 const m={exports:{}};new Function('module','director','isValid','rotate','CAMERA_FIXED','samePose','coastPushSeconds','COAST_PUSH_EASE','createCameraTrack','camTag','Cancelled',js)(m,director,()=>true,CP.rotate,CP.CAMERA_FIXED,CB.samePose,CB.coastPushSeconds,CB.COAST_PUSH_EASE,CP.createCameraTrack,()=>{},class extends Error{});
 const W=m.exports,wf=new W(camera);wf.enterLevelEnd=()=>CB.coastBoardPose(w,h);const token={check(){},onCancel(){return ()=>{};}};
 const res=wf.play(camera,token);let frames=0;while(wf.jobs.size&&frames<2000){director.fr++;wf.step(dt);frames++;}
 const during=writes.length;for(let i=0;i<120;i++){director.fr++;wf.step(dt);}   // after the reveal: nothing may write
 hook.trace=prev;delete globalThis.cc;return {writes,during,after:writes.length-during,camera,res,frames};}
const live=CP.fromLookAt;for(const r of T.screens){const [w,h]=r.screen.split('x').map(Number),to=CB.coastBoardPose(w,h);
 const a=run(to,w,h,1/60);ok(a.writes.length===0,r.screen+' hold wrote '+a.writes.length);
 for(const dt of [1/60,1/30]){const from={position:[to.position[0]+1.2,to.position[1]+2.5,to.position[2]-2.0],target:to.target,fovVerticalDeg:42};
  const b=run(from,w,h,dt),per=new Map();for(const x of b.writes)per.set(x.fr,(per.get(x.fr)||0)+1);
  ok(b.writes.length>0&&b.writes.every(x=>x.s==='world.enterLevel'),r.screen+' writer set');ok(Math.max(...per.values())<=1,r.screen+' >1 write/frame');ok(b.after===0,r.screen+' writes after reveal '+b.after);
  const e=b.writes[b.writes.length-1];ok(Math.hypot(e.p[0]-to.position[0],e.p[1]-to.position[1],e.p[2]-to.position[2])<1e-6&&e.fov===to.fovVerticalDeg,r.screen+' push end != board pose');
  const sec=CB.coastPushSeconds(from,to,0.78);ok(CB.pushWithinLimits(CB.pushMotion(from,to,sec,dt)),r.screen+' push limits');
  let mx=0;for(let i=1;i<b.writes.length;i++)mx=Math.max(mx,Math.hypot(...b.writes[i].p.map((v,k)=>v-b.writes[i-1].p[k])));ok(mx<=L.stepMPerFrame&&mx/dt<=L.speedMS+1e-6,r.screen+' written step '+mx);}}
console.log('ok   3 enter-level: hold = 0 writes; push = enter-level only, <=1/frame, ends on the board pose, 0 writes after the reveal (60/30 fps)');
if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-board-lens');
