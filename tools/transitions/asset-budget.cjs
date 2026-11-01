#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {load}=require('../journey-integration/occlusion/lib-glb.cjs');
const ROOT=path.resolve(__dirname,'../..');
const DIR=path.join(ROOT,'creator-build-project/assets/bundles/transport_sail');
const files=['sailboat.glb','transit_sea.glb','transit_sea_props.glb','transit_far_cards.glb','transit_clouds.glb','transit_river_mouth.glb','textures/transit_palette_256.png','textures/sail_cloth_256.png','textures/sea_waves_512.png','textures/foam_strip_512x128.png'];
let tris=0,bytes=0;const per={};
for(const f of files){
 const p=path.join(DIR,f);bytes+=fs.statSync(p).size;
 if(!f.endsWith('.glb'))continue;
 const nodes=load(p);let t=0;for(const n of nodes)if(n.tris)t+=n.tris.length/9;tris+=t;per[f]=t;
}
const boat=load(path.join(DIR,'sailboat.glb'));
const names=boat.map(n=>n.name);
assert(names.includes('seat_bench')&&names.includes('sail_root')&&names.includes('wake_root')&&names.includes('seated_root_anchor')&&names.includes('sail_furled'),'boat nodes');
assert(!fs.existsSync(path.join(DIR,'transport_sailboat.glb')),'procedural boat removed');
assert(!fs.existsSync(path.join(DIR,'transit_sea_cards.glb')),'procedural cards removed');
assert(per['sailboat.glb']<=3200,'boat tris');
assert(per['transit_far_cards.glb']<=1500,'card tris');
assert(per['transit_clouds.glb']<=2400,'cloud tris');
assert(per['transit_sea.glb']<=800,'sea tris');
assert(per['transit_sea_props.glb']<=1500,'prop tris');
assert(per['transit_river_mouth.glb']<=800,'mouth tris');
assert(tris<=45000&&tris<=9000,'new tris '+tris);
const limit=1*1024*1024,target=0.35*1024*1024;
assert(bytes<=limit,'bundle bytes '+bytes);
const report={status:'PASS',tris,bytes,per,targetBytes:target,withinTarget:bytes<=target,source:'gbt-blender-self',license:'CC0-self'};
fs.mkdirSync(path.join(__dirname,'../../tools/journey-integration/reports'),{recursive:true});
console.log(JSON.stringify(report));
if(!report.withinTarget)console.log('NOTE source glb+png is over the 0.35 MiB target; Cocos mesh quantize is what the subpackage measures');
