'use strict';
// b17r10 memory: arriving at a region disposes journey legs older than the departure leg (island→meadow sail is gone on
// the lakeside board; meadow→skycity balloon stays as skycity→lakeside's departure stage). 「主页」 still drops all.
const assert=require('node:assert/strict'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),file=n=>path.resolve(__dirname,'../../creator-build-project/assets/scripts/world-r1/'+n+'.ts');
const {RegionJourneyController}=H.load(file('RegionJourneyCore')),{Cancellation}=H.load(file('WorldFlowCore'));
const start=[1,2,3],camera={position:[4,6,-4],target:[1,3,3],fovVerticalDeg:45};
const made=[];function lease(from,to){const l={route:{from,to,path:[start,[3,2,3],[7,3,3],[9,3,3]],bridgeStart:2,bridgeEnd:Math.sqrt(17)+2,speed:1},disposed:0,show(){},dispose(){l.disposed++;},ride:async()=>{}};made.push(l);return l;}
(async()=>{
 const c=new RegionJourneyController({prepare:async(f,t)=>lease(f,t),readCamera:()=>structuredClone(camera)});
 const world={setCamera(){}},actor={walkProgress:()=>1,perform:async()=>{},cancelAndReset(){},setVisible(){}};
 const leg=async to=>{await c.prepare(to,start,new Cancellation());await c.walk(actor,world,new Cancellation());assert.equal(c.snapshot().region,to);};
 await leg('meadow');assert.deepEqual(made.map(l=>l.disposed),[0]);
 await leg('skycity');assert.deepEqual(made.map(l=>l.disposed),[0,0],'meadow leg kept: it is the balloon departure');
 await leg('lakeside');assert.deepEqual(made.map(l=>l.disposed),[1,0,0],'island→meadow (meadow scene + SailArt) released on lakeside arrival');
 c.returnToIsland();assert.deepEqual(made.map(l=>l.disposed),[1,1,1],'home drops the rest, no double dispose');
 console.log('PASS journey-prune (lakeside keeps 2 legs, not 3)');
})().catch(e=>{console.error(e);process.exit(1);});
