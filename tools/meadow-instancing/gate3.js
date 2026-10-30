/* GGbot 手机模型复现：box 上 Mesh.initialize（JS zlib inflate + 顶点缓冲上传）耗时 ×4。
 * 1) 加载 region_meadow/env_meadow，按网格记录引擎 initialize 耗时（今天的形态）；
 * 2) 每个网格拆开测：只 inflate（引擎 Zlib，MeshUtils.inflateMesh）/ 只上传（未压缩 Mesh.initialize + renderingSubMeshes）；
 * 3) qfi3：每块 inflate+展开，最终每网格 Mesh.initialize（上传）。结果写 window.__snow。 */
(async function(){
const S=window.__snow={ready:false,log:[],init:{},parts:{},chunks:[],final:{}};const L=(...a)=>{S.log.push(a.join(' '));console.log('[g3]',...a);};
const {director,Scene,Node,Camera,MeshRenderer,Mesh,assetManager,Vec3,gfx,instantiate,Prefab,utils}=cc;
const now=()=>performance.now();
try{
const P=Mesh.prototype,orig=P.initialize;P.initialize=function(){if(this._initialized)return orig.call(this);const t=now();const r=orig.call(this);try{void this.renderingSubMeshes;}catch(e){}const ms=now()-t;(S.init[this._uuid]=S.init[this._uuid]||[]).push(+ms.toFixed(3));return r;};
const b=await new Promise((ok,no)=>assetManager.loadBundle('region_meadow',(e,x)=>e?no(e):ok(x)));
const pf=await new Promise((ok,no)=>b.load('env_meadow/env_meadow',Prefab,(e,x)=>e?no(e):ok(x)));
const sc=new Scene('m');director.runSceneImmediate(sc);const root=instantiate(pf);sc.addChild(root);const cn=new Node('cam');sc.addChild(cn);cn.addComponent(Camera);cn.setPosition(30,16,48);cn.lookAt(new Vec3(0,3,-10));
await new Promise(r=>setTimeout(r,1500));
const seen=new Set(),meshes=[];for(const r of root.getComponentsInChildren(MeshRenderer)){const m=r.mesh;if(m&&!seen.has(m)){seen.add(m);m.__qfn=r.node.name;meshes.push(m);}}
const inflate=u=>utils.MeshUtils.inflateMesh({struct:{compressed:true},data:u}).data;
const ONLY=new URLSearchParams(location.search).get('only');
for(const m of (ONLY==='qfi'?[]:meshes)){const name=m.__qfn;const rec={uuid:m._uuid,bytesOut:m.data.byteLength,uploadMs:[],inflateMs:[]};
  let zbytes=null;try{const url=m.nativeUrl||assetManager.utils.getUrlWithUuid(m._uuid,{isNative:true,nativeExt:'.bin'});const ab=await (await fetch(url)).arrayBuffer();zbytes=new Uint8Array(ab);rec.bytesIn=ab.byteLength;}catch(e){rec.fetchErr=String(e);}
  for(let k=0;k<5;k++){await new Promise(r=>requestAnimationFrame(r));
    const st=JSON.parse(JSON.stringify(m.struct));st.compressed=false;const nm=new Mesh();nm.reset({struct:st,data:m.data.slice()});let t=now();nm.initialize();void nm.renderingSubMeshes;rec.uploadMs.push(+(now()-t).toFixed(3));nm.destroy();
    if(zbytes){try{t=now();const u=inflate(zbytes.slice());rec.inflateMs.push(+(now()-t).toFixed(3));rec.inflOk=u.byteLength===m.data.byteLength;}catch(e){rec.inflErr=String(e);}}}
  S.parts[name]=rec;}
// qfi3
const buf=await (await fetch('inst/inst_meadow.qfi3')).arrayBuffer();const Q=qfi3Open(buf,inflate);
const rs=root.getComponentsInChildren(MeshRenderer);
for(let mi=0;mi<Q.hdr.meshes.length;mi++){const name=Q.hdr.meshes[mi].name;const r=rs.find(x=>x.node.name===name);const st=r.mesh.struct,vb0=st.vertexBundles[0];let off=0;const attrs=[];
  for(const a of vb0.attributes){const fi=gfx.FormatInfos[a.format];attrs.push({name:a.name,offset:off,comps:fi.count,fmt:fi.type===gfx.FormatType.UNORM?'u8n':'f32'});off+=fi.size;}
  await new Promise(rr=>requestAnimationFrame(rr));let t=now();const w=Q.begin(mi,{stride:vb0.view.stride,attrs});S.chunks.push({mesh:name,c:'tpl',ms:+(now()-t).toFixed(3)});
  for(let c=0;c<w.chunks;c++){await new Promise(rr=>requestAnimationFrame(rr));t=now();w.chunk(c);S.chunks.push({mesh:name,c,ms:+(now()-t).toFixed(3)});}
  const R=w.finish();const ns={vertexBundles:[{view:{offset:0,length:R.vb,count:R.count,stride:R.stride},attributes:vb0.attributes}],primitives:[{primitiveMode:st.primitives[0].primitiveMode,vertexBundelIndices:[0],indexView:{offset:R.vb,length:R.ib,count:R.icount,stride:R.big?4:2}}],minPosition:new Vec3(...R.min),maxPosition:new Vec3(...R.max)};
  const ups=[];for(let k=0;k<5;k++){await new Promise(rr=>requestAnimationFrame(rr));const m=new Mesh();m.reset({struct:JSON.parse(JSON.stringify(ns)),data:R.data});t=now();m.initialize();void m.renderingSubMeshes;ups.push(+(now()-t).toFixed(3));if(k<4)m.destroy();else r.mesh=m;}
  S.final[name]={bytes:R.data.byteLength,uploadMs:ups};}
S.ready=true;L('ok');}catch(e){L('ERR',String(e&&e.stack||e));S.ready=true;}})();
