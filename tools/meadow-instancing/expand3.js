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
    const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9],r=new Float32Array(9);
    const L=layout.attrs.map(a=>Object.assign({},a,{sem:SEM[a.name],meta:m.attrs[SEM[a.name]]}));
    function chunk(ci){
      const ch=m.chunks[ci],cu=unz(ch.z),xf=vw(cu,ch.f.xf),per={};for(const a in m.attrs)if(ch.f[a])per[a]=vw(cu,ch.f[a]);
      for(let j=0;j<ch.n;j++){const k=ch.i0+j,o=j*8,x=xf[o+3],y=xf[o+4],z=xf[o+5],w=xf[o+6],s=xf[o+7],tx=xf[o],ty=xf[o+1],tz=xf[o+2];
        r[0]=1-2*(y*y+z*z);r[1]=2*(x*y-z*w);r[2]=2*(x*z+y*w);r[3]=2*(x*y+z*w);r[4]=1-2*(x*x+z*z);r[5]=2*(y*z-x*w);r[6]=2*(x*z-y*w);r[7]=2*(y*z+x*w);r[8]=1-2*(x*x+y*y);
        for(let v=0;v<V;v++){const gv=k*V+v,bo=gv*stride;
          for(let q=0;q<L.length;q++){const a=L[q],fo=(bo+a.offset)>>2;
            if(a.sem==='POSITION'){const t0=T[3*v],t1=T[3*v+1],t2=T[3*v+2];const px=s*(r[0]*t0+r[1]*t1+r[2]*t2)+tx,py=s*(r[3]*t0+r[4]*t1+r[5]*t2)+ty,pz=s*(r[6]*t0+r[7]*t1+r[8]*t2)+tz;
              f32[fo]=px;f32[fo+1]=py;f32[fo+2]=pz;if(px<mn[0])mn[0]=px;if(py<mn[1])mn[1]=py;if(pz<mn[2])mn[2]=pz;if(px>mx[0])mx[0]=px;if(py>mx[1])mx[1]=py;if(pz>mx[2])mx[2]=pz;continue;}
            const md=a.meta,c=a.comps;if(!md)continue;
            if(md.mode==='rot'){const t=tpl.NORMAL,t0=t[3*v],t1=t[3*v+1],t2=t[3*v+2];f32[fo]=r[0]*t0+r[1]*t1+r[2]*t2;f32[fo+1]=r[3]*t0+r[4]*t1+r[5]*t2;f32[fo+2]=r[6]*t0+r[7]*t1+r[8]*t2;}
            else if(md.mode==='u8'){const src=per[a.sem],so=(j*V+v)*md.c;if(a.fmt==='u8n'){for(let e=0;e<c;e++)u8[bo+a.offset+e]=src[so+e];}else{for(let e=0;e<c;e++)f32[fo+e]=src[so+e]/255;}}
            else{const t=tpl[a.sem],tc=md.c;for(let e=0;e<c;e++)f32[fo+e]=t[v*tc+e];
              if(md.mode==='tplPlusOffset'){const off=per[a.sem],nc=md.cols.length;for(let e=0;e<nc;e++)f32[fo+md.cols[e]]+=off[j*nc+e];}}}}
        const io=k*K,vo=k*V;for(let i=0;i<K;i++)idx[io+i]=tI[i]+vo;}}
    function finish(){return {data,vb,ib,count:nv,icount:ni,stride,big,min:mn,max:mx,name:m.name};}
    return {chunk,finish,chunks:m.chunks.length,name:m.name};}
  return {hdr,begin};}
const api={qfi3Open};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this);
