import fs from 'fs'; import path from 'path'; import zlib from 'zlib';
import { MeshoptEncoder } from 'meshoptimizer';
await MeshoptEncoder.ready;
const dir=process.argv[2];
const half=(v)=>{const f=new Float32Array([v]),i=new Uint32Array(f.buffer)[0];const s=(i>>>16)&0x8000;let e=((i>>>23)&0xff)-127+15,m=i&0x7fffff;if(e<=0)return s;if(e>=31)return s|0x7c00;return s|(e<<10)|(m>>>13);};
let tot={raw:0,rawZ:0,q:0,qZ:0,qE:0,qEZ:0,rawE:0,rawEZ:0};
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.glb'))){
 const b=fs.readFileSync(path.join(dir,f));const jl=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+jl));const bin=b.slice(20+jl+8);
 const acc=(i)=>{const a=j.accessors[i],bv=j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];const off=(bv.byteOffset||0)+(a.byteOffset||0);
  const C={5126:Float32Array,5121:Uint8Array,5123:Uint16Array,5125:Uint32Array}[a.componentType];return {n,count:a.count,d:new C(bin.buffer.slice(bin.byteOffset+off,bin.byteOffset+off+a.count*n*C.BYTES_PER_ELEMENT))};};
 for(const me of j.meshes)for(const p of me.primitives){
  const A=p.attributes,P=acc(A.POSITION),N=acc(A.NORMAL),U=A.TEXCOORD_0!=null?acc(A.TEXCOORD_0):null,Cc=A.COLOR_0!=null?acc(A.COLOR_0):null,I=acc(p.indices);const v=P.count;
  const rs=12+12+(U?8:0)+(Cc?4:0),qs0=6+6+(U?4:0)+(Cc?4:0),qs=Math.ceil(qs0/4)*4;
  const raw=Buffer.alloc(v*rs),q=Buffer.alloc(v*qs);
  for(let k=0;k<v;k++){let o=k*rs,oq=k*qs;for(let c=0;c<3;c++){raw.writeFloatLE(P.d[k*3+c],o);o+=4;q.writeUInt16LE(half(P.d[k*3+c]),oq);oq+=2;}
   for(let c=0;c<3;c++){raw.writeFloatLE(N.d[k*3+c],o);o+=4;q.writeUInt16LE(half(N.d[k*3+c]),oq);oq+=2;}
   if(U)for(let c=0;c<2;c++){raw.writeFloatLE(U.d[k*2+c],o);o+=4;q.writeUInt16LE(half(U.d[k*2+c]),oq);oq+=2;}
   if(Cc)for(let c=0;c<4;c++){raw[o++]=Cc.d[k*4+c];q[oq++]=Cc.d[k*4+c];}}
  const idx=Buffer.from(new Uint16Array(I.d).buffer);
  const encI=Buffer.from(MeshoptEncoder.encodeIndexBuffer(new Uint8Array(idx),I.count,2));
  const eq=Buffer.from(MeshoptEncoder.encodeVertexBuffer(new Uint8Array(q),v,qs)),er=Buffer.from(MeshoptEncoder.encodeVertexBuffer(new Uint8Array(raw),v,rs));
  const z=x=>zlib.deflateSync(x).length;
  tot.raw+=raw.length+idx.length;tot.rawZ+=z(Buffer.concat([raw,idx]));tot.q+=q.length+idx.length;tot.qZ+=z(Buffer.concat([q,idx]));
  tot.qE+=eq.length+encI.length;tot.qEZ+=z(Buffer.concat([eq,encI]));tot.rawE+=er.length+encI.length;tot.rawEZ+=z(Buffer.concat([er,encI]));}}
console.log(tot);
