import {Camera, Color, Director, Mat4, Material, Mesh, MeshRenderer, Node, PointLight, Prefab, Quat, Texture2D, Vec3, Vec4, assetManager, director, gfx, instantiate, utils, view} from 'cc';
import {SEA_LOWLAND,SEA_PREWARM_FRAMES,SEA_STANDIN,SEA_STANDIN_PREFAB,SEA_REEF_PREFAB,boxInFrustum,SEA_ALWAYS_DRAWN,SEA_BOUNDS_NOTE,aboveWaterTiles,seaRevealEnabled,createSeaReveal,lowlandY,seaReefSlots,type Box as SeaBox} from './SeaReveal';
import {onRealModel} from './TransitionProps';
import {continuousTransitions} from './TransitionChain';
import type {Vec} from '../world-r1/WorldFlowCore';
import {traceCloudLayer} from './CloudTrace';
import {meadowCloudColor, meadowGroundFactor, MEADOW_PROP_NIGHT} from './MeadowBoardBackground';
import {sailChannelWorldY} from './SailChannel';
import {inGrassClearLocal} from './SailLanding';
import {apparentWindLocal, easeAngle, pennantYawTarget, sailSide} from '../render/GlobalWind';
import {SAIL_BERTH_X, SAIL_I6, SAIL_SEA_Y, sailBerthWorld, sailRoute, type SailPose} from './TransportLeg';
import {SAIL_DAY_SAIL_RGB, SAIL_NIGHT_SAIL_RGB, SAIL_STAR_COUNT, sailStarRadius, sailStarWorld} from './SailStars';
import {soleIndices, soleNormals, solePositions} from './SailSole';
import {buildWakeGeometry, createWakeBuffers, hullFoamTint, createWakeTrail, stepWakeTrail, wakeIndexCount, wakeVertexCount, wakeVisibleM, SAIL_WAKE, type WakeBuffers, type WakeTrail} from './SailWakeCore';
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
/** readAttribute/struct/data read the RAW stored bytes. Meshes in an inactive rig were never initialize()d, so a meshopt-encoded
 * (transport_sail) or zlib-compressed (env_meadow) mesh still holds packed bytes: patching positions into them and reset() on a copy
 * threw "Malformed buffer data: -1" inside mountSailArt (no seat -> sail-rider-missing) and left a copy with no sub-meshes
 * (MeshRenderer onLoad: null.length). Decode first; on failure skip the edit and keep the authored mesh. */
export function sailMeshReady(mesh:Mesh|null|undefined):Mesh|null{
 if(!mesh)return null;
 try{mesh.initialize();}catch(error){try{console.warn('[QF_SAIL] mesh decode failed, edit skipped: '+(mesh.name||'?')+' '+String((error as Error)?.message||error));}catch{}return null;}
 const st=mesh.struct as any;
 if(!st||st.compressed||st.encoded)return null;
 return mesh;
}
function safeEdit(what:string,fn:()=>void){try{fn();}catch(error){try{console.warn('[QF_SAIL] '+what+' skipped: '+String((error as Error)?.message||error));}catch{}}}
const CHANNEL_MESH=/^(meadow_terrain|meadow_river|meadow_river_bank|meadow_grass_instances(?:\.\d+)?)$/;
const GRASS_MESH=/^meadow_grass_instances(?:\.\d+)?$|^meadow_flower/;
/** Lower underwater verts only — no triangle rebuild (that made the grey K6 plate). */
function digChannel(renderer:MeshRenderer,samples:readonly Vec[]){
 const mesh=sailMeshReady(renderer.mesh);if(!mesh)return;
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
/** full8 E: world z < SEA_LOWLAND.zMax verts down to SEA_LOWLAND.y on a COPY of the mesh (the original is kept by the caller). */
function sinkLowland(renderer:MeshRenderer):boolean{
 const mesh=sailMeshReady(renderer.mesh);if(!mesh)return false;const src=mesh.readAttribute(0,gfx.AttributeName.ATTR_POSITION);if(!(src instanceof Float32Array))return false;
 const wm=renderer.node.worldMatrix,inv=new Mat4();if(!Mat4.invert(inv,wm))return false;const pos=new Float32Array(src);let changed=false;const w=new Vec3(),l=new Vec3();
 for(let i=0;i<pos.length;i+=3){Vec3.transformMat4(w,new Vec3(pos[i],pos[i+1],pos[i+2]),wm);const y=lowlandY(w.x,w.y,w.z);if(y===w.y)continue;Vec3.transformMat4(l,new Vec3(w.x,y,w.z),inv);pos[i]=l.x;pos[i+1]=l.y;pos[i+2]=l.z;changed=true;}
 if(changed)writeMeshPositions(mesh,renderer,pos);return changed;}
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
 const mesh=sailMeshReady(renderer.mesh);if(!mesh)return 0;
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
 // forEach, not for-of: the loose-ES5 mini-game build does not iterate a Map with for-of (kill would stay empty).
 rootAt.forEach((info,r)=>{if(inGrassClearLocal(info.x,info.z))kill.add(r);});
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
/** The river-mouth banks are rectangular pads in the channel. Put every above-water vertex under the sea; the meadow shore stays. */
function taperMouthShore(renderer:MeshRenderer,_side:'left'|'right'|'reeds'){
 const mesh=sailMeshReady(renderer.mesh);if(!mesh)return;
 const src=mesh.readAttribute(0,gfx.AttributeName.ATTR_POSITION);
 if(!(src instanceof Float32Array)||src.length<3)return;
 const pos=new Float32Array(src);let changed=false;
 for(let i=0;i<pos.length;i+=3){
  // The waterline cap sits at local y ≈ 0.02. Leaving it made the rectangular pad.
  if(pos[i+1]<=-0.08)continue;
  pos[i+1]=-0.62;changed=true;
 }
 if(changed)writeMeshPositions(mesh,renderer,pos);
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
type WakeFx={node:Node;mesh:Mesh;mat:Material;trail:WakeTrail;buf:WakeBuffers;dynamic:boolean;peak:number};
/**
 * r5 S1 stern wake: one world-space ribbon mesh (centre wash + two Kelvin arms, SailWakeCore) replacing the
 * 9 m boat-locked wake_strips card. Same foam_strip texture, unlit alpha blend, vertex alpha = speed × fade.
 * One renderer in, one out: the draw-call count is unchanged. Hidden whenever nothing is left to draw.
 */
function mountWakeTrail(parent:Node,foamTex:Texture2D|null):WakeFx|null{
 try{
  const buf=createWakeBuffers();
  const geo={positions:buf.positions,uvs:buf.uvs,colors:buf.colors,indices16:buf.indices,minPos:new Vec3(-1,SAIL_SEA_Y,-1),maxPos:new Vec3(1,SAIL_SEA_Y+0.1,1)};
  const mu=(utils as any).MeshUtils,create=mu&&mu.createDynamicMesh;
  let mesh:Mesh;let dynamic=false;
  if(typeof create==='function'){
   mesh=create(0,geo,undefined,{maxSubMeshes:1,maxSubMeshVertices:wakeVertexCount(),maxSubMeshIndices:wakeIndexCount()}) as Mesh;dynamic=true;
  }else mesh=utils.createMesh({positions:Array.prototype.slice.call(buf.positions),uvs:Array.prototype.slice.call(buf.uvs),colors:Array.prototype.slice.call(buf.colors),indices:Array.prototype.slice.call(buf.indices),minPos:geo.minPos,maxPos:geo.maxPos});
  const mat=new Material();
  const defines:Record<string,boolean>={USE_VERTEX_COLOR:true};
  if(foamTex)defines.USE_TEXTURE=true;
  // builtin-unlit technique 3 = alpha-blend (same as ShoreBreak's lip, proven on device with vertex colour).
  mat.initialize({effectName:'builtin-unlit',technique:3,defines,states:{rasterizerState:{cullMode:gfx.CullMode.NONE}}});
  if(foamTex){foamTex.setWrapMode(Texture2D.WrapMode.REPEAT,Texture2D.WrapMode.CLAMP_TO_EDGE);mat.setProperty('mainTexture',foamTex);}
  mat.setProperty('mainColor',new Color(255,255,255,255));
  const node=new Node('wake_trail');parent.addChild(node);node.active=false;
  const r=node.addComponent(MeshRenderer);r.mesh=mesh;r.setMaterial(mat,0);
  r.shadowCastingMode=MeshRenderer.ShadowCastingMode.OFF;r.receiveShadow=MeshRenderer.ShadowReceivingMode.OFF;
  return {node,mesh,mat,trail:createWakeTrail(),buf,dynamic,peak:0};
 }catch(e){console.warn('[SAIL] wake trail unavailable',String(e));return null;}
}
const WAKE_FWD=new Vec3(),WAKE_Z=new Vec3(0,0,1),WAKE_ID=new Quat();
function syncWakeTrail(fx:WakeFx|null,anchor:Node|null,boat:Node,speed:number,dt:number,night:boolean){
 if(!fx||!fx.node.isValid)return;
 const src=anchor&&anchor.isValid?anchor:boat;
 const p=src.worldPosition;
 Vec3.transformQuat(WAKE_FWD,WAKE_Z,boat.worldRotation);
 stepWakeTrail(fx.trail,p.x,p.z,WAKE_FWD.x,WAKE_FWD.z,speed,dt,night);
 const y=SAIL_SEA_Y+SAIL_WAKE.lift;
 fx.peak=buildWakeGeometry(fx.trail,y,fx.buf);
 const show=fx.peak>1/255;
 if(fx.node.active!==show)fx.node.active=show;
 (globalThis as any).__QF_SAIL_WAKE={points:fx.trail.pts.length,visibleM:wakeVisibleM(fx.trail),peak:fx.peak,night:fx.trail.night,shown:show,dynamic:fx.dynamic};
 if(!show)return;
 fx.node.setWorldPosition(0,0,0);fx.node.setWorldRotation(WAKE_ID);fx.node.setWorldScale(1,1,1);
 const b=fx.buf,mn=new Vec3(b.min[0],b.min[1],b.min[2]),mx=new Vec3(b.max[0],b.max[1],b.max[2]);
 const m=fx.mesh as any;
 if(fx.dynamic&&m&&m.struct&&m.struct.dynamic&&typeof m.updateSubMesh==='function')m.updateSubMesh(0,{positions:b.positions,uvs:b.uvs,colors:b.colors,indices16:b.indices,minPos:mn,maxPos:mx});
 else utils.createMesh({positions:Array.prototype.slice.call(b.positions),uvs:Array.prototype.slice.call(b.uvs),colors:Array.prototype.slice.call(b.colors),indices:Array.prototype.slice.call(b.indices),minPos:mn,maxPos:mx},fx.mesh);
}
export type SailArt={boat:Node;seat:Node|null;stand:Node|null;board:Node|null;sail:Node|null;landing:Node|null;grassCleared:number;sync:(v:SailPose,cam:Vec,dt:number,night:boolean,aim?:Vec,t?:number)=>void;dispose:()=>void};
/** GBT sail bundle: hull, sea sheet, props, far cards, clouds, river mouth, landing jetty. */
/** Sole under the authored floor, following the inner hull. No walls, nothing past the foredeck bulkhead. */
function mountCockpitSole(boat:Node):Node{
 const mesh=utils.createMesh({positions:solePositions(),normals:soleNormals(),indices:soleIndices()},undefined,{calculateBounds:true});
 const material=new Material();
 material.initialize({effectName:'builtin-unlit',states:{rasterizerState:{cullMode:gfx.CullMode.NONE},depthStencilState:{depthTest:true,depthWrite:true}}});
 material.setProperty('mainColor',new Color(96,68,44,255));
 const node=new Node('cockpit_sole');boat.addChild(node);node.setPosition(0,0,0);
 const renderer=node.addComponent(MeshRenderer);renderer.mesh=mesh;renderer.setMaterial(material,0);
 return node;
}
export async function mountSailArt(parent:Node,meadow:Node|null):Promise<SailArt>{
 const names=['sailboat','transit_sea','transit_sea_props','transit_far_cards','transit_clouds','transit_river_mouth','transit_landing',SEA_STANDIN_PREFAB,SEA_REEF_PREFAB];
 const prefabs=await Promise.all(names.map(n=>loadPrefab(n).catch(()=>null)));
 const [boatP,seaP,propsP,farP,cloudP,mouthP,landingP,standinP,reefP]=prefabs;
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
 const sole=mountCockpitSole(boat);
 const seat=findNode(boat,'seated_root_anchor'),stand=findNode(boat,'stand_anchor'),board=findNode(boat,'board_step_anchor');
 const sailRoot=findNode(boat,'sail_root'),jib=findNode(boat,'jib_root'),furled=findNode(boat,'sail_furled'),boom=findNode(boat,'boom_pivot');
 // R5 S3 global wind: pennant swings about its staff to the apparent wind; sails set on the leeward side (+1 = authored).
 const pennant=findNode(boat,'pennant');let pennantYaw:number|null=null,side=1;
 const lamp=findNode(boat,'lantern_glow'),stars=findNode(clouds,'night_stars');
 const wake=findNode(props,'wake_strips'),foam=findNode(props,'hull_foam_ring'),wakeAnchor=findNode(boat,'wake_root');
 if(wake&&wakeAnchor){wake.setParent(wakeAnchor);wake.setPosition(0,0.03,0);wake.setRotationFromEuler(0,0,0);}
 if(foam){foam.setParent(boat);foam.setPosition(0,0.02,0);foam.setRotationFromEuler(0,0,0);}
 const tile=findNode(sea,'sea_tile_39m');
 const plane=findNode(sea,'sea_plane');if(plane)plane.setScale(SEA_SCALE,1,SEA_SCALE);
 const route=sailRoute().samples,end=route[route.length-1],start=route[0],berth=sailBerthWorld();
 const seaHome=route[Math.floor(route.length/2)];
 if(plane)plane.setWorldPosition(seaHome[0],SAIL_SEA_Y,seaHome[2]);
 const planE=seaRevealEnabled();try{console.info('[QF_SEA_REVEAL] '+(planE?'plan E on':'off (needs ?seaReveal=1 until the open-sea camera lands)'));}catch{}
 const lowlandHome:{r:MeshRenderer;mesh:Mesh}[]=[];
 if(meadow){
  for(const r of meadow.getComponentsInChildren(MeshRenderer)){
   if(CHANNEL_MESH.test(r.node.name))safeEdit('dig '+r.node.name,()=>digChannel(r,route));
   if(planE&&SEA_LOWLAND.meshes.test(r.node.name))safeEdit('lowland '+r.node.name,()=>{const before=r.mesh;if(sinkLowland(r)&&before)lowlandHome.push({r,mesh:before});})/* full8 E: south lowland under the sea while sailing */;
   if(GRASS_MESH.test(r.node.name))safeEdit('grass '+r.node.name,()=>{grassCleared+=clearLandingGrass(r,meadow);});
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
 if(pier&&continuousTransitions())pier.active=false/* b19: island_dock (permanent island pier) owns this spot; transit_pier off during the sail journey */;
 if(pier)onRealModel('island_dock',()=>{try{if(pier.isValid)pier.active=false;}catch{}})/* cand7: the real dock is there (now or later) → transit_pier off */;
 // Mouth between boat and jetty (game ≈ x −3.55, origin z ≈ 37.5).
 // The mouth banks are a rectangular cap in the channel. Mesh rewrites left that cap on screen, so drop the whole prefab under the sea. The meadow shore is the bank that should read.
 place(mouth,-3.55,SAIL_SEA_Y-1.7,37.5);
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
 // full8 plan E: ONE far stand-in on the horizon in the meadow's bearing (−11.6,−0.91,492.0), scale 0.7, yaw 180. It replaces
 // far_meadow_coast and the (already off) far_island_lighthouse. Until 场景设计部's far_meadow_impostor mesh lands, the coast card
 // is the placeholder at the same transform.
 let standin:Node|null=null;
 if(!planE){if(coast)coast.active=!meadow?.active;}
 else if(standinP){standin=instantiate(standinP);standin.name=SEA_STANDIN_PREFAB;root.addChild(standin);if(coast)coast.active=false;}
 else if(coast){standin=coast;standin.active=true;}
 if(planE&&standin){standin.setWorldPosition(SEA_STANDIN.pos[0],SEA_STANDIN.pos[1],SEA_STANDIN.pos[2]);standin.setWorldScale(SEA_STANDIN.scale,SEA_STANDIN.scale,SEA_STANDIN.scale);standin.setWorldRotationFromEuler(0,SEA_STANDIN.yawDeg,0);}
 // reef clusters: 场景设计部's structured cluster when delivered, else the existing sea rocks re-used (0 B) at the same slots
 const reefs:Node[]=[];for(const at of planE?seaReefSlots(start,end):[]){const src=reefP||findNode(props,'sea_rock_b');if(!src)break;const n=instantiate(src as any) as Node;n.name='sea_reef_cluster';root.addChild(n);n.setWorldPosition(at[0],SAIL_SEA_Y,at[2]);n.setRotationFromEuler(0,at[1]*57.3,0);reefs.push(n);}
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
   else if(n.name==='rm_reeds'){copyMat(r,{cull:gfx.CullMode.NONE});safeEdit('taper reeds',()=>taperMouthShore(r,'reeds'));}
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
    else if(n.name==='rm_bank_left')safeEdit('taper left',()=>taperMouthShore(r,'left'));
    else if(n.name==='rm_bank_right')safeEdit('taper right',()=>taperMouthShore(r,'right'));
    else if(n.name==='landing_jetty'||n.name==='landing_path')nearestPalette(tex);
   }
  });
 };
 style(root);style(landing);
// r5 S1: the 9 m boat-locked strips read as too short. Swap them for the world-space trail (same draw-call count).
const foamTex=(wake?.getComponent(MeshRenderer)?.getSharedMaterial(0)?.getProperty('mainTexture') as Texture2D|null)??null;
const wakeFx=mountWakeTrail(root,foamTex);
if(wakeFx&&wake){wake.active=false;wakeMat=null;}
 // landing_path already tinted above; re-assert palette nearest after style walk.
 if(landing){
  const lp=findNode(landing,'landing_path');
  if(lp)for(const r of lp.getComponentsInChildren(MeshRenderer)){
   const tex=r.getSharedMaterial(0)?.getProperty('mainTexture') as Texture2D|null;nearestPalette(tex);
  }
 }
 const hidden:MeshRenderer[]=[];
 const scene=director.getScene();
 // b17r7 (运镜bot): the island sea is NOT hidden at mount any more (mount runs while the island lens is still visible, before
 // the set-off cover is black: grey clear colour under the half-faded cover). The first sync() hides it, and the journey
 // controller only drives sync (lease.onFrame / ride) once the cover is at alpha 1.
 let seaTaken=false;
 // fix-cloud-sit: the island sea renderers are found ONCE (first sync) and only re-disabled if someone turned them back on;
 // the old per-frame full-scene walk is gone.
 const seaRenderers:MeshRenderer[]=[];
 const takeIslandSea=()=>{if(seaTaken)return;seaTaken=true;const sc=director.getScene();if(sc)walk(sc,n=>{if(ISLAND_SEA.includes(n.name))for(const r of n.getComponents(MeshRenderer)){seaRenderers.push(r);if(r.enabled){r.enabled=false;hidden.push(r);}}});};
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
 // fix-cloud-sit: meadow_clouds_near has ONE colour owner, MeadowSceneMotion (RegionJourneyAdapter mounts it with
 // journeyNight + meadowCloudMaterials). SailArt used to grade the same material instance with the GROUND factor every frame
 // (a different night colour from meadowCloudColor) → two writers, mismatched night tint. Skip that subtree here.
 const underMeadowClouds=(n:Node|null)=>{for(let p=n;p;p=p.parent)if(p.name==='meadow_clouds_near')return true;return false;};
 const take=(node:Node|null,prop=false,cloud=false)=>{
  if(!node)return;
  for(const r of node.getComponentsInChildren(MeshRenderer)){
   if(r.node.name==='night_stars')continue;
   if(underMeadowClouds(r.node))continue;
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
 // fix-cloud-sit P2: ONE place for the sail's day/night colours. Called at the END of mount as well (current world mode):
 // mount runs during region-loading while the island lens is still on screen, and the sail sea_plane (day white) was visible
 // over the dark island sea until the first sync() → one bright DAYTIME frame at night right before the set-off cover.
 const nightLook=(night:boolean)=>{
  grade(night);
  // Readable deep-blue night (match art K7), not near-black.
  if(domeMat)domeMat.setProperty('mainColor',night?new Vec4(0.20,0.30,0.52,1):new Vec4(1,1,1,1));
  if(layerMat)layerMat.setProperty('mainColor',night?new Vec4(0.26,0.34,0.55,1):new Vec4(1,1,1,1));
  if(seaMat)seaMat.setProperty('mainColor',night?new Color(150,185,220,255):new Color(255,255,255,255));
 };
 const worldNight=()=>{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}};
 if(worldNight())nightLook(true);
 const reveal=createSeaReveal();let prewarmLeft=SEA_PREWARM_FRAMES,lastT=0,moved=false,lowlandRestored=false;
 const meadowRenderers=meadow?meadow.getComponentsInChildren(MeshRenderer).filter(r=>!SEA_ALWAYS_DRAWN.test(r.node.name)):[];
 const showMeadow=(on:boolean)=>{for(const r of meadowRenderers){const m:any=(r as any).model;if(r.isValid&&m&&m.enabled!==on&&r.enabled)m.enabled=on;}};
 // handoff test on ABOVE-WATER geometry only (world verts with y > SAIL_SEA_Y, after the lowland sink); notes bounds win
 const boundsOf=(rs:MeshRenderer[]):SeaBox[]=>{const out:SeaBox[]=[];for(const r of rs){if(!r.isValid||!r.enabled)continue;const m=sailMeshReady(r.mesh);if(!m)continue;
  const src=m.readAttribute(0,gfx.AttributeName.ATTR_POSITION);if(!(src instanceof Float32Array))continue;const wm=r.node.worldMatrix,w=new Vec3(),pts=new Float32Array(src.length);
  for(let i=0;i<src.length;i+=3){Vec3.transformMat4(w,new Vec3(src[i],src[i+1],src[i+2]),wm);pts[i]=w.x;pts[i+1]=w.y;pts[i+2]=w.z;}
  out.push(...aboveWaterTiles(pts,SAIL_SEA_Y));}return out;};
 let realBox:SeaBox[]|null=null,standinBox:SeaBox[]|null=null;
 const restoreLowland=()=>{if(lowlandRestored)return;lowlandRestored=true;for(const h of lowlandHome)if(h.r.isValid)h.r.mesh=h.mesh;};
 const revealStep=(t:number,cam:Vec,aim:Vec|undefined,stillFrame:boolean)=>{
  if(!meadow||!planE)return;
  if(prewarmLeft>0&&!stillFrame){prewarmLeft--;showMeadow(true);if(!prewarmLeft){realBox=SEA_BOUNDS_NOTE.real||boundsOf(meadowRenderers);if(standin)standinBox=SEA_BOUNDS_NOTE.standin||boundsOf(standin.getComponentsInChildren(MeshRenderer));}/* one-off vertex pass under the black cover */if(standin)standin.active=true;return;}/* set-off cover is black: draw the real meadow once */
  if(reveal.phase!=='real'){
   if(!realBox)realBox=SEA_BOUNDS_NOTE.real||boundsOf(meadowRenderers);if(!standinBox&&standin)standinBox=SEA_BOUNDS_NOTE.standin||boundsOf(standin.getComponentsInChildren(MeshRenderer));
   const vs=view.getVisibleSize(),asp=vs.width/Math.max(1,vs.height),pose={position:cam,target:aim||[cam[0],cam[1],cam[2]+1] as Vec,fovVerticalDeg:worldCam?.fov??45};
   const ph=reveal.step(t,!!standinBox&&standinBox.some(b=>boxInFrustum(pose,asp,b)),!!realBox&&realBox.some(b=>boxInFrustum(pose,asp,b)));
   if(ph==='real'){if(standin)standin.active=false;showMeadow(true);try{console.info('[QF_SEA_REVEAL] '+JSON.stringify({t:+t.toFixed(2),deferredS:+reveal.deferredS.toFixed(2)}));}catch{}}
   else{showMeadow(false);if(standin)standin.active=true;}
  }
 };
 let time=0,cruise=4.4,savedNear:number|null=null,savedFar:number|null=null,worldCam:Camera|null=null;
 const paint=(mat:Material|null,a:number)=>{if(!mat)return;mat.setProperty('mainColor',new Color(255,255,255,Math.round(255*Math.max(0,Math.min(1,a)))));};
 const shoreHidden:MeshRenderer[]=[];
 const SHORE=/reed|flower|bush|shrub|cattail|rm_reeds/i;
 // fix-cloud-sit: shore props are static. Their renderers + bounds are collected ONCE; each frame only renderers whose
 // near/far state CHANGED are toggled (the old code re-enabled every hidden reed and disabled it again every frame, and
 // walked meadow+landing each frame).
 type ShoreProp={r:MeshRenderer;c:number[];h:number[]};
 let shoreProps:ShoreProp[]|null=null;
 const collectShore=()=>{
  const out:ShoreProp[]=[];
  for(const root of [meadow,landing]){
   if(!root)continue;
   walk(root,n=>{
    if(!SHORE.test(n.name)||CHANNEL_MESH.test(n.name))return;
    const r=n.getComponent(MeshRenderer);if(!r)return;
    const b=r.model?.worldBounds;if(!b)return;
    const c=b.center,he=b.halfExtents;
    if(!c||!he||he.x>5||he.y>5||he.z>5)return;
    out.push({r,c:[c.x,c.y,c.z],h:[he.x,he.y,he.z]});
   });
  }
  return out;
 };
 const hideCloseShore=(cam:Vec)=>{
  if(!shoreProps)shoreProps=collectShore();
  let left=0;
  for(const p of shoreProps){
   const r=p.r;if(!r.isValid)continue;
   const mine=shoreHidden.indexOf(r);
   if(!r.node.activeInHierarchy){if(mine>=0){r.enabled=true;shoreHidden.splice(mine,1);}continue;}
   const dx=Math.max(0,Math.abs(cam[0]-p.c[0])-p.h[0]),dy=Math.max(0,Math.abs(cam[1]-p.c[1])-p.h[1]),dz=Math.max(0,Math.abs(cam[2]-p.c[2])-p.h[2]);
   const near=Math.hypot(dx,dy,dz)<1.3;
   if(near){if(mine<0){if(r.enabled){r.enabled=false;shoreHidden.push(r);}else left++;}}
   else if(mine>=0){r.enabled=true;shoreHidden.splice(mine,1);}
  }
  (globalThis as any).__QF_SAIL_SHORE_NEAR=left;
 };
 const applyOverride=()=>{
  const ov=(globalThis as any).__QF_SAIL_CAM_OVERRIDE as {pos:number[];aim:number[]}|null|undefined;
  if(!ov||!worldCam?.node?.isValid)return;
  worldCam.node.setWorldPosition(ov.pos[0],ov.pos[1],ov.pos[2]);
  worldCam.node.lookAt(new Vec3(ov.aim[0],ov.aim[1],ov.aim[2]));
 };
 // fix-cloud-sit: test-only cloud trace (?cloudTrace=1): position after ALL writers, right before draw.
 const traceCloud=()=>{if(cloudLayer&&cloudLayer.isValid){const p=cloudLayer.worldPosition;traceCloudLayer(p.x,p.y,p.z,(globalThis as any).__QF_SAIL_HOLD_ISLAND_FX?'sail':'idle');}};
 try{director.on(Director.EVENT_BEFORE_DRAW,applyOverride);director.on(Director.EVENT_BEFORE_DRAW,traceCloud);}catch{/* QA stills only */}
 return {
  boat,seat,stand,board,sail:sailRoot,landing,grassCleared,
  sync(v,cam,dt,night,aim?:Vec,t?:number){
   (globalThis as any).__QF_SAIL_HOLD_ISLAND_FX=true;
   takeIslandSea();
   time+=Math.max(0,dt);
   const sceneNow=director.getScene();
   for(const r of seaRenderers)if(r.isValid&&r.enabled)r.enabled=false;
   if(!worldCam&&sceneNow)worldCam=sceneNow.getComponentsInChildren(Camera).find(c=>c.node.name==='WorldCamera')||sceneNow.getComponentsInChildren(Camera).find(c=>c.node.name!=='WorldNavigationCamera')||null;
   // Scaled sea sheet reaches ~1180 m from its centre. near 0.3 keeps a 6 cm gap resolvable inside that far plane.
   if(worldCam&&savedNear==null){savedNear=worldCam.near;savedFar=worldCam.far;worldCam.near=0.3;worldCam.far=1400;}
   const open=v.sail;
   if(sailRoot)sailRoot.active=open>0.18;
   if(jib)jib.active=open>0.18;
   if(furled)furled.active=open<=0.18;
   const app=apparentWindLocal(v.yaw,v.speed);side=sailSide(app,side);
   if(boom){boom.setRotationFromEuler(0,25*(1-open)*side,0);boom.setScale(side,1,1);}
   if(sailRoot&&open>0.18)sailRoot.setScale(side,Math.max(0.15,open),1);
   if(jib&&open>0.18)jib.setScale(side,Math.max(0.15,open),1);
   const py=pennantYawTarget(app);
   if(pennant&&py!==null){pennantYaw=pennantYaw===null?py:easeAngle(pennantYaw,py,dt,3);pennant.setRotationFromEuler(0,pennantYaw*180/Math.PI,0);}
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
   nightLook(night);
   const alpha=cruise>0?Math.min(1,v.speed/cruise)*0.72:0;
   paint(wakeMat,alpha);
   syncWakeTrail(wakeFx,wakeAnchor,boat,v.speed,dt,night);
   // Hull ring: same alpha as before; at night it follows the trail's blue-grey instead of staying paper white.
   if(foamMat){const c=hullFoamTint(wakeFx?wakeFx.trail.night:(night?1:0));foamMat.setProperty('mainColor',new Color(c[0],c[1],c[2],Math.round(255*Math.max(0,Math.min(1,alpha*0.9)))));}
   seaOff.z=time*0.018;seaOff.w=time*0.011;
   if(seaMat)seaMat.setProperty('tilingOffset',seaOff);
   if(dome&&dome.active)dome.setWorldPosition(cam[0],domeHome?domeHome[1]:dome.worldPosition.y,cam[2]);
   if(cloudLayer&&cloudLayer.active)cloudLayer.setWorldPosition(cam[0],layerHome?layerHome[1]:cloudLayer.worldPosition.y,cam[2]);
   if(sole.isValid)sole.active=(globalThis as any).__QF_SAIL_SOLE!==0;
   hideCloseShore(cam);
   if(Number.isFinite(t))lastT=t!;revealStep(lastT,cam,aim,dt===0)/* SailShot still: no prewarm frame */;
   if(v.speed>0.05)moved=true;else if(moved&&reveal.phase==='real')restoreLowland()/* docked: original vertices back exactly */;
  },
  dispose(){
   (globalThis as any).__QF_SAIL_HOLD_ISLAND_FX=false;
   restoreLowland();showMeadow(true);
   try{director.off(Director.EVENT_BEFORE_DRAW,applyOverride);director.off(Director.EVENT_BEFORE_DRAW,traceCloud);}catch{/* already torn down */}
   for(const r of shoreHidden)if(r.isValid)r.enabled=true;
   for(const r of hidden)if(r.isValid)r.enabled=true;
   if(dome?.isValid&&domeHome)dome.setWorldPosition(domeHome[0],domeHome[1],domeHome[2]);
   if(cloudLayer?.isValid&&layerHome)cloudLayer.setWorldPosition(layerHome[0],layerHome[1],layerHome[2]);
   const stillNight=(()=>{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}})();
   grade(stillNight);
   if(!stillNight){if(domeMat)domeMat.setProperty('mainColor',new Vec4(1,1,1,1));if(layerMat)layerMat.setProperty('mainColor',new Vec4(1,1,1,1));}
   if(worldCam&&savedNear!=null&&savedFar!=null){worldCam.near=savedNear;worldCam.far=savedFar;}
   // Leave landing + landing_sea_tile on the meadow model.
   (globalThis as any).__QF_SAIL_WAKE=null;
   if(root.isValid)root.destroy();
   if(wakeFx){try{wakeFx.mat.destroy();wakeFx.mesh.destroy();}catch{/* already released with root */}}
  },
 };
}
