'use strict';
/* 运镜bot full2-cam task 1: the ride starts continuously from the REAL level lens on screen.
 *  sail A1  : live = ExploreCameraCore.followPose at node I6 (heading I5→I6, the departure node walk), per screen;
 *  balloon B1: live = followPose at node M6 (heading M4→M6 via the fence gate (2.6,−20.8) — M4→M5→M6 walk), per screen.
 * Real RegionJourneyController + LiveHandoff/TransitionRun (copied rideStart of test-route-continuity, live lens swapped in). Pass =
 *  L1 first written frame == the live lens (≤1 cm / 0.1° / 0.1° fov), no cover, no write before the walk;
 *  L2 every blend frame within the route-continuity per-frame caps (blendLensMS / walkYawDegS + ride's own), no jump;
 *  L3 output yaw ≤120°/s and p99 yaw accel ≤300°/s² (walking caps) from the first frame until the blend settles. */
const fs=require('node:fs'),cp=require('node:child_process'),R=require('../journey-integration/route/route-legs.cjs'),F=R.F,J=R.J,{add,sub}=J;
const screens=process.env.QF_ROUTE_SCREENS?JSON.parse(process.env.QF_ROUTE_SCREENS):R.SCREENS,FPS=60;
const LIM={omegaDegS:20,alphaDegS2:120,accMS2:3,swapDeg:.1,swapM:.01,swapFov:.1,fovStep:.5,arcOmegaDegS:60,arcDaFrame:8};
const dirOf=p=>{const f=sub(p.target,p.position),l=Math.hypot(...f);return f.map(x=>x/l);},ang=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])))*180/Math.PI;
const jumpOf=(a,b)=>({posM:+Math.hypot(...sub(a.position,b.position)).toFixed(4),viewDeg:+ang(dirOf(a),dirOf(b)).toFixed(4),fovDeg:+Math.abs(a.fovVerticalDeg-b.fovVerticalDeg).toFixed(4)});
const swapOk=j=>j.posM<=LIM.swapM&&j.viewDeg<=LIM.swapDeg&&j.fovDeg<=LIM.swapFov;
function daFrame(cam,t0,t1){const dt=1/FPS,P=[];for(let t=t0;t<=t1+1e-9;t+=dt)P.push(cam(Math.min(t,t1)).position);let max=0,at=t0,prev=null;
 for(let i=1;i+1<P.length;i++){const a=[0,1,2].map(c=>(P[i+1][c]-2*P[i][c]+P[i-1][c])/dt/dt);if(prev){const d=Math.hypot(a[0]-prev[0],a[1]-prev[1],a[2]-prev[2]);if(d>max){max=d;at=+(t0+i*dt).toFixed(3);}}prev=a;}return {max:+max.toFixed(3),at};}
function kin(cam,t0,t1){const P=[],D=[],Fv=[],T=[];for(let t=t0;t<=t1+1e-9;t+=1/FPS){const p=cam(Math.min(t,t1));P.push(p.position);D.push(dirOf(p));Fv.push(p.fovVerticalDeg);T.push(t);}
 const dt=1/FPS,st=[],sa=[];for(let i=1;i<P.length;i++){st.push(Math.hypot(...sub(P[i],P[i-1])));sa.push(ang(D[i-1],D[i]));}
 const o={omega:0,omegaAt:0,alpha:0,alphaAt:0,acc:0,accAt:0,fovRate:0,jumps:[]};
 for(let i=0;i<st.length;i++){const w=sa[i]/dt;if(w>o.omega){o.omega=w;o.omegaAt=T[i];}
  const nb=k=>[st[k-1],st[k+1]].filter(x=>x!==undefined),na=k=>[sa[k-1],sa[k+1]].filter(x=>x!==undefined);
  if((st[i]>.01&&nb(i).every(x=>st[i]>4*x))||(sa[i]>.05&&na(i).every(x=>sa[i]>4*x))||Math.abs(Fv[i+1]-Fv[i])>LIM.fovStep)o.jumps.push({t:+T[i].toFixed(3),stepM:+st[i].toFixed(4),stepDeg:+sa[i].toFixed(3),fov:[Fv[i],Fv[i+1]]});
  o.fovRate=Math.max(o.fovRate,Math.abs(Fv[i+1]-Fv[i])/dt);}
 for(let i=1;i+1<P.length;i++){const a=Math.hypot(...[0,1,2].map(c=>(P[i+1][c]-2*P[i][c]+P[i-1][c])/(dt*dt)));if(a>o.acc){o.acc=a;o.accAt=T[i];}
  const al=Math.abs(sa[i]-sa[i-1])/dt/dt;if(al>o.alpha){o.alpha=al;o.alphaAt=T[i];}}
 for(const k of ['omega','alpha','acc','fovRate','omegaAt','alphaAt','accAt'])o[k]=+o[k].toFixed(3);o.samples=P.length;return o;}
const RC=J.H.load(J.S+'world-r1/RegionJourneyCore.ts'),{Cancellation}=J.H.load(J.S+'world-r1/WorldFlowCore.ts'),TCAM=J.H.load(J.S+'region/TransitionCamera.ts').TRANSITION_CAM;
async function rideStart(leg){const sail=leg.id.startsWith('sail'),log=[];let shown=false,now=1000,stop=false;const dt=1/FPS;
 const perf0=globalThis.performance;Object.defineProperty(globalThis,'performance',{value:{now:()=>now*1000},configurable:true,writable:true});
 try{
 const route={from:sail?'island':'meadow',to:sail?'meadow':'skycity',path:[[0,0,0],[0,0,4],[0,0,8]],bridgeStart:2,bridgeEnd:3,speed:1.2,startBlendM:0};
 // level lenses placed where a level camera of the departure region is: near the ride's first lens (a level lens 100 m away would
 // only measure the blend length), the prepare-time one and the moved one 4.5 m / 16° apart
 const r0=leg.cam(0),off=(p,d,t)=>({position:p.position.map((v,i)=>v+d[i]),target:p.target.map((v,i)=>v+t[i]),fovVerticalDeg:p.fovVerticalDeg+2});
 void off;const live0=leg.live,live1=leg.live/* the real level follow lens at I6 / M6 */;let liveNow=live0;
 let rideT=0;const lease={route,show:v=>{shown=!!v;log.push({k:'show',v:!!v});},dispose:()=>{},startPose:()=>leg.cam(0),onFrame:()=>{log.push({k:'onFrame'});return leg.cam(rideT);},
  ride:async(a,w)=>{while(!stop){w.setCamera(leg.cam(rideT));log.at(-1).rt=rideT;rideT+=dt;now+=dt;await new Promise(r=>setImmediate(r));}}};
 const c=new RC.RegionJourneyController({prepare:async()=>lease,readCamera:()=>structuredClone(liveNow)});if(!sail)c.region='meadow';
 const world={setCamera:p=>log.push({k:'camera',p:structuredClone(p),shown}),fadeCover:(a,s)=>{log.push({k:'cover',a});return Promise.resolve();},wait:async()=>{now+=dt;await new Promise(r=>setImmediate(r));}};
 const actor={walkProgress:()=>0,perform:async()=>{},cancelAndReset:()=>{},setVisible:()=>{}};
 const tok=new Cancellation();await c.prepare(route.to,[0,0,0],tok);for(let i=0;i<5;i++)c.observe(actor,world,dt);
 const beforeWalk=log.filter(e=>e.k==='camera').length;liveNow=live1/* the level lens kept moving after prepare */;
 const w=c.walk(actor,world,tok).catch(e=>log.push({k:'err',e:String(e)}));
 let settled=0,frames=0;for(;frames<60*20&&settled<30;frames++){await new Promise(r=>setImmediate(r));const cams=log.filter(e=>e.k==='camera');const l=cams.at(-1);
  if(l&&l.rt!==undefined&&swapOk(jumpOf(l.p,leg.cam(l.rt))))settled++;else settled=0;}
 const nStop=log.length;stop=true;await w;
 // writes after the test stops the ride early (controller wrap-up of a cut-short ride) are not part of the blend
 const cams=log.slice(0,nStop).filter(e=>e.k==='camera'),first=cams[0],err=log.find(e=>e.k==='err');const firstVsLive=first?jumpOf(first.p,live1):null;
 let worst={stepM:0,stepCapM:0,turnDeg:0,turnCapDeg:0,fovStep:0,at:-1},capOk=true,renderOk=!!first&&first.shown;
 const P=cams.map(e=>e.p);for(let i=1;i<cams.length;i++){const a=cams[i-1],b=cams[i],ra=a.rt!==undefined?leg.cam(a.rt):a.p,rb=b.rt!==undefined?leg.cam(b.rt):b.p;
  const st=Math.hypot(...sub(b.p.position,a.p.position)),rs=Math.hypot(...sub(rb.position,ra.position)),tu=ang(dirOf(a.p),dirOf(b.p)),rtu=ang(dirOf(ra),dirOf(rb));
  const capM=(TCAM.blendLensMS*dt+rs)+1e-3,capD=(TCAM.walkYawDegS*dt+rtu)+1e-3,fs=Math.abs(b.p.fovVerticalDeg-a.p.fovVerticalDeg),capF=TCAM.fovDegS*dt+Math.abs(rb.fovVerticalDeg-ra.fovVerticalDeg)+1e-3;
  if(st>capM||tu>capD||fs>capF){capOk=false;}if(st/capM>worst.stepM/(worst.stepCapM||1)||tu/capD>worst.turnDeg/(worst.turnCapDeg||1))worst={stepM:+st.toFixed(4),stepCapM:+capM.toFixed(4),turnDeg:+tu.toFixed(3),turnCapDeg:+capD.toFixed(3),fovStep:+fs.toFixed(3),at:i};}
 for(const e of cams){const p=e.p,f=[...p.position,...p.target,p.fovVerticalDeg];if(!f.every(Number.isFinite)||Math.hypot(...sub(p.target,p.position))<1e-3||(p.position.every(v=>v===0)&&p.target.every(v=>v===0))||!e.shown)renderOk=false;}
 const hiddenDuring=log.some((e,i)=>e.k==='show'&&!e.v&&i>log.indexOf(first));if(hiddenDuring)renderOk=false;
 // jumps of the OUTPUT that the ride lens itself does not have (the ride's own seam / segment steps are C1/C3's business)
 const rideStep=i=>{const a=cams[i],b=cams[i+1];if(!a||!b||a.rt===undefined||b.rt===undefined)return 0;return Math.hypot(...sub(leg.cam(b.rt).position,leg.cam(a.rt).position));};
 const kj=(()=>{const cam=t=>P[Math.min(P.length-1,Math.round(t/dt))];return kin(cam,0,(P.length-1)*dt).jumps.filter(j=>{const i=Math.round(j.t/dt);return rideStep(i)<0.5*j.stepM;});})();
 const covers=log.filter(e=>e.k==='cover').length;
 const src=f=>fs.readFileSync(J.S+f,'utf8').replace(/\s/g,'');const wired=sail?/startPose:\(\)=>\{constv=view\.getFrameSize\(\);returnsailDriver!\.pose\(/.test(src('region/RegionJourneyAdapter.ts')):/startPose:\(\)=>plan\.camera\(0\)/.test(src('region/BalloonTransit.ts'));
 const ok=!err&&beforeWalk===0&&covers===0&&!!first&&swapOk(firstVsLive)&&capOk&&!kj.length&&settled>=30&&renderOk&&wired;
 return {P,blendN:cams.findIndex((e,i)=>i>0&&e.rt!==undefined&&swapOk(jumpOf(e.p,leg.cam(e.rt)))),name:'continuous LiveHandoff from the current lens (real RegionJourneyController, faked 60 fps clock)',ok,camWritesBeforeWalk:beforeWalk,covers,firstVsCurrentLens:firstVsLive,
  firstVsPrepareLens:first?jumpOf(first.p,live0):null,blendFrames:cams.length,settledFrames:settled,capOk,worstVsCap:worst,jumps:kj.slice(0,4),C4render:renderOk,productionWired:wired,err:err?err.e:null};
 }finally{if(perf0!==undefined)Object.defineProperty(globalThis,'performance',{value:perf0,configurable:true,writable:true});}}

const N=J.H.load(J.S+'region/RegionNodes.ts').REGION_NODES,EC=J.H.load(J.S+'region/ExploreCameraCore.ts'),{rotY}=J;
const at=(r,k)=>N[r].nodes.find(n=>n.key===k).at,meadowW=p=>add(rotY(180,p),J.mOff);
const R2D=180/Math.PI,wrap=a=>((a%360)+540)%360-180,yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*R2D;
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(q*s.length))]||0;};
(async()=>{const G=await R.geometry(),rows=[];let fail=0;
 for(const scr of screens){const [w,h]=scr;
  const i5=at('island','I5'),i6=at('island','I6'),m5=meadowW(at('meadow','M5')),m6=meadowW(at('meadow','M6'));
  for(const [mk,from,to,id] of [[R.sailLeg,i5,i6,'A1 from I6'],[R.balloonLeg,m5,m6,'B1 from M6 (M4→M6 walk)']]){
   const leg=mk(G,scr),yaw=Math.atan2(to[0]-from[0],to[2]-from[2]);leg.live=EC.followPose(to,yaw,w,h,0);
   const r=await rideStart(leg),P=r.P.slice(0,Math.max(2,r.blendN+1));const ys=[],ac=[];
   for(let i=1;i<P.length;i++)ys.push(wrap(yawOf(P[i])-yawOf(P[i-1]))*FPS);for(let i=1;i<ys.length;i++)ac.push(Math.abs(ys[i]-ys[i-1])*FPS);
   const row={id,scr:scr.join('x'),firstPosM:r.firstVsCurrentLens?.posM,firstViewDeg:r.firstVsCurrentLens?.viewDeg,blendS:+(r.blendN/FPS).toFixed(2),
    yawMax:+Math.max(0,...ys.map(Math.abs)).toFixed(1),accP99:+pct(ac,.99).toFixed(0),capOk:r.capOk,jumps:r.jumps.length,liveToRideM:+Math.hypot(...sub(leg.live.position,leg.cam(0).position)).toFixed(2)};rows.push(row);
   const ok=r.ok&&row.yawMax<=120&&row.accP99<=300;if(!ok){fail++;console.log('FAIL',JSON.stringify(row),r.err||'');}}}
 console.table(rows);console.log(fail?`live-start FAIL (${fail})`:'live-start PASS');process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
