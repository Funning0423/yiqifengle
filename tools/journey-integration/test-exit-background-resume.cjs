'use strict';
// V1 (a4a1041 Mac re-check): backgrounding during the home exit cancelled it (exit-cine cancel:left-exit) and left her
// seated behind 「继续」. r4.1: hide() now freezes the exit in place and show() continues it by itself (no 继续); the
// frame-exact freeze (position / clip time / audio) is locked by test-world-background-freeze. This keeps the V1 contract:
// back from background mid-exit = no 继续, the exit still reaches the island; seated / island backgrounds unchanged.
const assert=require('node:assert/strict'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),{WorldFlow,EXIT_STATES}=H.load('world-r1/WorldFlowCore');
const pose={position:[3,3,-6],target:[0,1,0]},zero=[0,0,0],seat={position:zero,back:[0,0,-1],yawRad:0,seatedFoot:zero,standingFoot:zero,seatedControllerRoot:zero,standingControllerRoot:zero};
const config={seat,toDoor:[zero,[0,0,1]],outCrossing:[[0,0,1],[0,0,2]],toIsland:[[0,0,2],[0,0,3]],toThreshold:[[0,0,3],[0,0,2]],inCrossing:[[0,0,2],[0,0,1]],toSeat:[[0,0,1],zero],cameraHome:pose,cameraToDoor:[pose,pose],cameraInside:pose,cameraOutside:pose,cameraIsland:pose,openDeg:90,speed:1};
const flush=()=>new Promise(r=>setImmediate(r));
function make(){let hold=null;const states=[];
 const actor={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:zero,seatedRoot:zero,seatYawRad:0,clearanceRadiusM:.1},advance(){},walkProgress:()=>1,
  perform:async(action,token)=>{if(action.kind==='walk'&&hold){await new Promise((res,rej)=>{hold.release=res;token?.onCancel?.(()=>rej(new Error('cancelled')));});}},
  cancelAndReset(){},setVisible(){},dispose(){}};
 const world={setCamera(){},setLayers(){},setDoor(){},cancelTransient(){},assertStaticWorld(){},dispose(){},animateCamera:async()=>{},animateDoor:async()=>{}};
 const flow=new WorldFlow({config,character:actor,skycity:{enter:async()=>({show(){},hide(){},dispose(){}})},levels:{enter:async()=>({requestExit:()=>({ok:true}),hide(){},showPaused(){},resume:()=>({ok:true}),dispose(){}})},loadWorld:async()=>world});
 flow.subscribe?.(s=>states.push(s.state));
 return {flow,states,holdWalks:()=>{hold={};return hold;}};}
const until=async(f,n=2000)=>{for(let i=0;i<n;i++){if(f())return;await flush();}throw Error('timeout');};
(async()=>{
 assert.deepEqual([...EXIT_STATES],['standing','turning-out','walking-out','opening-door','crossing-out']);
 for(const at of ['walking-out','crossing-out']){
  const x=make();assert((await x.flow.load()).ok);assert.equal(x.flow.snapshot().state,'home');
  const h=x.holdWalks();
  if(at==='crossing-out'){// let the first walk (to the door) pass, hold the outdoor one
   const p=x.flow.leaveHome();await until(()=>h.release);h.release();h.release=null;await until(()=>h.release&&x.flow.snapshot().state==='crossing-out');
   x.flow.hide();await p.catch(()=>{});
  }else{const p=x.flow.leaveHome();await until(()=>x.flow.snapshot().state==='walking-out'&&h.release);x.flow.hide();await p.catch(()=>{});}
  let s=x.flow.snapshot();assert.equal(s.state,'paused');assert.equal(s.needsResume,true);assert.equal(s.stable,'home');
  x.flow.show();s=x.flow.snapshot();
  assert.equal(s.needsResume,false,'foreground needs no 继续');assert.equal(s.hidden,false);assert(EXIT_STATES.includes(s.state)||s.state==='island','exit continues: '+s.state);
  // finish the restarted exit
  for(let i=0;i<20&&x.flow.snapshot().state!=='island';i++){await until(()=>h.release||x.flow.snapshot().state==='island');if(h.release){const r=h.release;h.release=null;r();}}
  assert.equal(x.flow.snapshot().state,'island','exit reaches the island after a background trip at '+at);
  console.log('PASS background during',at,'-> exit continued, reached island');
 }
 // Backgrounding while seated (no exit running) keeps the old paused + resume behaviour.
 {const x=make();assert((await x.flow.load()).ok);x.flow.hide();x.flow.show();const s=x.flow.snapshot();assert.equal(s.needsResume,true);assert.equal(s.state,'paused');
  assert(x.flow.resume().ok);assert.equal(x.flow.snapshot().state,'home');console.log('PASS seated background unchanged');}
 // Backgrounding on the island after the exit does not replay it.
 {const x=make();assert((await x.flow.load()).ok);assert((await x.flow.leaveHome()).ok);x.flow.hide();x.flow.show();assert.equal(x.flow.snapshot().needsResume,true);assert(x.flow.resume().ok);assert.equal(x.flow.snapshot().state,'island');console.log('PASS island background unchanged');}
})().catch(e=>{console.error(e);process.exit(1);});
