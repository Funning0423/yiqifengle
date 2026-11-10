import {Camera,Color,Mat4,MeshRenderer,Node,SphereLight,director,gfx,utils} from 'cc';
import {BOARD_MERGE_SKIP} from './PerfBudget';
import {holdRegionGpu} from './RegionGpuLease';
import {REGIONS,loadRegionPrefab,mountRegion} from './RegionLoader';
import {lakesideAppendPiece,lakesideAttrToFloat,type LakesideAttr} from './LakesideStaticMerge';
import {publishSkycityBoardModel} from './SkycityBoardSlot';
/** WeChat DevTools does not GPU-instance builtin-standard; a new instancing program key compiled at the reveal
 *  (181ms → 388ms) and draw calls stayed ~262.
 *  This file merges static meshes that already share a material — same program the flight drew —
 *  and draws those materials once on a private layer during the cruise, before the board camera exists.
 *  SkycityBoardBackground.ts is not modified. state_ / clouds / pennants / robot stay separate nodes. */
const WARM_LAYER=1<<19;
const batched=new WeakSet<Node>();
type Piece={r:any;sub:number;mat:any};
type Group={mat:any;pieces:Piece[]};
let phase:'idle'|'load'|'merge'|'draw'|'ready'='idle';
let loading=false;
let model:Node|null=null;
let warmCam:Camera|null=null;
let groups:Group[]=[];
let groupAt=0;
let drawLeft=0;
let mergedNodes:Node[]=[];
function attrName():Record<LakesideAttr,string>{
 const A:any=gfx&&gfx.AttributeName||{};
 return {position:A.ATTR_POSITION||'a_position',normal:A.ATTR_NORMAL||'a_normal',uv:A.ATTR_TEX_COORD||'a_texCoord',color:A.ATTR_COLOR||'a_color'};
}
function hideBoardStates(root:Node):void{
 const walk=(n:Node)=>{if(n.name.startsWith('state_')&&n.name!=='state_bridge_after')n.active=false;for(let i=0;i<n.children.length;i++)walk(n.children[i]);};
 walk(root);
}
function canMerge(r:any):boolean{
 if(!r||r.enabled===false)return false;
 const node=r.node;if(!node||node.active===false)return false;
 if(r.skeleton||r.skinningRoot)return false;
 const morph=r.mesh&&r.mesh.struct&&r.mesh.struct.morph;
 if(morph&&morph.subMeshMorphs&&morph.subMeshMorphs.length)return false;
 if(BOARD_MERGE_SKIP.test(String(node.name||'')))return false;
 let p:Node|null=node.parent;
 while(p){if(BOARD_MERGE_SKIP.test(String(p.name||'')))return false;if(p===node.scene)break;p=p.parent;}
 return !!(r.mesh&&r.mesh.struct);
}
/** Same material object, no new defines. Original renderers are disabled, so numDrawCalls drops on WeChat. */
export function mergeSkycityStatic(root:Node|null):{before:number;after:number;merged:number;groups:number}{
 if(!root||batched.has(root)){
  const left=root?root.getComponentsInChildren(MeshRenderer).filter(r=>r.enabled!==false&&r.node.active!==false).length:0;
  return {before:left,after:left,merged:0,groups:0};
 }
 batched.add(root);
 holdRegionGpu('region_skycity');
 hideBoardStates(root);
 const all=root.getComponentsInChildren(MeshRenderer);
 let before=0;
 const buckets=new Map<any,Piece[]>();
 for(let i=0;i<all.length;i++){
  const r=all[i] as any;
  if(!r||r.enabled===false||(r.node&&r.node.active===false))continue;
  before++;
  if(!canMerge(r))continue;
  const mats=r.sharedMaterials||[];
  const prims=r.mesh.struct.primitives||[];
  for(let k=0;k<prims.length;k++){
   const mat=mats[k]||mats[0];if(!mat)continue;
   const list=buckets.get(mat)||[];list.push({r,sub:k,mat});buckets.set(mat,list);
  }
 }
  const N=attrName();
 const inv=new Mat4();Mat4.invert(inv,root.worldMatrix);
 let merged=0,groupsN=0;
 buckets.forEach((pieces,mat)=>{
  if(pieces.length<2)return;
  groupsN++;
  const dst={positions:[] as number[],normals:[] as number[],uvs:[] as number[],colors:[] as number[],indices:[] as number[],vertices:0};
  const layout={position:true,normal:true,uv:true,color:false};
  let ok=true;
  for(let i=0;i<pieces.length&&ok;i++){
   const p=pieces[i];
   try{
    const mesh=p.r.mesh;
    const posRaw=mesh.readAttribute(p.sub,N.position as any),posFmt=mesh.readAttributeFormat(p.sub,N.position as any);
    if(!posRaw||!posFmt){ok=false;break;}
    const idx=mesh.readIndices(p.sub);if(!idx){ok=false;break;}
    const nRaw=mesh.readAttribute(p.sub,N.normal as any),nFmt=mesh.readAttributeFormat(p.sub,N.normal as any);
    const uRaw=mesh.readAttribute(p.sub,N.uv as any),uFmt=mesh.readAttributeFormat(p.sub,N.uv as any);
    const src={
     positions:lakesideAttrToFloat(posRaw,posFmt as any,false),
     normals:nRaw&&nFmt?lakesideAttrToFloat(nRaw,nFmt as any,false):null,
     uvs:uRaw&&uFmt?lakesideAttrToFloat(uRaw,uFmt as any,false):null,
     colors:null,
     indices:idx,
    };
    if(!src.normals)layout.normal=false;
    if(!src.uvs)layout.uv=false;
    const rel=new Mat4();Mat4.multiply(rel,inv,p.r.node.worldMatrix);
    lakesideAppendPiece(dst,src,Mat4.toArray([],rel) as unknown as ArrayLike<number>,layout);
   }catch{ok=false;}
  }
  if(!ok||dst.vertices<3)return;
  try{
   const geo:any={positions:dst.positions,indices:dst.indices};
   if(layout.normal&&dst.normals.length===dst.vertices*3)geo.normals=dst.normals;
   if(layout.uv&&dst.uvs.length===dst.vertices*2)geo.uvs=dst.uvs;
   const mesh=utils.createMesh(geo,undefined,{calculateBounds:true});
   const n=new Node('SkycityMerged');n.layer=root.layer;root.addChild(n);
   const mr=n.addComponent(MeshRenderer);
   mr.mesh=mesh;mr.setSharedMaterial(mat,0);
   mr.enabled=false;
   for(let i=0;i<pieces.length;i++){try{pieces[i].r.enabled=false;}catch{/* leave */}}
   merged++;
   mergedNodes.push(n);
  }catch{/* this material stays as separate draws; no new shader */}
 });
 let after=0;
 const left=root.getComponentsInChildren(MeshRenderer);
 for(let i=0;i<left.length;i++){const r=left[i] as any;if(r&&r.enabled!==false&&!(r.node&&r.node.active===false))after++;}
 try{console.info('[QF_BOARD_BATCH] '+JSON.stringify({before,after,merged,groups:groupsN,instanced:0}));}catch{/* log only */}
 return {before,after,merged,groups:groupsN};
}
/** Back-compat name used by the guest hook. Does not copy materials or change defines. */
export function batchSkycityBoard(root:Node|null):{before:number;after:number;instanced:number;merged:number}{
 const r=mergeSkycityStatic(root);
 return {before:r.before,after:r.after,instanced:0,merged:r.merged};
}
function setLayer(n:Node,layer:number):void{n.layer=layer;for(let i=0;i<n.children.length;i++)setLayer(n.children[i],layer);}
function maskWorldCameras(scene:Node,cam:Camera):void{
 const cams=scene.getComponentsInChildren(Camera);
 for(let i=0;i<cams.length;i++){if(cams[i]!==cam)cams[i].visibility&=~WARM_LAYER;}
}
async function startLoad():Promise<void>{
 if(loading||phase==='ready')return;
 loading=true;
 try{
  const scene=director.getScene();
  if(!scene){phase='idle';loading=false;return;}
  const prefab=await loadRegionPrefab(REGIONS.skycity);
  if(phase==='ready'){loading=false;return;}
  const rig=new Node('SkycityBoardWarm');rig.layer=WARM_LAYER;scene.addChild(rig);
  const mounted=mountRegion(REGIONS.skycity,prefab,rig);
  // mountRegion may adopt a previous warm; this call is the first, so it instantiates.
  model=mounted;setLayer(model,WARM_LAYER);hideBoardStates(model);
  const lightNode=new Node('SkycityBoardWarmLight');lightNode.layer=WARM_LAYER;rig.addChild(lightNode);
  const light=lightNode.addComponent(SphereLight);light.visibility=WARM_LAYER;light.color=new Color(255,243,218,255);light.range=260;
  const camNode=new Node('SkycityBoardWarmCamera');camNode.layer=WARM_LAYER;rig.addChild(camNode);
  const cam=camNode.addComponent(Camera);
  cam.projection=Camera.ProjectionType.PERSPECTIVE;cam.fovAxis=Camera.FOVAxis.VERTICAL;cam.fov=45;cam.near=0.1;cam.far=1200;
  cam.visibility=WARM_LAYER;cam.priority=1;cam.clearFlags=Camera.ClearFlag.DEPTH_ONLY;cam.enabled=false;
  try{const rect:any=cam.rect;if(rect){rect.x=0;rect.y=0;rect.width=0.002;rect.height=0.002;}}catch{/* rect optional */}
  warmCam=cam;maskWorldCameras(scene,cam);
  groups=[];
  const seen=new Set<any>();
  const rs=model.getComponentsInChildren(MeshRenderer);
  for(let i=0;i<rs.length;i++){
   const mats=(rs[i] as any).sharedMaterials||[];
   for(let k=0;k<mats.length;k++){const m=mats[k];if(m&&!seen.has(m)){seen.add(m);groups.push({mat:m,pieces:[]});}}
  }
  groupAt=0;phase='merge';
 }catch(error){phase='ready';try{console.warn('[QF_BOARD_BATCH] warm-load '+String((error as any)?.message||error));}catch{/* */}}
 loading=false;
}
/** One merge or one warm draw per call. Safe during the balloon cruise; no-ops until t>3 is decided by the caller. */
export function stepSkycityBoardWarm():void{
 if(phase==='ready')return;
 if(phase==='idle'){phase='load';void startLoad();return;}
 if(phase==='load')return;
 if(phase==='merge'){
  if(!model){phase='idle';return;}
  mergedNodes=[];
  let stats={before:0,after:0,merged:0,groups:0};
  try{stats=mergeSkycityStatic(model);}catch(error){try{console.warn('[QF_BOARD_BATCH] merge '+String((error as any)?.message||error));}catch{/* */}}
  if(!mergedNodes.length){
   const rs=model.getComponentsInChildren(MeshRenderer);
   for(let i=0;i<rs.length;i++){const r=rs[i] as any;if(!r||r.enabled===false||(r.node&&r.node.active===false))continue;r.enabled=false;mergedNodes.push(r.node);}
  }
  drawLeft=mergedNodes.length;
  if(!drawLeft){if(model)publishSkycityBoardModel(model);phase='ready';return;}
  if(warmCam)warmCam.enabled=true;
  phase='draw';
  try{console.info('[QF_BOARD_BATCH] merged '+JSON.stringify(stats));}catch{/* */}
  return;
 }
 if(phase==='draw'){
  const n=mergedNodes[mergedNodes.length-drawLeft];
  if(n){const mr=n.getComponent(MeshRenderer);if(mr)mr.enabled=true;}
  drawLeft--;
  if(drawLeft<=0){
   if(warmCam)warmCam.enabled=false;
   if(model)publishSkycityBoardModel(model);
   phase='ready';
   try{console.info('[QF_BOARD_BATCH] warm-ready nodes='+mergedNodes.length);}catch{/* */}
  }
 }
}
export function skycityBoardWarmPhase():string{return phase;}
export function primeSkycityBoardTextures():void{
 try{
  const art=(require('../ui/BoardArt') as {BoardArt:{shared():{load(dir:string):Promise<boolean>}}}).BoardArt;
  if(art&&art.shared){void art.shared().load('board');void art.shared().load('popup');}
 }catch{/* art optional */}
}
export function installSkycityBoardPerf():void{
 const g=globalThis as any;
 g.__qfBoardSpread=false;
 g.__qfBatchSkycityBoard=(root:Node|null)=>batchSkycityBoard(root);
 g.__qfOnBoardVisible=(selection:any)=>{
  const id=String(selection&&selection.stageId||'');
  const sky=selection&&selection.region==='skycity'||/^r05-sky-/.test(id)||/^mainline-(09|10|11|12)$/.test(id);
  if(!sky)return;
  try{primeSkycityBoardTextures();}catch{/* already started */}
 };
}
