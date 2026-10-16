#!/usr/bin/env node
'use strict';
/* Oi review 16:05Z (patch 4): startBlendM=0 makes the 04→05 lens start ON her follow pose, and the old angular-rate sampler
 * set its first point to 0, so the hand-over from the live island lens (before set-off) to d=0 (after) was never measured.
 * Real TS (RegionJourneyCore.journeyCamera) on the real leg from journey-scene.cjs. Asserts:
 *  K1 after set-off (d ∈ [0, 10] m, 0.01 m steps) the startBlendM=0 lens is continuous: d=0 equals the d→0+ limit, no
 *     position step > 0.02 m per 0.01 m, view turn ≤ 20°/s at the route speed, FOV constant;
 *  K2 the before→after hand-over is a CUT, and it is pinned + reported (not hidden): position jump, view turn, FOV change
 *     between the live island entry lens and d=0. Changing it must update this pin deliberately;
 *  K3 control: with the default blend (startBlendM>0, kept for 08→09) d=0 equals the live lens exactly (no cut);
 *  K4 wiring: only the island 04→05 route passes startBlendM 0; 08→09 keeps the default.
 * Whether a cut at set-off is acceptable is a design/visual call (device video), not something this geometry test decides. */
const fs=require('fs'),assert=require('assert/strict');const S=require('./journey-scene.cjs');const {legs,journeyCamera,L}=S;
const results=[];const check=(id,fn)=>{try{results.push({id,status:'PASS',...fn()});}catch(e){results.push({id,status:'FAIL',error:String(e.stack||e)});}};
const dir=p=>{const v=p.target.map((x,i)=>x-p.position[i]),l=Math.hypot(...v);return v.map(x=>x/l);},ang=(a,b)=>{const u=dir(a),v=dir(b);return Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1]+u[2]*v[2])))*180/Math.PI;},dp=(a,b)=>Math.hypot(...a.position.map((x,i)=>x-b.position[i]));
const leg=legs[0],cam=(d,b)=>journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,b);
check('K1 04→05 startBlendM=0: continuous after set-off (d 0–10 m)',()=>{const h=.01;let maxStep=0,maxRate=0,at=0;const lim=cam(1e-6,0),c0=cam(0,0);
 assert(dp(c0,lim)<1e-4&&ang(c0,lim)<1e-3,'d=0 differs from d→0+');
 for(let d=0;d<10-1e-9;d+=h){const a=cam(d,0),b=cam(d+h,0),s=dp(a,b),r=ang(a,b)/(h/L.speedMps);if(s>maxStep)maxStep=s;if(r>maxRate){maxRate=r;at=d;}assert.equal(b.fovVerticalDeg,c0.fovVerticalDeg);}
 assert(maxStep<=.02,'position step '+maxStep);assert(maxRate<=20,`view turn ${maxRate.toFixed(2)}°/s at d=${at.toFixed(2)}`);
 return {maxPosStepPer1cm:+maxStep.toFixed(4),maxTurnDegS:+maxRate.toFixed(2),atM:+at.toFixed(2),fov:c0.fovVerticalDeg};});
const PIN={jumpM:50.727,turnDeg:132.07,fovFrom:42,fovTo:48};
check('K2 before→after hand-over at set-off is a CUT (pinned, reported for design/device review)',()=>{const c0=cam(0,0),j=dp(leg.start,c0),t=ang(leg.start,c0);
 assert(Math.abs(j-PIN.jumpM)<.01,'jump '+j);assert(Math.abs(t-PIN.turnDeg)<.05,'turn '+t);assert.equal(leg.start.fovVerticalDeg,PIN.fovFrom);assert.equal(c0.fovVerticalDeg,PIN.fovTo);
 return {cut:true,positionJumpM:+j.toFixed(3),viewTurnDeg:+t.toFixed(2),fov:[leg.start.fovVerticalDeg,c0.fovVerticalDeg],before:leg.start,after:c0};});
check('K3 control: default blend starts exactly on the live lens',()=>{const c=cam(0,S.JOURNEY_CAMERA.blendM);assert(dp(c,leg.start)<1e-6&&ang(c,leg.start)<1e-4);return {blendM:S.JOURNEY_CAMERA.blendM};});
check('K4 wiring: startBlendM 0 only on island 04→05',()=>{assert.equal(legs[0].startBlendM,0);assert.equal(legs[1].startBlendM,undefined);
 const src=fs.readFileSync(S.ROOT+'/creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts','utf8');assert(/startBlendM:0/.test(src.replace(/\s/g,'')),'adapter passes startBlendM 0');return {};});
const report={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',timeUTC:new Date().toISOString(),scope:'Geometry/continuity of the real journeyCamera. Not a render or device acceptance.',checks:results};
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/journey-start-continuity.json',JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({status:report.status,checks:results.map(r=>({id:r.id,status:r.status,error:r.error&&r.error.split('\n')[0].slice(0,300)}))},null,1));if(report.status!=='PASS')process.exitCode=1;
