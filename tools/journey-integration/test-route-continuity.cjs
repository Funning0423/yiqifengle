#!/usr/bin/env node
'use strict';
/* b16 route camera continuity + background contract (运镜bot; replaces test-journey-start-continuity.cjs, deleted with the
 * rainbow bridge in f678c084, and adds the per-frame background check). Legs/cameras from route/route-legs.cjs, 7 screens.
 *  C1 inside each continuous segment (60 fps, the leg's game clock): no jump (a frame step > 4× both neighbours and > 1 cm /
 *     0.05°, or any FOV step > 0.5°), view angular velocity ≤ 20°/s (old F1/G1), view angular acceleration ≤ 120°/s² and lens
 *     linear acceleration ≤ 3 m/s² (lakeside-landing-cam / HANDOFF §4 limits). Segments end only at a cut the game hides
 *     (full black) or at the balloon's coordinate re-root (checked in C3).
 *  C2 hand-offs (sail → shore follow → meadow board camera; ride → door lens → lakeside board camera): ≤ 0.1°, ≤ 1 cm, FOV ≤ 0.1°.
 *  C3 balloon seam (BalloonFlight SEAM_T, the world re-roots): camera relative to the balloon continuous (≤ 1 cm, ≤ 0.1°).
 *  C4 start: sail + balloon meadow→skycity: real controller, live lens held → black → ride camera(0) → fade in (rideStart);
 *     skycity follow lens; balloon meadow→skycity: the controller's journeyCamera(d=0) write). A visible jump fails unless the
 *     frame is under a full cover. Lakeside walk→basket cut: must be under full black.
 *  C5 day/night: no camera function reads the day/night mode (source check), so C1–C4 hold for both modes.
 *  BG1 background, sail + balloon meadow→skycity, day + night, 7 screens, every 0.1 s: tools/transitions/test_frame_background.cjs
 *     (camera rays vs the live sky dome / night dome / sea / transit clouds; voids, double domes, horizon gaps) — run here.
 *  BG2 background, balloon skycity→lakeside, every 0.1 s, 7 screens: a 27×58 ray grid against the FULL scene (all lakeside
 *     instances + full skycity + balloon); a ray that misses everything while pointing > 0.6° below the horizon is a HOLE
 *     (it would show the camera clear colour under the horizon). Rays above the horizon show the sky dome; BG3 checks what
 *     the clear colour would be: lakeside day/night clear colours must not be the Cocos default grey (51,51,51).
 * Geometry + real TS. Not a render or device acceptance. */
const fs=require('node:fs'),cp=require('node:child_process'),R=require('./route/route-legs.cjs'),F=R.F,J=R.J,{add,sub}=J;
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
/* C4 rig (item 3): the REAL RegionJourneyController with a ride lease that has startPose (= the leg's ride camera at t=0) and an
 * onFrame that keeps returning ride poses, a recording world with fadeCover. Pass = no camera write from prepare until the
 * cover is at alpha 1; the one write under black is the ride's first pose (≤ 1 cm / 0.1°); then the cover fades in; plus the
 * production wiring (sail lease + balloon lease expose startPose). */
const RC=J.H.load(J.S+'world-r1/RegionJourneyCore.ts'),{Cancellation}=J.H.load(J.S+'world-r1/WorldFlowCore.ts');
async function rideStart(leg){const sail=leg.id.startsWith('sail'),log=[];let alpha=0;const covers=[];
 const route={from:sail?'island':'meadow',to:sail?'meadow':'skycity',path:[[0,0,0],[0,0,4],[0,0,8]],bridgeStart:2,bridgeEnd:3,speed:1.2,startBlendM:0};
 const live={position:[0,9,-9],target:[0,0,0],fovVerticalDeg:45};let rideDone;const rideP=new Promise(r=>{rideDone=r;});
 const lease={route,show:v=>log.push({k:'show',alpha}),dispose:()=>{},startPose:()=>leg.cam(0),onFrame:()=>leg.cam(.5),ride:async(a,w)=>{log.push({k:'ride',alpha});w.setCamera(leg.cam(0));await rideP;}};
 const c=new RC.RegionJourneyController({prepare:async()=>lease,readCamera:()=>structuredClone(live)});if(!sail)c.region='meadow';
 const world={setCamera:p=>log.push({k:'camera',p:structuredClone(p),alpha}),fadeCover:(a,s)=>{log.push({k:'cover',a,from:alpha});return new Promise(r=>covers.push(()=>{alpha=a;r();}));}};
 const actor={walkProgress:()=>0,perform:async()=>{},cancelAndReset:()=>{},setVisible:()=>{}};const tick=()=>new Promise(r=>setImmediate(r));
 const tok=new Cancellation();await c.prepare(route.to,[0,0,0],tok);for(let i=0;i<5;i++)c.observe(actor,world,1/60);
 const beforeWalk=log.filter(e=>e.k==='camera').length;const w=c.walk(actor,world,tok);await tick();covers.shift()?.();await tick();await tick();covers.shift()?.();rideDone();await w.catch(e=>log.push({k:'err',e:String(e)}));
 const cams=log.filter(e=>e.k==='camera'),first=cams[0],ride0=leg.cam(0),j=first?jumpOf(first.p,ride0):null,err=log.find(e=>e.k==='err');
 const src=f=>fs.readFileSync(J.S+f,'utf8').replace(/\s/g,'');const wired=sail?/startPose:\(\)=>\{constv=view\.getFrameSize\(\);returnsailDriver!\.pose\(/.test(src('region/RegionJourneyAdapter.ts')):/startPose:\(\)=>plan\.camera\(0\)/.test(src('region/BalloonTransit.ts'));
 const ok=!err&&beforeWalk===0&&first&&first.alpha===1&&swapOk(j)&&log.some(e=>e.k==='cover'&&e.a===0)&&wired&&log.findIndex(e=>e.k==='cover'&&e.a===1)<log.indexOf(first);
 return {name:'live lens → black → ride camera(0) → fade in (real RegionJourneyController)',ok,camWritesBeforeWalk:beforeWalk,firstWriteAlpha:first?first.alpha:null,firstWriteVsRide0:j,sequence:log.map(e=>e.k+(e.a!==undefined?':'+e.a:'')+(e.k==='camera'?'@'+e.alpha:'')).slice(0,12),productionWired:wired,error:err&&err.e,
  liveToRide0Hidden:jumpOf(live,ride0)};}
(async()=>{const G=await R.geometry(),Core=J.Core,rows=[],checks=[];
 const check=(id,fn)=>{try{checks.push({id,status:'PASS',...fn()});}catch(e){checks.push({id,status:'FAIL',error:String(e.message||e).slice(0,1500)});}};
 for(const mk of R.legs)for(const scr of screens){const leg=mk(G,scr),key=`${leg.id} ${scr.join('x')}`,ph=t=>(leg.phases.find(p=>t>=p.t0&&t<p.t1)||leg.phases.at(-1)).id;
  const segs=leg.segs.map(([a,b])=>{const k=kin(leg.cam,a,b);return {t0:+a.toFixed(3),t1:+b.toFixed(3),...k,omegaPhase:ph(k.omegaAt),alphaPhase:ph(k.alphaAt),accPhase:ph(k.accAt),jumps:k.jumps.map(j=>({...j,phase:ph(j.t),black:leg.black(j.t)}))};});
  const vis=s=>s.jumps.filter(j=>!j.black);
  const sh=leg.id.startsWith('sail')?segs[1]:null,C1shore=sh?(vis(sh).length||sh.omega>LIM.omegaDegS||sh.alpha>LIM.alphaDegS2||sh.acc>LIM.accMS2?'FAIL':'PASS'):null;
  // Sail set-off arcs (Grok Bot 2026-10-22): an intentional exception, ω ≤ 60°/s, no jump, no acceleration step
  // (|Δa| per 60 fps frame ≤ LIM.arcDaFrame). The rest of the ride keeps the global limits (C1ride).
  let C1setoff=null,C1ride=null,arcD=null,rideD=null;
  if(leg.arcWin){const w=leg.arcWin,k=kin(leg.cam,w.t0,w.t1),da=daFrame(leg.cam,w.t0,w.t1),aj=k.jumps.filter(j=>!leg.black(j.t));
   arcD={t0:+w.t0.toFixed(3),t1:+w.t1.toFixed(3),omega:k.omega,omegaAt:k.omegaAt,alpha:k.alpha,acc:k.acc,maxDaFrame:da.max,maxDaAt:da.at,jumps:aj};
   C1setoff=aj.length||k.omega>LIM.arcOmegaDegS||da.max>LIM.arcDaFrame?'FAIL':'PASS';
   const parts=[[0,w.t0],[w.t1,leg.segs[0][1]]].filter(([a,b])=>b-a>2/FPS).map(([a,b])=>({a,b,...kin(leg.cam,a,b)}));
   rideD=parts.map(p=>({t0:+p.a.toFixed(3),t1:+p.b.toFixed(3),omega:p.omega,omegaAt:p.omegaAt,alpha:p.alpha,alphaAt:p.alphaAt,acc:p.acc,accAt:p.accAt,jumps:p.jumps.filter(j=>!leg.black(j.t))}));
   C1ride=rideD.some(p=>p.jumps.length||p.omega>LIM.omegaDegS||p.alpha>LIM.alphaDegS2||p.acc>LIM.accMS2)?'FAIL':'PASS';}
  // balloonSky reveal B-d (5.8–27 s, both sides of the seam; Grok Bot 2026-10-22): own threshold ω ≤ 30°/s, α ≤ 120°/s² (no
  // angular-acceleration spikes), no visible jump. The rest of the leg keeps the global C1 (report-only).
  let C1reveal=null,revealD=null;
  if(leg.revealWin){const w=leg.revealWin,parts=[[w.t0,leg.seam.t-1e-4],[leg.seam.t+1e-4,w.t1]].map(([a,b])=>({a,b,...kin(leg.cam,a,b)}));
   revealD=parts.map(p=>({t0:+p.a.toFixed(3),t1:+p.b.toFixed(3),omega:p.omega,omegaAt:p.omegaAt,alpha:p.alpha,alphaAt:p.alphaAt,acc:p.acc,accAt:p.accAt,jumps:p.jumps.filter(j=>!leg.black(j.t))}));
   C1reveal=revealD.some(p=>p.jumps.length||p.omega>30||p.alpha>LIM.alphaDegS2)?'FAIL':'PASS';}
  const C1={jumps:segs.flatMap(vis),omega:Math.max(...segs.map(s=>s.omega)),alpha:Math.max(...segs.map(s=>s.alpha)),acc:Math.max(...segs.map(s=>s.acc))};
  const hand=leg.handoffs.map(h=>({name:h.name,...jumpOf(h.a,h.b)})).map(h=>({...h,ok:swapOk(h)}));
  let start=null;
  if(!leg.id.includes('lakeside'))start=await rideStart(leg);
  else start={name:leg.start.name,followToRide:jumpOf(leg.start.from,leg.start.ride),underBlack:leg.black(0),cutAtS:+leg.cut.t.toFixed(3),cutUnderBlack:leg.cut.underBlack};
  const startOk=start.ok!==undefined?start.ok:(start.underBlack||swapOk(start.followToRide))&&start.cutUnderBlack!==false;
  const seam=leg.seam?jumpOf(leg.seam.rel(leg.seam.t-1e-4),leg.seam.rel(leg.seam.t)):null;
  rows.push({leg:leg.id,screen:scr.join('x'),C1reveal,C1revealDetail:revealD,C1setoff,C1setoffDetail:arcD,C1ride,C1rideDetail:rideD,C1shore,C1shoreDetail:sh&&{t0:sh.t0,t1:sh.t1,jumps:vis(sh),omega:sh.omega,omegaAt:sh.omegaAt,alpha:sh.alpha,alphaAt:sh.alphaAt,acc:sh.acc,accAt:sh.accAt},C1:C1.jumps.length||C1.omega>LIM.omegaDegS||C1.alpha>LIM.alphaDegS2||C1.acc>LIM.accMS2?'FAIL':'PASS',C1detail:{visibleJumps:C1.jumps.length,firstJumps:C1.jumps.slice(0,6),maxOmegaDegS:C1.omega,maxAlphaDegS2:C1.alpha,maxAccMS2:C1.acc},segments:segs.map(s=>({t0:s.t0,t1:s.t1,omega:s.omega,omegaAt:s.omegaAt,omegaPhase:s.omegaPhase,alpha:s.alpha,alphaAt:s.alphaAt,alphaPhase:s.alphaPhase,acc:s.acc,accAt:s.accAt,accPhase:s.accPhase,fovRate:s.fovRate,jumps:s.jumps.length})),
   C2:hand.every(h=>h.ok)?'PASS':'FAIL',handoffs:hand,C3:seam?(swapOk(seam)?'PASS':'FAIL'):'n/a',seamRelative:seam,C4:startOk?'PASS':'FAIL',start});
  const r=rows.at(-1);console.error(key,'C1',r.C1,JSON.stringify(r.C1detail).slice(0,260),'C2',r.C2,'C3',r.C3,'C4',r.C4);}
 // C5 day/night: camera functions do not read the mode
 check('C5 camera functions take no day/night input',()=>{const src=f=>fs.readFileSync(J.S+f,'utf8'),body=(s,name)=>{const i=s.indexOf('function '+name);if(i<0)throw Error(name+' missing');let d=0,j=s.indexOf('{',i);for(let k=j;k<s.length;k++){if(s[k]==='{')d++;else if(s[k]==='}'){d--;if(!d)return s.slice(i,k+1);}}};
  const fns=[['region/TransportLeg.ts','sailCamera'],['region/TransportLeg.ts','sailFollowCamera'],['region/TransportLeg.ts','balloonBeats'],['region/LakesideBalloon.ts','lakesideDoorRideCamera'],['region/LakesideBalloon.ts','lakesideDoorBlendPose'],['region/LakesideBalloon.ts','lakesideBalloonRide'],['region/LakesideBalloon.ts','lakesideDoorLens']];
  const hits=fns.filter(([f,n])=>/night|dayNight|DayNight/.test(body(src(f),n))).map(x=>x[1]);assert(!hits.length,'reads day/night: '+hits);return {functions:fns.map(x=>x[1])};});
 // BG1 existing per-frame background contract for sail + balloon meadow→skycity
 check('BG1 sail + balloon meadow→skycity background, day+night × 7 screens (tools/transitions/test_frame_background.cjs)',()=>{let out='';try{out=cp.execFileSync(process.execPath,[J.ROOT+'/tools/transitions/test_frame_background.cjs'],{cwd:J.ROOT+'/tools/transitions',encoding:'utf8',env:process.env,stdio:['ignore','pipe','pipe'],maxBuffer:1<<26});}catch(e){throw Error('test_frame_background failed: '+String(e.stdout||'').slice(-800)+String(e.stderr||'').slice(-800));}
  return {tail:out.trim().split('\n').map(l=>l.slice(0,700))};});
 // BG2 lakeside leg holes
 const BG2=[];for(const scr of screens){const leg=R.lakeLeg(G,scr),a=scr[0]/scr[1];let frames=0,holeFrames=0,maxHoles=0,maxAt=null,first=[];
  for(let i=0;i/10<=leg.T+1e-9;i++){const t=i/10;if(leg.black(t))continue;frames++;const c=leg.cam(t),{fw,r,up,th}=F.basis(c),bal=t<=leg.timing.rideT?null:null;let holes=0;
   for(let j=0;j<58;j++)for(let k=0;k<27;k++){const x=((k+.5)/27*2-1)*th*a,y=((j+.5)/58*2-1)*th,d=[0,1,2].map(q=>fw[q]+r[q]*x+up[q]*y),l=Math.hypot(...d),u=d.map(v=>v/l);
    if(u[1]>=-Math.sin(.6*Math.PI/180))continue;if(F.cast(G.lake,c.position,u,800))continue;const e=add(c.position,u.map(v=>v*60));if(leg.los(t,c.position,e))continue;holes++;}
   if(holes){holeFrames++;if(first.length<5)first.push({t:+t.toFixed(1),holes});}if(holes>maxHoles){maxHoles=holes;maxAt=+t.toFixed(1);}}
  BG2.push({screen:scr.join('x'),frames,holeFrames,maxHoleRays:maxHoles,ofRays:27*58,atS:maxAt,phase:maxAt==null?null:(leg.phases.find(p=>maxAt>=p.t0&&maxAt<p.t1)||{}).id,first});console.error('BG2',scr.join('x'),holeFrames,maxHoles,maxAt);}
 check('BG2 lakeside leg: no below-horizon ray misses all geometry (hole to the clear colour), 7 screens, every 0.1 s',()=>{const bad=BG2.filter(b=>b.holeFrames);assert(!bad.length,JSON.stringify(bad.map(b=>({screen:b.screen,holeFrames:b.holeFrames,max:b.maxHoleRays,at:b.atS,phase:b.phase,first:b.first}))));return {screens:BG2};});
 check('BG3 lakeside clear colour (shown above the horizon only if the dome is off) is not the Cocos default grey #333333, day and night',()=>{const SD=J.H.load(J.S+'region/LakesideSceneData.ts'),out={};for(const m of ['day','night']){const L=SD.lakesideModeLighting(m),c=String(L.clearColor).toLowerCase();assert(!/^#?333333$/.test(c),m+' clear '+c);out[m]={clear:L.clearColor,skyDome:L.skyDomeColor};}return out;});
 const status=rows.every(r=>r.C1==='PASS'&&r.C2==='PASS'&&r.C3!=='FAIL'&&r.C4==='PASS')&&checks.every(c=>c.status==='PASS')?'PASS':'FAIL';
 const report={status,timeUTC:new Date().toISOString(),limits:LIM,fps:FPS,scope:'Real TS camera functions sampled on each leg\'s game clock; full geometry for BG2. Not a render or device acceptance.',rows,checks};
 fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/route-continuity.json',JSON.stringify(report,null,1)+'\n');
 console.log(JSON.stringify({status,rows:rows.map(r=>[r.leg,r.screen,r.C1,r.C2,r.C3,r.C4]),checks:checks.map(c=>[c.id.slice(0,40),c.status,c.error&&c.error.slice(0,300)])}));require('./route/route-gate.cjs').gate('test-route-continuity.cjs',[...rows.flatMap(r=>['C1','C1reveal','C1setoff','C1ride','C1shore','C2','C3','C4'].filter(k=>r[k]==='FAIL').map(check=>({leg:r.leg,check}))),...checks.filter(c=>c.status==='FAIL').map(c=>({leg:/lakeside/.test(c.id)?'lakeside':'*',check:c.id.split(' ')[0]}))]);
})().catch(e=>{console.error(e);process.exit(2);});
function assert(c,m){if(!c)throw Error(m);}
