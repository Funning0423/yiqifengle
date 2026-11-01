#!/usr/bin/env node
'use strict';
/* skyfix follow-up (Grok Bot: no one-frame flicker when the result board under the T-02 finale closes).
 * Frame-by-frame claim → board close → held finale view → auto-continue (3.4 s) → walk hand-off, with the REAL WorldFlow
 * (WorldFlowCore: exitLevel / exitLevelInPlace / restore) and the real WorldNativeComposition + SkyLakeRegister. Recorded per
 * rendered frame: world camera pose, world layers, board opacity/visibility, her visibility / resets. Asserts until the hand-off:
 * camera == held T-02 pose, layers never change (never blank), she is never reset/hidden, board opacity changes gradually. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/',src=f=>fs.readFileSync(S+f,'utf8');
const {createHarness}=require('../board-ui/harness.cjs');
const DT=1/60,HELD={position:[10,20,30],target:[11,20,31],fovVerticalDeg:48},SKY='SKYCITY_LAYERS',MAX_ALPHA_STEP=32;
(async()=>{
 const h=createHarness({debug:true}),WF=h.load('world-r1/WorldFlowCore'),C=h.load('world-r2/WorldNativeComposition').WorldNativeComposition;
 const SR=h.load('region/SkyLakeRegister'),SD=h.load('region/SkyFinaleDeparture');
 const cp=h.load('world-r2/RegionFlowTest').createRegionFlowCheckpoint(12),ctl=cp.mainline.createController();
 assert(ctl.resume().ok);const pv=ctl.previewAction(cp.lastAction);assert(pv.ok);assert(ctl.commitAction(pv.token).ok);
 while(ctl.snapshot().visual)assert(ctl.finishVisualStep(ctl.snapshot().visual.token).ok);
 // render state the frames sample
 const R={camWrites:[],cam:HELD,layers:SKY,charVisible:true,charResets:0,board:{visible:true,opacity:255}};const tickers=new Set();const ev=[];
 const world={cancelTransient(){},setDoor(){},setLayers(l){R.layers=l;},setRoomLightWeight(){},setExteriorKey(){},setCamera(p){R.cam=p;if(!handoff)R.camWrites.push(p);},assertStaticWorld(){}};
 const lease={requestExit:()=>({ok:true}),hide(){},showPaused(){},resume:()=>({ok:true}),dispose(){R.board.visible=false;ev.push(['boardDisposed']);}};
 if(typeof WF.boardFadeOpacity==='function')lease.fadeOut=(s)=>new Promise(res=>{const a0=R.board.opacity;let t=0;const tick=()=>{t+=DT;R.board.opacity=WF.boardFadeOpacity(a0,t,s);if(t>=s){tickers.delete(tick);res();}};tickers.add(tick);});
 const journey={hasCheckpoint:()=>true,position:()=>({kind:'standing',controllerRoot:[0,0,0],yawRad:0}),snapshot:()=>({region:'skycity',target:null,phase:'arrived'}),
  restore(actor,w,vis){if(!actor.__qfWalkTail)actor.cancelAndReset();w.setCamera({position:[0,5,0],target:[0,5,1],fovVerticalDeg:55});actor.setVisible(vis);}};
 const character={setVisible(v){R.charVisible=v;},cancelAndReset(){R.charResets++;}};
 const flow=Object.create(WF.WorldFlow.prototype);
 Object.assign(flow,{state:'level',stable:'level',mode:'fixed',hidden:false,needsResume:false,error:null,current:null,world,level:lease,character,
  config:{openDeg:0},journey,levelOrigin:'skycity',visit:null,emit:()=>{},cameraListeners:new Set(),wind:0,windListeners:new Set(),doorShutListeners:new Set(),doorShutSent:false});
 flow.characterReady=()=>true;
 const c=new C();c.mainline=cp.mainline;c.persistence=cp.r5;
 c.world={commands:()=>({snapshot:()=>flow.snapshot(),exitLevel:()=>flow.exitLevel(),
  ...(typeof flow.exitLevelInPlace==='function'?{exitLevelInPlace:f=>flow.exitLevelInPlace(f)}:{}),
  async travelRegion(to){ev.push(['travel',to]);handoff=true;return {ok:true};},async enterLevel(id){ev.push(['enter',id]);return {ok:true};}})};
 c.mainlineReward=()=>({ok:true});c.activeSession={snapshot:()=>({provider:'mainline-v33',active:{stageId:'mainline-12',level:12}})};
 c.boundCharacter=character;
 let clock=0,handoff=false;
 const st={region:'skycity',exploring:true,finaleApproachS:1.4,arm:null,departAt:0,
  finaleEndCamera(){return {position:HELD.position,rotation:[0,0,0,1],fovVerticalDeg:48,velocity:[0,0,0],angularVelocityDegS:0,at:0};},
  bindCharacter(){},async playFinale(){},holdFinaleView(){R.cam=HELD;return true;},
  armFinaleContinue(go){this.arm={at:clock,go};return true;},disarmFinale(){this.arm=null;},markFinaleDeparture(){this.arm=null;this.departAt=clock||1e-9;},
  tick(){const a=this.arm;if(a&&clock-a.at>=SD.finaleAutoContinueAtS(this.finaleApproachS)-1e-9){this.arm=null;a.go();}}};
 c.stage=()=>st;SR.registerSkyLakeContinuous(c);globalThis.__QF_TRANSITION_FALLBACK={count:0,events:[]};
 const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
 const frames=[];const render=()=>frames.push({t:+clock.toFixed(3),cam:R.cam,layers:R.layers,alpha:R.board.visible?R.board.opacity:0,charVisible:R.charVisible,charResets:R.charResets,state:flow.snapshot().state,handoff});
 for(let i=0;i<10;i++){clock+=DT;render();}
 const claim=c.claimRegionAndWalk(3);await flush();render();await claim;
 for(let i=0;i<60*4.5&&!handoff;i++){clock+=DT;for(const t of [...tickers])t();st.tick();await flush();render();}
 const pre=frames.filter(f=>!f.handoff),bad=[];
 for(let i=0;i<pre.length;i++){const f=pre[i];
  if(f.cam!==HELD&&JSON.stringify(f.cam)!==JSON.stringify(HELD))bad.push(['camera',f.t,f.cam]);
  if(f.layers!==SKY)bad.push(['layers',f.t,String(f.layers)]);
  if(!f.charVisible||f.charResets)bad.push(['her',f.t,f.charVisible,f.charResets]);
  if(i&&Math.abs(f.alpha-pre[i-1].alpha)>MAX_ALPHA_STEP)bad.push(['boardJump',f.t,pre[i-1].alpha+'→'+f.alpha]);}
 const out={frames:frames.length,preHandoff:pre.length,handoffAt:frames.find(f=>f.handoff)?.t??null,boardGoneAt:pre.find(f=>f.alpha===0)?.t??null,stateAfterClaim:frames[11]?.state,intermediateCameraWrites:R.camWrites.length,fallback:globalThis.__QF_TRANSITION_FALLBACK.count,bad:bad.slice(0,6),badCount:bad.length};
 let ok=true;const chk=(m,c2)=>{console.log((c2?'PASS ':'FAIL ')+m);if(!c2)ok=false;};
 chk('hand-off reached (auto-continue at 3.4 s → travel lakeside)',!!out.handoffAt&&ev.some(e=>e[0]==='travel'&&e[1]==='lakeside'));
 chk('camera == held T-02 pose on every frame before the hand-off',!bad.some(b=>b[0]==='camera'));
 chk('no intermediate camera write at all (not even one overwritten in the same frame)',R.camWrites.every(p=>JSON.stringify(p)===JSON.stringify(HELD)));
 chk('world layers unchanged (never blank / island) on every frame',!bad.some(b=>b[0]==='layers'));
 chk('she is never reset or hidden',!bad.some(b=>b[0]==='her'));
 chk('board leaves gradually (≤ '+MAX_ALPHA_STEP+'/255 per frame) and is gone before the hand-off',!bad.some(b=>b[0]==='boardJump')&&out.boardGoneAt!==null);
 chk('state skycity right after the claim (继续旅程 can show)',out.stateAfterClaim==='skycity');
 chk('fallback count 0',out.fallback===0);
 chk('native lease fades with boardFadeOpacity per drawn frame; facade exposes exitLevelInPlace',/boardFadeOpacity\(a0,t,seconds\)/.test(src('world-r2/NativeWorldLevelAdapter.ts'))&&/exitLevelInPlace:\(fadeS\?:number\)=>flow\(\)\.exitLevelInPlace\(fadeS\)/.test(src('world-r1/WorldFlowComponent.ts')));
 console.log(JSON.stringify({status:ok?'PASS':'FAIL',...out}));process.exit(ok?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
