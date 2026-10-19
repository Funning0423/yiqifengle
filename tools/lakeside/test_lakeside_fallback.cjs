// build05-next: every 风铃湖畔 failure path Voice Bot's 4728814 logs with [QF_LAKE] (journey prepare/walk, ensureRegion,
// board background) ends the same way: details in the log only, the lakeside journey dropped, she stands on the island, and the
// HUD shows only the toast 「湖畔暂时没准备好，先回小岛吧」. Pause/cancel/double-tap stay soft (normal pause/resume UI).
// A lake-ambience load failure is log-only (sea waves stay on), no toast.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/'),src=f=>fs.readFileSync(S+f,'utf8');
const comp=src('world-r2/WorldNativeComposition.ts'),flow=src('world-r1/WorldFlowCore.ts'),boot=src('WorldIntegrationBoot.ts'),amb=src('audio/LakeAmbience.ts'),bg=src('region/LakesideBoardBackground.ts');
const FAILED=bg.match(/export const LAKESIDE_LOAD_FAILED='([^']+)'/)[1];
const soft=JSON.parse(comp.match(/const LAKESIDE_SOFT_REASONS=(\[[^\]]*\])/)[1].replace(/'/g,'"'));assert.deepEqual(soft,['cancelled','paused','busy']);
const body=comp.slice(comp.indexOf('export class WorldNativeComposition')).replace(/@property\([^)]*\) /g,'');
const logs=[];const ctx={exports:{},Component:class{},RegionCampaign:{canEnterRegion:()=>({ok:true})},DEBUG:false,LAKESIDE_LOAD_FAILED:FAILED,LAKESIDE_SOFT_REASONS:soft,lakesideSideOrder:()=>null,console:{...console,error:(...a)=>logs.push(a.join(' '))},lakesideLandingToBoard:()=>Promise.resolve()};
vm.runInNewContext(ts.transpileModule(body,{compilerOptions:{module:1,target:7}}).outputText,ctx);const Comp=ctx.exports.WorldNativeComposition;
function host({travel,enter}){const h=Object.create(Comp.prototype),ev=[],snap={state:'skycity',journey:{region:'skycity',target:null}};
 h.world={commands:()=>({snapshot:()=>snap,async travelRegion(t){ev.push(['travel',t]);return travel;},async enterLevel(id){ev.push(['enter',id]);return enter;},abandonLakesideJourney(){ev.push(['abandon']);return {ok:true};}})};
 h.mainline={journeySnapshot:()=>({readOnly:false,records:[]})};h.selection={provider:'mainline-free',stageId:'r04-lake-01',seed:4};return {h,ev};}
(async()=>{
 const cases=[
  ['journey prepare/walk failure',{travel:{ok:false,reason:'Error: lakeside-prefab-missing: LK_x'},enter:{ok:true}},FAILED,[['travel','lakeside'],['abandon']],'journey'],
  ['ensureRegion refusal (wrong origin)',{travel:{ok:false,reason:'journey-wrong-origin'},enter:{ok:true}},FAILED,[['travel','lakeside'],['abandon']],'journey'],
  ['board background failure',{travel:{ok:true},enter:{ok:false,reason:'Error: '+FAILED}},FAILED,[['travel','lakeside'],['enter','r04-lake-01'],['abandon']],'board'],
  ['player pause stays soft',{travel:{ok:false,reason:'cancelled'},enter:{ok:true}},'cancelled',[['travel','lakeside']],null],
  ['background pause stays soft',{travel:{ok:false,reason:'paused'},enter:{ok:true}},'paused',[['travel','lakeside']],null],
  ['ordinary board refusal passes through',{travel:{ok:true},enter:{ok:false,reason:'finish-or-discard-current-attempt'}},'finish-or-discard-current-attempt',[['travel','lakeside'],['enter','r04-lake-01']],null],
 ];
 for(const [name,io,reason,events,stage] of cases){logs.length=0;const {h,ev}=host(io);const r=await h.enterSelectedLevel();
  assert.equal(r.reason,reason,name);assert.deepEqual(JSON.parse(JSON.stringify(ev)),events,name);
  const lakeErrors=logs.filter(l=>l.startsWith('[QF_LAKE]'));/* r4.2 item 3: soft stops log nothing; a real failure exactly one error */
  assert.equal(lakeErrors.length,stage?1:0,name+' [QF_LAKE] error count: '+JSON.stringify(lakeErrors));
  if(stage){assert.equal(h.pendingJourneySelection,null,name);const j=logs.map(l=>l.startsWith('[QF_LAKE] {')?JSON.parse(l.slice(10)):null).find(Boolean);assert(j&&j.event==='lakeside-fallback'&&j.stage===stage&&j.island==='ok',name+' logged');}
  console.log('PASS',name);}
 // WorldFlow.abandonLakesideJourney on stubs (real method text)
 const m=flow.match(/  abandonLakesideJourney\(\):Result \{[\s\S]*?\n  \}\n/)[0];
 const F=vm.runInNewContext(ts.transpileModule('class F{'+m+'}',{compilerOptions:{target:7}}).outputText+';F');
 const mk=(snap,current=null)=>{const calls=[];const o=Object.assign(Object.create(F.prototype),{state:'island',current,stable:'lakeside',error:'Error: x',journey:{snapshot:()=>snap,returnToIsland(){calls.push('return');}},restore(){calls.push('restore');},change(s){calls.push('change:'+s);}});return {o,calls};};
 let x=mk({region:'island',target:'lakeside',phase:'failed'});assert.deepEqual(JSON.parse(JSON.stringify(x.o.abandonLakesideJourney())),{ok:true});assert.deepEqual(x.calls,['return','restore','change:island']);assert.equal(x.o.stable,'island');assert.equal(x.o.error,null);
 x=mk({region:'lakeside',target:null,phase:'arrived'});x.o.abandonLakesideJourney();assert.deepEqual(x.calls,['return','restore','change:island'],'arrived lakeside, board failed');
 x=mk({region:'meadow',target:null,phase:'arrived'});x.o.abandonLakesideJourney();assert.deepEqual(x.calls,[],'other regions untouched');
 x=mk({region:'island',target:'lakeside'},{});assert.equal(x.o.abandonLakesideJourney().reason,'busy');assert.deepEqual(x.calls,[]);
 assert(/abandonLakesideJourney:\(\)=>flow\(\)\.abandonLakesideJourney\(\)/.test(src('world-r1/WorldFlowComponent.ts')),'exposed on commands()');
 console.log('PASS WorldFlow.abandonLakesideJourney');
 // screen: only the approved toast; no [QF_LAKE]/[QF_LAKESIDE] text reaches a Label
 assert(/r\.reason===LAKESIDE_LOAD_FAILED\)\{this\.islandToast\?\.show\(LAKESIDE_NOT_READY_TEXT\);/.test(boot));
 assert(!/QF_LAKE/.test(boot),'no log tag in HUD code');
 // ambience failure: log only (sea waves stay on), no toast
 assert(/console\.error\('\[QF_LAKE\] lake ambience ' \+ stage \+ ' failed \(sea waves stay on\)/.test(amb));assert(!/Toast|LAKESIDE_NOT_READY|LAKESIDE_LOAD_FAILED/.test(amb),'ambience never toasts');
 console.log('PASS HUD/ambience');
 console.log('lakeside fallback OK');
})().catch(e=>{console.error(e);process.exit(1);});
