'use strict';
// full9b (运镜bot review of BalloonTransit.ts:657/665/686): with the single-writer rule the flight lens is written by the before-draw
// hook; the driver step writes only on its last frame. Risk checked here: a ?balloonAt= hold (hold!=null) never reaches the end
// condition, so the hook must stay registered for the whole hold, and a pause (ticks stop, draws continue) or background/foreground
// cycle during the hold must not leave the lens unwritten. Guards are read FROM SOURCE and evaluated in a frame model.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.QF_JOURNEY_SOURCE_ROOT||path.resolve(__dirname,'../..');
const src=fs.readFileSync(root+'/creator-build-project/assets/scripts/region/BalloonTransit.ts','utf8');
const res=[];const t=(id,f)=>{try{const r=f()||{};res.push({id,status:'PASS',...r});}catch(e){res.push({id,status:'FAIL',error:String(e.message).slice(0,240)});}};
const relLine=(src.match(/\n\s*const release=\(\)=>\{if\(dead\)return;dead=true;[^\n]*/)||[''])[0];/* lease dispose: the hook goes with the scene */
const offs=[...src.replace(relLine,'').matchAll(/director\.off\(Director\.EVENT_BEFORE_DRAW,beforeDraw\)/g)].length;
const endM=src.match(/if\(([^{}]*?)\)\{off\(\);director\.off\(Director\.EVENT_BEFORE_DRAW,beforeDraw\);driver\.step=\(\)=>\{\};ok\(\);\}/);
const tickM=src.match(/const t=apply\(([^;]*?)\)(?:\/\*[^*]*\*\/)?;if\(inflateT/);
const drawM=src.match(/beforeDraw=\(\)=>\{if\(!dead\)\{apply\(\);/);
t('hook removed only at the ride end (guard needs hold==null)',()=>{assert.ok(relLine.length>0,'release() found');assert.equal(offs,1,'exactly one director.off(beforeDraw) outside release()');assert.ok(endM&&/hold==null/.test(endM[1]),'end guard '+(endM&&endM[1]));return {endGuard:endM[1]};});
t('before-draw writes the lens unconditionally',()=>{assert.ok(drawM,'beforeDraw → apply() (writeCam default true)');});
t('tick writes exactly when the hook is removed that frame',()=>{assert.ok(tickM,'tick apply(arg)');const a=tickM[1];assert.ok(/hold==null/.test(a)&&/plan\.total/.test(a),'tick arg '+a);return {tickArg:a};});
t('frame model: hold through pause + background/foreground',()=>{
 const plan={total:36},rideToFlightT=x=>x;let hold=12,clockT=0,hookOn=true,writes=[],frame=0;
 const endF=new Function('t','plan','hold','return ('+endM[1]+');'),tickF=new Function('clock','plan','hold','rideToFlightT','return ('+tickM[1]+');');
 const tick=dt=>{clockT=Math.min(hold??1e9,clockT+dt);const w=tickF({t:clockT},plan,hold,rideToFlightT);const tt=Math.min(plan.total,clockT);if(w)writes.push([frame,'tick']);if(endF(tt,plan,hold))hookOn=false;};
 const draw=()=>{if(hookOn)writes.push([frame,'draw']);};
 const run=(n,{ticks=true,draws=true}={})=>{for(let i=0;i<n;i++){frame++;if(ticks)tick(1/30);if(draws)draw();}};
 run(600);/* 20 s: clock reaches the 12 s hold and stays */
 run(90,{ticks:false});/* director paused: no ticks, draws continue */
 run(120,{ticks:false,draws:false});/* background: nothing */
 run(300);/* foreground */
 const per={};for(const [f] of writes)per[f]=(per[f]||0)+1;const drawn=Object.keys(per).length,multi=Object.values(per).filter(n=>n>1).length;
 assert.ok(hookOn,'hook still registered during the hold');assert.equal(multi,0,'one writer per frame');assert.equal(drawn,600+90+300,'every drawn frame written (none frozen)');
 hold=null;run(900);assert.ok(!hookOn,'released hold ends the ride and removes the hook');
 return {framesWritten:drawn,multiWriterFrames:multi};});
const status=res.every(r=>r.status==='PASS')?'PASS':'FAIL';console.log(JSON.stringify({test:'balloon-hold-writer',status,results:res},null,1));process.exit(status==='PASS'?0:1);
