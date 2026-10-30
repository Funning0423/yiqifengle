'use strict';
// coast-arrival-runtime gate (运镜bot cine/b20-coast-arrival-runtime): measures the RUNTIME path — the real
// bundles/region_coast/scripts/CoastArrivalLens.ts (+ CoastArrivalTrack.ts) transpiled with the suite TS loader and driven
// frame by frame at 60 fps, 30 fps and uneven dt (LCG, dt in [1/90,1/45] s) on the 7 screens.
// Checks: one writer ('coast.arrival', <=1 write/frame, nothing else writes); last frame == coastBoardPose (so the enter-level
// push-in holds with 0 writes: WorldFlowComponent samePose, gated in coast-board-lens part 3); runtime camera == ref_transition.json
// (46459044) at every 60 fps frame: position <=1 mm, view direction <=0.01 deg, fov <=0.01 deg (v3 compact track); motion limits (<=8 m/s, <=0.5 m/frame, yaw/pitch <=90 deg/s,
// ang accel p99 <=200 deg/s^2, fov <=1.5 deg/frame) per clock; total <=42.18 s; S7 walk 1.2 m/s, settle lead 1.5-2.5 s; her clips
// walk_start -> walk_loop -> walk_stop_bodyL -> idle; corners >=2 pt; her-size (s7_her_size.json, Grok Bot 2026-10-30 final (a):
// t<=38.867 s >=0.06 and >=40 px, 390x520 >=38.5 px) re-tied to the runtime camera by digest; kit-off files byte-pinned.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets');
const tr=src=>ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
const mods={};function load(abs){if(mods[abs])return mods[abs].exports;const m={exports:{}};mods[abs]=m;const dir=path.dirname(abs);
 new Function('module','exports','require',tr(fs.readFileSync(abs+'.ts','utf8')))(m,m.exports,r=>r==='cc'?(globalThis.__yjCcStub||{}):(r.endsWith('/CoastSceneLoader')&&globalThis.__yjSceneStub)?globalThis.__yjSceneStub:r.startsWith('.')?load(path.resolve(dir,r)):require(r));return m.exports;}
const CP=load(path.join(A,'scripts/world-r1/CameraPose')),CB=load(path.join(A,'scripts/region/CoastBoardLens'));
const CAL=load(path.join(A,'bundles/region_coast/scripts/CoastArrivalLens'));
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}};
const SCREENS=['390x844','414x896','360x780','375x667','320x568','390x520','768x1024'],L=CB.COAST_MOTION_LIMITS;
// kit-off / frozen pins: default path byte-identical (these files are not touched by this branch)
const PIN={'scripts/CharacterMotion.ts':'3ef288ff12a8f8512e07a3ea2f94819e984cc70a9d9d4a38b5a9c69e1523b657','scripts/world-r2/WorldNativeComposition.ts':'eb3b3b2b491c6767f5d7b7855d8dd117e998b0b1baffa15995323f8e8da20803',
 'scripts/world-r1/WorldFlowComponent.ts':'e5d501a3f46ac6a9aac472f3d84eab949a50921ddd6e86b4b1a01abcc68ff487','scripts/WorldIntegrationBoot.ts':'19619af0b691b94d8d88031fb93e1cd28ef00ec1e5170b609286714faf7cb834',
 'scripts/regional-r05/runtime/coast-kit.js':'6ce4523fbf8aca24539384ce9c4bcfb49d6d7c94bbcdc2b9b5652ca05014d982'};
for(const [f,h] of Object.entries(PIN))ok(crypto.createHash('sha256').update(fs.readFileSync(path.join(A,f))).digest('hex')===h,'pinned file changed: '+f);
const REF=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/coast-board-lens/ref_transition.json'),'utf8'));
const dec=(a,n)=>{const out=Array.from({length:n},()=>[]);for(let c=0;c<7;c++){let v=0;for(let i=0;i<n;i++){v+=a[c*n+i];out[i].push(v);}}return out;};
const HS=JSON.parse(fs.readFileSync(path.join(__dirname,'s7_her_size_runtime.json'),'utf8'));  // re-measured on the DECODED runtime track (her_size_runtime.py)
function lcg(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return 1/90+(1/45-1/90)*(s/4294967296);};}
async function run(w,h,clock){const writes=[];let fr=0;const node={setWorldPosition(){},setWorldRotation(){}},camera={node,fov:45};
 const prev=CP.cameraWriteHook.trace;CP.cameraWriteHook.trace=s=>writes.push({fr,s});const poses=[],her=[];let t=0;
 const res=await CAL.playCoastArrival({camera,viewport:()=>({width:w,height:h}),nextFrame:async()=>{fr++;const dt=clock();t+=dt;return dt;},her:f=>her.push({...f,root:[...f.root],heading:[...f.heading]}),
  });CP.cameraWriteHook.trace=prev;return {writes,res,her};}
function poseAt(w,h,t){return CAL.arrivalPose(w,h,t);}
function motion(samples){let vmax=0,smax=0,wmax=0,fmax=0;const ay=[],ap=[];let pw=null;
 const yp=p=>{const f=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(...f);return [Math.atan2(f[0],f[2])*180/Math.PI,Math.asin(f[1]/l)*180/Math.PI];};
 for(let i=1;i<samples.length;i++){const [t0,a]=samples[i-1],[t1,b]=samples[i],dt=t1-t0;if(dt<=0)continue;const s=Math.hypot(...b.position.map((v,k)=>v-a.position[k]));smax=Math.max(smax,s);vmax=Math.max(vmax,s/dt);
  fmax=Math.max(fmax,Math.abs((b.fovVerticalDeg??50)-(a.fovVerticalDeg??50)));const [y0,p0]=yp(a),[y1,p1]=yp(b);let dy=y1-y0;if(dy>180)dy-=360;if(dy<-180)dy+=360;const wy=dy/dt,wp=(p1-p0)/dt;
  wmax=Math.max(wmax,Math.abs(wy),Math.abs(wp));if(pw){ay.push(Math.abs(wy-pw[0])/dt);ap.push(Math.abs(wp-pw[1])/dt);}pw=[wy,wp];}
 const q=a=>{a.sort((x,y)=>x-y);return a[Math.floor(0.99*(a.length-1))]||0;};return {vmax,smax,wmax,fmax,p99:Math.max(q(ay),q(ap))};}  // yaw and pitch p99 separately, the larger one gated
const DEV=[];
(async()=>{
 const total=CAL.COAST_ARRIVAL_TOTAL_S,TK=load(path.join(A,'bundles/region_coast/scripts/CoastArrivalTrack')).COAST_ARRIVAL_TRACK,[ws,we]=TK.walk;
 ok(total<=42.18,'total '+total);ok(Math.abs(5.1/(we-ws)-1.2)<1e-3,'walk speed '+(5.1/(we-ws)));ok(total-we>=1.5-1e-6&&total-we<=2.5+1e-6,'settle lead '+(total-we));
 console.log(`ok   total ${total.toFixed(3)} s, walk ${ws.toFixed(3)}-${we.toFixed(3)} s (1.2 m/s), settle lead ${(total-we).toFixed(3)} s`);
 for(const s of SCREENS){const [w,h]=s.split('x').map(Number),to=CB.coastBoardPose(w,h);
  // runtime vs ref (60 fps keys)
  const ref=dec(REF.shared,REF.n_shared).concat(dec(REF.s7[s],REF.s7_len[s]).slice(1));let dpos=0,dang=0,dfov=0;
  const fwd=(p,q)=>{const f=[q[0]-p[0],q[1]-p[1],q[2]-p[2]],l=Math.hypot(...f);return f.map(v=>v/l);};
  for(let i=0;i<ref.length-1;i++){const p=poseAt(w,h,i/60),r=ref[i].map(v=>v/1e4);dpos=Math.max(dpos,Math.hypot(p.position[0]-r[0],p.position[1]-r[1],p.position[2]-r[2]));
   const a=fwd(p.position,p.target),b=fwd(r.slice(0,3),r.slice(3,6));dang=Math.max(dang,Math.acos(Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2]))*180/Math.PI);dfov=Math.max(dfov,Math.abs(p.fovVerticalDeg-r[6]));}
  const dmax=dpos;ok(dpos<=1e-3&&dang<=0.01&&dfov<=0.01,`${s} runtime vs ref: position ${(dpos*1000).toFixed(3)} mm (<=1), view ${dang.toFixed(4)} deg (<=0.01), fov ${dfov.toFixed(4)} deg (<=0.01)`);
  DEV.push([s,dpos,dang,dfov]);
  // her-size digest on the runtime camera
  const S=HS.screens[s],RR=CAL.arrivalRows(s),dig=[0,0,0,0,0,0,0];for(const [t] of S.samples){const v=RR[Math.round(t*60)];for(let k=0;k<7;k++)dig[k]+=Math.round(v[k]*1e4);}
  ok(dig.every((v,k)=>v===S.cam_digest[k]),s+' her-size digest on the runtime camera '+JSON.stringify(dig));
  const px=HS.exc[s]??HS.px_min,g=S.samples.filter(x=>x[0]<=HS.cutoff+1e-6),bad=g.filter(x=>!(x[1]>=HS.frac_min&&x[2]>=px));ok(HS.cutoff===38.867&&bad.length===0,s+' her size '+JSON.stringify(bad.slice(0,2)));
  ok(CB.COAST_CORNER_EXEMPT.includes(s)||CB.coastBoardCornerGap(CB.coastBoardDistance(w,h),w,h)>=2.0,s+' corner gap');
  const line=[];
  for(const [name,clock] of [['60fps',()=>1/60],['30fps',()=>1/30],['uneven',lcg(0x51f15e^w^h)]]){
   const r=await run(w,h,clock),per=new Map();for(const x of r.writes)per.set(x.fr,(per.get(x.fr)||0)+1);
   ok(r.res.ok&&r.writes.length===r.res.frames&&r.writes.every(x=>x.s==='coast.arrival')&&Math.max(...per.values())===1,`${s} ${name} single writer (${r.writes.length} writes / ${r.res.frames} frames)`);
   let t=0;const samples=[];const clk=name==='60fps'?()=>1/60:name==='30fps'?()=>1/30:lcg(0x51f15e^w^h);for(let i=0;i<r.res.frames;i++){samples.push([t,poseAt(w,h,t)]);t=Math.min(total,t+clk());}
   const last=samples[samples.length-1][1];ok(last===undefined||(Math.hypot(...last.position.map((v,k)=>v-to.position[k]))<1e-12&&last.fovVerticalDeg===to.fovVerticalDeg),s+' '+name+' last != board pose');
   ok(CB.samePose(CP.fromLookAt(last,last.fovVerticalDeg),to),s+' '+name+' enter-level would not hold');
   const m=motion(samples);ok(m.vmax<=L.speedMS&&m.smax<=L.stepMPerFrame&&m.wmax<=L.yawPitchDegS&&m.p99<=L.angAccP99DegS2&&m.fmax<=L.fovDegPerFrame,`${s} ${name} limits ${JSON.stringify(m)}`);
   const cl=r.her.map(f=>f.clip),seq=cl.filter((c,i)=>i===0||c!==cl[i-1]),tail=seq.slice(seq.lastIndexOf('walk_start'));
   ok(tail.join()==='walk_start,walk_loop,walk_stop_bodyL,idle_breathing_loop',`${s} ${name} S7 clips ${tail.join()}`);
   const stop=r.her[r.her.length-1].root;ok(Math.abs(stop[0]+0.6)<1e-3&&Math.abs(stop[2]-16.35)<1e-3,s+' stop root '+stop);
   line.push(`${name} v ${m.vmax.toFixed(2)} step ${m.smax.toFixed(3)} w ${m.wmax.toFixed(1)} acc99 ${m.p99.toFixed(1)} fov ${m.fmax.toFixed(3)}`);}
  console.log(`ok   ${s}: runtime vs ref ${(DEV[DEV.length-1][1]*1000).toFixed(3)} mm / ${DEV[DEV.length-1][2].toFixed(4)} deg / fov ${DEV[DEV.length-1][3].toFixed(4)} deg, 1 writer, ends on board pose; ${line.join(' | ')}`);}
 // self-tests: a second writer, a missing end pose and a too-fast clock are caught
 {const writes=[{fr:1,s:'coast.arrival'},{fr:1,s:'world.enterLevel'}],per=new Map();for(const x of writes)per.set(x.fr,(per.get(x.fr)||0)+1);ok(Math.max(...per.values())===2&&!writes.every(x=>x.s==='coast.arrival'),'selftest second writer');
  const m=motion([[0,{position:[0,0,0],target:[0,0,1],fovVerticalDeg:50}],[1/60,{position:[0,0,0.6],target:[0,0,1.6],fovVerticalDeg:50}]]);ok(m.smax>L.stepMPerFrame,'selftest step');
  console.log('ok   self-tests (second writer, step >0.5 m caught)');}
 if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-arrival-runtime');
})().catch(e=>{console.log('FAIL '+(e&&e.stack||e));process.exit(1);});
