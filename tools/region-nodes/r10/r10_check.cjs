'use strict';
// 运镜bot r10 spec check: evaluates the r10 pose function (r10_model.cjs) on the real room geometry and prints every
// R10_SPEC.md metric against its threshold. Exit 1 if any r10 threshold fails.
//   node r10_check.cjs [--variants] [--json OUT.json] [--trace OUT.json]   (QF_TYPESCRIPT_MODULE -> typescript)
// --variants: also evaluates the alternatives the spec compares (profiles, band widths, r9-style).
const fs=require('node:fs');
const M=require('./r10_model.cjs');
const {C,L,R10,poseR10,poseR9,onScreen,herEdge,omegaPer,wallGap,herGap,HER_C,sub,nrm,D2R,SAFE}=M;
const KAPPA=110/(30*30),LAMBDA=3/(30*30),H=0.25,PITCHES=[L.pitchMinDeg,10,L.pitchMaxDeg],DISTS=[L.distMax,2.6,L.distMin];
const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null};
// θ sweep: per (pitch, dist) sample 0..360 every H degrees; curvature of the view (|dΩ/dθ|, Ω = view rotation per input
// degree, roll-free camera frame) and of the lens path (|d²p/dθ²|), framing, clearances.
function sweep(poseFn,P){const rows=[];let tr=null;
 for(const pitch of PITCHES)for(const dist of DISTS){const n=Math.round(360/H),S=[];
  for(let i=-2;i<=n+2;i++){const th=((i*H)%360+360)%360,p=poseFn(th,pitch,dist,P);S.push({th:i*H,...p})}
  const r={pitch,dist,maxCurv:0,maxCurvAt:0,maxPosCurv:0,minJ:9,maxJ:0,maxJBand:0,minJBand:9,wStarCentre:1,wStarSafe:1,coreSafeOut:0,coreWorstEdge:0,minHer:9,minWall:9,maxY:0,bandFrames:0,curvBand:0};
  const Om=[];for(let i=0;i<S.length-1;i++)Om.push(omegaPer(S[i].f,S[i+1].f,H));
  const T=[];
  for(let i=2;i<S.length-2;i++){const s=S[i],a=Om[i-1],b=Om[i],curv=nrm(sub(b,a))/H,J=nrm(b),Jy=b[1];   // Jy: view yaw rate per input yaw (sign)
   const pc=nrm([0,1,2].map(k=>(S[i+1].lens[k]-2*s.lens[k]+S[i-1].lens[k])/H/H));
   const ce=onScreen(s.lens,s.f,HER_C),se=herEdge(s.lens,s.f);
   if(curv>r.maxCurv){r.maxCurv=curv;r.maxCurvAt=s.th}r.maxPosCurv=Math.max(r.maxPosCurv,pc);r.minJ=Math.min(r.minJ,Jy);r.maxJ=Math.max(r.maxJ,J);
   if(s.w>0&&s.w<1){r.bandFrames++;r.maxJBand=Math.max(r.maxJBand,J);r.minJBand=Math.min(r.minJBand,J);r.curvBand=Math.max(r.curvBand,curv)}
   if(ce.e>1)r.wStarCentre=Math.min(r.wStarCentre,s.w);if(se>SAFE)r.wStarSafe=Math.min(r.wStarSafe,s.w);
   if(s.w===0){if(se>SAFE)r.coreSafeOut++;r.coreWorstEdge=Math.max(r.coreWorstEdge,se)}
   r.minHer=Math.min(r.minHer,herGap(s.lens));r.minWall=Math.min(r.minWall,wallGap(s.lens[0],s.lens[2]));r.maxY=Math.max(r.maxY,s.lens[1]);
   const g=C.roomViewDir(((s.th%360)+360)%360,pitch,L.roomLook),hd=v=>Math.atan2(v[0],v[2])/D2R;
   T.push({th:s.th,added:M.wrap180(hd(s.f)-hd(g)),w:s.w,curv,J,Jy,pc,cx:ce.x,cy:ce.y,ce:ce.e,se,her:herGap(s.lens)})}
  if(pitch===10&&dist===L.distMax)tr=T;rows.push(r)}
 const agg=k=>Math.max(...rows.map(r=>r[k])),mn=k=>Math.min(...rows.map(r=>r[k]));
 return {rows,trace:tr,maxCurv:agg('maxCurv'),curvBand:agg('curvBand'),maxPosCurv:agg('maxPosCurv'),minJ:mn('minJ'),maxJBand:agg('maxJBand'),minJBand:mn('minJBand'),wStarCentre:mn('wStarCentre'),wStarSafe:mn('wStarSafe'),coreSafeOut:rows.reduce((a,r)=>a+r.coreSafeOut,0),coreWorstEdge:agg('coreWorstEdge'),minHer:mn('minHer'),minWall:mn('minWall'),maxY:agg('maxY')}}
// Time domain through the real FreeOrbit input (drag, release coast): drags at 30/90°/s across the CCW band and the CW
// band, and flicks, at 30/60/120 fps. Camera-added accel = |dω_view/dt − dω_room/dt| (ω_room: the input's own room view).
// r10 coast (R10_SPEC.md §4.2): exact exponential integration, yaw += v·τ·(1 − e^{−dt/τ}), v *= e^{−dt/τ}: the coast
// distance no longer depends on the frame rate (FreeOrbit.step @d1a491c1 does yaw += v·dt first, then decays).
// opt mode: 'freeorbit' (current step) | 'exact'.
const COAST={tauS:0.16};
function coastStep(o,dt,P,mode){if(mode==='freeorbit'){o.step(dt);return}
 const k=Math.exp(-dt/COAST.tauS);let v=o.yawVel;o.yaw+=v*COAST.tauS*(1-k);v*=k;if(Math.abs(v)<0.05)v=0;o.yawVel=v}
function timeRun(poseFn,P,wStar,mode='exact'){const out=[];
 const cases=[['drag 30°/s CCW',0,30,2.4],['drag 90°/s CCW',0,90,1.2],['drag 30°/s CW',0,-30,2.4],['drag 90°/s CW',0,-90,1.2],['flick 160°/s CCW',354,160,0.2],['flick 160°/s CW',354,-160,0.2],['drag 90°/s through the room',100,90,3],['drag 30°/s, release mid-band CCW',0,30,0.9],['drag 30°/s, release mid-band CW',0,-30,1.4],['drag 30°/s, release at the core edge CCW',0,30,0.4]];
 for(const fps of [30,60,120])for(const [name,y0,rate,dur] of cases){const o=new C.FreeOrbit('home'),dt=1/fps;o.yaw=y0;o.pitch=10;o.dist=L.distMax;o.mode='free';
  const F=[];const rec=t=>{const p=poseFn(o.yaw,o.pitch,o.dist,P),g=C.roomViewDir(o.yaw,o.pitch,L.roomLook);F.push({t,yaw:o.yaw,...p,g})};rec(0);let t=0;
  for(let i=0;i<Math.round(dur/dt);i++){o.drag(rate*dt/C.ORBIT_FEEL.yawPerScreen,0,dt);o.step(dt);t+=dt;rec(t)}
  o.release();for(let i=0;i<Math.round(2/dt);i++){coastStep(o,dt,P,mode);t+=dt;rec(t)}
  let camAcc=0,camAccMove=0,camAccCoast=0,rawAcc=0,inOut=0,inFrames=0,back=0;const sgn=Math.sign(rate);
  const W=[];for(let i=0;i<F.length-1;i++)W.push([omegaPer(F[i].f,F[i+1].f,dt).map(v=>v*D2R),omegaPer(F[i].g,F[i+1].g,dt).map(v=>v*D2R)]);
  for(let i=1;i<W.length;i++){const a=[0,1,2].map(k=>((W[i][0][k]-W[i-1][0][k])-(W[i][1][k]-W[i-1][1][k]))/dt/D2R),rw=[0,1,2].map(k=>(W[i][0][k]-W[i-1][0][k])/dt/D2R);
   const m=nrm(a);camAcc=Math.max(camAcc,m);rawAcc=Math.max(rawAcc,nrm(rw));if(F[i].t<=dur+1e-9)camAccMove=Math.max(camAccMove,m);else camAccCoast=Math.max(camAccCoast,m)}
  for(let i=0;i<W.length;i++){const vy=W[i][0][1];if(vy*sgn<-1e-3*D2R)back++}
  for(const f of F)if(f.w<=wStar){inFrames++;if(onScreen(f.lens,f.f,HER_C).e>1)inOut++}
  // overshoot: after release the view heading must approach its final heading monotonically
  const hd=f=>Math.atan2(f.f[0],f.f[2])/D2R,fin=hd(F[F.length-1]);let over=0;const iRel=F.findIndex(f=>f.t>dur-1e-9);
  for(let i=iRel;i<F.length;i++){const d=M.wrap180(hd(F[i])-fin),d0=M.wrap180(hd(F[iRel])-fin);if(d*d0<0)over=Math.max(over,Math.abs(d))}
  let jump=0;for(let i=1;i<F.length;i++)jump=Math.max(jump,Math.acos(Math.max(-1,Math.min(1,M.dot(F[i].f,F[i-1].f))))/D2R/Math.max(1e-9,Math.abs(M.wrap180(F[i].yaw-F[i-1].yaw))||1));
  out.push({name,fps,finalYaw:+o.yaw.toFixed(3),camAccDegS2:+camAcc.toFixed(1),camAccWhileDraggingDegS2:+camAccMove.toFixed(1),camAccCoastDegS2:+camAccCoast.toFixed(1),rawAccDegS2:+rawAcc.toFixed(0),framesW_le_wStar:inFrames,centreOut:inOut,viewBackwardFrames:back,overshootDeg:+over.toFixed(3)})}
 return out}
function evaluate(label,poseFn,P,wStarCheck){const s=sweep(poseFn,P);const t=timeRun(poseFn,P,wStarCheck);return {label,P,s,t}}
const W_CENTRE=0.28;   // spec band criterion (R10_SPEC.md §4): her centre in frame for every pose with w ≤ w*, w* = 0.28
function report(e,assert){const s=e.s,ok=[];const chk=(metric,val,thr,cmp,where)=>{const pass=cmp==='<='?val<=thr+1e-9:val>=thr-1e-9;ok.push(pass);console.log(`  ${pass?'PASS':'FAIL'}  ${metric.padEnd(58)} ${String(+(+val).toFixed(4)).padStart(10)}  ${cmp} ${thr}   (${where})`);return pass};
 console.log(`\n== ${e.label}  ${JSON.stringify(e.P)}`);
 chk('view curvature |dΩ/dθ| max (1/deg)',s.maxCurv,KAPPA,'<=','θ sweep, 3 pitch × 3 dist');
 console.log(`        = ${(s.maxCurv*900).toFixed(0)} °/s² at 30°/s, ${(s.maxCurv*8100).toFixed(0)} °/s² at 90°/s (scales with ω², by design); max at θ=${s.rows.find(r=>r.maxCurv===s.maxCurv).maxCurvAt}`);
 console.log(`  INFO  lens path curvature |d²p/dθ²| max (m/deg²) ${s.maxPosCurv.toFixed(4)} (3 m/s² at 30°/s would need ≤ ${LAMBDA.toFixed(4)}; not gated, §5 trade-off)`);
 console.log(`        = ${(s.maxPosCurv*900).toFixed(2)} m/s² at 30°/s, ${(s.maxPosCurv*8100).toFixed(2)} m/s² at 90°/s`);
 chk('view turns with the hand: min signed yaw rate per input degree',s.minJ,0,'>=','θ sweep (no backward turn)');
 console.log(`        band view rate per input degree J: ${s.minJBand.toFixed(3)} .. ${s.maxJBand.toFixed(3)}`);
 chk('orbit core (w = 0) out of safe frame (poses)',s.coreSafeOut,0,'<=','θ sweep w = 0');
 console.log(`        core worst edge NDC ${s.coreWorstEdge.toFixed(3)}`);
 chk('w* centre: smallest w with her centre out of frame',s.wStarCentre,W_CENTRE,'>=','band, all pitch/dist');
 console.log(`  INFO  w* safe (smallest w with any body point outside the 0.9 safe frame) ${s.wStarSafe.toFixed(3)}`);
 chk('no jump: max view rotation per input degree (band and core)',s.rows.reduce((a,r)=>Math.max(a,r.maxJ),0),1.5,'<=','θ sweep');
 chk('lens to her body, min (m)',s.minHer,1.0,'>=','all θ');
 chk('lens to inner walls, min (m)',s.minWall,0.25,'>=','all θ');
 chk('lens height max (m)',s.maxY,1.55,'<=','all θ (lensMaxY)');
 const T=e.t;const mx=(f,k)=>Math.max(...T.filter(f).map(r=>r[k]));
 chk('time: her centre out of frame where w ≤ w*centre (frames)',T.reduce((a,r)=>a+r.centreOut,0),0,'<=','drags 30/90, flicks, 30/60/120 fps');
 chk('time: view turns backward (frames)',T.reduce((a,r)=>a+r.viewBackwardFrames,0),0,'<=','all runs');
 chk('time: overshoot after release (deg)',mx(()=>true,'overshootDeg'),0.5,'<=','all runs');
 chk('time: camera-added accel while dragging 30°/s (°/s²)',mx(r=>/drag 30°/.test(r.name),'camAccWhileDraggingDegS2'),110,'<=','drags 30°/s CCW/CW');
 chk('time: camera-added accel in the coast after a 30°/s release (°/s²)',mx(r=>/drag 30°/.test(r.name),'camAccCoastDegS2'),110,'<=','releases beyond, mid-band, core edge');
 console.log(`        90°/s drag ${mx(r=>/drag 90/.test(r.name),'camAccWhileDraggingDegS2')} °/s², flick ${mx(r=>/flick/.test(r.name),'camAccWhileDraggingDegS2')} °/s² (curvature bar, ω²-scaled); incl. coast: 30°/s ${mx(r=>/30°/.test(r.name),'camAccDegS2')}, 90°/s ${mx(r=>/90/.test(r.name),'camAccDegS2')}`);
 console.log(`  INFO  coast only (after release): after 30°/s ${mx(r=>/drag 30°/.test(r.name),'camAccCoastDegS2')} °/s², after 90°/s ${mx(r=>/drag 90/.test(r.name),'camAccCoastDegS2')} °/s², after flick ${mx(r=>/flick/.test(r.name),'camAccCoastDegS2')} °/s² (110 cap: §5)`);
 const pz=pinch(e.P,e.label);if(pz)console.log(`  INFO  pinch: max view rotation ${pz.rate.toFixed(2)} °/m, curvature ${pz.curv.toFixed(2)} °/m² → ${(pz.curv*1.5*1.5).toFixed(1)} °/s² at 1.5 m/s pinch (cap 110)`);
 return ok.every(Boolean)}
// pinch: dist sweep 1.9..3.35 at fixed θ (core and band), view rotation per metre and its derivative.
function pinch(P,label){if(!/r10/.test(label)&&!/variant/.test(label))return null;let rate=0,curv=0;const h=0.01;
 for(let th=300;th<=420;th+=2)for(const pitch of PITCHES){let prev=null,Om0=null;for(let d=L.distMin;d<=L.distMax+1e-9;d+=h){const p=poseR10(th%360,pitch,d,P);
  if(prev){const Om=omegaPer(prev.f,p.f,h);rate=Math.max(rate,nrm(Om));if(Om0)curv=Math.max(curv,nrm(sub(Om,Om0))/h);Om0=Om}prev=p}}
 return {rate,curv}}
const main=evaluate('r10 (spec)',poseR10,R10,W_CENTRE);const pass=report(main,true);
{const spread=mode=>{const T=timeRun(poseR10,R10,W_CENTRE,mode),by={};for(const r of T)(by[r.name]=by[r.name]||[]).push(r.finalYaw);return Math.max(...Object.values(by).map(a=>Math.max(...a.map(x=>Math.abs(M.wrap180(x-a[0]))))))};
 const fo=spread('freeorbit'),ex=spread('exact');console.log(`\n  step independence, max final-yaw spread over 30/60/120 fps: exact coast ${ex.toFixed(3)}° (bar 0.05°), FreeOrbit.step coast @d1a491c1 ${fo.toFixed(3)}°`);
 main.spread={exact:ex,freeorbit:fo};if(ex>0.05){console.log('  FAIL  step independence');process.exitCode=1}}
const res={kappa:KAPPA,lambda:LAMBDA,wCentre:W_CENTRE,r10:{P:R10,sweep:{...main.s,trace:undefined},time:main.t,spread:main.spread}};
if(args.includes('--variants')){res.variants=[];
 for(const v of [{profile:'smoothstep',W:70},{profile:'bangbang'},{W:40},{W:70},{gazeM:3.0},{satW:50},{envK:4},{envK:0},{aimQ:1.25}]){const P={...R10,...v};const e=evaluate('variant '+JSON.stringify(v),poseR10,P,W_CENTRE);report(e,false);res.variants.push({P,sweep:{...e.s,trace:undefined,rows:undefined},time:e.t})}
 const e9=evaluate('r9-style (approx.: old narrow-band position + 60° smoothstep direction slerp)',(th,p,d)=>poseR9(th,p,d),M.R9,W_CENTRE);report(e9,false);res.r9style={sweep:{...e9.s,trace:undefined,rows:undefined},time:e9.t}}
if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify(res,null,1));
if(arg('--trace')){const e9=sweep((th,p,d)=>poseR9(th,p,d),M.R9);fs.writeFileSync(arg('--trace'),JSON.stringify({r10:main.s.trace,r9:e9.trace,P:R10,kappa:KAPPA}))}
console.log('\n'+(pass?'r10 spec check PASS':'r10 spec check FAIL'));process.exitCode=pass?0:1;
