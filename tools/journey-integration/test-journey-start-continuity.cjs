#!/usr/bin/env node
'use strict';
/* 04→05 set-off continuity (Oi review 16:05Z; Grok Bot 2026-10-16: the startBlendM=0 hard cut is not acceptable).
 * v3.3: journeyCamera eases from the live island lens onto the follow pose over JOURNEY_CAMERA.setOffEaseM (0.78 m =
 * 0.65 s at 1.2 m/s, smootherstep: zero velocity and acceleration at both ends). Sampled per 60 fps frame at route speed.
 *  K1 post-set-off unchanged: for d ≥ setOffEaseM the lens equals the d238881 (startBlendM 0) poses pinned below; continuous,
 *     view turn ≤ 20°/s, FOV 48 on [setOffEaseM, 10 m];
 *  K2 no cut: d=0 is the live lens exactly; per-frame position step ≤ 2.5 m and changes smoothly (frame-to-frame step change
 *     ≤ 0.2 m = the smootherstep bound 5.77·50.7 m/0.65² s²); position, view and FOV rates are ~0 at both ends of the ease; FOV monotone 42→48, ≤ 0.35°/frame;
 *  K2b turn rate during the ease is REPORTED, not held to 20°/s: the hand-over turns 132° and moves 50.7 m; at ≤ 20°/s it
 *     needs ≥ 15 m of ease, and every such variant (blend 18; linear ease 4/8/12/16 m) loses her right-side/in-frame/
 *     unoccluded rules (F7/F2/O1, see README). Pinned so a change is deliberate;
 *  K3 control: default blend (startBlendM>0, 08→09) starts exactly on the live lens; K4 wiring. Geometry only. */
const fs=require('fs'),assert=require('assert/strict');const S=require('./journey-scene.cjs');const {legs,journeyCamera,L,JOURNEY_CAMERA:C}=S;
const results=[];const check=(id,fn)=>{try{results.push({id,status:'PASS',...fn()});}catch(e){results.push({id,status:'FAIL',error:String(e.stack||e)});}};
const dir=p=>{const v=p.target.map((x,i)=>x-p.position[i]),l=Math.hypot(...v);return v.map(x=>x/l);},ang=(a,b)=>{const u=dir(a),v=dir(b);return Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1]+u[2]*v[2])))*180/Math.PI;},dp=(a,b)=>Math.hypot(...a.position.map((x,i)=>x-b.position[i]));
const leg=legs[0],cam=(d,b=0)=>journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,b),E=C.setOffEaseM,FR=L.speedMps/60;
// d238881 startBlendM-0 poses (position, target, fov), pinned before the v3.3 change
const PIN={"0.78":[-5.233083,3.4,-0.156411,-1.848599,2.426991,7.0268,48],"0.8":[-5.225238,3.4,-0.138606,-1.844226,2.426991,7.04624,48],"1":[-5.147828,3.4,0.040089,-1.800326,2.426991,7.240608,48],"2":[-4.784309,3.4,0.947897,-1.57697,2.426991,8.211934,48],"5":[-4.246386,3.827481,3.747258,-1.296961,2.854472,11.119784,48],"10":[-3.7135,4.906931,8.408973,-1.37828,3.933922,15.998439,48],"20":[-3.7135,5.065319,18.363713,-1.37828,4.09231,25.95318,48]};
const frames=(a,b)=>{const out=[];for(let d=a;d<=b+1e-9;d+=FR)out.push({d,c:cam(Math.min(b,d))});for(let k=1;k<out.length;k++){out[k].step=dp(out[k-1].c,out[k].c);out[k].turn=ang(out[k-1].c,out[k].c)*60;out[k].dfov=out[k].c.fovVerticalDeg-out[k-1].c.fovVerticalDeg;}return out;};
const curves={};
check('K1 post-set-off unchanged vs d238881 and continuous (d ≥ setOffEaseM)',()=>{for(const [d,v] of Object.entries(PIN)){const c=cam(+d),g=[...c.position,...c.target,c.fovVerticalDeg];g.forEach((x,i)=>assert(Math.abs(x-v[i])<1e-5,`d=${d} [${i}] ${x} vs ${v[i]}`));}
 const f=frames(E,10).slice(1);const mS=Math.max(...f.map(r=>r.step)),mT=Math.max(...f.map(r=>r.turn));assert(mS<=.05,'step '+mS);assert(mT<=20,'turn '+mT);assert(f.every(r=>r.c.fovVerticalDeg===48));
 return {easeEndM:E,maxStepPerFrameM:+mS.toFixed(4),maxTurnDegS:+mT.toFixed(2)};});
check('K2 no cut at set-off: smooth position / view / FOV hand-over',()=>{const c0=cam(0);assert(dp(c0,leg.start)<1e-9&&ang(c0,leg.start)<1e-6&&c0.fovVerticalDeg===leg.start.fovVerticalDeg,'d=0 is not the live lens');
 const f=frames(0,E+.2).slice(1);curves.frames=f.map(r=>({d:+r.d.toFixed(4),t:+(r.d/L.speedMps).toFixed(4),stepM:+r.step.toFixed(5),turnDegS:+r.turn.toFixed(3),fov:+r.c.fovVerticalDeg.toFixed(4)}));
 const mS=Math.max(...f.map(r=>r.step));let mA=0;for(let k=1;k<f.length;k++)mA=Math.max(mA,Math.abs(f[k].step-f[k-1].step));
 assert(mS<=2.5,'per-frame jump '+mS);assert(mA<=.2,'per-frame step change '+mA);assert(f[0].step<.01&&f[0].turn<2,'non-zero start rate');const last=f.filter(r=>r.d<=E).at(-1);assert(last.step<.05,'non-zero end rate '+last.step);
 assert(f.every(r=>r.dfov>=-1e-9&&r.dfov<=.35),'fov not monotone/smooth');assert.equal(cam(E).fovVerticalDeg,48);
 const mT=Math.max(...f.map(r=>r.turn));return {easeM:E,easeS:+(E/L.speedMps).toFixed(3),maxStepPerFrameM:+mS.toFixed(3),maxStepChangePerFrameM:+mA.toFixed(4),maxFovPerFrameDeg:+Math.max(...f.map(r=>r.dfov)).toFixed(3),maxTurnDegS:+mT.toFixed(1),totalMoveM:+dp(leg.start,cam(E)).toFixed(3),totalTurnDeg:+ang(leg.start,cam(E)).toFixed(2)};});
check('K2b ease turn rate reported (≤ 20°/s infeasible within the right-side/in-frame/occlusion rules), pinned',()=>{const f=frames(0,E).slice(1),mT=Math.max(...f.map(r=>r.turn));assert(Math.abs(mT-373)<15,'peak turn '+mT);return {peakTurnDegS:+mT.toFixed(1),note:'132° in 0.65 s; ≥15 m ease needed for 20°/s, which fails F7/F2/O1'};});
check('K3 control: default blend starts exactly on the live lens',()=>{const c=cam(0,C.blendM);assert(dp(c,leg.start)<1e-6&&ang(c,leg.start)<1e-4);return {blendM:C.blendM};});
check('K4 wiring: startBlendM 0 only on island 04→05',()=>{assert.equal(legs[0].startBlendM,0);assert.equal(legs[1].startBlendM,undefined);
 const src=fs.readFileSync(S.ROOT+'/creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts','utf8');assert(/startBlendM:0/.test(src.replace(/\s/g,'')));return {};});
const report={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',timeUTC:new Date().toISOString(),scope:'Geometry/continuity of the real journeyCamera at 60 fps route speed. Not a render or device acceptance.',checks:results,curves};
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/journey-start-continuity.json',JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({status:report.status,checks:results.map(r=>({id:r.id,status:r.status,error:r.error&&r.error.split('\n')[0].slice(0,300)}))},null,1));if(report.status!=='PASS')process.exitCode=1;
