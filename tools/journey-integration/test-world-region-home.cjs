'use strict';
// 「主页」 from a region reached by the mainline journey (Mac check 379e137, item 9): after 04→05 (meadow) and 08→09
// (skycity) the board exits to the region and returnHome must walk her home. Returning is not a completion: the journey is
// reset to the island (scenes released) and the next trip walks the route again. A region VISIT (enterSkycity) keeps exitSkycity.
const assert=require('node:assert/strict'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),{WorldFlow}=H.load('world-r1/WorldFlowCore'),{RegionJourneyController}=H.load('world-r1/RegionJourneyCore');
const pose={position:[3,3,-6],target:[0,1,0]},zero=[0,0,0],seat={position:zero,back:[0,0,-1],yawRad:0,seatedFoot:zero,standingFoot:zero,seatedControllerRoot:zero,standingControllerRoot:zero};
const config={seat,toDoor:[zero,[0,0,1]],outCrossing:[[0,0,1],[0,0,2]],toIsland:[[0,0,2],[0,0,3]],toThreshold:[[0,0,3],[0,0,2]],inCrossing:[[0,0,2],[0,0,1]],toSeat:[[0,0,1],zero],cameraHome:pose,cameraToDoor:[pose,pose],cameraInside:pose,cameraOutside:pose,cameraIsland:pose,openDeg:90,speed:1};
function make({hold=false}={}){let root=zero,camera=pose,release=null;const walks=[],scenes={made:0,disposed:0};
 const actor={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:zero,seatedRoot:zero,seatYawRad:0,clearanceRadiusM:.1},advance(){},walkProgress:()=>hold?.4:1,
  perform:async(action,token)=>{if(action.kind==='walk'){walks.push(action.path);if(hold&&action.path.length>2){await new Promise((res,rej)=>{release=res;token?.onCancel?.(()=>rej(new Error('cancelled')));});}root=action.path.at(-1);}},
  cancelAndReset:p=>{root=p.kind==='standing'?p.controllerRoot:p.seat.seatedControllerRoot;},setVisible(){},dispose(){}};
 const world={setCamera:p=>{camera=p;},setLayers(){},setDoor(){},cancelTransient(){},assertStaticWorld(){},dispose(){},animateCamera:async()=>{},animateDoor:async()=>{}};
 const journey=new RegionJourneyController({readCamera:()=>camera,prepare:async(from,to,start)=>{scenes.made++;return {route:{from,to,path:[start,[start[0],start[1]+1,start[2]+4],[start[0],start[1]+1,start[2]+8]],bridgeStart:1,bridgeEnd:6,speed:1},show(){},dispose(){scenes.disposed++;}};}});
 const visit={shown:0,show(){this.shown++;},hide(){},dispose(){this.disposed=true;}};
 const flow=new WorldFlow({config,character:actor,journey,skycity:{enter:async()=>visit},levels:{enter:async()=>({requestExit:()=>({ok:true}),hide(){},showPaused(){},resume:()=>({ok:true}),dispose(){},isSettledResult:()=>true})},loadWorld:async()=>world});
 return {flow,journey,walks,scenes,root:()=>root};}
const results=[];const test=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
(async()=>{
 for(const [region,stage,legs] of [['meadow','mainline-05',['meadow']],['skycity','mainline-09',['meadow','skycity']]])
  await test(`returnHome after arriving in ${region} (${stage}) and exitLevel walks her home; journey reset, not completed`,async()=>{
   const x=make();assert((await x.flow.load()).ok);assert((await x.flow.leaveHome()).ok);
   for(const r of legs)assert((await x.flow.travelRegion(r)).ok,'travel '+r);
   assert((await x.flow.enterLevel(stage)).ok);assert(x.flow.exitLevel().ok);assert.equal(x.flow.snapshot().state,region);
   const walks=x.walks.length,r=await x.flow.returnHome();assert.deepEqual(r,{ok:true});
   assert.equal(x.flow.snapshot().state,'home');assert.deepEqual(x.root(),zero,'seated at home');
   const j=x.journey.snapshot();assert.equal(j.region,'island');assert.equal(j.phase,'idle');assert.equal(j.target,null);assert.equal(x.scenes.disposed,x.scenes.made,'journey scenes released');
   assert(x.walks.length>walks,'walked home');
   // the next trip starts from the island again and walks the whole route (nothing was marked arrived/complete)
   assert((await x.flow.leaveHome()).ok);for(const r2 of legs)assert((await x.flow.travelRegion(r2)).ok);assert.equal(x.flow.snapshot().state,region);
   assert((await x.flow.enterLevel(stage)).ok,'stage re-enterable after the second trip');});
 await test('returnHome directly from an arrived region (no level) works',async()=>{const x=make();await x.flow.load();await x.flow.leaveHome();assert((await x.flow.travelRegion('meadow')).ok);assert.deepEqual(await x.flow.returnHome(),{ok:true});assert.equal(x.flow.snapshot().state,'home');});
 await test('returnHome from a paused (cancelled) journey on the island works',async()=>{const x=make({hold:true});await x.flow.load();await x.flow.leaveHome();const p=x.flow.travelRegion('meadow');await new Promise(r=>setTimeout(r,5));
  const c=x.flow.cancelTransition();await p;assert(x.journey.isInTransit(),'journey paused mid-route');assert.notEqual(x.flow.snapshot().state,'region-travel');
  const r=await x.flow.returnHome();assert.deepEqual(r,{ok:true},JSON.stringify(r)+' '+JSON.stringify(c));assert.equal(x.flow.snapshot().state,'home');assert.equal(x.journey.isInTransit(),false);});
 await test('skycity VISIT still returns with exitSkycity (returnHome stays wrong-state there)',async()=>{const x=make();await x.flow.load();await x.flow.leaveHome();assert((await x.flow.enterSkycity()).ok);assert.equal((await x.flow.returnHome()).reason,'wrong-state');assert(x.flow.exitSkycity().ok);assert.deepEqual(await x.flow.returnHome(),{ok:true});});
 await test('returnHome inside a level is still refused (the board exit comes first)',async()=>{const x=make();await x.flow.load();await x.flow.leaveHome();await x.flow.travelRegion('meadow');await x.flow.enterLevel('mainline-05');assert.equal((await x.flow.returnHome()).reason,'wrong-state');assert.equal(x.flow.snapshot().state,'level');});
 console.log(JSON.stringify({status:'PASS',checks:results.length}));
})().catch(e=>{console.error('FAIL',e);process.exitCode=1;});
