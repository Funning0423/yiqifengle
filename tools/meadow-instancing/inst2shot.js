/* 注入 web 构建（?snowshot=1&inj=inst/inst2shot.js&cam=0|1|2&swap=0|1&cpu=）：加载 region_meadow/env_meadow，
 * swap=1 时把 8 个 *_instances 网格替换为 qfi2 分块展开结果（逐块计时，布局取自原网格），然后暂停游戏、dt=0 渲染一帧供截图。 */
(async function(){
const q=new URLSearchParams(location.search),S=window.__snow={ready:false,log:[],chunks:[]};const L=(...a)=>{S.log.push(a.join(' '));console.log('[i2]',...a);};
const {director,game,Scene,Node,Camera,DirectionalLight,MeshRenderer,Mesh,assetManager,Vec3,Color,gfx,instantiate,Prefab}=cc;
try{
const b=await new Promise((ok,no)=>assetManager.loadBundle('region_meadow',(e,x)=>e?no(e):ok(x)));
const pf=await new Promise((ok,no)=>b.load('env_meadow/env_meadow',Prefab,(e,x)=>e?no(e):ok(x)));
const sc=new Scene('m');director.runSceneImmediate(sc);const G=sc.globals;G.shadows.enabled=false;G.ambient.skyIllum=20000;
const root=instantiate(pf);sc.addChild(root);
const ln=new Node('sun');sc.addChild(ln);const dl=ln.addComponent(DirectionalLight);dl.illuminance=65000;ln.setRotationFromEuler(-40,-50,0);
const cams=[[[30,16,48],[0,3,-10]],[[-4.5,2.4,10],[-3,1.4,2]],[[3,7,-12],[-2,10,-27]]];const ci=+(q.get('cam')||0);
const cn=new Node('cam');sc.addChild(cn);const cam=cn.addComponent(Camera);cam.fov=48;cam.far=2000;cam.clearColor=new Color(160,190,230,255);
cn.setPosition(...cams[ci][0]);cn.lookAt(new Vec3(...cams[ci][1]));
await new Promise(r=>setTimeout(r,4000));
if(q.get('swap')==='3'){await new Promise(r=>setTimeout(r,3000));game.pause();director.tick(0);director.tick(0);S.phase='A';await new Promise(r=>{window.__next=r;});game.resume();}
if(q.get('swap')==='1'||q.get('swap')==='3'){
  const V3=typeof qfi3Open!=='undefined';const buf=await (await fetch(V3?'inst/inst_meadow.qfi3':'inst/inst_meadow.qfi2')).arrayBuffer();const Q=V3?qfi3Open(buf,u=>cc.utils.MeshUtils.inflateMesh({struct:{compressed:true},data:u}).data):qfi2Open(buf);S.format=V3?'qfi3':'qfi2';
  const rs=root.getComponentsInChildren(MeshRenderer);let dcBefore=0;
  for(let mi=0;mi<Q.hdr.meshes.length;mi++){const name=Q.hdr.meshes[mi].name;const r=rs.find(x=>x.node.name===name);if(!r){L('missing',name);continue;}
    const st=r.mesh.struct,vb0=st.vertexBundles[0];let off=0;const attrs=[];
    for(const a of vb0.attributes){const sz=gfx.FormatInfos[a.format].size,cnt=gfx.FormatInfos[a.format].count,isU8=gfx.FormatInfos[a.format].type===gfx.FormatType.UNORM;attrs.push({name:a.name,offset:off,comps:cnt,fmt:isU8?'u8n':'f32'});off+=sz;}
    if(off!==vb0.view.stride)L('stride mismatch',name,off,vb0.view.stride);
    const w=Q.begin(mi,{stride:vb0.view.stride,attrs});
    for(let c=0;c<w.chunks;c++){await new Promise(rr=>requestAnimationFrame(rr));const t=performance.now();w.chunk(c);S.chunks.push({mesh:name,c,ms:performance.now()-t});}
    const t=performance.now();const R=w.finish();
    const ns={vertexBundles:[{view:{offset:0,length:R.vb,count:R.count,stride:R.stride},attributes:vb0.attributes}],
      primitives:[{primitiveMode:st.primitives[0].primitiveMode,vertexBundelIndices:[0],indexView:{offset:R.vb,length:R.ib,count:R.icount,stride:R.big?4:2}}],
      minPosition:new Vec3(...R.min),maxPosition:new Vec3(...R.max)};
    try{const od=r.mesh.data,ov=vb0.view;if(od){const A=new Float32Array(od.buffer,od.byteOffset+ov.offset,ov.length/4),B=new Float32Array(R.data.buffer,0,R.vb/4);let e=0,ei=-1;const n=Math.min(A.length,B.length);for(let i=0;i<n;i++){const x=Math.abs(A[i]-B[i]);if(x>e){e=x;ei=i;}}
      const iv=st.primitives[0].indexView;S.cmp=S.cmp||{};S.cmp[name]={vbLenOrig:ov.length,vbLenNew:R.vb,count:ov.count,maxDiff:e,at:ei,stride:ov.stride,idxOrig:iv&&iv.count,idxNew:R.icount,prims:st.primitives.length,bundles:st.vertexBundles.length};}else S.cmp={nodata:true};}catch(e){L('cmp err',String(e));}
    const m=new Mesh();m.reset({struct:ns,data:R.data});r.mesh=m;S.chunks.push({mesh:name,c:'reset',ms:performance.now()-t});
    S.layout=S.layout||{};S.layout[name]=attrs.map(a=>a.name+':'+a.fmt+a.comps).join(',');}
}
if(q.get('swap')==='2'){for(const r of root.getComponentsInChildren(MeshRenderer))if(/_instances\./.test(r.node.name)){const m=r.mesh;r.mesh=null;r.mesh=m;}}
await new Promise(r=>setTimeout(r,3000));game.pause();director.tick(0);director.tick(0);
S.drawMeshes=root.getComponentsInChildren(MeshRenderer).filter(r=>r.enabledInHierarchy&&r.mesh).length;
S.ready=true;L('ok');}catch(e){L('ERR',String(e&&e.stack||e));S.ready=true;}
})();
