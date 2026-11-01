'use strict';
/** p0-meadow-ab B gate ([QF_GPU] shader + long-frame lines; QA only, stripped from release).
 *  fin r6 6fb9181b: 69 shader compiles at sail set-off but only 28 SHADER lines (the shared 60/scene detail cap, prevCapped=9) and
 *  no way to tie the 1,601 ms frame to its shaders/sync calls. Now:
 *   1. SHADER lines have their own cap (GPU_PROBE.shaderMaxDetail per scene) — 69 shaders after 60 TEX lines in one scene all log;
 *   2. every SHADER line carries frame=<engine frame>;
 *   3. a frame > GPU_PROBE.longFrameMs (100) logs `[QF_GPU] LONG frame= ms= shaders= sync= scene=` with that frame's counts;
 *   4. [QF_SYNC] summary carries allowMaxPerFrame={reason:max} (per-frame max of qa:pre-transition-profile for MAC_STEPS r8);
 *   5. release strip removes all of it (probe-free list has QF_GPU / QF_SYNC).
 *  Negative: the pre-fix CamTraceLog of this branch under the same scenario → < 69 shader lines and no LONG line → FAIL. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const {stripText}=require('../build-guard/strip-probes.cjs'),{probeFree}=require('../build-guard/release-gates.cjs');
const ROOT=path.join(__dirname,'../..'),F=path.join(ROOT,'creator-build-project/assets/scripts/region/CamTraceLog.ts');
function scenario(src){
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};const W={snap:{state:'crossing-out',journey:{region:'island',target:null}}};const wi={snapshot:()=>({world:W.snap})};
 const cc={Director:{EVENT_AFTER_DRAW:'a'},director:{on(){}},sys:{},assetManager:{},Game:{},Input:{EventType:{}},game:{on(){}},input:{on(){}},screen:{},view:{},Vec3:class{},MeshRenderer:class{}};
 const G={__worldIntegration:wi};G.globalThis=G;
 vm.runInNewContext(js,Object.assign(G,{module:m,exports:m.exports,console,performance:{now:()=>0},setTimeout,clearTimeout,require:s=>s==='cc'?cc:s.includes('DebugQuery')?{debugSearch:()=>''}:s.includes('CameraPose')?{cameraWriteHook:{}}:{}}));
 const M=m.exports,lines=[];M.gpuProbe.out=s=>lines.push(s);M.syncProbe.out=s=>lines.push(s);
 const data={},store={getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=v;}};
 let syncEnd=()=>{};M.installSyncProbe(G,store,null,null,{onFrameEnd:f=>syncEnd=f});
 const dev={numDrawCalls:1,numTris:1,numInstances:1,memoryStatus:{},createTexture(i){return {info:i,destroy(){}};},createShader(i){return {i};},copyBuffersToTexture(){}};
 M.installGpuProbe(dev,null,()=>{});let t=0;const frame=ms=>{t+=ms;syncEnd();M.gpuFrame(dev,null,t);};
 for(let i=0;i<M.SYNC_BOOT_FRAMES+5;i++)frame(16);
 for(let i=0;i<60;i++)dev.createTexture({width:1024,height:1024+i,format:35});/* spends the 60/scene TEX detail cap */
 frame(16);
 /* the set-off frame: profile flush calls + 69 shader compiles + 1601 ms */
 G.__qfSyncAllow='pre-transition-profile';for(let i=0;i<12;i++){store.setItem('k'+i,'v');store.getItem('k'+i);}delete G.__qfSyncAllow;
 W.snap={state:'region-loading',journey:{region:'island',target:'meadow'}};
 for(let i=0;i<69;i++)dev.createShader({name:'meadow-'+i+'|p0',stages:[{source:'#define FOG 1\n'+i}]});
 frame(1601);frame(16);frame(16);
 G.__qfSyncAllow='pre-transition-profile';for(let i=0;i<5;i++)store.getItem('z');delete G.__qfSyncAllow;frame(16);
 for(let i=0;i<600;i++)frame(16);
 return {M,lines};}
function verdict({M,lines}){
 const sh=lines.filter(l=>/^\[QF_GPU\] SHADER n=\d+ (?:frame=\d+ )?(?:effect|name)=meadow-\d+[ |]/.test(l));
 const long=lines.find(l=>/^\[QF_GPU\] LONG frame=\d+ ms=1601\.0 shaders=69 sync=24 scene=\S+ /.test(l));
 const shFrames=new Set(sh.map(l=>(l.match(/ frame=(\d+)/)||[])[1]).map(x=>x===undefined?'none':+x));
 const sum=lines.filter(l=>/^\[QF_SYNC\] frames=/.test(l)).at(-1)||'';
 const am=/allowMaxPerFrame=(\{[^}]*\})/.exec(sum);const amax=am?JSON.parse(am[1])['qa:pre-transition-profile']:undefined;
 const ok=sh.length===69&&!!long&&shFrames.size===1&&(long&&+long.match(/frame=(\d+)/)[1]===[...shFrames][0])&&amax===24;
 return {ok,shaderLines:sh.length,long:long||null,shFrames:[...shFrames],allowMax:amax};}
const src=fs.readFileSync(F,'utf8');
const r=verdict(scenario(src));console.log('current: '+JSON.stringify(r));
assert.equal(r.shaderLines,69,'all 69 shader lines');assert.ok(r.long,'LONG line with shaders=69 sync=24');assert.equal(r.shFrames.length,1);assert.equal(r.allowMax,24);assert.ok(r.ok);
// short frames never log LONG
const s2=scenario(src);assert.equal(s2.lines.filter(l=>/\[QF_GPU\] LONG /.test(l)).length,1,'exactly one LONG line (only the 1601 ms frame)');
// release strip
const rel=stripText(src).out;for(const w of ['[QF_GPU] LONG','gpuShaderLine','allowMaxPerFrame','shaderMaxDetail','QF_GPU','QF_SYNC'])assert.ok(!rel.includes(w),'release still has '+w);
assert.equal(probeFree([{name:'CamTraceLog.ts',text:rel}]).hits.length,0,'stripped CamTraceLog probe-free');
assert.ok(probeFree([{name:'CamTraceLog.ts',text:src}]).hits.some(h=>h.rule==='QF_GPU'),'probe-free flags the unstripped source');
// negative: current code (aa044e43) — shared cap + no LONG line
/* pre-fix revision on THIS branch: parent of the commit that introduced gpuShaderLine (HEAD while uncommitted) */
const rel_='creator-build-project/assets/scripts/region/CamTraceLog.ts',intro=cp.execFileSync('git',['log','-n1','--format=%H','-S','gpuShaderLine','--',rel_],{cwd:ROOT,encoding:'utf8'}).trim();
const old=cp.execFileSync('git',['show',(intro?intro+'^':'HEAD')+':'+rel_],{cwd:ROOT,encoding:'utf8'});
const n=verdict(scenario(old));console.log('negative (pre-fix code on this branch): '+JSON.stringify(n)+' '+(n.ok?'PASS':'FAIL'));
assert.ok(!n.ok,'self-test: old probe not caught');
console.log('PASS gpu-shader-frames');
