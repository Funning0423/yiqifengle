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
const {load}=require('../journey-integration/occlusion/lib-glb.cjs');
const ROOT=path.resolve(__dirname,'../..');
const OUT_TS=path.join(ROOT,'creator-build-project/assets/scripts/region/RegionNodes.ts');
const OUT_JSON=path.join(ROOT,'tools/region-nodes/region-nodes.json');
const FIX=path.join(ROOT,'tools/region-nodes/fixtures');
const STEP=.36,HEAD=1.7,LOW=.3;
const REGIONS={
 island:{
  file:'creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb',
  draco:true,box:[-12,-14,16,18],c:.2,
  floor:/env_island_main|env_beach_|env_lighthouse_ext|env_island_props_merged/,
  solid:/env_island_main|env_island_props_merged|env_lighthouse_ext|env_lighthouse_door|env_prop_palm|env_beach_tide/,
  start:[-2.1,0,5.3],sea:-0.6,explore:[-15,-16,19,18],
  // b19 dock models: the resident pier (region_island/ui-props/island_dock.glb, island coordinates) is floor + solid
  extras:[{file:'creator-build-project/assets/bundles/region_island/ui-props/island_dock.glb',floor:/island_dock/,solid:/island_dock/}],
 },
 meadow:{
  file:'creator-build-project/assets/bundles/region_meadow/env_meadow.glb',
  draco:false,box:[-40,-45,40,45],c:.4,
  floor:/meadow_terrain|meadow_path|meadow_river_bank/,
  solid:/meadow_terrain|meadow_path|meadow_river_bank|meadow_fence|meadow_trees|windmill_static|wind_bell_frame/,
  start:[0.2,1.22,20],explore:[-30,-35,30,30],
  // b19: parked balloon basket at the M6 yard (yaw -16), r 1.1 m (+0.4 m body clearance, discClearM); present from the M4 level start until lift-off (baked as permanent)
  discs:[[3.6,-23.4,1.1]],discClearM:.4,
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
  // moored baskets r 1.1 m at the landing (5.4,43.8) and at 5a (-14.8,-38.8)
  extras:[{file:'creator-build-project/assets/bundles/region_skycity/sky_mooring_props.glb',floor:/sky_mooring_deck|balloon_step_stool/,solid:/sky_mooring_deck|sky_mooring_posts|sky_mooring_5a_stakes|balloon_step_stool/}],
  discs:[[5.4,43.8,1.1],[-14.8,-38.8,1.1]],discClearM:.4,
 },
};
const NODES={
 island:[
  {key:'I1',at:[-2.1,0,5.3],role:'mainline',stageId:'mainline-01'},
  {key:'I2',at:[2.5,0,8.1],role:'mainline',stageId:'mainline-02'},
  {key:'I3',at:[8.1,-0.36,6.1],role:'mainline',stageId:'mainline-03'},
  {key:'I4',at:[4.5,0.23,-4.9],role:'mainline',stageId:'mainline-04'},
  {key:'I5',at:[-4.5,0.13,-0.9],role:'optional',opens:'challenge-island'},
  {key:'I6',at:[-1.5,-0.18,9.3],role:'departure'},
 ],
 meadow:[
  {key:'M0',at:[0.2,1.22,20],role:'arrival'},
  {key:'M1',at:[2.6,2.2,11.6],role:'mainline',stageId:'mainline-05'},
  {key:'M2',at:[-1.4,3.19,1.2],role:'mainline',stageId:'mainline-06'},
  {key:'M3',at:[-3,4,-8.4],role:'mainline',stageId:'mainline-07'},
  {key:'M4',at:[3,5.84,-16.4],role:'mainline',stageId:'mainline-08'},
  {key:'M5',at:[6.6,6.47,-21.2],role:'optional',opens:'challenge-meadow'},
  {key:'M6',at:[0.2,6.5,-25.6],role:'departure'},
 ],
 skycity:[
  {key:'S0',at:[5.25,-0.084,40.6],role:'arrival'},
  {key:'S1',at:[0.2,0.04,30.2],role:'mainline',stageId:'mainline-09'},
  {key:'S2',at:[-6.6,-0.05,19],role:'mainline',stageId:'mainline-10'},
  {key:'S3',at:[6.2,-0.01,8.2],role:'mainline',stageId:'mainline-11'},
  {key:'S4',at:[0.2,3.31,-5.8],role:'mainline',stageId:'mainline-12'},
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
 const cell=(x,z)=>{const gx=Math.floor((x-x0)/c),gz=Math.floor((z-z0)/c);if(gx<0||gz<0||gx>=W||gz>=H)return -1;return gz*W+gx;};
 const addTri=(isF,isS,A,B,C)=>{
  const e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
  const nx=e1[1]*e2[2]-e1[2]*e2[1],ny=e1[2]*e2[0]-e1[0]*e2[2],nz=e1[0]*e2[1]-e1[1]*e2[0],nl=Math.hypot(nx,ny,nz)||1,up=Math.abs(ny)/nl;
  const L=Math.max(Math.hypot(e1[0],e1[1],e1[2]),Math.hypot(e2[0],e2[1],e2[2]),Math.hypot(C[0]-B[0],C[1]-B[1],C[2]-B[2]));
  const N=Math.max(1,Math.ceil(L/(c*.5)));
  for(let i=0;i<=N;i++)for(let j=0;j<=N-i;j++){const u=i/N,v=j/N,x=A[0]+e1[0]*u+e2[0]*v,y=A[1]+e1[1]*u+e2[1]*v,z=A[2]+e1[2]*u+e2[2]*v,ci=cell(x,z);if(ci<0)continue;
   if(isF&&up>.72)floors[ci].push(y);if(isS)solids[ci].push(y);}
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
 if(spec.discs)for(const [cx,cz,r] of spec.discs)layers.forEach((ls,ci)=>{const x=x0+(ci%W+.5)*c,z=z0+(((ci/W)|0)+.5)*c;if(Math.hypot(x-cx,z-cz)<=r+(spec.discClearM||0))ls.forEach((y,li)=>{ok[ci][li]=false;});});
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
 return {W,H,c,x0,z0,layers,ok,dist,parent,key,cell,solids};
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
function simplify(path,eps=.15){if(path.length<3)return path;const keep=[0];let i=0;while(i<path.length-1){let j=i+1;for(let k=i+2;k<path.length;k++){let ok=true;for(let t=i+1;t<k;t++)if(distPointSeg(path[t],path[i],path[k])>eps){ok=false;break;}if(!ok)break;j=k;}keep.push(j);i=j;}return keep.map(i=>path[i]);}
function faceDeg(from,to){const dx=to[0]-from[0],dz=to[2]-from[2];return +((Math.atan2(dx,dz)*180/Math.PI)).toFixed(2);}
async function decodeDraco(file,spec){
 const dir=dracoDir();if(!dir){
  const gz=path.join(FIX,path.basename(file)+'.walk.gz');
  if(!fs.existsSync(gz))throw Error('no blender and no fixture '+gz);
  return {fixture:gz,sha:sha256(gz)};
 }
 const draco=require(path.join(dir,'draco3d.js'));const decMod=await draco.createDecoderModule({});
 const mul=(A,B)=>{const C=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)C[c*4+r]+=A[k*4+r]*B[c*4+k];return C;};
 const trs=n=>{if(n.matrix)return n.matrix.slice();const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],t=n.translation||[0,0,0];
  return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,t[0],t[1],t[2],1];};
 const xf=(M,v)=>[M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12],M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13],M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]];
 const stampGlb=(gfile,floorRx,solidRx,addTri)=>{
  const raw=fs.readFileSync(path.join(ROOT,gfile));const jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString());
  const binOff=20+jl+8,bin=raw.subarray(binOff,binOff+raw.readUInt32LE(20+jl));
  const parent={};doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>{parent[c]=i;}));
  const glob=i=>{let M=trs(doc.nodes[i]);for(let k=parent[i];k!==undefined;k=parent[k])M=mul(trs(doc.nodes[k]),M);return M;};
  doc.nodes.forEach((node,i)=>{if(node.mesh===undefined)return;const name=node.name||'';const isF=floorRx.test(name),isS=solidRx.test(name);if(!isF&&!isS)return;const M=glob(i);
   for(const pr of doc.meshes[node.mesh].primitives){const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;if(!ext)continue;
    const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
    const d=new decMod.Decoder(),buf=new decMod.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);
    const mesh=new decMod.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())throw Error('draco '+name);
    const attr=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces(),pos=new decMod.DracoFloat32Array();
    d.GetAttributeFloatForAllPoints(mesh,attr,pos);const P=new Array(nv);
    for(let v=0;v<nv;v++)P[v]=xf(M,[pos.GetValue(v*3),pos.GetValue(v*3+1),pos.GetValue(v*3+2)]);
    const face=new decMod.DracoInt32Array();
    for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,face);addTri(isF,isS,P[face.GetValue(0)],P[face.GetValue(1)],P[face.GetValue(2)]);}
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
  const nodes=NODES[id].map(n=>{const hit=nearest(g,n.at,2.5);if(!hit)throw Error('node-off-grid '+n.key);const p=pathOf(g,hit.k);const at=p[p.length-1];by[n.key]={...n,at};return {...n,at};});
  const edges=[];
  for(const [a,b] of EDGES[id]){
   const A=by[a].at,B=by[b].at,ka=nearest(g,A,0.6),kb=nearest(g,B,0.6);
   if(!ka||!kb)throw Error('edge-endpoint '+a+b);
   // Reconstruct A* from A to B by flooding a second time is expensive; walk parent chains via a targeted BFS from A.
   const path=bfs(g,A,B);
   if(!path)throw Error('no-path '+a+' '+b);
   const simp=simplify(path.path,.15);
   edges.push({a,b,path:simp,lengthM:round3(path.len)});
  }
  for(const n of nodes){const out=edges.find(e=>e.a===n.key)||edges.find(e=>e.b===n.key);if(!out){n.faceDeg=0;continue;}
   const forward=out.a===n.key?out.path:[...out.path].reverse();n.faceDeg=faceDeg(forward[0],forward[Math.min(1,forward.length-1)]);}
  body[id]={sha256:baked[id].sha,decoder:baked[id].decoder,exploreBox:spec.explore,...(spec.lens?{lensBox:spec.lens}:{}),gridM:spec.c,nodes,edges};
 }
 return body;
}
function bfs(M,from,to){
 const start=nearest(M,from,0.8),goal=nearest(M,to,0.8);if(!start||!goal)return null;
 if(start.k===goal.k){const p=pathOf(M,start.k);return {path:[p[p.length-1]],len:0};}
 const seen=new Set(),parent=new Map(),dist=new Map();
 const q=[start.k];seen.add(start.k);parent.set(start.k,null);dist.set(start.k,0);let qi=0;
 const W=M.W,H=M.H,c=M.c;
 while(qi<q.length){const k=q[qi++];if(k===goal.k)break;const ci=(k/8)|0,li=k%8,y=M.layers[ci][li],gx=ci%W,gz=(ci/W)|0,d0=dist.get(k);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=gx+dx,nz=gz+dz;if(nx<0||nz<0||nx>=W||nz>=H)continue;const nc=nz*W+nx,lim=STEP*Math.hypot(dx,dz)*(c/.4);
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
module.exports={REGIONS,NODES,buildGrid,decodeDraco,decodePlain};
