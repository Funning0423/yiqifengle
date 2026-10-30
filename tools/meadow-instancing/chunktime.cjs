// node chunktime.cjs <glb> <qfi2> [phoneFactor]：校验 + 每块耗时（本机 node，取 30 次中位数）× 手机系数
const fs=require('fs'),zlib=require('zlib'),{qfi2Open}=require('./expand2.js');
const [glbP,qP,PF]=process.argv.slice(2);const F=+PF||8;
const b=fs.readFileSync(glbP),L=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+L)),bin=b.slice(28+L);const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function acc(i){const a=j.accessors[i],bv=j.bufferViews[a.bufferView],n=NC[a.type],cs=a.componentType===5126?4:a.componentType===5123?2:4,st=bv.byteStride||cs*n,o=(bv.byteOffset||0)+(a.byteOffset||0),out=new Float64Array(a.count*n);
 for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const p=o+k*st+c*cs;out[k*n+c]=a.componentType===5126?bin.readFloatLE(p):a.componentType===5123?bin.readUInt16LE(p):bin.readUInt32LE(p);}return out;}
const raw=fs.readFileSync(qP),buf=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length),q=qfi2Open(buf);
const rows=[];let maxErr={};
q.hdr.meshes.forEach((m,mi)=>{const node=j.nodes.find(x=>x.name===m.name),p=j.meshes[node.mesh].primitives[0];
  const order=[['a_position',3,'POSITION'],['a_normal',3,'NORMAL'],['a_texCoord',2,'TEXCOORD_0'],['a_texCoord1',2,'TEXCOORD_1'],['a_color',4,'COLOR_0']].filter(a=>p.attributes[a[2]]);
  let off=0;const attrs=order.map(([name,c])=>{const r={name,offset:off,comps:c,fmt:'f32'};off+=c*4;return r;});const layout={stride:off,attrs};
  const times=m.chunks.map(()=>[]);let w;
  for(let rep=0;rep<31;rep++){w=q.begin(mi,layout);for(let ci=0;ci<w.chunks;ci++){const t=process.hrtime.bigint();w.chunk(ci);times[ci].push(Number(process.hrtime.bigint()-t)/1e6);}}
  const r=w.finish(),f=new Float32Array(r.data.buffer,0,r.vb/4),comps=layout.stride/4;
  for(const a of attrs){const ref=acc(p.attributes[order.find(o=>o[0]===a.name)[2]]);let e=0;for(let v=0;v<r.count;v++)for(let c=0;c<a.comps;c++)e=Math.max(e,Math.abs(f[v*comps+a.offset/4+c]-ref[v*a.comps+c]));maxErr[m.name+':'+a.name]=e;}
  const I=acc(p.indices),ix=r.big?new Uint32Array(r.data.buffer,r.vb,r.icount):new Uint16Array(r.data.buffer,r.vb,r.icount);let ie=0;for(let i=0;i<I.length;i++)ie=Math.max(ie,Math.abs(I[i]-ix[i]));maxErr[m.name+':idx']=ie;
  const med=times.map(t=>t.sort((a,b)=>a-b)[15]);const mxm=Math.max(...med);
  rows.push({mesh:m.name,inst:m.n,vPerInst:m.v,chunks:m.chunks.length,instPerChunk:m.chunks[0].n,vPerChunk:m.chunks[0].n*m.v,boxMsMax:+mxm.toFixed(3),phoneMsMax:+(mxm*F).toFixed(2),boxMsTotal:+med.reduce((a,b)=>a+b,0).toFixed(3),phoneMsTotal:+(med.reduce((a,b)=>a+b,0)*F).toFixed(1),finalBytes:r.data.byteLength});});
console.table(rows);console.log('maxErr',JSON.stringify(maxErr));fs.writeFileSync(qP+'.timing.json',JSON.stringify({phoneFactor:F,rows,maxErr},null,1));
