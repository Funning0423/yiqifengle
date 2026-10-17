'use strict';
const assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const W=load('region/NodeWalker.ts');
const N=load('region/RegionNodes.ts');
const pairs=[['island','I1','I2'],['island','I2','I3'],['island','I3','I4'],['island','I4','I6'],['meadow','M0','M1'],['meadow','M1','M2'],['meadow','M2','M3'],['meadow','M3','M4'],['meadow','M4','M6'],['skycity','S0','S1'],['skycity','S1','S2'],['skycity','S2','S3'],['skycity','S3','S4'],['skycity','S4','S6']];
for(const [region,a,b] of pairs){
 const plan=W.planWalk(region,a,b);
 const visible=W.visibleSeconds(plan);
 if(plan.cut)assert.ok(visible<=W.VISIBLE_MAX_S,a+'->'+b+' '+visible);
 else assert.ok(visible<=W.DIRECT_MAX_M/W.WALK_SPEED_MPS+1e-6,a+'->'+b+' '+visible);
 for(const seg of plan.segments)if(plan.cut)assert.ok(seg.duration<=3.5+1e-6);
 if(plan.cut){
  assert.equal(plan.fades,1);
  assert.equal(plan.segments.length,2);
  const route=W.routeKeys(region,a,b);
  for(const seg of plan.segments)for(const p of seg.path)assert.ok(W.distanceToPolyline(route.path,p)<=0.15,a);
 }
 const skip=W.planSkip(region,a,b);
 assert.equal(skip.fades,1);
 assert.ok(skip.lengthM<=W.SKIP_REMAIN_M+1e-6);
 assert.ok(Math.abs(skip.segments[0].duration-Math.min(1,W.routeKeys(region,a,b).lengthM/W.WALK_SPEED_MPS))<1e-6);
}
const direct=W.routeKeys('island','I4','I6');
const via=N.REGION_NODES.island.edges.find(e=>e.a==='I4'&&e.b==='I5').lengthM+N.REGION_NODES.island.edges.find(e=>e.a==='I5'&&e.b==='I6').lengthM;
assert.ok(direct.lengthM<via);
const node=N.REGION_NODES.meadow.nodes.find(n=>n.key==='M2');
const tap=W.planTapWalk('meadow',node.at,[3,5.84,-16.4]);
assert.ok(tap&&W.visibleSeconds(tap)<=W.VISIBLE_MAX_S);
assert.equal(W.planTapWalk('island',[0,0,0],[80,0,80]),null);
console.log('region-nodes-walk PASS');
