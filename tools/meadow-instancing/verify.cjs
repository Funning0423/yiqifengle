// node verify.cjs <env_meadow.glb> <qfi(deflate)> ：展开结果对照 glb 原始数组，并测 node 下展开耗时
const fs=require('fs'),zlib=require('zlib'),{expandQfi}=require('./expand.js');
const [glbP,qfiP]=process.argv.slice(2);const b=fs.readFileSync(glbP),L=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+L)),bin=b.slice(28+L);
const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function acc(i){const a=j.accessors[i],bv=j.bufferViews[a.bufferView],n=NC[a.type],cs=a.componentType===5126?4:a.componentType===5123?2:4,st=bv.byteStride||cs*n,o=(bv.byteOffset||0)+(a.byteOffset||0),out=new Float64Array(a.count*n);
 for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const p=o+k*st+c*cs;out[k*n+c]=a.componentType===5126?bin.readFloatLE(p):a.componentType===5123?bin.readUInt16LE(p):bin.readUInt32LE(p);}return out;}
const t0=process.hrtime.bigint();const raw=zlib.inflateSync(fs.readFileSync(qfiP));const t1=process.hrtime.bigint();
const ab=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length);let ms=[];let res;for(let r=0;r<20;r++){const a=process.hrtime.bigint();res=expandQfi(ab);ms.push(Number(process.hrtime.bigint()-a)/1e6);}
ms.sort((a,b)=>a-b);console.log('inflate ms',Number(t1-t0)/1e6,'expand ms median',ms[10].toFixed(2),'first',ms[0].toFixed(2));
let bytes=0;for(const m of res){const n=j.nodes.find(x=>x.name===m.name),p=j.meshes[n.mesh].primitives[0];const e={};
 const cmp=(A,B)=>{let x=0;for(let i=0;i<A.length;i++)x=Math.max(x,Math.abs(A[i]-B[i]));return x;};
 e.pos=cmp(m.positions,acc(p.attributes.POSITION));e.idx=cmp(m.indices,acc(p.indices));
 for(const a in p.attributes)if(a!=='POSITION')e[a]=cmp(m.attrs[a],acc(p.attributes[a]));
 bytes+=m.positions.byteLength+m.indices.byteLength+Object.values(m.attrs).reduce((s,x)=>s+x.byteLength,0);
 console.log(m.name,JSON.stringify(Object.fromEntries(Object.entries(e).map(([k,v])=>[k,+v.toExponential(2)]))));}
console.log('expanded typed-array bytes',bytes);
