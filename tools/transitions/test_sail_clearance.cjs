#!/usr/bin/env node
'use strict';
/** Hull AABB stays above the sail meadow along the whole route, after the estuary cut. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const {load:loadGlb}=require('../journey-integration/occlusion/lib-glb.cjs');
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
function load(rel,req){
 const file=path.join(S,rel);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};
 vm.runInNewContext(js,{module:m,exports:m.exports,require:req,console},{filename:file});
 return m.exports;
}
const layout=load('region/RegionJourneyLayout.ts',()=>({}));
const leg=load('region/TransportLeg.ts',spec=>spec.includes('RegionJourneyLayout')?layout:{});
const channel=load('region/SailChannel.ts',()=>({}));
const root=leg.sailMeadowRoot();
const worldOf=p=>[root[0]-p[0],root[1]+p[1],root[2]-p[2]];
const nodes=loadGlb(path.resolve(__dirname,'../../creator-build-project/assets/bundles/region_meadow/env_meadow.glb'));
const names=/^(meadow_terrain|meadow_river|meadow_river_bank)$/;
const samples=leg.sailRoute().samples;
const rect=channel.sailLandingRect(samples);
const tris=[];
for(const n of nodes){
 if(!names.test(n.name)||!n.tris)continue;
 const tr=n.tris;
 for(let i=0;i<tr.length;i+=9){
  const pts=[0,1,2].map(k=>worldOf([tr[i+k*3],tr[i+k*3+1],tr[i+k*3+2]]));
  for(const carved of channel.carveTriangle(pts[0],pts[1],pts[2],rect))tris.push(carved);
 }
}
function heightAt(wx,wz){
 let best=-999;
 for(const [a,b,c] of tris){
  const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(den)<1e-8)continue;
  const u=((b[2]-c[2])*(wx-c[0])+(c[0]-b[0])*(wz-c[2]))/den;
  const v=((c[2]-a[2])*(wx-c[0])+(a[0]-c[0])*(wz-c[2]))/den;
  const w=1-u-v;
  if(u<-1e-3||v<-1e-3||w<-1e-3)continue;
  const y=u*a[1]+v*b[1]+w*c[1];
  if(y>best)best=y;
 }
 return best;
}
const route=leg.sailRoute(),tl=leg.sailBeats(route.length);
assert(Math.abs(route.samples[route.samples.length-1][1]-leg.SAIL_WATER_Y)<1e-6,'landing stays on the waterline');
const end=route.samples[route.samples.length-1];
assert(channel.sailChannelContains(end[0],end[2],route.samples),'landing sits in the cut');
let worst=1e9,where=null,checked=0;
for(let t=0;t<=tl.build05S+1e-6;t+=0.5){
 const v=leg.sailVehicle(tl,route.samples,Math.min(tl.build05S,t));
 const cr=Math.cos(v.roll),sr=Math.sin(v.roll),cy=Math.cos(v.yaw),sy=Math.sin(v.yaw);
 let minY=1e9;
 const pts=[];
 for(const x of [-0.8,0.8])for(const y of [-0.4,0.94])for(const z of [-2.1,2.1]){
  const y1=cr*y-sr*z,z1=sr*y+cr*z;
  minY=Math.min(minY,v.pos[1]+y1);
  pts.push([v.pos[0]+cy*x+sy*z1,v.pos[2]-sy*x+cy*z1]);
 }
 for(let iz=0;iz<=4;iz++)for(let ix=0;ix<=4;ix++){
  const x=-0.8+1.6*ix/4,z=-2.1+4.2*iz/4;
  pts.push([v.pos[0]+cy*x+sy*z,v.pos[2]-sy*x+cy*z]);
 }
 for(const [x,z] of pts){
  const ground=heightAt(x,z);
  const gap=minY-ground;
  checked++;
  if(gap<worst){worst=gap;where={t:+t.toFixed(2),x:+x.toFixed(2),z:+z.toFixed(2),minY:+minY.toFixed(3),ground:+ground.toFixed(3)};}
 }
}
assert(worst>=-0.001,'hull below terrain '+JSON.stringify(where));
const art=fs.readFileSync(path.join(S,'region/SailArt.ts'),'utf8');
assert(art.includes('sailChannelWorldY')&&art.includes('meadow_grass_instances'),'runtime cut includes grass');
assert(art.includes("builtin-unlit")&&art.includes('night_stars'),'stars are unlit');
console.log(JSON.stringify({status:'PASS',checked,worstGap:+worst.toFixed(3),where}));
