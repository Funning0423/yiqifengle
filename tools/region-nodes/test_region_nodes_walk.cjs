'use strict';
const assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const W=load('region/NodeWalker.ts');
const N=load('region/RegionNodes.ts');
// full9c pins (Grok Bot): measured durations; any edge/walk > pinned + 0.1 s fails. QF_PIN_WRITE=1 rewrites the fixture.
const fs=require('node:fs'),PIN=__dirname+'/fixtures/walk_durations_pinned.json',write=process.env.QF_PIN_WRITE==='1';
const pinned=write?{}:JSON.parse(fs.readFileSync(PIN,'utf8')),seen={},over=[];
const flat=(k,v)=>typeof v==='number'?[[k,v]]:Array.isArray(v)?v.flatMap((x,i)=>flat(k+'['+i+']',x)):Object.entries(v).flatMap(([q,x])=>flat(k+'.'+q,x));
function pin(key,v){for(const [k,x] of flat(key,v)){seen[k]=+x.toFixed(3);if(!write){if(!(k in pinned))over.push(k+' not pinned');else if(x>pinned[k]+0.1)over.push(k+' '+x.toFixed(3)+'s > pinned '+pinned[k]+'s +0.1');}}}
for(const [r,D] of Object.entries(N.REGION_NODES))for(const e of D.edges)pin('edge:'+r+':'+e.a+'-'+e.b,W.pathLength(e.path)/W.WALK_SPEED_MPS);
const pairs=[['island','I1','I2'],['island','I2','I3'],['island','I3','I4'],['island','I4','I6'],['meadow','M0','M1'],['meadow','M1','M2'],['meadow','M2','M3'],['meadow','M3','M4'],['meadow','M4','M6'],['skycity','S0','S1'],['skycity','S1','S2'],['skycity','S2','S3'],['skycity','S3','S4'],['skycity','S4','S6']];
for(const [region,a,b] of pairs){
 const plan=W.planWalk(region,a,b);
 const visible=W.visibleSeconds(plan);
 if(plan.cut)assert.ok(visible<=W.VISIBLE_MAX_S,a+'->'+b+' '+visible);
 else assert.ok(visible<=W.DIRECT_MAX_M/W.WALK_SPEED_MPS+1e-6,a+'->'+b+' '+visible);
 for(const seg of plan.segments)if(plan.cut)assert.ok(seg.duration<=W.CUT_RUN_MAX_S+1e-6,a+'->'+b+' run '+seg.duration);
 if(plan.cut){
  assert.equal(plan.fades,1);
  assert.equal(plan.segments.length,2);
  const route=W.routeKeys(region,a,b);
  for(const seg of plan.segments)for(const p of seg.path)assert.ok(W.distanceToPolyline(route.path,p)<=0.15,a);
 }
 const skip=W.planSkip(region,a,b);
 assert.equal(skip.fades,1);
 assert.ok(skip.lengthM<=W.SKIP_REMAIN_M+1e-6);
 assert.ok(Math.abs(skip.segments[0].duration-W.pathLength(skip.segments[0].path)/W.WALK_SPEED_MPS)<1e-6)/* full9c: measured length at walk speed */;
 assert.ok(skip.segments[0].duration<=1+1e-6);
 pin('walk:'+region+':'+a+'>'+b,{runs:plan.segments.map(s=>s.duration),visible:visible,skip:skip.segments[0].duration});
}
const direct=W.routeKeys('island','I4','I6');
const via=N.REGION_NODES.island.edges.find(e=>e.a==='I4'&&e.b==='I5').lengthM+N.REGION_NODES.island.edges.find(e=>e.a==='I5'&&e.b==='I6').lengthM;
assert.ok(direct.lengthM<via);
const node=N.REGION_NODES.meadow.nodes.find(n=>n.key==='M2');
const tap=W.planTapWalk('meadow',node.at,[3,5.84,-16.4]);
assert.ok(tap&&W.visibleSeconds(tap)<=W.VISIBLE_MAX_S);
assert.equal(W.planTapWalk('island',[0,0,0],[80,0,80]),null);
if(write){fs.mkdirSync(__dirname+'/fixtures',{recursive:true});fs.writeFileSync(PIN,JSON.stringify(seen,null,1)+'\n');}
assert.deepEqual(over,[],'durations over their pins: '+over.join('; '));
console.log('region-nodes-walk PASS');
