#!/usr/bin/env node
'use strict';
/** Procedural CC0-self sail assets. No Blender on this machine. Vertex colours, two boat materials, no fog. */
const fs=require('node:fs'),path=require('node:path');
const OUT=path.resolve(__dirname,'../../creator-build-project/assets/bundles/transport_sail');
fs.mkdirSync(OUT,{recursive:true});
function glb(nodes,meshes,materials){
 const bins=[];let byte=0;const views=[],accessors=[];
 function add(data,componentType,type,target){
  const buf=Buffer.from(data.buffer,data.byteOffset,data.byteLength);
  const pad=(4-(byte+buf.length)%4)%4;
  views.push({buffer:0,byteOffset:byte,byteLength:buf.length,target});
  const count=type==='SCALAR'?data.length:type==='VEC3'?data.length/3:data.length/4;
  const acc={bufferView:views.length-1,componentType,count,type};
  if(componentType===5126){let mn=Infinity,mx=-Infinity;for(const v of data){mn=Math.min(mn,v);mx=Math.max(mx,v);}if(type==='VEC3'){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<data.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],data[i+k]);max[k]=Math.max(max[k],data[i+k]);}acc.min=min;acc.max=max;}else{acc.min=[mn];acc.max=[mx];}}
  accessors.push(acc);bins.push(buf);if(pad)bins.push(Buffer.alloc(pad));byte+=buf.length+pad;return accessors.length-1;
 }
 const meshOut=meshes.map(m=>{
  const pos=add(Float32Array.from(m.positions),5126,'VEC3',34962);
  const col=add(Float32Array.from(m.colors),5126,'VEC3',34962);
  const idx=add(Uint16Array.from(m.indices),5123,'SCALAR',34963);
  return {primitives:[{attributes:{POSITION:pos,COLOR_0:col},indices:idx,material:m.material}]};
 });
 const json={asset:{version:'2.0',generator:'sail-procedural'},scene:0,scenes:[{nodes:[0]}],nodes,meshes:meshOut,materials,accessors,bufferViews:views,buffers:[{byteLength:byte}]};
 let jsonBuf=Buffer.from(JSON.stringify(json));
 while(jsonBuf.length%4)jsonBuf=Buffer.concat([jsonBuf,Buffer.from(' ')]);
 const bin=Buffer.concat(bins);
 const total=12+8+jsonBuf.length+8+bin.length;
 const header=Buffer.alloc(12);header.writeUInt32LE(0x46546C67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(total,8);
 const jh=Buffer.alloc(8);jh.writeUInt32LE(jsonBuf.length,0);jh.writeUInt32LE(0x4E4F534A,4);
 const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004E4942,4);
 return Buffer.concat([header,jh,jsonBuf,bh,bin]);
}
const HULL=[0.96,0.93,0.86],KEEL=[0.36,0.18,0.10],MAST=[0.22,0.12,0.07],SAIL=[1,0.45,0.08],SEA=[0.12,0.55,0.62],CLOUD=[0.95,0.97,1],ISLE=[0.20,0.62,0.38],BEACON=[0.95,0.75,0.20];
function paint(n,c){const o=[];for(let i=0;i<n;i++)o.push(c[0],c[1],c[2]);return o;}
function soup(local,color){
 const positions=[],indices=[];
 for(let i=0;i<local.length;i+=3){indices.push(positions.length/3);positions.push(local[i],local[i+1],local[i+2]);}
 return {positions,indices,colors:paint(positions.length/3,color)};
}
/** Same silhouette as TransitBackdrop.boatLocal: cream hull, dark keel and mast, orange sail facing the follow camera. */
function boatParts(){
 const hull=[],keel=[],mast=[],sail=[];
 const addTri=(out,a,b,c,outward)=>{
  const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  const tri=(n[0]*outward[0]+n[1]*outward[1]+n[2]*outward[2]>=0)?[a,b,c]:[a,c,b];
  for(const p of tri)out.push(p[0],p[1],p[2]);
 };
 const addQuad=(out,a,b,c,d,o)=>{addTri(out,a,b,c,o);addTri(out,a,c,d,o);};
 const stations=[[-2.05,0.42,0.58,-0.02],[-1.1,0.78,0.7,-0.28],[0.15,0.84,0.74,-0.34],[1.2,0.58,0.62,-0.18],[2.2,0.08,0.46,0.08]];
 const ring=(z,w,deck,ky)=>({keel:[0,ky,z],pl:[-w*0.78,0.02,z],gl:[-w,deck,z],gr:[w,deck,z],pr:[w*0.78,0.02,z]});
 const rings=stations.map(s=>ring(s[0],s[1],s[2],s[3]));
 for(let i=0;i<rings.length-1;i++){
  const a=rings[i],b=rings[i+1];
  addQuad(hull,a.pl,b.pl,b.gl,a.gl,[-1,0.15,0]);
  addQuad(hull,a.pr,a.gr,b.gr,b.pr,[1,0.15,0]);
  addQuad(hull,a.gl,b.gl,b.gr,a.gr,[0,1,0]);
  addQuad(keel,a.keel,a.pl,b.pl,b.keel,[-0.2,-1,0]);
  addQuad(keel,a.keel,b.keel,b.pr,a.pr,[0.2,-1,0]);
 }
 const fan=(out,origin,rest,o)=>{for(let i=0;i<rest.length-1;i++)addTri(out,origin,rest[i],rest[i+1],o);};
 const stern=rings[0],bow=rings[rings.length-1];
 fan(keel,stern.keel,[stern.pr,stern.gr,stern.gl,stern.pl],[0,0,-1]);
 fan(keel,bow.keel,[bow.pl,bow.gl,bow.gr,bow.pr],[0,0,1]);
 const box=(out,cx,cy,cz,sx,sy,sz)=>{
  const x0=cx-sx,x1=cx+sx,y0=cy-sy,y1=cy+sy,z0=cz-sz,z1=cz+sz,P=(x,y,z)=>[x,y,z];
  addQuad(out,P(x0,y0,z1),P(x1,y0,z1),P(x1,y1,z1),P(x0,y1,z1),[0,0,1]);
  addQuad(out,P(x1,y0,z0),P(x0,y0,z0),P(x0,y1,z0),P(x1,y1,z0),[0,0,-1]);
  addQuad(out,P(x0,y0,z0),P(x0,y0,z1),P(x0,y1,z1),P(x0,y1,z0),[-1,0,0]);
  addQuad(out,P(x1,y0,z1),P(x1,y0,z0),P(x1,y1,z0),P(x1,y1,z1),[1,0,0]);
  addQuad(out,P(x0,y1,z1),P(x1,y1,z1),P(x1,y1,z0),P(x0,y1,z0),[0,1,0]);
  addQuad(out,P(x0,y0,z0),P(x1,y0,z0),P(x1,y0,z1),P(x0,y0,z1),[0,-1,0]);
 };
 box(mast,0,1.85,-0.28,0.045,1.28,0.045);
 box(mast,0.7,0.78,-0.62,0.62,0.035,0.04);
 addQuad(sail,[0.08,0.9,-0.22],[0.08,3.15,-0.16],[1.55,2.45,-0.85],[1.7,0.92,-1.2],[0.28,0.05,-1]);
 const mesh=(local,color,material)=>{const m=soup(local,color);m.material=material;return m;};
 return [mesh(hull,HULL,0),mesh(keel,KEEL,1),mesh(mast,MAST,2),mesh(sail,SAIL,3)];
}
function cards(){
 const positions=[],indices=[],colors=[];
 const quad=(a,b,c,d,col)=>{const n=positions.length/3;positions.push(...a,...b,...c,...d);indices.push(n,n+1,n+2,n,n+2,n+3);for(let i=0;i<4;i++)colors.push(...col);};
 // three island silhouettes + two beacons, far enough to be horizon cards
 for(let i=0;i<3;i++){const x=-30+i*30;quad([x,0,0],[x+16,0,0],[x+14,10,0],[x+2,12,0],ISLE);}
 quad([-8,0,20],[-6,0,20],[-6,6,20],[-8,6,20],BEACON);
 quad([8,0,20],[10,0,20],[10,6,20],[8,6,20],BEACON);
 return {positions,indices,colors,material:0};
}
function clouds(){
 const positions=[],indices=[],colors=[];
 const blob=(cx,cy,cz,s)=>{
  const n=positions.length/3;
  const p=[[-1,0,0],[1,0,0],[0,1.2,0],[0,0,1],[0,0,-1]];
  for(const v of p)positions.push(cx+v[0]*s,cy+v[1]*s,cz+v[2]*s);
  indices.push(n,n+1,n+2,n,n+3,n+1,n+1,n+4,n+2,n+4,n,n+2);
  for(let i=0;i<5;i++)colors.push(...CLOUD);
 };
 for(let i=0;i<8;i++){const u=i/8*Math.PI*2;blob(Math.sin(u)*12,2,Math.cos(u)*12,1.4+ (i%3)*0.3);}
 return {positions,indices,colors,material:0};
}
const mat=(rgba,name)=>({name,pbrMetallicRoughness:{baseColorFactor:rgba,metallicFactor:0,roughnessFactor:0.85},doubleSided:true});
const boat=glb([
 {name:'transport_sailboat',children:[1,2,3,4,5,6]},
 {name:'hull',mesh:0},
 {name:'keel',mesh:1},
 {name:'mast',mesh:2},
 {name:'sail_root',mesh:3},
 {name:'seat_bench',translation:[0,0.62,-0.2]},
 {name:'wake_root',translation:[0,0.05,-2.2]},
],boatParts(),[mat([...HULL,1],'hull'),mat([...KEEL,1],'keel'),mat([...MAST,1],'mast'),mat([...SAIL,1],'sail')]);
const sea=glb([{name:'transit_sea_cards',mesh:0}],[cards()],[mat([0.2,0.62,0.38,1],'cards')]);
const cloud=glb([{name:'transit_clouds',mesh:0}],[clouds()],[mat([0.95,0.97,1,1],'clouds')]);
fs.writeFileSync(path.join(OUT,'transport_sailboat.glb'),boat);
fs.writeFileSync(path.join(OUT,'transit_sea_cards.glb'),sea);
fs.writeFileSync(path.join(OUT,'transit_clouds.glb'),cloud);
const transforms={instance_count:3,source:'procedural-self',license:'CC0-self',instances:[
 {name:'Sailboat',glb:'transport_sailboat.glb',pos:[0,0,0],rot_quat_xyzw:[0,0,0,1],scale:[1,1,1],group:'sail'},
 {name:'SeaCards',glb:'transit_sea_cards.glb',pos:[0,0,80],rot_quat_xyzw:[0,0,0,1],scale:[1,1,1],group:'cards'},
 {name:'MidClouds',glb:'transit_clouds.glb',pos:[0,28,0],rot_quat_xyzw:[0,0,0,1],scale:[1,1,1],group:'clouds'},
]};
fs.writeFileSync(path.join(__dirname,'sail-transforms.json'),JSON.stringify(transforms,null,2));
const kb=a=>(fs.statSync(path.join(OUT,a)).size/1024).toFixed(1);
console.log('wrote',kb('transport_sailboat.glb'),kb('transit_sea_cards.glb'),kb('transit_clouds.glb'),'KiB');
