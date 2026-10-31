'use strict';
/** P0 finR (approved frozen-WFC diff 05, Grok Bot 2026-10-31 04:06 ET): WorldFlowComponent.reportRuntime on a wx host makes 0 sync
 *  storage calls and writes the diagnostic with wx.setStorage (async), same key, same payload as the sys.localStorage write before;
 *  'tick' writes nothing; non-wx hosts keep sys.localStorage. Negative: fbab1c96's reportRuntime (sync setItem on wx) is caught. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.join(__dirname,'../..'),REL='creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts',KEY='dot-runtime-diagnostics-20261010:world-flow';
function method(src){const sf=ts.createSourceFile('w.ts',src,ts.ScriptTarget.ES2020,true);let body=null;
 (function v(n){if(ts.isMethodDeclaration(n)&&n.name.getText(sf)==='reportRuntime')body=n.body.getText(sf);ts.forEachChild(n,v);})(sf);
 assert.ok(body,'reportRuntime not found');
 return ts.transpileModule('module.exports=function(event:string){'+body.slice(1,-1)+'};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;}
function run(src,withWx,event){const calls={sync:[],async:[],ls:[]};const snap={state:'island',n:1};
 const wx=withWx?{setStorageSync:(k,v)=>calls.sync.push([k,v]),getStorageSync:()=>{calls.sync.push(['get']);},setStorage:o=>calls.async.push([o.key,o.data])}:undefined;
 const ls={setItem:(k,v)=>{calls.ls.push([k,v]);if(wx)wx.setStorageSync(k,v);},getItem:()=>null};
 const g={wx,__worldLoading:null};const m={exports:{}};
 vm.runInNewContext(method(src),{module:m,exports:m.exports,console:{warn(){},info(){}},globalThis:g,Date,JSON,Array,sys:{localStorage:ls},DEBUG:false,
  cameraWriteLog:{last:null},worldFlowConsoleEnabled:()=>false});
 const self={flow:{snapshot:()=>snap},clock:{a:1},jobs:new Set(),lastDiagnosticAt:0,dayNightSnapshot:()=>({mode:'day'})};
 m.exports.call(self,event);return calls;}
const cur=fs.readFileSync(path.join(ROOT,REL),'utf8');
const w=run(cur,true,'state:island');
assert.equal(w.sync.length,0,'sync storage calls on wx host');assert.equal(w.ls.length,0,'sys.localStorage used on wx host');
assert.equal(w.async.length,1);assert.equal(w.async[0][0],KEY);
const n=run(cur,false,'state:island');assert.equal(n.ls.length,1);assert.equal(n.ls[0][0],KEY);
const strip=s=>{const o=JSON.parse(s);delete o.utc;return JSON.stringify(o);};
assert.equal(strip(w.async[0][1]),strip(n.ls[0][1]),'same payload as the sys.localStorage write');
const old=cp.execFileSync('git',['show','fbab1c96:'+REL],{cwd:ROOT,encoding:'utf8'});const o=run(old,false,'state:island');
assert.equal(strip(w.async[0][1]),strip(o.ls[0][1]),'same payload as fbab1c96');
const t=run(cur,true,'tick');assert.equal(t.async.length+t.sync.length+t.ls.length,0,'tick writes nothing');
// SINK_OK narrowing: exactly one setItem in reportRuntime, and it sits in the else of `if(wx&&typeof wx.setStorage==='function')`.
{const sf=ts.createSourceFile('w.ts',cur,ts.ScriptTarget.ES2020,true);let ok=0,total=0;
 (function v(n){if(ts.isMethodDeclaration(n)&&n.name.getText(sf)==='reportRuntime')(function u(x){if(ts.isCallExpression(x)&&/\.setItem$/.test(x.expression.getText(sf))){total++;
  for(let p=x.parent;p&&p!==n;p=p.parent)if(ts.isIfStatement(p)&&/wx\.setStorage/.test(p.expression.getText(sf))&&p.elseStatement&&p.elseStatement.pos<=x.pos&&x.end<=p.elseStatement.end){ok++;break;}}ts.forEachChild(x,u);})(n);ts.forEachChild(n,v);})(sf);
 assert.equal(total,1,'setItem calls in reportRuntime');assert.equal(ok,1,'setItem only in the non-wx branch');}
let caught=false;try{const b=run(old,true,'state:island');assert.equal(b.sync.length,0);}catch{caught=true;}
assert.ok(caught,'self-test: fbab1c96 sync write on wx not caught');
console.log('PASS report-runtime-async self-tests=1');
