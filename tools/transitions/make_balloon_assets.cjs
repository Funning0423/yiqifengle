#!/usr/bin/env node
'use strict';
/** Original procedural glTF (no Blender). Saturated meadow-green/gold balloon, cream cloud band with an ≥8 m hole, four far cards. */
const fs=require('node:fs'),path=require('node:path');
const OUT=path.resolve(__dirname,'../../creator-build-project/assets/bundles/transport_balloon');
const TAU=Math.PI*2;
function mesh(positions,normals,colors,indices){
 return {positions:Float32Array.from(positions),normals:Float32Array.from(normals),colors:Float32Array.from(colors),indices:Uint16Array.from(indices)};
}
function pushTri(idx,a,b,c){idx.push(a,b,c);}
function balloon(){
 const pos=[],nrm=[],col=[],idx=[];
 const gores=8,rings=7,radius=3,y0=4.2;
 const stripe=[[0.95,0.28,0.22],[0.98,0.82,0.18],[0.22,0.62,0.28],[0.20,0.45,0.82]];
 for(let g=0;g<gores;g++)for(let r=0;r<=rings;r++){
  const u=g/gores,v=r/rings,phi=(v-0.5)*Math.PI*0.92,theta=u*TAU;
  const cp=Math.cos(phi),sp=Math.sin(phi);
  const x=Math.cos(theta)*cp*radius,y=y0+sp*radius*1.15,z=Math.sin(theta)*cp*radius;
  pos.push(x,y,z);const l=Math.hypot(x,y-y0,z)||1;nrm.push(x/l,(y-y0)/l,z/l);
  const s=stripe[g%stripe.length];col.push(s[0],s[1],s[2],1);
 }
 const vert=(g,r)=>g* (rings+1)+r;
 for(let g=0;g<gores;g++)for(let r=0;r<rings;r++){
  const g2=(g+1)%gores,a=vert(g,r),b=vert(g2,r),c=vert(g,r+1),d=vert(g2,r+1);
  pushTri(idx,a,c,b);pushTri(idx,b,c,d);
 }
 const base=pos.length/3;
 const basket=[[-0.7,0, -0.7],[0.7,0,-0.7],[0.7,0,0.7],[-0.7,0,0.7],[-0.7,0.85,-0.7],[0.7,0.85,-0.7],[0.7,0.85,0.7],[-0.7,0.85,0.7]];
 for(const p of basket){pos.push(p[0],p[1],p[2]);nrm.push(0,1,0);col.push(0.72,0.46,0.18,1);}
 const faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
 for(const f of faces){pushTri(idx,base+f[0],base+f[1],base+f[2]);pushTri(idx,base+f[0],base+f[2],base+f[3]);}
 const flame=pos.length/3;
 const fy=1.15;pos.push(0,fy,0, 0.28,fy+0.7,0, -0.28,fy+0.7,0);nrm.push(0,0,1,0,0,1,0,0,1);col.push(1,0.85,0.2,1,1,0.45,0.05,1,1,0.45,0.05,1);
 pushTri(idx,flame,flame+1,flame+2);
 const envEnd=vert(0,0)+gores*(rings+1);
 return {
  nodes:[
   {name:'transport_balloon',children:[1,2,3]},
   {name:'envelope',mesh:0},
   {name:'basket_floor',mesh:1},
   {name:'burner_flame',mesh:2},
  ],
  parts:[
   slice(pos,nrm,col,idx,0,envEnd,0),
   slice(pos,nrm,col,idx,envEnd,base+basket.length,1),
   slice(pos,nrm,col,idx,flame,flame+3,1),
  ],
 };
}
function slice(pos,nrm,col,idx,v0,v1,material){
 const map=new Map(),np=[],nn=[],nc=[],ni=[];
 for(let i=0;i<idx.length;i+=3){
  const tri=idx.slice(i,i+3);
  if(tri.some(v=>v<v0||v>=v1))continue;
  for(const v of tri){if(!map.has(v)){map.set(v,np.length/3);np.push(pos[v*3],pos[v*3+1],pos[v*3+2]);nn.push(nrm[v*3],nrm[v*3+1],nrm[v*3+2]);nc.push(col[v*4],col[v*4+1],col[v*4+2],col[v*4+3]);}ni.push(map.get(v));}
 }
 return mesh(np,nn,nc,ni);
}
function cloud(){
 const pos=[],nrm=[],col=[],idx=[];
 const inner=4.5,outer=16,seg=28;
 for(let i=0;i<=seg;i++){
  const a=i/seg*TAU,c=Math.cos(a),s=Math.sin(a);
  for(const r of [inner,outer]){pos.push(c*r,Math.sin(a*3)*0.35,s*r);nrm.push(0,1,0);col.push(0.96,0.97,0.99,1);}
 }
 for(let i=0;i<seg;i++){const a=i*2,b=a+1,c=a+2,d=a+3;pushTri(idx,a,c,b);pushTri(idx,b,c,d);}
 return {nodes:[{name:'transit_cloud_band',mesh:0}],parts:[mesh(pos,nrm,col,idx)],holeM:inner*2};
}
function cards(){
 const pos=[],nrm=[],col=[],idx=[];
 const spots=[[140,18,40],[ -150,22,-30],[40,16,-160],[-30,20,155]];
 let v=0;
 for(const [x,y,z] of spots){
  const w=18,h=8;pos.push(x,y,z, x+w,y,z, x+w,y+h,z, x,y+h,z);
  nrm.push(0,0,1,0,0,1,0,0,1,0,0,1);col.push(0.55,0.75,0.95,1,0.55,0.75,0.95,1,0.85,0.92,0.98,1,0.85,0.92,0.98,1);
  pushTri(idx,v,v+1,v+2);pushTri(idx,v,v+2,v+3);v+=4;
 }
 return {nodes:[{name:'transit_sky_cards',mesh:0}],parts:[mesh(pos,nrm,col,idx)]};
}
function pack(doc){
 const parts=doc.parts,blobs=[],views=[],accessors=[],meshes=[];
 let offset=0;
 const align=n=>{const m=(4-(offset%4))%4;offset+=m;if(m)blobs.push(Buffer.alloc(m));};
 for(const part of parts){
  const start=accessors.length;
  for(const [arr,type,size] of [[part.positions,'VEC3',12],[part.normals,'VEC3',12],[part.colors,'VEC4',16]]){
   align();const buf=Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength);blobs.push(buf);
   views.push({buffer:0,byteOffset:offset,byteLength:buf.length,target:34962});
   let min=[Infinity,Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity,-Infinity];
   const n=type==='VEC4'?4:3;
   for(let i=0;i<arr.length;i+=n)for(let k=0;k<n;k++){min[k]=Math.min(min[k],arr[i+k]);max[k]=Math.max(max[k],arr[i+k]);}
   accessors.push({bufferView:views.length-1,componentType:5126,count:arr.length/n,type,min:min.slice(0,n),max:max.slice(0,n)});
   offset+=buf.length;
  }
  align();const ib=Buffer.from(part.indices.buffer,part.indices.byteOffset,part.indices.byteLength);blobs.push(ib);
  views.push({buffer:0,byteOffset:offset,byteLength:ib.length,target:34963});
  accessors.push({bufferView:views.length-1,componentType:5123,count:part.indices.length,type:'SCALAR'});
  offset+=ib.length;
  meshes.push({primitives:[{attributes:{POSITION:start,NORMAL:start+1,COLOR_0:start+2},indices:start+3,material:part.material??0}]});
 }
 const materials=(doc.materials||[{name:'palette',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:0.7},doubleSided:true}]);
 const json={asset:{version:'2.0',generator:'qf-procedural',extras:{license:'original-procedural'}},scene:0,scenes:[{nodes:[0]}],nodes:doc.nodes,meshes,materials,accessors,bufferViews:views,buffers:[{byteLength:offset}]};
 let text=Buffer.from(JSON.stringify(json));while(text.length%4)text=Buffer.concat([text,Buffer.from(' ')]);
 const bin=Buffer.concat(blobs);const binPad=(4-(bin.length%4))%4;
 const binChunk=Buffer.concat([bin,Buffer.alloc(binPad)]);
 const header=Buffer.alloc(12);header.writeUInt32LE(0x46546C67,0);header.writeUInt32LE(2,4);
 const jh=Buffer.alloc(8);jh.writeUInt32LE(text.length,0);jh.writeUInt32LE(0x4E4F534A,4);
 const bh=Buffer.alloc(8);bh.writeUInt32LE(binChunk.length,0);bh.writeUInt32LE(0x004E4942,4);
 const body=Buffer.concat([header,jh,text,bh,binChunk]);body.writeUInt32LE(body.length,8);
 return {glb:body,tris:parts.reduce((n,p)=>n+p.indices.length/3,0),materials:materials.length,bytes:body.length};
}
function write(name,doc){
 const built=pack(doc);fs.writeFileSync(path.join(OUT,name),built.glb);
 return {name,...built,holeM:doc.holeM||0,glb:undefined};
}
function main(){
 fs.mkdirSync(OUT,{recursive:true});
 const balloonDoc=balloon();
 balloonDoc.materials=[
  {name:'envelope',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:0.55},doubleSided:true},
  {name:'basket',pbrMetallicRoughness:{baseColorFactor:[0.72,0.46,0.18,1],metallicFactor:0,roughnessFactor:0.7},emissiveFactor:[0,0,0]},
 ];
 balloonDoc.parts[0].material=0;balloonDoc.parts[1].material=1;balloonDoc.parts[2].material=1;
 const cloudDoc=cloud();cloudDoc.materials=[{name:'cloud',pbrMetallicRoughness:{baseColorFactor:[0.97,0.98,1,1],metallicFactor:0,roughnessFactor:0.9},doubleSided:true}];
 const cardDoc=cards();cardDoc.materials=[{name:'cards',pbrMetallicRoughness:{baseColorFactor:[0.75,0.88,0.98,1],metallicFactor:0,roughnessFactor:0.8},doubleSided:true}];
 const rows=[write('transport_balloon.glb',balloonDoc),write('transit_cloud_band.glb',cloudDoc),write('transit_sky_cards.glb',cardDoc)];
 const total=rows.reduce((n,r)=>n+r.tris,0),bytes=rows.reduce((n,r)=>n+r.bytes,0);
 const report={rows,totalTris:total,bytes,license:'original procedural (this script)',holeM:cloudDoc.holeM};
 fs.writeFileSync(path.join(__dirname,'asset-stats.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 if(total>8500)throw Error('tris '+total);
 if(cloudDoc.holeM<8)throw Error('hole '+cloudDoc.holeM);
 if(bytes>0.3*1024*1024)console.warn('bundle bytes over 0.3 MiB target',bytes);
}
main();
