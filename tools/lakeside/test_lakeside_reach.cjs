'use strict';
// Plan A candidate: meadow → lakeside → meadow, default off (`?lakeside=1` / __QF_LAKESIDE=1).
// Default order, island→lakeside bridge, and the region-node list stay as they are.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/';
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const ts=require('../qf-env.cjs').typescript();
const Reach=H.load(S+'region/LakesideReach.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts');
const src=f=>fs.readFileSync(S+f,'utf8');
const compFile=src('world-r2/WorldNativeComposition.ts');
const body=compFile.slice(compFile.indexOf('export class WorldNativeComposition')).replace(/@property\([^)]*\) /g,'');
const logs=[];
const ctx={exports:{},Component:class{},RegionCampaign:{canEnterRegion:()=>({ok:false,reason:'region-locked'})},DEBUG:false,console:{...console,error:(...a)=>logs.push(a.join(' '))},
 lakesideSideOrder:Reach.lakesideSideOrder,lakesideReachEnabled:Reach.lakesideReachEnabled,qaTransportEnabled:()=>true,LAKESIDE_LOAD_FAILED:'lakeside-load-failed',lakesideLandingToBoard:()=>Promise.resolve({ok:true})};
vm.runInNewContext(ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);
const Comp=ctx.exports.WorldNativeComposition;
function host(region){const h=Object.create(Comp.prototype),events=[],snap={state:region,journey:{region,target:null}};
 h.world={commands:()=>({snapshot:()=>snap,async travelRegion(t){events.push(['travel',t]);snap.state=t;snap.journey.region=t;return {ok:true};},async leaveHome(){events.push(['leave']);snap.state='island';return {ok:true};}})};
 h.mainline={journeySnapshot:()=>({readOnly:false,records:[]})};return {h,events,snap};}
const g=globalThis;function on(){g.__QF_LAKESIDE='1';}function off(){delete g.__QF_LAKESIDE;}
let n=0,fail=0;const t=(m,f)=>{try{f();n++;console.log('PASS',m);}catch(e){fail++;console.log('FAIL',m,'\n',e.stack||e);}};
const T=async(m,f)=>{try{await f();n++;console.log('PASS',m);}catch(e){fail++;console.log('FAIL',m,'\n',e.stack||e);}};
try{
t('switch defaults off; release WeChat ignores ?lakeside=1 and __QF_LAKESIDE',()=>{
 off();assert.equal(Reach.lakesideReachEnabled(),false);
 assert.equal(Reach.lakesideReachEnabled({location:{search:'?lakeside=1'}}),true);
 assert.equal(Reach.lakesideReachEnabled({wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}})},location:{search:'?lakeside=1'},__QF_LAKESIDE:'1'}),false);
 assert.equal(Reach.lakesideReachEnabled({wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}})},location:{search:'?lakeside=1'}}),true);
 assert.equal(Reach.lakesideSideOrder('meadow','lakeside'),null);
 assert.equal(Reach.journeyTravelOriginOk('lakeside'),false);
 assert.equal(Reach.journeyTravelOriginOk('island'),true);assert.equal(Reach.journeyTravelOriginOk('skycity'),false);
});
t('flag off: meadow→lakeside and lakeside→meadow stay illegal; island→lakeside still validates',()=>{
 off();const start=[1,2,3];
 assert.throws(()=>Reach.lakesideSideRoute('meadow','lakeside',start),/lakeside-reach-off/);
 const island={from:'island',to:'lakeside',path:[start,[1,2,7],[1,2,20]],bridgeStart:4,bridgeEnd:17,speed:1.2};
 Core.validateJourneyRoute(island,start);
 assert.throws(()=>Core.validateJourneyRoute({...island,from:'meadow'},start),/journey-region-order/);
 assert.throws(()=>Core.validateJourneyRoute({...island,from:'lakeside',to:'meadow'},start),/journey-region-order/);
});
t('flag on: flat 1.2 m/s spur validates, no arch, return ends on the meadow stand',()=>{
 on();const start=[0.2,6.505,-25.6];
 const go=Reach.lakesideSideRoute('meadow','lakeside',start);
 Core.validateJourneyRoute(go,start);
 assert.equal(go.speed,1.2);assert.equal(go.timing,undefined);
 const ys=go.path.map(p=>p[1]);assert.equal(Math.max(...ys),Math.min(...ys));
 assert.equal(go.bridgeEnd-go.bridgeStart,16);
 const backStart=go.path[go.path.length-1];
 const back=Reach.lakesideSideRoute('lakeside','meadow',backStart);
 Core.validateJourneyRoute(back,backStart);
 const end=back.path[back.path.length-1];
 assert(Math.hypot(end[0]-start[0],end[1]-start[1],end[2]-start[2])<1e-6,'return lands on the meadow stand');
 assert.equal(Reach.lakesideSideOrder('meadow','lakeside').join(','),'meadow,lakeside');
 assert.equal(Reach.lakesideSideOrder('skycity','lakeside'),null);
 assert.equal(Reach.journeyTravelOriginOk('lakeside'),true);
 assert.equal(Reach.journeyTravelOriginOk('skycity'),false);
});
t('shipped tables unchanged: bridge leg, node order, no rainbow on the spur branch',()=>{
 const transport=src('region/JourneyTransport.ts'),nodes=src('region/RegionNodeProgress.ts'),adapter=src('region/RegionJourneyAdapter.ts'),flow=src('world-r1/WorldFlowCore.ts'),boot=src('WorldIntegrationBoot.ts');
 assert.match(transport,/\'island-lakeside\':\'bridge\'/);
 assert.match(nodes,/export const REGION_ORDER:readonly RegionId\[\]=\['island','meadow','skycity'\]/);
 assert.match(flow,/if\(!\(this\.stable==='island'\|\|this\.stable==='meadow'\|\|\(this\.stable==='lakeside'&&lakesideReachQueryOn\(\)\)\)\)return \{ok:false,reason:'journey-wrong-origin'\}/);
 assert.match(flow,/function lakesideReachQueryOn\(\):boolean/);
 assert.doesNotMatch(flow,/from ['"][^'"]*LakesideReach['"]/);
 assert.doesNotMatch(src('world-r1/RegionJourneyCore.ts'),/from ['"][^'"]*LakesideReach['"]/);
 const spurAt=adapter.indexOf('if(spur){');
 const spur=adapter.slice(spurAt,adapter.indexOf('}else{',spurAt));
 assert.doesNotMatch(spur,/rainbowBridge/);
 assert.match(adapter,/rainbowBridge\(rig,L\.bridge,owned\)/);
 assert.match(adapter,/function prepareLakesideSpurReturn/);
 assert.doesNotMatch(adapter.slice(adapter.indexOf('function prepareLakesideSpurReturn')),/rainbowBridge/);
 assert.match(boot,/else if\(lakesideReachEnabled\(\)\)void this\.composition\.previewLakesideReach\(\)/);
 assert.doesNotMatch(boot,/lakeside reach|湖畔支线|测试横幅/);
});
}finally{off();}
(async()=>{
 try{
 await T('flag off: meadow cannot enter lakeside and does not travel',async()=>{
  off();logs.length=0;const x=host('meadow');
  assert.equal((await x.h.ensureRegion('lakeside')).reason,'return-route-not-yet-available');
  assert.deepEqual(x.events,[]);assert.equal(logs.filter(l=>l.includes('[QF_LAKE]')).length,0);
  assert.equal((await x.h.previewLakesideReach()).reason,'lakeside-reach-off');assert.deepEqual(x.events,[]);
 });
 await T('flag on: meadow → lakeside → meadow, back on the mainline, no [QF_LAKE]',async()=>{
  on();logs.length=0;const x=host('meadow');
  assert.equal((await x.h.ensureRegion('lakeside')).ok,true);
  assert.deepEqual(x.events,[['travel','lakeside']]);assert.equal(x.snap.journey.region,'lakeside');
  assert.equal((await x.h.ensureRegion('meadow')).ok,true);
  assert.deepEqual(x.events,[['travel','lakeside'],['travel','meadow']]);
  assert.equal(x.snap.state,'meadow');assert.equal(x.snap.journey.region,'meadow');
  assert.equal(logs.filter(l=>l.includes('[QF_LAKE]')).length,0,logs.join('\n'));
  const round=host('meadow');logs.length=0;
  assert.equal((await round.h.previewLakesideReach()).ok,true);
  assert.deepEqual(round.events,[['travel','lakeside'],['travel','meadow']]);
  assert.equal(round.snap.journey.region,'meadow');
  assert.equal(logs.filter(l=>l.includes('[QF_LAKE]')).length,0);
 });
 await T('flag on does not open skycity → lakeside and still walks island → lakeside',async()=>{
  on();const sky=host('skycity');
  assert.equal((await sky.h.ensureRegion('lakeside')).reason,'return-route-not-yet-available');
  assert.deepEqual(sky.events,[]);
  const island=host('island');
  assert.equal((await island.h.ensureRegion('lakeside')).ok,true);
  assert.deepEqual(island.events,[['travel','lakeside']]);
 });
 }finally{off();}
 console.log(fail?`FAIL ${fail}`:`OK ${n}`);process.exit(fail?1:0);
})();
