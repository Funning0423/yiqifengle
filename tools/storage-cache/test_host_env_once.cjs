'use strict';
/** P0 finR: [QF_SYNC] STEADY f1836 preTransitionEnabled → qaSkipAllowed → wx.getAccountInfoSync. Every env/query gate now reads the
 *  host once per wx object. 1000 calls of each gate → exactly 1 getAccountInfoSync, 1 getEnterOptionsSync, 1 getLaunchOptionsSync.
 *  Negative: the dc48cb42 QaSkip (no memo) is caught. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.join(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts');
function load(src){const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,console});return m.exports;}
function check(src){const Q=load(src);const n={acc:0,ent:0,lau:0};
 const wx={getAccountInfoSync(){n.acc++;return {miniProgram:{envVersion:'develop'}};},getEnterOptionsSync(){n.ent++;return {query:{qfHooks:'1'}};},getLaunchOptionsSync(){n.lau++;return {query:{camTrace:'1'}};}};
 const host={wx,location:{search:''}};
 for(let i=0;i<1000;i++){assert.equal(Q.qaSkipAllowed(host),true);assert.match(Q.qaQuery(host),/qfHooks=1/);Q.qaHooksEnabled?.(undefined,host);}
 assert.deepEqual(n,{acc:1,ent:1,lau:1},'host reads '+JSON.stringify(n));
 const rel={wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}})}};assert.equal(Q.qaSkipAllowed(rel),false,'release stays off');
 const thr={wx:{getAccountInfoSync(){throw Error('x');}}};assert.equal(Q.qaSkipAllowed(thr),false,'throwing host = off');}
check(fs.readFileSync(path.join(S,'world-r2/QaSkip.ts'),'utf8'));
let caught=false;try{check(cp.execFileSync('git',['show','dc48cb42:creator-build-project/assets/scripts/world-r2/QaSkip.ts'],{cwd:ROOT,encoding:'utf8'}));}catch{caught=true;}
assert.ok(caught,'self-test: un-memoized QaSkip not caught');
console.log('PASS host-env-once');
