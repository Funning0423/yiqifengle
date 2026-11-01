import {MeshRenderer,Node,director,isValid,type Camera,type Material} from 'cc';
import {LAKESIDE_BUNDLE,LAKESIDE_DIR_LIGHT_PARAMS} from './LakesideSceneData';
/** r4 journey fix 1: the island→lakeside journey's lake keeps the imported water look when its own lakeside-water.mtl copy cannot be
 *  made (bundle or material load failed, timed out, or the copy threw). That fallback is no longer silent: one always-on
 *  [QF_LAKE] ERROR line (console.error; lead) with the reason and the asset path (not gated by __worldFlowLog, so any device log shows it). A normal run
 *  never prints it. Never throws (the walk goes on with the old look). */
export function logLakesideJourneyWaterFallback(error:unknown,asset:string=LAKESIDE_DIR_LIGHT_PARAMS.waterMaterialPath,bundle:string=LAKESIDE_BUNDLE):string{
 let reason='unknown';try{reason=String((error as any)?.message??error);}catch{}
 try{console.error('[QF_LAKE] '+JSON.stringify({event:'journey-water-fallback',bundle,asset,reason,look:'imported water (pre-r4 look)'}));}catch{}
 return reason;}
/** r4 journey fix 3: the journey lake's water shader/pipeline state is built on its FIRST DRAW (WebGL links the program and the PSO is
 *  made lazily), which used to be whenever the lake first entered the walking camera's view: a hitch mid-walk. The prewarm draws the
 *  journey's own water copy once, on a copy of a real water mesh shrunk to <= 1 mm right in front of the journey camera, for `frames`
 *  rendered frames, then removes it. It runs from show(true) right after the atmosphere prime(): under the set-off fade's full black
 *  and after the fog switch, so the variant compiled is the one the lake (and the board's copy, same effect/defines) draws with.
 *  Same mesh (vertex layout), same material, same shadow flags and layer as the lake renderer. Never throws; one node, gone after. */
export const LAKESIDE_WATER_PREWARM=Object.freeze({frames:2,maxMs:3000,sizeM:1e-3,distanceM:.5});
/** r4.2: the last prewarm's result for diagnostics (was an info [QF_LAKE] line). */
export let lastLakesideWaterPrewarm:{ok:boolean;frames:number;ms:number}|null=null;
export type LakesideWaterPrewarm={done:Promise<boolean>;cancel():void;node():Node|null};
/** First lakeside water renderer (with a mesh) under root's direct children, as mounted (isWater = isLakesideWaterNode). */
export function lakesideWaterSourceRenderer(root:Node|null,isWater:(n:Node)=>boolean):MeshRenderer|null{
 if(!root)return null;for(const child of root.children)if(isWater(child))for(const r of child.getComponentsInChildren(MeshRenderer))if(r&&r.mesh)return r;return null;}
const afterDraw=()=>new Promise<void>(resolve=>{try{director.once('director_after_draw' as any,()=>resolve());}catch{resolve();}});
export function prewarmLakesideWaterDraw(camera:Camera|null,water:Material|null,source:MeshRenderer|null,opt:{afterDraw?:()=>Promise<void>;maxMs?:number;frames?:number}={}):LakesideWaterPrewarm{
 const C=LAKESIDE_WATER_PREWARM,frames=opt.frames??C.frames,maxMs=opt.maxMs??C.maxMs,wait=opt.afterDraw??afterDraw;
 let node:Node|null=null,over=false;
 const end=()=>{over=true;const n=node;node=null;if(n&&isValid(n,true))n.destroy();};
 /* r4.2 item 3: a normal run prints no [QF_LAKE] line at all (the info prewarm/skipped lines are gone; a missing water material already logged journey-water-fallback) */
 const skip=(_why:string)=>{end();return {done:Promise.resolve(false),cancel(){},node:()=>null};};
 if(!water)return skip('no-water-material');if(!source||!source.mesh)return skip('no-water-mesh');if(!camera||!isValid(camera,true)||!isValid(camera.node,true))return skip('no-camera');
 try{
  const n=new Node('LakesideWaterPrewarm');node=n;n.layer=source.node.layer;camera.node.addChild(n);
  const st:any=(source.mesh as any).struct,lo=st?.minPosition,hi=st?.maxPosition,ext=lo&&hi?Math.max(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z):NaN,k=Number.isFinite(ext)&&ext>0?C.sizeM/ext:1e-5;
  n.setPosition(0,0,-Math.max(C.distanceM,(Number.isFinite(camera.near)?camera.near:0)*4));n.setScale(k,k,k);
  const r=n.addComponent(MeshRenderer);r.shadowCastingMode=source.shadowCastingMode;r.receiveShadow=source.receiveShadow;r.mesh=source.mesh;
  const slots=Math.max(1,source.sharedMaterials.length);for(let i=0;i<slots;i++)r.setSharedMaterial(water,i);
 }catch(error){try{console.warn('[QF_LAKE] '+JSON.stringify({event:'journey-water-prewarm-failed',error:String((error as any)?.message??error)}));}catch{}end();return {done:Promise.resolve(false),cancel(){},node:()=>null};}
 const t0=Date.now();
 const done=(async()=>{let drawn=0;for(;drawn<frames&&!over;drawn++){let timer:any;const late=new Promise<void>(res=>{timer=setTimeout(res,maxMs);});try{await Promise.race([wait(),late]);}finally{clearTimeout(timer);}}
  const ok=!over;end();lastLakesideWaterPrewarm={ok,frames:drawn,ms:Date.now()-t0};return ok;})();
 return {done,cancel:end,node:()=>node};}
