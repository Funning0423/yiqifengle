'use strict';
// coast-arrival-frame-margin (运镜bot, Grok Bot 2026-10-30 option A): her frame margin >= 0.08 over the WHOLE S6+S7 window
// (K.shots S6 18.675 s .. end of S7 42.175 s = coastBoardPose; after her replay ends (40.175 s) she stands on the stop root) on 7 screens,
// on the RUNTIME lens (bundles/region_coast/scripts/CoastArrivalLens.ts arrivalPose, decoded track) and her REAL root: for t >= 28.175 s
// the real FlowReferenceStandin + CharacterMotion walk (her_walk_replay.cjs, adapter.perform exactly like coastArrivalHer) at 60 fps,
// 30 fps and uneven dt (LCG [1/90,1/45]); before that she stands on the S6 root (arrivalHer, same clocks).
// margin = min over head top (root+1.62), feet (root+0.02), face (root+1.42) +-0.28 m camera-right, of x, 1-x, y, 1-y (screen fractions)
// = s6_walk_check.py definition. NEGATIVE self-test: the d08b5bc5 track (S6/S7 camera not retimed to the slow walk) must FAIL.
const cp=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const H=__dirname,ROOT=path.resolve(H,'../..'),A=path.join(ROOT,'creator-build-project/assets'),TRACK=path.join(A,'bundles/region_coast/scripts/CoastArrivalTrack');
const tr=src=>ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
function loader(trackSrc){const mods={};const load=abs=>{if(mods[abs])return mods[abs].exports;const m={exports:{}};mods[abs]=m;const dir=path.dirname(abs);
 const src=abs===TRACK&&trackSrc?trackSrc:fs.readFileSync(abs+'.ts','utf8');
 new Function('module','exports','require',tr(src))(m,m.exports,r=>r==='cc'?{}:r.endsWith('/CoastSceneLoader')?{}:r.startsWith('.')?load(path.resolve(dir,r)):require(r));return m.exports;};
 return load(path.join(A,'bundles/region_coast/scripts/CoastArrivalLens'));}
const SCREENS=['390x844','414x896','360x780','375x667','320x568','390x520','768x1024'],T0=18.675,T1=42.175,MIN=0.08;
const FACE=1.42,HEAD=1.62,HALF=0.28;
function margin(p,hp,w,h){const P=p.position,L=p.target,f=[L[0]-P[0],L[1]-P[1],L[2]-P[2]],fl=Math.hypot(...f);for(let k=0;k<3;k++)f[k]/=fl;
 let r=[-f[2],0,f[0]];const rl=Math.hypot(...r);r=r.map(v=>v/rl);const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const th=Math.tan(p.fovVerticalDeg*Math.PI/360),asp=w/h;let m=9;
 for(const q of [[hp[0],hp[1]+HEAD,hp[2]],[hp[0],hp[1]+0.02,hp[2]],[hp[0]+r[0]*HALF,hp[1]+FACE,hp[2]+r[2]*HALF],[hp[0]-r[0]*HALF,hp[1]+FACE,hp[2]-r[2]*HALF]]){
  const V=[q[0]-P[0],q[1]-P[1],q[2]-P[2]],z=V[0]*f[0]+V[1]*f[1]+V[2]*f[2];if(z<=0.05)return -9;
  const x=0.5+(V[0]*r[0]+V[1]*r[1]+V[2]*r[2])/z/(th*asp)/2,y=0.5-(V[0]*u[0]+V[1]*u[1]+V[2]*u[2])/z/th/2;m=Math.min(m,x,1-x,y,1-y);}
 return m;}
function lcg(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return 1/90+(1/45-1/90)*(s/4294967296);};}
function measure(CAL,RP){const res={};
 for(const run of RP){const clock=run.name==='60fps'?()=>1/60:run.name==='30fps'?()=>1/30:lcg(0x51f15e);const pre=[];let t=T0;while(t<run.frames[0].t-1e-9){pre.push({t,root:[...CAL.arrivalHer(t).root]});t+=clock();}
  const frames=pre.concat(run.frames.filter(f=>f.t>=T0-1e-9&&f.t<=T1+1e-9)),last=run.frames[run.frames.length-1];
  ok(Math.hypot(last.root[0]+0.6,last.root[2]-16.35)<1e-3,run.name+' replay did not end stopped on the S7 root');t=last.t+clock();while(t<=T1+1e-9){frames.push({t,root:last.root});t+=clock();}frames.push({t:T1,root:last.root});
  for(const s of SCREENS){const [w,h]=s.split('x').map(Number);let mm=9,mt=null,bad=0;
   for(const fr of frames){const m=margin(CAL.arrivalPose(w,h,fr.t),fr.root,w,h);if(m<mm){mm=m;mt=fr.t;}if(m<MIN)bad++;}
   (res[run.name]??={})[s]={min:mm,t:mt,bad,n:frames.length};}}
 return res;}
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}return c;};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'yj-fm-'));
try{const rp=path.join(tmp,'replay.json'),r=cp.spawnSync(process.execPath,[path.join(H,'her_walk_replay.cjs'),rp],{env:process.env,encoding:'utf8',maxBuffer:64<<20});
 if(r.status!==0)throw Error('replay failed: '+r.stderr);const RP=JSON.parse(fs.readFileSync(rp,'utf8'));
 ok(RP.length===3&&RP.every(x=>x.clips.includes('walk_start')&&x.clips.some(c=>/^walk_stop_body/.test(c))),'real walk clips '+RP.map(x=>x.clips.join('>')));
 const res=measure(loader(null),RP);
 for(const [cn,R] of Object.entries(res)){const row=[];for(const [s,v] of Object.entries(R)){ok(v.bad===0&&v.n>100,`${cn} ${s}: margin ${v.min.toFixed(4)} @ ${v.t} s, ${v.bad}/${v.n} frames < ${MIN}`);row.push(`${s} ${v.min.toFixed(3)}`);}
  console.log(`ok   ${cn} ${T0}-${T1} s min margin: ${row.join(' | ')}`);}
 // NEGATIVE: the d08b5bc5 track (camera not retimed: she walks out of the S6 framing) must FAIL
 const old=cp.spawnSync('git',['show','d08b5bc5:creator-build-project/assets/bundles/region_coast/scripts/CoastArrivalTrack.ts'],{cwd:ROOT,encoding:'utf8',maxBuffer:64<<20});
 if(ok(old.status===0&&old.stdout.includes('COAST_ARRIVAL_TRACK'),'selftest: d08b5bc5 track not readable ('+old.stderr+')')){
  const nr=measure(loader(old.stdout),RP),worst=Object.fromEntries(SCREENS.map(s=>[s,Math.min(...Object.values(nr).map(R=>R[s].min))]));
  ok(Object.values(nr).every(R=>Object.values(R).some(v=>v.bad>0)),'NEGATIVE: d08b5bc5 track passed the margin gate (gate blind)');
  console.log('ok   negative: d08b5bc5 track FAILS: '+SCREENS.map(s=>s+' '+worst[s].toFixed(3)).join(' | '));}
}catch(e){fails++;console.log('FAIL',e.stack||e);}finally{fs.rmSync(tmp,{recursive:true,force:true});}
if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-arrival-frame-margin');
