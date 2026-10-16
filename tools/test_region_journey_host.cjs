'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('./qf-env.cjs').typescript();
const Campaign=require('../creator-build-project/assets/scripts/mainline-r1/runtime/region-campaign.js');
const file=fs.readFileSync('creator-build-project/assets/scripts/world-r2/WorldNativeComposition.ts','utf8'),body=file.slice(file.indexOf('export class WorldNativeComposition')).replace(/@property\([^)]*\) /g,'');
const context={exports:{},Component:class{},RegionCampaign:Campaign,DEBUG:false,console};vm.runInNewContext(ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);const Class=context.exports.WorldNativeComposition;
function harness(cleared=4){
 const h=Object.create(Class.prototype),journey={readOnly:false,records:Array.from({length:12},(_,i)=>({bestStars:i<cleared?1:0,clears:i<cleared?1:0}))},events=[];
 const snapshot={state:'level',journey:{region:cleared===8?'meadow':'island',target:null}};
 const active={provider:'mainline-v33',state:'result.saved',active:{stageId:cleared===8?'mainline-08':'mainline-04'},nextStageId:cleared===8?'mainline-09':'mainline-05',result:{completionRecorded:true},journey};
 const command={snapshot:()=>snapshot,async prepareRegion(target){events.push(['prepare',target]);return{ok:true};},exitLevel(){events.push(['exit']);snapshot.state=snapshot.journey.region;return{ok:true};},async travelRegion(target){events.push(['travel',target]);snapshot.state=target;snapshot.journey.region=target;return{ok:true};},async enterLevel(id){events.push(['enter',id]);snapshot.state='level';return{ok:true};},resume(){events.push(['resume']);snapshot.state=snapshot.journey.region;return{ok:true};}};
 h.world={commands:()=>command};h.mainline={journeySnapshot:()=>journey,createController:()=>({snapshot:()=>({stages:Campaign.stages.map(s=>({id:s.id,unlocked:s.level<=cleared}))})})};h.activeSession={snapshot:()=>active,command(){throw Error('journey must never write rewards');}};h.selection=null;h.pendingJourneySelection=null;
 return {h,journey,events,snapshot,active,command};
}
(async()=>{
 const a=harness();assert((await a.h.advanceMainline()).ok);assert.deepEqual(a.events,[['prepare','meadow'],['exit'],['travel','meadow'],['enter','mainline-05']]);assert.equal(a.h.pendingJourneySelection,null);
 const b=harness(8);assert((await b.h.advanceMainline()).ok);assert.deepEqual(b.events,[['prepare','skycity'],['exit'],['travel','skycity'],['enter','mainline-09']]);
 const f=harness();f.command.prepareRegion=async()=>({ok:false,reason:'offline'});assert.equal((await f.h.advanceMainline()).reason,'offline');assert.equal(f.snapshot.state,'level');assert.deepEqual(f.events,[]);assert(f.active.result.completionRecorded);
 const paused=harness();paused.command.travelRegion=async(target)=>{paused.events.push(['travel-cancelled',target]);return {ok:false,reason:'cancelled'};};assert.equal((await paused.h.advanceMainline()).reason,'cancelled');assert.equal(paused.h.pendingJourneySelection.stageId,'mainline-05');paused.command.travelRegion=async(target)=>{paused.events.push(['travel-resume',target]);paused.snapshot.journey.region=target;paused.snapshot.state=target;return{ok:true};};assert((await paused.h.resumeJourney()).ok);assert.deepEqual(paused.events.slice(-3),[['resume'],['travel-resume','meadow'],['enter','mainline-05']]);
 const invalid=harness();invalid.journey.readOnly=true;assert(!(await invalid.h.advanceMainline()).ok);assert.deepEqual(invalid.events,[]);
 const unsaved=harness();unsaved.active.result.completionRecorded=false;assert.equal((await unsaved.h.advanceMainline()).reason,'next-requires-registered-win');assert.deepEqual(unsaved.events,[]);
 const cold=harness(8);cold.snapshot.state='island';cold.snapshot.journey.region='island';assert((await cold.h.enterMainlineStage('mainline-09')).ok);assert.deepEqual(cold.events,[['travel','meadow'],['travel','skycity'],['enter','mainline-09']]);
 const reverse=harness(8);reverse.snapshot.state='meadow';assert.equal((await reverse.h.enterMainlineStage('mainline-01')).reason,'return-route-not-yet-available');assert.deepEqual(reverse.events,[]);
 console.log('PASS 8 production host cases: saved 04/08 boundaries, preflight retained result, paused continuation, readonly/unsaved gates, cold two-hop path, no reverse teleport');
})().catch(error=>{console.error(error);process.exitCode=1;});
