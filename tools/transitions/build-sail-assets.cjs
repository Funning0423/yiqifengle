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
const HULL=[0.90,0.32,0.22],SAIL=[0.98,0.93,0.72],SEA=[0.12,0.55,0.62],CLOUD=[0.95,0.97,1],ISLE=[0.20,0.62,0.38],BEACON=[0.95,0.75,0.20];
function paint(n,c){const o=[];for(let i=0;i<n;i++)o.push(c[0],c[1],c[2]);return o;}
function hull(){
 const positions=[],indices=[];
 const ring=(z,y,w)=>{positions.push(-w,y,z,w,y,z,0,y+0.35,z);};
 ring(-2.1,0,0.15);ring(-1.2,0,0.55);ring(0,0.05,0.6);ring(1.2,0.05,0.45);ring(2.1,0.1,0.05);
 for(let i=0;i<4;i++){const a=i*3;indices.push(a,a+3,a+1,a+1,a+3,a+4,a,a+2,a+3,a+2,a+5,a+3,a+1,a+4,a+2,a+2,a+4,a+5);}
 // deck
 indices.push(0,1,3,1,4,3);
 const colors=paint(positions.length/3,HULL);
 return {positions,indices,colors,material:0};
}
function sailCloth(){
 const positions=[-0.05,0.55,-0.2,0.05,0.55,-0.2,0,2.3,-0.15,-0.9,1.7,0.15,0.9,1.7,0.15,0,2.35,0.2];
 const indices=[0,1,2,2,3,5,2,5,4];
 return {positions,indices,colors:paint(positions.length/3,SAIL),material:1};
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
const mat=(rgba,name)=>({name,pbrMetallicRoughness:{baseColorFactor:rgba,metallicFactor:0,roughnessFactor:0.8},doubleSided:false});
const boat=glb([
 {name:'transport_sailboat',children:[1,2,3,4]},
 {name:'hull',mesh:0},
 {name:'sail_root',mesh:1},
 {name:'seat_bench',translation:[0,0.55,-0.15]},
 {name:'wake_root',translation:[0,0.05,-2.2]},
],[hull(),sailCloth()],[mat([0.9,0.32,0.22,1],'hull'),mat([0.98,0.93,0.72,1],'sail')]);
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
