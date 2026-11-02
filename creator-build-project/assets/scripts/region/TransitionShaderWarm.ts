import {MeshRenderer,Node,director,isValid} from 'cc';
import {MEADOW_WARM_BUDGET_MS,kickCompiledPass,meadowWarmPlan} from './MeadowSailWarm';
/** b20: Mac 0421cfff world.animateCamera frame 1841 compiled 70 builtin-standard variants in 606 ms
 *  (USE_VERTEX_COLOR + CC_USE_SKINNING + CC_USE_MORPH 53/16/3 + receive-shadow + forward-add), then frame 1938
 *  compiled 31 more (alpha-test, second UV, unlit, planar/shadow-caster). meadow-warm-rig had already aborted
 *  left-island, and MeadowSailWarm never covered character skinning/morph. This schedules the same final patches
 *  one kick + one getShaderVariant per frame from the moment the scene exists, so the later pipeline flush is a
 *  cache hit. It does not wait on the camera and it does not change walk speed, fidelity, or which meshes draw. */
export const MAC_MORPH_COUNTS:readonly number[]=[53,16,3];
const SEEN_CAP=4000;
const SCAN_EVERY=10;
/** Pipeline macros are part of the program key. A shadow-type change compiles again, still one variant per frame. */
function macroStamp():string{
 try{const scene:any=director.getScene();const sh=scene&&scene.globals&&scene.globals.shadows;if(!sh)return 'none';
  let light='';const sun=typeof scene.getChildByName==='function'?scene.getChildByName('Main Light'):null;const comps=sun&&sun.components||[];
  for(let i=0;i<comps.length;i++){const c=comps[i];if(c&&typeof c.shadowEnabled==='boolean')light=(c.shadowEnabled?'1':'0')+':'+String(c.shadowPcf);}
  return String(sh.type)+'/'+(sh.enabled?'1':'0')+'/'+light;}catch{return 'none';}}
type Patch={name:string;value:boolean|number};
type Item={key:string;pass:any;patches:Patch[]|null;hot:boolean};
export type TransitionWarmStats={frames:number;sailSkips:number;kicked:number;compiled:number;pending:number;maxFrameMs:number;done:boolean};
export function morphPatches(count:number,hasPosition:boolean):Patch[]{
 const p:Patch[]=[{name:'CC_USE_MORPH',value:true},{name:'CC_MORPH_TARGET_COUNT',value:count}];
 if(hasPosition)p.push({name:'CC_MORPH_TARGET_HAS_POSITION',value:true});return p;}
export function transitionPassKey(effect:string,passName:string,defines:Record<string,unknown>|null,patches:readonly Patch[]):string{
 const src=defines||{},names=Object.keys(src).sort(),parts:string[]=[];
 for(let i=0;i<names.length;i++)parts.push(names[i]+'='+String(src[names[i]]));
 const ordered=patches.slice().sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0),pp:string[]=[];
 for(let i=0;i<ordered.length;i++)pp.push(ordered[i].name+'='+String(ordered[i].value));
 return (effect||'fx')+'|'+(passName||'p')+'|'+parts.join(',')+'|'+pp.join(',');}
function mergePatches(live:Patch[],extra:Patch[]):Patch[]{
 const out:Patch[]=[],have:string[]=[];
 for(let i=0;i<live.length;i++){out.push(live[i]);have.push(live[i].name);}
 for(let i=0;i<extra.length;i++)if(have.indexOf(extra[i].name)<0){out.push(extra[i]);have.push(extra[i].name);}
 return out;}
function attrHit(attrs:any[],name:string):boolean{
 for(let i=0;i<attrs.length;i++){const a=attrs[i];const n=String(a&&(a.name||a)||'');if(n===name||n==='a_'+name)return true;}return false;}
function synthPatches(renderer:any,sub:number,forceReceive:boolean):Patch[]{
 const out:Patch[]=[];
 if(forceReceive||renderer.receiveShadow)out.push({name:'CC_RECEIVE_SHADOW',value:true});
 if(renderer.skeleton||renderer.skinningRoot){out.push({name:'CC_USE_SKINNING',value:true});out.push({name:'CC_USE_REAL_TIME_JOINT_TEXTURE',value:false});}
 const morph=renderer.mesh&&renderer.mesh.struct&&renderer.mesh.struct.morph,sm=morph&&morph.subMeshMorphs&&morph.subMeshMorphs[sub];
 if(sm&&sm.targets&&sm.targets.length){const attrs=sm.attributes||[];const pos=attrHit(attrs,'position');
  const m=morphPatches(sm.targets.length,pos);for(let i=0;i<m.length;i++)out.push(m[i]);
  if(attrHit(attrs,'normal'))out.push({name:'CC_MORPH_TARGET_HAS_NORMAL',value:true});
  if(attrHit(attrs,'tangent'))out.push({name:'CC_MORPH_TARGET_HAS_TANGENT',value:true});}
 return out;}
function livePatches(renderer:any,sub:number):Patch[]{
 const model=renderer.model,subs=model&&(model.subModels||model._subModels),one=subs&&subs[sub],raw=one&&(one.patches||one._patches);
 if(!raw||!raw.length)return [];
 const out:Patch[]=[];for(let i=0;i<raw.length;i++)if(raw[i]&&raw[i].name)out.push({name:String(raw[i].name),value:raw[i].value});return out;}
function effectOf(mat:any):string{return String(mat&&(mat.effectName||(mat.effectAsset&&mat.effectAsset.name))||'fx');}
function passName(pass:any,index:number):string{return String(pass&&(pass.programName||pass._programName)||('p'+index));}
function isHot(renderer:any,sub:number):boolean{
 if(renderer.skeleton||renderer.skinningRoot)return true;
 const morph=renderer.mesh&&renderer.mesh.struct&&renderer.mesh.struct.morph,sm=morph&&morph.subMeshMorphs&&morph.subMeshMorphs[sub];
 return !!(sm&&sm.targets&&sm.targets.length);}
/** One job per pass, plus the receive-shadow key for skinned/morph meshes (the 1841 set). Duplicate keys collapse. */
export function collectTransitionPasses(root:Node|null):{key:string;effect:string;hot:boolean;patches:Patch[]}[]{
 const out:{key:string;effect:string;hot:boolean;patches:Patch[]}[]=[],seen:string[]=[];
 const consider=(renderer:any,mat:any,pass:any,index:number,sub:number,force:boolean)=>{
  const patches=mergePatches(livePatches(renderer,sub),synthPatches(renderer,sub,force));
  const key=transitionPassKey(effectOf(mat),passName(pass,index),pass&&pass.defines||null,patches);
  if(seen.indexOf(key)>=0)return;seen.push(key);out.push({key,effect:effectOf(mat),hot:isHot(renderer,sub),patches});};
 const walk=(node:any)=>{
  if(!node)return;const comps=node.components||node._components||[];
  for(let c=0;c<comps.length;c++){const r=comps[c];if(!r||!r.sharedMaterials)continue;
   const mats=r.sharedMaterials;for(let s=0;s<mats.length;s++){const mat=mats[s];if(!mat)continue;const passes=mat.passes||[];
    for(let p=0;p<passes.length;p++){const pass=passes[p];if(!pass)continue;consider(r,mat,pass,p,s,false);if(isHot(r,s))consider(r,mat,pass,p,s,true);}}}
  const kids=node.children||[];for(let i=0;i<kids.length;i++)walk(kids[i]);};
 walk(root);return out;}
export function transitionWarmCoversMac(keys:readonly string[]):boolean{
 const all=keys.join('\n');if(all.indexOf('CC_USE_SKINNING')<0||all.indexOf('CC_RECEIVE_SHADOW')<0)return false;
 if(all.indexOf('USE_ALPHA_TEST')<0||all.indexOf('HAS_SECOND_UV')<0||all.indexOf('builtin-unlit')<0||all.indexOf('meadow-grass-wind')<0)return false;
 for(let i=0;i<MAC_MORPH_COUNTS.length;i++)if(all.indexOf('CC_MORPH_TARGET_COUNT='+MAC_MORPH_COUNTS[i])<0)return false;return true;}
export type TransitionWarmStage={noteSail():void;hold(on:boolean):void;step():void;stats():TransitionWarmStats;dispose():void};
/** Same 4 ms plan as meadow C: at most one cache-fill and one kick. hold/noteSail do no work that frame. */
export function stageTransitionWarm(items:{key:string}[],hooks:{kick(key:string):void;compile(key:string):boolean},budgetMs:number=MEADOW_WARM_BUDGET_MS):TransitionWarmStage{
 let kicked=0,compiled=0,frames=0,sailSkips=0,maxFrameMs=0,skip=false,held=false,dead=false;
 return {noteSail(){skip=true;},hold(on:boolean){held=on;},
  step(){if(dead)return;frames++;if(held)return;if(skip){skip=false;sailSkips++;return;}if(compiled>=items.length)return;
   const plan=meadowWarmPlan(items.length-kicked,kicked-compiled,budgetMs);if(plan.ms>maxFrameMs)maxFrameMs=plan.ms;
   if(plan.compiles&&compiled<kicked){if(hooks.compile(items[compiled].key)!==false)compiled++;}
   if(plan.kicks&&kicked<items.length){hooks.kick(items[kicked].key);kicked++;}},
  stats:()=>({frames,sailSkips,kicked,compiled,pending:items.length-compiled,maxFrameMs,done:compiled>=items.length}),
  dispose(){dead=true;}};}
const roots:Node[]=[];const jobs:Item[]=[];const seen:string[]=[];
let kicked=0,compiled=0,frames=0,sailSkips=0,maxFrameMs=0,skipNext=false,held=false,scanIn=0,listening=false,logged=false,off:(()=>void)|null=null;
function remember(node:Node|null):void{if(!node||!isValid(node,true))return;if(roots.indexOf(node)>=0)return;roots.push(node);scanIn=0;}
function compileItem(item:Item):void{
 const pass=item.pass,patches=item.patches;
 if(!pass||typeof pass.getShaderVariant!=='function'){if(pass&&typeof pass.tryCompile==='function'){try{pass.tryCompile();}catch{/* miss */}}return;}
 try{pass.getShaderVariant(patches&&patches.length?patches:null);}catch{const d=pass.defines||pass._defines;if(d&&patches)for(let i=0;i<patches.length;i++){try{delete d[patches[i].name];}catch{/* leave */}}}}
function enqueue(item:Item):void{
 if(seen.indexOf(item.key)>=0||seen.length>=SEEN_CAP)return;seen.push(item.key);
 if(!item.hot){jobs.push(item);return;}
 const rest=jobs.splice(kicked);jobs.push(item);for(let i=0;i<rest.length;i++)jobs.push(rest[i]);}
function absorb():void{
 for(let r=roots.length-1;r>=0;r--){const root=roots[r];if(!isValid(root,true)){roots.splice(r,1);continue;}
  const hot:Item[]=[],cold:Item[]=[];
  const consider=(renderer:any,mat:any,pass:any,index:number,sub:number,force:boolean)=>{
   const patches=mergePatches(livePatches(renderer,sub),synthPatches(renderer,sub,force));
   const key=macroStamp()+'~'+transitionPassKey(effectOf(mat),passName(pass,index),pass&&pass.defines||null,patches);
   const item:Item={key,pass,patches:patches.length?patches:null,hot:isHot(renderer,sub)};if(item.hot)hot.push(item);else cold.push(item);};
  const walk=(node:any)=>{
   if(!node)return;const comps=node.components||[];
   for(let c=0;c<comps.length;c++){const rr=comps[c];if(!(rr instanceof MeshRenderer)||!rr.sharedMaterials)continue;
    const mats=rr.sharedMaterials;for(let s=0;s<mats.length;s++){const mat=mats[s];if(!mat||!mat.passes)continue;
     for(let p=0;p<mat.passes.length;p++){const pass=mat.passes[p];if(!pass)continue;consider(rr,mat,pass,p,s,false);if(isHot(rr,s))consider(rr,mat,pass,p,s,true);}}}
   const kids=node.children||[];for(let i=0;i<kids.length;i++)walk(kids[i]);};
  walk(root);for(let i=0;i<hot.length;i++)enqueue(hot[i]);for(let i=0;i<cold.length;i++)enqueue(cold[i]);}}
function onFrame():void{
 frames++;if(held)return;if(skipNext){skipNext=false;sailSkips++;return;}
 if(scanIn<=0){absorb();scanIn=SCAN_EVERY;}else scanIn--;
 if(compiled>=jobs.length){if(jobs.length&&!logged){logged=true;try{console.info('[QF_SHADER_WARM] '+JSON.stringify({compiled,frames,sailSkips,pending:0}));}catch{/* log only */}}return;}
 logged=false;const plan=meadowWarmPlan(jobs.length-kicked,kicked-compiled);if(plan.ms>maxFrameMs)maxFrameMs=plan.ms;
 let filled=false;
 if(plan.compiles&&compiled<kicked){compileItem(jobs[compiled]);compiled++;filled=true;}
 if(plan.kicks&&kicked<jobs.length){const item=jobs[kicked];
  if(kickCompiledPass(item.pass))kicked++;
  else if(!filled){compileItem(item);kicked++;compiled++;}
  else kicked++;}}
/** Idempotent. No frame clock → the sail path stays as it is. Never blocks the caller. */
export function beginTransitionShaderWarm():void{
 if(listening)return;const d:any=director;if(!d||typeof d.on!=='function'||typeof d.off!=='function')return;listening=true;
 d.on('director_after_draw',onFrame);off=()=>{try{d.off('director_after_draw',onFrame);}catch{/* already */}};}
export function watchTransitionRoot(node:Node|null):void{beginTransitionShaderWarm();remember(node);}
/** The next warm step (sail set-off) kicks and compiles nothing. */
export function noteTransitionSailFrame():void{skipNext=true;}
export function transitionWarmStats():TransitionWarmStats{return {frames,sailSkips,kicked,compiled,pending:Math.max(0,jobs.length-compiled),maxFrameMs,done:jobs.length>0&&compiled>=jobs.length};}
/** Test hook. Production does not call this from the camera. */
export function holdTransitionShaders(on:boolean):void{held=on;}
export function resetTransitionShaderWarm():void{if(off){const f=off;off=null;f();}roots.length=0;jobs.length=0;seen.length=0;kicked=0;compiled=0;frames=0;sailSkips=0;maxFrameMs=0;skipNext=false;held=false;scanIn=0;listening=false;logged=false;}
