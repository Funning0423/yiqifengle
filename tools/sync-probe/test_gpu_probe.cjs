'use strict';
/** P0 finR [QF_GPU] probe: per-second counters + TEX/SHADER detail via the camTrace sink, no host sync calls; release-stripped.
 *  Negative: a stall second (rAF 2000 ms) must show raf max and long=1; an upload burst must show uploads; a probe that calls wx
 *  (sync host API) would be caught by the no-wx assertion. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const F=path.join(__dirname,'../../creator-build-project/assets/scripts/region/CamTraceLog.ts'),src=fs.readFileSync(F,'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const m={exports:{}};let wxCalls=0;const wx=new Proxy({},{get(){wxCalls++;return ()=>({});}});
const cc={Director:{EVENT_AFTER_DRAW:'a'},director:{on(){}},sys:{},assetManager:{},Game:{},Input:{EventType:{}},game:{on(){}},input:{on(){}},screen:{},view:{},Vec3:class{},MeshRenderer:class{}};
vm.runInNewContext(js,{module:m,exports:m.exports,console,performance:{now:()=>0},setTimeout,clearTimeout,globalThis:{wx},require:s=>s==='cc'?cc:s.includes('DebugQuery')?{debugSearch:()=>''}:s.includes('CameraPose')?{cameraWriteHook:{}}:{}});
const M=m.exports,lines=[];M.gpuProbe.out=s=>lines.push(s);
const dev={numDrawCalls:120,numTris:300000,numInstances:40,memoryStatus:{textureSize:300*1048576,bufferSize:50*1048576},createTexture(i){return {info:i};},createShader(i){return {i};},copyBuffersToTexture(){}};
let frame=()=>{};assert.ok(M.installGpuProbe(dev,{assets:new Map([['u1',1],['u2',2]]),bundles:new Map([['region_skycity',{getAssetInfo:id=>id==='u1'?{}:null}]])},f=>{frame=f;}));
let t=0;const step=ms=>{t+=ms;M.gpuFrame(dev,{assets:new Map([['u1',1],['u2',2]]),bundles:new Map([['region_skycity',{getAssetInfo:id=>id==='u1'?{}:null}],['region_lakeside',{getAssetInfo:id=>id==='u2'?{}:null}]])},t);};
for(let i=0;i<70;i++)step(17);
dev.createTexture({width:2048,height:2048,format:35});dev.createShader({name:'builtin-standard|lake'});
step(2000);step(17);
const sec=lines.filter(l=>/^\[QF_GPU\] s=/.test(l));assert.ok(sec.length>=2,'per-second lines '+lines.join('\n'));
assert.ok(lines.some(l=>/\[QF_GPU\] TEX op=create 2048x2048 .*MB=16\.00/.test(l)),'tex upload detail');
assert.ok(lines.some(l=>/\[QF_GPU\] SHADER n=1 name=builtin-standard\|lake/.test(l)),'shader detail');
const stall=sec.find(l=>/ raf=2000\//.test(l));assert.ok(stall&&/ long=1 /.test(stall)&&/uploads=1\/16\.0/.test(stall)&&/shaders=1/.test(stall),'stall second: '+sec.join('\n'));
assert.ok(sec.some(l=>/regions=\{"region_skycity":1,"region_lakeside":1,"total":2\}/.test(l)),'regions resident');
assert.ok(/texMB=300\.0 bufMB=50\.0/.test(sec[0]),'memoryStatus');
assert.equal(wxCalls,0,'probe touched a sync host API');
assert.ok(/\/\*QF_PROBE_BEGIN\*\/\/\*\* \[QF_GPU\]|QF_PROBE_BEGIN[\s\S]*installGpuProbe[\s\S]*QF_PROBE_END/.test(src),'probe inside QF_PROBE markers');
console.log('PASS gpu-probe lines='+lines.length);
