'use strict';
// sail-blue (Mac d3fe578e night, frames 26-29: beach close-up → 1 blank frame → island wide): frame-by-frame set-off from the
// departure node walk into the continuous sail. Every rendered frame must show the world/journey (never only the clear colour)
// and the lens must not teleport on frame 1 of the ride. Harness-compiled controller + source checks for the cc-side wiring.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),J=H.load('world-r1/RegionJourneyCore.ts');
const ROOT=path.resolve(__dirname,'../..'),src=f=>fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts',f),'utf8');
const PARK={position:[-12,15.5,48],target:[1,.5,1],fovVerticalDeg:42}/* cameraIsland, where the world lens is parked in the level */;
const CLOSE={position:[-0.4,4.1,4.6],target:[-1.6,0,9.6],fovVerticalDeg:48}/* departure walk follow lens at I6 (frame 26) */;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
(async()=>{
 let live=PARK;const frames=[];let layersOn=false,journeyShown=false,resets=0,resetsAtRide=-1,lastReset=null,resetAtRide=null;
 const render=tag=>frames.push({tag,cam:live,visible:layersOn||journeyShown});
 const lease={route:{from:'island',to:'meadow',path:[[0,0,0],[0,0,5]],bridgeStart:1,bridgeEnd:2,speed:1.2,startBlendM:0},
  startPose:()=>({position:[0,2,-3],target:[0,1,0],fovVerticalDeg:48}),show(v){journeyShown=v;},dispose(){},ready:()=>true,
  ride:async(a,w)=>{resetsAtRide=resets;resetAtRide=lastReset;let ft=1e6;const P=globalThis.performance;Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>ft}});
   try{for(let i=0;i<90;i++){ft+=1000/60;const u=Math.min(1,i/90);w.setCamera({position:[CLOSE.position[0]*(1-u)+2*u,CLOSE.position[1],CLOSE.position[2]*(1-u)+20*u],target:[-1.6,0,9.6+u*5],fovVerticalDeg:48});render('ride'+i);}}
   finally{Object.defineProperty(globalThis,'performance',{configurable:true,value:P});}}};
 const ctl=new J.RegionJourneyController({prepare:async()=>lease,readCamera:()=>live});
 const tok={cancelled:false,check(){},wait:p=>p,onCancel:()=>()=>{}};
 const world={setCamera:p=>{live=p;},wait:async()=>{render('wait');},setLayers(){}};
 const actor={walkProgress:()=>0,cancelAndReset(p){resets++;lastReset=p;},perform:async()=>{},setVisible(){}};
 globalThis.__qfContinuousTransitions=true;
 // 1 level: prepare reads the parked lens (world layers off, the board shows)
 await ctl.prepare('meadow',[0,0,0],tok);
 // 2 departure node walk on the live world (playReward handoff: layers stay ON, lens stays on her)
 layersOn=true;live=CLOSE;render('reward-end');
 // 3 exitLevel → WorldFlow.restore → journey.restore (same task), then travelRegion → walk
 assert.equal(ctl.adoptLive([-1.6,0,9.6],0),true,'adoptLive on the prepared ride');
 ctl.restore(actor,world,true);render('exit-level');
 await ctl.walk(actor,world,tok);
 for(const f of frames)assert.ok(f.visible,'frame '+f.tag+' shows only the clear colour');
 assert.deepEqual(frames[1].cam.position,CLOSE.position,'exitLevel keeps the live lens (no cut to the parked wide)');
 assert.ok(resetsAtRide<=1&&(!resetAtRide||JSON.stringify(resetAtRide.controllerRoot)===JSON.stringify([-1.6,0,9.6])),'no snap back to the prepare-time stand: '+JSON.stringify(resetAtRide));
 const i0=frames.findIndex(f=>f.tag==='ride0');assert.ok(dist(frames[i0].cam.position,CLOSE.position)<0.2,'ride frame 1 starts on the live lens: '+dist(frames[i0].cam.position,CLOSE.position));
 let maxStep=0;for(let i=1;i<frames.length;i++)maxStep=Math.max(maxStep,dist(frames[i].cam.position,frames[i-1].cam.position));
 assert.ok(maxStep<0.6,'no camera teleport: max step '+maxStep);
 // 4 wiring: departure walk hands off (no blend back, no layer-off), composition passes the flag, sail skips the second I4→I6
 const st=src('world-r2/RegionNodeStage.ts'),rel=st.slice(st.indexOf('private releaseForJourney'),st.indexOf('async playFinale'));
 assert.ok(/if\(handoff&&spec\.departure\)\{this\.releaseForJourney\(\);return;\}/.test(st),'playReward handoff');
 assert.ok(rel.length>0&&!rel.includes('presentNodeWalkWorld(false)')&&!rel.includes('setVisible(false)'),'handoff keeps world + girl on');
assert.ok(src('world-r2/WorldNativeComposition.ts').includes("if(route.requiresTravel&&typeof continuousTransitions==='function'&&continuousTransitions())this.adoptLiveForJourney();"));
 assert.ok(src('world-r2/WorldNativeComposition.ts').includes("presentNodeWalk(s,!!route.requiresTravel&&typeof continuousTransitions==='function'&&continuousTransitions())"));
 assert.ok(src('region/SailRide.ts').includes('if(!atI6)await walk(plan.approach'));
 // 5 black-shape P2: sail placeholders never outlive the sail leg, are skipped when real b19 models exist, never night-dimmed
 const sr=src('region/SailRide.ts'),ad=src('region/RegionJourneyAdapter.ts'),bt=src('region/BalloonTransit.ts');
 assert.ok(/await until\(plan\.total\);\n sailPropsOff\(plan\.props\)/.test(sr),'props off at sail end');
 assert.ok(sr.includes("hasRealNode(rider.scene,'island_dock')")&&sr.includes("hasRealNode(rider.scene,'sail_gangway_hinge')"),'late real models win');
 assert.ok(ad.includes("ramp:dockReal?null:placeholderPlank(rig,'island_dock_ramp'"),'ramp tracked')/* cand7: reconciled with the b19 dock-model path (placeholderPlank, real model wins) */;
 assert.ok(/island_dock\|island_dock_ramp\|sail_gangway\|sail_gangway_meadow\|sail_frozen_pose/.test(bt),'night silhouette skips placeholders');
 console.log(JSON.stringify({ok:true,frames:frames.length,maxStepM:+maxStep.toFixed(3)}));
})().catch(e=>{console.error(e);process.exit(1);});
