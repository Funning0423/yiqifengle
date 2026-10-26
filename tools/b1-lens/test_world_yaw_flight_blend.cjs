#!/usr/bin/env node
'use strict';
/** full8: (a) BalloonTransit reads node yaw from the WORLD rotation (meadow frame, skycity frame, vehicle, her pre-walk heading, S0
 *  re-seat), never local eulerAngles.y (only the light's own local restore and the [QF_B1_FRAME] diagnostic may);
 *  (b) the flight starts from the live lens: blend length ≥0.6 s and ≤2.5 m/s average (m2 had a 1.72 m / 77 ms step);
 *  (c) camActorPose (her + boat/balloon world, vs plan) is logged on the sail leg and at B1 and never parses as a camera write. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/region/'),bt=fs.readFileSync(S+'BalloonTransit.ts','utf8'),sr=fs.readFileSync(S+'SailRide.ts','utf8'),ct=fs.readFileSync(S+'CamTraceLog.ts','utf8');
const bad=bt.split('\n').map((l,i)=>[i+1,l]).filter(([,l])=>/eulerAngles\.y/.test(l)&&!/mainLight\.node\.eulerAngles\.y|QF_B1_FRAME/.test(l));
assert.deepEqual(bad.map(b=>b[0]),[],'local eulerAngles.y yaw reads left in BalloonTransit.ts');
for(const re of [/yawDeg:worldYawDeg\(meadow\)/,/yawDeg:worldYawDeg\(model\)/,/y=worldYawDeg\(vehicle\)/,/herYawDeg=worldYawDeg\(girl\)/,/worldYawDeg\(model\)\*Math\.PI\/180/])assert.match(bt,re);
// worldYawDeg math: +Z rotated by a pure yaw θ → atan2 = θ (also for θ = 180, where an euler read-back can fold to (180,0,180))
const yaw=(deg)=>{const t=deg*Math.PI/180,f=[Math.sin(t),0,Math.cos(t)];return Math.atan2(f[0],f[2])*180/Math.PI;};for(const d of [0,45,-90,179,180])assert.ok(Math.abs(((yaw(d)-d+540)%360)-180)<1e-9);
// flight blend
const src=bt.match(/export function flightBlendSeconds\(gapM:number\):number\{([^}]*)\}/);assert.ok(src,'flightBlendSeconds');
const fb=new Function('B1_LENS_MPS','gapM',src[1]).bind(null,2.5);assert.equal(fb(0),0);assert.equal(fb(1.72),0.688);assert.equal(fb(0.3),0.6);assert.equal(fb(10),4);
assert.match(bt,/flightFrom=liveWorldPose\(\)/);assert.match(bt,/blendPose\(flightFrom,plan0,minJerk\(clock\.t\/flightBlendS\)\)/);
// min-jerk peak speed = 1.875 × average: 1.72 m over 0.688 s → ≤ 4.7 m/s, i.e. ≤ 0.36 m in a 77 ms frame (was 1.72 m)
assert.ok(1.875*1.72/fb(1.72)*0.077<0.37);
// actor probe
assert.match(ct,/export function camActorPose\(/);assert.doesNotMatch(ct.match(/camActorPose[\s\S]*?\n let started|camActorPose[\s\S]*?let started/)[0],/' pos='/);
assert.equal((sr.match(/camActorPose\('sail:/g)||[]).length,2,'sail leg + arrival');assert.match(bt,/camActorPose\('B1',gp,/);
console.log('PASS world-yaw-flight-blend');
