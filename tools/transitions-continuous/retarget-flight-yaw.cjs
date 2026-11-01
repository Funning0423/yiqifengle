'use strict';
// door2 (01c4cbe3): balloon heading from 场景设计部's anchors — the flight file is the only heading source.
//  meadow keys: B1 balloonPose.yawDeg (world) − meadowRootWorld yaw  (164 − 180 = −16 → 344), constant pre-seam (rigid seam keeps it)
//  world keys: start = meadow yaw + meadowToWorld_postSeam yaw (seam continuity), turn (shortest way, smootherstep over TURN) to
//              B4B5 balloonPose.yawDeg (−112.253 → 247.747) and hold through touchdown. Run: node retarget-flight-yaw.cjs [--write]
const fs=require('fs'),path=require('path');const ROOT=path.resolve(__dirname,'../..');
const FP=path.join(ROOT,'creator-build-project/assets/bundles/region_transit_balloon/balloon_flightpath.json');
const A=JSON.parse(fs.readFileSync(path.join(__dirname,'transition-anchors.json'),'utf8')).segments,doc=JSON.parse(fs.readFileSync(FP,'utf8'));
const TURN=[14,30];const n=a=>((a%360)+360)%360,ss=u=>{u=Math.max(0,Math.min(1,u));return u*u*u*(u*(6*u-15)+10);};
const meadowYaw=n(A['B1-basket-in'].anchors.balloonPose.yawDeg-doc.seam.meadowRootWorld.yawDeg),w0=n(meadowYaw+doc.seam.meadowToWorld_postSeam.yawDeg),w1=n(A['B4B5-skycity-out'].anchors.balloonPose.yawDeg);
const dW=((w1-w0+540)%360)-180;
for(const k of doc.keys){if(k.frame==='meadow')k.yawDeg=+meadowYaw.toFixed(3);else{const y=n(w0+dW*ss((k.t-TURN[0])/(TURN[1]-TURN[0])));k.yawDeg=+(y>180?y-360:y).toFixed(3);}}
doc.seam.preKey.yawDeg=meadowYaw;doc.seam.postKey.yawDeg=+w0.toFixed(3);
const rate=Math.abs(dW)*1.875/(TURN[1]-TURN[0]);
console.log(JSON.stringify({meadowYaw,worldStart:+w0.toFixed(3),landing:w1,turnDeg:+dW.toFixed(3),turnWindow:TURN,peakYawRateDegS:+rate.toFixed(2),first:doc.keys[0].yawDeg,last:doc.keys.at(-1).yawDeg}));
if(process.argv.includes('--write')){fs.writeFileSync(FP,JSON.stringify(doc));require('child_process').execFileSync('python3',['-c','import json,sys;p=sys.argv[1];d=json.load(open(p));open(p,"w").write(json.dumps(d,indent=0,ensure_ascii=False))',FP]);}
