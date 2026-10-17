#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {load}=require('../journey-integration/occlusion/lib-glb.cjs');
const ROOT=path.resolve(__dirname,'../..');
const DIR=path.join(ROOT,'creator-build-project/assets/bundles/transport_sail');
const files=['transport_sailboat.glb','transit_sea_cards.glb','transit_clouds.glb'];
let tris=0,bytes=0;const per={};
for(const f of files){
 const p=path.join(DIR,f);bytes+=fs.statSync(p).size;
 const nodes=load(p);let t=0;for(const n of nodes)if(n.tris)t+=n.tris.length/9;tris+=t;per[f]=t;
}
const boat=load(path.join(DIR,'transport_sailboat.glb'));
const names=boat.map(n=>n.name);
assert(names.includes('seat_bench')&&names.includes('sail_root')&&names.includes('wake_root'),'boat nodes');
assert(per['transport_sailboat.glb']<=3200,'boat tris');
assert(per['transit_sea_cards.glb']<=1500,'card tris');
assert(per['transit_clouds.glb']<=2400,'cloud tris');
assert(tris<=45000&&tris<=9000,'new tris '+tris);
const limit=1*1024*1024,target=0.25*1024*1024;
assert(bytes<=limit,'bundle bytes '+bytes);
const report={status:'PASS',tris,bytes,per,targetBytes:target,withinTarget:bytes<=target,source:'procedural-self',license:'CC0-self'};
fs.mkdirSync(path.join(__dirname,'../../tools/journey-integration/reports'),{recursive:true});
console.log(JSON.stringify(report));
if(!report.withinTarget)console.log('NOTE bundle is over the 0.25 MiB target but under the 1.0 MiB cap');
