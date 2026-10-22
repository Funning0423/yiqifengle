#!/usr/bin/env node
'use strict';
/**
 * b16: one walkable-area table for all four explore regions -> creator-build-project/assets/scripts/region/RegionWalkableData.ts.
 *  meadow: + cells under the river surface (meadow_river) are water, never walkable.
 *  island / meadow / skycity: the same grid as RegionNodes.ts (tools/region-nodes/bake-region-nodes.cjs buildGrid on the current
 *    region GLBs, flood-filled from the arrival node), clipped to the region exploreBox; one layer per cell (the highest reachable).
 *  lakeside: tools/lakeside-walkable/bake-lakeside-walkable.cjs (r5h3 export + b16 west boardwalk; water y=0 never walkable).
 * Encoding: `bits` = walkable bit per cell (row-major, base64); `dh` = zig-zag varint deltas of the walkable heights in cm in
 * the same order (base64). Model-local metres (the region GLB / lakeside scene frame).  Usage: node bake-region-walkable.cjs [--check]
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const RN=require('../region-nodes/bake-region-nodes.cjs'),LK=require('../lakeside-walkable/bake-lakeside-walkable.cjs');
const ROOT=path.resolve(__dirname,'../..');
const OUT=path.join(ROOT,'creator-build-project/assets/scripts/region/RegionWalkableData.ts');
function encode(W,H,c,x0,z0,hOf){ // hOf(ci) -> height m | null
 const bits=Buffer.alloc(Math.ceil(W*H/8)),dh=[];let prev=0,n=0,mn=1e9,mx=-1e9;
 for(let ci=0;ci<W*H;ci++){const y=hOf(ci);if(y===null)continue;bits[ci>>3]|=1<<(ci&7);n++;const cm=Math.round(y*100);mn=Math.min(mn,y);mx=Math.max(mx,y);
  let d=cm-prev;prev=cm;let z=d<0?(-d*2-1):d*2;do{let b=z&127;z>>>=7;if(z)b|=128;dh.push(b);}while(z);}
 return {W,H,c,x0,z0,cells:n,minY:+mn.toFixed(2),maxY:+mx.toFixed(2),bits:bits.toString('base64'),dh:Buffer.from(dh).toString('base64')};
}
/** Highest river-surface sample per grid cell (meadow_river triangles, sampled like the floor grid). */
function riverTop(file,g){
 const {load}=require('../journey-integration/occlusion/lib-glb.cjs'),top={};
 for(const n of load(path.join(ROOT,file))){if(!n.tris||n.name!=='meadow_river')continue;const t=n.tris;
  for(let k=0;k<t.length;k+=9){const A=[t[k],t[k+1],t[k+2]],B=[t[k+3],t[k+4],t[k+5]],C=[t[k+6],t[k+7],t[k+8]];
   const L=Math.max(Math.hypot(B[0]-A[0],B[2]-A[2]),Math.hypot(C[0]-A[0],C[2]-A[2]),Math.hypot(C[0]-B[0],C[2]-B[2])),N=Math.max(1,Math.ceil(L/(g.c*.5)));
   for(let i=0;i<=N;i++)for(let j=0;j<=N-i;j++){const u=i/N,v=j/N,x=A[0]+(B[0]-A[0])*u+(C[0]-A[0])*v,y=A[1]+(B[1]-A[1])*u+(C[1]-A[1])*v,z=A[2]+(B[2]-A[2])*u+(C[2]-A[2])*v;
    const gx=Math.floor((x-g.x0)/g.c),gz=Math.floor((z-g.z0)/g.c);if(gx<0||gz<0||gx>=g.W||gz>=g.H)continue;const ci=gz*g.W+gx;if(top[ci]===undefined||y>top[ci])top[ci]=y;}}}
 return top;
}
async function bakeAll(){
 const out={};
 for(const id of ['island','meadow','skycity']){
  const spec=RN.REGIONS[id],d=spec.draco?await RN.decodeDraco(spec.file,spec):RN.decodePlain(spec.file,spec),g=d.grid;
  const [ex0,ez0,ex1,ez1]=spec.explore,gx0=Math.max(0,Math.floor((ex0-g.x0)/g.c)),gz0=Math.max(0,Math.floor((ez0-g.z0)/g.c)),gx1=Math.min(g.W,Math.ceil((ex1-g.x0)/g.c)),gz1=Math.min(g.H,Math.ceil((ez1-g.z0)/g.c));
  const W=gx1-gx0,H=gz1-gz0;
  // meadow: the river surface (meadow_river) is water - a floor at or under it is never walkable
  const wet=id==='meadow'?riverTop(spec.file,g):null;
  const e=encode(W,H,g.c,+(g.x0+gx0*g.c).toFixed(3),+(g.z0+gz0*g.c).toFixed(3),ci=>{const ci0=(gz0+((ci/W)|0))*g.W+gx0+ci%W;let best=null;
   g.layers[ci0].forEach((y,li)=>{if(g.ok[ci0][li]&&g.dist.has(g.key(ci0,li))&&(best===null||y>best))best=y;});if(best!==null&&wet&&wet[ci0]!==undefined&&wet[ci0]>=best-.05)return null;return best;});
  out[id]={sourceSha256:d.sha,waterY:id==='island'?spec.sea:null,...e};
 }
 const b=LK.bake();
 out.lakeside={sourceSha256:b.sha256,waterY:0,...encode(b.W,b.H,b.c,b.x0,b.z0,ci=>b.reach[ci]?b.top[ci]:null)};
 return out;
}
function ts(all){
 const L=['/** Baked by tools/region-walkable/bake-region-walkable.cjs. Pure data, no cc. Do not edit by hand. See docs/b16/walkable/API.md. */',
  'export type WalkableData=Readonly<{sourceSha256:string;waterY:number|null;W:number;H:number;c:number;x0:number;z0:number;cells:number;minY:number;maxY:number;bits:string;dh:string}>;',
  "export const REGION_WALKABLE_DATA:Readonly<Record<'island'|'meadow'|'skycity'|'lakeside',WalkableData>>={"];
 for(const [id,d] of Object.entries(all))L.push(` ${id}:${JSON.stringify(d).replace(/"([A-Za-z0-9_]+)":/g,'$1:')},`);
 L.push('};','');return L.join('\n');
}
bakeAll().then(all=>{
 const text=ts(all);
 if(process.argv.includes('--check')){if(!fs.existsSync(OUT)||fs.readFileSync(OUT,'utf8')!==text){console.error('REGION WALKABLE DRIFT');process.exit(1);}console.log('check-ok');return;}
 fs.writeFileSync(OUT,text);
 for(const [id,d] of Object.entries(all))console.log(id,d.W+'x'+d.H,'cells',d.cells,'m2',(d.cells*d.c*d.c).toFixed(0),'y',d.minY,d.maxY);
 console.log('bytes',text.length);
}).catch(e=>{console.error(e);process.exit(1);});
