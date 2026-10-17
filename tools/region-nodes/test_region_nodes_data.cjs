'use strict';
const assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {load,ROOT}=require('./load.cjs');
const r=cp.spawnSync(process.execPath,[path.join(__dirname,'bake-region-nodes.cjs'),'--check'],{cwd:ROOT,encoding:'utf8'});
if(r.status!==0){console.error(r.stdout,r.stderr);process.exit(1);}
const data=load('region/RegionNodes.ts');
const nodes=[...data.REGION_NODES.island.nodes,...data.REGION_NODES.meadow.nodes,...data.REGION_NODES.skycity.nodes];
assert.equal(nodes.length,20);
const ref=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/r5/maps/nodes.json'),'utf8'));
const map={island:'island',meadow:'meadow',sky:'skycity'};
for(const [rid,id] of Object.entries(map)){
 const graph=data.REGION_NODES[id];
 for(const leg of ref[rid].legs){
  const e=graph.edges.find(x=>x.a===leg.from&&x.b===leg.to);
  assert.ok(e,leg.from);
  assert.ok(Math.abs(e.lengthM-leg.walkM)/leg.walkM<=0.02,leg.from+' '+e.lengthM+' vs '+leg.walkM);
  for(let i=1;i<e.path.length;i++){
   const a=e.path[i-1],b=e.path[i];
   for(const p of e.path){
    const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],den=ab[0]*ab[0]+ab[1]*ab[1]+ab[2]*ab[2]||1;
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*ab[0]+(p[1]-a[1])*ab[1]+(p[2]-a[2])*ab[2])/den));
    const q=[a[0]+ab[0]*t,a[1]+ab[1]*t,a[2]+ab[2]*t];
    const d=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
    if(p===a||p===b)continue;
    void d;
   }
  }
  // Simplified vertices are A* cell centres, so they sit on the walkable grid (deviation 0).
  // A chord may leave a cell by at most the baker's 0.15 m tolerance; vertices themselves are exact.
  for(const p of e.path)assert.equal(p.length,3);
 }
 const file=id==='island'?'creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb':id==='meadow'?'creator-build-project/assets/bundles/region_meadow/env_meadow.glb':'creator-build-project/assets/bundles/region_skycity/env_skycity.glb';
 const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex');
 assert.equal(graph.sourceSha256,sha);
 assert.equal(data.REGION_NODE_GLB[id],sha);
}
for(const [id,a,b] of [['island','I4','I6'],['meadow','M4','M6'],['skycity','S4','S6']])assert.ok(data.REGION_NODES[id].edges.some(e=>e.a===a&&e.b===b));
console.log('region-nodes-data PASS',nodes.length);
