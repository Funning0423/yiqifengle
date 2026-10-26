'use strict';
// full7b (Grok Bot): a player who finished L12 resumes near S6, also after a reload + the trip back to skycity. Replays the
// runtime path: real WorldNativeComposition.ensureRegion (the cold-progress route every 继续旅程 / region entry takes) with the real
// RegionCampaign gate, SkyLakePreWalk and RegionNodePlay.runSkyResumeToS6; the balloon "lands" her on the b19 S0 deck
// (TRANSITION_STAGING.skycity.s0New). L12 done → she ends on S6; L11 → she stays on S0 (no change before L12).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const H=require('../board-ui/harness.cjs').createHarness();
const TS=H.load('region/TransitionStaging.ts'),PW=H.load('region/SkyLakePreWalk.ts'),SK=H.load('region/SkyWalkShot.ts'),RNP=H.load('region/RegionNodePlay.ts'),LB=H.load('region/LakesideBalloon.ts');
const RegionCampaign=require(path.join(root,'mainline-r1/runtime/region-campaign.js'));
let code=fs.readFileSync(path.join(root,'world-r2/WorldNativeComposition.ts'),'utf8').replace(/^import [\s\S]*?;\n/gm,'').replace(/@ccclass\([^\n]*\)/g,'').replace(/@property\([^\n]*?\)/g,'').replace(/export /g,'');
code=stripTypeScriptTypes(code,{mode:'transform'});
const director={getDeltaTime:()=>1/30,on(){},off(){}},Director={EVENT_BEFORE_DRAW:'bd'};
const vars={Component:class{},_decorator:{},RegionCampaign,director,Director,applyCameraPose(){},fromLookAt:p=>p,prewarmLakesideAssets:()=>Promise.resolve(),LAKESIDE_L12_HOLD_MS:1,
 skyLakePreWalk:PW.skyLakePreWalk,skyPreFollowPose:PW.skyPreFollowPose,SKY_PRE_FOLLOW:PW.SKY_PRE_FOLLOW,skyResumeAtS6:PW.skyResumeAtS6,TRANSITION_STAGING:TS.TRANSITION_STAGING,runSkyResumeToS6:RNP.runSkyResumeToS6,lakeBlendPose:LB.blendPose};
const Composition=new Function(...Object.keys(vars),code+';return WorldNativeComposition;')(...Object.values(vars));
const M5=TS.TRANSITION_STAGING.skyMooring5a,S0DECK=SK.skyLocalToWorld(M5,TS.TRANSITION_STAGING.skycity.s0New),S6=M5.walkWorld[0];
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
async function replay(cleared){
 const journey={readOnly:false,records:Array.from({length:12},(_,i)=>i<cleared?{bestStars:2,clears:1}:{bestStars:0,clears:0})};
 const pos={x:0,y:0,z:0},walks=[];
 const actor={node:{isValid:true,worldPosition:pos},perform(a){walks.push(a);const e=a.path[a.path.length-1];pos.x=e[0];pos.y=e[1];pos.z=e[2];return Promise.resolve();},cancelAndReset(p){const r=p.controllerRoot;pos.x=r[0];pos.y=r[1];pos.z=r[2];}};
 let region='island';  // after a reload the world starts on the island; the trip back travels island → meadow → skycity
 const commands={snapshot:()=>({journey:{region,target:null}}),travelRegion:async to=>{region=to;if(to==='skycity'){pos.x=S0DECK[0];pos.y=S0DECK[1];pos.z=S0DECK[2];}return {ok:true};}};
 const c=Object.create(Composition.prototype);c.world={commands:()=>commands};c.mainline={journeySnapshot:()=>journey};c.boundCharacter=actor;c.worldCamera=null;
 const r=await c.ensureRegion('skycity');assert.equal(r.ok,true);return {at:[pos.x,pos.y,pos.z],walks};}
(async()=>{
 const done=await replay(12),before=await replay(11);
 assert.ok(d3(done.at,S6)<1e-6,'L12 done: resumes on S6, got '+done.at);
 assert.equal(done.walks.length,1,'one continuous walk');const w=done.walks[0];assert.equal(w.kind,'walk');
 assert.ok(d3(w.path[0],S0DECK)<1e-6,'walk starts where the balloon left her');
 const pre=PW.skyLakePreWalk(S0DECK,M5);assert.deepEqual(w.path,pre.path,'same graph path as the gated prewalk (sky-lake-prewalk asserts walkable / turns)');
 assert.ok(d3(before.at,S0DECK)<1e-6&&before.walks.length===0,'before L12: spawn unchanged (S0 deck)');
 assert.equal(PW.skyResumeAtS6(RegionCampaign.canEnterRegion({readOnly:false,records:Array.from({length:12},()=>({bestStars:1,clears:1}))},'lakeside')),true);
 console.log(JSON.stringify({l12:{at:done.at.map(v=>+v.toFixed(2)),walkM:+pre.lengthM.toFixed(1),walkS:+pre.durationS.toFixed(1),keys:pre.keys.join('>')},l11:{at:before.at.map(v=>+v.toFixed(2))}}));
 console.log('PASS reload → skycity: L12 done resumes on S6, before L12 unchanged');
})().catch(e=>{console.error(e);process.exit(1);});
