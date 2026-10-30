'use strict';
// Plan B: skycity → lakeside by balloon, after mainline-12. No ?lakeside=1 production path.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/';
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const ts=require('../qf-env.cjs').typescript();
const Core=H.load(S+'world-r1/RegionJourneyCore.ts');
const Balloon=H.load(S+'region/LakesideBalloon.ts');
const Nodes=H.load(S+'region/RegionNodeProgress.ts');
const Transport=H.load(S+'region/JourneyTransport.ts');
const src=f=>fs.readFileSync(S+f,'utf8');
const adapter=src('region/RegionJourneyAdapter.ts');
const prep=adapter.slice(adapter.indexOf('async function prepareLakesideJourney'));
let n=0,fail=0;
const t=(m,f)=>{try{f();n++;console.log('PASS',m);}catch(e){fail++;console.log('FAIL',m,'\n',e.stack||e);}};
const T=async(m,f)=>{try{await f();n++;console.log('PASS',m);}catch(e){fail++;console.log('FAIL',m,'\n',e.stack||e);}};

t('transport: skycity→lakeside is balloon; island→lakeside has no journey',()=>{
 assert.equal(Transport.JOURNEY_TRANSPORT['skycity-lakeside'],'balloon');
 assert.equal(Transport.JOURNEY_TRANSPORT['island-lakeside'],undefined);
 assert.equal(Transport.transportFor('skycity','lakeside','bridge'),'balloon');
 assert.equal(Transport.transportFor('skycity','lakeside',{__QF_TRANSPORT:'bridge'}),'balloon');
 assert.throws(()=>Transport.transportFor('island','lakeside',null),/journey-transport-unsupported/);
});
t('route order is skycity→lakeside; island and meadow cannot open the lake',()=>{
 const start=[2,6,-10],bank=[2,0.58,14];
 const flight=Balloon.lakesideBalloonPath(start,bank);
 const timing=Balloon.lakesideBalloonTiming(Core.routeLength(flight.path));
 const route={from:'skycity',to:'lakeside',path:flight.path,bridgeStart:flight.bridgeStart,bridgeEnd:flight.bridgeEnd,speed:1.2,startBlendM:0,timing};
 Core.validateJourneyRoute(route,start);
 assert.ok(Core.journeyTimingOk(Core.routeLength(flight.path),timing));
 assert.throws(()=>Core.validateJourneyRoute({...route,from:'island'},start),/journey-region-order/);
 assert.throws(()=>Core.validateJourneyRoute({...route,from:'meadow'},start),/journey-region-order/);
 const lens=Balloon.lakesideBalloonLens(bank,bank);
 assert.equal(lens.fovVerticalDeg,Balloon.LAKESIDE_BALLOON_LANDING.fovDeg);
 assert.ok(lens.position[1]>bank[1]);
});
t('lakeside nodes unlock when mainline-12 (S4) is passed, same moment as the lake chapter',()=>{
 assert.deepEqual(Nodes.REGION_ORDER,['island','meadow','skycity','lakeside']);
 const before=Nodes.derive({completed:Nodes.MAINLINE_STAGE_IDS.slice(0,11)},null);
 assert.equal(before.nodes.S4,'playable');
 assert.equal(before.nodes.L0,'locked');
 assert.equal(before.nodes.L1,'locked');
 assert.equal(before.explore.lakeside,false);
 const after=Nodes.derive({completed:Nodes.MAINLINE_STAGE_IDS.slice()},null);
 assert.equal(after.nodes.S4,'passed');
 assert.equal(after.nodes.L0,'passed');
 assert.equal(after.nodes.L1,'playable');
 assert.equal(after.explore.lakeside,true);
 assert.equal(after.lastPassed.lakeside,'L0');
 assert.equal(Nodes.lakesideDeparture().nextRegion,'lakeside');
 assert.equal(Nodes.lakesideDeparture().from,'S4');
 const old=Nodes.readPresentation(JSON.stringify({v:1,lastNode:{island:'I2'},exploreHintSeen:[true,false,false]}),after);
 assert.equal(old.exploreHintSeen.length,3);
 assert.equal(old.lastNode.lakeside,'L0');
 assert.match(src('regional-r05/runtime/progress-journal.js'),/LAKE_GATE_RECORD=11/);
 assert.match(src('ui/IslandPanels.ts'),/LAKE_GATE_RECORD = 11/);
 assert.match(src('ui/IslandPanels.ts'),/CHAPTERS\[region\]\?\.id === 'lake' \? LAKE_GATE_RECORD \+ 1/);
});
t('production path has no ?lakeside=1 switch and no lakeside bridge strip',()=>{
 assert.equal(fs.existsSync(S+'region/LakesideReach.ts'),false);
 assert.doesNotMatch(src('WorldIntegrationBoot.ts'),/lakesideReachEnabled|previewLakesideReach|\?lakeside=1/);
 assert.doesNotMatch(src('world-r2/WorldNativeComposition.ts'),/lakesideReachEnabled|previewLakesideReach|lakesideSideOrder/);
 assert.doesNotMatch(src('world-r1/WorldFlowCore.ts'),/lakesideReachQueryOn|LakesideReach/);
 assert.doesNotMatch(src('world-r1/RegionJourneyCore.ts'),/lakesideReachQueryOn|LakesideReach/);
 assert.match(src('world-r1/WorldFlowCore.ts'),/this\.stable==='island'\|\|this\.stable==='meadow'\|\|this\.stable==='skycity'/);
 assert.match(prep,/awaitVehicle\(\{kind:'balloon'/);
 assert.match(prep,/loadTransitPrefab\('transport_balloon'\)/);
 assert.match(prep,/stepTransitClock/);
 assert.match(prep,/const M5C=TRANSITION_STAGING\.skyMooring5a,L=lakesideJourney\(continuousTransitions\(\)&&M5C\.option==='C'\?\[\.\.\.M5C\.walkWorld\[0\]\] as Vec:start\);model\.setRotationFromEuler\(0,L\.yawDeg,0\);model\.setWorldPosition\(L\.root\[0\],L\.root\[1\],L\.root\[2\]\);/);
 assert.match(adapter,/if\(to==='lakeside'\)return prepareLakesideJourney\(/);
 assert.doesNotMatch(adapter,/from==='lakeside'&&to==='meadow'/);
});

function flowHarness(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lakeside-flow-'));
 fs.writeFileSync(path.join(dir,'WindWipeCore.js'),ts.transpileModule(fs.readFileSync(S+'world-r2/WindWipeCore.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText.replace('"../world-r1/ScreenCover"','"./ScreenCover"'));
 for(const name of ['CameraPose','WorldFlowCore','RegionJourneyCore','ScreenCover']){
  fs.writeFileSync(path.join(dir,name+'.js'),ts.transpileModule(fs.readFileSync(S+'world-r1/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText.replace('"../world-r2/WindWipeCore"','"./WindWipeCore"').replace(/"\.\.\/region\//g,'"./'));
 }
 for(const name of ['TransitionChain','TransitionCamera','EngineAnimStop'])fs.writeFileSync(path.join(dir,name+'.js'),ts.transpileModule(fs.readFileSync(S+'region/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)/* transitions-continuous deps */;
 const {WorldFlow}=require(path.join(dir,'WorldFlowCore'));
 const J=require(path.join(dir,'RegionJourneyCore'));
 const start=[0,0,3],bank=[0,0.58,23];
 const flight=Balloon.lakesideBalloonPath(start,bank);
 const timing=Balloon.lakesideBalloonTiming(J.routeLength(flight.path));
 const route={from:'skycity',to:'lakeside',path:flight.path,bridgeStart:flight.bridgeStart,bridgeEnd:flight.bridgeEnd,speed:1.2,startBlendM:0,timing};
 J.validateJourneyRoute(route,start);
 let prepares=0;
 const seat={position:[0,0,0],back:[0,0,-1],yawRad:0,seatedFoot:[0,0,0],standingFoot:[0,0,0],seatedControllerRoot:[0,0,0],standingControllerRoot:[0,0,0]};
 const pose={position:[3,3,-6],target:[0,1,0]};
 const config={seat,toDoor:[[0,0,0],[0,0,1]],outCrossing:[[0,0,1],[0,0,2]],toIsland:[[0,0,2],start],toThreshold:[[0,0,3],[0,0,2]],inCrossing:[[0,0,2],[0,0,1]],toSeat:[[0,0,1],[0,0,0]],cameraHome:pose,cameraToDoor:[pose,pose],cameraInside:pose,cameraOutside:pose,cameraIsland:pose,openDeg:90,speed:1};
 const actor={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:[0,0,0],seatedRoot:[0,0,0],seatYawRad:0,clearanceRadiusM:.1},advance(){},walkProgress(){return 1;},perform(){return Promise.resolve();},cancelAndReset(){},setVisible(){},dispose(){}};
 const world={setCamera(){},setLayers(){},setDoor(){},cancelTransient(){},assertStaticWorld(){},dispose(){},animateCamera:async()=>{},animateDoor:async()=>{},setRoomLightWeight(){},setExteriorKey(){}};
 const adapter={readCamera:()=>pose,async prepare(from,to,at,token,progress){prepares++;assert.equal(from,'skycity');assert.equal(to,'lakeside');assert.deepEqual(at,start);progress(1);return {route,show(){},dispose(){},ride:async(a)=>a.cancelAndReset({kind:'standing',controllerRoot:bank,yawRad:Math.PI})};}};
 const controller=new J.RegionJourneyController(adapter);
 controller.region='skycity';
 const levels={enter:async()=>({requestExit:()=>({ok:true}),hide(){},showPaused(){},resume:()=>({ok:true}),dispose(){},isSettledResult:()=>true})};
 const flow=new WorldFlow({config,character:actor,journey:controller,levels,loadWorld:async()=>world});
 return {flow,controller,get prepares(){return prepares;},bank,route};
}

(async()=>{
 await T('WorldFlow skycity→lakeside, revisit skips a second ride, background restore keeps the lake',async()=>{
  const h=flowHarness();
  assert.equal((await h.flow.load()).ok,true);
  h.flow.stable='skycity';h.flow.state='skycity';
  assert.equal((await h.flow.prepareRegion('lakeside')).ok,true,'skycity can preload its lakeside departure');
  const gone=await h.flow.travelRegion('lakeside');
  assert.equal(gone.ok,true,JSON.stringify(gone));
  assert.equal(h.flow.snapshot().state,'lakeside');
  assert.equal(h.flow.snapshot().stable,'lakeside');
  assert.equal(h.flow.snapshot().journey.region,'lakeside');
  assert.equal(h.prepares,1);
  const root=h.controller.position().controllerRoot.slice();
  assert.deepEqual(root,h.bank);
  const again=await h.flow.travelRegion('lakeside');
  assert.equal(again.ok,true);
  assert.equal(h.prepares,1,'revisit does not prepare another balloon');
  assert.equal(h.flow.snapshot().journey.region,'lakeside');
  h.flow.hide();
  assert.equal(h.flow.snapshot().needsResume,true);
  assert.equal(h.flow.snapshot().stable,'lakeside');
  assert.deepEqual(h.controller.position().controllerRoot,root);
  h.flow.show();
  assert.equal(h.flow.snapshot().hidden,false);
  assert.equal(h.flow.snapshot().stable,'lakeside');
  assert.equal(h.flow.resume().ok,true);
  assert.equal(h.flow.snapshot().state,'lakeside');
  assert.equal(h.flow.snapshot().journey.region,'lakeside');
  assert.deepEqual(h.controller.position().controllerRoot,root);
  assert.equal((await h.flow.enterLevel('r04-lake-01')).ok,true);
  assert.equal(h.flow.snapshot().state,'level');
  assert.equal(h.flow.exitLevel().ok,true);
  assert.equal(h.flow.snapshot().state,'lakeside');
  assert.equal(h.flow.snapshot().stable,'lakeside');
  assert.deepEqual(h.controller.position().controllerRoot,root);
 });
 console.log(fail?`FAIL ${fail}`:`lakeside reach OK ${n}`);
 process.exit(fail?1:0);
})();
