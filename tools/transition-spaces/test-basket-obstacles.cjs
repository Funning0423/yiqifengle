'use strict';
// b19 basket obstacles data (场景设计部): transition-anchors.json basketObstacles is well-formed for BasketObstacles.ts, matches the
// generator (parked roots + basket mesh radius), is NOT baked into the walkable grid, and every RegionNodes edge keeps clear of an active disc.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),cp=require('node:child_process');
const R=path.resolve(__dirname,'../..');
const O=JSON.parse(fs.readFileSync(R+'/tools/transitions-continuous/transition-anchors.json','utf8')).basketObstacles;
assert(Array.isArray(O)&&O.length===3,'three basket obstacles');
const EV=/^([a-z]+:[A-Za-z0-9-]+|node:[A-Z]+\d+|balloon:released|lakeside:released)$/;
for(const o of O){
 assert.deepEqual(Object.keys(o).sort(),['at','baked','clearM','id','initial','off','on','r','region'],o.id);
 assert(['meadow','skycity'].includes(o.region));assert(o.at.length===2&&o.at.every(Number.isFinite));assert(o.r>0.9&&o.r<1.3);assert(o.clearM>=0.3);
 assert.equal(o.baked,false,o.id+' not baked');assert.equal(o.initial,false);for(const e of [...o.on,...o.off])assert.match(e,EV,o.id+' '+e);
}
assert.deepEqual(O.map(o=>o.on[0]),['node:M4','balloon:B4-settle','lakeside:C1-basket-in']);
assert.deepEqual(O.map(o=>o.off[0]),['balloon:B3-flight','balloon:released','lakeside:C3-flight']);
cp.execFileSync('python3',[R+'/tools/transition-spaces/gen-basket-obstacles.py','--check']);
const nodes=JSON.parse(fs.readFileSync(R+'/tools/region-nodes/region-nodes.json','utf8'));const B=nodes.regions||nodes;
const seg=(p,a,b)=>{const dx=b[0]-a[0],dz=b[2]-a[2],L=dx*dx+dz*dz,t=L?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[2])*dz)/L)):0;return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[2]-dz*t);};
const out=[];
for(const o of O){
 const fx=JSON.parse(zlib.gunzipSync(fs.readFileSync(R+`/tools/region-nodes/fixtures/${o.region}-walkable.json.gz`)));
 const inside=fx.cells.filter(([ci])=>Math.hypot(fx.x0+(ci%fx.W+.5)*fx.c-o.at[0],fx.z0+(((ci/fx.W)|0)+.5)*fx.c-o.at[1])<=o.r+o.clearM).length;
 assert(inside>0,o.id+': disc cells are walkable in the bake (dynamic only)');
 let minE=1e9,worst='';for(const e of B[o.region].edges){for(let i=0;i+1<e.path.length;i++){const d=seg(o.at,e.path[i],e.path[i+1]);if(d<minE){minE=d;worst=e.a+'-'+e.b;}}}
 for(const n of B[o.region].nodes)assert(Math.hypot(n.at[0]-o.at[0],n.at[2]-o.at[1])>o.r+o.clearM,o.id+' node '+n.key+' inside disc');
 assert(minE>o.r+o.clearM,`${o.id}: edge ${worst} ${minE.toFixed(3)} m <= ${o.r+o.clearM}`);
 out.push({id:o.id,at:o.at,r:o.r,clearM:o.clearM,unbakedCells:inside,closestEdge:worst,closestEdgeM:+minE.toFixed(3)});
}
const m=B.meadow.edges.filter(e=>['M4-M6','M5-M6'].includes(e.a+'-'+e.b));assert.equal(m.length,2);
console.log(JSON.stringify({status:'PASS',obstacles:out}));
