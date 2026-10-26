#!/usr/bin/env node
'use strict';
// b19 场景设计部 (Grok Bot): plan E meshes in transport_sail. far_meadow_impostor ≤ 800 tris, sea_reef_cluster ≤ 300 tris, every
// primitive carries COLOR_0 (also in the Draco stream; Creator turns USE_VERTEX_COLOR on), no textures, mesh node names match the
// SailArt prefab names (far_* → cull none), the reef reaches below the water line (no floating) and its foam sits above it, and the
// whole stand-in stays inside the sail sky dome (env_sky_dome r 282.6 m, follows the camera) from the pier and every sail frame to
// the handoff, so the opaque dome never hides it.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),DIR=path.join(ROOT,'creator-build-project/assets/bundles/transport_sail');
const glb=f=>{const b=fs.readFileSync(f),n=b.readUInt32LE(12);return {bytes:b.length,j:JSON.parse(b.subarray(20,20+n).toString('utf8'))};};
const L=require('../transitions/sail_farsea_lib.cjs'),leg=L.leg,sea=L.load('region/SeaReveal.ts');
const out={};
for(const [name,max] of [['far_meadow_impostor',800],['sea_reef_cluster',300]]){
 const {bytes,j}=glb(path.join(DIR,name+'.glb'));let tris=0;const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
 assert.ok(!(j.images||[]).length&&!(j.textures||[]).length,name+': no textures');
 assert.ok(j.nodes.some(n=>n.name===name&&n.mesh!=null),name+': mesh node named '+name);
 for(const m of j.meshes)for(const p of m.primitives){
  assert.ok('COLOR_0' in p.attributes,name+': COLOR_0');const dr=p.extensions?.KHR_draco_mesh_compression;if(dr)assert.ok('COLOR_0' in dr.attributes,name+': COLOR_0 in Draco');
  tris+=j.accessors[p.indices].count/3;const a=j.accessors[p.attributes.POSITION];for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],a.min[k]);mx[k]=Math.max(mx[k],a.max[k]);}}
 assert.ok(tris<=max,name+' '+tris+' tris > '+max);out[name]={tris,bytes,min:mn,max:mx};}
const R=out.sea_reef_cluster;assert.ok(R.min[1]<=-1,'reef base under the water line (no floating): '+R.min[1]);assert.ok(R.max[1]>=2.5,'reef stands clear of the sea');
const I=out.far_meadow_impostor;assert.ok(I.min[1]<0&&I.max[1]>15,'impostor: skirt under the sea line, windmill above');
// dome: all 8 bbox corners (world) within 282.6 m horizontally of every camera position until the handoff
const S=sea.SEA_STANDIN,c=Math.cos(S.yawDeg*Math.PI/180),s=Math.sin(S.yawDeg*Math.PI/180),corners=[];
for(const x of [I.min[0],I.max[0]])for(const z of [I.min[2],I.max[2]])corners.push([S.pos[0]+S.scale*(c*x+s*z),S.pos[2]+S.scale*(-s*x+c*z)]);
const route=leg.sailRoute(),tl=leg.sailBeats(route.length),cams=[[-0.716,2,5.1]];
for(let t=0;t<=sea.SEA_HANDOFF_T;t+=0.25)for(const sc of leg.SAIL_SCREENS)cams.push(leg.sailCamera(tl,route.samples,t,sc).position);
let worst=0;for(const p of cams)for(const q of corners)worst=Math.max(worst,Math.hypot(q[0]-p[0],q[1]-p[2]));
assert.ok(worst<282.6,'stand-in leaves the sky dome: '+worst.toFixed(1)+' m');
console.log(JSON.stringify({...out,standin:S,maxCamToBoxCornerM:+worst.toFixed(1)}));console.log('PASS sea-assets');
