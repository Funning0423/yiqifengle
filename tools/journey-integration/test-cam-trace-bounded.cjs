'use strict';
// full9b P0 gate (Mac dc86ade2 A/B: camTrace ON → renderer main thread 100% in microtask checkpoints, RSS 0.75→2.6 GB, freeze in the
// lakeside door phase; camTrace OFF → the leg completes). Drives the REAL CamTraceLog through a lakeside boarding (walk → door →
// stepIn → sit → flight start, 30 s game time at 60 fps, the dc86ade2 3-writes-per-frame pattern) with camTrace ON and asserts:
//  R1 re-entry: a write issued from inside the trace output (console hook / getter) is counted, never recursed or traced
//  R2 no busy-wait / microtasks: 0 promises created by the trace per frame (async_hooks), bounded ms per frame
//  R3 bounded output: ≤ CAM_LOG_BUDGET.linesPerS lines per second; plain camTrace takes NO stack (stacks only with camTraceStacks=1, capped)
const path=require('node:path'),ah=require('node:async_hooks'),{performance}=require('node:perf_hooks');
const root=process.env.QF_JOURNEY_SOURCE_ROOT||path.resolve(__dirname,'../..'),S=root+'/creator-build-project/assets/scripts/';
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();const C=H.load(S+'region/CamTraceLog.ts');
let frame=0;globalThis.cc={director:{getTotalFrames:()=>frame}};
const P=i=>({position:[i*0.01,1,2],rotation:[0,Math.sin(i*1e-3),0,Math.cos(i*1e-3)],fovVerticalDeg:48});
const res=[];const t=(id,f)=>{try{const r=f();res.push({id,status:r.ok?'PASS':'FAIL',...r});}catch(e){res.push({id,status:'FAIL',error:String(e&&e.message||e).slice(0,200)});}};
const budget=(C.CAM_LOG_BUDGET&&C.CAM_LOG_BUDGET.linesPerS)||Infinity;
t('R1 re-entry guard',()=>{C.camLogReset();C.camLogStart('camTrace=1',{});let lines=0;
 C.camLog.out=()=>{lines++;C.camLogWrite(null,P(0),'reenter-from-out');};/* a console hook that writes the camera again */
 frame=1;for(let i=0;i<10;i++)C.camLogWrite(null,P(i),'w');const reentry=C.camLog.reentry;C.camLogReset();
 return {ok:typeof reentry==='number'&&reentry===lines&&lines===10,lines,reentry};});
t('R2/R3 boarding 30 s camTrace ON',()=>{C.camLogReset();C.camLogStart('camTrace=1',{});const out=[];C.camLog.out=s=>out.push(s);
 let promises=0;const hook=ah.createHook({init(id,type){if(type==='PROMISE')promises++;}}).enable();
 const t0w=performance.now();let now=0;const realNow=performance.now.bind(performance);
 /* game time drives the trace clock: 60 fps for 30 s */performance.now=()=>t0w+now;let worst=0;
 try{for(frame=1;frame<=1800;frame++){now=frame*1000/60;const a=realNow();for(let k=0;k<3;k++)C.camLogWrite(null,P(frame*3+k),k?'world.setCamera':'RegionJourneyCore:onFrame');worst=Math.max(worst,realNow()-a);}}
 finally{performance.now=realNow;hook.disable();}
 const per={};for(const l of out){const m=l.match(/ t=(\d+)/);if(m)per[m[1]]=(per[m[1]]||0)+1;}const maxPerS=Math.max(...Object.values(per));
 const stacks=out.filter(l=>/CALLER=/.test(l)).length;C.camLogReset();
 return {ok:promises===0&&maxPerS<=budget&&budget<=120&&stacks===0&&worst<50,lines:out.length,maxLinesPerS:maxPerS,budget,stacks,promisesByTrace:promises,worstFrameMs:+worst.toFixed(2)};});
t('R3 stacks opt-in and capped',()=>{C.camLogReset();C.camLogStart('camTrace=1&camTraceStacks=1',{});const out=[];C.camLog.out=s=>out.push(s);
 for(frame=1;frame<=2000;frame++){C.camLogWrite(null,P(frame),'a');C.camLogWrite(null,P(frame+1),'b');}
 const stacks=out.filter(l=>/CALLER=/.test(l)).length,cap=(C.CAM_LOG_BUDGET&&C.CAM_LOG_BUDGET.maxStacks)||Infinity;C.camLogReset();return {ok:stacks>0&&stacks<=cap&&cap<=1000,stacks,cap};});
const status=res.every(r=>r.status==='PASS')?'PASS':'FAIL';console.log(JSON.stringify({test:'cam-trace-bounded',status,results:res},null,1));process.exit(status==='PASS'?0:1);
