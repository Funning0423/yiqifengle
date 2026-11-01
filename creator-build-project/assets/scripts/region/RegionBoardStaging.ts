import {bgCamHeld,bgCamSettled,bgCamWarmOn} from './BgCamGate';
import {Camera,MeshRenderer,Rect,director,game,isValid,type Node} from 'cc';
/** r5 G1 (meadow / sky-city swap frames). The live region board (MeadowLiveScene / SkycityLiveBackground, under the hidden board
 *  host) used to make ALL of its render work happen on two frames: the frame its host switches on (every MeshRenderer.onEnable
 *  creates its model: sub-models, passes, descriptor sets, input assemblers; her guest copy's skinned + morph models with it) and
 *  the swap frame (the board camera's first draw: WebGL compiles and links every shader variant on first bind, Cocos 3.8.8
 *  WebGL2Shader.gpuShader is lazy; the board's own MeadowKeyLight adds forward-add variants the journey copy never drew). Mac r4:
 *  level-loading start 32.6-41.9 ms, swap 29.1-39.3 ms (+9.55 MB GPU buffers, +1 MB textures on that one frame).
 *
 *  stageRegionBoard spreads that work over the level-loading frames that follow the host switching on:
 *   - when it is armed (before the host is ever active) every enabled MeshRenderer under the rig is switched off (onLoad still runs on
 *     activation, so morph instances exist; the model is only made in onEnable);
 *   - after each drawn frame (director_after_draw) with the rig active in the hierarchy (from the second one: the host-on frame
 *     already activates the whole host), up to `renderersPerFrame` are switched back
 *     on, so a frame makes at most that many models; at most `newVariantsPerFrame` of them may bring a material (per renderer kind:
 *     skinned / morph / plain compile different variants) not drawn yet, the rest reuse materials already drawn, so a frame compiles
 *     about one material's variants;
 *   - the rig's own (disabled) board camera draws meanwhile into a viewportPx-sized corner with a depth-only clear (camera.rect;
 *     nothing visible: it has no colour clear and covers about one pixel), so each batch is DRAWN the frame after it was made and its
 *     shader variants compile then, a batch at a time, with the board's real lights, layer and pipeline macros;
 *   - once the last batch has been drawn (settleFrames drawn frames after it was switched on) the camera gets its rect / clear flags /
 *     enabled back and staging is done.
 *  finish() (the reveal: setVisible(true)) switches everything left on at once and restores the camera, so visibility is never later
 *  than before and nothing depends on frames arriving. Without a frame clock (director.on missing: unit fakes) nothing is armed and
 *  the caller keeps the old path. Imported cameras inside the region model are never touched (only direct rig children). */
export const REGION_BOARD_STAGING=Object.freeze({renderersPerFrame:4,newVariantsPerFrame:1,settleFrames:1,viewportPx:2});
export type BoardStagingStats={armed:boolean;parked:number;enabled:number;frames:number;cameraFrames:number;flushed:number;done:boolean;reason:string;camera:string|null};
export type BoardStaging={finish(reason:string):void;dispose():void;stats():BoardStagingStats};
export type BoardStagingHooks={onFrame(cb:()=>void):()=>void;viewport():{w:number;h:number}};
const AFTER_DRAW='director_after_draw';
function defaultHooks():BoardStagingHooks|null{
 const d:any=director;if(!d||typeof d.on!=='function'||typeof d.off!=='function')return null;
 return {onFrame(cb){d.on(AFTER_DRAW,cb);return ()=>{try{d.off(AFTER_DRAW,cb);}catch{}};},
  viewport(){const c:any=(game as any)?.canvas;const w=Number(c?.width),h=Number(c?.height);return {w:w>0?w:1080,h:h>0?h:1920};}};}
/** Pure: the corner rect (normalised) that covers about `px` device pixels of a w x h canvas. */
export function stagingRect(px:number,w:number,h:number):{x:number;y:number;width:number;height:number}{
 const k=(n:number)=>Math.min(.02,Math.max(.0005,px/(n>0?n:1080)));return {x:0,y:0,width:k(w),height:k(h)};}
/** Pure: the variant keys a renderer will compile on its first draw (renderer kind + each shared material, by identity). */
export function variantKeys(r:any,mats:any[]):string[]{const out:string[]=[];const kind=(r&&r.constructor&&r.constructor.name)||'MeshRenderer';
 const morph=!!(r&&r.mesh&&r.mesh.struct&&r.mesh.struct.morph);const sm:any[]=(r&&r.sharedMaterials)||[];
 for(let i=0;i<sm.length;i++){const m=sm[i];if(!m)continue;let k=mats.indexOf(m);if(k<0){k=mats.length;mats.push(m);}const key=kind+(morph?'+morph':'')+'#'+k;if(out.indexOf(key)<0)out.push(key);}return out;}
/** Pure: next batch from `queue` (removed from it): ≤per renderers, ≤fresh of them bringing a key not in `seen` (seen is updated). */
export function nextBatch<T>(queue:T[],keys:(t:T)=>string[],seen:string[],per:number,fresh:number):T[]{const out:T[]=[];let newOnes=0;
 for(let i=0;i<queue.length&&out.length<per;){const k=keys(queue[i]);let isNew=false;for(let j=0;j<k.length;j++)if(seen.indexOf(k[j])<0){isNew=true;break;}
  if(isNew&&newOnes>=fresh){i++;continue;}if(isNew){newOnes++;for(let j=0;j<k.length;j++)if(seen.indexOf(k[j])<0)seen.push(k[j]);}out.push(queue[i]);queue.splice(i,1);}
 return out;}
export function stageRegionBoard(rig:Node|null,hooks?:BoardStagingHooks|null,opt:{renderersPerFrame?:number;newVariantsPerFrame?:number;settleFrames?:number;viewportPx?:number}={}):BoardStaging|null{
 const H=hooks===undefined?defaultHooks():hooks;if(!H||!rig||!isValid(rig,true))return null;
 const C=REGION_BOARD_STAGING,per=Math.max(1,opt.renderersPerFrame??C.renderersPerFrame),fresh=Math.max(1,opt.newVariantsPerFrame??C.newVariantsPerFrame),settle=Math.max(0,opt.settleFrames??C.settleFrames),px=opt.viewportPx??C.viewportPx;
 const parked:MeshRenderer[]=[];const all=rig.getComponentsInChildren(MeshRenderer);
 for(let i=0;i<all.length;i++){const r=all[i];if(r&&r.enabled){r.enabled=false;parked.push(r);}}
 let cam:Camera|null=null;const cams=rig.getComponentsInChildren(Camera);for(let i=0;i<cams.length;i++){const c=cams[i];if(c&&c.node&&c.node.parent===rig&&!c.enabled){cam=c;break;}}
 const st:BoardStagingStats={armed:true,parked:parked.length,enabled:0,frames:0,cameraFrames:0,flushed:0,done:false,reason:'',camera:cam?cam.node.name:null};
 const mats:any[]=[],keyOf:any[]=[];for(let i=0;i<parked.length;i++)keyOf.push(variantKeys(parked[i],mats));const seen:string[]=[];
 const queue:number[]=[];for(let i=0;i<parked.length;i++)queue.push(i);let left=settle,saved:{rect:any;clear:any;enabled:boolean}|null=null,off:(()=>void)|null=null;
 const camOn=()=>{if(saved||!cam||!isValid(cam,true)||!cam.node.activeInHierarchy||bgCamHeld(cam))return;/* p0drag6: no warm-up draw while explore / the walk cover holds it */try{const r:any=cam.rect;saved={rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,clear:cam.clearFlags,enabled:cam.enabled};
  const v=H.viewport(),q=stagingRect(px,v.w,v.h);cam.rect=new Rect(q.x,q.y,q.width,q.height);cam.clearFlags=Camera.ClearFlag.DEPTH_ONLY;bgCamWarmOn(cam);}catch{saved=null;}};
 const camOff=()=>{const s=saved;saved=null;if(!s||!cam||!isValid(cam,true))return;try{cam.enabled=bgCamSettled(cam,s.enabled)/* p0drag6: the owner's want / holds as of now, not the stale snapshot */;cam.clearFlags=s.clear;if(s.rect)cam.rect=new Rect(s.rect.x,s.rect.y,s.rect.width,s.rect.height);}catch{}};
 const enable=(r:MeshRenderer)=>{if(r&&isValid(r,true)&&!r.enabled){r.enabled=true;return true;}return false;};
 const stop=(reason:string)=>{if(st.done)return;st.done=true;st.reason=reason;if(off){const o=off;off=null;o();}camOff();
  try{if((globalThis as any).__worldFlowLog)console.info('[QF_REGION] '+JSON.stringify({event:'board-staging',rig:rig.name,parked:st.parked,frames:st.frames,cameraFrames:st.cameraFrames,flushed:st.flushed,reason}));}catch{}};
 const step=()=>{if(st.done)return;if(!isValid(rig,true)){stop('rig-gone');return;}if(!rig.activeInHierarchy)return;
  st.frames++;if(saved)st.cameraFrames++;camOn();if(st.frames===1)return;// the host-on frame already activates the whole host (UI + rig)
  if(queue.length){const b=nextBatch(queue,i=>keyOf[i],seen,per,fresh);for(let n=0;n<b.length;n++)if(enable(parked[b[n]]))st.enabled++;return;}
  if(left>1){left--;return;}stop('staged');};
 if(!parked.length&&!cam){st.armed=false;st.done=true;st.reason='nothing';return {finish(){},dispose(){},stats:()=>({...st})};}
 off=H.onFrame(step);
 return {finish(reason:string){if(st.done)return;while(queue.length){const i=queue.shift()!;if(enable(parked[i]))st.flushed++;}stop(reason||'finish');},
  dispose(){if(st.done)return;queue.length=0;stop('disposed');},stats:()=>({...st})};
}
