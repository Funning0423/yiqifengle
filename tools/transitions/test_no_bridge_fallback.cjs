#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
function load(rel){
 const file=path.join(S,rel);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};
 vm.runInNewContext(js,{module:m,exports:m.exports,require:()=>({}),console,URLSearchParams,globalThis},{filename:file});
 return m.exports;
}
const jt=load('region/JourneyTransport.ts');
const wait=load('region/TransportWait.ts');
const warns=[];
const origWarn=console.warn;
console.warn=(...args)=>{warns.push(args.join(' '));};
try{
 assert.equal(jt.transportQaOverride('?transport=bridge',null),null);
 assert.equal(jt.transportQaOverride('?transport=sail',null),'sail');
 assert.equal(jt.transportQaOverride('?transport=balloon',null),'balloon');
 assert.equal(jt.transportFor('island','meadow','bridge'),'sail');
 assert.equal(jt.transportFor('meadow','skycity','bridge'),'balloon');
 assert.equal(jt.transportFor('island','meadow',{__QF_TRANSPORT:'bridge'}),'sail');
 assert.equal(jt.transportFor('meadow','skycity',{__QF_TRANSPORT:'bridge'}),'balloon');
 assert.equal(jt.transportFor('island','meadow',{__QF_TRANSPORT:'balloon'}),'sail');
 assert.equal(jt.transportFor('meadow','skycity',{__QF_TRANSPORT:'sail'}),'balloon');
 assert.equal(jt.transportFor('island','meadow',{location:{search:'?transport=bridge'}}),'sail');
 jt.noteSailPreloadFallback('timeout-6s');
 jt.noteSailPreloadFallback('load-fail');
 assert.equal(jt.sailPreloadFellBack(),false);
 assert.equal(jt.transportFor('island','meadow',null),'sail');
 assert.equal(jt.transportFor('meadow','skycity',null),'balloon');
 assert.ok(warns.some(line=>line.includes('transport-override-ignored')),'ignored transport override warns');
}finally{console.warn=origWarn;}

function pair(kind){return kind==='sail'?['island','meadow']:['meadow','skycity'];}
async function run(kind,steps){
 wait.resetTransportWait();
 const series=[];
 const alpha=kind==='sail'?0.42:0.27;
 let cameraWrites=0;
 const clock=wait.createTransportClock(t=>{
  const snap=wait.transportWaitSnapshot();
  assert.equal(snap.active,true,'wait stays up while the load is in flight');
  assert.equal(snap.kind,kind);
  assert.equal(snap.gentle,true);
  assert.equal(snap.cameraHeld,true);
  assert.equal(snap.coverAlpha,alpha);
  series.push({t,alpha:snap.coverAlpha});
 });
 let index=0;
 const result=await wait.awaitVehicle({
  kind,
  clock,
  coverAlpha:()=>alpha,
  onCover(value){
   assert.equal(value,alpha,'cover is held, not cleared or forced black');
   assert.equal(cameraWrites,0,'wait does not move the camera');
   series.push({t:clock.now(),alpha:value});
  },
  load:async()=>{
   const spec=steps[index++];
   const snap=wait.transportWaitSnapshot();
   assert.equal(snap.active,true);
   assert.equal(snap.kind,kind);
   const [from,to]=pair(kind);
   assert.equal(jt.transportFor(from,to,null),kind,'slow load does not select bridge');
   await clock.sleep(spec.ms);
   if(spec.fail)throw Error('load-fail');
   return {vehicle:kind};
  },
 });
 assert.equal(result.kind,kind);
 assert.equal(result.value.vehicle,kind);
 assert.equal(result.attempts,steps.length);
 assert.ok(wait.coverStayedContinuous(series.map(row=>row.alpha)));
 assert.ok(series.every(row=>row.alpha!==0&&row.alpha!==1),'no black flash and no cover drop');
 assert.ok(series.length>=3,'cover sampled through the wait');
 for(let i=1;i<series.length;i++)assert.ok(series[i].t>=series[i-1].t&&series[i].t-series[i-1].t<=250+1e-6,'cover samples have no gap');
 const elapsed=series[series.length-1].t-series[0].t;
 const asked=steps.reduce((sum,step)=>sum+step.ms,0);
 assert.ok(elapsed+1e-6>=asked,'wait covers the whole load');
 assert.equal(wait.transportWaitSnapshot().active,false);
 assert.equal(cameraWrites,0);
 const [from,to]=pair(kind);
 assert.equal(jt.transportFor(from,to,null),kind);
 return result;
}

(async()=>{
 for(const kind of ['sail','balloon']){
  const seven=await run(kind,[{ms:7000,fail:false}]);
  assert.equal(seven.attempts,1);
  const twenty=await run(kind,[{ms:20000,fail:false}]);
  assert.equal(twenty.attempts,1);
  const retried=await run(kind,[{ms:7000,fail:true},{ms:500,fail:false}]);
  assert.equal(retried.attempts,2);
  assert.equal(retried.value.vehicle,kind);
 }
 await assert.rejects(()=>wait.awaitVehicle({
  kind:'balloon',
  clock:wait.createTransportClock(),
  retryGapMs:0,
  maxAttempts:2,
  coverAlpha:()=>0.2,
  load:async()=>{throw Error('load-fail');},
 }),/load-fail/);
 assert.equal(jt.transportFor('meadow','skycity',null),'balloon','exhausted retry still does not select bridge');
 assert.equal(wait.transportWaitSnapshot().active,false,'exhausted wait does not stay busy');
 const adapter=fs.readFileSync(path.join(S,'region/RegionJourneyAdapter.ts'),'utf8');
 const sail=fs.readFileSync(path.join(S,'region/SailPreload.ts'),'utf8');
 const transport=fs.readFileSync(path.join(S,'region/JourneyTransport.ts'),'utf8');
 assert.ok(adapter.includes('awaitVehicle'),'balloon and sail waits go through awaitVehicle');
 assert.ok(!adapter.includes('balloon-timeout'),'balloon timeout no longer falls through');
 assert.ok(!adapter.includes('balloon-dropped'));
 assert.ok(!sail.includes('noteSailPreloadFallback')&&!sail.includes('timeout-6s'));
 assert.ok(!transport.includes('sailPreloadFallback'));
 assert.ok(!/preload-fallback/.test(transport));
 console.log(JSON.stringify({status:'PASS',cases:['sail-7s','sail-20s','sail-retry','balloon-7s','balloon-20s','balloon-retry']}));
})().catch(error=>{console.error(error);process.exit(1);});
