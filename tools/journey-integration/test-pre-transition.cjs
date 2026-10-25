'use strict';
// Test-only pre-transition entry (__qfPreTransition / ?qfPre=): off by default, same gate as __qfTeleport, NEVER in WeChat
// release (also not via DevTools launch query), only sets up state (isolated profile) and never starts the transition itself.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os'),{createHarness}=require('../board-ui/harness.cjs');
const ROOT=path.resolve(__dirname,'../..'),S=p=>fs.readFileSync(path.resolve(ROOT,'creator-build-project/assets/scripts',p),'utf8');
(async()=>{
 const H=createHarness({debug:false}),K=H.load('world-r2/PreTransitionKeys');
 const wx=(env,query)=>({wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:env}}),getLaunchOptionsSync:()=>({query:query||{}})}});
 // gate
 assert.equal(K.preTransitionEnabled('',{}),false,'off by default');
 assert.equal(K.preTransitionEnabled('?qfHooks=1',{}),true,'web QA ?qfHooks=1');
 assert.equal(K.preTransitionEnabled('?qfSkip=lakeside',{}),true,'any valid qfSkip (same as __qfTeleport)');
 assert.equal(K.preTransitionEnabled('?qfPre=island-meadow',{}),true,'valid ?qfPre');
 assert.equal(K.preTransitionEnabled('?qfPre=nope',{}),false,'unknown key');
 assert.equal(K.preTransitionKey('?a=1&qfPre=skycity-lakeside&b=2',{}),'skycity-lakeside');
 for(const q of ['?qfHooks=1','?qfPre=island-meadow','?qfSkip=lakeside&qfPre=home-island']){
  assert.equal(K.preTransitionEnabled(q,wx('release')),false,'WeChat release never: '+q);assert.equal(K.preTransitionKey(q,wx('release')),null);}
 assert.equal(K.preTransitionEnabled(null,wx('release',{qfHooks:'1',qfPre:'island-meadow'})),false,'release ignores launch query');
 assert.equal(K.preTransitionEnabled(null,wx('develop',{qfHooks:'1'})),true,'DevTools develop: launch query');
 assert.equal(K.preTransitionKey(null,wx('trial',{qfPre:'meadow-skycity'})),'meadow-skycity');
 assert.equal(K.preTransitionEnabled(null,wx('develop',{})),false,'develop without query: off');
 assert.equal(K.preTransitionEnabled('?qfHooks=1',{wx:{getAccountInfoSync:()=>{throw Error('x');}}}),false,'gate error -> closed');
 // DevTools worker: location.search is non-empty + read-only ('?contextName=game&id=2'); launch query (启动参数) must still be read
 {const Q=H.load('world-r2/QaSkip'),dt=(env,query,enter)=>({location:{search:'?contextName=game&id=2'},wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:env}}),getLaunchOptionsSync:()=>({query}),...(enter?{getEnterOptionsSync:()=>({query:enter})}:{})}});
  const h=dt('develop',{qfHooks:'1',qfPre:'island-board'});
  assert.equal(K.preTransitionEnabled(null,h),true,'DevTools: location.search + launch qfHooks=1 -> enabled');
  assert.equal(K.preTransitionKey(null,h),'island-board','DevTools: launch qfPre parsed');
  assert.equal(Q.qaHooksEnabled(null,h),true,'__qfTeleport gate reads launch query too');
  assert.equal(Q.qaSkipTarget(null,dt('trial',{qfSkip:'lakeside'})),'lakeside','qfSkip via launch query');
  assert.match(Q.qaQuery(h),/contextName=game/,'location params kept');
  assert.equal(Q.qaQuery({location:{search:'?qfPre=home-island'},wx:{getLaunchOptionsSync:()=>({query:{qfPre:'island-board'}})}}).match(/qfPre=([a-z-]+)/)[1],'island-board','launch key wins');
  assert.equal(K.preTransitionKey(null,dt('develop',{},{qfPre:'node-walk',qfHooks:'1'})),'node-walk','enter options query');
  assert.equal(K.preTransitionEnabled(null,dt('release',{qfHooks:'1',qfPre:'island-board'})),false,'release still off');
  assert.equal(Q.qaHooksEnabled(null,dt('release',{qfHooks:'1'})),false,'release teleport off');
  assert.equal(K.preTransitionEnabled(null,dt('develop',{})),false,'DevTools without 启动参数: off');
  // console call path: installer + run() gate with launch-query-only host (globalThis)
  const sv={location:globalThis.location,wx:globalThis.wx};globalThis.location={search:'?contextName=game&id=2'};globalThis.wx=dt('develop',{qfHooks:'1'}).wx;
  const RUN0=H.load('world-r2/PreTransitionRun');delete globalThis.__qfPreTransition;
  try{assert.equal(RUN0.installPreTransition({}),true,'registers from launch query');const l=await globalThis.__qfPreTransition('list');assert.ok(l.ok&&l.keys.length,'console list works');}
  finally{delete globalThis.__qfPreTransition;for(const k of ['location','wx'])if(sv[k]===undefined)delete globalThis[k];else globalThis[k]=sv[k];}
 }
 // key table
 const keys=K.PRE_SPECS.map(s=>s.key);assert.equal(new Set(keys).size,keys.length,'unique keys');
 for(const s of K.PRE_SPECS){assert.ok(s.trigger&&s.expect&&s.taps.length,'spec complete '+s.key);
  if(s.place==='result'){assert.equal(s.stage,'mainline-'+String(s.checkpoint).padStart(2,'0'),'result stage = checkpoint '+s.key);assert.equal(s.finish,false);}}
 for(const k of ['home-island','island-meadow','meadow-skycity','skycity-finale','skycity-lakeside','lakeside-exit','skycity-visit'])assert.ok(keys.includes(k),k);
 assert.deepEqual(K.canvasLocalToScreen(0,0,390,844),{x:195,y:422});assert.deepEqual(K.canvasLocalToScreen(-195,422,390,844),{x:0,y:0});
 // any-checkpoint profiles: only with allowQa+anyCheckpoint; replayed by the real engine
 const RF=H.load('world-r2/RegionFlowTest');
 assert.throws(()=>RF.createRegionFlowCheckpoint(2,{allowQa:true}),/unsupported-checkpoint/,'2 stays unsupported without anyCheckpoint');
 assert.throws(()=>RF.createRegionFlowCheckpoint(2,{anyCheckpoint:true}),/test-build-only/,'needs allowQa');
 const p2=RF.createRegionFlowCheckpoint(2,{allowQa:true,anyCheckpoint:true}),s2=p2.mainline.createController().snapshot();
 assert.equal(s2.journey.records.filter(r=>r.bestStars>0).length,1,'mainline-01 registered');assert.equal(p2.stageId,'mainline-02');assert.equal(p2.lastAction[0],'swap');
 assert.ok(p2.namespace.startsWith('dot-region-flow-test-'),'isolated namespace');
 // composition refuses without the gate (no location / release)
 const C=H.load('world-r2/WorldNativeComposition').WorldNativeComposition,c=new C();
 c.world={commands:()=>({snapshot:()=>({state:'island'})})};
 const saved=globalThis.location;delete globalThis.location;
 assert.equal(c.preTransitionProfile(4,false).reason,'pre-transition-disabled','no gate -> refused');
 globalThis.wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}}),getLaunchOptionsSync:()=>({query:{qfHooks:'1',qfPre:'island-meadow'}})};
 assert.equal(c.preTransitionProfile(4,false).reason,'pre-transition-disabled','release -> refused');
 // runtime install: release never registers the global
 const RUN=H.load('world-r2/PreTransitionRun');delete globalThis.__qfPreTransition;
 assert.equal(RUN.installPreTransition({}),false);assert.equal(globalThis.__qfPreTransition,undefined,'release: no __qfPreTransition');
 delete globalThis.wx;globalThis.location={search:'?qfHooks=1'};
 const r=c.preTransitionProfile(4,false);assert.ok(r.ok,'web QA: profile swap');assert.equal(r.stageId,'mainline-04');
 assert.equal(RUN.installPreTransition({composition:c}),true);assert.equal(typeof globalThis.__qfPreTransition,'function');
 const list=await globalThis.__qfPreTransition('list');assert.ok(list.ok&&list.keys.length===K.PRE_SPECS.length&&list.unsupported.length>=1);
 assert.equal((await globalThis.__qfPreTransition('bogus')).reason,'unknown-key');
 delete globalThis.__qfPreTransition;if(saved!==undefined)globalThis.location=saved;else delete globalThis.location;
 // source guards: the runner never starts a transition itself; boot registers through the gated installer only
 const run=S('world-r2/PreTransitionRun.ts'),boot=S('WorldIntegrationBoot.ts');
 assert.ok(/export function installPreTransition\(deps:PreDeps\):boolean\{\n if\(!preTransitionEnabled\(\)\)return false;/.test(run),'installer gate first');
 assert.ok(/async run\(key:string[^\n]*\n  if\(!preTransitionEnabled\(\)\)return/.test(run),'run() re-checks gate');
 assert.equal((boot.match(/installPreTransition\(/g)||[]).length,1,'boot wires once');
 assert.ok(!/__qfPreTransition/.test(boot),'boot never assigns the global itself');
 const setup=run.slice(run.indexOf('private async setup'),run.indexOf('private scale'));
 assert.ok(!/travelRegion\('lakeside'\)|claimRegionAndWalk|advanceMainline|playFinale|exitSkycity\(\)\.then/.test(setup),'setup never fires the tested transition');
 // release strip script: hook strings must ship together with the release gate
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qfpre-'));const sh=path.join(ROOT,'tools/grokbot-autoplay/check_release_strip.sh');
 try{
  fs.writeFileSync(path.join(tmp,'game.js'),'var a="__qfPreTransition";function g(){return e==="develop"||e==="trial"} var q=/qfPre=/;');
  assert.equal(cp.spawnSync('bash',[sh,tmp,'--pre-transition']).status,0,'gated hook passes');
  fs.writeFileSync(path.join(tmp,'game.js'),'var a="__qfPreTransition";');
  assert.notEqual(cp.spawnSync('bash',[sh,tmp,'--pre-transition']).status,0,'ungated hook fails');
  fs.writeFileSync(path.join(tmp,'game.js'),'var a=1;');
  assert.equal(cp.spawnSync('bash',[sh,tmp,'--pre-transition']).status,0,'absent hook passes');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 console.log('PASS pre-transition (off by default, release-gated incl. launch query, setup-only, '+K.PRE_SPECS.length+' keys)');
})().catch(e=>{console.error(e);process.exit(1);});
