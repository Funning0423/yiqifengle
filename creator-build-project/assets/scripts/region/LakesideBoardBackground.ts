import {bgCamWant} from './BgCamGate';
import {createSceneFade} from './BoardBackgroundFade';
import {Animation,AssetManager,ImageAsset,Camera,Color,DirectionalLight,JsonAsset,Mat4,Material,Mesh,MeshRenderer,Node,Prefab,Quat,Texture2D,Vec3,Vec4,SphereLight,assetManager,director,gfx,instantiate,isValid,utils} from 'cc';
import {lakesideMaterialKey,lakesideMergePlan,lakesideAttrToFloat,lakesideAppendPiece,lakesideStaticMergeFromEnv,type LakesideAttr} from './LakesideStaticMerge';
import {waitRegionAsset} from './RegionAssetDeadline';
import {DEBUG} from 'cc/env';
import {applyCameraPose} from '../world-r1/CameraPose';
import {lakesideAlignedBoardPose} from './LakesideCameraLayout';
import type {LevelBackgroundFactory,LevelBackgroundLease} from '../world-r2/LevelBackground';
import {Cancellation} from '../world-r1/WorldFlowCore';
import {lakesideJourneyBaseIllum,lakesideDayNightMode,lakesideIslandLightScale,setLakesideBoardHolding,reapplyLakesideJourney} from './LakesideJourneyAtmosphere';
import {onDayNightChange} from '../world-r1/DayNightContract';
import {mountLakesideGuest,type LakesideGuest} from './LakesideBoardGuest';
import {LAKESIDE_BUNDLE,LAKESIDE_TRANSFORMS,LAKESIDE_MODELS_DIR,LAKESIDE_LIGHTS,lakesideDayClearColor,LAKESIDE_BOARD_CAMERA,lakesideLightPosition,lakesideLightSrgb,lakesideSceneInstances,lakesidePrefabName,LAKESIDE_LIGHT_MODE,lakesideModeLighting,type LakesideDayNight,lakesideLandFillClass,lakesideFillLinear,lakesideFillMaskBytes,lakesideFillWeight,type LakesideLandFillClass,LAKESIDE_DIR_LIGHT_PARAMS,lakesideCocosLightColor,lakesideFogEnd,lakesideFogModeFromEnv,LAKESIDE_LAYERED_FOG,type LakesideInstance} from './LakesideSceneData';
import {LAKESIDE_BOARD_YAW_DEG,lakesideSunForward} from './LakesideSunDirection';
import {getGlobalWind} from '../render/GlobalWind';
import {LAKESIDE_LIFE} from '../render/LakesideLifeCore';
import {mountLakesideLife,isLakesideLifeNode} from './LakesideLife';
import {LAKESIDE_SHORE_GLB,mountLakesideShore,isLakesideShoreMaterial,applyLakesideShoreMode} from './LakesideShoreFoam';
/** Dedicated level-background layer, shared with the mutually exclusive meadow / sky-city leases (never two at once). */
export const LAKESIDE_LAYER=1<<20;
/** water-ref candidate (VB) diagnostic, scene design asked: is tone mapping on? ONE console.log at the first board light apply,
 *  only when BOTH cc/env DEBUG (false in release builds: never runs or prints there) AND ?lakediag=1. Failures log, no fallback. */
export function lakesideDiagEnabled(debug:boolean,search:string|null|undefined):boolean{return !!debug&&/[?&]lakediag=1(&|$)/.test(String(search||''));}
let lakeDiagDone=false;
function lakesideDiagOnce(camera:Camera|null,l:DirectionalLight,amb:any){if(lakeDiagDone)return;let q:string|null=null;try{q=(globalThis as any).location?.search??null;}catch{q=null;}
 if(!lakesideDiagEnabled(DEBUG,q))return;lakeDiagDone=true;
 try{const root:any=director.root,psd:any=root?.pipeline?.pipelineSceneData,rc:any=camera&&isValid(camera,true)?(camera as any).camera:null;
  const v={isHDR:psd?.isHDR,toneMappingType:psd?.postSettings?.toneMappingType,pipeline:root?.pipeline?.constructor?.name,usePostProcess:camera?camera.usePostProcess:undefined,
   exposure:rc?.exposure,aperture:camera?.aperture,shutter:camera?.shutter,iso:camera?.iso,mainLightIlluminance:l.illuminance,skyIllum:amb?.skyIllum};
  const missing=Object.keys(v).filter(k=>(v as any)[k]===undefined);
  console.log('[QF_LAKE_DIAG] '+JSON.stringify(Object.assign({},v,{missing})));}
 catch(error){console.error('[QF_LAKE_DIAG] '+JSON.stringify({event:'diag-failed',error:String((error as any)?.message||error)}));}}
/** Scene node names (stable; 运镜bot's travel/landing camera hook and tests use them). */
export const LAKESIDE_NODES=Object.freeze({rig:'LakesideLiveScene',scenery:'LakesideScenery',camera:'LakesideBackgroundCamera',lights:'LakesideLights'});
/** B1 (GGbot): 465 instances of 42 GLBs, each GLB with its own palette material -> ~465 draw calls unbatched. One shared copy
 *  of every source material with USE_INSTANCING lets Cocos draw each GLB's instances as one GPU-instanced batch (~42).
 *  Returns the copies so dispose() can destroy them. Free: no assets, no re-import. */
export function enableLakesideInstancing(root:Node):Material[]{
 // r4 land fill (VB): landform GLBs (lakesideLandFillClass) get their OWN instanced copy per class carrying the fill, so water,
 // bridge and every other GLB keep the plain copy, and the static merge (keyed by material content) keeps land in its own chunks.
 // r4 prop fill: the same for foliage / house walls / rocks / clouds - one copy cache per fill class.
 const plain=new Map<Material,Material>(),byCls=new Map<string,Map<Material,Material>>(),out:Material[]=[],mode=lakesideDayNightMode();
 for(const r of root.getComponentsInChildren(MeshRenderer)){const mats=r.sharedMaterials,glb=lakesideTopGlb(root,r.node),cls=glb?lakesideLandFillClass(glb):null;
  let cache=plain;if(cls){const c=byCls.get(cls);if(c)cache=c;else{cache=new Map<Material,Material>();byCls.set(cls,cache);}}
  for(let k=0;k<mats.length;k++){const src=mats[k];if(!src||isLakesideShoreMaterial(src))continue;/* r5 S3: the shore ribbon keeps its own shore-foam material */let m=cache.get(src);
   if(!m){m=new Material();const mask=cls?lakesideFillMaskTexture(mode):null;m.copy(src,{defines:mask?{USE_INSTANCING:true,USE_EMISSIVE_MAP:true}:{USE_INSTANCING:true}});if(cls)initLakesideLandFill(m,cls,glb||'',mode);cache.set(src,m);out.push(m);}r.setSharedMaterial(m,k);}}
 return out; // a plain array, no [...iterator]: the WeChat ES5 build turns spread into [].concat(iterator) (Mac v3.2)
}
/** r4 land fill: the landform class of each land material copy (only enableLakesideInstancing registers; nothing else is ever filled). */
const lakesideLandFillOf=new WeakMap<Material,LakesideLandFillClass>();
export function lakesideLandFillMaterialClass(m:Material):LakesideLandFillClass|null{return lakesideLandFillOf.get(m)??null;}
/** GLB of the mounted top-level instance a renderer belongs to (mountLakesideScenery records it), or null. */
function lakesideTopGlb(root:Node,n:Node):string|null{let c:Node|null=n;while(c){const g=lakesideGlbOf.get(c);if(g)return g;if(c===root)return null;c=c.parent;}return null;}
function initLakesideLandFill(m:Material,cls:LakesideLandFillClass,glb:string,mode:LakesideDayNight){
 const pass:any=m.passes[0];
 if(!pass||!pass.getHandle('emissiveScale')||!pass.getHandle('emissive')){console.error('[QF_LAKE] '+JSON.stringify({event:'land-fill-unsupported',glb,effect:String((m as any).effectName||'')}));return;}
 // builtin-standard: emissive (tagged linear: true -> squared on upload, white stays 1) x emissiveScale (untagged) = the fill, linear.
 // r5 per-part: with USE_EMISSIVE_MAP the emissive colour is replaced by SRGBToLinear(mask) = the swatch weight (lakesideFillMaskBytes).
 m.setProperty('emissive',new Color(255,255,255,255));lakesideLandFillOf.set(m,cls);if(pass.getHandle('emissiveMap'))lakesideFillMaskMode.set(m,'');writeLakesideLandFill(m,cls,mode);}
/** r5 per-part fill: one 16x16 RGBA8 mask per day/night mode (palette-cell weights, lakesideFillMaskBytes), built in code on first
 *  use (0 asset bytes, no meta), nearest + clamp like the palette. Kept for the session (2 x 1 KB); null if the texture cannot be made
 *  (the copy then gets no USE_EMISSIVE_MAP and keeps the r4 flat whole-object fill). */
const lakesideFillMasks:{day:Texture2D|null;night:Texture2D|null}={day:null,night:null};
export function lakesideFillMaskTexture(mode:LakesideDayNight):Texture2D|null{
 const have=lakesideFillMasks[mode];if(have&&isValid(have,true))return have;
 try{const t=new Texture2D();t.reset({width:16,height:16,format:Texture2D.PixelFormat.RGBA8888});
  t.setFilters(Texture2D.Filter.NEAREST,Texture2D.Filter.NEAREST);t.setMipFilter(Texture2D.Filter.NONE);t.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);
  t.uploadData(lakesideFillMaskBytes(mode));lakesideFillMasks[mode]=t;return t;}
 catch(error){console.error('[QF_LAKE] '+JSON.stringify({event:'land-fill-mask-failed',mode,error:String((error as any)?.message||error)}));return null;}}
/** Which mask a per-part fill copy currently samples ('' = none yet); copies without an emissiveMap handle are not in it. */
const lakesideFillMaskMode=new WeakMap<Material,string>();
function writeLakesideLandFill(m:Material,cls:LakesideLandFillClass,mode:LakesideDayNight,weight:number=1){
 const c=lakesideFillLinear(mode,cls),k=lakesideFillWeight(weight);m.setProperty('emissiveScale',new Vec3(c[0]*k,c[1]*k,c[2]*k));
 const had=lakesideFillMaskMode.get(m);if(had!==undefined&&had!==mode){const map=lakesideFillMaskTexture(mode);if(map){m.setProperty('emissiveMap',map);lakesideFillMaskMode.set(m,mode);}}}
/** r4 land fill, day/night part: re-writes every land material under root from lakesideModeLighting(mode) (board applyDir and the
 *  journey's day/night listener - the one writer). Returns how many land materials were written. */
export function applyLakesideLandFill(root:Node,mode:LakesideDayNight,weight:number=1):number{const seen=new Set<Material>();let n=0;
 for(const r of root.getComponentsInChildren(MeshRenderer))for(const m of r.sharedMaterials){if(!m||seen.has(m))continue;seen.add(m);const cls=lakesideLandFillOf.get(m);if(cls){writeLakesideLandFill(m,cls,mode,weight);n++;}}
 return n;}
/** v3.3 static merge (see LakesideStaticMerge.ts): after instancing, every static renderer whose materials match by CONTENT and whose
 *  vertex layout matches is baked into one world-space mesh per <=65,535 vertices; originals are disabled (kept for names/diagnostics).
 *  Mac v3.2: background 36 draw calls (one instanced batch per GLB kind). Expected after: palette chunk(s) + 2 rope materials + water.
 *  Any failure reverts to the instanced scene (logged, never fatal). Returns what dispose() must destroy. */
function lakesideMaterialFacts(m:Material){
 const p:any=m.passes[0],props:Record<string,unknown>={};
 for(const k of ['mainTexture','mainColor','albedoScale','roughness','metallic','occlusion','specularIntensity','tilingOffset','alphaThreshold','emissive','emissiveScale','normalMap','pbrMap']){
  let v:any=null;try{v=(m as any).getProperty(k);}catch{v=null;}if(v===null||v===undefined)continue;
  // Textures by IMAGE + sampler: every lakeside GLB imports its own Texture2D sub-asset (<glb>@e39f7) over the one shared
  // T_LK_palette_256.png with identical nearest/repeat settings (metas), so the texture uuid alone would keep all 45 apart.
  const img=v&&typeof v==='object'?(v.image?._uuid||v.mipmaps?.[0]?._uuid||v._mipmaps?.[0]?._uuid):null;
  props[k]=typeof v==='object'?(img?'img:'+img+'/'+[v._minFilter,v._magFilter,v._mipFilter,v._wrapS,v._wrapT,v._anisotropy].join(','):v._uuid?'asset:'+v._uuid:[v.x??v.r,v.y??v.g,v.z??v.b,v.w??v.a]):v;}
 const t=p?.blendState?.targets?.[0];
 return {effect:String((m as any).effectName||(m as any).effectAsset?.name||''),technique:Number((m as any).technique||0),defines:{...(p?.defines||{})},props,cull:Number(p?.rasterizerState?.cullMode??-1),blend:!!t?.blend,priority:Number(p?.priority??0)};
}
type MergeOut={meshes:Array<{destroy():unknown}>;nodes:Node[];disabled:MeshRenderer[];stats:{chunks:number;pieces:number;vertices:number;ms:number;skipped?:string;reused?:boolean}};
/** r4-prep (first-entry frame): the journey copy and the board mount the SAME r5h3 scene, so their merge plans and merged geometry
 *  (baked relative to the scenery root) are identical. The first merge publishes its meshes here; a later merge with the same
 *  signature (instance name + source mesh + primitive + vertex count + local placement, per chunk) reuses them instead of rebuilding
 *  ~58k vertices in one frame (also saves the second ~1.6 MB copy). Each merge gets ONE handle in out.meshes; destroy() drops its
 *  reference and the last one destroys the meshes. Any mismatch → a fresh merge (old behaviour). */
type LakesideMergeShare={sig:string;meshes:Mesh[];refs:number};
let lakesideMergeShare:LakesideMergeShare|null=null;
function lakesideMergeHandle(share:LakesideMergeShare){let done=false;return {destroy(){if(done)return;done=true;share.refs--;if(share.refs<=0){for(const m of share.meshes)if(isValid(m,true))m.destroy();share.meshes=[];if(lakesideMergeShare===share)lakesideMergeShare=null;}}};}
/** Test/diagnostic view of the shared merged geometry (refs, mesh count). */
export function lakesideMergeShareInfo(){const s=lakesideMergeShare;return s?{refs:s.refs,meshes:s.meshes.length,sigLength:s.sig.length}:null;}
export function mergeLakesideStatic(scenery:Node,skip:(n:Node)=>boolean):MergeOut{
 const t0=Date.now(),out:MergeOut={meshes:[],nodes:[],disabled:[],stats:{chunks:0,pieces:0,vertices:0,ms:0}};
 const A=gfx.AttributeName,NAMES:Record<LakesideAttr,string>={position:A.ATTR_POSITION,normal:A.ATTR_NORMAL,uv:A.ATTR_TEX_COORD,color:A.ATTR_COLOR};
 type Piece={r:MeshRenderer;mesh:Mesh;k:number;group:string;vertices:number;indices:number;layout:Record<LakesideAttr,boolean>;mat:Material};
 const pieces:Piece[]=[],keys=new Map<Material,string>(),built:Mesh[]=[];
 try{
  for(const child of scenery.children){if(skip(child)||isLakesideLifeNode(child))continue;/* R5 life: swinging chimes + fireflies stay live */
   for(const r of child.getComponentsInChildren(MeshRenderer)){const mesh=r.mesh;if(!r.enabled||!mesh||!mesh.struct)continue;
    const own:Piece[]=[];let ok=true;
    for(let k=0;k<mesh.struct.primitives.length;k++){const mat=r.sharedMaterials[k],prim:any=mesh.struct.primitives[k];
     if(!mat||!prim.indexView||(prim.primitiveMode!==undefined&&prim.primitiveMode!==gfx.PrimitiveMode.TRIANGLE_LIST)){ok=false;break;}
     let key=keys.get(mat);if(key===undefined){key=lakesideMaterialKey(lakesideMaterialFacts(mat));keys.set(mat,key);}
     if(key.includes('|blend|')){ok=false;break;}
     const layout={position:!!mesh.readAttributeFormat(k,A.ATTR_POSITION),normal:!!mesh.readAttributeFormat(k,A.ATTR_NORMAL),uv:!!mesh.readAttributeFormat(k,A.ATTR_TEX_COORD),color:!!mesh.readAttributeFormat(k,A.ATTR_COLOR)};
     if(!layout.position){ok=false;break;}
     const vb=mesh.struct.vertexBundles[prim.vertexBundelIndices[0]];
     own.push({r,mesh,k,group:key+'#'+(Object.keys(layout) as LakesideAttr[]).filter(a=>layout[a]).join('+'),vertices:vb.view.count,indices:prim.indexView.count,layout,mat});}
    if(ok)pieces.push(...own);}}
  const plan=lakesideMergePlan(pieces).filter(c=>c.pieces.length>1),cache=new Map<Mesh,Map<number,any>>();
  const top=(n:Node)=>{let c:Node|null=n;while(c&&c.parent&&c.parent!==scenery)c=c.parent;return c||n;},r3=(v:number)=>Math.round(v*1000);
  const sig=plan.map(c=>c.group+'#'+c.pieces.map(pi=>{const p=pieces[pi],t=top(p.r.node),q=t.position;return t.name+'/'+String((p.mesh as any)._uuid||p.mesh.name)+'/'+p.k+'/'+p.vertices+'/'+r3(q.x)+','+r3(q.y)+','+r3(q.z);}).join(';')).join('|');
  const shared=lakesideMergeShare;
  if(shared&&shared.sig===sig&&shared.meshes.length===plan.length&&shared.meshes.every(m=>isValid(m,true))){
   plan.forEach((chunk,ci)=>{const first=pieces[chunk.pieces[0]];const n=new Node('LakesideMerged_'+ci);n.layer=scenery.layer;scenery.addChild(n);out.nodes.push(n);
    const mr=n.addComponent(MeshRenderer);mr.shadowCastingMode=first.r.shadowCastingMode;mr.receiveShadow=first.r.receiveShadow;mr.mesh=shared.meshes[ci];mr.setSharedMaterial(first.mat,0);
    for(const pi of chunk.pieces){const r=pieces[pi].r;if(r.enabled){r.enabled=false;out.disabled.push(r);}}out.stats.chunks++;out.stats.pieces+=chunk.pieces.length;out.stats.vertices+=chunk.vertices;});
   shared.refs++;out.meshes.push(lakesideMergeHandle(shared));out.stats.reused=true;out.stats.ms=Date.now()-t0;return out;}
  const read=(p:Piece)=>{let m=cache.get(p.mesh);if(!m){m=new Map();cache.set(p.mesh,m);}let d=m.get(p.k);if(d)return d;
   const attr=(a:LakesideAttr)=>{if(!p.layout[a])return null;const raw=p.mesh.readAttribute(p.k,NAMES[a] as any),f=p.mesh.readAttributeFormat(p.k,NAMES[a] as any);if(!raw||!f)throw Error('lakeside-merge-unreadable '+a);return lakesideAttrToFloat(raw as any,f as any,a==='color');};
   const idx=p.mesh.readIndices(p.k);if(!idx)throw Error('lakeside-merge-no-indices');
   d={positions:attr('position'),normals:attr('normal'),uvs:attr('uv'),colors:attr('color'),indices:idx};m.set(p.k,d);return d;};
  const inv=new Mat4(),rel=new Mat4();Mat4.invert(inv,scenery.worldMatrix);
  plan.forEach((chunk,ci)=>{const first=pieces[chunk.pieces[0]],layout=first.layout,dst={positions:[] as number[],normals:[] as number[],uvs:[] as number[],colors:[] as number[],indices:[] as number[],vertices:0};
   for(const pi of chunk.pieces){const p=pieces[pi];Mat4.multiply(rel,inv,p.r.node.worldMatrix);lakesideAppendPiece(dst,read(p),Mat4.toArray([],rel),layout);}
   const geo:any={positions:dst.positions,indices:dst.indices};
   if(layout.normal)geo.normals=dst.normals;if(layout.uv)geo.uvs=dst.uvs;
   if(layout.color){geo.colors=dst.colors.map(c=>Math.round(Math.max(0,Math.min(1,c))*255));geo.attributes=[new gfx.Attribute(A.ATTR_COLOR,gfx.Format.RGBA8,true)];}
   const mesh=utils.createMesh(geo,undefined,{calculateBounds:true});built.push(mesh);
   const n=new Node('LakesideMerged_'+ci);n.layer=scenery.layer;scenery.addChild(n);out.nodes.push(n);
   const mr=n.addComponent(MeshRenderer);mr.shadowCastingMode=first.r.shadowCastingMode;mr.receiveShadow=first.r.receiveShadow;mr.mesh=mesh;mr.setSharedMaterial(first.mat,0);
   for(const pi of chunk.pieces){const r=pieces[pi].r;if(r.enabled){r.enabled=false;out.disabled.push(r);}}
   out.stats.chunks++;out.stats.pieces+=chunk.pieces.length;out.stats.vertices+=dst.vertices;});
  if(built.length){const share:LakesideMergeShare={sig,meshes:built.splice(0),refs:1};lakesideMergeShare=share;out.meshes.push(lakesideMergeHandle(share));}
 }catch(error){
  for(const r of out.disabled.splice(0))if(isValid(r,true))r.enabled=true;for(const n of out.nodes.splice(0))if(isValid(n,true))n.destroy();for(const m of built.splice(0))m.destroy();out.meshes.length=0;
  out.stats={chunks:0,pieces:0,vertices:0,ms:0,skipped:String((error as any)?.message??error)};
  try{console.warn('[QF_LAKESIDE] '+JSON.stringify({event:'static-merge-skipped',error:out.stats.skipped}));}catch{}
 }
 out.stats.ms=Date.now()-t0;return out;
}
function setLayer(n:Node){n.layer=LAKESIDE_LAYER;for(const c of n.children)setLayer(c);}
function loadBundle(name:string){return new Promise<AssetManager.Bundle>((ok,fail)=>assetManager.loadBundle(name,(e,b)=>e||!b?fail(e||Error('no bundle '+name)):ok(b)));}
function loadJson(b:AssetManager.Bundle,path:string){return new Promise<JsonAsset>((ok,fail)=>b.load(path,JsonAsset,(e,a)=>e||!a?fail(e||Error('lakeside transforms missing')):ok(a)));}
function loadMaterial(b:AssetManager.Bundle,path:string){return new Promise<Material|null>(ok=>b.load(path,Material,(e,a)=>ok(e||!a?null:a)));}
/** r4 journey fix 1: like loadMaterial, but a failed load rejects with the engine's reason and the path (the journey logs it). */
function loadMaterialOrReason(b:AssetManager.Bundle,path:string){return new Promise<Material>((ok,fail)=>b.load(path,Material,(e,a)=>e||!a?fail(Error('lakeside-water-material-load-failed: '+path+': '+String((e as any)?.message??e??'no asset'))):ok(a)));}
/** full6 Error 16352 (mipmapLevelDataSize of null, 6-18 x <lakeside glb>@e39f7 at the tap): every LK glb texture shares ONE
 *  ImageAsset (models/T_LK_palette_256.png via imageUuidOrDatabaseUri). On mini-games macro.CLEANUP_IMAGE_CACHE=true, so each
 *  texture that uploads decRefs that image (SimpleTexture._assignImage); while loadDir is still initialising the other textures
 *  the count reaches 0, the release manager frees the image and later textures extract mipmaps from a freed image. The palette
 *  is pinned (one ref, 256x256, never released) before any LK glb loads; no import setting changes. */
export const LAKESIDE_PALETTE_PATH=LAKESIDE_MODELS_DIR+'/T_LK_palette_256';
let palettePin:Promise<unknown>|null=null;
export function pinLakesidePalette(b:AssetManager.Bundle):Promise<unknown>{
 if(!palettePin)palettePin=new Promise<unknown>(ok=>{try{b.load(LAKESIDE_PALETTE_PATH,ImageAsset,(e,a)=>{if(!e&&a)a.addRef();else palettePin=null;ok(a||null);});}catch{palettePin=null;ok(null);}});
 return palettePin;}
function loadPrefabs(b:AssetManager.Bundle){return pinLakesidePalette(b).then(()=>new Promise<Prefab[]>((ok,fail)=>b.loadDir(LAKESIDE_MODELS_DIR,Prefab,(e,list)=>e?fail(e):ok(list||[]))));}
/** Loads region_lakeside and instantiates the real scene (lakesideSceneInstances) under scenery: rigid placement only, embedded
 *  cameras/animations off. Shared by the board background and the island→lakeside journey (RegionJourneyAdapter). take()
 *  must addRef+hold every loaded asset for the caller's lifetime. Returns the instance count. */
const lakesideGlbOf=new WeakMap<Node,string>();
/** journey-merge: true for a node mountLakesideScenery instantiated from one of the water GLBs (kept out of the static merge). */
export function isLakesideWaterNode(n:Node):boolean{const g=lakesideGlbOf.get(n);return !!g&&(LAKESIDE_DIR_LIGHT_PARAMS.waterGlbs as readonly string[]).includes(g);}
/** r4-prep D (lead): ONE water parameter source for the board and the journey's lake. Both take their own copy of
 *  lakeside-water.mtl and write it only from LAKESIDE_DIR_LIGHT_PARAMS (static) + lakesideModeLighting(mode) (day/night), so
 *  whatever values Voice Bot sets there show on both sides of the swap. No values are chosen here. */
export function lakesideWaterMaterial(asset:Material):Material{
 const P=LAKESIDE_DIR_LIGHT_PARAMS,water=new Material(),v=(c:readonly number[])=>new Vec4(c[0],c[1],c[2],1);water.copy(asset);
 water.setProperty('waterTint',v(P.waterTintLinear));water.setProperty('skyZenith',v(P.waterSkyZenithLinear));water.setProperty('skyLow',v(P.waterSkyLowLinear));water.setProperty('skyHorizon',v(P.waterSkyHorizonLinear));
 water.setProperty('fresnelParams',new Vec4(P.waterFresnelPower,P.waterFresnelF0,P.waterFresnelMax,P.waterSkyStrength));water.setProperty('specParams',new Vec4(P.waterSpecExponent,P.waterSpecIntensity,P.waterSpecNoise,P.waterSkyReflectFloor));
 water.setProperty('waveParams',new Vec4(P.waterWaveTilt,P.waterWaveFreq,P.waterWaveSpeed,0));
 water.setProperty('lightParams',new Vec4(P.waterMainLightScale,P.waterAmbientScale,P.waterWaveFadeStart,P.waterWaveFadeEnd));
 /* R5 lakeside life: wind ripples follow GlobalWind (world frame: the shader works in world xz) */const gw=getGlobalWind(),rp=LAKESIDE_LIFE.ripple;
 water.setProperty('windParams',new Vec4(gw.dirX,gw.dirZ,gw.strength,0));water.setProperty('rippleParams',new Vec4(rp[0],rp[1],rp[2],0));return water;}
/** The day/night part of the same source (board applyDir and the journey's day/night listener). r4 (VB): also the per-mode
 *  reflected sky (zenith/low/horizon), tint and reflection-mix floor, so night reflects its own dark blue-teal sky. */
export function applyLakesideWaterMode(water:Material,mode:LakesideDayNight){const P=LAKESIDE_DIR_LIGHT_PARAMS,M=lakesideModeLighting(mode),v=(c:readonly number[])=>new Vec4(c[0],c[1],c[2],1);
 water.setProperty('waterTint',v(M.waterTintLinear));water.setProperty('skyZenith',v(M.waterSkyZenithLinear));water.setProperty('skyLow',v(M.waterSkyLowLinear));water.setProperty('skyHorizon',v(M.waterSkyHorizonLinear));
 water.setProperty('specParams',new Vec4(P.waterSpecExponent,P.waterSpecIntensity,P.waterSpecNoise,M.waterSkyReflectFloor));
 water.setProperty('lightParams',new Vec4(M.waterMainLightScale,M.waterAmbientScale,P.waterWaveFadeStart,P.waterWaveFadeEnd));water.setProperty('fresnelParams',new Vec4(P.waterFresnelPower,P.waterFresnelF0,P.waterFresnelMax,M.waterSkyStrength));
 applyLakesideShoreMode(mode);/* r5 S3: the shore wash takes the same mode's light scales */}
/** The lakeside-water.mtl asset (dir light mode only; null otherwise). r4 journey fix 1: a failed bundle/material load REJECTS with
 *  the reason (and path) instead of resolving null, so the caller can log it ([QF_LAKE] journey-water-fallback) and keep its old look. */
/** r4.2 item 4 (Mac r4 fault injection: the water pack blocked → B-class +2 deduplicated / +6 raw instead of exactly +1). Every
 *  bundle.load of lakeside-water.mtl whose pack fails makes the engine's pack manager console.error 'download failed: …' (journey,
 *  chapter prewarm, board preload, board build: 5 lines on the Mac), next to our one [QF_LAKE] journey-water-fallback. This probe
 *  fetches the material's pack through assetManager.downloader.download (same handlers, retries and cache as the engine; the
 *  downloader itself never logs) and nobody calls bundle.load for the water once it failed, so the fallback line is the only error.
 *  'unknown' (not packed / no downloader API) keeps the normal load. A result is reused for LAKESIDE_WATER_PROBE_TTL_MS. Never rejects. */
export type LakesideWaterProbe={state:'ok'|'failed'|'unknown';reason:string};
export const LAKESIDE_WATER_PROBE_TTL_MS=60000;
let waterProbe:{at:number;promise:Promise<LakesideWaterProbe>}|null=null;
export function probeLakesideWaterPack(bundle:AssetManager.Bundle):Promise<LakesideWaterProbe>{
 if(waterProbe&&(waterProbe.at<0||Date.now()-waterProbe.at<LAKESIDE_WATER_PROBE_TTL_MS))return waterProbe.promise;
 const st:{at:number;promise:Promise<LakesideWaterProbe>}={at:-1,promise:Promise.resolve({state:'unknown',reason:''})};waterProbe=st;
 st.promise=new Promise<LakesideWaterProbe>(resolve=>{const done=(r:LakesideWaterProbe)=>{st.at=Date.now();resolve(r);};
  try{const path=LAKESIDE_DIR_LIGHT_PARAMS.waterMaterialPath,b:any=bundle,info:any=b?.getInfoWithPath?.(path,Material),asset:any=info?.uuid?b.getAssetInfo?.(info.uuid):null,pack=asset?.packs?.[0];
   const dl:any=(assetManager as any).downloader,tf:any=(assetManager as any).utils?.transform;
   if(!pack||pack.ext!=='.json'||!dl||typeof dl.download!=='function'||typeof tf!=='function'){done({state:'unknown',reason:''});return;}
   const url=String(tf(pack.uuid,{ext:pack.ext,bundle:b.name}));
   dl.download(pack.uuid,url,pack.ext,{},(err:any)=>done(err?{state:'failed',reason:'lakeside-water-pack-unavailable: '+path+': '+String(err?.message??err)}:{state:'ok',reason:''}));}
  catch{done({state:'unknown',reason:''});}});
 return st.promise;}
export async function loadLakesideWaterAsset(token:Cancellation,take:<T extends {addRef():unknown;decRef():unknown}>(a:T)=>T):Promise<Material|null>{
 if(LAKESIDE_LIGHT_MODE!=='dir')return null;const bundle=await waitRegionAsset(loadBundle(LAKESIDE_BUNDLE),token);token.check();
 const probe=await waitRegionAsset(probeLakesideWaterPack(bundle),token);token.check();if(probe.state==='failed')throw Error(probe.reason)/* r4.2 item 4: the journey logs this as its one journey-water-fallback */;
 const a=await waitRegionAsset(loadMaterialOrReason(bundle,LAKESIDE_DIR_LIGHT_PARAMS.waterMaterialPath),token);token.check();return take(a);}
/** Puts `water` on every renderer of the lakeside water instances under `root` (direct children, as mounted). Returns slots set. */
export function useLakesideWater(root:Node,water:Material):number{let n=0;
 for(const child of root.children)if(isLakesideWaterNode(child))for(const r of child.getComponentsInChildren(MeshRenderer)){const mats=r.sharedMaterials;for(let k=0;k<mats.length;k++)if(mats[k]){r.setSharedMaterial(water,k);n++;}}
 return n;}
export async function mountLakesideScenery(scenery:Node,token:Cancellation,take:<T extends {addRef():unknown;decRef():unknown}>(a:T)=>T,yieldFrame?:()=>Promise<void>):Promise<number>{
 const t=token,bundle=await waitRegionAsset(loadBundle(LAKESIDE_BUNDLE),t);token.check();
 const json=take(await waitRegionAsset(loadJson(bundle,LAKESIDE_TRANSFORMS),t));token.check();
 const prefabs=await waitRegionAsset(loadPrefabs(bundle),t,30000);token.check();for(const p of prefabs)take(p);
 if(!isValid(scenery,true))throw Error('lakeside-scene-owner-destroyed');
 const list=lakesideSceneInstances(((json.json as any)?.instances||[]) as LakesideInstance[]),byName=new Map(prefabs.map(p=>[p.name,p]));
 const missing=Array.from(new Set(list.map(i=>lakesidePrefabName(i.glb)).filter(n=>!byName.has(n))));if(missing.length)throw Error('lakeside-prefab-missing: '+missing.join(','));
 let n=0;const shore:Node[]=[];for(const i of list){const node=instantiate(byName.get(lakesidePrefabName(i.glb))!);node.name=i.name;lakesideGlbOf.set(node,i.glb);if(i.glb===LAKESIDE_SHORE_GLB)shore.push(node);node.setPosition(i.pos[0],i.pos[1],i.pos[2]);node.setRotation(i.rot_quat_xyzw[0],i.rot_quat_xyzw[1],i.rot_quat_xyzw[2],i.rot_quat_xyzw[3]);node.setScale(i.scale[0],i.scale[1],i.scale[2]);scenery.addChild(node);n++;
  /* r4-prep A: the board preload instantiates a batch per frame (the journey copy keeps one pass under the set-off black) */if(yieldFrame&&n%LAKESIDE_PRELOAD_BATCH===0){await yieldFrame();token.check();if(!isValid(scenery,true))throw Error('lakeside-scene-owner-destroyed');}}
 for(const c of scenery.getComponentsInChildren(Camera))c.enabled=false;
 for(const a of scenery.getComponentsInChildren(Animation)){a.playOnLoad=false;a.enabled=false;}
 await mountLakesideShore(shore,take);token.check();if(!isValid(scenery,true))throw Error('lakeside-scene-owner-destroyed');
 mountLakesideLife(scenery);/* R5 lakeside life: wind chimes + night fireflies (never throws) *//* r5 S3 shore wash (never throws; no effect -> ribbon off) */
 return n;
}
/** Live r5h3 lakeside behind 风铃湖畔 challenge boards (camera priority 44, own camera and lights; never writes the world
 *  camera, saves or progression). Scene composition = scene_r5h_slim_transforms.json minus what the 2D board draws. */
/** v3.3 prewarm: when the 风铃湖畔 chapter page opens (gate open), load the bundle, transforms, the 48 model prefabs (mesh decode + GPU
 *  upload happen in Mesh.onLoaded) and the water material, so the entry frame no longer pays for them. Refs are held until the lease
 *  takes its own (or 120 s pass), then dropped; the asset manager shares in-flight requests, so an early tap costs nothing extra.
 *  Shader variants are NOT compiled here: they depend on the scene fog macro (island fog off -> lake layered), which only exists
 *  while the lake shows. Never throws; failures only log. */
let prewarm:{promise:Promise<void>;held:Array<{decRef(auto?:boolean):unknown}>;timer:any}|null=null;
export function prewarmLakesideAssets(holdMs=120000):Promise<void>{
 if(prewarm){if(prewarm.timer&&holdMs>120000){clearTimeout(prewarm.timer);const st=prewarm;st.timer=setTimeout(()=>{if(prewarm===st)releaseLakesidePrewarm();},holdMs);}return prewarm.promise;}
 const st:{promise:Promise<void>;held:Array<{decRef(auto?:boolean):unknown}>;timer:any}={promise:Promise.resolve(),held:[],timer:null};prewarm=st;
 const keep=<T extends {addRef():unknown;decRef(auto?:boolean):unknown}>(a:T|null)=>{if(a&&prewarm===st){a.addRef();st.held.push(a);}return a;};
 st.promise=(async()=>{try{const t0=Date.now(),b=await loadBundle(LAKESIDE_BUNDLE);keep(await loadJson(b,LAKESIDE_TRANSFORMS));
   for(const p of await loadPrefabs(b))keep(p);if(LAKESIDE_LIGHT_MODE==='dir'&&(await probeLakesideWaterPack(b)).state!=='failed')keep(await loadMaterial(b,LAKESIDE_DIR_LIGHT_PARAMS.waterMaterialPath));
   try{if((globalThis as any).__worldFlowLog)console.info('[QF_LAKESIDE] '+JSON.stringify({event:'prewarm',ms:Date.now()-t0,assets:st.held.length}));}catch{}
  }catch(error){try{console.warn('[QF_LAKESIDE] '+JSON.stringify({event:'prewarm-failed',error:String((error as any)?.message??error)}));}catch{}}
  if(prewarm===st)st.timer=setTimeout(()=>{if(prewarm===st)releaseLakesidePrewarm();},holdMs);})();
 return st.promise;
}
/** Drops the prewarm refs (the lease holds its own by then). Assets nobody else holds are released by the asset manager. */
export function releaseLakesidePrewarm(){const st=prewarm;prewarm=null;if(!st)return;if(st.timer)clearTimeout(st.timer);for(const a of st.held.splice(0)){try{a.decRef();}catch{}}}
/** v3.3: the one reason a failed lakeside load surfaces with (player copy is chosen by the HUD; details only in the [QF_LAKESIDE] log). */
export const LAKESIDE_LOAD_FAILED='lakeside-scene-load-failed';
/** Always-on error line (not gated by __worldFlowLog: a missing lake must be visible in any device log). Never throws. */
export function logLakesideFailure(step:string,stageId:string,error:unknown){try{console.error('[QF_LAKESIDE] '+JSON.stringify({event:'load-failed',stageId,step,error:String((error as any)?.message??error)}));}catch{}}
/** r4-prep A (lead): the board is preloaded during the landing so the swap frame only turns its camera on. */
export const LAKESIDE_PRELOAD_BATCH=24;
type LakesideBoardLease=LevelBackgroundLease&{adopt(parent:Node,token:Cancellation):void};
type LakesidePreloadMode={yieldFrame:()=>Promise<void>};
const buildLakesideBoard=async({parent,selection,token:buildToken}:{parent:Node;selection:any;token:Cancellation},pre:LakesidePreloadMode|null=null):Promise<LakesideBoardLease>=>{
 let token=buildToken,host:Node=parent,scenery:Node|null=null;
 let merged:MergeOut|null=null,guest:LakesideGuest|null=null;
 let step='start',rig:Node|null=null,camera:Camera|null=null,visible=false,paused=true,dead=false,off=()=>{},instances=0,waterTinted=0,waterShaded=0,instanced:Material[]=[];
 const held:Array<{decRef():unknown}>=[];
 /** D1: while visible, the scene's main DirectionalLight carries the r5h3 main sun and the ambient carries the dusk light;
  *  everything is saved first and restored on hide/dispose (other writers re-apply on their next change). Shadows untouched. */
 let saved:{light:DirectionalLight;rot:Quat;color:Color;illum:number;vis:number;sky:Color;ground:Color;skyIllum:number;mode:LakesideDayNight}|null=null,waterMat:Material|null=null;
 const mainLight=():DirectionalLight|null=>{const sc=director.getScene();const n=sc?.getChildByName('Main Light');return (n&&n.getComponent(DirectionalLight))||sc?.getComponentInChildren(DirectionalLight)||null;};
 const applyDir=()=>{if(LAKESIDE_LIGHT_MODE!=='dir')return;const l=saved?.light??mainLight(),amb=(director.getScene() as any)?.globals?.ambient;if(!l||!isValid(l,true)||!amb)return;
  const mode=lakesideDayNightMode();if(!saved)saved={light:l,rot:l.node.rotation.clone(),color:l.color.clone(),illum:l.illuminance,vis:(l as any).visibility,sky:amb.skyLightingColor.clone(),ground:amb.groundLightingColor.clone(),skyIllum:amb.skyIllum,mode};
  setLakesideBoardHolding(true);/* r2: the board owns the lakeside lighting while it shows (journey listener stands down) */
  const P=LAKESIDE_DIR_LIGHT_PARAMS,M=lakesideModeLighting(mode)/* r2: lakeside day (r5h3 dusk) or night look for the current toggle */,f=lakesideSunForward(LAKESIDE_BOARD_YAW_DEG)/* r4 journey fix 2: the one sun-direction source (journey: same, turned with its lake) */,w=l.node.worldPosition,c=lakesideCocosLightColor(M.sunColorLinear),sk=lakesideCocosLightColor(M.ambientSkyColorLinear),gr=lakesideCocosLightColor(M.ambientGroundColorLinear)/* r2 VB: the one linear->Cocos-byte conversion (bytes/255 are read as linear) */;
  l.node.lookAt(new Vec3(w.x+f[0],w.y+f[1],w.z+f[2]));l.color=new Color(c[0],c[1],c[2],255);const bi=(lakesideJourneyBaseIllum()??saved.illum/lakesideIslandLightScale(saved.mode))*lakesideIslandLightScale(mode)/* island main light for the current mode: day base (journey capture, else this capture) x island scale; no double scale after the blend */;l.illuminance=bi*M.sunIlluminanceScale;
  if(typeof saved.vis==='number')(l as any).visibility=saved.vis|LAKESIDE_LAYER;
  amb.skyLightingColor=new Color(sk[0],sk[1],sk[2],255);amb.groundLightingColor=new Color(gr[0],gr[1],gr[2],255);amb.skyIllum=bi*M.ambientSkyIllumToSun;
  if(camera&&isValid(camera,true))camera.clearColor=new Color(M.clearColor);
  if(waterMat)applyLakesideWaterMode(waterMat,mode);
  if(scenery&&isValid(scenery,true))applyLakesideLandFill(scenery,mode);
  lakesideDiagOnce(camera,l,amb);
  applyFog();};
 /** v3: scene LINEAR fog while the lake shows (far shore + mountains only); previous fog restored on hide/dispose. */
 let savedFog:{enabled:boolean;type:number;color:Color;start:number;end:number;top:number;range:number;atten:number}|null=null;
 const fogMode=lakesideFogModeFromEnv();/* read once per lakeside load */
 const applyFog=()=>{const P=LAKESIDE_DIR_LIGHT_PARAMS,fog=(director.getScene() as any)?.globals?.fog;if(!P.fogEnabled||!fog)return;
  if(!savedFog)savedFog={enabled:fog.enabled,type:fog.type,color:fog.fogColor.clone(),start:fog.fogStart,end:fog.fogEnd,top:fog.fogTop,range:fog.fogRange,atten:fog.fogAtten};
  if(fogMode==='off'){fog.enabled=false;return;}
  const c=lakesideModeLighting(lakesideDayNightMode()).fogColorSrgb;fog.fogColor=new Color(c[0],c[1],c[2],255);
  if(fogMode==='layered'){const L=LAKESIDE_LAYERED_FOG;fog.type=3/* FogType.LAYERED (3.8.8 render-scene/scene/fog.ts: LINEAR 0, EXP 1, EXP_SQUARED 2, LAYERED 3) */;fog.fogTop=L.fogTop;fog.fogRange=L.fogRange;fog.fogAtten=L.fogAtten;}
  else{fog.type=0/* FogType.LINEAR */;fog.fogStart=P.fogStart;fog.fogEnd=lakesideFogEnd(P);}
  fog.enabled=true;};
 const restoreFog=()=>{const f0=savedFog;savedFog=null;const fog=(director.getScene() as any)?.globals?.fog;if(!f0||!fog)return;
  fog.type=f0.type;fog.fogColor=f0.color;fog.fogStart=f0.start;fog.fogEnd=f0.end;fog.fogTop=f0.top;fog.fogRange=f0.range;fog.fogAtten=f0.atten;fog.enabled=f0.enabled;};
 const restoreDir=()=>{restoreFog();setLakesideBoardHolding(false);const s0=saved;saved=null;if(!s0||!isValid(s0.light,true))return;const amb=(director.getScene() as any)?.globals?.ambient;
  s0.light.node.setRotation(s0.rot);s0.light.color=s0.color;s0.light.illuminance=s0.illum;if(typeof s0.vis==='number')(s0.light as any).visibility=s0.vis;
  if(amb){amb.skyLightingColor=s0.sky;amb.groundLightingColor=s0.ground;amb.skyIllum=s0.skyIllum;}
  // r2: what was saved may be the other mode's look. Back at the lakeside stop the journey re-applies its look for the current
  // mode; with no journey (island) and a toggle since, the island re-writes its own look (no override lock).
  try{if(!reapplyLakesideJourney()&&s0.mode!==lakesideDayNightMode())(globalThis as any).__worldDayNight?.reapply?.();}catch{}};
 /** r2: day/night toggle while the board shows -> the lakeside look for the new mode (the world has just written the island's). */
 const offDayNight=onDayNightChange(()=>{if(!dead&&drawing())applyDir();});
 /** r4.2 item 7: the board takes the scene sun/ambient/fog ONLY while its camera actually draws (visible + camera enabled under an
  *  active host). The level adapter marks the lease visible while its host is still hidden (level-loading: the island/journey camera
  *  draws), which used to rotate the shared sun to the board yaw on the first level-loading frame - the x/z flip the Mac caught. */
 const drawing=()=>visible&&!dead&&!!camera&&isValid(camera,true)&&camera.enabled&&!!camera.node&&camera.node.activeInHierarchy;
 const syncDir=()=>{if(drawing())applyDir();else if(saved||savedFog)restoreDir();};
 const dispose=()=>{if(dead)return;restoreDir();dead=true;off();offDayNight();if(guest){guest.dispose();guest=null;}if(pre&&isValid(parent,true))parent.destroy()/* preload holder */;if(camera&&isValid(camera,true))camera.enabled=false;if(rig&&isValid(rig,true)){rig.active=false;rig.destroy();}rig=null;camera=null;for(const m of instanced.splice(0))m.destroy();if(merged){for(const m of merged.meshes.splice(0))m.destroy();merged=null;}for(const a of held.splice(0))a.decRef();};
 off=token.onCancel(dispose);
 const take=<T extends {addRef():unknown;decRef():unknown}>(a:T):T=>{if(dead)throw Error('lakeside-background-disposed');a.addRef();held.push(a);return a;};
 try{
  step='owner';token.check();const scene=director.getScene();if(!scene||!isValid(parent,true))throw Error('lakeside-background-owner-missing');
  if(scene.getComponentsInChildren(Camera).some(c=>c.enabled&&(c.visibility&LAKESIDE_LAYER)!==0))throw Error('lakeside-background-layer-conflict');
  rig=new Node(LAKESIDE_NODES.rig);rig.active=false;rig.layer=LAKESIDE_LAYER;parent.addChild(rig);
  scenery=new Node(LAKESIDE_NODES.scenery);rig.addChild(scenery);
  // Voice Bot 4728814: the shared mountLakesideScenery (bundle, transforms, prefabs, Array.from missing-check, instantiate) also feeds the journey.
  step='scenery';if(pre)instances=await mountLakesideScenery(scenery,token,take,pre.yieldFrame);else instances=await mountLakesideScenery(scenery,token,take);if(!isValid(scene,true))throw Error('lakeside-background-owner-destroyed');
  step='water-material';const bundle=await waitRegionAsset(loadBundle(LAKESIDE_BUNDLE),token);token.check();
  const wp=LAKESIDE_LIGHT_MODE==='dir'?await waitRegionAsset(probeLakesideWaterPack(bundle),token):null;token.check();/* r4.2 item 4: a failed water pack is not loaded again (no engine error); the board keeps its v2 tint like before */
  const waterAsset=wp&&wp.state!=='failed'?await waitRegionAsset(loadMaterial(bundle,LAKESIDE_DIR_LIGHT_PARAMS.waterMaterialPath),token):null;token.check();if(waterAsset)take(waterAsset);
  const list=lakesideSceneInstances((((bundle.get(LAKESIDE_TRANSFORMS,JsonAsset) as JsonAsset|null)?.json as any)?.instances||[]) as LakesideInstance[]);
  instanced=enableLakesideInstancing(scenery);
  if(LAKESIDE_LIGHT_MODE==='dir'){/* v3: the lake gets the lease's own copy of lakeside-water.mtl (Fresnel sky + sun streak + fog); if it failed to
   * load, v2 fallback: tint the lease's instanced palette copy. Assets untouched; copies destroyed with the lease. */
   const P=LAKESIDE_DIR_LIGHT_PARAMS,wc=lakesideCocosLightColor(P.waterTintLinear)/* r2 VB: legacy standard albedo (mainColor) uniform is used as linear, Color -> bytes/255 */,waterNames=new Set(list.filter(i=>(P.waterGlbs as readonly string[]).includes(i.glb)).map(i=>i.name));
   let water:Material|null=null;
   if(waterAsset){water=lakesideWaterMaterial(waterAsset)/* r4-prep D: shared with the journey's lake */;waterMat=water;instanced.push(water);}
   const tinted=new Set<Material>();
   for(const child of scenery.children)if(waterNames.has(child.name))for(const r of child.getComponentsInChildren(MeshRenderer)){const mats=r.sharedMaterials;
    for(let k=0;k<mats.length;k++){const m=mats[k];if(!m)continue;if(water){r.setSharedMaterial(water,k);waterShaded++;}else if(!tinted.has(m)&&instanced.includes(m)){m.setProperty('mainColor',new Color(wc[0],wc[1],wc[2],255));tinted.add(m);}}}
   waterTinted=tinted.size;}
  step='static-merge';if(lakesideStaticMergeFromEnv()){const water=new Set(list.filter(i=>(LAKESIDE_DIR_LIGHT_PARAMS.waterGlbs as readonly string[]).includes(i.glb)).map(i=>i.name));merged=mergeLakesideStatic(scenery,n=>water.has(n.name));}
  setLayer(scenery);
  /* r4-prep B: she stays in frame after landing (frozen copy at her landed spot). A preloaded lease takes her copy on adopt (after the landing hook). */
  if(!pre){step='guest';guest=mountLakesideGuest(scenery,LAKESIDE_LAYER);}
  step='lights-camera';
  const lights=new Node(LAKESIDE_NODES.lights);lights.layer=LAKESIDE_LAYER;rig.addChild(lights);
  if(LAKESIDE_LIGHT_MODE==='points')for(const l of LAKESIDE_LIGHTS){if(l.onlyLayer)continue;const n=new Node('Lakeside_'+l.name);n.layer=LAKESIDE_LAYER;lights.addChild(n);const p=lakesideLightPosition(l);n.setPosition(p[0],p[1],p[2]);
   const s=n.addComponent(SphereLight),c=lakesideLightSrgb(l);s.color=new Color(c[0],c[1],c[2],255);s.range=600;s.size=30;s.luminance*=12*l.ratio;s.visibility=LAKESIDE_LAYER;}
  const cn=new Node(LAKESIDE_NODES.camera);cn.layer=LAKESIDE_LAYER;rig.addChild(cn);camera=cn.addComponent(Camera);
  camera.projection=Camera.ProjectionType.PERSPECTIVE;camera.fovAxis=Camera.FOVAxis.VERTICAL;camera.near=LAKESIDE_BOARD_CAMERA.near;camera.far=LAKESIDE_BOARD_CAMERA.far;camera.visibility=LAKESIDE_LAYER;
  releaseLakesidePrewarm();
  camera.priority=44;camera.usePostProcess=false;camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;camera.clearColor=new Color(lakesideDayClearColor())/* same helper as the day pack + journey day end */;camera.enabled=false;
  // r4-prep A: preloaded → the scene's components load/enable now, a batch of instances per frame, on the board layer with the camera
  // off (nothing draws it). The rig then stays active under the preload holder; only the camera follows "visible and the board host shown".
  if(pre){step='preload-activate';const kids=scenery.children.slice();for(const k of kids)k.active=false;rig.active=true;
   for(let i=0;i<kids.length;i++){if(isValid(kids[i],true))kids[i].active=true;if((i+1)%LAKESIDE_PRELOAD_BATCH===0){await pre.yieldFrame();token.check();}}}
  else rig.active=true;/* r4.2 items 10/11: a direct build switches on with the (still hidden) board host, not on the swap frame */
  const showCamera=()=>{if(!camera||!isValid(camera,true))return;bgCamWant(camera,visible&&isValid(host,true)&&host.activeInHierarchy);};
  const fade=createSceneFade(()=>rig,()=>camera,'lakeside');
  return {
   setFade:a=>{if(!dead)fade(a);},
   adopt:(owner,next)=>{if(dead)return;host=owner;off();token=next;off=next.onCancel(dispose);if(!guest&&scenery&&isValid(scenery,true)){step='guest';guest=mountLakesideGuest(scenery,LAKESIDE_LAYER);}showCamera();syncDir();},
   frame:(_portrait,layout)=>{if(dead)return;token.check();if(!layout||!(layout.width>0&&layout.height>0))throw Error('lakeside-background-layout-missing');if(!applyCameraPose(camera!,lakesideAlignedBoardPose(layout),'lakeside.board-background'))throw Error('lakeside-background-camera-rejected');showCamera();syncDir();},
   setVisible:value=>{if(dead)return;visible=value;showCamera();if(value)syncDir();else restoreDir();},
   setPaused:value=>{if(dead)return;paused=value;},
   diagnostics:()=>({renderer:'region-live-3d',region:'lake',bundle:LAKESIDE_BUNDLE,instances,instancedMaterials:instanced.length,lightMode:LAKESIDE_LIGHT_MODE,waterTinted,waterShaded,fogHeld:!!savedFog,fogMode,mainLightHeld:!!saved,visible,paused,layer:LAKESIDE_LAYER,cameraPriority:44,nodes:LAKESIDE_NODES,dynamicTextureUploads:0,staticMerge:merged?merged.stats:null,guest:guest?guest.renderers:0,preloaded:!!pre,cameraOn:!!camera&&camera.enabled}),
   dispose,
  };
 }catch(error){dispose();
  // Cancellation (player left / superseded entry) is not a failure. Anything else: log the real cause, surface one stable reason;
  // WorldFlow keeps the player on the island (operate() restores the stable place).
  if(token.cancelled)throw error;logLakesideFailure(step,String(selection?.stageId??''),error);throw Error(LAKESIDE_LOAD_FAILED);}
};
/** r4-prep A: one preloaded board lease (journey arrival / landing hook); the next lakeside board entry adopts it. */
type LakesideBoardPreload={token:Cancellation;holder:Node;promise:Promise<LakesideBoardLease|null>;adopted:boolean};
let boardPreload:LakesideBoardPreload|null=null;
const nextFrame=()=>new Promise<void>(resolve=>{let done=false;const go=()=>{if(done)return;done=true;resolve();};try{director.once('director_after_draw' as any,go);}catch{}setTimeout(go,50)/* paused game: never stall */;});
/** Starts building the 风铃湖畔 board lease now (idempotent): a batch of instances per frame under a hidden holder, camera off. Never rejects. */
export function preloadLakesideBoard():Promise<unknown>{
 if(boardPreload)return boardPreload.promise;const scene=director.getScene();if(!scene)return Promise.resolve(null);
 const holder=new Node('LakesideBoardPreload');scene.addChild(holder);
 const st:LakesideBoardPreload={token:new Cancellation(),holder,promise:Promise.resolve(null),adopted:false};boardPreload=st;const t0=Date.now();
 st.promise=buildLakesideBoard({parent:holder,selection:{stageId:'lakeside-preload'},token:st.token},{yieldFrame:nextFrame}).then(lease=>{
   try{if((globalThis as any).__worldFlowLog)console.info('[QF_LAKESIDE] '+JSON.stringify({event:'board-preload',ms:Date.now()-t0}));}catch{}return lease;},
  ()=>{if(boardPreload===st)boardPreload=null;if(isValid(holder,true))holder.destroy();return null;});
 return st.promise;}
/** Drops a preload nobody adopted (journey left, fallback). */
export function releaseLakesideBoardPreload(){const st=boardPreload;boardPreload=null;if(!st||st.adopted)return;st.token.cancel();void st.promise.then(l=>{l?.dispose();if(isValid(st.holder,true))st.holder.destroy();});}
export function lakesideBoardPreloadInfo(){const st=boardPreload;return st?{pending:true,adopted:st.adopted}:null;}
export const createLakesideBoardBackground:LevelBackgroundFactory=async ctx=>{
 const st=boardPreload;
 if(st){boardPreload=null;st.adopted=true;let lease:LakesideBoardLease|null=null;
  try{lease=await ctx.token.wait(st.promise);}catch(error){void st.promise.then(l=>l?.dispose());throw error;}
  if(lease){lease.adopt(ctx.parent,ctx.token);return lease;}/* preload failed (logged) → the normal build below reports any failure */}
 return buildLakesideBoard(ctx);
};
