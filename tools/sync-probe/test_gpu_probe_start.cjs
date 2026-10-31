'use strict';
/** r2 (B360 481c599c NOPROBE): camTrace startup line + GPU probe install that is never silent.
 *  Cases: device at module load (at=module); device appears late (at=deferred, exactly once, per-second lines follow);
 *  device never appears (probe NOT installed reason=no-device after maxFrames); [QF_CAM] enabled/src/query for query, CDP global
 *  (__QF_CAM_TRACE=1 before the module loads) and none; NEGATIVE: the old module-load-only install (installGpuProbe(undefined)) stays
 *  silent forever — the reason this test exists; strip-probes removes all of it from release. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const F=path.join(__dirname,'../../creator-build-project/assets/scripts/region/CamTraceLog.ts'),src=fs.readFileSync(F,'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function load(g,query,root){const m={exports:{}};const ev=new Map();const logs=[];
 const director={root,on(e,f){ev.set(f,e);},off(e,f){ev.delete(f);}};
 const cc={Director:{EVENT_AFTER_DRAW:'a'},director,sys:{},assetManager:{assets:new Map(),bundles:new Map()},Game:{},Input:{EventType:{}},game:{on(){}},input:{on(){}},screen:{},view:{},Vec3:class{},MeshRenderer:class{}};
 const con={log:s=>logs.push(String(s)),info(){},warn(){},error(){}};
 g.console=con;vm.runInNewContext(js,{module:m,exports:m.exports,console:con,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},globalThis:g,
  require:s=>s==='cc'?cc:s.includes('DebugQuery')?{debugSearch:()=>query}:s.includes('CameraPose')?{cameraWriteHook:{}}:{}});
 const fire=()=>{for(const f of [...ev.keys()])f();};return {M:m.exports,logs,ev,director,fire};}
const mkDev=()=>({numDrawCalls:1,numTris:1,numInstances:0,memoryStatus:{},createTexture(i){return {info:i,destroy(){}};},createShader(){return {};}});
const gpu=l=>l.filter(x=>/\[QF_GPU\]/.test(x));
// 1. device present at module load
{const A=load({},'?camTrace=1',{device:mkDev()});const all=A.logs.join('\n');
 assert.ok(/\[QF_CAM\] enabled=1 src=query query=\?camTrace=1/.test(all),'startup line (query): '+all);
 assert.ok(/\[QF_GPU\] probe installed at=module/.test(all),'module install line: '+all);assert.ok(!/deferred/.test(all),'no deferred install when installed at module');}
// 2. device appears late: deferred install on the first frame that has one, exactly once
{const root={};const A=load({},'?camTrace=1',root);assert.equal(A.M.gpuProbe.installed,false);const h0=A.ev.size;assert.ok(h0>=1,'deferred frame hook');
 A.fire();A.fire();root.device=mkDev();A.fire();A.fire();A.fire();
 const inst=A.logs.filter(l=>/probe installed/.test(l));assert.equal(inst.length,1,'exactly one install line: '+A.logs.join('\n'));
 assert.ok(/\[QF_GPU\] probe installed at=deferred frame=3/.test(inst[0]),inst[0]);assert.equal(A.M.gpuProbe.installed,true);
 assert.equal(root.device.__qfGpu,true,'device wrapped');
 let t=0;for(let i=0;i<130;i++){t+=17;A.M.gpuFrame(root.device,null,t);}
 assert.ok(A.logs.some(l=>/^\[QF_GPU\] s=/.test(l)),'per-second lines after deferred install');
 assert.ok(/gpu.*deferred/.test(JSON.stringify(A.M.camStart))||A.M.camStart.gpu==='deferred','status deferred');}
// 3. never a device: NOT installed after maxFrames, hook removed
{const A=load({},'?camTrace=1',undefined);const N=A.M.GPU_PROBE_START.maxFrames;for(let i=0;i<N+50;i++)A.fire();
 const no=A.logs.filter(l=>/probe NOT installed/.test(l));assert.equal(no.length,1,A.logs.join('\n'));
 assert.ok(new RegExp('reason=no-device frames='+N).test(no[0]),no[0]);assert.equal(A.M.camStart.gpu,'not-installed:no-device');}
// 4. CDP global before module load is honoured; none = enabled=0 and no probe at all
{const g={__QF_CAM_TRACE:1};const A=load(g,'?qfHooks=1',{device:mkDev()});const all=A.logs.join('\n');
 assert.ok(/\[QF_CAM\] enabled=1 src=global query=\?qfHooks=1/.test(all),'global: '+all);assert.equal(g.__qfCamStart.enabled,true);assert.equal(g.__qfCamStart.gpu,'module');}
{const g={};const A=load(g,'?qfHooks=1',{device:mkDev()});
 assert.deepEqual(A.logs,['[QF_CAM] enabled=0 src=none query=?qfHooks=1'],'off: one startup line only');assert.equal(A.M.gpuProbe.installed,false);assert.equal(g.__qfCamStart.gpu,'off');}
// 5. NEGATIVE: the old code path (module-load install only, device not yet there) is silent forever
{const A=load({__QF_CAM_SINK:false},'',{});const lines=[];A.M.gpuProbe.out=s=>lines.push(s);
 assert.equal(A.M.installGpuProbe(undefined,null),false);const dev=mkDev();let t=0;for(let i=0;i<300;i++){t+=17;/* old code: nothing ever calls gpuFrame */}
 assert.equal(gpu(lines).length,0,'old path emits nothing');assert.ok(!A.M.gpuProbe.installed&&!dev.__qfGpu,'old path never installs');}
// 6. release: everything here sits in QF_PROBE regions and is stripped
{const S=require('../build-guard/strip-probes.cjs');const out=S.stripText(src,'CamTraceLog.ts').out;
 for(const k of ['gpuProbeStart','camStartLine','[QF_CAM] enabled','probe installed','probe NOT installed','__qfCamStart','GPU_PROBE_START'])assert.ok(!out.includes(k),'stripped: '+k);
 assert.ok(src.includes('camStartLine(')&&src.includes('gpuProbeStart('),'present in test build');}
console.log('PASS gpu-probe-start (module / deferred / no-device / global / off / negative-old / stripped)');
