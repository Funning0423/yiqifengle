import {Node,director,isValid} from 'cc';
import {MEADOW_WARM_BUDGET_MS,kickCompiledPass,meadowWarmPlan} from './MeadowSailWarm';
/** b20: meadow→skycity world.animateCamera compiled ~70 builtin-standard variants in one frame
 *  (Mac 46e2c3ff frame 1839, 613 ms). Boot warm had already compiled the girl (morph 53/16/3, skinning) without
 *  CC_DIR_SHADOW_PCF_TYPE2; the camera frame was the first compile of that same set plus the room's vertex-color
 *  standards under CC_DIR_SHADOW_PCF_TYPE2 and CC_SHADOW_TYPE2. getProgramVariant copies pipeline.macros over the
 *  pass defines, so a patch cannot override a live 0. This schedules one variant per frame and, for each pass,
 *  also compiles the departure macro set (those two forced on the pipeline for that one call only, then restored).
 *  It does not wait on the camera and it does not change walk speed, fidelity, or which meshes draw. */
export const MAC_MORPH_COUNTS:readonly number[]=[53,16,3];
/** Exact pipeline macros on the meadow→skycity animateCamera spike. 0 is omitted from the program key, so a boot compile at HARD/none does not hit SOFT_2X. */
export const DEPARTURE_SHADOW_MACROS:readonly {name:string;value:number}[]=[
 {name:'CC_DIR_SHADOW_PCF_TYPE',value:2},
 {name:'CC_SHADOW_TYPE',value:2},
];
const SEEN_CAP=4000;
const SCAN_EVERY=10;
const INVALID_PHASE=0xFFFFFFFF;
export function withDepartureMacros<T>(macros:Record<string,unknown>|null,run:()=>T):T{
 if(!macros)return run();
 const saved:{name:string;had:boolean;value:unknown}[]=[];
 for(let i=0;i<DEPARTURE_SHADOW_MACROS.length;i++){const n=DEPARTURE_SHADOW_MACROS[i].name;const had=Object.prototype.hasOwnProperty.call(macros,n);
  saved.push({name:n,had,value:macros[n]});macros[n]=DEPARTURE_SHADOW_MACROS[i].value;}
 try{return run();}finally{for(let i=0;i<saved.length;i++){const s=saved[i];if(s.had)macros[s.name]=s.value;else delete macros[s.name];}}
}
export function departureAlreadyLive(macros:Record<string,unknown>|null):boolean{
 if(!macros)return false;
 for(let i=0;i<DEPARTURE_SHADOW_MACROS.length;i++){const n=DEPARTURE_SHADOW_MACROS[i].name;if(Number(macros[n])!==DEPARTURE_SHADOW_MACROS[i].value)return false;}
 return true;
}
/** Pipeline macros are part of the program key. A shadow-type change compiles again, still one variant per frame. */
function macroStamp():string{
 try{const scene:any=director.getScene();const sh=scene&&scene.globals&&scene.globals.shadows;if(!sh)return 'none';
  let light='';const sun=typeof scene.getChildByName==='function'?scene.getChildByName('Main Light'):null;const comps=sun&&sun.components||[];
  for(let i=0;i<comps.length;i++){const c=comps[i];if(c&&typeof c.shadowEnabled==='boolean')light=(c.shadowEnabled?'1':'0')+':'+String(c.shadowPcf);}
  return String(sh.type)+'/'+(sh.enabled?'1':'0')+'/'+light;}catch{return 'none';}}
type Patch={name:string;value:boolean|number};
type Item={key:string;pass:any;patches:Patch[]|null;hot:boolean;depart:boolean};
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
function pipelineMacros():Record<string,unknown>|null{const d:any=director,pipe=d&&d.root&&d.root.pipeline,m=pipe&&pipe.macros;return m&&typeof m==='object'?m:null;}
function programLib():any{
 const d:any=director,g:any=typeof globalThis==='undefined'?null:globalThis;
 const bags=[d,d&&d.root,g,g&&g.cc,g&&g.CC,g&&g.cclegacy];
 for(let i=0;i<bags.length;i++){const lib=bags[i]&&bags[i].rendering&&bags[i].rendering.programLib;if(lib&&typeof lib.getProgramVariant==='function')return lib;}
 const pipe=d&&d.root&&d.root.pipeline,lib=pipe&&pipe.programLib;return lib&&typeof lib.getProgramVariant==='function'?lib:null;}
function macroBags():Record<string,unknown>[]{
 const out:Record<string,unknown>[]=[],add=(m:any)=>{if(m&&typeof m==='object'&&out.indexOf(m)<0)out.push(m);};
 add(pipelineMacros());const lib=programLib();add(lib&&lib.pipeline&&lib.pipeline.macros);return out;}
function underDeparture<T>(run:()=>T):T{
 const bags=macroBags(),saved:{bag:Record<string,unknown>;name:string;had:boolean;value:unknown}[]=[];
 for(let b=0;b<bags.length;b++)for(let i=0;i<DEPARTURE_SHADOW_MACROS.length;i++){const n=DEPARTURE_SHADOW_MACROS[i].name,bag=bags[b],had=Object.prototype.hasOwnProperty.call(bag,n);
  saved.push({bag,name:n,had,value:bag[n]});bag[n]=DEPARTURE_SHADOW_MACROS[i].value;}
 try{return run();}finally{for(let i=0;i<saved.length;i++){const s=saved[i];if(s.had)s.bag[s.name]=s.value;else delete s.bag[s.name];}}
}
function passBlend(pass:any):boolean{const t=pass&&pass.blendState&&pass.blendState.targets;if(!t||!t.length)return false;for(let i=0;i<t.length;i++)if(t[i]&&t[i].blend)return true;return false;}
function defineCopy(pass:any,patches:Patch[]|null):Record<string,unknown>{
 const src=pass&&(pass.defines||pass._defines)||{},out:Record<string,unknown>={},keys=Object.keys(src);
 for(let i=0;i<keys.length;i++)out[keys[i]]=src[keys[i]];
 if(patches)for(let i=0;i<patches.length;i++)out[patches[i].name]=patches[i].value;
 if(passBlend(pass))out.CC_IS_TRANSPARENCY_PASS=1;
 for(let i=0;i<DEPARTURE_SHADOW_MACROS.length;i++)out[DEPARTURE_SHADOW_MACROS[i].name]=DEPARTURE_SHADOW_MACROS[i].value;
 return out;}
function snapshotOwn(src:any):Record<string,unknown>|null{if(!src)return null;const out:Record<string,unknown>={},keys=Object.keys(src);for(let i=0;i<keys.length;i++)out[keys[i]]=src[keys[i]];return out;}
function restoreOwn(dst:any,snap:Record<string,unknown>|null):void{
 if(!dst||!snap)return;const now=Object.keys(dst);
 for(let i=0;i<now.length;i++)if(!Object.prototype.hasOwnProperty.call(snap,now[i]))delete dst[now[i]];
 const back=Object.keys(snap);for(let i=0;i<back.length;i++)dst[back[i]]=snap[back[i]];}
function compileLive(item:Item):void{
 const pass=item.pass,patches=item.patches;
 if(!pass||typeof pass.getShaderVariant!=='function'){if(pass&&typeof pass.tryCompile==='function'){try{pass.tryCompile();}catch{/* miss */}}return;}
 try{pass.getShaderVariant(patches&&patches.length?patches:null);}catch{const d=pass.defines||pass._defines;if(d&&patches)for(let i=0;i<patches.length;i++){try{delete d[patches[i].name];}catch{/* leave */}}}}
function compileDeparture(item:Item):void{
 const pass=item.pass;if(!pass)return;
 const lib=programLib(),phase=pass.phaseID!==undefined?pass.phaseID:pass._phaseID,name=pass.program||pass._programName;
 const device=pass.device||pass._device||((director as any).root&&(director as any).root.device);
 if(lib&&name&&device!=null&&typeof phase==='number'&&phase!==INVALID_PHASE){
  const defines=defineCopy(pass,item.patches);
  underDeparture(()=>{try{lib.getProgramVariant(device,phase,name,defines);}catch{/* miss */}});return;}
 const d=pass.defines||pass._defines,snap=snapshotOwn(d),shader=pass._shader;
 underDeparture(()=>{compileLive(item);});restoreOwn(d,snap);if(shader!==undefined||pass._shader)pass._shader=shader;}
function compileItem(item:Item):void{if(item.depart)compileDeparture(item);else compileLive(item);}
function enqueueAt(item:Item,front:boolean):void{
 if(seen.indexOf(item.key)>=0||seen.length>=SEEN_CAP)return;seen.push(item.key);
 if(!front){jobs.push(item);return;}
 const rest=jobs.splice(kicked);jobs.push(item);for(let i=0;i<rest.length;i++)jobs.push(rest[i]);}
function absorb():void{
 const departLive=departureAlreadyLive(pipelineMacros());
 for(let r=roots.length-1;r>=0;r--){const root=roots[r];if(!isValid(root,true)){roots.splice(r,1);continue;}
  const hot:Item[]=[],cold:Item[]=[],departHot:Item[]=[],departCold:Item[]=[];
  const take=(renderer:any,mat:any,pass:any,index:number,sub:number,force:boolean,depart:boolean)=>{
   const patches=mergePatches(livePatches(renderer,sub),synthPatches(renderer,sub,force));
   const base=transitionPassKey(effectOf(mat),passName(pass,index),pass&&pass.defines||null,patches);
   const key=(depart?'depart~':macroStamp()+'~')+base;
   const item:Item={key,pass,patches:patches.length?patches:null,hot:isHot(renderer,sub),depart};
   if(depart){if(item.hot)departHot.push(item);else departCold.push(item);}else if(item.hot)hot.push(item);else cold.push(item);};
  const walk=(node:any)=>{
   if(!node)return;
   const comps=node.components||[];
   for(let c=0;c<comps.length;c++){const rr=comps[c];if(!rr||!rr.sharedMaterials)continue;
    const mats=rr.sharedMaterials;
    for(let s=0;s<mats.length;s++){const mat=mats[s];if(!mat||!mat.passes)continue;
     for(let p=0;p<mat.passes.length;p++){const pass=mat.passes[p];if(!pass)continue;
      take(rr,mat,pass,p,s,false,false);if(isHot(rr,s))take(rr,mat,pass,p,s,true,false);
      if(!departLive){take(rr,mat,pass,p,s,false,true);if(isHot(rr,s))take(rr,mat,pass,p,s,true,true);}}}}
   const kids=node.children||[];
   for(let i=0;i<kids.length;i++)walk(kids[i]);
  };
  walk(root);
  for(let i=hot.length-1;i>=0;i--)enqueueAt(hot[i],true);
  for(let i=departCold.length-1;i>=0;i--)enqueueAt(departCold[i],true);
  for(let i=departHot.length-1;i>=0;i--)enqueueAt(departHot[i],true);
  for(let i=0;i<cold.length;i++)enqueueAt(cold[i],false);}}
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
