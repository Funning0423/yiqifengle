'use strict';
// Release gate for the r5 debug keys journal-sky-open / journal-sky-progress: in a WeChat release host they are inert
// (no key from ?qfPre or launch query, no __qfPreTransition global, run() refuses) and the source keeps every gate on the path.
// Negative self-test: the same checks FAIL on (a) an ungated stub of the key/runner API and (b) source copies with a gate removed.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{createHarness}=require('../board-ui/harness.cjs');
const KEYS=['journal-sky-open','journal-sky-progress','journal-sky-cleared'],SRC=path.resolve(__dirname,'../../creator-build-project/assets/scripts/world-r2');
const release=(q)=>({wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}}),getLaunchOptionsSync:()=>({query:q||{}})}});
async function inert(K,RUN){const errs=[];
  for(const k of KEYS){
    if(K.preTransitionKey('?qfHooks=1&qfPre='+k,release())!==null)errs.push(k+': ?qfPre accepted in release');
    if(K.preTransitionEnabled('?qfPre='+k,release())!==false)errs.push(k+': gate open in release (query)');
    if(K.preTransitionEnabled(null,release({qfHooks:'1',qfPre:k}))!==false)errs.push(k+': gate open in release (launch query)');}
  const sv=globalThis.wx;globalThis.wx=release({qfHooks:'1',qfPre:KEYS[0]}).wx;delete globalThis.__qfPreTransition;
  try{if(RUN.installPreTransition({})!==false||globalThis.__qfPreTransition!==undefined)errs.push('release registers __qfPreTransition');
    for(const k of KEYS){const r=await new RUN.PreTransitionRunner({}).run(k);if(r.ok!==false)errs.push(k+': run() not refused in release');}}
  finally{delete globalThis.__qfPreTransition;if(sv===undefined)delete globalThis.wx;else globalThis.wx=sv;}
  return errs;}
function sourceGates(keys,run){const errs=[];
  if(!/if\(!m\|\|!\(PRE_KEYS as readonly string\[\]\)\.includes\(m\[1\]\)\|\|!qaSkipAllowed\(host\)\)return null;/.test(keys))errs.push('preTransitionKey lost its release gate');
  if(!/export function preTransitionEnabled\([^\n]*\{\n if\(!qaSkipAllowed\(host\)\)return false;/.test(keys))errs.push('preTransitionEnabled lost its release gate');
  if(!/export function installPreTransition\(deps:PreDeps\):boolean\{\n if\(!qaSkipAllowed\(\)\)return false;/.test(run))errs.push('installer lost its release gate');
  if(!/async run\(key:string[^\n]*\n  if\(key==='enable'\)\{if\(!qaSkipAllowed\(\)\)return[^\n]*\n  if\(!preTransitionEnabled\(\)\)return/.test(run))errs.push('run() lost its gate');
  const i=run.indexOf('if(spec.skyChallenges!=null){try{seedSkyChallengeWins('),s=run.indexOf('private async setup'),e=run.indexOf('private scale');
  if(i<s||i>e)errs.push('journal-sky seeding outside the gated runner setup');
  const outside=(run.slice(0,s)+run.slice(e)).split('\n').filter(l=>!/^(\/\*QF_PROBE_BEGIN\*\/)?import /.test(l)).join('\n');
  if(/skyChallenges|seedSkyChallengeWins\(/.test(outside))errs.push('journal-sky seeding referenced outside setup');
  if(!/seedSkyChallengeWins\(\(this\.d\.composition as any\)\.testProfile,/.test(run))errs.push('seeding not on the isolated test profile');
  return errs;}
(async()=>{const H=createHarness({debug:false}),K=H.load('world-r2/PreTransitionKeys'),RUN=H.load('world-r2/PreTransitionRun');
  for(const k of KEYS)assert(K.preSpec(k),k+' exists');
  const e1=await inert(K,RUN);assert.deepEqual(e1,[],'release inert: '+e1.join('; '));
  const keysSrc=fs.readFileSync(path.join(SRC,'PreTransitionKeys.ts'),'utf8'),runSrc=fs.readFileSync(path.join(SRC,'PreTransitionRun.ts'),'utf8');
  const e2=sourceGates(keysSrc,runSrc);assert.deepEqual(e2,[],'source gates: '+e2.join('; '));
  // negative self-test (a): ungated stub must be caught
  const stub={preTransitionKey:q=>{const m=/qfPre=([a-z-]+)/.exec(q||'');return m?m[1]:null;},preTransitionEnabled:()=>true},
    stubRun={installPreTransition:()=>{globalThis.__qfPreTransition=()=>({ok:true});return true;},PreTransitionRunner:class{async run(){return {ok:true};}}};
  const n1=await inert(stub,stubRun);assert(n1.length>=KEYS.length*3+1+KEYS.length,'self-test (a) caught '+n1.length+': '+n1.join('; '));
  // negative self-test (b): each gate removed from the real source must be caught
  const muts=[[keysSrc.replace('||!qaSkipAllowed(host))return null;','))return null;'),runSrc],[keysSrc.replace(/(export function preTransitionEnabled\([^\n]*\{\n) if\(!qaSkipAllowed\(host\)\)return false;/,'$1'),runSrc],
    [keysSrc,runSrc.replace('):boolean{\n if(!qaSkipAllowed())return false;','):boolean{\n')],[keysSrc,runSrc.replace("\n  if(!preTransitionEnabled())return","\n  if(false)return")],
    [keysSrc,runSrc.replace('export function installPreTransition','const _j=(s:any)=>s.skyChallenges;\nexport function installPreTransition')]];
  muts.forEach(([k,r],i)=>{assert.notEqual(k+r,keysSrc+runSrc,'mutation '+i+' applied');assert(sourceGates(k,r).length>0,'self-test (b) mutation '+i+' not caught');});
  console.log('PASS journal-sky debug keys inert in WeChat release ('+KEYS.join(', ')+'): no ?qfPre / launch-query key, no global, run() refused; source gates intact');
  console.log('PASS negative self-test: ungated stub caught ('+n1.length+' findings), '+muts.length+'/'+muts.length+' gate-removal mutations caught');
})().catch(e=>{console.error(e);process.exit(1);});
