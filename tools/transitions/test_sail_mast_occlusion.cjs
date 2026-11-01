#!/usr/bin/env node
'use strict';
// b11: over the whole sail route (0.1 s), the rig/jib/main/boom never cover her body centre (chest) or head;
// limb overlap (hands, knees, feet, seat) in S-d is reported and capped below the bc81575f count (59 samples).
const assert=require('node:assert/strict');const L=require('./sail_farsea_lib.cjs'),leg=L.leg;
const route=leg.sailRoute(),tl=leg.sailBeats(route.length);
const PTS={chest:[0,0.71,-0.55],head:[0,1.06,-0.55],seat:[0,0.3,-0.55],handL:[0.24,0.55,-0.42],handR:[-0.24,0.55,-0.42],kneeL:[0.11,0.36,-0.2],kneeR:[-0.11,0.36,-0.2],footL:[0.1,0.05,0.05],footR:[-0.1,0.05,0.05]};
const RIG=/^(rig|sail_jib|sail_main|boom)$/;let core=0,limbSd=0,n=0;const by={};
for(let t=0;t<=tl.build05S;t+=0.1){const b=tl.beats.find(b=>t>=b.t0&&t<b.t1);if(!b)continue;n++;
 const v=leg.sailVehicle(tl,route.samples,t),c=leg.sailCamera(tl,route.samples,t);
 for(const [k,p] of Object.entries(PTS)){if(!L.girlOccluders(c,v,p).some(x=>RIG.test(x)))continue;by[b.id+' '+k]=(by[b.id+' '+k]||0)+1;
  if(k==='chest'||k==='head')core++;else if(b.id==='S-d')limbSd++;}}
assert.equal(core,0,'rig covers her chest/head '+JSON.stringify(by));
assert.ok(limbSd<59,'S-d limb overlap '+limbSd);
console.log(JSON.stringify({status:'PASS',samples:n,coreHidden:core,sdLimbSamples:limbSd,byBeat:by}));
