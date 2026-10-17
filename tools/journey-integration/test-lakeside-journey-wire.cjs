#!/usr/bin/env node
'use strict';
/* 风铃湖畔 journey wiring (Voice Bot): region select → r04-lake-* → ensureRegion walks island→lakeside → the adapter mounts the
 * real scene through LakesideCameraLayout.lakesideJourney(start) → single landing→board hook call site → level.
 * Real TS through the board-ui harness (pure modules) + source contracts for the engine-bound call sites. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/',R=S+'regional-r05/runtime';
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const Core=H.load(S+'world-r1/RegionJourneyCore.ts'),LK=H.load(S+'region/LakesideCameraLayout.ts'),Hook=H.load(S+'region/LakesideLandingHook.ts');
const API=require(R+'/index.js'),src=f=>fs.readFileSync(S+f,'utf8'),vm=require('node:vm'),ts=require('../qf-env.cjs').typescript();
const Campaign=require(S+'mainline-r1/runtime/region-campaign.js');
const compFile=src('world-r2/WorldNativeComposition.ts'),body=compFile.slice(compFile.indexOf('export class WorldNativeComposition')).replace(/@property\([^)]*\) /g,'');
const hooked=[];const ctx={exports:{},Component:class{},RegionCampaign:Campaign,DEBUG:false,console:{...console,error:()=>{}},lakesideLandingToBoard:c=>{hooked.push(c.stageId);return Promise.resolve();}};
vm.runInNewContext(ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);const Comp=ctx.exports.WorldNativeComposition;
const sel=id=>Comp.prototype.selectionRegion.call({}, {provider:'r5',stageId:id});
const Route={journeySelectionRegion:sel};
function host(region){const h=Object.create(Comp.prototype),events=[],snap={state:region,journey:{region,target:null}};
 h.world={commands:()=>({snapshot:()=>snap,async travelRegion(t){events.push(['travel',t]);snap.state=t;snap.journey.region=t;return {ok:true};},async enterLevel(id){events.push(['enter',id]);snap.state='level';return {ok:true};}})};
 h.mainline={journeySnapshot:()=>({readOnly:false,records:[]})};return {h,events};}
let n=0,fail=0;const t=(m,f)=>{try{f();n++;console.log('PASS',m);}catch(e){fail++;console.log('FAIL',m,'\n',e.stack||e);}};
t('selectionRegion mapping: r04-lake-01..06 (and r05 renumbering) → lakeside; meadow/sky/tide unchanged',()=>{
 for(const s of API.catalog.filter(s=>s.region==='lake'))assert.equal(Route.journeySelectionRegion(s.id),'lakeside',s.id);
 assert.equal(Route.journeySelectionRegion('r05-lake-03'),'lakeside');
 for(const s of API.catalog.filter(s=>s.region!=='lake'))assert.equal(Route.journeySelectionRegion(s.id),s.region==='meadow'?'meadow':s.region==='sky'?'skycity':'island',s.id);
 assert.equal(Route.journeySelectionRegion('r04-lakeside'),'island');});
t('RegionJourneyCore accepts island→lakeside only (validateJourneyRoute on the real lakesideJourney route)',()=>{
 const start=[0,0,0];const j=LK.lakesideJourney(start),path=[...j.approach,...j.bridge.slice(1),...j.arrival];
 const route={from:'island',to:'lakeside',path,bridgeStart:Core.routeLength(j.approach),bridgeEnd:Core.routeLength([...j.approach,...j.bridge.slice(1)]),speed:j.speed,startBlendM:0,focus:j.focus,landing:j.landing};
 const s0=path[0];Core.validateJourneyRoute(route,s0);
 assert.throws(()=>Core.validateJourneyRoute({...route,from:'meadow'},s0),/journey-region-order/);
 assert.throws(()=>Core.validateJourneyRoute({...route,from:'lakeside',to:'skycity'},s0),/journey-region-order/);});
t('reachable from region select: 风铃湖畔 button → enterRegion(lake) → r5 selection → ensureRegion(lakeside) → travelRegion',()=>{
 const boot=src('WorldIntegrationBoot.ts'),comp=src('world-r2/WorldNativeComposition.ts'),flow=src('world-r1/WorldFlowCore.ts');
 assert.match(boot,/this\.button\('lake','风铃湖畔',\(\)=>this\.composition\.enterRegion\('lake'\)\)/);
 const first=API.catalog.find(s=>s.region==='lake'&&s.ordinal===1);assert(first,'lake ordinal 1 in catalog');assert.equal(Route.journeySelectionRegion(first.id),'lakeside');
 assert.match(comp,/target==='lakeside'\?\['island','lakeside'\]:\['island','meadow','skycity'\]/);
 assert.match(comp,/if\(target!=='lakeside'\)\{const permission=\(RegionCampaign as any\)\.canEnterRegion/);
 assert.match(comp,/\['home','island','meadow','skycity','lakeside'\]\.includes/);
 assert.match(flow,/export type Place = [^;]*'lakeside'/);assert.match(flow,/'meadow' \| 'lakeside' \|/);
 assert.match(flow,/\['island','meadow','lakeside','level'\]/);assert.match(flow,/\['island','meadow','skycity','lakeside'\]\.includes\(this\.state\)/);
 assert.match(src('world-r1/RegionJourneyCore.ts'),/export type JourneyRegion = 'island'\|'meadow'\|'skycity'\|'lakeside';/);
 assert(/\{ id: 'lake', pose: null \}/.test(src('world-r1/RegionCameraData.ts')),'RegionCameraData stop');});
t('adapter mounts the lakeside model via lakesideJourney(start) (shared scene loader, real instances)',()=>{
 const a=src('region/RegionJourneyAdapter.ts'),b=src('region/LakesideBoardBackground.ts');
 assert.match(a,/if\(to==='lakeside'\)return prepareLakesideJourney\(/);assert.match(a,/const L=lakesideJourney\(start\);model\.setRotationFromEuler\(0,L\.yawDeg,0\);model\.setWorldPosition\(L\.root\[0\],L\.root\[1\],L\.root\[2\]\);/);
 assert.match(a,/focus:L\.focus,landing:L\.landing/);assert.match(a,/await mountLakesideScenery\(model,token,take\)/);
 assert.match(b,/instances=await mountLakesideScenery\(scenery,token,take\)/);assert.match(b,/lakesideSceneInstances\(/);});
t('landing→board hook call site',()=>{
 const comp=src('world-r2/WorldNativeComposition.ts');assert.equal((comp.match(/lakesideLandingToBoard\(/g)||[]).length,1);
 assert.match(comp,/if\(region==='lakeside'\)await lakesideLandingToBoard\(/);
 const i=comp.indexOf('lakesideLandingToBoard({'),e=comp.indexOf('ensureRegion(region)'),l=comp.indexOf("enterLevel(selection.stageId)");assert(e>0&&e<i&&i<l,'between arrival and enterLevel');
 const p=Hook.lakesideLandingToBoard({stageId:'r04-lake-01',journey:null});assert(p&&typeof p.then==='function');
 assert.match(src('region/LakesideLandingHook.ts'),/TODO\(运镜bot\)/);});
t('pitch and route speed untouched (pending Grok Bot / 运镜bot)',()=>{assert.equal(LK.LAKESIDE_CAMERA_LAYOUT.board.pitchDeg,64);});
(async()=>{
 const T=async(m,f)=>{try{await f();n++;console.log('PASS',m);}catch(e){fail++;console.log('FAIL',m,'\n',e.stack||e);}};
 await T('ensureRegion (real class method): island→lakeside one travel, lakeside→lakeside none, meadow→lakeside refused',async()=>{
  let x=host('island');assert.equal((await x.h.ensureRegion('lakeside')).ok,true);assert.deepEqual(JSON.parse(JSON.stringify(x.events)),[['travel','lakeside']]);
  x=host('lakeside');assert.equal((await x.h.ensureRegion('lakeside')).ok,true);assert.equal(x.events.length,0);
  x=host('meadow');assert.equal((await x.h.ensureRegion('lakeside')).reason,'return-route-not-yet-available');assert.deepEqual(x.events,[]);});
 await T('enterSelectedLevel r04-lake-01 from the island: travel lakeside → landing hook → enterLevel (in that order)',async()=>{
  const x=host('island');x.h.selection={provider:'mainline-free',stageId:'r04-lake-01',seed:4};hooked.length=0;
  const r=await x.h.enterSelectedLevel();assert.equal(r.ok,true);assert.deepEqual(x.events,[['travel','lakeside'],['enter','r04-lake-01']]);assert.deepEqual(hooked,['r04-lake-01']);});
 console.log(fail?`FAIL ${fail}`:`OK ${n}`);process.exit(fail?1:0);
})();
