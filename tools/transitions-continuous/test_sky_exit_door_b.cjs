#!/usr/bin/env node
/** cand7: at the sky-city landing she leaves the basket through basket_door_b on the deck side. World space: the balloon's last
 *  flightpath key (yaw, frame "world") places the basket; door B (TransitionStaging.basket, −Z) must face the sky-city step-down
 *  (skycity-local, via seam.skycityRootWorld). Fails with the old key (67.747): she would walk out of the far side. */
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../..');
const fp=JSON.parse(fs.readFileSync(path.join(root,'creator-build-project/assets/bundles/region_transit_balloon/balloon_flightpath.json'),'utf8'));
const st=fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/region/TransitionStaging.ts'),'utf8');
const vec=(name)=>{const m=st.match(new RegExp(name+':\\[([-0-9.,]+)\\]'));assert(m,'missing '+name);return m[1].split(',').map(Number);};
const L2W=(o,yawDeg,l)=>{const a=yawDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [o[0]+l[0]*c+l[2]*s,o[1]+l[1],o[2]-l[0]*s+l[2]*c];};
const keys=fp.keys,last=keys[keys.length-1];assert.strictEqual(last.frame,'world');
const C=fp.seam.skycityRootWorld,city=(l)=>L2W(C.translation,C.yawDeg,l);
const o=last.pos,yaw=last.yawDeg;
const thrB=L2W(o,yaw,vec('thresholdB')),outB=L2W(o,yaw,vec('doorOutB')),hingeB=L2W(o,yaw,vec('doorHingeB')),entry=L2W(o,yaw,vec('doorHinge'));
const step=city(vec('stepDown')),edge=city(vec('deckEdge'));
const d=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const dir=(a,b)=>{const x=b[0]-a[0],z=b[2]-a[2],n=Math.hypot(x,z);return [x/n,z/n];};
const u=dir(o,outB),v=dir(o,step),dot=u[0]*v[0]+u[1]*v[1];
const localYawInCity=((yaw-C.yawDeg)%360+540)%360-180;
const out={landingYawWorld:yaw,landingYawCityLocal:+localYawInCity.toFixed(3),doorB_out_world:outB.map(x=>+x.toFixed(3)),stepDown_world:step.map(x=>+x.toFixed(3)),
 dot:+dot.toFixed(4),outB_to_step:+d(outB,step).toFixed(3),entryHinge_to_step:+d(entry,step).toFixed(3),hingeB_to_step:+d(hingeB,step).toFixed(3)};
assert(dot>0.9,'door B does not face the step-down: '+JSON.stringify(out));
assert(d(outB,step)<d(o,step)&&d(thrB,step)<d(o,step),'exit walk goes away from the deck');
assert(d(hingeB,step)<d(entry,step),'entry door (basket_door) is on the deck side, not door B');
assert(d(step,edge)<1.5);
console.log(JSON.stringify({status:'PASS',...out}));
