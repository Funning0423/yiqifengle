#!/usr/bin/env node
'use strict';
/* 风铃湖畔 journey wiring (Voice Bot): region select → r04-lake-* → ensureRegion walks skycity→lakeside → the adapter mounts the
 * real scene through LakesideCameraLayout.lakesideJourney(start) → single landing→board hook call site → level.
 * Real TS through the board-ui harness (pure modules) + source contracts for the engine-bound call sites. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/',R=S+'regional-r05/runtime';
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const Core=H.load(S+'world-r1/RegionJourneyCore.ts'),LK=H.load(S+'region/LakesideCameraLayout.ts'),Hook=H.load(S+'region/LakesideLandingHook.ts');
const API=require(R+'/index.js'),src=f=>fs.readFileSync(S+f,'utf8'),vm=require('node:vm'),ts=require('../qf-env.cjs').typescript();
const Campaign=require(S+'mainline-r1/runtime/region-campaign.js');
const compFile=src('world-r2/WorldNativeComposition.ts'),body=compFile.slice(compFile.indexOf('export class WorldNativeComposition')).replace(/@property\([^)]*\) /g,'');
const hooked=[];const ctx={exports:{},Component:class{},RegionCampaign:Campaign,DEBUG:false,console:{...console,error:()=>{}},LAKESIDE_LOAD_FAILED:'lakeside-load-failed',lakesideSideOrder:()=>null,lakesideLandingToBoard:c=>{hooked.push(c.stageId);return Promise.resolve(hookResult);}};let hookResult={ok:true,result:'ok'};
vm.runInNewContext(ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);const Comp=ctx.exports.WorldNativeComposition;
const sel=id=>Comp.prototype.selectionRegion.call({}, {provider:'r5',stageId:id});
const Route={journeySelectionRegion:sel};
function host(region){const h=Object.create(Comp.prototype),events=[],snap={state:region,journey:{region,target:null}};
 h.world={commands:()=>({snapshot:()=>snap,abandonLakesideJourney(){events.push(['island']);snap.state='island';snap.journey.region='island';return {ok:true};},async travelRegion(t){events.push(['travel',t]);snap.state=t;snap.journey.region=t;return {ok:true};},async enterLevel(id){events.push(['enter',id]);snap.state='level';return {ok:true};}})};
 h.mainline={journeySnapshot:()=>({readOnly:false,records:Array.from({length:12},()=>({bestStars:1,clears:1}))})};return {h,events};}
let n=0,fail=0;const t=(m,f)=>{try{f();n++;console.log('PASS',m);}catch(e){fail++;console.log('FAIL',m,'\n',e.stack||e);}};
t('selectionRegion mapping: r04-lake-01..06 (and r05 renumbering) → lakeside; meadow/sky/tide unchanged',()=>{
 for(const s of API.catalog.filter(s=>s.region==='lake'))assert.equal(Route.journeySelectionRegion(s.id),'lakeside',s.id);
 assert.equal(Route.journeySelectionRegion('r05-lake-03'),'lakeside');
 for(const s of API.catalog.filter(s=>s.region!=='lake'))assert.equal(Route.journeySelectionRegion(s.id),s.region==='meadow'?'meadow':s.region==='sky'?'skycity':'island',s.id);
 assert.equal(Route.journeySelectionRegion('r04-lakeside'),'island');});
t('RegionJourneyCore accepts skycity→lakeside only (validateJourneyRoute on the real lakesideJourney route)',()=>{
 const start=[0,0,0];const j=LK.lakesideJourney(start),path=[...j.approach,...j.bridge.slice(1),...j.arrival];
 const route={from:'skycity',to:'lakeside',path,bridgeStart:Core.routeLength(j.approach),bridgeEnd:Core.routeLength([...j.approach,...j.bridge.slice(1)]),speed:j.speed,startBlendM:0,focus:j.focus,landing:j.landing};
 const s0=path[0];Core.validateJourneyRoute(route,s0);
 assert.throws(()=>Core.validateJourneyRoute({...route,from:'island'},s0),/journey-region-order/);
 assert.throws(()=>Core.validateJourneyRoute({...route,from:'meadow'},s0),/journey-region-order/);
 assert.throws(()=>Core.validateJourneyRoute({...route,from:'lakeside',to:'skycity'},s0),/journey-region-order/);});
t('reachable from region select: 风铃湖畔 button → enterRegion(lake) → r5 selection → ensureRegion(lakeside) → travelRegion',()=>{
 const boot=src('WorldIntegrationBoot.ts'),comp=src('world-r2/WorldNativeComposition.ts'),flow=src('world-r1/WorldFlowCore.ts');
 assert.match(boot,/this\.button\('lake','风铃湖畔',\(\)=>this\.composition\.enterRegion\('lake'\)\)/);
 const first=API.catalog.find(s=>s.region==='lake'&&s.ordinal===1);assert(first,'lake ordinal 1 in catalog');assert.equal(Route.journeySelectionRegion(first.id),'lakeside');
 assert.match(comp,/const order:JourneyRegion\[\]=\['island','meadow','skycity','lakeside'\]/);
 assert.match(comp,/const permission=\(RegionCampaign as any\)\.canEnterRegion\(this.mainline.journeySnapshot\(\),target\)/);
 assert.match(comp,/\['home','island','meadow','skycity','lakeside'\]\.includes/);
 assert.match(flow,/export type Place = [^;]*'lakeside'/);assert.match(flow,/'meadow' \| 'lakeside' \|/);
 assert.match(flow,/\['island','meadow','skycity','lakeside','level'\]/);assert.match(flow,/\['island','meadow','skycity','lakeside'\]\.includes\(this\.state\)/);
 assert.match(src('world-r1/RegionJourneyCore.ts'),/export type JourneyRegion = 'island'\|'meadow'\|'skycity'\|'lakeside';/);
 assert(/\{ id: 'lake', pose: null \}/.test(src('world-r1/RegionCameraData.ts')),'RegionCameraData stop');});
t('adapter mounts the lakeside model via lakesideJourney(ride S6 at mooring C, else start) (shared scene loader, real instances)',()=>{
 const a=src('region/RegionJourneyAdapter.ts'),b=src('region/LakesideBoardBackground.ts');
 assert.match(a,/if\(to==='lakeside'\)return prepareLakesideJourney\(/);assert.match(a,/const M5C=TRANSITION_STAGING\.skyMooring5a,L=lakesideJourney\(continuousTransitions\(\)&&M5C\.option==='C'\?\[\.\.\.M5C\.walkWorld\[0\]\] as Vec:start\);model\.setRotationFromEuler\(0,L\.yawDeg,0\);model\.setWorldPosition\(L\.root\[0\],L\.root\[1\],L\.root\[2\]\);/);
 assert.match(a,/focus:L\.focus,landing:L\.landing/);assert.match(a,/waterY=L\.root\[1\];L\.landing=lakesideRouteLanding\(L\);/);assert.match(a,/lakesideScreenLanding\(L,lakesideScreenFrame\(v\.width,v\.height,boardSafeInsets\(v\.width,v\.height\)\),LAKESIDE_CAMERA_LAYOUT\.stopLocal/);assert.match(a,/await mountLakesideScenery\(model,token,take\)/);
 assert.match(b,/instances=await mountLakesideScenery\(scenery,token,take\)/);assert.match(b,/lakesideSceneInstances\(/);});
t('landing→board hook call site',()=>{
 const comp=src('world-r2/WorldNativeComposition.ts');assert.equal((comp.match(/lakesideLandingToBoard\(/g)||[]).length,1);
 assert.match(comp,/if\(region==='lakeside'\)\{const landed=await lakesideLandingToBoard\(/);assert.match(comp,/if\(landed\?\.ok===false\)return this\.lakesideFallback\('board',landed\.reason\);held=true;this\.world\?\.holdEnterLevel\?\.\(true\);\}/);
 const i=comp.indexOf('lakesideLandingToBoard({'),e=comp.indexOf('ensureRegion(region)'),l=comp.indexOf("enterLevel(selection.stageId)");assert(e>0&&e<i&&i<l,'between arrival and enterLevel');
 const p=Hook.lakesideLandingToBoard({stageId:'r04-lake-01',journey:null});assert(p&&typeof p.then==='function');
 // 运镜bot's hook replaced the stub: the call site injects deps; without deps it still resolves at once (old cut). Behaviour: test-lakeside-landing-hook.
 assert.doesNotMatch(src('region/LakesideLandingHook.ts'),/TODO\(运镜bot\)/);assert.match(comp,/lakesideLandingToBoard\(\{stageId:selection\.stageId,journey:[^\n]*deps:this\.lakesideLandingDeps\(\)\}\)/);});
t('pitch and route speed untouched (pending Grok Bot / 运镜bot)',()=>{/* build05-next: 运镜bot b0c21d2 dropped the portrait board.pitchDeg (pitch 58 void; portrait is solved from the landing pose). The wiring still must not override the layout: landscape stays 75, and the adapter only reads lakesideJourney. */assert.equal(LK.LAKESIDE_CAMERA_LAYOUT.board.pitchDeg,undefined);assert.equal(LK.LAKESIDE_CAMERA_LAYOUT.board.landscape.pitchDeg,75);assert.doesNotMatch(src('region/RegionJourneyAdapter.ts'),/pitchDeg\s*[:=]/);});
(async()=>{
 const T=async(m,f)=>{try{await f();n++;console.log('PASS',m);}catch(e){fail++;console.log('FAIL',m,'\n',e.stack||e);}};
 await T('continue journey after saved mainline completion enters lake; unfinished or active mainline stays on mainline',async()=>{
  for(const complete of [false,true])for(const active of [false,true]){
   const x=host('skycity'),events=[];
   x.h.mainlineStatus=()=>({journey:{readOnly:false,completed:12,records:Array.from({length:12},(_,i)=>({bestStars:complete||i<11?1:0,clears:complete||i<11?1:0}))},active:active?{status:'playing',stageId:'mainline-12'}:null,nextStageId:complete?null:'mainline-12',stages:[]});
   x.h.enterRegion=async id=>{events.push(['region',id]);return {ok:true};};
   x.h.enterMainlineStage=async id=>{events.push(['mainline',id]);return {ok:true};};
   assert.equal((await x.h.enterMainline()).ok,true);
   assert.deepEqual(events,[[complete&&!active?'region':'mainline',complete&&!active?'lake':'mainline-12']]);
  }
 });
 await T('lakeside region admission requires all twelve verified records before any movement',async()=>{
  const x=host('skycity');
  for(const journey of [null,{readOnly:true,records:[]},{readOnly:false,records:[]},{readOnly:false,records:Array.from({length:12},(_,i)=>({bestStars:i===0?0:1,clears:i===0?0:1}))}]){
   x.h.mainline.journeySnapshot=()=>journey;
   assert.equal((await x.h.ensureRegion('lakeside')).ok,false);
   assert.equal(x.events.length,0);
  }
 });
 await T('saved finale → real continue/selection/provider gate → balloon route → lake board, without save writes',async()=>{
  const h=createHarness({debug:true}),C=h.load('world-r2/WorldNativeComposition').WorldNativeComposition;
  const checkpoint=h.load('world-r2/RegionFlowTest').createRegionFlowCheckpoint(12),controller=checkpoint.mainline.createController();
  assert(controller.resume().ok);const preview=controller.previewAction(checkpoint.lastAction);assert(preview.ok);
  assert(controller.commitAction(preview.token).ok);while(controller.snapshot().visual)assert(controller.finishVisualStep(controller.snapshot().visual.token).ok);
  const c=new C(),events=[],snap={state:'skycity',journey:{region:'skycity',target:null}};
  c.mainline=checkpoint.mainline;c.persistence=checkpoint.r5;
  c.world={commands:()=>({snapshot:()=>snap,async travelRegion(to){events.push(['travel',to]);snap.state=to;snap.journey.region=to;return {ok:true};},async enterLevel(id){events.push(['enter',id]);snap.state='level';return {ok:true};}})};
  const before=JSON.stringify([c.mainline.inspect(),c.persistence.inspect()]);
  assert.equal((await c.enterMainline()).ok,true);
  assert.deepEqual(events,[['travel','lakeside'],['enter','r04-lake-01']]);
  assert.equal(c.selection.provider,'r5');
  assert.equal(JSON.stringify([c.mainline.inspect(),c.persistence.inspect()]),before);
 });
 await T('ensureRegion (real class method): skycity→lakeside one travel, island walks the chain, lakeside→lakeside none',async()=>{
  let x=host('skycity');assert.equal((await x.h.ensureRegion('lakeside')).ok,true);assert.deepEqual(JSON.parse(JSON.stringify(x.events)),[['travel','lakeside']]);
  x=host('lakeside');assert.equal((await x.h.ensureRegion('lakeside')).ok,true);assert.equal(x.events.length,0);
  x=host('island');assert.equal((await x.h.ensureRegion('lakeside')).ok,true);assert.deepEqual(JSON.parse(JSON.stringify(x.events)),[['travel','meadow'],['travel','skycity'],['travel','lakeside']]);
  x=host('meadow');assert.equal((await x.h.ensureRegion('lakeside')).ok,true);assert.deepEqual(JSON.parse(JSON.stringify(x.events)),[['travel','skycity'],['travel','lakeside']]);});
 await T('enterSelectedLevel r04-lake-01 from skycity: travel lakeside → landing hook → enterLevel (in that order)',async()=>{
  const x=host('skycity');x.h.selection={provider:'mainline-free',stageId:'r04-lake-01',seed:4};hooked.length=0;
  const r=await x.h.enterSelectedLevel();assert.equal(r.ok,true);assert.deepEqual(x.events,[['travel','lakeside'],['enter','r04-lake-01']]);assert.deepEqual(hooked,['r04-lake-01']);});
 await T('landing hook: lakeside assets not ready after its 3 s wait → existing lakeside fallback (island, one stable reason), no enterLevel',async()=>{
  const x=host('skycity');x.h.selection={provider:'mainline-free',stageId:'r04-lake-01',seed:4};hooked.length=0;hookResult={ok:false,reason:'lakeside-assets-not-ready',preloaded:'timeout'};
  try{const r=await x.h.enterSelectedLevel();assert.equal(JSON.stringify(r),JSON.stringify({ok:false,reason:'lakeside-load-failed'}));assert.deepEqual(x.events,[['travel','lakeside'],['island']]);assert.deepEqual(hooked,['r04-lake-01']);}finally{hookResult={ok:true,result:'ok'};}});
 console.log(fail?`FAIL ${fail}`:`OK ${n}`);process.exit(fail?1:0);
})();
