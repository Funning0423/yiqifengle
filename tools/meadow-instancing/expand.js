/* b19 方案 R 原型：qfinst v1（未压缩 ArrayBuffer）→ 8 个合并网格的顶点/索引数组。浏览器与 node 通用。
 * 返回 [{name, positions:Float32Array, normals?, uvs?, uvs1?, colors:Float32Array, indices:Uint16Array|Uint32Array, minPos, maxPos}] */
(function(root){
function expandQfi(buf,only){
  const dv=new DataView(buf);if(dv.getUint32(0,true)!==0x31494651)throw Error('qfinst magic');
  const hl=dv.getUint32(4,true),hdr=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,8,hl))),base=8+hl+((4-hl%4)%4);
  const view=(d)=>{const [o,len,dt]=d,b=base+o;return dt==='float32'?new Float32Array(buf,b,len/4):dt==='uint16'?new Uint16Array(buf,b,len/2):new Uint8Array(buf,b,len);};
  const out=[];
  for(let mi=0;mi<hdr.meshes.length;mi++){const m=hdr.meshes[mi];if(only!=null&&only!==mi)continue;
    const N=m.n,V=m.v,K=m.k,T=view(m.pos),inst=view(m.inst),tI=view(m.idx);
    const pos=new Float32Array(N*V*3),idx=(N*V>65535?new Uint32Array(N*K):new Uint16Array(N*K));
    const R=new Float32Array(9*N);const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
    for(let k=0;k<N;k++){const o=k*8,x=inst[o+3],y=inst[o+4],z=inst[o+5],w=inst[o+6],s=inst[o+7],tx=inst[o],ty=inst[o+1],tz=inst[o+2];
      const r=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)];R.set(r,9*k);
      for(let v=0;v<V;v++){const a=T[3*v],b=T[3*v+1],c=T[3*v+2],d=3*(k*V+v);
        const px=s*(r[0]*a+r[1]*b+r[2]*c)+tx,py=s*(r[3]*a+r[4]*b+r[5]*c)+ty,pz=s*(r[6]*a+r[7]*b+r[8]*c)+tz;pos[d]=px;pos[d+1]=py;pos[d+2]=pz;
        if(px<mn[0])mn[0]=px;if(py<mn[1])mn[1]=py;if(pz<mn[2])mn[2]=pz;if(px>mx[0])mx[0]=px;if(py>mx[1])mx[1]=py;if(pz>mx[2])mx[2]=pz;}
      const io=k*K,vo=k*V;for(let i=0;i<K;i++)idx[io+i]=tI[i]+vo;}
    const res={name:m.name,positions:pos,indices:idx,minPos:mn,maxPos:mx,attrs:{}};
    const done={};
    for(const a in m.attrs){const d=m.attrs[a];let arr;
      if(d.mode==='alias'){res.attrs[a]=done[d.of];continue;}
      if(d.mode==='rot'){const t=view(d.tpl);arr=new Float32Array(N*V*3);for(let k=0;k<N;k++){const r=R.subarray(9*k,9*k+9);for(let v=0;v<V;v++){const a0=t[3*v],b0=t[3*v+1],c0=t[3*v+2],o=3*(k*V+v);arr[o]=r[0]*a0+r[1]*b0+r[2]*c0;arr[o+1]=r[3]*a0+r[4]*b0+r[5]*c0;arr[o+2]=r[6]*a0+r[7]*b0+r[8]*c0;}}}
      else if(d.mode==='tpl'){const t=view(d.tpl),c=t.length/V;arr=new Float32Array(N*V*c);for(let k=0;k<N;k++)arr.set(t,k*V*c);}
      else if(d.mode==='tplPlusOffset'){const t=view(d.tpl),c=t.length/V,off=view(d.off),nc=d.cols.length;arr=new Float32Array(N*V*c);
        for(let k=0;k<N;k++){arr.set(t,k*V*c);for(let j=0;j<nc;j++){const cc=d.cols[j],ov=off[k*nc+j];for(let v=0;v<V;v++)arr[(k*V+v)*c+cc]+=ov;}}}
      else if(d.mode==='u8'){const u=view(d.data);arr=new Float32Array(u.length);for(let i=0;i<u.length;i++)arr[i]=u[i]/255;}
      else if(d.mode==='f32'){arr=view(d.data).slice();}
      done[a]=arr;res.attrs[a]=arr;}
    out.push(res);}
  out.count=hdr.meshes.length;return out;}
if(typeof module!=='undefined')module.exports={expandQfi};else root.expandQfi=expandQfi;
})(typeof globalThis!=='undefined'?globalThis:this);
/* 交错直出：把 expandQfi 的一个网格写成 cc.Mesh.reset 需要的 {struct,data}，省掉 MeshUtils.createMesh 的 number[] 中转。
 * fmt: gfx.Format 枚举（RGB32F/RG32F/RGBA32F）；attrName 用引擎标准名。 */
(function(root){
function interleave(m,gfx){
  const A=[['a_position',m.positions,3]];if(m.attrs.NORMAL)A.push(['a_normal',m.attrs.NORMAL,3]);if(m.attrs.TEXCOORD_0)A.push(['a_texCoord',m.attrs.TEXCOORD_0,2]);
  if(m.attrs.TEXCOORD_1)A.push(['a_texCoord1',m.attrs.TEXCOORD_1,2]);if(m.attrs.COLOR_0)A.push(['a_color',m.attrs.COLOR_0,4]);
  const n=m.positions.length/3,comps=A.reduce((s,a)=>s+a[2],0),stride=comps*4,vb=n*stride,ib=m.indices.byteLength,data=new Uint8Array(vb+ib),f=new Float32Array(data.buffer,0,vb/4);
  let o=0;for(const [,arr,c] of A){for(let v=0;v<n;v++)for(let k=0;k<c;k++)f[v*comps+o+k]=arr[v*c+k];o+=c;}
  data.set(new Uint8Array(m.indices.buffer,m.indices.byteOffset,ib),vb);
  const F={2:gfx.Format.RG32F,3:gfx.Format.RGB32F,4:gfx.Format.RGBA32F};
  return {data,struct:{vertexBundles:[{view:{offset:0,length:vb,count:n,stride},attributes:A.map(([nm,,c])=>new gfx.Attribute(nm,F[c]))}],
    primitives:[{primitiveMode:gfx.PrimitiveMode.TRIANGLE_LIST,vertexBundelIndices:[0],indexView:{offset:vb,length:ib,count:m.indices.length,stride:m.indices.BYTES_PER_ELEMENT}}],
    minPosition:new cc.Vec3(...m.minPos),maxPosition:new cc.Vec3(...m.maxPos)}};}
root.interleaveQfiMesh=interleave;})(typeof globalThis!=='undefined'?globalThis:this);
