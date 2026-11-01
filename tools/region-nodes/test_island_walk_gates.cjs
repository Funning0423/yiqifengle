#!/usr/bin/env node
'use strict';
/**
 * b20 island walk gates (场景设计部), measured on the baked island edges (tools/region-nodes/region-nodes.json).
 * EXACT TRIANGLES (b20 tuft fix, rules 1/3/4/5): horizontal distance from each straight segment of the walked polyline to every mesh
 * triangle, the triangle first clipped to the rule's height band (tools/region-nodes/exact-clearance.cjs) - no vertex sampling, no footprints.
 * Vegetation band = floor + 0.3 .. floor + 1.7 m (floor = terrain under the triangle); solids = her foot + 0.05 .. + 1.8 m (low-rock: whole
 * triangle); fronds = her foot .. + 1.8 m; trunks = palm triangles below 0.7 m. Rule 2 (terrain-follow / drop-off) stays on 5 cm samples:
 *  1. vegetation: >= 0.15 m (solidKeepM) from the footprint of every plant/prop part standing > 0.3 m (LOW) over the floor, computed from
 *     the island GLB geometry by the bake (grid.tall) - no hand-entered radii. Negative self-test: the 9d2bdc6f I3-I4 / I4-I6 paths
 *     (through the flower bush at x3.3-3.9 z4.5-5.2) must FAIL.
 *  2. terrain-follow: her y <= ground + 0.03 m everywhere; ground = highest floor-mesh point within a 0.1 m disc under her foot (grid.floorDisc,
 *     the same ground the bake densifies on). No exclusions.
 *  2b. drop-off edges (dock ramp sides, kerbs): her centre >= 0.15 m from any point where the ground falls > 0.1 m below her
 *     (16 directions, rings 0.05 / 0.10 / 0.15 m).
 *  Negative self-tests (must FAIL): a synthetic 0.30 m gap, a point on the sand just outside the ramp's west edge, the 3a05ca8a I5-I6.
 *  3. trunks: >= 1 m from every palm trunk sample below 0.7 m (island palm geometry in the bake's solid set).
 *  4. solid props, graded by the list's grade (fixtures/island-props-classes.json): low-rock (rock object < 0.3 m) whole footprint + 0.15 m;
 *     fence 0.4 m; planter / bench 0.5 m; rock 0.3-0.7 m 0.5 m; > 0.7 m 1 m - horizontal from her centre to every vertex / edge midpoint in her body range (her foot + 0.05 .. + 1.8 m; parts at or below her sole, e.g. the rock beside the dock deck, cannot touch her).
 *     Vegetation sub-objects keep rule 1 (> 0.3 m parts, footprint + 0.15 m). The gate re-splits the GLB and FAILs on any sub-object that
 *     is not in the list (re-run classify-island-props.cjs after an art change). Negative self-tests (must FAIL): a path across a low-rock footprint, a path 0.3 m from the fence, a path 0.25 m from a rock >= 0.3 m.
 *  5. palm fronds: palm geometry in her height range (ground .. ground + 1.8 m) >= 0.5 m (horizontal) from her centre.
 *     Negative self-test: a path past the young palm's crown at 0.3 m must FAIL.
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
 const EX=require('./exact-clearance.cjs');let vegItems=null,VEG_I=null;/* vegMin is set once the class list is read (below) */
 const vegMin=p=>EX.minDist(VEG_I,p,keep+0.5,it=>[it.floor+0.3,it.floor+1.7]);
 const yOver=(p,fl=g.floorDisc)=>{let m={d:-9};along(p,0.05,q=>{const t=fl(q[0],q[2],q[1]+0.6);if(t===null)return;if(q[1]-t>m.d)m={d:q[1]-t,at:[q[0],q[2]].map(v=>+v.toFixed(2)),y:+q[1].toFixed(3),floor:+t.toFixed(3)};});return m;};
 const EDGE_R=[0.05,0.10,0.15],edgeMin=(p,fl=g.floorDisc)=>{let m={d:99};along(p,0.05,q=>{for(const r of EDGE_R){if(r>=m.d)break;for(let k=0;k<16;k++){const x=q[0]+r*Math.cos(k*Math.PI/8),z=q[2]+r*Math.sin(k*Math.PI/8),t=fl(x,z,q[1]+0.6);
  if(t===null||t<q[1]-0.1){m={d:r,at:[q[0],q[2]].map(v=>+v.toFixed(2)),drop:t===null?null:+(q[1]-t).toFixed(3)};break;}}}});return m;};
 const fails=[];
 // prop classes (vegetation / solid) from the committed list; the GLB is re-split and every sub-object must be in the list
 const CP=require('./classify-island-props.cjs'),PROPS=CP.propsMesh(),CLS=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/island-props-classes.json'),'utf8')).components;
 const idx=new Map(CLS.map(c=>[c.cx+','+c.cz+','+c.tris,c]));const solidPts=[];let unk=0;
 const pts=(v,out,tag)=>{for(let k=0;k<v.length;k+=9){for(let j=0;j<9;j+=3)out.push([v[k+j],v[k+j+1],v[k+j+2],tag]);for(const [a,b] of [[0,3],[3,6],[6,0]])out.push([(v[k+a]+v[k+b])/2,(v[k+a+1]+v[k+b+1])/2,(v[k+a+2]+v[k+b+2])/2,tag]);}};
 const triItems=[];/* exact: every triangle of every sub-object, with its class / grade and the terrain under it */
 for(const c of CP.components(PROPS)){const e=idx.get(c.cx+','+c.cz+','+c.tris);if(!e){unk++;continue;}if(e.cls==='solid'){const a=[];pts(c.v,a,e.asset+'@'+c.cx+','+c.cz);for(const t of a)solidPts.push([...t,e.grade,e.keepM,!!e.footprint]);}
  for(let k=0;k<c.v.length;k+=9){const v=Array.from(c.v.slice(k,k+9)),cy=Math.min(v[1],v[4],v[7]);triItems.push({v,tag:e.asset+'#'+e.id,pl:e.pl,cls:e.cls,grade:e.grade,footprint:!!e.footprint,floor:g.floorAt((v[0]+v[3]+v[6])/3,(v[2]+v[5]+v[8])/3,Math.max(v[1],v[4],v[7]))??cy});}}
 VEG_I=EX.index(triItems.filter(t=>t.cls==='vegetation'));const SOL_I=EX.index(triItems.filter(t=>t.cls==='solid'));
 if(unk)fails.push(unk+' env_island_props_merged sub-objects not in fixtures/island-props-classes.json (re-run classify-island-props.cjs)');
 const Jp=require('../journey-integration/journey-scene.cjs'),frondPts=[],palmItems=[];for(const o of Jp.island)if(/palm/.test(o.name)){pts(o.tris,frondPts,o.name);for(let k=0;k<o.tris.length;k+=9)palmItems.push({v:Array.from(o.tris.slice(k,k+9)),tag:o.name});}
 const PALM_I=EX.index(palmItems);
 const near3=(P,p,lo,hi,label)=>{let m={d:99};along(p,0.05,q=>{for(const t of P){if(t[1]<q[1]+lo||t[1]>q[1]+hi)continue;const d=Math.hypot(t[0]-q[0],t[2]-q[2]);if(d<m.d)m={d,at:[q[0],q[2]].map(v=>+v.toFixed(2)),who:t[3],h:+(t[1]-q[1]).toFixed(2)};}});return m;};
 const GRADES=['low-rock','fence','planter-bench','rock-0.5','solid-1m'],KEEP={'low-rock':0.15,fence:0.4,'planter-bench':0.5,'rock-0.5':0.5,'solid-1m':1};
 // graded solids: per grade the min horizontal distance from her centre; low-rock counts the WHOLE body (footprint), the others only her body range
 // exact: triangles clipped to her body range (foot + 0.05 .. + 1.8 m over the lower end of each path segment .. upper end); low-rock: whole triangle
 const solidMin=p=>{const m={};for(const G of GRADES)m[G]=EX.minDist(SOL_I,p,KEEP[G]+0.5,(it,ya,yb)=>it.footprint?[null,null]:[Math.min(ya,yb)+0.05,Math.max(ya,yb)+1.8],it=>it.grade===G);return m;};
 const solidBad=m=>GRADES.filter(G=>m[G].d<KEEP[G]);
 const frondMin=p=>EX.minDist(PALM_I,p,1,(it,ya,yb)=>[Math.min(ya,yb),Math.max(ya,yb)+1.8]);
 {const lr=solidPts.find(t=>t[4]==='low-rock');const xs=solidPts.filter(t=>t[3]===lr[3]);const cx=xs.reduce((a,t)=>a+t[0],0)/xs.length,cz=xs.reduce((a,t)=>a+t[2],0)/xs.length,gy=g.floorDisc(cx,cz,lr[1]+1)??lr[1];
  const m=solidMin([[cx-0.6,gy,cz],[cx+0.6,gy,cz]]);assert.ok(solidBad(m).includes('low-rock'),'self-test: path across a low-rock footprint not caught');console.log('self-test path across low rock',lr[3],'FAIL as expected',m['low-rock'].d.toFixed(3));}
 {const f=solidPts.find(t=>t[4]==='fence'&&t[1]>0.4);const p=[[f[0]-0.3,f[1]-0.6,f[2]],[f[0]-0.3,f[1]-0.6,f[2]+0.01]];const m=solidMin(p);assert.ok(solidBad(m).includes('fence'),'self-test: path 0.3 m from the fence not caught');console.log('self-test path 0.3 m from',f[3],'FAIL as expected',m.fence.d.toFixed(3));}
 {const r=solidPts.find(t=>t[4]==='rock-0.5'||t[4]==='solid-1m');const p=[[r[0]+0.25,r[1]-0.4,r[2]],[r[0]+0.25,r[1]-0.4,r[2]+0.01]];const m=solidMin(p);assert.ok(solidBad(m).includes(r[4]),'self-test: path 0.25 m from a rock >= 0.3 m not caught');console.log('self-test path 0.25 m from',r[3],r[4],'FAIL as expected',m[r[4]].d.toFixed(3));}
 {const pc=frondPts.filter(t=>/palm_young/.test(t[3]));const cx=pc.reduce((a,t)=>a+t[0],0)/pc.length,cz=pc.reduce((a,t)=>a+t[2],0)/pc.length,top=Math.max(...pc.map(t=>t[1]));
  const y=frondMin([[cx+0.3,top-1.7,cz-0.5],[cx+0.3,top-1.7,cz+0.5]]);assert.ok(y.d<0.5,'self-test: frond pass-through not caught');console.log('self-test path through palm_young crown frond FAIL as expected',y.d.toFixed(3));}
 // negative self-tests
 {const gap=(x,z,yMax)=>{const R=(x,z)=>(z>0.35&&z<0.65)?-1:0;let b=R(x,z);for(const rr of [.05,.1])for(let k=0;k<8;k++)b=Math.max(b,R(x+rr*Math.cos(k*Math.PI/4),z+rr*Math.sin(k*Math.PI/4)));return b<=yMax?b:null;};
  const p=[[0,0,0],[0,0,1]],y=yOver(p,gap);assert.ok(y.d>0.03,'self-test: synthetic 0.30 m gap not caught ('+y.d+')');console.log('self-test synthetic 0.30 m gap FAIL as expected, y-ground',y.d.toFixed(3));}
 {const sand=[[-1.95,0,8.4],[-1.95,0,8.45]].map(q=>[q[0],g.floorDisc(-1.5,q[2],1),q[2]]);const y=yOver(sand),e=edgeMin(sand);assert.ok(y.d>0.03||e.d<0.15,'self-test: sand outside the ramp edge not caught');console.log('self-test sand outside ramp west edge FAIL as expected, y-ground',y.d.toFixed(3),'edge',e.d);}
 for(const e of OLD2){const y=yOver(e.path),d=edgeMin(e.path);assert.ok(y.d>0.03||d.d<0.15,'self-test: 3a05ca8a '+e.a+'-'+e.b+' not caught');console.log('self-test 3a05ca8a',e.a+'-'+e.b,'FAIL as expected, y-ground',y.d.toFixed(3),y.at,'edge',d.d,d.at);}
 // trunk samples: solid samples of the palm meshes are not kept per mesh in the grid, so use the lib-glb palm objects as the clip gate does
 const J=require('../journey-integration/journey-scene.cjs');const trunks=[];for(const o of J.island)if(/palm/.test(o.name))for(let k=0;k<o.tris.length;k+=3)if(o.tris[k+1]<0.7)trunks.push([o.tris[k],o.tris[k+2],o.name]);
 const trunkMin=p=>EX.minDist(PALM_I,p,1.5,()=>[null,0.7]);/* exact: palm triangles clipped below 0.7 m */
 // negative self-test first: the gate must catch the old paths
 // negative self-test (exact triangles): the I4-I6 path at 6a692409 (fixture island-edges-6a692409-I4I6.json), before the via nudge:
 // grass_tuft_01#1983's ~2 cm blade tip above 0.3 m is 0.140 m from it - the 5 cm-sampled vertex gate reported 0.175 and missed it.
 {const e=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/island-edges-6a692409-I4I6.json'),'utf8')).edges[0],I=EX.index(triItems.filter(t=>t.cls==='vegetation')),v=EX.minDist(I,e.path,0.65,it=>[it.floor+0.3,it.floor+1.7]);
  assert.ok(v.d<keep&&/#1983$/.test(v.who),'self-test: old grass_tuft_01 #1983 spike on I4-I6 not caught ('+v.d.toFixed(3)+' '+v.who+')');console.log('self-test 6a692409 I4-I6 vs grass_tuft_01 #1983 spike FAIL as expected',v.d.toFixed(3),'m at',v.at);}
 for(const e of OLD){const v=vegMin(e.path);assert.ok(v.d<keep,'self-test: vegetation gate did not catch 9d2bdc6f '+e.a+'-'+e.b+' ('+v.d.toFixed(3)+' m)');console.log('self-test 9d2bdc6f',e.a+'-'+e.b,'vegetation FAIL as expected',v.d.toFixed(3),'m at',v.at);}
 for(const e of N.edges){const k=e.a+'-'+e.b,v=vegMin(e.path),y=yOver(e.path),t=trunkMin(e.path),ed=edgeMin(e.path),so=solidMin(e.path),fr=frondMin(e.path);
  console.log(k,'veg',v.d.toFixed(3),v.who||'',v.at||'','| y-floor max',y.d.toFixed(3),y.at||'','| trunk',t.d.toFixed(3),t.who||'','| drop-off edge',ed.d<99?ed.d:'>0.15',ed.at||'','| solids',GRADES.map(G=>G+' '+(so[G].d<99?so[G].d.toFixed(3)+'@'+so[G].at+' '+so[G].who:'>'+(KEEP[G]+0.5))).join(' '),'| frond',fr.d<99?fr.d.toFixed(3):'>1',fr.who||'',fr.at||'');
  for(const G of solidBad(so))fails.push(k+' '+G+' '+so[G].d.toFixed(3)+' m < '+KEEP[G]+' ('+so[G].who+') at '+so[G].at);
  if(fr.d<0.5)fails.push(k+' palm frond '+fr.d.toFixed(3)+' m < 0.5 ('+fr.who+') at '+fr.at+' h '+fr.h);
  if(v.d<keep)fails.push(k+' vegetation '+v.d.toFixed(3)+' m < '+keep+' at '+v.at+' ('+v.who+', top y '+v.top+')');
  if(y.d>0.03)fails.push(k+' terrain-follow y-floor '+y.d.toFixed(3)+' m > 0.03 at '+y.at+' (y '+y.y+', floor '+y.floor+')');
  if(ed.d<0.15)fails.push(k+' drop-off edge '+ed.d+' m < 0.15 at '+ed.at+' (drop '+ed.drop+')');
  if(t.d<1)fails.push(k+' trunk '+t.d.toFixed(3)+' m < 1 ('+t.who+')');}
 if(fails.length){console.error('island-walk-gates FAIL\n '+fails.join('\n '));process.exit(1);}
 console.log('island-walk-gates PASS');
})().catch(e=>{console.error(e);process.exit(1);});
