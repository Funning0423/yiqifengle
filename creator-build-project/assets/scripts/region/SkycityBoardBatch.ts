import {Material,MeshRenderer,Node} from 'cc';
import {BOARD_MERGE_SKIP} from './PerfBudget';
import {holdRegionGpu} from './RegionGpuLease';
/** Board-only batch for the sky-city background rig. SkycityBoardBackground.ts stays the frozen pose/anchor file
 *  so scene design can swap the 2D tray for an in-scene board without rebasing this.
 *  Instancing keeps each node (state_ / clouds / pennants still toggle). Static merge only folds direct children
 *  whose names are not in BOARD_MERGE_SKIP. Failure leaves the instanced scene. */
const batched=new WeakSet<Node>();
function canInstance(r:any):boolean{
 if(!r||r.enabled===false)return false;
 if(r.node&&r.node.active===false)return false;
 if(r.skeleton||r.skinningRoot)return false;
 const morph=r.mesh&&r.mesh.struct&&r.mesh.struct.morph;
 if(morph&&morph.subMeshMorphs&&morph.subMeshMorphs.length)return false;
 return true;
}
export function batchSkycityBoard(root:Node|null):{before:number;after:number;instanced:number;merged:number}{
 if(!root||batched.has(root))return {before:0,after:0,instanced:0,merged:0};
 batched.add(root);
 holdRegionGpu('region_skycity');
 const all=root.getComponentsInChildren(MeshRenderer);
 let before=0;
 const staticRs:MeshRenderer[]=[];
 for(let i=0;i<all.length;i++){
  const r=all[i] as any;
  if(!r||r.enabled===false||(r.node&&r.node.active===false))continue;
  before++;
  if(canInstance(r))staticRs.push(all[i]);
 }
 const copies=new Map<any,Material>();
 for(let i=0;i<staticRs.length;i++){
  const r=staticRs[i];
  const mats=r.sharedMaterials||[];
  for(let k=0;k<mats.length;k++){
   const src=mats[k];if(!src)continue;
   let copy=copies.get(src);
   if(!copy){
    try{
     copy=new Material();
     if(typeof (copy as any).copy!=='function')continue;
     (copy as any).copy(src,{defines:{USE_INSTANCING:true}});
     copies.set(src,copy);
    }catch{continue;}
   }
   try{r.setSharedMaterial(copy,k);}catch{/* keep the source material */}
  }
 }
 let merged=0;
 try{
  const merge=(require('./LakesideBoardBackground') as {mergeLakesideStatic?:Function}).mergeLakesideStatic;
  if(typeof merge==='function'){
   const model=root.getChildByName('env_skycity')||root;
   const out=merge(model,(n:Node)=>BOARD_MERGE_SKIP.test(String(n&&n.name||'')));
   merged=out&&out.stats?out.stats.chunks|0:0;
   (root as any).__qfBoardMerge=out;
  }
 }catch{merged=0;}
 let after=0;
 const left=root.getComponentsInChildren(MeshRenderer);
 for(let i=0;i<left.length;i++){
  const r=left[i] as any;
  if(r&&r.enabled!==false&&!(r.node&&r.node.active===false))after++;
 }
 try{console.info('[QF_BOARD_BATCH] '+JSON.stringify({before,after,instanced:copies.size,merged}));}catch{/* log only */}
 return {before,after,instanced:copies.size,merged};
}
/** Start board_art image loads during the balloon ride so the reveal frame is not the first upload. */
export function primeSkycityBoardTextures():void{
 try{
  const art=(require('../ui/BoardArt') as {BoardArt:{shared():{load(dir:string):Promise<boolean>}}}).BoardArt;
  if(art&&art.shared){void art.shared().load('board');void art.shared().load('popup');}
 }catch{/* art optional until the board mounts */}
}
export function installSkycityBoardPerf():void{
 const g=globalThis as any;
 g.__qfBoardSpread=true;
 g.__qfBatchSkycityBoard=(root:Node|null)=>batchSkycityBoard(root);
 g.__qfOnBoardVisible=(selection:any)=>{
  const id=String(selection&&selection.stageId||'');
  const sky=selection&&selection.region==='skycity'||/^r05-sky-/.test(id)||/^mainline-(09|10|11|12)$/.test(id);
  if(!sky)return;
  g.__qfBoardSpread=true;
  try{primeSkycityBoardTextures();}catch{/* already started */}
 };
}
