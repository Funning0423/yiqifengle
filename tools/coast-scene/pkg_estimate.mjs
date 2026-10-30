// Emulates Cocos meshCompress {compress,encode}: meshopt vertex/index codec + zlib on the interleaved
// pos f32x3 | normal f32x3 | colour u8x4 layout (stride 28), flat-shaded (3 verts/tri), u16 indices.
// Usage: NODE_PATH=... node pkg_estimate.mjs coast_meshes.json
import fs from 'fs';import zlib from 'zlib';import {createRequire} from 'module';
const {MeshoptEncoder:M}=createRequire('/workspace/wt/meshopt-probe/')('meshoptimizer');await M.ready;
const J=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));let tot=0,tris=0;const rows=[];
for(const [n,m] of Object.entries(J)){if(m.reuse)continue;const P=m.positions,N=m.normals,C=m.colors,nv=P.length/3;
 const buf=Buffer.alloc(nv*28);for(let v=0;v<nv;v++){const o=v*28;for(let k=0;k<3;k++){buf.writeFloatLE(P[3*v+k],o+4*k);buf.writeFloatLE(N[3*v+k],o+12+4*k);}
  for(let k=0;k<4;k++)buf[o+24+k]=Math.max(0,Math.min(255,Math.round((C[4*v+k]??1)*(C[4*v+k]>1?1:255))));}
 // dedupe identical verts (Cocos keeps glTF verts; flat export shares nothing across faces)
 const idx=new Uint32Array(nv);for(let i=0;i<nv;i++)idx[i]=i;
 const vb=M.encodeVertexBuffer(new Uint8Array(buf),nv,28);const ib=M.encodeIndexBuffer(new Uint8Array(new Uint32Array(idx).buffer),nv,4);
 const z=zlib.deflateSync(Buffer.concat([Buffer.from(vb),Buffer.from(ib)]),{level:9}).length+600;tot+=z;tris+=nv/3;rows.push([n,nv/3,z]);}
rows.sort((a,b)=>b[2]-a[2]);for(const r of rows.slice(0,12))console.log(r.join('\t'));
let raw=0;for(const [n,m] of Object.entries(J)){if(m.reuse)continue;const nv=m.positions.length/3;const b=Buffer.alloc(nv*28+nv*2);const f=new Float32Array(b.buffer,0,nv*7);for(let v=0;v<nv;v++){for(let k=0;k<3;k++){f[v*7+k]=m.positions[3*v+k];f[v*7+3+k]=m.normals[3*v+k];}for(let k=0;k<4;k++)b[v*28+24+k]=m.colors[4*v+k]??255;b.writeUInt16LE(v%65536,nv*28+2*v);}raw+=zlib.deflateSync(b,{level:9}).length+600;}console.log('compress-only (encode:false) KiB',(raw/1024).toFixed(1));
console.log('TOTAL new tris',tris,'bytes',tot,'KiB',(tot/1024).toFixed(1),'MiB',(tot/1048576).toFixed(3));
