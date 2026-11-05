import {Material,MeshRenderer,Node,director,isValid} from 'cc';
import {loadWindEffect} from './MeadowBoardBackground';
/** b20 warm-up C. Sail set-off used to compile every env_meadow variant on one frame (probe B: 69 createShader, 1601 ms).
 *  Preload already mounts an inactive SailWarm rig (meshes/textures only). This schedules the FINAL define set
 *  (configureMeadowVertexColors + meadow-grass-wind on the five grass renderers) one variant per frame, before sail.
 *  A non-blocking GL kick (compileShader, no getShaderParameter) runs the frame before the Cocos tryCompile, so the
 *  later link can hit the driver cache. The sail frame itself kicks and compiles nothing — unfinished renderers stay
 *  disabled, so the set-off draw cannot dump the rest. No new cover. Budget is the same 4 ms contract as the meadow
 *  split; the numbers below are the offline cost model (Mac measures real frame time). */
export const MEADOW_WARM_BUDGET_MS=4;
export const MEADOW_WARM_COST=Object.freeze({syncVariantMs:1601/69,kickMs:0.25,cacheHitMs:0.5,unfixedVariants:69});
export const MEADOW_SAIL_WARM_VARIANTS=69;
const MARK='__qfMeadowSailWarm';
const keptGl:any[]=[];
export function meadowUnfixedSailMs(n:number=MEADOW_SAIL_WARM_VARIANTS):number{return n===MEADOW_SAIL_WARM_VARIANTS?1601:MEADOW_WARM_COST.syncVariantMs*n;}
export function meadowWarmFrameCost(kind:'sync'|'kick'|'cache-hit'|'idle',n:number=1):number{
 const u=kind==='sync'?MEADOW_WARM_COST.syncVariantMs:kind==='kick'?MEADOW_WARM_COST.kickMs:kind==='cache-hit'?MEADOW_WARM_COST.cacheHitMs:0;return u*n;}
/** True when configureMeadowVertexColors will recompile this slot (mesh has no a_color, pass asks for USE_VERTEX_COLOR). */
export function meadowVertexColorPatch(meshHasColor:boolean,passUsesVertexColor:boolean):boolean{return !meshHasColor&&passUsesVertexColor;}
export function meadowDefineSnapshot(defines:Record<string,unknown>|null|undefined,forceVcOff:boolean):string{
 const src=defines||{},keys=Object.keys(src).sort(),parts:string[]=[];
 for(let i=0;i<keys.length;i++){const k=keys[i];let v=src[k];if(forceVcOff&&k==='USE_VERTEX_COLOR')v=false;parts.push(k+'='+String(v));}
 return parts.join(',');}
export type MeadowVariantInput={effect:string;defines:Record<string,unknown>|null;grass:boolean;meshHasColor:boolean;pass:number};
export type MeadowWarmItem={key:string;effect:string;defines:string;vcOff:boolean};
/** Final variant after the sail prepare's define set: grass slots become meadow-grass-wind; other colourless meshes drop USE_VERTEX_COLOR. */
export function meadowFinalVariant(spec:MeadowVariantInput):MeadowWarmItem{
 const vcOn=!!(spec.defines&&spec.defines.USE_VERTEX_COLOR);
 const vcOff=!spec.grass&&meadowVertexColorPatch(spec.meshHasColor,vcOn);
 const effect=spec.grass?'meadow-grass-wind':(spec.effect||'fx');
 const defines=meadowDefineSnapshot(spec.defines,vcOff);
 return {key:effect+'|'+defines+'|p'+spec.pass,effect,defines,vcOff};}
export function meadowWarmItems(specs:MeadowVariantInput[]):MeadowWarmItem[]{
 const out:MeadowWarmItem[]=[],seen:string[]=[];
 for(let i=0;i<specs.length;i++){const fin=meadowFinalVariant(specs[i]);if(seen.indexOf(fin.key)>=0)continue;seen.push(fin.key);out.push(fin);}
 return out;}
/** One cache-hit compile and one kick when both fit in the budget. Never a synchronous dump of the whole set. */
export function meadowWarmPlan(pendingKicks:number,pendingCompiles:number,budgetMs:number=MEADOW_WARM_BUDGET_MS):{kicks:number;compiles:number;ms:number}{
 let ms=0,kicks=0,compiles=0;
 if(pendingCompiles>0){const c=meadowWarmFrameCost('cache-hit',1);if(ms+c<=budgetMs){compiles=1;ms+=c;}}
 if(pendingKicks>0){const k=meadowWarmFrameCost('kick',1);if(ms+k<=budgetMs){kicks=1;ms+=k;}}
 return {kicks,compiles,ms};}
export type MeadowWarmStats={frames:number;sailSkips:number;kicked:number;compiled:number;maxFrameMs:number;done:boolean;finalKeys:string[]};
export type MeadowWarmStage={noteSail():void;willSkip():boolean;step():void;stats():MeadowWarmStats;dispose():void};
export function stageMeadowSailWarm(items:MeadowWarmItem[],hooks:{kick(key:string):void;compile(key:string):boolean},budgetMs:number=MEADOW_WARM_BUDGET_MS):MeadowWarmStage{
 const finalKeys:string[]=[];for(let i=0;i<items.length;i++){const id=items[i].effect+'|'+items[i].defines;if(finalKeys.indexOf(id)<0)finalKeys.push(id);}finalKeys.sort();
 let kicked=0,compiled=0,frames=0,sailSkips=0,maxFrameMs=0,skip=false,dead=false;
 const stats=():MeadowWarmStats=>({frames,sailSkips,kicked,compiled,maxFrameMs,done:compiled>=items.length,finalKeys});
 return {noteSail(){skip=true;},willSkip(){return skip;},
  step(){if(dead)return;frames++;
   if(skip){skip=false;sailSkips++;return;}
   if(compiled>=items.length)return;
   const plan=meadowWarmPlan(items.length-kicked,kicked-compiled,budgetMs);
   if(plan.ms>maxFrameMs)maxFrameMs=plan.ms;
   if(plan.compiles&&compiled<kicked){if(hooks.compile(items[compiled].key)!==false)compiled++;}
   if(plan.kicks&&kicked<items.length){hooks.kick(items[kicked].key);kicked++;}},
  stats,dispose(){dead=true;}};}
type Work={key:string;vcOff:boolean;slot:number;passIndex:number;renderer:MeshRenderer;mat:any};
type RState={r:MeshRenderer;keys:string[];was:boolean;on:boolean};
export type MeadowSailWarm={definesReady:boolean;material:Material|null;effect:any;whenReady():Promise<Material|null>;noteSail():void;adopt():void;bindWind(effect:any,material:Material):void;stats():MeadowWarmStats|null;finalDefines():string[]};
function isGrass(r:MeshRenderer):boolean{let n:Node|null=r.node;while(n){if(n.name.indexOf('meadow_grass_instances.')===0)return true;n=n.parent;}return false;}
function meshHasColor(mesh:any):boolean{const bundles=mesh&&mesh.struct&&mesh.struct.vertexBundles||[];
 for(let i=0;i<bundles.length;i++){const attrs=bundles[i].attributes||[];for(let j=0;j<attrs.length;j++)if(attrs[j]&&attrs[j].name==='a_color')return true;}return false;}
function effectNameOf(mat:any):string{return String(mat&&(mat.effectName||(mat.effectAsset&&mat.effectAsset.name))||'fx');}
function nowMs():number{return typeof performance!=='undefined'&&performance.now?performance.now():Date.now();}
/** compileShader without getShaderParameter so the driver can finish off the sail frame. Shaders are retained so the cache is not dropped. */
export function kickGlsl(gl:any,vert:string,frag:string):number{const t0=nowMs();
 if(!gl||typeof gl.createShader!=='function'||typeof gl.compileShader!=='function'||!vert||!frag)return 0;
 try{if(typeof gl.getExtension==='function')gl.getExtension('KHR_parallel_shader_compile');}catch{/* extension optional */}
 let vs:any=null,fs:any=null;try{vs=gl.createShader(gl.VERTEX_SHADER);fs=gl.createShader(gl.FRAGMENT_SHADER);}catch{return nowMs()-t0;}
 if(!vs||!fs)return nowMs()-t0;
 try{gl.shaderSource(vs,vert);gl.shaderSource(fs,frag);gl.compileShader(vs);gl.compileShader(fs);}catch{return nowMs()-t0;}
 keptGl.push(vs,fs);if(keptGl.length>400)keptGl.splice(0,keptGl.length-400);return nowMs()-t0;}
function shaderSources(pass:any):{vert:string;frag:string}|null{
 const stages=pass&&(pass.shader&&pass.shader.stages||pass.program&&pass.program.shaders)||null;if(!stages||!stages.length)return null;
 let vert='',frag='';
 for(let i=0;i<stages.length;i++){const s=stages[i];const src=s&&(s.source||s.glsl||'');if(!src)continue;
  const tag=String(s.name||s.stage||'');if(s.type===0x8b31||tag==='vert'||/vertex/i.test(tag))vert=src;else frag=src;}
 if(!vert&&stages[0])vert=String(stages[0].source||stages[0].glsl||'');if(!frag&&stages[1])frag=String(stages[1].source||stages[1].glsl||'');
 return vert&&frag?{vert,frag}:null;}
function currentGl():any{try{const dev=(director as any).root&&(director as any).root.device;return dev&&(dev.gl||dev._context)||null;}catch{return null;}}
function hasFrameClock():boolean{const d:any=director;return !!(d&&typeof d.on==='function'&&typeof d.off==='function');}
function defaultOnFrame(cb:()=>void):(()=>void)|null{
 if(!hasFrameClock())return null;const d:any=director;
 d.on('director_after_draw',cb);return ()=>{try{d.off('director_after_draw',cb);}catch{/* listener already gone */}};}
function assignGrass(model:Node,material:Material):void{
 const rs=model.getComponentsInChildren(MeshRenderer);
 for(let i=0;i<rs.length;i++){if(!isGrass(rs[i])||typeof rs[i].setSharedMaterial!=='function')continue;
  const n=rs[i].sharedMaterials?rs[i].sharedMaterials.length:0;for(let s=0;s<n;s++)rs[i].setSharedMaterial(material,s);}}
function buildQueue(model:Node,wind:Material|null):{items:MeadowWarmItem[];work:Work[];renderers:RState[]}{
 const rs=model.getComponentsInChildren(MeshRenderer),items:MeadowWarmItem[]=[],work:Work[]=[],seen:string[]=[],renderers:RState[]=[];
 for(let i=0;i<rs.length;i++){const r=rs[i],grass=isGrass(r),has=meshHasColor(r.mesh),keys:string[]=[];
  const mats=r.sharedMaterials||[];const slots=Math.max(mats.length,grass&&wind?1:0);
  for(let s=0;s<slots;s++){const mat=grass&&wind?wind:mats[s];if(!mat)continue;const passes=mat.passes||[];const npass=Math.max(passes.length,1);
   for(let p=0;p<npass;p++){const pass=passes[p]||null;const fin=meadowFinalVariant({effect:effectNameOf(mat),defines:pass&&pass.defines||null,grass,meshHasColor:has,pass:p});
    if(keys.indexOf(fin.key)<0)keys.push(fin.key);
    if(seen.indexOf(fin.key)>=0)continue;seen.push(fin.key);items.push(fin);work.push({key:fin.key,vcOff:fin.vcOff,slot:s,passIndex:p,renderer:r,mat});}}
  renderers.push({r,keys,was:!!r.enabled,on:false});}
 return {items,work,renderers};}
function compileWork(w:Work):boolean{
 let inst:any=null;if(w.renderer&&typeof (w.renderer as any).getMaterialInstance==='function'){try{inst=(w.renderer as any).getMaterialInstance(w.slot);}catch{inst=null;}}
 if(inst&&typeof inst.recompileShaders==='function'){inst.recompileShaders(w.vcOff?{USE_VERTEX_COLOR:false}:{},w.passIndex);return true;}
 const pass=w.mat&&w.mat.passes&&w.mat.passes[w.passIndex];if(pass&&typeof pass.tryCompile==='function'){pass.tryCompile(w.vcOff?{USE_VERTEX_COLOR:false}:undefined);return true;}
 return true;}
function kickWork(w:Work):void{
 let pass:any=null;try{const inst=w.renderer&&typeof (w.renderer as any).getMaterialInstance==='function'?(w.renderer as any).getMaterialInstance(w.slot):null;pass=inst&&inst.passes&&inst.passes[w.passIndex];}catch{pass=null;}
 if(!pass)pass=w.mat&&w.mat.passes&&w.mat.passes[w.passIndex];
 const src=shaderSources(pass);if(src)kickGlsl(currentGl(),src.vert,src.frag);}
function parkAndWatch(renderers:RState[],compiled:string[]):void{
 for(let i=0;i<renderers.length;i++){const s=renderers[i];if(!s.keys.length){s.on=true;continue;}s.was=!!s.r.enabled;if(s.was)s.r.enabled=false;}}
function releaseCompiled(renderers:RState[],compiled:string[]):void{
 for(let i=0;i<renderers.length;i++){const s=renderers[i];let ok=s.keys.length===0;if(!ok){ok=true;for(let j=0;j<s.keys.length;j++)if(compiled.indexOf(s.keys[j])<0){ok=false;break;}}
  if(!ok)continue;s.on=true;if(!isValid(s.r,true))continue;
  const want=(s.r as any).__qfSailWant;if(want===0){s.r.enabled=false;continue;}
  if(want===1||(want==null&&s.was))s.r.enabled=true;}}
/** Start (or return) the sail warm-up on the preloaded meadow model. No frame clock → null, prepare keeps the old path. */
export function beginMeadowSailWarm(model:Node|null):MeadowSailWarm|null{
 if(!model||!isValid(model,true))return null;
 const prev=(model as any)[MARK] as MeadowSailWarm|undefined;if(prev)return prev;
 if(!hasFrameClock())return null;
 let resolveReady:(m:Material|null)=>void=()=>{};
 const ready=new Promise<Material|null>(r=>{resolveReady=r;});
 const handle:MeadowSailWarm&{adopted:boolean;disposed:boolean}={
  definesReady:false,material:null,effect:null,adopted:false,disposed:false,
  whenReady:()=>ready,noteSail(){},adopt(){handle.adopted=true;},
  bindWind(effect:any,material:Material){supply(effect,material);},
  stats:()=>null,finalDefines:()=>[]};
 let staged:MeadowWarmStage|null=null,off:(()=>void)|null=null,sailLatch=false,started=false;
 const compiled:string[]=[];
 handle.noteSail=()=>{sailLatch=true;if(staged)staged.noteSail();};
 const shutdown=()=>{if(off){const f=off;off=null;f();}if(!handle.adopted&&!isValid(model,true)&&handle.material){try{handle.material.destroy();}catch{/* already destroyed */}}};
 const supply=(effect:any,material:Material|null)=>{
  if(handle.disposed||started){if(material&&material!==handle.material&&!handle.adopted){try{material.destroy();}catch{/* extra */}}return;}
  started=true;handle.effect=effect;handle.material=material;
  if(material)assignGrass(model,material);
  const built=buildQueue(model,material);handle.definesReady=true;handle.finalDefines=()=>staged?staged.stats().finalKeys:[];
  const byKey:(k:string)=>Work|null=key=>{for(let i=0;i<built.work.length;i++)if(built.work[i].key===key)return built.work[i];return null;};
  staged=stageMeadowSailWarm(built.items,{kick(key){const w=byKey(key);if(w)kickWork(w);},compile(key){const w=byKey(key);const ok=w?compileWork(w):true;if(ok&&compiled.indexOf(key)<0)compiled.push(key);releaseCompiled(built.renderers,compiled);return ok;}});
  handle.stats=()=>staged?staged.stats():null;
  if(sailLatch)staged.noteSail();
  parkAndWatch(built.renderers,compiled);releaseCompiled(built.renderers,compiled);
  off=defaultOnFrame(()=>{if(handle.disposed||!isValid(model,true)){shutdown();return;}if(!staged)return;staged.step();releaseCompiled(built.renderers,compiled);if(staged.stats().done&&off){const f=off;off=null;f();}});
  resolveReady(material);};
 (model as any)[MARK]=handle;
 loadWindEffect().then(effect=>{if(handle.disposed||!isValid(model,true)){resolveReady(null);return;}
  const material=new Material();try{material.initialize({effectAsset:effect});}catch{try{material.destroy();}catch{/* init failed */}resolveReady(null);return;}
  if(!material.passes||!material.passes.length){try{material.destroy();}catch{/* empty */}resolveReady(null);return;}
  supply(effect,material);},()=>{resolveReady(null);});
 return handle;}
export function meadowSailWarmOf(model:Node|null):MeadowSailWarm|null{const w=model&&(model as any)[MARK];return w||null;}
/** The next warm step (the set-off draw) kicks and compiles nothing. */
export function noteMeadowSailFrame(model:Node|null):void{const w=meadowSailWarmOf(model);if(w)w.noteSail();}
/** Raw GL compile of one pass (not device.createShader). False when the pass has no GLSL yet, so the caller compiles the same frame. */
export function kickCompiledPass(pass:any):boolean{const src=shaderSources(pass);if(!src)return false;kickGlsl(currentGl(),src.vert,src.frag);return true;}
