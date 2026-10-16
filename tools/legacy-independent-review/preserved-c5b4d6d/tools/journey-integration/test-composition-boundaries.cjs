'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHarness}=require('../board-ui/harness.cjs');
const Port=require('../../creator-build-project/assets/scripts/mainline-r1/adapter/mainline-port.js');
const W=require('../mainline-fixtures/verified-replays.json');
const results=[];
function store(){const map=new Map(),port=Port.createPort({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v))});return{map,port,bytes:()=>JSON.stringify([...map].sort((a,b)=>a[0].localeCompare(b[0])))};}
function play(c,w){assert(c.startStage(w.stageId,{seed:w.seed}).ok);for(const a of w.actions){const p=c.previewAction(a);assert(p.ok);assert(c.commitAction(p.token).ok);while(c.snapshot().visual)assert(c.finishVisualStep(c.snapshot().visual.token).ok);}}
async function test(id,fn){try{results.push({id,status:'PASS',...await fn()});}catch(e){results.push({id,status:'FAIL',error:e.stack});}}
(async()=>{
for(const boundary of [4,8])await test('J02/J03/J04 actual-composition-next-'+boundary,async()=>{
 const H=createHarness(),C=H.load('world-r2/WorldNativeComposition').WorldNativeComposition,composition=new C(),f=store(),controller=f.port.createController();
 for(let n=0;n<boundary;n++)play(controller,W[n]);
 composition.mainline=f.port;composition.activeSession={snapshot:()=>controller.snapshot(),command:(name,...args)=>controller[name](...args)};
 let state='level',region=boundary===4?'island':'meadow',fail=true,prepares=0,entered=null;const trace=[];
 const commands={snapshot:()=>({state,journey:{region,target:null}}),prepareRegion:async target=>{prepares++;trace.push(['prepare',target]);return fail?{ok:false,reason:'injected-scene-failure'}:{ok:true};},exitLevel:()=>{trace.push(['exit',state]);state=region;return{ok:true};},travelRegion:async target=>{trace.push(['travel',region,target]);region=target;state=target;return{ok:true};},enterLevel:async id=>{trace.push(['enter',id]);entered=id;state='level';return{ok:true};}};
 composition.world={commands:()=>commands};const before=f.bytes();
 const failure=await composition.advanceMainline();assert.equal(failure.ok,false);assert.equal(failure.reason,'injected-scene-failure');assert.equal(state,'level');assert.deepEqual(trace,[['prepare',boundary===4?'meadow':'skycity']]);assert.equal(f.bytes(),before);assert.equal(controller.snapshot().journey.completed,boundary);
 fail=false;trace.length=0;const success=await composition.advanceMainline();assert(success.ok,success.reason);const target=boundary===4?'meadow':'skycity';assert.equal(entered,W[boundary].stageId);assert.equal(prepares,2);assert.deepEqual(trace.map(x=>x[0]),['prepare','exit','travel','enter']);assert.equal(region,target);assert.equal(f.bytes(),before,'scene traversal cannot grant progress or rewards');assert.equal(composition.pendingJourneySelection,null);return{source:W[boundary-1].stageId,destination:entered,trace,failedLoadKeptResult:true,retryPreparedAgain:true,noStorageWritesFromTravel:true};
});
await test('J01/J09 composition-refuses-unearned-or-corrupt-destination',async()=>{for(const corrupt of [false,true]){const H=createHarness(),C=H.load('world-r2/WorldNativeComposition').WorldNativeComposition,c=new C(),f=store();if(corrupt)f.map.set('forest-v33-journey','{broken');c.mainline=f.port;const trace=[];c.world={commands:()=>({snapshot:()=>({state:'island',journey:{region:'island',target:null}}),travelRegion:async()=>{trace.push('travel');return{ok:true};},enterLevel:async()=>{trace.push('enter');return{ok:true};}})};const bytes=f.bytes();const result=await c.enterMainlineStage('mainline-05');assert(!result.ok);assert.deepEqual(trace,[]);assert.equal(f.bytes(),bytes);}return{unearnedAndCorruptDenied:true};});
const report={status:results.every(x=>x.status==='PASS')?'PASS':'FAIL',timeUTC:new Date().toISOString(),scope:'Actual production WorldNativeComposition and mainline controller, legal progression, explicit world-command doubles. Tests command ordering/ownership only, not rendered movement.',checks:results};fs.writeFileSync(path.join(__dirname,'reports/composition-boundaries.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
