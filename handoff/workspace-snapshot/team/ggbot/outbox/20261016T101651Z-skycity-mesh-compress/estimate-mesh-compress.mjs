import fs from 'fs';import zlib from 'zlib';import {MeshoptEncoder as E} from 'meshoptimizer';
await E.ready;
const b=fs.readFileSync('/tmp/v3dec/skycity.glb'),jl=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+jl)),bin=b.slice(20+jl+8);
const CN={5126:4,5123:2,5125:4,5121:1},NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const acc=i=>{const a=j.accessors[i],bv=j.bufferViews[a.bufferView],n=NC[a.type],o=(bv.byteOffset||0)+(a.byteOffset||0),st=bv.byteStride||CN[a.componentType]*n;const out=new Float32Array(a.count*n);
 for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const p=o+k*st+c*CN[a.componentType];out[k*n+c]=a.componentType===5126?bin.readFloatLE(p):a.componentType===5123?bin.readUInt16LE(p):a.componentType===5125?bin.readUInt32LE(p):bin.readUInt8(p);}return {d:out,n,count:a.count,ct:a.componentType};};
const h=new Float32Array(1),hi=new Uint32Array(h.buffer);const f16=x=>{h[0]=x;const v=hi[0],s=(v>>>16)&0x8000;let e=((v>>>23)&0xff)-112,m=v&0x7fffff;if(e<=0)return s;if(e>=31)return s|0x7c00;return s|(e<<10)|(m>>>13);};
const unf16=u=>{const s=u&0x8000?-1:1,e=(u>>10)&31,m=u&1023;return e===0?s*m*2**-24:s*(1+m/1024)*2**(e-15);};
const rows=[];let T={raw:0,cz:0,enc:0,encz:0,q:0,qencz:0,qz:0};
for(const m of j.meshes){let r={n:m.name,raw:0,cz:0,enc:0,encz:0,q:0,qencz:0,v:0,posErr:0,ext:0};
 for(const p of m.primitives){const at=Object.entries(p.attributes).map(([k,i])=>[k,acc(i)]);if(!at.find(a=>a[0]==='TANGENT')&&at.find(a=>a[0]==='NORMAL'))at.push(['TANGENT',{d:new Float32Array(at[0][1].count*4),n:4,count:at[0][1].count}]);
  const cnt=at[0][1].count,stride=at.reduce((s,[,a])=>s+a.n*4,0),vb=Buffer.alloc(cnt*stride);let o=0;for(let k=0;k<cnt;k++)for(const [,a] of at)for(let c=0;c<a.n;c++){vb.writeFloatLE(a.d[k*a.n+c],o);o+=4;}
  const qs=at.reduce((s,[,a])=>s+Math.ceil(a.n*2/4)*4,0),qb=Buffer.alloc(cnt*qs);o=0;for(let k=0;k<cnt;k++)for(const [,a] of at){const st=o;for(let c=0;c<a.n;c++){qb.writeUInt16LE(f16(a.d[k*a.n+c]),o);o+=2;}o=st+Math.ceil(a.n*2/4)*4;}
  const pos=at.find(a=>a[0]==='POSITION')[1];for(let k=0;k<pos.d.length;k++){r.posErr=Math.max(r.posErr,Math.abs(unf16(f16(pos.d[k]))-pos.d[k]));r.ext=Math.max(r.ext,Math.abs(pos.d[k]));}
  const idx=p.indices!=null?acc(p.indices):null,ib=idx?(cnt>65535?Buffer.from(Uint32Array.from(idx.d).buffer):Buffer.from(Uint16Array.from(idx.d).buffer)):Buffer.alloc(0);
  const ev=Buffer.from(E.encodeVertexBuffer(new Uint8Array(vb),cnt,stride)),eqv=Buffer.from(E.encodeVertexBuffer(new Uint8Array(qb),cnt,qs));let ei=Buffer.alloc(0);
  if(idx&&idx.count%3===0){ei=Buffer.from(E.encodeIndexBuffer(new Uint8Array(Uint32Array.from(idx.d).buffer),idx.count,4));}else ei=ib;
  r.v+=cnt;r.raw+=vb.length+ib.length;r.cz+=zlib.deflateSync(Buffer.concat([vb,ib]),{level:9}).length;r.enc+=ev.length+ei.length;r.encz+=zlib.deflateSync(Buffer.concat([ev,ei]),{level:9}).length;r.q+=qb.length+ib.length;r.qencz+=zlib.deflateSync(Buffer.concat([eqv,ei]),{level:9}).length;r.qz=(r.qz||0)+zlib.deflateSync(Buffer.concat([qb,ib]),{level:9}).length;}
 for(const k in T)T[k]+=r[k];rows.push(r);}
rows.sort((a,b)=>b.raw-a.raw);const M=x=>(x/1048576).toFixed(3);
for(const r of rows.slice(0,8))console.log(r.n.padEnd(32),r.v,'raw',M(r.raw),'zlib',M(r.cz),'enc',M(r.enc),'enc+z',M(r.encz),'q',M(r.q),'q+enc+z',M(r.qencz),'q+z',M(r.qz),'posErr',r.posErr.toExponential(1),'ext',r.ext.toFixed(1));
console.log('TOTAL meshes',rows.length,Object.fromEntries(Object.entries(T).map(([k,v])=>[k,M(v)])));
