#!/usr/bin/env node
'use strict';
/**
 * b20 (场景设计部): move ONE island prop placement (all env_island_props_merged sub-objects of placement --pl in
 * fixtures/island-props-classes.json) by (--dx, --dz) metres in the runtime GLB. y follows the terrain (+ floor delta at the base).
 * env_island_props_merged is Draco SEQUENTIAL with no quantization (lossless float32): the primitive is decoded, the placement's points are
 * moved (--dy overrides the terrain-follow y delta), and it is re-encoded with the same method, attribute ids and point order, so every other vertex is bit-identical. Only that
 * bufferView is replaced; the rest of the GLB is copied byte for byte. Usage:
 *   node tools/region-nodes/move-island-prop.cjs --pl 61 --dx 0.04 --dz 0 [--glb path]
 */
const fs=require('fs'),path=require('path');
const D=require(process.env.DRACO3D||'/tmp/draco3d/node_modules/draco3d');
const CP=require('./classify-island-props.cjs'),RN=require('./bake-region-nodes.cjs');
const arg=k=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:null;};
const ROOT=path.join(__dirname,'../..'),GLB=path.join(ROOT,arg('glb')||RN.REGIONS.island.file),PL=+arg('pl'),DX=+(arg('dx')||0),DZ=+(arg('dz')||0),MESH='env_island_props_merged';
(async()=>{
 const f=fs.readFileSync(GLB);const L=f.readUInt32LE(12),j=JSON.parse(f.slice(20,20+L).toString());const binHdr=20+L,binLen=f.readUInt32LE(binHdr),binOff=binHdr+8,bin=f.slice(binOff,binOff+binLen);
 const mi=j.meshes.findIndex(m=>m.name===MESH),pr=j.meshes[mi].primitives[0],ext=pr.extensions.KHR_draco_mesh_compression,bvi=ext.bufferView,bv=j.bufferViews[bvi];
 const src=bin.slice(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);if(src[8]!==0)throw Error('expected Draco sequential encoding, method '+src[8]);
 const M=await D.createDecoderModule({});const dec=new M.Decoder(),db=new M.DecoderBuffer();db.Init(new Int8Array(src),src.length);const mesh=new M.Mesh();const st=dec.DecodeBufferToMesh(db,mesh);if(!st.ok())throw Error(st.error_msg());
 const nP=mesh.num_points(),nF=mesh.num_faces(),A={};
 for(const [name,uid] of Object.entries(ext.attributes)){const a=dec.GetAttributeByUniqueId(mesh,uid),n=a.num_components(),arr=new M.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(mesh,a,arr);const v=new Float32Array(nP*n);for(let i=0;i<v.length;i++)v[i]=arr.GetValue(i);
  const q=new M.AttributeQuantizationTransform();if(q.InitFromAttribute(a))throw Error(name+' is quantized; this tool only handles lossless float attributes');A[name]={uid,n,v,type:a.attribute_type()};}
 const idx=new Uint32Array(nF*3),ia=new M.DracoInt32Array();for(let i=0;i<nF;i++){dec.GetFaceFromMesh(mesh,i,ia);for(let k=0;k<3;k++)idx[i*3+k]=ia.GetValue(k);}
 const P=A.POSITION.v,tris=new Float64Array(nF*9);for(let t=0;t<nF;t++)for(let k=0;k<3;k++)for(let c=0;c<3;c++)tris[t*9+k*3+c]=P[idx[t*3+k]*3+c];
 // the placement's sub-objects (same split + keys as the class list); collect their faces' points
 const CLS=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/island-props-classes.json'),'utf8')).components.filter(c=>c.pl===PL);if(!CLS.length)throw Error('no sub-objects for placement '+PL);
 const want=new Set(CLS.map(c=>c.cx+','+c.cz+','+c.tris));
 const id=new Map(),par=[],find=a=>{while(par[a]!==a)a=par[a]=par[par[a]];return a;},vi=(x,y,z)=>{const k=Math.round(x*1000)+','+Math.round(y*1000)+','+Math.round(z*1000);let v=id.get(k);if(v===undefined){v=par.length;id.set(k,v);par.push(v);}return v;};
 const tv=[];for(let t=0;t<nF;t++){const a=vi(tris[t*9],tris[t*9+1],tris[t*9+2]),b=vi(tris[t*9+3],tris[t*9+4],tris[t*9+5]),c=vi(tris[t*9+6],tris[t*9+7],tris[t*9+8]);par[find(b)]=find(a);par[find(c)]=find(a);tv.push(a);}
 const C=new Map();tv.forEach((a,t)=>{const r=find(a);if(!C.has(r))C.set(r,[]);C.get(r).push(t);});
 const pts=new Set();let found=0,yMin=1e9,sx=0,sz=0,ns=0;for(const ts of C.values()){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const t of ts)for(let k=0;k<3;k++){const x=tris[t*9+k*3],z=tris[t*9+k*3+2];x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);}
  const key=(+((x0+x1)/2).toFixed(3))+','+(+((z0+z1)/2).toFixed(3))+','+ts.length;if(!want.has(key))continue;found++;for(const t of ts)for(let k=0;k<3;k++){const p=idx[t*3+k];pts.add(p);yMin=Math.min(yMin,P[p*3+1]);sx+=P[p*3];sz+=P[p*3+2];ns++;}}
 if(found!==CLS.length)throw Error('matched '+found+' of '+CLS.length+' sub-objects of placement '+PL);
 const {grid:g}=await RN.decodeDraco(RN.REGIONS.island.file,RN.REGIONS.island);const cx=sx/ns,cz=sz/ns,f0=g.floorAt(cx,cz,yMin+0.05),f1=g.floorAt(cx+DX,cz+DZ,yMin+0.3),DY=arg('dy')!=null?+arg('dy'):(f0!=null&&f1!=null)?f1-f0:0;
 for(const p of pts){P[p*3]+=DX;P[p*3+1]+=DY;P[p*3+2]+=DZ;}
 // re-encode: sequential, no quantization, attributes added in unique-id order so the ids in the glTF extension stay valid
 const E=await D.createEncoderModule({});const mb=new E.MeshBuilder(),em=new E.Mesh();mb.AddFacesToMesh(em,nF,idx);
 const TYPE={0:E.POSITION,1:E.NORMAL,2:E.COLOR,3:E.TEX_COORD,4:E.GENERIC};const order=Object.entries(A).sort((a,b)=>a[1].uid-b[1].uid);
 order.forEach(([name,a],i)=>{const got=mb.AddFloatAttributeToMesh(em,TYPE[a.type],nP,a.n,a.v);if(got!==a.uid)throw Error(name+' got attribute id '+got+' != '+a.uid);});
 const enc=new E.Encoder();enc.SetEncodingMethod(E.MESH_SEQUENTIAL_ENCODING);if(process.env.SPEED){const [a,b]=process.env.SPEED.split(',').map(Number);enc.SetSpeedOptions(a,b);}const out=new E.DracoInt8Array();const len=enc.EncodeMeshToDracoBuffer(em,out);if(!len)throw Error('draco encode failed');
 const nb=Buffer.alloc(len);for(let i=0;i<len;i++)nb[i]=out.GetValue(i)&255;
 // verify: decode again, every point equal except the moved ones
 {const db2=new M.DecoderBuffer();db2.Init(new Int8Array(nb),nb.length);const m2=new M.Mesh();if(!dec.DecodeBufferToMesh(db2,m2).ok())throw Error('re-decode failed');if(m2.num_points()!==nP||m2.num_faces()!==nF)throw Error('count changed');
  for(const [name,x] of Object.entries(A)){const a=dec.GetAttributeByUniqueId(m2,x.uid),arr=new M.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(m2,a,arr);for(let i=0;i<nP*x.n;i++)if(arr.GetValue(i)!==x.v[i])throw Error(name+' '+i+' differs after re-encode');}
  const fa=new M.DracoInt32Array();for(let i=0;i<nF;i++){dec.GetFaceFromMesh(m2,i,fa);for(let k=0;k<3;k++)if(fa.GetValue(k)!==idx[i*3+k])throw Error('face '+i+' differs after re-encode');}}
 // splice the bufferView, shift the later ones (4-byte aligned)
 const pad=n=>(n+3)&~3,o0=bv.byteOffset||0,oldEnd=o0+pad(bv.byteLength),newEnd=o0+pad(len),shift=newEnd-oldEnd;
 const nbin=Buffer.concat([bin.slice(0,o0),nb,Buffer.alloc(pad(len)-len),bin.slice(oldEnd)]);bv.byteLength=len;
 for(const b of j.bufferViews)if(b!==bv&&(b.byteOffset||0)>=oldEnd)b.byteOffset+=shift;j.buffers[0].byteLength+=shift;
 const acc=j.accessors[pr.attributes.POSITION];/* min/max: extend only (the exporter's bounds are kept when the moved points stay inside) */for(const p of pts)for(let c=0;c<3;c++){if(P[p*3+c]<acc.min[c])acc.min[c]=P[p*3+c];if(P[p*3+c]>acc.max[c])acc.max[c]=P[p*3+c];}
 const j0=JSON.parse(f.slice(20,20+L).toString());const same=JSON.stringify(j0)===JSON.stringify(j);
 let js=same?f.slice(20,20+L)/* untouched JSON chunk kept byte for byte */:Buffer.from(JSON.stringify(j));js=Buffer.concat([js,Buffer.alloc(pad(js.length)-js.length,0x20)]);
 const hdr=Buffer.alloc(12);hdr.write('glTF',0);hdr.writeUInt32LE(2,4);const ch=(t,b)=>{const h=Buffer.alloc(8);h.writeUInt32LE(b.length,0);h.write(t,4);return Buffer.concat([h,b]);};
 const outF=Buffer.concat([hdr,ch('JSON',js),ch('BIN\0',nbin)]);outF.writeUInt32LE(outF.length,8);fs.writeFileSync(GLB,outF);
 console.log('placement',PL,'moved',found,'sub-objects',pts.size,'points by dx',DX,'dz',DZ,'dy',+DY.toFixed(4),'| draco',bv.byteLength,'bytes, GLB',outF.length);
})().catch(e=>{console.error(e);process.exit(1);});
