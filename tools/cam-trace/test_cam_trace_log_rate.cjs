#!/usr/bin/env node
'use strict';
/** r2 P0 gate (chainJ 23267b2d camTrace ON froze, chainI camTrace OFF passed with identical sync screenshots): camTrace's own
 *  console volume. chainJ out/console.log: 15389 lines / 2.14 MB in 189 s = 81 lines/s, 11.3 KB/s (peak 15.5 KB/s); [QF_HER_FRAME]
 *  8146 lines = 1 per frame, [QF_CAM_TRACE] 7169. chainI: 0.5 lines/s, 425 B/s. Every console.* in the DevTools appservice is
 *  forwarded to the DevTools console over IPC.
 *  1. RUNTIME (wx host, camTrace ON, 60 fps for 20 s, 1 trace write + 1 her-frame line + 1 burst line per frame): console calls
 *     ≤ (ceil(bytes/chunk)+1) per flush, ≤ 1 flush per CAM_LOG_SINK.flushMs, bytes ≤ CAM_LOG_SINK.bytes+tail per flush; overflow
 *     counted (sinkDropped, DROPPED= in the flush tail, __qfCamTraceStats).
 *  2. STATIC: CamTraceLog.ts calls console.* only in the sink (camSink.emit / camLog.out fallback when no wx host); no
 *     `if(camLog.on…)` block anywhere in game code calls console.* directly (must go through camLog.out); HER_FRAME_EVERY ≥ 6.
 *  Negative self-tests: direct console.log out (pre-r2), console.log in a camTrace probe, an unthrottled camLog.on console line. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts/');
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).replace(/(^|[^:'"\\])\/\/[^\n]*/g,(m,a)=>a+' '.repeat(m.length-a.length));
function runtime(mutate){
 const H=require(path.join(ROOT,'tools/board-ui/harness.cjs')).createHarness();const cc=H.cc;cc.Director.EVENT_AFTER_DRAW='director_after_draw';cc.director.on=()=>{};cc.director.off=()=>{};
 const realNow=Date.now,realLog=console.log,realST=global.setTimeout;let now=1e12;const calls=[];
 global.__QF_CAM_TRACE=true;global.wx={};Date.now=()=>now;global.setTimeout=()=>0;
 try{const T=H.load(S+'region/CamTraceLog.ts');if(mutate)mutate(T);console.log=(...a)=>calls.push({t:now,s:a.join(' ')});
  assert.equal(T.camLog.on,true,'camTrace on');assert.equal(T.camSinkOn(),true,'sink active on a wx host');
  const P=i=>({position:[i*0.01,1,0],rotation:[0,0,0,1],fovVerticalDeg:45});
  for(let f=0;f<1200;f++){now+=1000/60;T.camTag('BalloonTransit:B5');T.camLogWrite(null,P(f),'world.setCamera');
   T.camLog.out('[QF_HER_FRAME] fr='+f+' bbox=101.234,202.345,150.456,320.567 occ=0.133 n=15 safe=0,47,390,750 pn='+(now%1e6).toFixed(3));
   T.camLog.out('[QF_BURST_TEST] '+'x'.repeat(200));}
  T.camSinkFlush();const st=T.camSink,K=T.CAM_LOG_SINK;
  return {calls,st:{flushes:st.flushes,sinkDropped:st.sinkDropped},K,T};}
 finally{Date.now=realNow;console.log=realLog;global.setTimeout=realST;delete global.wx;delete global.__QF_CAM_TRACE;}}
function checkRuntime(r){const {calls,K}=r;const secs=20,maxPerFlush=Math.ceil(K.bytes/K.chunk)+1;
 assert.ok(r.st.flushes<=secs*1000/K.flushMs+2,'flushes '+r.st.flushes);
 assert.ok(calls.length<=(secs*1000/K.flushMs+2)*maxPerFlush,'console calls '+calls.length+' in '+secs+' s (pre-r2: one per line)');
 const bytes=calls.reduce((a,c)=>a+c.s.length,0);assert.ok(bytes<=(secs*1000/K.flushMs+2)*(K.bytes+200),'console bytes '+bytes);
 for(const c of calls)assert.ok(c.s.length<=K.chunk+200,'chunk '+c.s.length+' > '+K.chunk);
 assert.ok(r.st.sinkDropped>0&&calls.some(c=>/\[QF_CAM_LOG\] flush=\d+ lines=\d+ bytes=\d+ DROPPED=\d+/.test(c.s)),'overflow counted and reported');
 assert.ok(calls.some(c=>/\[QF_CAM_TRACE\] f=\d+/.test(c.s))&&calls.some(c=>/\[QF_HER_FRAME\] fr=/.test(c.s)),'trace lines still delivered');
 return {calls:calls.length,bytes,flushes:r.st.flushes,dropped:r.st.sinkDropped};}
const CT=fs.readFileSync(S+'region/CamTraceLog.ts','utf8');
function staticCheck(rel,src){const v=[];const s=strip(src);
 if(rel==='region/CamTraceLog.ts'){const allowed=s.replace(/emit:\(s:string\)=>console\.log\(s\)/,'').replace(/else console\.log\(s\);/,'');
  for(const m of allowed.matchAll(/console\.(log|info|warn|error|debug)\(/g))v.push(rel+': console.'+m[1]+' outside the camTrace sink @'+(s.slice(0,m.index).split('\n').length));
  const e=/export const HER_FRAME_EVERY=(\d+)/.exec(s);if(!e||+e[1]<6)v.push(rel+': HER_FRAME_EVERY must be ≥ 6 (her-frame probe ≤ 10 Hz)');}
 for(const m of s.matchAll(/if\s*\(([^)]*camLog\.on[^)]*)\)\s*(\{)?/g)){let body;const at=m.index+m[0].length;
  if(m[2]){let d=1,j=at;for(;j<s.length&&d;j++){if(s[j]==='{')d++;else if(s[j]==='}')d--;}body=s.slice(at,j);}else body=s.slice(at,s.indexOf(';',at)+1);
  if(/console\.(log|info|warn|error|debug)\(/.test(body))v.push(rel+': camLog.on block calls console.* directly @'+(s.slice(0,m.index).split('\n').length)+' (use camLog.out)');}
 return v;}
const walk=(d,o=[])=>{for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p,o);else if(/\.ts$/.test(f.name)&&!/\.d\.ts$/.test(f.name))o.push(p);}return o;};
let viol=[];for(const p of walk(S))viol.push(...staticCheck(path.relative(S,p).split(path.sep).join('/'),fs.readFileSync(p,'utf8')));
assert.deepEqual(viol,[],'camTrace console volume:\n'+viol.join('\n'));
const R=checkRuntime(runtime());
let caught=0;const expectCatch=(n,fn)=>{let ok=false;try{fn();}catch{ok=true;}assert.ok(ok,'self-test did not catch: '+n);caught++;};
expectCatch('pre-r2 direct console.log per line',()=>checkRuntime(runtime(T=>{T.camLog.out=s=>console.log(s);})));
expectCatch('sink with no per-flush cap',()=>checkRuntime(runtime(T=>{T.camLog.out=s=>{T.camSink.buf.push(s);T.camSink.bytes+=s.length;if(T.camSink.buf.length>2000)T.camSinkFlush();};})));
expectCatch('console.log inside the her-frame probe',()=>assert.deepEqual(staticCheck('region/CamTraceLog.ts',CT.replace("const sa=probeSafeArea();","const sa=probeSafeArea();console.log('[QF_HER_FRAME] x');")),[]));
expectCatch('her-frame every frame',()=>assert.deepEqual(staticCheck('region/CamTraceLog.ts',CT.replace(/export const HER_FRAME_EVERY=\d+/,'export const HER_FRAME_EVERY=1')),[]));
expectCatch('unthrottled camLog.on console line elsewhere',()=>assert.deepEqual(staticCheck('x/A.ts',"export class A{ lateUpdate(){ if(camLog.on)console.log('[QF_X] '+Date.now()); } }"),[]));
expectCatch('braced camLog.on block with console.info',()=>assert.deepEqual(staticCheck('x/B.ts',"function f(){ if(camLog.on&&x){ const s='a'; console.info(s); } }"),[]));
assert.deepEqual(staticCheck('x/C.ts',"function f(){ if(camLog.on)camLog.out('[QF_X] ok'); }"),[]);
console.log('PASS cam-trace-log-rate 20s@60fps: consoleCalls='+R.calls+' bytes='+R.bytes+' flushes='+R.flushes+' dropped='+R.dropped+' (pre-r2 ≈ 3600 calls) self-tests='+caught);
