'use strict';
/** P0 finR [QF_GPU] probe: per-second counters + TEX/SHADER detail via the camTrace sink, no host sync calls; release-stripped.
 *  Negative: a stall second (rAF 2000 ms) must show raf max and long=1; an upload burst must show uploads; a probe that calls wx
 *  (sync host API) would be caught by the no-wx assertion. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const F=path.join(__dirname,'../../creator-build-project/assets/scripts/region/CamTraceLog.ts'),src=fs.readFileSync(F,'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const m={exports:{}};let wxCalls=0;const W={snap:{state:'island',journey:{region:'island',target:null}}};const wi={snapshot:()=>({world:W.snap})};const wx=new Proxy({},{get(){wxCalls++;return ()=>({});}});
const cc={Director:{EVENT_AFTER_DRAW:'a'},director:{on(){}},sys:{},assetManager:{},Game:{},Input:{EventType:{}},game:{on(){}},input:{on(){}},screen:{},view:{},Vec3:class{},MeshRenderer:class{}};
vm.runInNewContext(js,{module:m,exports:m.exports,console,performance:{now:()=>0},setTimeout,clearTimeout,globalThis:{wx,__worldIntegration:wi},__worldIntegration:wi,require:s=>s==='cc'?cc:s.includes('DebugQuery')?{debugSearch:()=>''}:s.includes('CameraPose')?{cameraWriteHook:{}}:{}});
const M=m.exports,lines=[];M.gpuProbe.out=s=>lines.push(s);
const dev={numDrawCalls:120,numTris:300000,numInstances:40,memoryStatus:{textureSize:300*1048576,bufferSize:50*1048576},createTexture(i){return {info:i};},createShader(i){return {i};},copyBuffersToTexture(){}};
let frame=()=>{};assert.ok(M.installGpuProbe(dev,{assets:new Map([['u1',1],['u2',2]]),bundles:new Map([['region_skycity',{getAssetInfo:id=>id==='u1'?{}:null}]])},f=>{frame=f;}));
let t=0;const step=ms=>{t+=ms;M.gpuFrame(dev,{assets:new Map([['u1',1],['u2',2]]),bundles:new Map([['region_skycity',{getAssetInfo:id=>id==='u1'?{}:null}],['region_lakeside',{getAssetInfo:id=>id==='u2'?{}:null}]])},t);};
for(let i=0;i<70;i++)step(17);
dev.createTexture({width:2048,height:2048,format:35});dev.createShader({name:'builtin-standard|lake'});
step(2000);step(17);
const sec=lines.filter(l=>/^\[QF_GPU\] s=/.test(l));assert.ok(sec.length>=2,'per-second lines '+lines.join('\n'));
assert.ok(lines.some(l=>/\[QF_GPU\] TEX op=create 2048x2048 .*MB=16\.00/.test(l)),'tex upload detail');
assert.ok(lines.some(l=>/\[QF_GPU\] SHADER n=1 effect=builtin-standard pass=lake defHash=\w+ stages=0 .*scene=island\|island>- /.test(l)),'shader detail');
const stall=sec.find(l=>/ raf=2000\//.test(l));assert.ok(stall&&/ long=1 /.test(stall)&&/uploads=1\/16\.0/.test(stall)&&/shaders=1/.test(stall),'stall second: '+sec.join('\n'));
assert.ok(sec.some(l=>/regions=\{"region_skycity":1,"region_lakeside":1,"total":2\}/.test(l)),'regions resident');
assert.ok(/texMB=300\.0 bufMB=50\.0/.test(sec[0]),'memoryStatus');
assert.equal(wxCalls,0,'probe touched a sync host API');
assert.ok(/\/\*QF_PROBE_BEGIN\*\/\/\*\* \[QF_GPU\]|QF_PROBE_BEGIN[\s\S]*installGpuProbe[\s\S]*QF_PROBE_END/.test(src),'probe inside QF_PROBE markers');
// finT: per-scene cap reset. Fill the island scene's cap, switch to the balloon leg, first-use lines appear again.
for(let i=0;i<80;i++)dev.createShader({name:'boot-'+i+'|p'});
assert.ok(lines.some(l=>/SHADER n=\d+ effect=boot-0 /.test(l)),'boot lines up to the cap');
assert.ok(!lines.some(l=>/effect=boot-79 /.test(l)),'island scene capped');
W.snap={state:'region-loading',journey:{region:'meadow',target:'skycity'}};
dev.createShader({name:'balloon-grade|pass0',stages:[{source:'#define A 1\nvoid main(){}'}]});
assert.ok(lines.some(l=>/\[QF_GPU\] SCENE island\|island>- -> region-loading\|meadow>skycity prevDetail=60 prevCapped=\d+/.test(l)),'scene switch line');
assert.ok(lines.some(l=>/SHADER n=\d+ effect=balloon-grade pass=pass0 defHash=[0-9a-f]+ stages=1 .*scene=region-loading\|meadow>skycity/.test(l)),'balloon first-use shader after reset');
// repeated uploads into one texture: one detail line
const T={width:1024,height:1024,format:35};const before=lines.filter(l=>/TEX op=upload/.test(l)).length;
for(let i=0;i<5;i++)dev.copyBuffersToTexture([],T,[{texExtent:{width:1024,height:1024}}]);
assert.equal(lines.filter(l=>/TEX op=upload 1024x1024/.test(l)).length-before,1,'same texture logs once');
// (the pre-finT global cap is exactly the 'island scene capped' state above, never reset)
assert.equal(wxCalls,0,'probe touched a sync host API');
if(process.env.DBG)console.log(lines.join('\n'));console.log('PASS gpu-probe lines='+lines.length);
