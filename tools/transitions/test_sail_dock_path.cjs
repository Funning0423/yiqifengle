#!/usr/bin/env node
'use strict';
/** Dock path: berth on water, jetty+path seam, grass clear, arrival walk ≤12 s, landing under meadow. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const {load:loadGlb}=require('../journey-integration/occlusion/lib-glb.cjs');
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const BUNDLE=path.resolve(__dirname,'../../creator-build-project/assets/bundles');
function load(rel,req){
 const file=path.join(S,rel);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:req,console},{filename:file});return m.exports;
}
const layout=load('region/RegionJourneyLayout.ts',()=>({}));
const landing=load('region/SailLanding.ts',()=>({}));
const leg=load('region/TransportLeg.ts',spec=>spec.includes('RegionJourneyLayout')?layout:spec.includes('SailLanding')?landing:{});
const artSrc=fs.readFileSync(path.join(S,'region/SailArt.ts'),'utf8');
assert(artSrc.includes('transit_landing')&&artSrc.includes('clearLandingGrass')&&artSrc.includes('meadow.addChild(landing)'),'landing under meadow');
assert(!/instantiate\(pier\).*transit_pier_land|name='transit_pier_land'/.test(artSrc),'old land pier removed');
assert(Math.abs(leg.SAIL_MEADOW_SINK-1.35)<1e-9,'sink');
assert(Math.abs(leg.SAIL_WATER_Y-(-0.91))<1e-9,'waterline');

const route=leg.sailRoute(),tl=leg.sailBeats(route.length),end=route.samples[route.samples.length-1],berth=leg.sailBerthWorld();
assert(Math.hypot(end[0]-berth[0],end[2]-berth[2])<0.05,'route ends at berth');
assert(Math.abs(end[1]-leg.SAIL_WATER_Y)<1e-6,'route end on water');
assert(tl.build05S<=30.5,'sail to jetty '+tl.build05S);
assert(tl.arrivalS<=12+1e-6,'arrival walk '+tl.arrivalS);
assert(tl.arrivalM>=10,'arrival length '+tl.arrivalM);

const last=route.samples.slice(-Math.ceil(10/0.5));
const dx=Math.max(...last.map(p=>Math.abs(p[0]-last[last.length-1][0])));
assert(dx<0.35,'final approach nearly straight '+dx);

const glbPath=path.join(BUNDLE,'transport_sail/transit_landing.glb');
assert(fs.existsSync(glbPath),'transit_landing.glb present');
const nodes=loadGlb(glbPath);
const byName=Object.fromEntries(nodes.map(n=>[n.name,n]));
assert(byName.landing_jetty&&byName.landing_path,'meshes');
const jetty=byName.landing_jetty,pathMesh=byName.landing_path;
// lib-glb exposes node world translation as world[12,13,14] (column-major mat4) or a 3-vector.
const jOrigin=(()=>{
 const w=jetty.world;
 if(Array.isArray(w)&&w.length>=16)return [w[12],w[13],w[14]];
 if(Array.isArray(w)&&w.length>=3)return [w[0],w[1],w[2]];
 if(jetty.tris&&jetty.tris.length>=3){
  let sx=0,sy=0,sz=0,n=0;
  for(let i=0;i<jetty.tris.length;i+=9){sx+=jetty.tris[i];sy+=jetty.tris[i+1];sz+=jetty.tris[i+2];n++;}
  return [sx/n,sy/n,sz/n];
 }
 return landing.SAIL_LANDING_JETTY_ROOT;
})();
assert(Math.hypot(jOrigin[0]-1,jOrigin[2]-23.2)<0.6,'jetty root '+jOrigin);
assert(jOrigin[1]-landing.SAIL_LANDING_SEA_LOCAL>=0.25&&jOrigin[1]-landing.SAIL_LANDING_SEA_LOCAL<=0.45,'deck above sea');

// Path join row vs meadow_path vertices.
const meadow=loadGlb(path.join(BUNDLE,'region_meadow/env_meadow.glb'));
const meadowPath=meadow.find(n=>n.name==='meadow_path');
assert(meadowPath&&meadowPath.tris,'meadow_path');
const join=landing.SAIL_PATH_JOIN_ROW;
function nearestHoriz(tris,p){
 let best=1e9,by=0;
 for(let i=0;i<tris.length;i+=3){
  const x=tris[i],y=tris[i+1],z=tris[i+2];
  const d=Math.hypot(x-p[0],z-p[2]);
  if(d<best){best=d;by=y;}
 }
 return {d:best,y:by};
}
// glb positions may be interleaved as xyz triples in .tris (flat) — lib returns tris as 9-float triangles.
const pathVerts=[];
for(const n of meadow){
 if(n.name!=='meadow_path'||!n.tris)continue;
 for(let i=0;i<n.tris.length;i+=3)pathVerts.push([n.tris[i],n.tris[i+1],n.tris[i+2]]);
}
// Prefer unique verts from triangle corners
const mp=[];
for(const n of meadow){
 if(n.name!=='meadow_path'||!n.tris)continue;
 for(let i=0;i<n.tris.length;i+=9)for(let k=0;k<3;k++)mp.push([n.tris[i+k*3],n.tris[i+k*3+1],n.tris[i+k*3+2]]);
}
for(const p of join){
 let best=1e9,dy=1e9;
 for(const v of mp){const d=Math.hypot(v[0]-p[0],v[2]-p[2]);if(d<best){best=d;dy=Math.abs(v[1]-p[1]);}}
 assert(best<=0.02,'join horiz '+best);
 assert(dy<=0.01,'join vert '+dy);
}

// landing_path start row vs join; end near jetty root.
const lp=[];
for(const n of nodes){
 if(n.name!=='landing_path'||!n.tris)continue;
 for(let i=0;i<n.tris.length;i+=9)for(let k=0;k<3;k++)lp.push([n.tris[i+k*3],n.tris[i+k*3+1],n.tris[i+k*3+2]]);
}
assert(lp.length,'landing_path verts');
for(const p of join){
 let best=1e9,dy=1e9;
 for(const v of lp){const d=Math.hypot(v[0]-p[0],v[2]-p[2]);if(d<best){best=d;dy=Math.abs(v[1]-p[1]);}}
 assert(best<=0.02,'landing start horiz '+best);
 assert(dy<=0.05,'landing start vert '+dy);
}
let endBest=1e9,endDy=1e9;
for(const v of lp){
 const d=Math.hypot(v[0]-1.0,v[2]-23.2);
 if(d<endBest){endBest=d;endDy=Math.abs(v[1]-0.75);}
}
assert(endBest<=0.05,'path end horiz '+endBest);
assert(endDy<=0.03,'path end vert '+endDy);

// Walk polyline spacing and deck adherence.
const walk=landing.SAIL_LANDING_WALK_LOCAL;
for(let i=1;i<walk.length;i++){
 const d=Math.hypot(walk[i][0]-walk[i-1][0],walk[i][1]-walk[i-1][1],walk[i][2]-walk[i-1][2]);
 assert(d<=1.5,'walk spacing '+d);
}
for(const p of walk.slice(0,3))assert(Math.abs(p[1]-0.75)<=0.05,'on deck');

// Hull vs terrain at berth (keel −0.40).
const root=leg.sailMeadowRoot();
const worldOf=p=>[root[0]-p[0],root[1]+p[1],root[2]-p[2]];
const channel=load('region/SailChannel.ts',spec=>spec.includes('TransportLeg')?leg:{});
const names=/^(meadow_terrain|meadow_river|meadow_river_bank)$/;
const samples=route.samples,rect=channel.sailLandingRect(samples),tris=[];
for(const n of meadow){
 if(!names.test(n.name)||!n.tris)continue;
 for(let i=0;i<n.tris.length;i+=9){
  const pts=[0,1,2].map(k=>worldOf([n.tris[i+k*3],n.tris[i+k*3+1],n.tris[i+k*3+2]]));
  for(const carved of channel.carveTriangle(pts[0],pts[1],pts[2],rect,samples))tris.push(carved);
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
const keel=berth[1]-0.4;
const ground=heightAt(berth[0],berth[2]);
assert(keel-ground>=0.08-1e-3,'keel clearance '+(keel-ground)+' ground='+ground);

console.log(JSON.stringify({
 status:'PASS',
 build05S:+tl.build05S.toFixed(3),
 arrivalS:+tl.arrivalS.toFixed(3),
 routeM:+route.length.toFixed(2),
 berth:berth.map(n=>+n.toFixed(3)),
 grassClearPolys:Object.keys(landing.SAIL_GRASS_CLEAR_POLYS).length,
}));
