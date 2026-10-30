/* QFS1 计时：每帧 inflate 一段（引擎 MeshUtils.inflateMesh）并拷入预分配缓冲；最后一帧 Mesh.reset+initialize（上传）。逐字节对比原网格。 */
(async function(){const S=window.__snow={ready:false,log:[],segs:[],final:{},eq:{},orig:{}};
const {director,Scene,MeshRenderer,assetManager,instantiate,Prefab,Mesh,utils}=cc;const now=()=>performance.now(),raf=()=>new Promise(r=>requestAnimationFrame(r));
const inflate=u=>utils.MeshUtils.inflateMesh({struct:{compressed:true},data:u}).data;
try{const buf=await (await fetch('inst/meadow_seg.qfs')).arrayBuffer();const dv=new DataView(buf),hl=dv.getUint32(4,true);
const hdr=JSON.parse(new TextDecoder().decode(inflate(new Uint8Array(buf,8,hl)))),base=8+hl+((4-hl%4)%4);
const b=await new Promise((ok,no)=>assetManager.loadBundle('region_meadow',(e,x)=>e?no(e):ok(x)));
const pf=await new Promise((ok,no)=>b.load('env_meadow/env_meadow',Prefab,(e,x)=>e?no(e):ok(x)));
const sc=new Scene('m');director.runSceneImmediate(sc);const root=instantiate(pf);sc.addChild(root);const rs=root.getComponentsInChildren(MeshRenderer);
for(const m of hdr.meshes){const data=new Uint8Array(m.rawBytes);
  for(let i=0;i<m.segs.length;i++){const [o,zl,ro,rl]=m.segs[i];await raf();const t=now();const u=inflate(new Uint8Array(buf,base+o,zl));data.set(u,ro);S.segs.push({mesh:m.name,i,rawKB:+(rl/1024).toFixed(1),ms:+(now()-t).toFixed(3)});}
  const ups=[];let nm;for(let k=0;k<5;k++){await raf();nm=new Mesh();nm.reset({struct:JSON.parse(JSON.stringify(m.struct)),data});const t=now();nm.initialize();void nm.renderingSubMeshes;ups.push(+(now()-t).toFixed(3));if(k<4)nm.destroy();}
  S.final[m.name]=ups;const r=rs.find(x=>x.node.name===m.name);const od=r.mesh.data;let eq=od.length===data.length;for(let i=0;eq&&i<od.length;i++)if(od[i]!==data[i])eq=false;S.eq[m.name]=eq;r.mesh=nm;}
S.ready=true;}catch(e){S.log.push(String(e&&e.stack||e));S.ready=true;}})();
