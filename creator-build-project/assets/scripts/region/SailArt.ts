import {Camera, Color, Mat4, Material, Mesh, MeshRenderer, Node, PointLight, Prefab, Texture2D, Vec3, Vec4, assetManager, director, gfx, instantiate, utils} from 'cc';
import type {Vec} from '../world-r1/WorldFlowCore';
import {meadowCloudColor, meadowGroundFactor, MEADOW_PROP_NIGHT} from './MeadowBoardBackground';
import {sailChannelWorldY} from './SailChannel';
import {inGrassClearLocal} from './SailLanding';
import {SAIL_BERTH_X, SAIL_I6, SAIL_SEA_Y, sailBerthWorld, sailRoute, type SailPose} from './TransportLeg';
import {SAIL_DAY_SAIL_RGB, SAIL_NIGHT_SAIL_RGB, SAIL_STAR_COUNT, sailStarRadius, sailStarWorld} from './SailStars';
const SEA_SCALE=3.2;
const ISLAND_SEA=['env_sea_surface','env_sea_foam','env_sea_surf_foam_v22','env_sea_wave_line_01_v22','env_sea_wave_line_02_v22'];
export function findNode(node:Node|null,name:string):Node|null{if(!node)return null;if(node.name===name)return node;for(const c of node.children){const h=findNode(c,name);if(h)return h;}return null;}
function walk(node:Node,fn:(n:Node)=>void){fn(node);for(const c of node.children)walk(c,fn);}
function loadPrefab(name:string):Promise<Prefab>{
 return new Promise((ok,fail)=>assetManager.loadBundle('transport_sail',(e,b)=>{
  if(e||!b){fail(e||Error('transport_sail'));return;}
  b.load(name+'/'+name,Prefab,(e2,p)=>{if(e2||!p)fail(e2||Error(name));else ok(p as Prefab);});
 }));
}
function nearestPalette(tex:Texture2D|null){
 if(!tex||!/palette/i.test(tex.name||''))return;
 tex.setFilters(Texture2D.Filter.NEAREST,Texture2D.Filter.NEAREST);
 if(typeof (tex as any).setMipFilter==='function')(tex as any).setMipFilter(Texture2D.Filter.NONE);
}
function copyMat(renderer:MeshRenderer,patch:{cull?:number;alphaTest?:number;blend?:boolean;vertex?:boolean}):Material|null{
 const shared=renderer.getSharedMaterial(0);if(!shared)return null;
 const defines={...(shared.passes[0]?.defines||{})} as Record<string,boolean|number|string>;
 if(patch.alphaTest!=null)defines.USE_ALPHA_TEST=true;
 if(patch.vertex)defines.USE_VERTEX_COLOR=true;
 const states:any={rasterizerState:{cullMode:patch.cull??gfx.CullMode.BACK}};
 if(patch.blend)states.depthStencilState={depthTest:true,depthWrite:false};
 if(patch.blend)states.blendState={targets:[{blend:true,blendSrc:gfx.BlendFactor.SRC_ALPHA,blendDst:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,blendSrcAlpha:gfx.BlendFactor.SRC_ALPHA,blendDstAlpha:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA}]};
 const mat=new Material();
 if(shared.effectAsset)mat.initialize({effectAsset:shared.effectAsset,defines,states});
 else mat.initialize({effectName:'builtin-standard',defines,states});
 for(const key of ['mainTexture','mainColor','roughness','metallic','emissive','emissiveScale']){
  const v=shared.getProperty(key);if(v!=null)mat.setProperty(key,v);
 }
 const tex=mat.getProperty('mainTexture') as Texture2D|null;
 nearestPalette(tex);
 if(patch.alphaTest!=null)mat.setProperty('alphaThreshold',patch.alphaTest);
 renderer.setSharedMaterial(mat,0);
 return mat;
}
function place(node:Node|null,x:number,y:number,z:number){if(node)node.setWorldPosition(x,y,z);}
const CHANNEL_MESH=/^(meadow_terrain|meadow_river|meadow_river_bank|meadow_grass_instances(?:\.\d+)?)$/;
const GRASS_MESH=/^meadow_grass_instances(?:\.\d+)?$|^meadow_flower/;
/** Lower underwater verts only — no triangle rebuild (that made the grey K6 plate). */
function digChannel(renderer:MeshRenderer,samples:readonly Vec[]){
 const mesh=renderer.mesh;if(!mesh)return;
 const src=mesh.readAttribute(0,gfx.AttributeName.ATTR_POSITION);
 if(!(src instanceof Float32Array)||src.length<3)return;
 const wm=renderer.node.worldMatrix,inv=new Mat4();
 if(!Mat4.invert(inv,wm))return;
 const toW=(x:number,y:number,z:number)=>{const w=new Vec3();Vec3.transformMat4(w,new Vec3(x,y,z),wm);return [w.x,w.y,w.z] as [number,number,number];};
 const toL=(p:[number,number,number])=>{const l=new Vec3();Vec3.transformMat4(l,new Vec3(p[0],p[1],p[2]),inv);return l;};
 const pos=new Float32Array(src);let changed=false;
 for(let i=0;i<pos.length;i+=3){
  const w=toW(pos[i],pos[i+1],pos[i+2]);
  const y=sailChannelWorldY(w[0],w[2],w[1],samples);
  if(y===w[1])continue;
  const l=toL([w[0],y,w[2]]);pos[i]=l.x;pos[i+1]=l.y;pos[i+2]=l.z;changed=true;
 }
 if(!changed)return;
 writeMeshPositions(mesh,renderer,pos);
}
function writeMeshPositions(mesh:Mesh,renderer:MeshRenderer,pos:Float32Array){
 const struct=mesh.struct;
 const bundles=struct.vertexBundles.map(b=>({...b,view:{...b.view},attributes:b.attributes.map(a=>({...a}))}));
 const data=mesh.data.slice();
 for(const bundle of bundles){
  let offset=0;
  for(const attr of bundle.attributes){
   const info=gfx.FormatInfos[attr.format];
   if(attr.name===gfx.AttributeName.ATTR_POSITION&&info&&info.count===3&&info.size===12){
    const view=bundle.view,dv=new DataView(data.buffer,data.byteOffset+view.offset,view.length);
    for(let v=0;v<view.count&&v*3+2<pos.length;v++)for(let c=0;c<3;c++)dv.setFloat32(v*view.stride+offset+c*4,pos[v*3+c],true);
   }
   offset+=info?.size||0;
  }
 }
 const copy=new Mesh();copy.reset({struct:{...struct,vertexBundles:bundles},data});renderer.mesh=copy;
}
/**
 * Drop grass/flower blades whose root sits in the landing clear polygons (meadow-local xz).
 * Copies the mesh so env_meadow.glb stays frozen. Returns how many blade components were removed.
 */
export function clearLandingGrass(renderer:MeshRenderer,meadowRoot:Node):number{
 const mesh=renderer.mesh;if(!mesh)return 0;
 const src=mesh.readAttribute(0,gfx.AttributeName.ATTR_POSITION);
 const idx=mesh.readIndices(0);
 if(!(src instanceof Float32Array)||!idx||src.length<3)return 0;
 const wm=renderer.node.worldMatrix,invRoot=new Mat4();
 if(!Mat4.invert(invRoot,meadowRoot.worldMatrix))return 0;
 const toMeadow=(i:number)=>{
  const w=new Vec3();Vec3.transformMat4(w,new Vec3(src[i*3],src[i*3+1],src[i*3+2]),wm);
  const l=new Vec3();Vec3.transformMat4(l,w,invRoot);return l;
 };
 const parent=new Int32Array(src.length/3);for(let i=0;i<parent.length;i++)parent[i]=i;
 const find=(a:number):number=>{while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;};
 const unite=(a:number,b:number)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
 for(let t=0;t+2<idx.length;t+=3){unite(idx[t],idx[t+1]);unite(idx[t],idx[t+2]);}
 const rootAt=new Map<number,{y:number;x:number;z:number}>();
 for(let i=0;i<src.length/3;i++){
  const r=find(i),p=toMeadow(i),cur=rootAt.get(r);
  if(!cur||p.y<cur.y)rootAt.set(r,{y:p.y,x:p.x,z:p.z});
 }
 const kill=new Set<number>();
 for(const [r,info] of rootAt)if(inGrassClearLocal(info.x,info.z))kill.add(r);
 if(!kill.size)return 0;
 const normals=mesh.readAttribute(0,gfx.AttributeName.ATTR_NORMAL) as Float32Array|null;
 const uvs=mesh.readAttribute(0,gfx.AttributeName.ATTR_TEX_COORD) as Float32Array|null;
 const colors=mesh.readAttribute(0,gfx.AttributeName.ATTR_COLOR) as Float32Array|null;
 const colorStride=colors?colors.length/(src.length/3):0;
 const map=new Int32Array(src.length/3).fill(-1);
 const pos2:number[]=[],nrm2:number[]=[],uv2:number[]=[],col2:number[]=[],outIdx:number[]=[];
 let nv=0;
 for(let t=0;t+2<idx.length;t+=3){
  const ids=[idx[t],idx[t+1],idx[t+2]];
  if(ids.some(i=>kill.has(find(i))))continue;
  const remapped=ids.map(old=>{
   if(map[old]>=0)return map[old];
   map[old]=nv++;
   pos2.push(src[old*3],src[old*3+1],src[old*3+2]);
   if(normals)nrm2.push(normals[old*3],normals[old*3+1],normals[old*3+2]);
   if(uvs)uv2.push(uvs[old*2],uvs[old*2+1]);
   if(colors)for(let c=0;c<colorStride;c++)col2.push(colors[old*colorStride+c]);
   return map[old];
  });
  outIdx.push(remapped[0],remapped[1],remapped[2]);
 }
 if(!outIdx.length)return kill.size;
 const geo:any={positions:pos2,indices:outIdx};
 if(nrm2.length)geo.normals=nrm2;
 if(uv2.length)geo.uvs=uv2;
 if(col2.length)geo.colors=col2;
 try{renderer.mesh=utils.createMesh(geo,undefined,{calculateBounds:true});}
 catch{
  const pos=new Float32Array(src);
  for(let i=0;i<src.length/3;i++)if(kill.has(find(i)))pos[i*3+1]-=8;
  writeMeshPositions(mesh,renderer,pos);
 }
 return kill.size;
}
function unlit(renderer:MeshRenderer,color:Color,texture:Texture2D|null){
 const mat=new Material();
 const defines:Record<string,boolean>={};
 if(texture)defines.USE_TEXTURE=true;
 mat.initialize({effectName:'builtin-unlit',technique:0,defines,states:{rasterizerState:{cullMode:gfx.CullMode.NONE}}});
 if(texture)mat.setProperty('mainTexture',texture);
 mat.setProperty('mainColor',color);
 renderer.setSharedMaterial(mat,0);
 return mat;
}
/** 3–6 px sky pinpoints. Transparent + depthTest off so the night dome cannot hide them. */
function mountStarDiamonds(parent:Node):Node{
 const root=new Node('sail_star_diamonds');parent.addChild(root);root.active=false;
 const mat=new Material();
 mat.initialize({effectName:'builtin-unlit',technique:0,defines:{},states:{
  rasterizerState:{cullMode:gfx.CullMode.NONE},
  depthStencilState:{depthTest:false,depthWrite:false},
  blendState:{targets:[{blend:true,blendSrc:gfx.BlendFactor.SRC_ALPHA,blendDst:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,blendSrcAlpha:gfx.BlendFactor.ONE,blendDstAlpha:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA}]},
 }});
 mat.setProperty('mainColor',new Color(236,242,255,255));
 const s=sailStarRadius(52);
 const mesh=utils.createMesh({positions:[-s,0,0, 0,s,0, s,0,0, 0,-s,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],indices:[0,1,2,0,2,3]},undefined,{calculateBounds:true});
 for(let i=0;i<SAIL_STAR_COUNT;i++){
  const n=new Node('star_'+i);root.addChild(n);
  const r=n.addComponent(MeshRenderer);r.mesh=mesh;r.setSharedMaterial(mat,0);
 }
 return root;
}
export type SailArt={boat:Node;seat:Node|null;stand:Node|null;board:Node|null;sail:Node|null;landing:Node|null;grassCleared:number;sync:(v:SailPose,cam:Vec,dt:number,night:boolean,aim?:Vec)=>void;dispose:()=>void};
/** GBT sail bundle: hull, sea sheet, props, far cards, clouds, river mouth, landing jetty. */
/** Opaque cockpit floor inside the hull shell (x ±0.8, z ±2.1). y=0.14 stays above the waterline through ±4° roll. Priority 0 so depth, not draw order, hides the sea. */
function mountCockpitSole(boat:Node):void{
 const y=0.14,x0=-0.76,x1=0.76,z0=-2.02,z1=1.96;
 const positions=[x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z1];
 const normals=[0,1,0,0,1,0,0,1,0,0,1,0];
 const indices=[0,2,1,0,3,2];
 const mesh=utils.createMesh({positions,normals,indices});
 const material=new Material();
 material.initialize({effectName:'builtin-unlit',states:{rasterizerState:{cullMode:gfx.CullMode.NONE},depthStencilState:{depthTest:true,depthWrite:true}}});
 material.setProperty('mainColor',new Color(96,68,44,255));
 const node=new Node('cockpit_sole');boat.addChild(node);node.setPosition(0,0,0);
 const renderer=node.addComponent(MeshRenderer);renderer.mesh=mesh;renderer.setMaterial(material,0);
}
export async function mountSailArt(parent:Node,meadow:Node|null):Promise<SailArt>{
 const names=['sailboat','transit_sea','transit_sea_props','transit_far_cards','transit_clouds','transit_river_mouth','transit_landing'];
 const prefabs=await Promise.all(names.map(n=>loadPrefab(n).catch(()=>null)));
 const [boatP,seaP,propsP,farP,cloudP,mouthP,landingP]=prefabs;
 if(!boatP||!seaP||!propsP||!farP||!cloudP||!mouthP)throw Error('transport_sail missing core prefab');
 const root=new Node('SailArt');parent.addChild(root);
 const boat=instantiate(boatP);boat.name='sailboat';root.addChild(boat);
 const sea=instantiate(seaP);sea.name='transit_sea';root.addChild(sea);
 const props=instantiate(propsP);props.name='transit_sea_props';root.addChild(props);
 const far=instantiate(farP);far.name='transit_far_cards';root.addChild(far);
 const clouds=instantiate(cloudP);clouds.name='transit_clouds';root.addChild(clouds);
 const mouth=instantiate(mouthP);mouth.name='transit_river_mouth';root.addChild(mouth);
 let landing:Node|null=null;
 let grassCleared=0;
 if(landingP&&meadow){
  landing=instantiate(landingP);landing.name='transit_landing';
  // Meadow-local identity — survives SailArt.dispose because it is not under `root`.
  meadow.addChild(landing);
  landing.setPosition(0,0,0);landing.setRotationFromEuler(0,0,0);landing.setScale(1,1,1);
  landing.active=true;
 }
 mountCockpitSole(boat);
 const seat=findNode(boat,'seated_root_anchor'),stand=findNode(boat,'stand_anchor'),board=findNode(boat,'board_step_anchor');
 const sailRoot=findNode(boat,'sail_root'),jib=findNode(boat,'jib_root'),furled=findNode(boat,'sail_furled'),boom=findNode(boat,'boom_pivot');
 const lamp=findNode(boat,'lantern_glow'),stars=findNode(clouds,'night_stars');
 const wake=findNode(props,'wake_strips'),foam=findNode(props,'hull_foam_ring'),wakeAnchor=findNode(boat,'wake_root');
 if(wake&&wakeAnchor){wake.setParent(wakeAnchor);wake.setPosition(0,0.03,0);wake.setRotationFromEuler(0,0,0);}
 if(foam){foam.setParent(boat);foam.setPosition(0,0.02,0);foam.setRotationFromEuler(0,0,0);}
 const tile=findNode(sea,'sea_tile_39m');
 const plane=findNode(sea,'sea_plane');if(plane)plane.setScale(SEA_SCALE,1,SEA_SCALE);
 const route=sailRoute().samples,end=route[route.length-1],start=route[0],berth=sailBerthWorld();
 const seaHome=route[Math.floor(route.length/2)];
 if(plane)plane.setWorldPosition(seaHome[0],SAIL_SEA_Y,seaHome[2]);
 if(meadow){
  for(const r of meadow.getComponentsInChildren(MeshRenderer)){
   if(CHANNEL_MESH.test(r.node.name))digChannel(r,route);
   if(GRASS_MESH.test(r.node.name))grassCleared+=clearLandingGrass(r,meadow);
  }
  // landing_path UVs are authored for transit_palette; sharing meadow_path's albedo
  // samples the wrong atlas and reads as a flat grey/black plate. Keep palette + nearest,
  // force a warm sand tint (meadow_path mainColor is often white + vertex color), and
  // night-grade via take(landing) below.
  const landingPath=findNode(landing,'landing_path');
  if(landingPath)for(const r of landingPath.getComponentsInChildren(MeshRenderer)){
   const m=copyMat(r,{cull:gfx.CullMode.NONE});
   if(m)m.setProperty('mainColor',new Color(222,198,156,255));
  }
  // Thin static water only under the jetty piles (not a foreground plate in meadow cam).
  if(tile){
   const keep=instantiate(tile);keep.name='landing_sea_tile';keep.active=false;
   meadow.addChild(keep);
   keep.setWorldPosition(berth[0]+0.6,SAIL_SEA_Y-0.08,berth[2]+3.8);
   keep.setWorldScale(0.55,1,0.9);
   keep.setRotationFromEuler(0,0,0);
  }
 }
 if(tile)tile.active=false;
 const pier=findNode(props,'transit_pier');
 place(pier,SAIL_I6[0],-0.6,SAIL_I6[2]-0.7);
 // Mouth between boat and jetty (game ≈ x −3.55, origin z ≈ 37.5).
 place(mouth,-3.55,SAIL_SEA_Y-0.06,37.5);
 place(findNode(props,'buoy_red'),end[0]+5.0,SAIL_SEA_Y,end[2]-8);
 place(findNode(props,'buoy_green'),end[0]-4.6,SAIL_SEA_Y,end[2]-7.5);
 const rocks:[[number,number,number],[number,number,number],[number,number,number]]=[
  [start[0]-8.2,SAIL_SEA_Y,start[2]+4.2],[start[0]+7.4,SAIL_SEA_Y,start[2]+9.5],[end[0]+10.5,SAIL_SEA_Y,end[2]-9],
 ];
 place(findNode(props,'sea_rock_a'),...rocks[0]);
 place(findNode(props,'sea_rock_b'),...rocks[1]);
 place(findNode(props,'sea_rock_c'),...rocks[2]);
 const ring=findNode(props,'foam_ring');
 rocks.forEach((p,i)=>{const n=i===0?ring:ring?instantiate(ring):null;if(n&&i)props.addChild(n);place(n,p[0],SAIL_SEA_Y+0.02,p[2]);});
 place(findNode(props,'foam_strip_a'),start[0]-SAIL_BERTH_X,SAIL_SEA_Y+0.02,start[2]-1.2);
 place(findNode(props,'foam_strip_b'),berth[0]-1.2,SAIL_SEA_Y+0.02,berth[2]+4);
 const lighthouseCard=findNode(far,'far_island_lighthouse');
 if(lighthouseCard)lighthouseCard.active=false;
 place(findNode(far,'far_islet_a'),start[0]+70,SAIL_SEA_Y,start[2]-120);
 place(findNode(far,'far_islet_b'),start[0]-90,SAIL_SEA_Y,start[2]+40);
 place(findNode(far,'far_islet_c'),end[0]+80,SAIL_SEA_Y,end[2]+30);
 const coast=findNode(far,'far_meadow_coast');
 if(coast)coast.active=!meadow?.active;
 const mid:Vec=[(start[0]+end[0])*0.5,0,(start[2]+end[2])*0.5];
 ['cloud_a','cloud_b','cloud_c','cloud_d','cloud_e','cloud_f'].forEach((name,i)=>{
  const a=i/6*Math.PI*2;place(findNode(clouds,name),mid[0]+Math.cos(a)*150,38+(i%3)*12,mid[2]+Math.sin(a)*150);
 });
 if(stars){stars.setWorldPosition(mid[0],55,mid[2]);stars.setScale(2.8,2.8,2.8);}
 const starDiamonds=mountStarDiamonds(root);
 let wakeMat:Material|null=null,foamMat:Material|null=null,seaMat:Material|null=null;
 const sailMats:Material[]=[];
 const seaOff=new Vec4(SEA_SCALE,SEA_SCALE,0,0);
 const style=(node:Node|null)=>{
  if(!node)return;
  walk(node,n=>{
   const r=n.getComponent(MeshRenderer);if(!r)return;
   if(n.name==='sail_main'||n.name==='sail_jib'||n.name==='sail_furled'||n.name==='pennant_flag'){
    const tex=r.getSharedMaterial(0)?.getProperty('mainTexture') as Texture2D|null;
    sailMats.push(unlit(r,new Color(SAIL_DAY_SAIL_RGB[0],SAIL_DAY_SAIL_RGB[1],SAIL_DAY_SAIL_RGB[2],255),tex));
   }
   else if(n.name==='rm_reeds')copyMat(r,{cull:gfx.CullMode.NONE});
   else if(n.name==='wake_strips')wakeMat=copyMat(r,{cull:gfx.CullMode.NONE,blend:true});
   else if(n.name==='hull_foam_ring')foamMat=copyMat(r,{cull:gfx.CullMode.NONE,blend:true});
   else if(n.name==='foam_strip_a'||n.name==='foam_strip_b'||n.name==='foam_ring'||n.name.startsWith('foam_ring'))copyMat(r,{cull:gfx.CullMode.NONE,alphaTest:0.4});
   else if(n.name==='sea_plane'||n.name==='landing_sea_tile'||n.name==='sea_tile_39m'){
    const m=copyMat(r,{cull:gfx.CullMode.NONE});
    if(m){try{m.setProperty('roughness',1);m.setProperty('metallic',0);}catch{/* unlit sea has no PBR slots */}}
    if(n.name==='sea_plane')seaMat=m;
    const tex=m?.getProperty('mainTexture') as Texture2D|null;
    if(tex)tex.setWrapMode(Texture2D.WrapMode.REPEAT,Texture2D.WrapMode.REPEAT);
   }else{
    const tex=r.getSharedMaterial(0)?.getProperty('mainTexture') as Texture2D|null;
    nearestPalette(tex);
    if(n.name==='night_stars')unlit(r,new Color(210,220,255,255),null);
    else if(/^cloud_/.test(n.name))copyMat(r,{cull:gfx.CullMode.NONE});
    else if(n.name.startsWith('far_'))copyMat(r,{cull:gfx.CullMode.NONE});
    else if(n.name==='landing_jetty'||n.name==='landing_path')nearestPalette(tex);
   }
  });
 };
 style(root);style(landing);
 // landing_path already tinted above; re-assert palette nearest after style walk.
 if(landing){
  const lp=findNode(landing,'landing_path');
  if(lp)for(const r of lp.getComponentsInChildren(MeshRenderer)){
   const tex=r.getSharedMaterial(0)?.getProperty('mainTexture') as Texture2D|null;nearestPalette(tex);
  }
 }
 const hidden:MeshRenderer[]=[];
 const scene=director.getScene();
 if(scene)walk(scene,n=>{if(ISLAND_SEA.includes(n.name))for(const r of n.getComponents(MeshRenderer))if(r.enabled){r.enabled=false;hidden.push(r);}});
 const dome=scene?findNode(scene,'env_sky_dome'):null;
 const cloudLayer=scene?findNode(scene,'env_cloud_layer'):null;
 const domeHome=dome?[dome.worldPosition.x,dome.worldPosition.y,dome.worldPosition.z]:null;
 const layerHome=cloudLayer?[cloudLayer.worldPosition.x,cloudLayer.worldPosition.y,cloudLayer.worldPosition.z]:null;
 const matOf=(n:Node|null):Material|null=>{try{return n?.getComponent(MeshRenderer)?.getMaterialInstance(0)??null;}catch{return null;}};
 const domeMat=matOf(dome),layerMat=matOf(cloudLayer);
 let lampLight:PointLight|null=null;
 if(lamp){
  lampLight=lamp.getComponent(PointLight)||lamp.addComponent(PointLight);
  // Mesh emissive alone is enough for a small warm pool; a point light still washes the cockpit.
  lampLight.color=new Color(255,160,80,255);
  lampLight.range=0.8;
  lampLight.luminance=0.4;
 }
 const lampMat=lamp?.getComponent(MeshRenderer)?.getMaterialInstance(0)??null;
 if(lampMat){lampMat.setProperty('emissive',new Color(255,150,60,255));try{lampMat.setProperty('emissiveScale',0.12);}catch{/* shared gltf may omit the slot */}}
 type Grade={m:Material;base:number[];wind:boolean;cloud:boolean;prop:boolean};
 const grades:Grade[]=[];
 const linToSrgb=(c:number)=>c<=0.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-0.055;
 const take=(node:Node|null,prop=false,cloud=false)=>{
  if(!node)return;
  for(const r of node.getComponentsInChildren(MeshRenderer)){
   if(r.node.name==='night_stars')continue;
   for(let i=0;i<r.sharedMaterials.length;i++){
    const m=r.getMaterialInstance(i);if(!m)continue;
    const wind=!!m.passes[0]?.getHandle('windParams');
    const h=m.passes[0]?.getHandle('mainColor');
    let base=[1,1,1,1];
    if(h){const v=new Vec4();m.passes[0].getUniform(h,v);base=[linToSrgb(v.x),linToSrgb(v.y),linToSrgb(v.z),Number.isFinite(v.w)?v.w:1];}
    grades.push({m,base,wind,cloud,prop});
   }
  }
 };
 if(meadow)take(meadow);
 take(far,false,true);take(clouds,false,true);take(mouth);if(landing)take(landing,true);
 const grade=(night:boolean)=>{
  const w=night?1:0;
  const ground=meadowGroundFactor(w),propK=meadowGroundFactor(w,MEADOW_PROP_NIGHT),cloudK=meadowCloudColor(w);
  for(const g of grades){
   if(g.wind){const cur=g.m.getProperty('windParams') as Vec4|null;const x=cur?cur.x:0;g.m.setProperty('windParams',new Vec4(x,1,w,w));}
   const k=g.cloud?cloudK:g.prop?propK:ground;
   if(g.m.passes[0]?.getHandle('mainColor'))g.m.setProperty('mainColor',new Vec4(g.base[0]*k[0],g.base[1]*k[1],g.base[2]*k[2],g.base[3]??1));
  }
  // Night sail: gray-blue cream at ~48% of the day tint. Spiral stays in the texture.
  const rgb=night?SAIL_NIGHT_SAIL_RGB:SAIL_DAY_SAIL_RGB;
  const sailC=new Color(rgb[0],rgb[1],rgb[2],255);
  for(const m of sailMats)m.setProperty('mainColor',sailC);
 };
 let time=0,cruise=4.4,savedNear:number|null=null,savedFar:number|null=null,worldCam:Camera|null=null;
 const paint=(mat:Material|null,a:number)=>{if(!mat)return;mat.setProperty('mainColor',new Color(255,255,255,Math.round(255*Math.max(0,Math.min(1,a)))));};
 return {
  boat,seat,stand,board,sail:sailRoot,landing,grassCleared,
  sync(v,cam,dt,night,aim?:Vec){
   (globalThis as any).__QF_SAIL_HOLD_ISLAND_FX=true;
   time+=Math.max(0,dt);
   const sceneNow=director.getScene();
   if(sceneNow)walk(sceneNow,n=>{if(ISLAND_SEA.includes(n.name))for(const r of n.getComponents(MeshRenderer))r.enabled=false;});
   if(!worldCam&&sceneNow)worldCam=sceneNow.getComponentsInChildren(Camera).find(c=>c.node.name==='WorldCamera')||sceneNow.getComponentsInChildren(Camera).find(c=>c.node.name!=='WorldNavigationCamera')||null;
   // Scaled sea sheet reaches ~1180 m from its centre. near 0.3 keeps a 6 cm gap resolvable inside that far plane.
   if(worldCam&&savedNear==null){savedNear=worldCam.near;savedFar=worldCam.far;worldCam.near=0.3;worldCam.far=1400;}
   const open=v.sail;
   if(sailRoot)sailRoot.active=open>0.18;
   if(jib)jib.active=open>0.18;
   if(furled)furled.active=open<=0.18;
   if(boom)boom.setRotationFromEuler(0,25*(1-open),0);
   if(sailRoot&&open>0.18)sailRoot.setScale(1,Math.max(0.15,open),1);
   if(jib&&open>0.18)jib.setScale(1,Math.max(0.15,open),1);
   if(lamp)lamp.active=night;
   if(lampLight)lampLight.enabled=night;
   // Hide the authored night_stars mesh — it reads as huge near-field diamonds.
   if(stars)stars.active=false;
   if(starDiamonds){
    starDiamonds.active=night;
    if(night){
     const eye:Vec=[cam[0],cam[1],cam[2]];
     const look:Vec=aim?[aim[0],aim[1],aim[2]]:[v.pos[0],v.pos[1]+1.05,v.pos[2]];
     const placed=sailStarWorld(eye,look,52,{w:390,h:844});
     starDiamonds.children.forEach((n,i)=>{
      const p=placed[i];if(!p)return;
      n.setWorldPosition(p.pos[0],p.pos[1],p.pos[2]);
      n.lookAt(new Vec3(eye[0],eye[1],eye[2]));
     });
    }
   }
   grade(night);
   // Readable deep-blue night (match art K7), not near-black.
   if(domeMat)domeMat.setProperty('mainColor',night?new Vec4(0.20,0.30,0.52,1):new Vec4(1,1,1,1));
   if(layerMat)layerMat.setProperty('mainColor',night?new Vec4(0.26,0.34,0.55,1):new Vec4(1,1,1,1));
   if(seaMat)seaMat.setProperty('mainColor',night?new Color(150,185,220,255):new Color(255,255,255,255));
   const alpha=cruise>0?Math.min(1,v.speed/cruise)*0.72:0;
   paint(wakeMat,alpha);paint(foamMat,alpha*0.9);
   seaOff.z=time*0.018;seaOff.w=time*0.011;
   if(seaMat)seaMat.setProperty('tilingOffset',seaOff);
   if(dome&&dome.active)dome.setWorldPosition(cam[0],domeHome?domeHome[1]:dome.worldPosition.y,cam[2]);
   if(cloudLayer&&cloudLayer.active)cloudLayer.setWorldPosition(cam[0],layerHome?layerHome[1]:cloudLayer.worldPosition.y,cam[2]);
  },
  dispose(){
   (globalThis as any).__QF_SAIL_HOLD_ISLAND_FX=false;
   for(const r of hidden)if(r.isValid)r.enabled=true;
   if(dome?.isValid&&domeHome)dome.setWorldPosition(domeHome[0],domeHome[1],domeHome[2]);
   if(cloudLayer?.isValid&&layerHome)cloudLayer.setWorldPosition(layerHome[0],layerHome[1],layerHome[2]);
   const stillNight=(()=>{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}})();
   grade(stillNight);
   if(!stillNight){if(domeMat)domeMat.setProperty('mainColor',new Vec4(1,1,1,1));if(layerMat)layerMat.setProperty('mainColor',new Vec4(1,1,1,1));}
   if(worldCam&&savedNear!=null&&savedFar!=null){worldCam.near=savedNear;worldCam.far=savedFar;}
   // Leave landing + landing_sea_tile on the meadow model.
   if(root.isValid)root.destroy();
  },
 };
}
