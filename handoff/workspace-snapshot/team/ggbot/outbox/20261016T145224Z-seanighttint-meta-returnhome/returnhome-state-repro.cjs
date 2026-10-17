'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const filename=path.resolve('/tmp/wtAF/creator-build-project/assets/scripts/world-r1/WorldFlowCore.ts');
const original=fs.readFileSync(filename,'utf8');
let js=require('/tmp/ggts/node_modules/typescript').transpileModule(original,{compilerOptions:{target:99,module:99}}).outputText.replace(/import \{ CameraTrackFailure \} from '\.\/CameraPose';/, 'class CameraTrackFailure extends Error {}').replace(/\bexport\s+/g,'');
const ctx={};vm.runInNewContext(js+'\nthis.api={WorldFlow,Cancellation};',ctx,{filename});const {WorldFlow}=ctx.api;
const results=[];const test=async(name,fn)=>{await fn();results.push({name,pass:true});};
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
function fixture(enter){const zero=[0,0,0],one=[0,0,1],pose={position:[0,2,3],target:zero};const seat={position:zero,back:zero,yawRad:0,seatedFoot:zero,standingFoot:zero,seatedControllerRoot:zero,standingControllerRoot:zero};const calls={visible:[],layers:[],dispose:0,levels:0,camera:0,pose:0};const config={seat,toDoor:[zero,one],outCrossing:[one,one],toIsland:[one,one],toThreshold:[one,one],inCrossing:[one,one],toSeat:[one,zero],cameraHome:pose,cameraToDoor:[pose,pose],cameraInside:pose,cameraOutside:pose,cameraIsland:pose,openDeg:60,speed:1};const world={setLayers:x=>calls.layers.push(x),setDoor(){},setCamera(){calls.camera++;},animateDoor:async()=>{},animateCamera:async()=>{},cancelTransient(){},assertStaticWorld(){},dispose(){calls.dispose++;}};const character={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:zero,seatedRoot:zero,seatYawRad:0,clearanceRadiusM:.15},advance(){},perform:async()=>{},cancelAndReset(){calls.pose++;},setVisible:v=>calls.visible.push(v),dispose(){}};const f=new WorldFlow({config,character,skycity:enter?{enter}:undefined,levels:{enter:async()=>{calls.levels++;return {requestExit:()=>({ok:true}),dispose(){}};}},loadWorld:async()=>world});return {f,calls};}
(async()=>{const x=fixture();await x.f.load();await x.f.leaveHome();
 x.f.options&&0;const lvl={requestExit:()=>({ok:true}),dispose(){}};
 const L=x.f;
 const e=await L.enterLevel('mainline-09');console.log('enterLevel',JSON.stringify(e),'state',L.snapshot().state);
 const r=await L.returnHome();console.log('returnHome while in level ->',JSON.stringify(r),'state',L.snapshot().state);
 const ex=L.exitLevel();console.log('exitLevel',JSON.stringify(ex),'state',L.snapshot().state);
 const r2=await L.returnHome();console.log('returnHome from island ->',JSON.stringify(r2),'state',L.snapshot().state);})().catch(e=>console.log('ERR',e));
