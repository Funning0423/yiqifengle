/* qfinst v3（每块 zlib）分块展开；inflate 由调用方注入（浏览器/小游戏用引擎自带的 cc.utils.MeshUtils.inflateMesh，即 Mesh.initialize 同一个 Zlib.Inflate）：每帧处理一块（≤chunkV 顶点），直接写入最终交错缓冲（按原网格的顶点布局），没有中间数组。
 * const q=qfi2Open(buf); const w=q.begin(mi, layout); for(ci) w.chunk(ci); const {data,vb,ib,count,icount,stride,min,max}=w.finish();
 * layout: {stride, attrs:[{name:'a_position'|'a_normal'|'a_texCoord'|'a_texCoord1'|'a_color', offset, comps, fmt:'f32'|'u8n'}]} */
(function(root){
const SEM={a_position:'POSITION',a_normal:'NORMAL',a_texCoord:'TEXCOORD_0',a_texCoord1:'TEXCOORD_1',a_color:'COLOR_0'};
function qfi3Open(buf,inflate){
  const dv=new DataView(buf);if(dv.getUint32(0,true)!==0x33494651)throw Error('qfinst3 magic');
  const hl=dv.getUint32(4,true),hdr=JSON.parse(new TextDecoder().decode(inflate(new Uint8Array(buf,8,hl)))),base=8+hl+((4-hl%4)%4);
  const unz=z=>{const u=inflate(new Uint8Array(buf,base+z[0],z[1]));return u.byteOffset%4?u.slice():u;};
  const vw=(u,d)=>{const [o,len,dt]=d,b=u.byteOffset+o;return dt==='float32'?new Float32Array(u.buffer,b,len/4):dt==='uint16'?new Uint16Array(u.buffer,b,len/2):new Uint8Array(u.buffer,b,len);};
  function begin(mi,layout){
    const m=hdr.meshes[mi],N=m.n,V=m.v,K=m.k,nv=N*V,ni=N*K,stride=layout.stride,vb=nv*stride,big=nv>65535,ib=ni*(big?4:2);
    const data=new Uint8Array(vb+ib),f32=new Float32Array(data.buffer,0,vb/4),u8=data,idx=big?new Uint32Array(data.buffer,vb,ni):new Uint16Array(data.buffer,vb,ni);
    const tu=unz(m.tplZ),tpl={};for(const a in m.tplF)tpl[a]=vw(tu,m.tplF[a]);const T=tpl.POSITION,tI=tpl.idx;
    const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
    // 每个属性单独一趟紧凑循环（单态、无字符串比较），解释执行期也快；r/mn/mx 预分配，块内无新对象（除 inflate 输出与视图）
    const KP=0,KN=1,KU8=2,KU8N=3,KT=4,KTO=5;
    const L=[];for(const a of layout.attrs){const sem=SEM[a.name],md=m.attrs[sem];let k=-1;
      if(sem==='POSITION')k=KP;else if(!md)continue;else if(md.mode==='rot')k=KN;else if(md.mode==='u8')k=a.fmt==='u8n'?KU8N:KU8;else k=md.mode==='tplPlusOffset'?KTO:KT;
      L.push({k,sem,off:a.offset,c:a.comps,mc:md?md.c:3,cols:md&&md.cols?Int32Array.from(md.cols):null,t:sem==='POSITION'?T:tpl[sem]});}
    const sf=stride>>2;
    function chunk(ci){
      const ch=m.chunks[ci],cu=unz(ch.z),xf=vw(cu,ch.f.xf),n=ch.n,i0=ch.i0;
      for(let q=0;q<L.length;q++){const a=L[q],k=a.k,t=a.t,c=a.c;
        if(k===KP||k===KN){const o0=a.off>>2;
          for(let j=0;j<n;j++){const o=j*8,x=xf[o+3],y=xf[o+4],z=xf[o+5],w=xf[o+6],s=k===KP?xf[o+7]:1,tx=k===KP?xf[o]:0,ty=k===KP?xf[o+1]:0,tz=k===KP?xf[o+2]:0;
            const r0=1-2*(y*y+z*z),r1=2*(x*y-z*w),r2=2*(x*z+y*w),r3=2*(x*y+z*w),r4=1-2*(x*x+z*z),r5=2*(y*z-x*w),r6=2*(x*z-y*w),r7=2*(y*z+x*w),r8=1-2*(x*x+y*y);
            let fo=(i0+j)*V*sf+o0;
            for(let v=0;v<V;v++,fo+=sf){const t0=t[3*v],t1=t[3*v+1],t2=t[3*v+2],px=s*(r0*t0+r1*t1+r2*t2)+tx,py=s*(r3*t0+r4*t1+r5*t2)+ty,pz=s*(r6*t0+r7*t1+r8*t2)+tz;
              f32[fo]=px;f32[fo+1]=py;f32[fo+2]=pz;
              if(k===KP){if(px<mn[0])mn[0]=px;if(py<mn[1])mn[1]=py;if(pz<mn[2])mn[2]=pz;if(px>mx[0])mx[0]=px;if(py>mx[1])mx[1]=py;if(pz>mx[2])mx[2]=pz;}}}}
        else if(k===KU8||k===KU8N){const src=vw(cu,ch.f[a.sem]),mc=a.mc;
          if(k===KU8N){let bo=(i0*V)*stride+a.off;for(let g=0;g<n*V;g++,bo+=stride)for(let e=0;e<c;e++)u8[bo+e]=src[g*mc+e];}
          else{let fo=((i0*V)*stride+a.off)>>2;for(let g=0;g<n*V;g++,fo+=sf)for(let e=0;e<c;e++)f32[fo+e]=src[g*mc+e]/255;}}
        else{const mc=a.mc;let fo=((i0*V)*stride+a.off)>>2;
          for(let j=0;j<n;j++)for(let v=0;v<V;v++,fo+=sf)for(let e=0;e<c;e++)f32[fo+e]=t[v*mc+e];
          if(k===KTO){const off=vw(cu,ch.f[a.sem]),cols=a.cols,nc=cols.length;let fo2=((i0*V)*stride+a.off)>>2;
            for(let j=0;j<n;j++)for(let v=0;v<V;v++,fo2+=sf)for(let e=0;e<nc;e++)f32[fo2+cols[e]]+=off[j*nc+e];}}}
      for(let j=0;j<n;j++){const io=(i0+j)*K,vo=(i0+j)*V;for(let i=0;i<K;i++)idx[io+i]=tI[i]+vo;}}
    function finish(){return {data,vb,ib,count:nv,icount:ni,stride,big,min:mn,max:mx,name:m.name};}
    return {chunk,finish,chunks:m.chunks.length,name:m.name};}
  return {hdr,begin};}
const api={qfi3Open};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this);
