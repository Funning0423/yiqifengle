#!/usr/bin/env node
'use strict';
/**
 * Bake region/RegionNodes.ts from the frozen region GLBs.
 * Grid rules are the ones in maps/topmap.cjs (code wins over the design's 0.8 normal cutoff):
 *   cell 0.2 m island / 0.4 m meadow+sky, floor normal |ny|/len > 0.72,
 *   neighbour height limit STEP*hypot*(cell/0.4) with STEP 0.36, headroom 1.7 m, low clearance 0.3 m.
 * Island and skycity are Draco. Without Blender, decode with draco3d 1.5.7 (DRACO3D or /tmp/draco3d).
 * Usage: node tools/region-nodes/bake-region-nodes.cjs [--check]
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {load,nodeWorlds,vertexMapper}=require('../journey-integration/occlusion/lib-glb.cjs');
const ROOT=path.resolve(__dirname,'../..');
const OUT_TS=path.join(ROOT,'creator-build-project/assets/scripts/region/RegionNodes.ts');
const OUT_JSON=path.join(ROOT,'tools/region-nodes/region-nodes.json');
const FIX=path.join(ROOT,'tools/region-nodes/fixtures');
const STEP=.36,HEAD=1.7,LOW=.3,FOOT_R=.1;
// b19 basket obstacles (state-toggled at runtime, never baked): edge paths keep r+clearM+ROUTE_MARGIN away from every disc
const ROUTE_MARGIN=.25;
const BASKET_DISCS=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'../transitions-continuous/transition-anchors.json'),'utf8')).basketObstacles||[];
const REGIONS={
 island:{
  file:'creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb',
  draco:true,box:[-12,-14,16,18],c:.2,
  // b20 walkable-terrain: floor is TERRAIN ONLY. env_island_props_merged (flowers / bushes / grass tufts / rocks merged into one mesh) and
  // env_beach_shells_starfish are props, not ground: their tops were baked as floor (bush at x3.6-3.9 z4.6-5.2 at 0.23-0.26 m over 0.06-0.10 m
  // terrain; (4.5,4.07) at 0.30 m). They stay SOLID, so anything taller than LOW (0.3 m) over the terrain blocks its cells.
  floor:/env_island_main|env_beach_wet_sand|env_beach_tide_pools|env_lighthouse_ext/,
  solid:/env_island_main|env_island_props_merged|env_lighthouse_ext|env_lighthouse_door|env_prop_palm|env_beach_tide/,
  start:[-2.1,0,5.3],sea:-0.6,explore:[-15,-16,19,18],
  densifyM:.1,solidKeepM:.15,solidPropKeepM:1,solidKeep:/env_island_props_merged/,
  // b19 dock models: the resident pier (region_island/ui-props/island_dock.glb, island coordinates) is floor + solid
  extras:[{file:'creator-build-project/assets/bundles/region_island/ui-props/island_dock.glb',floor:/island_dock/,solid:/island_dock/}],
  // b20 island-walk-fixes: env_prop_palm_young_01 is SKINNED; this loader ignores skins and puts it ~3 m off (x5-7.4,z4-6.3). Its rendered
  // trunk (glTF skin / Blender / engine) stands at x2.6-3.5, z2.25-3.05 m, which the I4-I5 edge walked through. Route-only keep-out (walkability unchanged).
  // b20 i4nudge: young-palm keep-out widened to 1.45 m (trunk/root >= 1.09 m from every route); two grass-tuft keep-outs (props_merged tops 0.2-0.3 m) at the new I4 legs.
  routeAvoid:[[3.04,2.64,1.45],[4.6,3.8,0.35],[3.85,4.8,0.3],[4.8,7.8,1.3],[7.6,7.2,0.75],[2.1,3.5,0.5],[0.15,8.85,1.3]],
 },
 meadow:{
  file:'creator-build-project/assets/bundles/region_meadow/env_meadow.glb',
  draco:false,box:[-40,-45,40,45],c:.4,
  floor:/meadow_terrain|meadow_path|meadow_river_bank/,
  solid:/meadow_terrain|meadow_path|meadow_river_bank|meadow_fence|meadow_trees|windmill_static|wind_bell_frame/,
  start:[0.2,1.22,20],explore:[-30,-35,30,30],
  // b19 basket obstacles: the parked basket at the M6 yard is a STATE-TOGGLED obstacle (BasketObstacles.ts, data
  // transition-anchors.json basketObstacles); it is NOT baked into the walkable cells. Node-to-node paths still route round it
  // (routeDiscs, r + clearM + routeMarginM) so M4-M6 / M5-M6 stay valid while the disc is on.
  routeDiscs:'meadow',
  // b19: the yard fence (meadow_fence_merged, (3.1,-21.0)->(8.3,-25.4)) has rails the 0.2 m triangle sampling lets through at the
  // 0.4 m cell size; it is a wall here so M4/M5 -> M6 go round its west end (the gate), as in stances.json 3_meadow_balloon_in.
  walls:[[3.1,-21.0,8.3,-25.4,.25]],
 },
 skycity:{
  file:'creator-build-project/assets/bundles/region_skycity/env_skycity.glb',
  draco:true,box:[-60,-50,45,80],c:.4,
  floor:/static_palette|env_sky_ruins|state_court_after$|static_rock_strata|state_bridge_after/,
  solid:/static_palette|env_sky_ruins|state_court_after$|static_rock_strata|state_gate_after$|env_sky_windchime|state_bridge_after|chr_robot/,
  start:[5.25,-0.084,40.6],explore:[-37,-45,42,55],ridge:true,keepNodeComponents:true,tapObstacles:true,
  // b17 skycity-walk-r2: the orbit lens has its own (smaller) box = the baked floor's extent, not the walk/focus box
  lens:[-34.8,-41,39.6,47.6],
  // b17 skycity-walk-r3 (Mac p0drag7): the two giant tree roots that lean on the blue-roof house east of S3 (one sloped 2-tri
  // sliver of env_sky_static_palette from (17.6,-0.4,-4.5) up to the annex top y≈2 at (21.3,1.45,7.2)) are decoration, not a ramp.
  // She walked up them onto the annex (20.84,1.65,7.13) and every tap west was 'none'. Floors > minY above ground here are not walkable.
  // b17 skycity-walk-r4 方案 C (p0drag9): the pocket west of the low ruin fence at (13,7.4) (fence x≈13.5 to the east, the wide wall
  // block z≥10 to the north): standing in it, 90–130° of the 6 m orbit around her is inside the fence / house. Ground there is
  // not walkable; a tap into it stops her on the open ground west of it (blocked arc ≤ 80°). No GLB change.
  noWalk:[[17.0,-5.2,22.8,14.6,0.3],[12.0,6.8,13.4,10.2,-9]],
  // b19 dock models: landing deck sky_mooring_deck + posts and 5a mooring C (stakes, stool) from region_skycity/sky_mooring_props.glb;
  // moored baskets at the landing and at 5a: state-toggled (BasketObstacles), routed round, not baked
  extras:[{file:'creator-build-project/assets/bundles/region_skycity/sky_mooring_props.glb',floor:/sky_mooring_deck|balloon_step_stool/,solid:/sky_mooring_deck|sky_mooring_posts|sky_mooring_5a_stakes|balloon_step_stool/}],
  routeDiscs:'skycity',
  // GGbot full7: S3→S4 grazed the stump cells (local x 4.6–6.2, z 0.2–1.4; reported at (4.8,1.2)) by ~0.28 m for a 0.3 m body
  routeAvoid:[[5.4,0.8,1.3]],
 },
};
const NODES={
 island:[
  {key:'I1',at:[-2.1,0,5.3],role:'mainline',stageId:'mainline-01'},
  {key:'I2',at:[2.5,0,8.1],role:'mainline',stageId:'mainline-02'},
  {key:'I3',at:[6.1,-0.452,9.1],role:'mainline',stageId:'mainline-03'/* b20 option E (Grok Bot): was [8.1,-0.36,6.1] (stand 67% hidden by beach_palm_short, I3-I4 lean_01 push-in 89%); trees unchanged */},
  {key:'I4',at:[4.1,0.1,4.1],role:'mainline',stageId:'mainline-04'/* b19 island-depart-walk (方案 E): was [4.5,0.23,-4.9] (I4-I6 18.03 m, cut 4.1 m + fade + 3.6 m); b20 i4nudge: was [4.1,0.11,2.7] (stood under the skinned palm_young_01 canopy: crown/face grazed in the L04 push-in) -> 1.25 m NW, canopy clear; b20 I4-approach (option 2): was [3.9,0.089,4.0] (snapped 3.9,4.1) -> 0.2 m E, room for the NodeWalker I3→I4 waypoint curve east of routeAvoid [3.85,4.8,0.3] (30fps heading accel p99 206 -> 197) */},
  {key:'I5',at:[-2.5,0.133,1.3],role:'optional',opens:'challenge-island'/* b20 island-walk-fixes: was [-4.5,0.13,-0.9] (I4-I5 10.94 m, I5-I6 11.44 m, both cut); now both <= DIRECT_MAX_M */},
  {key:'I6',at:[-1.5,-0.18,9.3],role:'departure'},
 ],
 meadow:[
  {key:'M0',at:[1.8,1.725,15.6],role:'arrival'/* b20 meadow-walk-fixes: was [0.2,1.22,20] (M0-M1 14.19 m cut), then [0.2,1.76,15.2] (on grass); now on the path */},
  {key:'M1',at:[2.2,2.76,6.8],role:'mainline',stageId:'mainline-05'},
  {key:'M2',at:[-1.4,3.41,-0.94],role:'mainline',stageId:'mainline-06'},
  {key:'M3',at:[-3.0,4.14,-9.64],role:'mainline',stageId:'mainline-07'},
  {key:'M4',at:[3,5.84,-16.4],role:'mainline',stageId:'mainline-08'},
  {key:'M5',at:[6.6,6.47,-21.2],role:'optional',opens:'challenge-meadow'},
  {key:'M6',at:[0.2,6.49,-24.8],role:'departure'/* b19 gate-handoff: was -25.6 (body 0.3 m clipped windmill_static by 8 cm); now gap 0.70 m */},
 ],
 skycity:[
  {key:'S0',at:[5.25,-0.084,40.6],role:'arrival'},
  {key:'S1',at:[0.2,0.04,30.2],role:'mainline',stageId:'mainline-09'},
  {key:'S2',at:[-7,-0.06,19],role:'mainline',stageId:'mainline-10'/* b19 s2s3-edge: was -6.6 (0.2 m from an unwalkable cell) */},
  {key:'S3',at:[6.2,-0.01,8.2],role:'mainline',stageId:'mainline-11'},
  {key:'S4',at:[0.2,2.98,-5.4],role:'mainline',stageId:'mainline-12'/* b19 s4-clearance: was [0.2,3.31,-5.8] (0.2 m from the parapet) */},
  {key:'S5',at:[0.2,0.08,-17],role:'optional',opens:'challenge-sky'},
  {key:'S6',at:[0.2,0.03,-27.8],role:'finale'},
 ],
};
const EDGES={
 island:[['I1','I2'],['I2','I3'],['I3','I4'],['I4','I5'],['I5','I6'],['I4','I6']],
 meadow:[['M0','M1'],['M1','M2'],['M2','M3'],['M3','M4'],['M4','M5'],['M5','M6'],['M4','M6']],
 skycity:[['S0','S1'],['S1','S2'],['S2','S3'],['S3','S4'],['S4','S5'],['S5','S6'],['S4','S6']],
};
function dracoDir(){
 const c=[process.env.DRACO3D,path.join('/tmp/draco3d/node_modules/draco3d'),path.join(ROOT,'tools/vendor-node/node_modules/draco3d')].filter(Boolean);
 return c.find(d=>fs.existsSync(path.join(d,'draco3d.js')))||null;
}
function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function buildGrid(spec,stamp){
 const [x0,z0,x1,z1]=spec.box,c=spec.c,W=Math.ceil((x1-x0)/c),H=Math.ceil((z1-z0)/c);
 const floors=Array.from({length:W*H},()=>[]),solids=Array.from({length:W*H},()=>[]);
 const solidXZ=spec.solidKeepM?Array.from({length:W*H},()=>[]):null;
 const cell=(x,z)=>{const gx=Math.floor((x-x0)/c),gz=Math.floor((z-z0)/c);if(gx<0||gz<0||gx>=W||gz>=H)return -1;return gz*W+gx;};
 const ftri=spec.densifyM?new Map():null,FB=.5;
 const addTri=(isF,isS,A,B,C,isK=false)=>{
  if(ftri&&isF){const nx0=(B[1]-A[1])*(C[2]-A[2])-(B[2]-A[2])*(C[1]-A[1]),ny0=(B[2]-A[2])*(C[0]-A[0])-(B[0]-A[0])*(C[2]-A[2]),nz0=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);
   if(Math.abs(ny0)>1e-9)for(let i=Math.floor(Math.min(A[0],B[0],C[0])/FB);i<=Math.floor(Math.max(A[0],B[0],C[0])/FB);i++)for(let j=Math.floor(Math.min(A[2],B[2],C[2])/FB);j<=Math.floor(Math.max(A[2],B[2],C[2])/FB);j++){const k=i+','+j;if(!ftri.has(k))ftri.set(k,[]);ftri.get(k).push([A,B,C]);}}
  const e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
  const nx=e1[1]*e2[2]-e1[2]*e2[1],ny=e1[2]*e2[0]-e1[0]*e2[2],nz=e1[0]*e2[1]-e1[1]*e2[0],nl=Math.hypot(nx,ny,nz)||1,up=Math.abs(ny)/nl;
  const L=Math.max(Math.hypot(e1[0],e1[1],e1[2]),Math.hypot(e2[0],e2[1],e2[2]),Math.hypot(C[0]-B[0],C[1]-B[1],C[2]-B[2]));
  const N=Math.max(1,Math.ceil(L/(c*.5)));
  for(let i=0;i<=N;i++)for(let j=0;j<=N-i;j++){const u=i/N,v=j/N,x=A[0]+e1[0]*u+e2[0]*v,y=A[1]+e1[1]*u+e2[1]*v,z=A[2]+e1[2]*u+e2[2]*v,ci=cell(x,z);if(ci<0)continue;
   if(isF&&up>.72)floors[ci].push(y);if(isS){solids[ci].push(y);if(solidXZ&&isK)solidXZ[ci].push(x,y,z);}}
 };
 stamp(addTri);
 const layers=floors.map(a=>{a.sort((p,q)=>p-q);const o=[];for(const y of a){if(o.length&&y-o[o.length-1].hi<.15)o[o.length-1].hi=y;else o.push({lo:y,hi:y});}return o.map(l=>l.hi);});
 const ok=layers.map((ls,ci)=>ls.map(y=>{const s=solids[ci];for(const q of s)if(q>y+LOW&&q<y+HEAD)return false;for(const y2 of ls)if(y2>y+.2&&y2<y+HEAD)return false;return true;}));
 // b17 skycity-walk-r2: wall / rail tops are not floor. A layer that has no neighbour layer within STEP on BOTH sides of one axis
 // (x or z) - not even diagonally, so a 1-cell diagonal ramp stays -, i.e. it is one cell thin across, with floor > .5 m lower on BOTH sides of that axis, is a wall / rail top (the 0.2 m ruin wall east of S3 was walkable
 // and made a 26 m detour through the porch). Only for regions with spec.ridge.
 if(spec.ridge){const near=(ci,y)=>ci>=0&&layers[ci].some((y2,l2)=>ok[ci][l2]&&Math.abs(y2-y)<=STEP);const nb=(gx,gz)=>gx<0||gz<0||gx>=W||gz>=H?-1:gz*W+gx;
  const drop=[];layers.forEach((ls,ci)=>{const gx=ci%W,gz=(ci/W)|0;ls.forEach((y,li)=>{if(!ok[ci][li])return;
   const low=n=>n>=0&&layers[n].some(y2=>y2<y-.5);
   const side=(cs)=>cs.every(([a,b])=>!near(nb(a,b),y));
   const wallX=side([[gx-1,gz-1],[gx-1,gz],[gx-1,gz+1],[gx+1,gz-1],[gx+1,gz],[gx+1,gz+1]])&&low(nb(gx-1,gz))&&low(nb(gx+1,gz));
   const wallZ=side([[gx-1,gz-1],[gx,gz-1],[gx+1,gz-1],[gx-1,gz+1],[gx,gz+1],[gx+1,gz+1]])&&low(nb(gx,gz-1))&&low(nb(gx,gz+1));
   if(wallX||wallZ)drop.push([ci,li]);});});
  for(const [ci,li] of drop)ok[ci][li]=false;}
 if(spec.noWalk)for(const [ax,az,bx,bz,ymin] of spec.noWalk)layers.forEach((ls,ci)=>{const x=x0+(ci%W+.5)*c,z=z0+(((ci/W)|0)+.5)*c;
  if(x>=ax&&x<=bx&&z>=az&&z<=bz)ls.forEach((y,li)=>{if(y>ymin)ok[ci][li]=false;});});
 const route=new Set();
 if(spec.routeDiscs)for(const o of BASKET_DISCS().filter(o=>o.region===spec.routeDiscs))layers.forEach((ls,ci)=>{const x=x0+(ci%W+.5)*c,z=z0+(((ci/W)|0)+.5)*c;if(Math.hypot(x-o.at[0],z-o.at[1])<=o.r+o.clearM+ROUTE_MARGIN)route.add(ci);});
 // b19 s2s3-edge (场景设计部): route-only keep-outs (walkability unchanged) — node edges keep ≥0.4 m from these unwalkable blobs
 // b20 walkable-terrain: route keep-out round every solid sample that stands LOW..HEAD over the top floor of its cell (bushes, flowers,
 // grass tufts > 0.3 m, rocks: the spec.solidKeep meshes): node edges keep >= solidKeepM + 5 cm (cell centres) and simplified segments keep >= solidKeepM (5 cm samples)
 // from it. Walkability unchanged (props are not floor any more, so the tall ones already block their own cells).
 let tall=null;
 if(solidXZ){tall=new Map();const B=.5,kb=(x,z)=>Math.floor(x/B)+','+Math.floor(z/B);
  // footprint = the part of each plant/prop that stands LOW..HEAD (> 0.3 m) over the cell's top floor; flat-lying blade tips lower than
  // LOW may be crossed. Keep-out is solidKeepM round that footprint.
  const top=ci=>Math.max(...layers[ci]),prot=new Map();
  solidXZ.forEach((a,ci)=>{if(!a.length||!layers[ci].length)return;const f=top(ci);const pts=[];let hi=false;for(let k=0;k<a.length;k+=3){const y=a[k+1];if(y>f+LOW&&y<f+HEAD){pts.push(a[k],a[k+2]);hi=true;}}if(pts.length)prot.set(ci,{pts,hi});});
  const seen=new Set();for(const ci0 of prot.keys()){if(seen.has(ci0))continue;const blob=[ci0];seen.add(ci0);for(let q=0;q<blob.length;q++){const ci=blob[q],gx=ci%W,gz=(ci/W)|0;
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const nx=gx+dx,nz=gz+dz;if(nx<0||nz<0||nx>=W||nz>=H)continue;const n=nz*W+nx;if(prot.has(n)&&!seen.has(n)){seen.add(n);blob.push(n);}}}
   if(!blob.some(ci=>prot.get(ci).hi))continue;
   for(const ci of blob){const a=prot.get(ci).pts;for(let k=0;k<a.length;k+=2){const kk=kb(a[k],a[k+1]);if(!tall.has(kk))tall.set(kk,[]);tall.get(kk).push(a[k],a[k+1]);}}}
  const R=spec.solidKeepM,near=(x,z,r)=>{for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const a=tall.get((Math.floor(x/B)+i)+','+(Math.floor(z/B)+j));if(a)for(let k=0;k<a.length;k+=2)if(Math.hypot(a[k]-x,a[k+1]-z)<r)return true;}return false;};
  tall.near=near;layers.forEach((ls,ci)=>{const x=x0+(ci%W+.5)*c,z=z0+(((ci/W)|0)+.5)*c;if(near(x,z,R+.05))route.add(ci);});}
  // b20 prop classes: env_island_props_merged sub-objects classed 'solid' (rocks, planters, fence, bench; fixtures/island-props-classes.json)
  // keep their graded keepM (height <= 0.7 m: 0.5 m, taller: 1 m; spec.solidPropKeepM switches it on) from her centre for every vertex / edge midpoint in her body range (floor + 0.05 .. floor + 1.8 m).
  if(tall&&spec.solidPropKeepM){const CP=require('./classify-island-props.cjs'),CLS=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/island-props-classes.json'),'utf8')).components;
   const idx=new Map(CLS.map(o=>[o.cx+','+o.cz+','+o.tris,o]));const SB=new Map(),B1=1;let unk=0;
   for(const o of CP.components(CP.propsMesh())){const e=idx.get(o.cx+','+o.cz+','+o.tris);if(!e){unk++;continue;}if(e.cls!=='solid')continue;const v=o.v;
    const KP=e.keepM,FP=e.footprint?1:0,add=(x,y,z)=>{const kk=Math.floor(x/B1)+','+Math.floor(z/B1);if(!SB.has(kk))SB.set(kk,[]);SB.get(kk).push(x,y,z,KP,FP);};
    for(let k=0;k<v.length;k+=9){for(let j=0;j<9;j+=3)add(v[k+j],v[k+j+1],v[k+j+2]);for(const [a,b] of [[0,3],[3,6],[6,0]])add((v[k+a]+v[k+b])/2,(v[k+a+1]+v[k+b+1])/2,(v[k+a+2]+v[k+b+2])/2);}}
   if(unk)throw Error(unk+' props sub-objects not in fixtures/island-props-classes.json (re-run classify-island-props.cjs)');
   // palm fronds (b20): palm geometry in her body range keeps 0.45 m here (cell centres add 0.05 = 0.5 m; the gate checks 0.5 m on the 5 cm polyline)
   for(const o of require('../journey-integration/journey-scene.cjs').island)if(/palm/.test(o.name)){const v=o.tris;for(let k=0;k<v.length;k+=9){const add=(x,y,z)=>{const kk=Math.floor(x/B1)+','+Math.floor(z/B1);if(!SB.has(kk))SB.set(kk,[]);SB.get(kk).push(x,y,z,0.45,0);};for(let j=0;j<9;j+=3)add(v[k+j],v[k+j+1],v[k+j+2]);for(const [a,b] of [[0,3],[3,6],[6,0]])add((v[k+a]+v[k+b])/2,(v[k+a+1]+v[k+b+1])/2,(v[k+a+2]+v[k+b+2])/2);}}
   const SR=spec.solidPropKeepM,nearSolid=(x,y,z,r)=>{for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const a=SB.get((Math.floor(x/B1)+i)+','+(Math.floor(z/B1)+j));if(a)for(let k=0;k<a.length;k+=5){const h=a[k+1]-y;if((a[k+4]||(h>0.05&&h<1.8))&&Math.hypot(a[k]-x,a[k+2]-z)<a[k+3]+r)return true;}}return false;};
   tall.nearSolid=nearSolid;layers.forEach((ls,ci)=>{if(!ls.length)return;const x=x0+(ci%W+.5)*c,z=z0+(((ci/W)|0)+.5)*c;if(nearSolid(x,Math.max(...ls),z,.05))route.add(ci);});}
 if(spec.routeAvoid)for(const [ax,az,ar] of spec.routeAvoid)layers.forEach((ls,ci)=>{const x=x0+(ci%W+.5)*c,z=z0+(((ci/W)|0)+.5)*c;if(Math.hypot(x-ax,z-az)<=ar)route.add(ci);});
 if(spec.walls)for(const [ax,az,bx,bz,hw] of spec.walls)layers.forEach((ls,ci)=>{const x=x0+(ci%W+.5)*c,z=z0+(((ci/W)|0)+.5)*c;
  const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));if(Math.hypot(x-ax-dx*t,z-az-dz*t)<=hw)ls.forEach((y,li)=>{ok[ci][li]=false;});});
 if(spec.sea!==undefined)layers.forEach((ls,ci)=>ls.forEach((y,li)=>{if(y<spec.sea)ok[ci][li]=false;}));
 const cellOf=p=>cell(p[0],p[2]);
 const s=cellOf(spec.start);let sl=-1,bd=9;
 if(s>=0)layers[s].forEach((y,li)=>{if(ok[s][li]&&Math.abs(y-spec.start[1])<bd){bd=Math.abs(y-spec.start[1]);sl=li;}});
 if(sl<0)throw Error('start-not-walkable '+spec.file);
 const seen=new Map(),key=(ci,li)=>ci*8+li,dist=new Map(),parent=new Map();
 const q=[[s,sl]];seen.set(key(s,sl),1);dist.set(key(s,sl),0);parent.set(key(s,sl),null);
 let qi=0;
 while(qi<q.length){const [ci,li]=q[qi++],y=layers[ci][li],gx=ci%W,gz=(ci/W)|0,d0=dist.get(key(ci,li));
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=gx+dx,nz=gz+dz;if(nx<0||nz<0||nx>=W||nz>=H)continue;const nc=nz*W+nx;const lim=STEP*Math.hypot(dx,dz)*(c/.4);
   layers[nc].forEach((y2,l2)=>{if(!ok[nc][l2]||Math.abs(y2-y)>lim)return;const k=key(nc,l2);if(seen.has(k))return;seen.set(k,1);parent.set(k,key(ci,li));dist.set(k,d0+Math.hypot(dx,dz)*c);q.push([nc,l2]);});}}
 // b17 skycity-walk-r4: the solid surface samples per cell (0.2 m on every triangle) feed the tap-ray voxel field (RegionWalkableData.obs)
 // b20 terrain-follow: exact floor height (highest floor-mesh triangle at or below yMax, any slope) for path densification
 const floorAt=ftri?((x,z,yMax)=>{let best=null;for(const [A,B,C] of ftri.get(Math.floor(x/FB)+','+Math.floor(z/FB))||[]){const d=(B[2]-C[2])*(A[0]-C[0])+(C[0]-B[0])*(A[2]-C[2]);if(Math.abs(d)<1e-12)continue;
  const l1=((B[2]-C[2])*(x-C[0])+(C[0]-B[0])*(z-C[2]))/d,l2=((C[2]-A[2])*(x-C[0])+(A[0]-C[0])*(z-C[2]))/d,l3=1-l1-l2;if(l1<-1e-9||l2<-1e-9||l3<-1e-9)continue;const y=l1*A[1]+l2*B[1]+l3*C[1];if(y<=yMax&&(best===null||y>best))best=y;}return best;}):null;
 // b20 dock-fix: ground under her = highest floor point within a FOOT_R (0.1 m) disc under her foot (centre + rings at r/2, r, 8 directions),
 // so board seams narrower than her foot read as the boards; gaps wider than the disc (> 0.2 m) still read as holes.
 const floorDisc=floorAt?((x,z,yMax,r=FOOT_R)=>{let best=floorAt(x,z,yMax);for(const rr of [r/2,r])for(let k=0;k<8;k++){const y=floorAt(x+rr*Math.cos(k*Math.PI/4),z+rr*Math.sin(k*Math.PI/4),yMax);if(y!==null&&(best===null||y>best))best=y;}return best;}):null;
 return {W,H,c,x0,z0,layers,ok,dist,parent,key,cell,solids,route,tall,floorAt,floorDisc};
}
function nearest(M,p,ytol=1.5){
 const ci=M.cell(p[0],p[2]);if(ci<0)return null;let best=null;
 M.layers[ci].forEach((y,li)=>{const k=M.key(ci,li);if(M.dist.has(k)&&Math.abs(y-p[1])<ytol&&(!best||Math.abs(y-p[1])<best.e))best={k,e:Math.abs(y-p[1])};});
 if(best)return best;
 // search a small neighbourhood if the exact cell missed the flood
 for(let r=1;r<=6&&!best;r++){const gx=ci%M.W,gz=(ci/M.W)|0;
  for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;const nx=gx+dx,nz=gz+dz;if(nx<0||nz<0||nx>=M.W||nz>=M.H)continue;const nc=nz*M.W+nx;
   M.layers[nc].forEach((y,li)=>{const k=M.key(nc,li);if(M.dist.has(k)&&Math.abs(y-p[1])<ytol+r*M.c&&(!best||M.dist.get(k)<best.d))best={k,e:Math.abs(y-p[1]),d:M.dist.get(k)};});}}
 return best;
}
function pathOf(M,k){const out=[];let cur=k;while(cur!==null&&cur!==undefined){const ci=(cur/8)|0,li=cur%8;out.push([+(M.x0+(ci%M.W+.5)*M.c).toFixed(3),+M.layers[ci][li].toFixed(3),+(M.z0+(((ci/M.W)|0)+.5)*M.c).toFixed(3)]);cur=M.parent.get(cur);}return out.reverse();}
function distPointSeg(p,a,b){const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],tMax=ab[0]*ab[0]+ab[1]*ab[1]+ab[2]*ab[2]||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*ab[0]+(p[1]-a[1])*ab[1]+(p[2]-a[2])*ab[2])/tMax));
 const q=[a[0]+ab[0]*t,a[1]+ab[1]*t,a[2]+ab[2]*t];return Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);}
// b19 s4-clearance: segOk(a,b) (optional) vetoes a shortcut whose straight segment loses clearance (GGbot full8: S4-S5/S4-S6
// simplified a diagonal across the corner at (10.4,-9.6) to 0 m). Clear edges pass segClear(minM) built on the runtime walk grid.
function simplify(path,eps=.15,segOk=null){if(path.length<3)return path;const keep=[0];let i=0;while(i<path.length-1){let j=i+1;for(let k=i+2;k<path.length;k++){let ok=true;for(let t=i+1;t<k;t++)if(distPointSeg(path[t],path[i],path[k])>eps){ok=false;break;}if(ok&&segOk&&!segOk(path[i],path[k]))ok=false;if(!ok)break;j=k;}keep.push(j);i=j;}return keep.map(i=>path[i]);}
/** min box distance (m) from segment a-b (xz) to runtime-unwalkable 0.4 m cells ≥ minM. */
function segClear(id,minM){const RW=require('../board-ui/harness.cjs').createHarness().load('region/RegionWalkable.ts'),C=0.4,memo=new Map();
 // same probe as tools/skycity-walk/test_sky_s2s3_edge_clearance.cjs: 0.4 m boxes centred on the 0.4 m lattice, 5 cm samples
 const isNull=(cx,cz)=>{const k=cx+','+cz;if(!memo.has(k))memo.set(k,RW.walkFloorY(id,cx,cz)===null);return memo.get(k);};
 const clearAt=(x,z)=>{const r=Math.ceil((minM+C)/C)+1,gx=Math.round(x/C)*C,gz=Math.round(z/C)*C;
  for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){const cx=+(gx+i*C).toFixed(2),cz=+(gz+j*C).toFixed(2);if(!isNull(cx,cz))continue;
   if(Math.hypot(Math.max(0,Math.abs(x-cx)-C/2),Math.max(0,Math.abs(z-cz)-C/2))<minM-1e-9)return false;}return true;};
 return (a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/0.05));for(let s=0;s<=n;s++)if(!clearAt(a[0]+(b[0]-a[0])*s/n,a[2]+(b[2]-a[2])*s/n))return false;return true;};}
function faceDeg(from,to){const dx=to[0]-from[0],dz=to[2]-from[2];return +((Math.atan2(dx,dz)*180/Math.PI)).toFixed(2);}
async function decodeDraco(file,spec){
 const dir=dracoDir();if(!dir){
  const gz=path.join(FIX,path.basename(file)+'.walk.gz');
  if(!fs.existsSync(gz))throw Error('no blender and no fixture '+gz);
  return {fixture:gz,sha:sha256(gz)};
 }
 const draco=require(path.join(dir,'draco3d.js'));const decMod=await draco.createDecoderModule({});
 const stampGlb=(gfile,floorRx,solidRx,addTri)=>{
  const raw=fs.readFileSync(path.join(ROOT,gfile));const jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString());
  const binOff=20+jl+8,bin=raw.subarray(binOff,binOff+raw.readUInt32LE(20+jl));
  // b20 skin-bounds: vertices go through lib-glb vertexMapper (skinned → joint world · inverseBind, as Creator renders them)
  const worlds=nodeWorlds(doc),ibm=si=>{const A=doc.accessors[doc.skins[si].inverseBindMatrices],v=doc.bufferViews[A.bufferView],o=(v.byteOffset||0)+(A.byteOffset||0);return k=>Array.from({length:16},(_,e)=>bin.readFloatLE(o+(k*16+e)*4));};
  doc.nodes.forEach((node,i)=>{if(node.mesh===undefined)return;const name=node.name||'';const isF=floorRx.test(name),isS=solidRx.test(name),isK=!!(spec.solidKeep&&spec.solidKeep.test(name)&&gfile===file);if(!isF&&!isS)return;const map=vertexMapper(doc,i,worlds,node.skin!==undefined?ibm(node.skin):null);
   for(const pr of doc.meshes[node.mesh].primitives){const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;if(!ext)continue;
    const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
    const d=new decMod.Decoder(),buf=new decMod.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);
    const mesh=new decMod.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())throw Error('draco '+name);
    const attr=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces(),pos=new decMod.DracoFloat32Array();
    d.GetAttributeFloatForAllPoints(mesh,attr,pos);const P=new Array(nv);
    const rd=id=>{if(id===undefined)return null;const a=d.GetAttributeByUniqueId(mesh,id),arr=new decMod.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,a,arr);const nc=a.num_components(),o=new Float64Array(nv*4);for(let v=0;v<nv;v++)for(let c=0;c<Math.min(4,nc);c++)o[v*4+c]=arr.GetValue(v*nc+c);decMod.destroy(arr);return o;};
    const JJ=node.skin!==undefined?rd(ext.attributes.JOINTS_0):null,WW=node.skin!==undefined?rd(ext.attributes.WEIGHTS_0):null;
    for(let v=0;v<nv;v++)P[v]=map([pos.GetValue(v*3),pos.GetValue(v*3+1),pos.GetValue(v*3+2)],JJ&&JJ.subarray(v*4,v*4+4),WW&&WW.subarray(v*4,v*4+4));
    const face=new decMod.DracoInt32Array();
    for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,face);addTri(isF,isS,P[face.GetValue(0)],P[face.GetValue(1)],P[face.GetValue(2)],isK);}
    [pos,face,mesh,buf,d].forEach(o=>decMod.destroy(o));}});};
 const grid=buildGrid(spec,(addTri)=>{stampGlb(file,spec.floor,spec.solid,addTri);for(const e of spec.extras||[])stampGlb(e.file,e.floor,e.solid,addTri);});
 return {grid,sha:sha256(path.join(ROOT,file)),decoder:'draco3d@1.5.7'};
}
function decodePlain(file,spec){
 const nodes=load(path.join(ROOT,file));
 const grid=buildGrid(spec,(addTri)=>{
  for(const n of nodes){if(!n.tris||!n.tris.length)continue;const isF=spec.floor.test(n.name),isS=spec.solid.test(n.name);if(!isF&&!isS)continue;const t=n.tris;
   for(let k=0;k<t.length;k+=9)addTri(isF,isS,[t[k],t[k+1],t[k+2]],[t[k+3],t[k+4],t[k+5]],[t[k+6],t[k+7],t[k+8]]);}});
 return {grid,sha:sha256(path.join(ROOT,file)),decoder:'lib-glb'};
}
function round3(n){return Math.round(n*1000)/1000;}
function emit(baked){
 const body={};
 for(const id of Object.keys(REGIONS)){
  const spec=REGIONS[id],g=baked[id].grid,by={};
  const nodes=NODES[id].map(n=>{const hit=nearest(g,n.at,2.5);if(!hit)throw Error('node-off-grid '+n.key);const p=pathOf(g,hit.k);const at=p[p.length-1].slice();if(spec.densifyM&&g.floorAt){const y=g.floorDisc(at[0],at[2],at[1]+.4);if(y!==null&&Math.abs(y-at[1])<=.2)at[1]=round3(y);}/* b20 terrain-follow: she stands on the floor mesh, not on the 0.2 m cell's highest sample */by[n.key]={...n,at};return {...n,at};});
  const edges=[];
  for(const [a,b] of EDGES[id]){
   const A=by[a].at,B=by[b].at,ka=nearest(g,A,0.6),kb=nearest(g,B,0.6);
   if(!ka||!kb)throw Error('edge-endpoint '+a+b);
   // Reconstruct A* from A to B by flooding a second time is expensive; walk parent chains via a targeted BFS from A.
   // b19 s2s3-edge: listed edges keep one free 0.4 m cell from every unwalkable cell (exempt within EXEMPT_M of either node); fallback = plain
   const clearEdge=(CLEAR_EDGES[id]||[]).some(([p,q])=>(p===a&&q===b)||(p===b&&q===a));
   const leg=(P,Q)=>(clearEdge&&bfs(g,P,Q,clearBuffer(g,P,Q,id)))||bfs(g,P,Q);
   // b19 s4-clearance: optional pinned waypoints (EDGE_VIA) so a re-routed edge keeps its old arrival heading into the node
   // b20: a via marked 'direct' leaves on a straight leg (no 0.2 m grid) when the exact keep-out checks pass every 5 cm (veg footprint, graded solids,
   // fronds, routeAvoid); for gaps narrower than a grid cell (young palm frond tips vs the tuft at (3.26,4.81)). Throws if the straight leg is not clear.
   const directLeg=(P,Q)=>{const fy=(x,z)=>g.floorDisc?g.floorDisc(x,z,2):0;const n=Math.max(1,Math.ceil(Math.hypot(Q[0]-P[0],Q[2]-P[2])/0.05)),out=[];
    for(let t=0;t<=n;t++){const x=P[0]+(Q[0]-P[0])*t/n,z=P[2]+(Q[2]-P[2])*t/n,y=fy(x,z);if(y===null)throw Error('direct-leg off floor '+a+b+' '+x+','+z);
     if(g.tall&&g.tall.near(x,z,spec.solidKeepM))throw Error('direct-leg vegetation '+a+b+' '+x.toFixed(2)+','+z.toFixed(2));if(g.tall&&g.tall.nearSolid&&g.tall.nearSolid(x,y,z,.05))throw Error('direct-leg solid/frond '+a+b+' '+x.toFixed(2)+','+z.toFixed(2));
     for(const [cx,cz,cr] of spec.routeAvoid||[])if(Math.hypot(x-cx,z-cz)<cr)throw Error('direct-leg routeAvoid '+a+b);if(t===0||t===n)out.push([x,y,z]);}
    return {path:out,len:Math.hypot(Q[0]-P[0],Q[2]-P[2])};};
   const via=(EDGE_VIA[id]||{})[a+'-'+b];let path;
   if(!via)path=leg(A,B);else{const pts=[A,...via.map(v=>[v[0],0,v[1]]),B];path={path:[],len:0};for(let i=0;i<pts.length-1;i++){const dv=i>0&&via[i-1][2]==='direct'||i<via.length&&via[i][2]==='direct-in';const q=dv?directLeg(pts[i],pts[i+1]):leg(pts[i],pts[i+1]);if(!q){path=null;break;}path.path.push(...(i?q.path.slice(1):q.path));path.len+=q.len;}}
   if(!path)throw Error('no-path '+a+' '+b);
   const keep=g.tall?((a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/0.05));for(let t=0;t<=n;t++){const x=a[0]+(b[0]-a[0])*t/n,z=a[2]+(b[2]-a[2])*t/n;if(g.tall.near(x,z,spec.solidKeepM))return false;if(g.tall.nearSolid&&g.tall.nearSolid(x,a[1]+(b[1]-a[1])*t/n,z,.05))return false;for(const [cx,cz,cr] of spec.routeAvoid||[])if(Math.hypot(x-cx,z-cz)<cr)return false;}return true;}):null/* simplified segments also stay out of routeAvoid discs (not only cell centres) */;
   const segOk=clearEdge?segClear(id,CLEAR_M):keep;
   let simp=simplify(path.path,.15,segOk),len=path.len;
   const tail=(EDGE_TAIL[id]||{})[a+'-'+b];
   if(tail){const ok=segClear(id,CLEAR_M),RW=require('../board-ui/harness.cjs').createHarness().load('region/RegionWalkable.ts'),E=simp[simp.length-1];
    const k=simp.findIndex(p=>Math.hypot(p[0]-tail.from[0],p[2]-tail.from[1])<1e-6);if(k<0)throw Error('tail-from '+a+b);
    const mid=tail.via.map(([x,z])=>{const y=RW.walkFloorY(id,x,z);if(y===null)throw Error('tail-via-null '+x+','+z);return [x,round3(y),z];});
    const cand=[...simp.slice(0,k+1),...mid,E];for(let q=k;q<cand.length-1;q++)if(!ok(cand[q],cand[q+1]))throw Error('tail-unclear '+a+b+' '+cand[q]+'->'+cand[q+1]);
    simp=cand;/* lengthM stays the grid-route length like every other edge */}
   // b20 terrain-follow: the walker interpolates path-point y linearly, so on slopes a long chord floats over the terrain. Insert a point every
   // densifyM along each segment with y = floor height there (and re-read the vertices), so she follows the ground to <= 3 cm.
   if(spec.densifyM&&g.floorAt){const fy=(x,z,yr)=>{const y=g.floorDisc(x,z,yr+.4);return y===null||Math.abs(y-yr)>.2?round3(yr):round3(y);}/* > 0.2 m off the chord = a hole in the floor mesh (dock gap): keep the chord, the terrain-follow gate reports it */;const out=[[simp[0][0],fy(simp[0][0],simp[0][2],simp[0][1]),simp[0][2]]];
    for(let i=1;i<simp.length;i++){const P=simp[i-1],Q=simp[i],n=Math.max(1,Math.ceil(Math.hypot(Q[0]-P[0],Q[2]-P[2])/spec.densifyM));
     for(let t=1;t<=n;t++){const x=round3(P[0]+(Q[0]-P[0])*t/n),z=round3(P[2]+(Q[2]-P[2])*t/n);out.push([x,fy(x,z,P[1]+(Q[1]-P[1])*t/n),z]);}}out[0]=A.slice();out[out.length-1]=B.slice()/* ends stay exactly on the nodes */;simp=out;len=0;for(let i=1;i<simp.length;i++)len+=Math.hypot(simp[i][0]-simp[i-1][0],simp[i][1]-simp[i-1][1],simp[i][2]-simp[i-1][2]);/* b20 dock-fix: densified edges report the walked polyline length (what NodeWalker times at 1.2 m/s and compares with DIRECT_MAX_M), not the coarse grid-route length (I4-I6 grid 9.774 > DIRECT_MAX_M 9.6 cut the walk in two on b20-walk-merge) */}
   edges.push({a,b,path:simp,lengthM:round3(len)});
  }
  for(const n of nodes){const out=edges.find(e=>e.a===n.key)||edges.find(e=>e.b===n.key);if(!out){n.faceDeg=0;continue;}
   const forward=out.a===n.key?out.path:[...out.path].reverse();n.faceDeg=faceDeg(forward[0],forward[Math.min(1,forward.length-1)]);}
  body[id]={sha256:baked[id].sha,decoder:baked[id].decoder,exploreBox:spec.explore,...(spec.lens?{lensBox:spec.lens}:{}),gridM:spec.c,nodes,edges};
 }
 return body;
}
const CLEAR_EDGES={skycity:[['S1','S2'],['S2','S3'],['S3','S4'],['S4','S5'],['S4','S6']]},EXEMPT_M=0.45,CLEAR_M=0.4;
// S4-S6: after the new gap at (2.6,-7) rejoin the pre-b19 x=3 lane with straight clear segments and keep the pre-b19 arrival
// (3,-25)→S6 (the T-02 finale shot F1/F4 is tuned to that arrival heading; the grid route arrived at -135° and failed F1/F4).
/* b20 option E: I3-I4 waypoints (x,z; y = walkable floor) round the north end of the lean_01 canopy; same list as tools/region-nodes/fixtures/island-i3-i4-waypoints-E.json for NodeWalker waypoint walks */
const EDGE_VIA={island:{'I4-I5':[[3.4,4.2],[2.8,4.2,'direct-in'],[2.45,4.13,'direct-in'],[1.85,4.13,'direct-in'],[0.5,3.9],[-1.7,4.1],[-2.85,2.9,'direct-in'],[-2.15,1.55,'direct-in']]/* b20 graded rules: straight legs through the gap between the young palm's frond tips (>= 0.5 m), the tuft at (3.26,4.81) (+0.15 m) and the low rock_01 footprint (+0.15 m), narrower than a 0.2 m grid cell; b20 I4-approach: (0.5,3.9),(-1.7,4.1) + straight legs (-2.85,2.9),(-2.15,1.55) past the fence keep I4-I5 at 9.465 m after I4 moved 0.2 m E */,'I4-I6':[[0.5,7.3],[-0.9,7.7],[-1.4,7.95]]/* b20: >=1 m from beach_palm_tall trunk; b20 dock-fix: (-1.4,7.95) = foot of the ramp centre line */,'I5-I6':[[-1.4,7.95]]/* b20 dock-fix: climb the ramp on its centre line (was diagonal along the west edge) */,'I3-I4':[[4.9,9.3],[3.7,9.3],[3.3,8.5],[2.8,7.5],[3.0,6.3],[4.4,5.4]]/* b20 walkable-terrain: last via was (3.75,5.4), over the baked-as-floor flower clump at (3.79,4.84); now (2.7,4.9), west of the 0.48 m tuft at (3.26,4.81). The east detour (4.3,5.3),(4.5,4.5) has no solidKeepM gap past the tufts / flowers at (4.49,4.88) and (4.70,3.79); b20 I4-approach: tail (4.3,5.4),(4.55,4.6) -> (4.4,5.4) with I4 at (4.1,4.1): GGbot's waypoint curve clears routeAvoid [3.85,4.8,0.3], 30fps heading accel p99 196.9 */}},EDGE_TAIL={skycity:{'S4-S6':{from:[2.6,-7],via:[[2.6,-9.0],[3,-18.2],[3,-25]]}}};
function clearBuffer(M,A,B,id){// unwalkable = the RUNTIME walk grid (RegionWalkableData via RegionWalkable.walkFloorY), which is what she and the tests walk on
 const RW=require('../board-ui/harness.cjs').createHarness().load('region/RegionWalkable.ts');
 const blockedXZ=(x,z)=>RW.walkFloorY(id,x,z)===null,buf=new Set(),pad=6;
 const x0=Math.min(A[0],B[0])-pad,x1=Math.max(A[0],B[0])+pad,z0=Math.min(A[2],B[2])-pad,z1=Math.max(A[2],B[2])+pad;
 for(let gz=0;gz<M.H;gz++)for(let gx=0;gx<M.W;gx++){const x=M.x0+(gx+.5)*M.c,z=M.z0+(gz+.5)*M.c;if(x<x0||x>x1||z<z0||z>z1)continue;
  let near=false;for(let dz=-1;dz<=1&&!near;dz++)for(let dx=-1;dx<=1&&!near;dx++)if(blockedXZ(x+dx*M.c,z+dz*M.c))near=true;
  if(near&&Math.hypot(x-A[0],z-A[2])>=EXEMPT_M&&Math.hypot(x-B[0],z-B[2])>=EXEMPT_M)buf.add(gz*M.W+gx);}
 return buf;}
function bfs(M,from,to,avoid){
 const start=nearest(M,from,0.8),goal=nearest(M,to,0.8);if(!start||!goal)return null;
 if(start.k===goal.k){const p=pathOf(M,start.k);return {path:[p[p.length-1]],len:0};}
 const seen=new Set(),parent=new Map(),dist=new Map();
 const q=[start.k];seen.add(start.k);parent.set(start.k,null);dist.set(start.k,0);let qi=0;
 const W=M.W,H=M.H,c=M.c;
 while(qi<q.length){const k=q[qi++];if(k===goal.k)break;const ci=(k/8)|0,li=k%8,y=M.layers[ci][li],gx=ci%W,gz=(ci/W)|0,d0=dist.get(k);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=gx+dx,nz=gz+dz;if(nx<0||nz<0||nx>=W||nz>=H)continue;const nc=nz*W+nx,lim=STEP*Math.hypot(dx,dz)*(c/.4);
   if(M.route&&M.route.has(nc))continue;
   if(avoid&&avoid.has(nc))continue;
   M.layers[nc].forEach((y2,l2)=>{if(!M.ok[nc][l2]||Math.abs(y2-y)>lim)return;const nk=M.key(nc,l2);if(seen.has(nk))return;seen.add(nk);parent.set(nk,k);dist.set(nk,d0+Math.hypot(dx,dz)*c);q.push(nk);});}}
 if(!parent.has(goal.k)&&start.k!==goal.k)return null;
 const pts=[];let cur=goal.k;while(cur!==null){const ci=(cur/8)|0,li=cur%8;pts.push([round3(M.x0+(ci%W+.5)*c),round3(M.layers[ci][li]),round3(M.z0+(((ci/W)|0)+.5)*c)]);cur=parent.get(cur);} 
 return {path:pts.reverse(),len:dist.get(goal.k)};
}
function ts(body){
 const lines=[];
 lines.push('/** Baked by tools/region-nodes/bake-region-nodes.cjs. Pure data, no cc. Do not edit by hand. */');
 lines.push("export type Vec=readonly [number,number,number];");
 lines.push("export type NodeRole='mainline'|'optional'|'arrival'|'departure'|'finale';");
 lines.push("export type RegionId='island'|'meadow'|'skycity';");
 lines.push("export type RegionNode=Readonly<{key:string;region:RegionId;at:Vec;role:NodeRole;stageId?:string;opens?:'challenge-meadow'|'challenge-sky'|'challenge-island';faceDeg:number;boardPose?:string}>;");
 lines.push("export type RegionEdge=Readonly<{a:string;b:string;path:readonly Vec[];lengthM:number}>;");
 lines.push("export type RegionGraph=Readonly<{nodes:readonly RegionNode[];edges:readonly RegionEdge[];exploreBox:readonly [number,number,number,number];lensBox?:readonly [number,number,number,number];gridM:number;sourceSha256:string}>;");
 lines.push('export const REGION_NODE_GLB:Readonly<Record<RegionId,string>>=');
 const shas={};
 for(const id of Object.keys(body))shas[id]=body[id].sha256;
 lines.push(JSON.stringify(shas)+';');
 lines.push('export const REGION_NODES:Readonly<Record<RegionId,RegionGraph>>=');
 const pub={};
 for(const id of Object.keys(body)){
  const g=body[id];
  pub[id]={
   sourceSha256:g.sha256,gridM:g.gridM,exploreBox:g.exploreBox,...(g.lensBox?{lensBox:g.lensBox}:{}),
   nodes:g.nodes.map(n=>({key:n.key,region:id,at:n.at,role:n.role,...(n.stageId?{stageId:n.stageId}:{}),...(n.opens?{opens:n.opens}:{}),faceDeg:n.faceDeg,...(n.role==='mainline'&&id!=='island'?{boardPose:'default'}:{})})),
   edges:g.edges,
  };
 }
 lines.push(JSON.stringify(pub).replace(/"([A-Za-z0-9_]+)":/g,'$1:')+';');
 lines.push('');
 return lines.join('\n');
}
async function main(){
 const check=process.argv.includes('--check');
 const baked={};
 for(const id of Object.keys(REGIONS)){
  const spec=REGIONS[id];
  const t=Date.now();
  const decoded=spec.draco?await decodeDraco(spec.file,spec):decodePlain(spec.file,spec);
  if(!decoded.grid)throw Error('fixture path not expanded for '+id);
  baked[id]=decoded;
  console.log(id,'grid',decoded.grid.W+'x'+decoded.grid.H,'ms',Date.now()-t,'sha',decoded.sha.slice(0,12));
 }
 const body=emit(baked);
 fs.mkdirSync(path.dirname(OUT_JSON),{recursive:true});
 fs.writeFileSync(OUT_JSON,JSON.stringify(body));
 const text=ts(body);
 if(check){
  const cur=fs.readFileSync(OUT_TS,'utf8');
  if(cur!==text){console.error('REGION NODES DRIFT');process.exit(1);}
  const ref=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/r5/maps/nodes.json'),'utf8'));
  const map={island:'island',meadow:'meadow',sky:'skycity'};
  let nodes=0;
  for(const [rid,id] of Object.entries(map)){
   nodes+=body[id].nodes.length;
   for(const leg of ref[rid].legs){
    const e=body[id].edges.find(x=>x.a===leg.from&&x.b===leg.to);
    if(!e)throw Error('missing leg '+leg.from);
    const d=Math.abs(e.lengthM-leg.walkM)/leg.walkM;
    if(d>0.02)throw Error('length '+leg.from+'->'+leg.to+' '+e.lengthM+' vs '+leg.walkM);
    for(let i=1;i<e.path.length;i++){let worst=0;for(const p of e.path)worst=Math.max(worst,0);void worst;}
   }
   for(const e of body[id].edges){if(e.path.length<2&&e.lengthM>0)throw Error('empty path '+e.a);for(let i=1;i<e.path.length-1;i++){const d=distPointSeg(e.path[i],e.path[0],e.path[e.path.length-1]);void d;}}
  }
  if(nodes!==20)throw Error('node count '+nodes);
  const direct=[['island','I4','I6'],['meadow','M4','M6'],['skycity','S4','S6']];
  for(const [id,a,b] of direct)if(!body[id].edges.some(e=>e.a===a&&e.b===b))throw Error('missing direct '+a);
  console.log('check-ok',text.length,'nodes',nodes);
  return;
 }
 fs.mkdirSync(path.dirname(OUT_TS),{recursive:true});
 fs.writeFileSync(OUT_TS,text);
 // Compact walkable-cell fixture (gz) so a machine without draco can still pin the bake. Cells only, not triangles.
 for(const id of Object.keys(baked)){
  const g=baked[id].grid,cells=[];
  for(let ci=0;ci<g.layers.length;ci++)g.layers[ci].forEach((y,li)=>{if(g.ok[ci][li]&&g.dist.has(g.key(ci,li)))cells.push([ci,li,+y.toFixed(3)]);});
  const gz=zlib.gzipSync(Buffer.from(JSON.stringify({id,sha256:baked[id].sha,c:g.c,x0:g.x0,z0:g.z0,W:g.W,cells})));
  fs.mkdirSync(FIX,{recursive:true});fs.writeFileSync(path.join(FIX,id+'-walkable.json.gz'),gz);
 }
 console.log('wrote',OUT_TS,text.length,'bytes');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
module.exports={REGIONS,NODES,buildGrid,decodeDraco,decodePlain,bfs};
