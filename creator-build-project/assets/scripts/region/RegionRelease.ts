import {Director,MeshRenderer,Mesh,Prefab,Texture2D,director,isValid,type Node} from 'cc';
import {RegionReleaseLedger,type RefAsset} from './RegionReleaseCore';
/** P0 fin: engine side of RegionReleaseCore. Loaders of meadow / sail assets call holdRegionAsset(); the lakeside board, once it
 *  draws, calls releaseLeftRegions(). See RegionReleaseCore for the safety rules. */
export const regionReleaseLedger=new RegionReleaseLedger();
export function holdRegionAsset(region:'meadow'|'sail',asset:unknown):void{try{regionReleaseLedger.hold(region,asset as RefAsset);}catch{}}
const nextDrawnFrame=()=>new Promise<void>(r=>{let done=false;const go=()=>{if(done)return;done=true;r();};try{director.once(Director.EVENT_AFTER_DRAW,go);}catch{setTimeout(go,50);}});
/** Assets a live scene node still uses: meshes, materials' textures, and prefab roots (node._prefab.asset). One walk per check. */
function liveUse():Set<unknown>{
 const used=new Set<unknown>();const scene=director.getScene();if(!scene)return used;
 const walk=(n:Node)=>{if(!isValid(n,true))return;const p:any=(n as any)._prefab;if(p?.asset)used.add(p.asset);
  for(const r of n.getComponents(MeshRenderer)){if(r.mesh)used.add(r.mesh);for(const m of r.sharedMaterials){if(!m)continue;used.add(m);for(const props of ((m as any)._props||[]) as Record<string,unknown>[])for(const k in props){const v=props[k];if(v instanceof Texture2D)used.add(v);}}}
  for(const c of n.children)walk(c);};
 walk(scene as unknown as Node);return used;}
function bytesEst(a:any):number{
 if(a instanceof Mesh){const d:any=(a as any).data;return d?.byteLength??0;}
 if(a instanceof Texture2D){return a.width*a.height*4;}
 if(a instanceof Prefab)return 0;return 0;}
function transitionDone():boolean{
 try{const g:any=globalThis;const s=g.__worldIntegration?.snapshot?.();const j=s?.journey;if(!j)return false;
  const wipe=g.__qfWindWipe;const wipeClear=!wipe||wipe.mode==='clear';
  return j.phase==='arrived'&&j.region==='lakeside'&&!j.target&&wipeClear;}catch{return false;}}
/** Region-owned hooks: before = drop unadopted warm nodes (they are ours and unused at the lake); after = forget cached promises. */
export const regionReleaseHooks:Record<string,{before?:()=>void;after?:()=>void}>={};
let pending:Promise<unknown>|null=null;
/** Idempotent. Meadow and sail only; logs [QF_RELEASE] per released region, or a skip reason when something still blocks it. */
export function releaseLeftRegions():Promise<unknown>{
 if(pending)return pending;
 if(!regionReleaseLedger.count('meadow')&&!regionReleaseLedger.count('sail'))return Promise.resolve(null);
 let used:Set<unknown>|null=null;
 const env={transitionDone,referenced:(a:RefAsset)=>(used??=liveUse()).has(a),nextFrame:()=>nextDrawnFrame().then(()=>{used=null;}),bytesEst,log:(l:string)=>{try{console.info(l);}catch{}}};
 pending=(async()=>{for(const r of ['meadow','sail']){if(!transitionDone())break;try{regionReleaseHooks[r]?.before?.();}catch{}used=null;const res=await regionReleaseLedger.release(r,env);if(res.reason==='released')try{regionReleaseHooks[r]?.after?.();}catch{}
   if(res.reason!=='released'&&res.reason!=='nothing-held')try{console.info('[QF_RELEASE] '+JSON.stringify({region:r,skipped:res.reason}));}catch{}}})().finally(()=>{pending=null;});
 return pending;}
