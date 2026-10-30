'use strict';
// coast-board-lens gate (运镜bot cine/b20-coast-board-lens). Default pose = 场景设计部 D2 (r5d game view); distance-only per aspect.
// 1) region/CoastBoardLens.ts: 7-screen distances = final_poses.json (r2 item 3 (i)); keep-out + tap rules on projected cells.
// 2) arrival push-in (journey S7, ref_transition.json (packed from out_v4 by pack_ref.py)): last frame == coastBoardPose(w,h);
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
// r2 item 3 final (Grok Bot ruling (i)): final_poses.json (python, keepout_r2 rule) = CoastBoardLens per screen; per-aspect projected
// cells: keep-out rule (cells + face >= 8 pt from the screen sides and the bands; compact HUD on portrait h<=600) and tap rule
// (far-row short side >= 28 pt, 0 wrong taps of 2000 +-8 pt per cell), shortest distance, D2 quat.
const FP=JSON.parse(fs.readFileSync(path.join(__dirname,'final_poses.json'),'utf8'));
const T={screens:Object.keys(FP).map(s=>({screen:s,...FP[s]}))};
const L=CB.COAST_MOTION_LIMITS;let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}};
ok(T.screens.length===7,'7 screens');
for(const r of T.screens){const [w,h]=r.screen.split('x').map(Number),d=CB.coastBoardDistance(w,h),p=CB.coastBoardPose(w,h).position,k=CB.coastKeepout(w,h);
 ok(Math.abs(d-r.distance_m)<1e-9,r.screen+' table '+d+' vs '+r.distance_m);
 ok(Math.hypot(p[0]-r.pos[0],p[1]-r.pos[1],p[2]-r.pos[2])<2e-3,r.screen+' pos '+p);
 ok(k.compact===(h<=600)&&k.compact===(r.band_kind==='compact')&&Math.abs(k.top-r.band_pt[0])<0.05&&Math.abs(k.tool-r.band_pt[1])<0.05,r.screen+' keep-out band '+JSON.stringify(k)+' vs '+r.band_pt);
 ok(CB.coastBoardKeepoutFits(d,w,h),r.screen+' keep-out rule at '+d);ok(!CB.coastBoardKeepoutFits(d-0.002,w,h),r.screen+' not the shortest keep-out distance');
 const C=CB.coastCellCentres(d,w,h),tp=CB.coastBoardTap(d,w,h);ok(C.every(([x,y])=>x>=8&&x<=w-8&&y>=k.top+8&&y<=k.tool-8),r.screen+' cell centre in a keep-out band');
 ok(tp.farShortPt>=28&&tp.wrongTaps===0&&tp.taps===98000,`${r.screen} tap far short ${tp.farShortPt} pt wrong ${tp.wrongTaps}`);
 ok(Math.abs(tp.farShortPt-r.far_short_pt)<=0.1&&r.pass===true&&r.wrong_taps===0,r.screen+' TS tap != python '+r.far_short_pt);
 const q=CP.rotationFromLookAt(p,CB.coastBoardTarget());ok(Math.abs(Math.abs(q[0]*0+q[1]*0.851965+q[2]*0.523599+q[3]*0)-1)<1e-5,r.screen+' quat != D2');
 console.log(`ok   1 ${r.screen} ${k.compact?'compact':'current'} HUD [0,${k.top}]/${k.tool}: D ${d}, far-row short ${tp.farShortPt} pt, wrong ${tp.wrongTaps}/${tp.taps}`);}
// 2
function motion(rs){let vmax=0,smax=0,wmax=0,fmax=0,at=0;const acc=[];let pw=null;const ang=x=>{const f=[x[6]-x[3],x[7]-x[4],x[8]-x[5]],l=Math.hypot(...f);return [Math.atan2(f[0],f[2])*180/Math.PI,Math.asin(f[1]/l)*180/Math.PI];};
 for(let i=1;i<rs.length;i++){const a=rs[i-1],b=rs[i],dt=b[1]-a[1],st=Math.hypot(b[3]-a[3],b[4]-a[4],b[5]-a[5]),A=ang(a),B=ang(b),dy=((B[0]-A[0]+540)%360)-180,wv=[dy/dt,(B[1]-A[1])/dt];
  if(st/dt>vmax){vmax=st/dt;at=b[1];}smax=Math.max(smax,st);wmax=Math.max(wmax,Math.abs(wv[0]),Math.abs(wv[1]));fmax=Math.max(fmax,Math.abs(b[9]-a[9]));if(pw)acc.push(Math.max(Math.abs(wv[0]-pw[0]),Math.abs(wv[1]-pw[1]))/dt);pw=wv;}
 acc.sort((a,b)=>a-b);return {vmax,smax,wmax,fmax,p99:acc[Math.floor(0.99*(acc.length-1))],at};}
const within=m=>m.vmax<=8&&m.smax<=0.5&&m.wmax<=90&&m.p99<=200&&m.fmax<=1.5;
const REF=(R=>{if(R.v!==2)return R;const dec=(a,n,f0)=>{const cols=[];for(let c=0;c<7;c++){let v=0;const col=[];for(let i=0;i<n;i++){v+=a[c*n+i];col.push(v/R.scale);}cols.push(col);}
  return Array.from({length:n},(_,i)=>[(f0+i)/R.fps,...cols.map(c=>c[i])]);};
 return {shared:dec(R.shared,R.n_shared,0),s7:Object.fromEntries(Object.keys(R.s7).map(s=>[s,dec(R.s7[s],R.s7_len[s],R.n_shared-1)])),summary:R.summary};})(JSON.parse(fs.readFileSync(path.join(__dirname,'ref_transition.json'),'utf8'))),OLD=JSON.parse(fs.readFileSync(path.join(__dirname,'ref_old.json'),'utf8'));
const MODE=process.env.QF_COAST_REF||'current';   // 'old-s1' / 'old-s3': negative checks on the stored pre-fix numbers (must FAIL)
const X=f=>[0,f[0],0,f[1],f[2],f[3],f[4],f[5],f[6],f[7]];
for(const r of T.screens){const [w,h]=r.screen.split('x').map(Number);
 const rows=(MODE==='old-s1'?OLD.s1_old.shared:REF.shared.concat(REF.s7[r.screen].slice(1))).map(X);
 const sm=MODE==='old-s3'?OLD.s3_old[r.screen]:MODE==='old-s1'?OLD.s1_old.summary[r.screen]:REF.summary[r.screen];
 const g={first_frame_eq_live:sm.first_frame_eq_live,travel_ground_min:sm.travel_ground_min,travel_solid_min:sm.travel_solid_min,occlusion_worst_s:sm.occlusion_worst_s,screens:[{min_margin:sm.min_margin,at_t:sm.at_t,face_under_menu:sm.face_under_menu}]},e={s7_start:sm.s7_start,total:sm.total};
 const last=REF.s7[r.screen][REF.s7[r.screen].length-1].length?X(REF.s7[r.screen][REF.s7[r.screen].length-1]):null,to=CB.coastBoardPose(w,h);
 ok(Math.hypot(last[3]-to.position[0],last[4]-to.position[1],last[5]-to.position[2])<2e-4&&Math.hypot(last[6]-to.target[0],last[7]-to.target[1],last[8]-to.target[2])<2e-4&&Math.abs(last[9]-to.fovVerticalDeg)<1e-9,r.screen+' S7 last frame != board pose');
 ok(g.first_frame_eq_live===true,r.screen+' first frame != live lens');ok(g.travel_ground_min>=1.5&&g.travel_solid_min>=0.5,r.screen+' clearance');
 const S1END=(sm.shots||REF.summary[r.screen].shots)[1];
 const s7=MODE==='old-s1'?rows:REF.s7[r.screen].map(X);let vmax=0,smax=0,wmax=0,fmax=0;const acc=[];let pw=null;
 for(let i=1;i<s7.length;i++){const a=s7[i-1],b=s7[i],dt=b[1]-a[1],st=Math.hypot(b[3]-a[3],b[4]-a[4],b[5]-a[5]);
  const ang=x=>{const f=[x[6]-x[3],x[7]-x[4],x[8]-x[5]],l=Math.hypot(...f);return [Math.atan2(f[0],f[2])*180/Math.PI,Math.asin(f[1]/l)*180/Math.PI];};
  const A=ang(a),B=ang(b),dy=((B[0]-A[0]+540)%360)-180,wv=[dy/dt,(B[1]-A[1])/dt];
  vmax=Math.max(vmax,st/dt);smax=Math.max(smax,st);wmax=Math.max(wmax,Math.abs(wv[0]),Math.abs(wv[1]));fmax=Math.max(fmax,Math.abs(b[9]-a[9]));
  if(pw)acc.push(Math.max(Math.abs(wv[0]-pw[0]),Math.abs(wv[1]-pw[1]))/dt);pw=wv;}
 acc.sort((a,b)=>a-b);const p99=acc[Math.floor(0.99*(acc.length-1))];
 ok(vmax<=L.speedMS&&smax<=L.stepMPerFrame&&wmax<=L.yawPitchDegS&&p99<=L.angAccP99DegS2&&fmax<=L.fovDegPerFrame,`${r.screen} S7 motion v ${vmax.toFixed(2)} step ${smax.toFixed(3)} w ${wmax.toFixed(1)} acc99 ${p99.toFixed(1)} fov ${fmax.toFixed(3)}`);
 // v4.2 S3 threshold: her frame margin >= 0.08 on every frame (true vertical fov), menu never over her face, face blocked <= 0.5 s
 const sc=g.screens[0];ok(sc.min_margin>=0.08&&sc.face_under_menu===0&&g.occlusion_worst_s<=0.5,`${r.screen} her margin ${sc.min_margin} at t ${sc.at_t} / menu ${sc.face_under_menu} / blocked ${g.occlusion_worst_s} s`);
 // v4.1 map-collapse threshold: the WHOLE island->coast transition (S1 map-collapse included) within the limits, total <= 45 s
 const W=motion(rows);ok(within(W),`${r.screen} whole transition v ${W.vmax.toFixed(2)} m/s at t ${W.at.toFixed(2)} step ${W.smax.toFixed(3)} w ${W.wmax.toFixed(1)} acc99 ${W.p99.toFixed(1)} fov ${W.fmax.toFixed(3)}`);ok(e.total<=45,r.screen+' total '+e.total);
 // r2 map-collapse (a): S1 straight dolly <= 7.2 s (S2 0.4 s unchanged), measured island->coast total <= 30.53 s; limits also at 30 fps (every 2nd frame)
 if(MODE==='current'){const sh=sm.shots;ok(sh[1]-sh[0]<=7.2+1e-6&&Math.abs(sh[2]-sh[1]-0.4)<1e-6,`${r.screen} S1 ${(sh[1]-sh[0]).toFixed(3)} s / S2 ${(sh[2]-sh[1]).toFixed(3)} s`);ok(e.total<=30.53,r.screen+' total '+e.total+' > 30.53');
  const W30=motion(rows.filter((_,i)=>i%2===0));ok(within(W30),`${r.screen} whole @30fps v ${W30.vmax.toFixed(2)} step ${W30.smax.toFixed(3)} w ${W30.wmax.toFixed(1)} acc99 ${W30.p99.toFixed(1)} fov ${W30.fmax.toFixed(3)}`);
  const S1=motion(rows.filter(x=>x[1]<=sh[1]+1e-9));console.log(`ok   2 ${r.screen} S1 ${(sh[1]-sh[0]).toFixed(2)} s: v ${S1.vmax.toFixed(2)} m/s, step ${S1.smax.toFixed(3)}; @30fps whole v ${W30.vmax.toFixed(2)}, step ${W30.smax.toFixed(3)}, acc p99 ${W30.p99.toFixed(1)}`);}
 console.log(`ok   2 ${r.screen} whole ${e.total.toFixed(2)} s: v ${W.vmax.toFixed(2)} m/s, step ${W.smax.toFixed(3)}, yaw/pitch ${W.wmax.toFixed(1)}, acc p99 ${W.p99.toFixed(1)}, fov ${W.fmax.toFixed(3)}`);
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
if(MODE==='current')for(const m of ['old-s1','old-s3']){const r=cp.spawnSync(process.execPath,[__filename],{env:{...process.env,QF_COAST_REF:m},encoding:'utf8'});ok(r.status===1,'negative '+m+' did not FAIL');if(r.status===1)console.log('ok   negative '+m+' FAILs as required');}
if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-board-lens');
