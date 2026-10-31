#!/usr/bin/env node
'use strict';
/** P0 (Mac 7e0f2c72: camTrace on → per-frame getSafeAreaRect sync IPC freeze; control run camTrace off: 6/0, no freeze).
 *  camTrace must be OFF by default: no query, no __QF_CAM_TRACE, release WeChat (launch query ignored) → off; and the per-frame
 *  probe that read the safe area lives inside QF_PROBE_BEGIN/END (stripped from release). Negative self-tests on mutants. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts');
const tr=src=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function mod(rel,src,req){const m={exports:{}};const box=vm.createContext({console,performance});box.globalThis=box;vm.runInContext(tr(src||fs.readFileSync(path.join(S,rel),'utf8')),Object.assign(box,{module:m,exports:m.exports,require:req||(()=>({}))}));return m.exports;}
const QA=mod('world-r2/QaSkip.ts');const DQ=mod('region/DebugQuery.ts',null,s=>s.includes('QaSkip')?QA:{});
const camSrc=fs.readFileSync(path.join(S,'region/CamTraceLog.ts'),'utf8');
const ccStub={director:{on(){}},Director:{},view:{on(){}},screen:{on(){}},sys:{}};
function check(src){const C=mod('region/CamTraceLog.ts',src,s=>s==='cc'?ccStub:s.includes('DebugQuery')?DQ:s.includes('CameraPose')?{cameraWriteHook:{}}:{});
 const wx=env=>({getAccountInfoSync:()=>({miniProgram:{envVersion:env}}),getLaunchOptionsSync:()=>({query:{camTrace:'1'}}),getEnterOptionsSync:()=>({query:{camTrace:'1'}})});
 assert.equal(C.camLog.on,false,'camLog.on must be false at load');assert.match(src,/^export const camLog=\{on:false,/m,'camLog.on literal default false');
 assert.equal(C.camLogEnabled('',{}),false,'default (no query, no global) must be off');
 for(const v of ['0','false','',0,false,undefined,null,'yes'])assert.equal(C.camLogEnabled('',{__QF_CAM_TRACE:v}),false,'__QF_CAM_TRACE='+JSON.stringify(v)+' must be off');
 C.camLogReset();assert.equal(C.camLogStart(undefined,{wx:wx('release')}),false,'release WeChat with ?camTrace=1 launch query must stay off');
 assert.equal(C.camLogEnabled('?camTrace=1',{}),true,'explicit opt-in still works (QA)');}
check(camSrc);
// the safe-area read sits only inside a QF_PROBE block
const probeBlocks=[...camSrc.matchAll(/\/\*QF_PROBE_BEGIN\*\/[\s\S]*?\/\*QF_PROBE_END\*\//g)].map(m=>m[0]).join('\n');
assert.ok(/getSafeAreaRect/.test(probeBlocks)&&!/getSafeAreaRect/.test(camSrc.replace(/\/\*QF_PROBE_BEGIN\*\/[\s\S]*?\/\*QF_PROBE_END\*\//g,'')),'getSafeAreaRect must live only inside QF_PROBE blocks');
assert.match(camSrc,/^export const camLog=\{on:false,/m,'camLog.on literal default false');
let caught=0;const neg=(n,f)=>{let ok=false;try{f();}catch{ok=true;}assert.ok(ok,'self-test missed: '+n);caught++;};
neg('camLogEnabled always on',()=>check(camSrc.replace(/export function camLogEnabled\(query:string,g:any\):boolean\{return /,'export function camLogEnabled(query:string,g:any):boolean{return true||')));
neg('default literal on:true',()=>check(camSrc.replace('export const camLog={on:false,','export const camLog={on:true,')));
neg('release launch query honoured',()=>{const D2=mod('region/DebugQuery.ts',fs.readFileSync(path.join(S,'region/DebugQuery.ts'),'utf8').replace('qaSkipAllowed(host)?qaQuery({wx}):\'\'','qaQuery({wx})'),s=>s.includes('QaSkip')?QA:{});
 const C=mod('region/CamTraceLog.ts',camSrc,s=>s==='cc'?ccStub:s.includes('DebugQuery')?D2:{cameraWriteHook:{}});C.camLogReset();
 assert.equal(C.camLogStart(undefined,{wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}}),getLaunchOptionsSync:()=>({query:{camTrace:'1'}}),getEnterOptionsSync:()=>({query:{}})}}),false);});
console.log('PASS cam-trace-default-off self-tests='+caught);
