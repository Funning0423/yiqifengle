#!/usr/bin/env node
'use strict';
/**
 * b20 island walk gates (场景设计部), measured on the baked island edges (tools/region-nodes/region-nodes.json), 5 cm samples of the walked
 * polyline (the walker interpolates path points linearly):
 *  1. vegetation: >= 0.15 m (solidKeepM) from the footprint of every plant/prop part standing > 0.3 m (LOW) over the floor, computed from
 *     the island GLB geometry by the bake (grid.tall) - no hand-entered radii. Negative self-test: the 9d2bdc6f I3-I4 / I4-I6 paths
 *     (through the flower bush at x3.3-3.9 z4.5-5.2) must FAIL.
 *  2. terrain-follow: her y <= ground + 0.03 m everywhere; ground = highest floor-mesh point within a 0.1 m disc under her foot (grid.floorDisc,
 *     the same ground the bake densifies on). No exclusions.
 *  2b. drop-off edges (dock ramp sides, kerbs): her centre >= 0.15 m from any point where the ground falls > 0.1 m below her
 *     (16 directions, rings 0.05 / 0.10 / 0.15 m).
 *  Negative self-tests (must FAIL): a synthetic 0.30 m gap, a point on the sand just outside the ramp's west edge, the 3a05ca8a I5-I6.
 *  3. trunks / solids: >= 1 m from every palm trunk sample below 0.7 m (island palm geometry in the bake's solid set).
 * Usage: node tools/region-nodes/test_island_walk_gates.cjs
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert');
const RN=require('./bake-region-nodes.cjs');
const N=JSON.parse(fs.readFileSync(path.join(__dirname,'region-nodes.json'),'utf8')).island;
const OLD=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/island-edges-9d2bdc6f.json'),'utf8')).edges;
const OLD2=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/island-edges-3a05ca8a.json'),'utf8')).edges;
const along=(p,step,f)=>{for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/step));for(let t=(i>1?1:0);t<=n;t++)f([a[0]+(b[0]-a[0])*t/n,a[1]+(b[1]-a[1])*t/n,a[2]+(b[2]-a[2])*t/n]);}};
(async()=>{
 const spec=RN.REGIONS.island,{grid:g}=await RN.decodeDraco(spec.file,spec);
 if(!g||!g.tall||!g.floorDisc)throw Error('island geometry not decoded (needs draco3d: DRACO3D or /tmp/draco3d) - the gates cannot run');
 const keep=spec.solidKeepM;assert.ok(keep>=0.15,'solidKeepM '+keep);
 const vegMin=p=>{let m={d:99};along(p,0.05,q=>{for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const a=g.tall.get((Math.floor(q[0]/.5)+i)+','+(Math.floor(q[2]/.5)+j));if(a)for(let k=0;k<a.length;k+=2){const d=Math.hypot(a[k]-q[0],a[k+1]-q[2]);if(d<m.d)m={d,at:[q[0],q[2]].map(v=>+v.toFixed(2)),prop:[a[k],a[k+1]].map(v=>+v.toFixed(2))};}}});return m;};
 const yOver=(p,fl=g.floorDisc)=>{let m={d:-9};along(p,0.05,q=>{const t=fl(q[0],q[2],q[1]+0.6);if(t===null)return;if(q[1]-t>m.d)m={d:q[1]-t,at:[q[0],q[2]].map(v=>+v.toFixed(2)),y:+q[1].toFixed(3),floor:+t.toFixed(3)};});return m;};
 const EDGE_R=[0.05,0.10,0.15],edgeMin=(p,fl=g.floorDisc)=>{let m={d:99};along(p,0.05,q=>{for(const r of EDGE_R){if(r>=m.d)break;for(let k=0;k<16;k++){const x=q[0]+r*Math.cos(k*Math.PI/8),z=q[2]+r*Math.sin(k*Math.PI/8),t=fl(x,z,q[1]+0.6);
  if(t===null||t<q[1]-0.1){m={d:r,at:[q[0],q[2]].map(v=>+v.toFixed(2)),drop:t===null?null:+(q[1]-t).toFixed(3)};break;}}}});return m;};
 const fails=[];
 // negative self-tests
 {const gap=(x,z,yMax)=>{const R=(x,z)=>(z>0.35&&z<0.65)?-1:0;let b=R(x,z);for(const rr of [.05,.1])for(let k=0;k<8;k++)b=Math.max(b,R(x+rr*Math.cos(k*Math.PI/4),z+rr*Math.sin(k*Math.PI/4)));return b<=yMax?b:null;};
  const p=[[0,0,0],[0,0,1]],y=yOver(p,gap);assert.ok(y.d>0.03,'self-test: synthetic 0.30 m gap not caught ('+y.d+')');console.log('self-test synthetic 0.30 m gap FAIL as expected, y-ground',y.d.toFixed(3));}
 {const sand=[[-1.95,0,8.4],[-1.95,0,8.45]].map(q=>[q[0],g.floorDisc(-1.5,q[2],1),q[2]]);const y=yOver(sand),e=edgeMin(sand);assert.ok(y.d>0.03||e.d<0.15,'self-test: sand outside the ramp edge not caught');console.log('self-test sand outside ramp west edge FAIL as expected, y-ground',y.d.toFixed(3),'edge',e.d);}
 for(const e of OLD2){const y=yOver(e.path),d=edgeMin(e.path);assert.ok(y.d>0.03||d.d<0.15,'self-test: 3a05ca8a '+e.a+'-'+e.b+' not caught');console.log('self-test 3a05ca8a',e.a+'-'+e.b,'FAIL as expected, y-ground',y.d.toFixed(3),y.at,'edge',d.d,d.at);}
 // trunk samples: solid samples of the palm meshes are not kept per mesh in the grid, so use the lib-glb palm objects as the clip gate does
 const J=require('../journey-integration/journey-scene.cjs');const trunks=[];for(const o of J.island)if(/palm/.test(o.name))for(let k=0;k<o.tris.length;k+=3)if(o.tris[k+1]<0.7)trunks.push([o.tris[k],o.tris[k+2],o.name]);
 const trunkMin=p=>{let m={d:99};along(p,0.05,q=>{for(const t of trunks){const d=Math.hypot(t[0]-q[0],t[1]-q[2]);if(d<m.d)m={d,who:t[2]};}});return m;};
 // negative self-test first: the gate must catch the old paths
 for(const e of OLD){const v=vegMin(e.path);assert.ok(v.d<keep,'self-test: vegetation gate did not catch 9d2bdc6f '+e.a+'-'+e.b+' ('+v.d.toFixed(3)+' m)');console.log('self-test 9d2bdc6f',e.a+'-'+e.b,'vegetation FAIL as expected',v.d.toFixed(3),'m at',v.at);}
 for(const e of N.edges){const k=e.a+'-'+e.b,v=vegMin(e.path),y=yOver(e.path),t=trunkMin(e.path),ed=edgeMin(e.path);
  console.log(k,'veg',v.d.toFixed(3),v.at||'','| y-floor max',y.d.toFixed(3),y.at||'','| trunk',t.d.toFixed(3),t.who||'','| drop-off edge',ed.d<99?ed.d:'>0.15',ed.at||'');
  if(v.d<keep)fails.push(k+' vegetation '+v.d.toFixed(3)+' m < '+keep+' at '+v.at+' (prop '+v.prop+')');
  if(y.d>0.03)fails.push(k+' terrain-follow y-floor '+y.d.toFixed(3)+' m > 0.03 at '+y.at+' (y '+y.y+', floor '+y.floor+')');
  if(ed.d<0.15)fails.push(k+' drop-off edge '+ed.d+' m < 0.15 at '+ed.at+' (drop '+ed.drop+')');
  if(t.d<1)fails.push(k+' trunk '+t.d.toFixed(3)+' m < 1 ('+t.who+')');}
 if(fails.length){console.error('island-walk-gates FAIL\n '+fails.join('\n '));process.exit(1);}
 console.log('island-walk-gates PASS');
})().catch(e=>{console.error(e);process.exit(1);});
