/* 加载 env_meadow，导出 6 个非实例网格的 struct + 解压后原始 data（base64），供 bake_seg.py 使用 */
(async function(){const S=window.__snow={ready:false,log:[],out:{}};
const {director,Scene,MeshRenderer,assetManager,instantiate,Prefab}=cc;
const NAMES=['meadow_far_hills','meadow_terrain','meadow_trees_merged','meadow_clouds_near','meadow_river_bank','meadow_river'];
try{const b=await new Promise((ok,no)=>assetManager.loadBundle('region_meadow',(e,x)=>e?no(e):ok(x)));
const pf=await new Promise((ok,no)=>b.load('env_meadow/env_meadow',Prefab,(e,x)=>e?no(e):ok(x)));
const sc=new Scene('m');director.runSceneImmediate(sc);const root=instantiate(pf);sc.addChild(root);
for(const r of root.getComponentsInChildren(MeshRenderer)){const n=r.node.name;if(!NAMES.includes(n)||S.out[n])continue;const m=r.mesh;m.initialize();
  const url=assetManager.utils.getUrlWithUuid(m._uuid,{isNative:true,nativeExt:'.bin'});const ab=new Uint8Array(await (await fetch(url)).arrayBuffer());
  let s='';const d=m.data;for(let i=0;i<d.length;i+=32768)s+=String.fromCharCode.apply(null,d.subarray(i,i+32768));
  const st=JSON.parse(JSON.stringify(m.struct));S.out[n]={uuid:m._uuid,url,binBytes:ab.length,struct:st,dataB64:btoa(s),mats:r.sharedMaterials.map(x=>x&&x.name)};}
S.ready=true;}catch(e){S.log.push(String(e&&e.stack||e));S.ready=true;}})();
