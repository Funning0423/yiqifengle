#!/usr/bin/env node
'use strict';
/* 04→05 set-off (Oi review 16:05Z; Grok Bot 2026-10-16: no hard cut in view, no camera swoop). v3.3 set-off FADE:
 * live island lens -> black over SETOFF_FADE.outS (0.25 s) -> under full black cut to the d238881 follow pose (FOV 48) and
 * show the journey scenes -> fade in over inS (0.35 s) while she walks. journeyCamera itself is unchanged from d238881.
 *  G1 journeyCamera == d238881 (pinned poses incl. d=0); continuous and ≤ 20°/s from the cut on (60 fps, 0–10 m)
 *  G2 fade-in frames (d 0 → inS·speed): she is in frame, chest/head/face not occluded (no palm), lens ≥ 1 m
 *  C1 real RegionJourneyController + recording world: cover 0→1 first; NO camera write / scene show / walk until the
 *     cover reports full black; then cut (= G1 d=0 pose), show, cover 1→0 (0.35 s), walk; one cut only, under alpha 1
 *  C2 lease without fadeCover: old path (no cover); C3 cancel during the fade-out uncovers; C4 08→09: no fade
 *  C5 wiring: island route startBlendM 0; WorldLease.fadeCover forwards the ScreenCover registered by
 *     WorldIntegrationBoot (same Graphics+UIOpacity cover as 主页 88506aa); set-off path never touches audio.
 * The cut magnitude (hidden under black) is reported. Geometry + controller only; not a render or device acceptance. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');const S=require('./journey-scene.cjs');const {legs,journeyCamera,L,routeLength}=S;
const {createHarness}=require('../board-ui/harness.cjs');const H=createHarness(),SRC=S.ROOT+'/creator-build-project/assets/scripts/';
const {RegionJourneyController,SETOFF_FADE}=H.load(SRC+'world-r1/RegionJourneyCore.ts'),{Cancellation}=H.load(SRC+'world-r1/WorldFlowCore.ts');
const results=[];const check=async(id,fn)=>{try{results.push({id,status:'PASS',...await fn()});}catch(e){results.push({id,status:'FAIL',error:String(e.stack||e)});}};
const dir=p=>{const v=p.target.map((x,i)=>x-p.position[i]),l=Math.hypot(...v);return v.map(x=>x/l);},ang=(a,b)=>{const u=dir(a),v=dir(b);return Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1]+u[2]*v[2])))*180/Math.PI;},dp=(a,b)=>Math.hypot(...a.position.map((x,i)=>x-b.position[i]));
const leg=legs[0],cam=d=>journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,0),FR=L.speedMps/60;
const PIN={"0":[-5.556268,3.4,-0.839658,-2.016281,2.426991,6.268207,48],"0.78":[-5.233083,3.4,-0.156411,-1.848599,2.426991,7.0268,48],"1":[-5.147828,3.4,0.040089,-1.800326,2.426991,7.240608,48],"2":[-4.784309,3.4,0.947897,-1.57697,2.426991,8.211934,48],"5":[-4.246386,3.827481,3.747258,-1.296961,2.854472,11.119784,48],"10":[-3.7135,4.906931,8.408973,-1.37828,3.933922,15.998439,48],"20":[-3.7135,5.065319,18.363713,-1.37828,4.09231,25.95318,48]};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const app=S.appr1,bridgeStart=routeLength(app),bridgeEnd=bridgeStart+routeLength(S.bridge1);
function rig({cover=true,route={}}={}){const log=[];let alpha=0,progress=0,covers=[];
 const lease={route:{from:'island',to:'meadow',path:leg.path,bridgeStart,bridgeEnd,speed:L.speedMps,startBlendM:0,...route},show:v=>log.push({k:'show',v,alpha}),dispose:()=>{}};
 const scene={prepare:async()=>lease,readCamera:()=>structuredClone(leg.start)};const controller=new RegionJourneyController(scene);
 const world={setCamera:p=>log.push({k:'camera',p:structuredClone(p),alpha})};
 if(cover)world.fadeCover=(a,s)=>{const d=deferred();log.push({k:'cover',a,s,from:alpha});covers.push({a,s,d,done:()=>{alpha=a;log.push({k:'coverDone',a});d.resolve();}});return d.promise;};
 const performed=[];const actor={walkProgress:()=>progress,perform:(action)=>{log.push({k:'walk',alpha});const d=deferred();performed.push(d);return d.promise;},cancelAndReset:()=>{},setVisible:()=>{}};
 return {controller,world,actor,log,covers,performed,setProgress:p=>{progress=p;controller.observe(actor,world);},alpha:()=>alpha};}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
await check('G1 journeyCamera unchanged vs d238881; continuous, ≤ 20°/s from the cut (0–10 m)',()=>{for(const [d,v] of Object.entries(PIN)){const c=cam(+d),g=[...c.position,...c.target,c.fovVerticalDeg];g.forEach((x,i)=>assert(Math.abs(x-v[i])<1e-5,`d=${d}[${i}] ${x} vs ${v[i]}`));}
 let mS=0,mT=0;for(let d=0;d<10-1e-9;d+=FR){const a=cam(d),b=cam(d+FR);mS=Math.max(mS,dp(a,b));mT=Math.max(mT,ang(a,b)*60);assert.equal(b.fovVerticalDeg,48);}
 assert(mS<=.05,'step '+mS);assert(mT<=20,'turn '+mT);return {maxStepPerFrameM:+mS.toFixed(4),maxTurnDegS:+mT.toFixed(2),fov:48};});
await check('G2 fade-in frames: in frame, chest/head/face unoccluded (no palm), lens ≥ 1 m',()=>{const end=SETOFF_FADE.inS*L.speedMps,rows=[];
 for(let d=0;d<=end+1e-9;d+=FR){const c=cam(d),p=S.sampleRoute(leg.path,d),f=dir(c),r=[f[2],0,-f[0]].map(x=>x/Math.hypot(f[2],f[0])),up=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],th=Math.tan(c.fovVerticalDeg*Math.PI/360),asp=390/844;
  const ndc=q=>{const v=q.map((x,i)=>x-c.position[i]),z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2];return [(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*asp),(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th),z];};
  for(const h of [.15,.9,1.6]){const [x,y,z]=ndc([p[0],p[1]+h,p[2]]);assert(z>0&&Math.abs(x)<=1&&Math.abs(y)<=1,`d=${d.toFixed(2)} h=${h} out of frame`);}
  for(const h of [.9,1.25,1.5,1.6]){const b=S.blockers(leg.objs,c.position,[p[0],p[1]+h,p[2]]);assert.deepEqual(b,[],`d=${d.toFixed(2)} h=${h} hidden by ${b}`);}
  const low=S.blockers(leg.objs,c.position,[p[0],p[1]+.15,p[2]]).concat(S.blockers(leg.objs,c.position,[p[0],p[1]+.5,p[2]]));assert(!low.some(n=>/palm/.test(n)),'palm on her legs '+low);
  rows.push({d:+d.toFixed(3),legsBehind:[...new Set(low)]});}
 const [lens]=S.clearance(cam(0).position,leg.objs);assert(lens>=1);return {fadeInM:+end.toFixed(3),frames:rows.length,lowPointsBehind:[...new Set(rows.flatMap(r=>r.legsBehind))]};});
await check('C1 controller: fade out -> cut + show only under full black -> fade in -> walk',async()=>{const R=rig(),token=new Cancellation();await R.controller.prepare('meadow',leg.path[0],token);
 const w=R.controller.walk(R.actor,R.world,token);await tick();
 assert.deepEqual(R.log.map(e=>e.k),['cover'],'only the fade-out may start first: '+R.log.map(e=>e.k));assert.equal(R.log[0].a,1);assert.equal(R.log[0].s,SETOFF_FADE.outS);
 R.covers[0].done();await tick();await tick();
 const k=R.log.map(e=>e.k);assert.deepEqual(k,['cover','coverDone','camera','show','cover','walk'],k.join(','));
 const cut=R.log.find(e=>e.k==='camera');assert.equal(cut.alpha,1,'cut not under full black');const c0=cam(0);assert(dp(cut.p,c0)<1e-9&&ang(cut.p,c0)<1e-6&&cut.p.fovVerticalDeg===48);
 assert.equal(R.log.find(e=>e.k==='show').alpha,1);const fin=R.log[4];assert.equal(fin.a,0);assert.equal(fin.s,SETOFF_FADE.inS);
 R.setProgress(.001);const after=R.log.filter(e=>e.k==='camera');assert.equal(after.length,2);assert(dp(after[0].p,after[1].p)<.2,'second write continues from the cut');
 R.covers[1].done();assert.equal(R.controller.fadeState,'in');await tick();assert.equal(R.controller.fadeState,'clear');
 for(let i=1;i<=200;i++)R.setProgress(i/200);R.performed[0].resolve();await w;const cams=R.log.filter(e=>e.k==='camera');let cuts=0;for(let i=1;i<cams.length;i++)if(dp(cams[i-1].p,cams[i].p)>5)cuts++;
 assert.equal(cuts,0,'no cut after the black one');return {sequence:k,cutUnderAlpha:1,cutJumpM:+dp(leg.start,c0).toFixed(3),cutTurnDeg:+ang(leg.start,c0).toFixed(2),fov:[leg.start.fovVerticalDeg,48],fade:SETOFF_FADE};});
await check('C2 lease without fadeCover: old path, no cover',async()=>{const R=rig({cover:false}),token=new Cancellation();await R.controller.prepare('meadow',leg.path[0],token);const w=R.controller.walk(R.actor,R.world,token);await tick();
 assert.deepEqual(R.log.map(e=>e.k),['show','walk']);R.setProgress(1);R.performed[0].resolve();await w;return {};});
await check('C3 cancel during the fade-out: cover goes back to 0, no cut, no walk',async()=>{const R=rig(),token=new Cancellation();await R.controller.prepare('meadow',leg.path[0],token);const w=R.controller.walk(R.actor,R.world,token).catch(e=>e);await tick();
 token.cancel();R.covers[0].done();const e=await w;assert(e instanceof Error);const k=R.log.map(e=>e.k);assert(!k.includes('walk'),k.join());const last=R.log.filter(e=>e.k==='cover').at(-1);assert.equal(last.a,0);return {sequence:k};});
await check('C4 08→09 (default blend): no fade',async()=>{const R=rig({route:{startBlendM:undefined}}),token=new Cancellation();await R.controller.prepare('meadow',leg.path[0],token);const w=R.controller.walk(R.actor,R.world,token);await tick();
 assert(!R.log.some(e=>e.k==='cover'));R.setProgress(1);R.performed[0].resolve();await w;return {};});
await check('C5 wiring: startBlendM 0 on island 04→05; WorldLease.fadeCover -> ScreenCover <- WorldIntegrationBoot cover; no audio in the set-off path',()=>{
 const rd=f=>fs.readFileSync(SRC+f,'utf8');assert(/startBlendM:0/.test(rd('region/RegionJourneyAdapter.ts').replace(/\s/g,'')));assert.equal(legs[1].startBlendM,undefined);
 assert(/get fadeCover\(\)\{return hasScreenCover\(\)\?/.test(rd('world-r1/WorldFlowComponent.ts')));const b=rd('WorldIntegrationBoot.ts');assert(/setScreenCover\(\(a,sec\)=>this\.fadeCover\(a,sec\)\)/.test(b)&&/setScreenCover\(null\)/.test(b)&&/addComponent\(UIOpacity\)/.test(b)&&/this\.tickCover\(\);this\.tickLoading/.test(b));
 const core=rd('world-r1/RegionJourneyCore.ts'),wk=core.slice(core.indexOf(' async walk('),core.indexOf(' restore(actor')).replace(/\/\/.*$/gm,'');assert(wk.length>200&&!/Audio|audio|duck|volume/.test(wk),'set-off must not touch audio');assert.deepEqual({...SETOFF_FADE},{outS:.25,inS:.35});return {};});
const report={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',timeUTC:new Date().toISOString(),scope:'journeyCamera geometry + real RegionJourneyController with a recording world. Not a render or device acceptance.',checks:results};
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/journey-start-continuity.json',JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({status:report.status,checks:results.map(r=>({id:r.id,status:r.status,error:r.error&&r.error.split('\n').slice(0,2).join(' ').slice(0,400)}))},null,1));if(report.status!=='PASS')process.exitCode=1;
})();
