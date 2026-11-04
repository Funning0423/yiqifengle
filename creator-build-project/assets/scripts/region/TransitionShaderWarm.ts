import {Node,director,isValid} from 'cc';
import * as ccmod from 'cc';
import {MEADOW_WARM_BUDGET_MS,kickCompiledPass,meadowWarmPlan} from './MeadowSailWarm';
/** b20: animateCamera PASS still left world.setCamera B1 at 647ms/102 shaders on 2672b080, and the experience
 *  felt like slow-mo. setCamera createShader names carry FOG4/cascaded/HDR/SHADOWMAP_* / PCF2 but NOT CC_SHADOW_TYPE2
 *  (0/40). Warm that forced SHADOW_TYPE=2 filled a different live-cache key than the draw path. Also marking every
 *  builtin-standard as critical ballooned pending/criticalPending to 500–1200 and kept compiling every frame.
 *  Fix: warm BOTH bags (with TYPE2 for animateCamera, without for setCamera); mark cached on the shared PCF2 bag;
 *  critical = skin/morph + vertex-color + second-UV only; non-critical warm yields while criticalPending>0.
 *  Mac 81c841d4: residual setCamera 446ms/12 was ALL builtin-unlit+morph (53/16/3/73±PRECOMPUTED), not standard/PCF2.
 *  Departure shadow bags miss that key. Also tries>12 critical stayed !cached → criticalPending 300–680 forever and
 *  every frame recompiled Invalid reflect-map during board-bg (490ms/0 shaders). Fix: warm unlit/planar live macros;
 *  exhaust critical after tries; skip warm for a few heavy board/reveal frames.
 *  Funning tip: sit→stand_up is the first stutter. Live createShader at fr123–184 carries
 *  CC_DIR_LIGHT_SHADOW_TYPE1 on skin+morph (53/16/3/73±PRECOMPUTED) while warm bags omitted it,
 *  so animateCamera / leaveHome still live-compiled. Also force PRECOMPUTED for standard hot,
 *  mark USE_ALPHA_TEST critical (node-lens), and burst critical before stand_up. */
export const MAC_MORPH_COUNTS:readonly number[]=[53,16,3,73];
/** Exact pipeline macros on every Mac createShader name at meadow→skycity animateCamera frame 1803.
 *  0 is omitted from the program key, so a boot compile that only writes PCF still misses SHADOWMAP_FORMAT / LINEAR_DEPTH. */
export const DEPARTURE_SHADOW_MACROS:readonly {name:string;value:number}[]=[
 {name:'CC_USE_FOG',value:4},
 {name:'CC_SUPPORT_CASCADED_SHADOW_MAP',value:1},
 {name:'CC_USE_HDR',value:1},
 {name:'CC_SHADOWMAP_FORMAT',value:1},
 {name:'CC_SHADOWMAP_USE_LINEAR_DEPTH',value:1},
 {name:'CC_DIR_SHADOW_PCF_TYPE',value:2},
 {name:'CC_SHADOW_TYPE',value:2},
];
/** Mac leaveHome/stand_up createShader names also carry the dir-light shadow type (omitted from key when 0). */
export const DIR_LIGHT_SHADOW_MACROS:readonly {name:string;value:number}[]=[
 {name:'CC_DIR_LIGHT_SHADOW_TYPE',value:1},
];
export function withDirLightBag(bag:readonly {name:string;value:number}[]):{name:string;value:number}[]{
 const out:{name:string;value:number}[]=[];for(let i=0;i<bag.length;i++)out.push(bag[i]);
 for(let i=0;i<DIR_LIGHT_SHADOW_MACROS.length;i++){const n=DIR_LIGHT_SHADOW_MACROS[i].name;let hit=false;
  for(let j=0;j<out.length;j++)if(out[j].name===n){out[j]=DIR_LIGHT_SHADOW_MACROS[i];hit=true;break;}
  if(!hit)out.push(DIR_LIGHT_SHADOW_MACROS[i]);}
 return out;}
/** setCamera B1 Mac names: same bag but CC_SHADOW_TYPE omitted (0 is dropped from the program key). */
export const SETCAM_SHADOW_MACROS:readonly {name:string;value:number}[]=[
 {name:'CC_USE_FOG',value:4},
 {name:'CC_SUPPORT_CASCADED_SHADOW_MAP',value:1},
 {name:'CC_USE_HDR',value:1},
 {name:'CC_SHADOWMAP_FORMAT',value:1},
 {name:'CC_SHADOWMAP_USE_LINEAR_DEPTH',value:1},
 {name:'CC_DIR_SHADOW_PCF_TYPE',value:2},
];
/** Mac setCamera residual unlit names: FOG4+HDR only (no PCF/SHADOWMAP/TYPE). Planar-shadow passes omit these. */
export const LIVE_UNLIT_MACROS:readonly {name:string;value:number}[]=[
 {name:'CC_USE_FOG',value:4},
 {name:'CC_USE_HDR',value:1},
];
/** Shared createShader needles (coverage / docs). CC_SHADOW_TYPE2 is optional. */
export const SPIKE_NAME_NEEDLES:readonly string[]=[
 'CC_DIR_SHADOW_PCF_TYPE2','CC_SHADOWMAP_FORMAT1','CC_SHADOWMAP_USE_LINEAR_DEPTH1',
 'CC_SUPPORT_CASCADED_SHADOW_MAP1','CC_USE_HDR1','CC_USE_FOG4',
 'CC_MORPH_TARGET_COUNT53','CC_MORPH_TARGET_COUNT16','CC_MORPH_TARGET_COUNT3','CC_MORPH_TARGET_COUNT73','CC_MORPH_PRECOMPUTED1',
 'CC_USE_SKINNING1','CC_RECEIVE_SHADOW1','USE_VERTEX_COLOR1','CC_FORWARD_ADD1','reflect-map-fs','CC_PIPELINE_TYPE1',
];
/** criticalPending only waits on needles the warm can actually land. reflect/fwd/pipe Invalid forever on device. */
export const CRITICAL_CACHE_NEEDLES:readonly string[]=[
 'CC_DIR_SHADOW_PCF_TYPE2','CC_SHADOWMAP_FORMAT1','CC_SHADOWMAP_USE_LINEAR_DEPTH1',
 'CC_SUPPORT_CASCADED_SHADOW_MAP1','CC_USE_HDR1','CC_USE_FOG4',
 'CC_MORPH_TARGET_COUNT53','CC_MORPH_TARGET_COUNT16','CC_MORPH_TARGET_COUNT3','CC_MORPH_TARGET_COUNT73','CC_MORPH_PRECOMPUTED1',
 'CC_USE_SKINNING1','CC_RECEIVE_SHADOW1',
];
const SEEN_CAP=4000;
const SCAN_EVERY=10;
const INVALID_PHASE=0xFFFFFFFF;
export const CRITICAL_PER_FRAME=3;
/** sit→stand_up / leaveHome animateCamera window: drain skin+morph faster than the steady 3/frame. */
export const STANDUP_CRITICAL_PER_FRAME=8;
export const STANDUP_BURST_FRAMES=200;
const FWD_PATCHES:readonly {name:string;value:number}[]=[{name:'CC_FORWARD_ADD',value:1},{name:'CC_IS_TRANSPARENCY_PASS',value:1}];
const PIPE_PATCHES:readonly {name:string;value:number}[]=[{name:'CC_PIPELINE_TYPE',value:1}];
export function reflectProgramName(name:string):string{
 if(!name||name.indexOf('standard-fs')<0)return '';
 return name.replace('standard-fs','reflect-map-fs');
}
export function shaderShowsDeparture(name:string):boolean{
 if(!name)return false;
 return name.indexOf('CC_DIR_SHADOW_PCF_TYPE2')>=0
  &&name.indexOf('CC_SHADOWMAP_FORMAT1')>=0&&name.indexOf('CC_SHADOWMAP_USE_LINEAR_DEPTH1')>=0
  &&name.indexOf('CC_SUPPORT_CASCADED_SHADOW_MAP1')>=0;}
export function shaderShowsSetcam(name:string):boolean{
 return shaderShowsDeparture(name)&&name.indexOf('CC_SHADOW_TYPE2')<0;}
export function shaderShowsAnimate(name:string):boolean{
 return shaderShowsDeparture(name)&&name.indexOf('CC_SHADOW_TYPE2')>=0;}
export function nameFromDefines(program:string,defines:Record<string,unknown>|null):string{
 const parts:string[]=[program||''],src=defines||{},keys=Object.keys(src);
 for(let i=0;i<keys.length;i++){const v=src[keys[i]];if(v===0||v===false||v==='0'||v===undefined)continue;
  parts.push(keys[i]+(v===true||v===1?'1':String(v)));}
 return parts.join('|');}
/** getProgramVariant Object.assign's pipeline.macros then keys the live cache. Force the given bag onto that object. */
export function withAssignMacros<T>(bag:readonly {name:string;value:number}[],run:()=>T):T{
 const oa=Object.assign;
 const wrapped=function(target:any){const out=oa.apply(this,arguments);
  if(out&&typeof out==='object'){let hit=false;for(let i=1;i<arguments.length;i++){const s=arguments[i];
   if(s&&typeof s==='object'&&(s.CC_DIR_SHADOW_PCF_TYPE!==undefined||s.CC_SHADOW_TYPE!==undefined||s.CC_USE_HDR!==undefined||s.CC_USE_FOG!==undefined||s.CC_SUPPORT_CASCADED_SHADOW_MAP!==undefined||s.CC_SHADOWMAP_FORMAT!==undefined||s.CC_SHADOWMAP_USE_LINEAR_DEPTH!==undefined||s.CC_DIR_LIGHT_SHADOW_TYPE!==undefined)){hit=true;break;}}
   if(hit){for(let m=0;m<bag.length;m++)out[bag[m].name]=bag[m].value;
    if(!bag.some(x=>x.name==='CC_SHADOW_TYPE')&&Object.prototype.hasOwnProperty.call(out,'CC_SHADOW_TYPE'))delete out.CC_SHADOW_TYPE;}}
  return out;};
 Object.assign=wrapped as typeof Object.assign;
 try{return run();}finally{Object.assign=oa;}}
export function withAssignDeparture<T>(run:()=>T):T{return withAssignMacros(DEPARTURE_SHADOW_MACROS,run);}
export function withAssignSetcam<T>(run:()=>T):T{return withAssignMacros(SETCAM_SHADOW_MACROS,run);}
export function withMacrosBag<T>(bag:readonly {name:string;value:number}[],macros:Record<string,unknown>|null,run:()=>T):T{
 if(!macros)return run();
 const saved:{name:string;had:boolean;value:unknown}[]=[];
 for(let i=0;i<bag.length;i++){const n=bag[i].name;const had=Object.prototype.hasOwnProperty.call(macros,n);
  saved.push({name:n,had,value:macros[n]});macros[n]=bag[i].value;}
 const hadType=Object.prototype.hasOwnProperty.call(macros,'CC_SHADOW_TYPE');const typeVal=macros.CC_SHADOW_TYPE;
 if(!bag.some(x=>x.name==='CC_SHADOW_TYPE')&&hadType)delete macros.CC_SHADOW_TYPE;
 try{return run();}finally{for(let i=0;i<saved.length;i++){const s=saved[i];if(s.had)macros[s.name]=s.value;else delete macros[s.name];}
  if(!bag.some(x=>x.name==='CC_SHADOW_TYPE')){if(hadType)macros.CC_SHADOW_TYPE=typeVal;else delete macros.CC_SHADOW_TYPE;}}
}
export function withDepartureMacros<T>(macros:Record<string,unknown>|null,run:()=>T):T{return withMacrosBag(DEPARTURE_SHADOW_MACROS,macros,run);}
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
type Item={key:string;pass:any;patches:Patch[]|null;hot:boolean;depart:boolean;critical:boolean;unlit:boolean;program:string;effect:string;cached:boolean;exhausted:boolean;tries:number};
export type TransitionWarmStats={frames:number;sailSkips:number;kicked:number;compiled:number;pending:number;criticalPending:number;maxFrameMs:number;done:boolean};
export function isCriticalWarm(hot:boolean,defines:Record<string,unknown>|null,_effect?:string,_passName?:string):boolean{
 if(hot)return true;const d=defines||{};
 // setCamera spike + girl: vertex-color / second-UV / alpha-test (node-lens foliage) / skin-morph only — not every builtin-standard.
 return !!(d.USE_VERTEX_COLOR||d.HAS_SECOND_UV||d.USE_ALPHA_TEST);}
export function morphPatches(count:number,hasPosition:boolean,precomputed:boolean=false):Patch[]{
 const p:Patch[]=[{name:'CC_USE_MORPH',value:true},{name:'CC_MORPH_TARGET_COUNT',value:count}];
 if(hasPosition)p.push({name:'CC_MORPH_TARGET_HAS_POSITION',value:true});
 if(precomputed)p.push({name:'CC_MORPH_PRECOMPUTED',value:true});return p;}
export function effectLooksUnlit(effect:string,program:string):boolean{
 const s=(effect||'')+'|'+(program||'');
 return s.indexOf('builtin-unlit')>=0||s.indexOf('unlit-vs')>=0||s.indexOf('unlit-fs')>=0||s.indexOf('planar-shadow')>=0;}
export function shaderShowsUnlitHot(name:string):boolean{
 if(!name||name.indexOf('CC_USE_SKINNING1')<0||name.indexOf('CC_USE_MORPH1')<0)return false;
 return name.indexOf('builtin-unlit')>=0||name.indexOf('unlit-vs')>=0||name.indexOf('planar-shadow')>=0;}
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
  const pre=!!(morph&&(morph.precomputedWeights||morph.usePrecomputedWeights||sm.precomputedWeights||renderer.usePrecomputedMorph||renderer.precomputedMorph));
  const m=morphPatches(sm.targets.length,pos,pre);for(let i=0;i<m.length;i++)out.push(m[i]);
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
  stats:()=>({frames,sailSkips,kicked,compiled,pending:items.length-compiled,criticalPending:0,maxFrameMs,done:compiled>=items.length}),
  dispose(){dead=true;}};}
const roots:Node[]=[];const jobs:Item[]=[];const seen:string[]=[];const cachedNames:string[]=[];
let kicked=0,compiled=0,frames=0,sailSkips=0,maxFrameMs=0,skipNext=false,skipLeft=0,held=false,holdDepth=0,armHoldLeft=0,armHoldArmed=false,burstLeft=0,scanIn=0,listening=false,logged=false,off:(()=>void)|null=null;
function remember(node:Node|null):void{if(!node||!isValid(node,true))return;if(roots.indexOf(node)>=0)return;roots.push(node);scanIn=0;}
function pipelineOf(obj:any):any{return obj&&(obj.pipeline||obj._pipeline)||null;}
function programLib(pass?:any):any{
 const d:any=director,g:any=typeof globalThis==='undefined'?null:globalThis,mod:any=ccmod;
 const bags=[mod,mod&&mod.legacyCC,mod&&mod.cclegacy,d,d&&d.root,pass,pass&&pass._root,pass&&pass.root,g,g&&g.cc,g&&g.CC,g&&g.cclegacy,g&&g.legacyCC];
 for(let i=0;i<bags.length;i++){const b=bags[i];if(!b)continue;
  const lib=b.rendering&&b.rendering.programLib||b.programLib||(b.pipeline&&b.pipeline.programLib);
  if(lib&&typeof lib.getProgramVariant==='function')return lib;}
 return null;}
function addPipe(out:any[],pipe:any):void{if(pipe&&out.indexOf(pipe)<0)out.push(pipe);}
function collectPipes(pass?:any):any[]{
 const out:any[]=[],d:any=director,g:any=typeof globalThis==='undefined'?null:globalThis;
 addPipe(out,d&&d.root&&d.root.pipeline);addPipe(out,pipelineOf(d&&d.root));
 addPipe(out,pass&&(pass._root&&pass._root.pipeline||pass.root&&pass.root.pipeline));
 const lib=programLib(pass);addPipe(out,lib&&lib.pipeline);addPipe(out,pipelineOf(lib));
 addPipe(out,g&&g.cc&&g.cc.director&&g.cc.director.root&&g.cc.director.root.pipeline);
 return out;}
function pipelineMacros():Record<string,unknown>|null{const pipes=collectPipes();for(let i=0;i<pipes.length;i++){const m=pipes[i]&&pipes[i].macros;if(m&&typeof m==='object')return m;}return null;}
function macroBags(pass?:any):Record<string,unknown>[]{
 const out:Record<string,unknown>[]=[],add=(m:any)=>{if(m&&typeof m==='object'&&out.indexOf(m)<0)out.push(m);};
 const pipes=collectPipes(pass);for(let i=0;i<pipes.length;i++)add(pipes[i]&&pipes[i].macros);
 return out;}
function forceMacroPipes(bag:readonly {name:string;value:number}[],pass?:any):()=>void{
 const pipes=collectPipes(pass),bags=macroBags(pass);
 const saved:{bag:Record<string,unknown>;name:string;had:boolean;value:unknown}[]=[];
 const ints:{pipe:any;name:string}[]=[];
 const typeSnaps:{bag:Record<string,unknown>;had:boolean;value:unknown}[]=[];
 for(let b=0;b<bags.length;b++){const macros=bags[b];
  if(!bag.some(x=>x.name==='CC_SHADOW_TYPE')){typeSnaps.push({bag:macros,had:Object.prototype.hasOwnProperty.call(macros,'CC_SHADOW_TYPE'),value:macros.CC_SHADOW_TYPE});delete macros.CC_SHADOW_TYPE;}
  for(let i=0;i<bag.length;i++){const n=bag[i].name,had=Object.prototype.hasOwnProperty.call(macros,n);
   saved.push({bag:macros,name:n,had,value:macros[n]});macros[n]=bag[i].value;}}
 for(let p=0;p<pipes.length;p++){const pipe=pipes[p];if(!pipe||typeof pipe.setMacroInt!=='function')continue;
  for(let i=0;i<bag.length;i++){const n=bag[i].name;try{pipe.setMacroInt(n,bag[i].value);ints.push({pipe,name:n});}catch{/* setter optional */}}}
 return ()=>{for(let i=0;i<saved.length;i++){const s=saved[i];if(s.had)s.bag[s.name]=s.value;else delete s.bag[s.name];}
  for(let i=0;i<typeSnaps.length;i++){const t=typeSnaps[i];if(t.had)t.bag.CC_SHADOW_TYPE=t.value;else delete t.bag.CC_SHADOW_TYPE;}
  for(let i=0;i<ints.length;i++){const it=ints[i],v=it.pipe.macros&&it.pipe.macros[it.name];try{if(typeof it.pipe.setMacroInt==='function'&&v!==undefined)it.pipe.setMacroInt(it.name,v);}catch{/* restore optional */}}};
}
function forceDeparturePipes(pass?:any):()=>void{return forceMacroPipes(DEPARTURE_SHADOW_MACROS,pass);}
function forceSetcamPipes(pass?:any):()=>void{return forceMacroPipes(SETCAM_SHADOW_MACROS,pass);}

function passBlend(pass:any):boolean{const t=pass&&pass.blendState&&pass.blendState.targets;if(!t||!t.length)return false;for(let i=0;i<t.length;i++)if(t[i]&&t[i].blend)return true;return false;}
function defineCopy(pass:any,patches:Patch[]|null,bag:readonly {name:string;value:number}[]=DEPARTURE_SHADOW_MACROS):Record<string,unknown>{
 const src=pass&&(pass.defines||pass._defines)||{},out:Record<string,unknown>={},keys=Object.keys(src);
 for(let i=0;i<keys.length;i++)out[keys[i]]=src[keys[i]];
 if(patches)for(let i=0;i<patches.length;i++)out[patches[i].name]=patches[i].value;
 if(passBlend(pass))out.CC_IS_TRANSPARENCY_PASS=1;
 if(!bag.some(x=>x.name==='CC_SHADOW_TYPE'))delete out.CC_SHADOW_TYPE;
 for(let i=0;i<bag.length;i++)out[bag[i].name]=bag[i].value;
 return out;}
function snapshotOwn(src:any):Record<string,unknown>|null{if(!src)return null;const out:Record<string,unknown>={},keys=Object.keys(src);for(let i=0;i<keys.length;i++)out[keys[i]]=src[keys[i]];return out;}
function restoreOwn(dst:any,snap:Record<string,unknown>|null):void{
 if(!dst||!snap)return;const now=Object.keys(dst);
 for(let i=0;i<now.length;i++)if(!Object.prototype.hasOwnProperty.call(snap,now[i]))delete dst[now[i]];
 const back=Object.keys(snap);for(let i=0;i<back.length;i++)dst[back[i]]=snap[back[i]];}
function writeDefines(d:any,patches:Patch[]|null,bag:readonly {name:string;value:number}[]=DEPARTURE_SHADOW_MACROS):void{
 if(!d)return;if(patches)for(let i=0;i<patches.length;i++)d[patches[i].name]=patches[i].value;
 if(!bag.some(x=>x.name==='CC_SHADOW_TYPE'))delete d.CC_SHADOW_TYPE;
 for(let i=0;i<bag.length;i++)d[bag[i].name]=bag[i].value;}
function shaderNameOf(sh:any):string{return String(sh&&(sh.name||sh._name||(sh.shader&&(sh.shader.name||sh.shader._name)))||'');}
function rememberName(name:string):void{if(!name||cachedNames.indexOf(name)>=0)return;cachedNames.push(name);}
function needlesMissing():number{let n=0;for(let i=0;i<CRITICAL_CACHE_NEEDLES.length;i++){const need=CRITICAL_CACHE_NEEDLES[i];let hit=false;
 for(let k=0;k<cachedNames.length;k++)if(cachedNames[k].indexOf(need)>=0){hit=true;break;}if(!hit)n++;}return n;}
function markCached(item:Item,name:string):void{
 if(!shaderShowsDeparture(name)&&!shaderShowsUnlitHot(name))return;item.cached=true;rememberName(name);}
function markDone(item:Item,name:string=''):void{
 if(name)rememberName(name);item.cached=true;item.exhausted=false;}
function compileLive(item:Item):void{
 const pass=item.pass,patches=item.patches;
 if(!pass||typeof pass.getShaderVariant!=='function'){if(pass&&typeof pass.tryCompile==='function'){try{pass.tryCompile();}catch{/* miss */}}return;}
 try{const sh=pass.getShaderVariant(patches&&patches.length?patches:null);const nm=shaderNameOf(sh);if(nm){rememberName(nm);if(shaderShowsUnlitHot(nm)||shaderShowsDeparture(nm))item.cached=true;}}
 catch{const d=pass.defines||pass._defines;if(d&&patches)for(let i=0;i<patches.length;i++){try{delete d[patches[i].name];}catch{/* leave */}}}}
function withAssignUnlit<T>(run:()=>T):T{return withAssignMacros(LIVE_UNLIT_MACROS,run);}
function forceUnlitPipes(pass?:any):()=>void{return forceMacroPipes(LIVE_UNLIT_MACROS,pass);}
function compileUnlitLive(item:Item):void{
 const pass=item.pass;if(!pass)return;
 const prog=String(item.program||pass.program||pass._programName||pass.programName||'');
 const planar=prog.indexOf('planar-shadow')>=0||String(pass.programName||'').indexOf('planar-shadow')>=0;
 if(planar){compileLive(item);return;}
 const got=compileOneBag(item,LIVE_UNLIT_MACROS,withAssignUnlit,forceUnlitPipes);
 if(got){rememberName(got);if(shaderShowsUnlitHot(got)||got.indexOf('CC_USE_MORPH')>=0||got.indexOf('USE_TEXTURE')>=0)markDone(item,got);}
 else compileLive(item);}
function compileViaLib(item:Item,name:string,bag:readonly {name:string;value:number}[]):string{
 const pass=item.pass,lib=programLib(pass);if(!lib||!name)return '';
 const phase=pass.phaseID!==undefined?pass.phaseID:pass._phaseID,device=pass.device||pass._device||((director as any).root&&(director as any).root.device);
 if(device==null||typeof phase!=='number'||phase===INVALID_PHASE)return '';
 const defines=defineCopy(pass,item.patches,bag);
 try{const prog=lib.getProgramVariant(device,phase,name,defines);if(!prog)return '';return shaderNameOf(prog)||nameFromDefines(name,defines);}catch{return '';}}
function bagPatches(item:Item,bag:readonly {name:string;value:number}[]):Patch[]{
 const extra:Patch[]=[];for(let i=0;i<bag.length;i++)extra.push({name:bag[i].name,value:bag[i].value});
 return item.patches&&item.patches.length?mergePatches(item.patches,extra):extra;}
function compileOneBag(item:Item,bag:readonly {name:string;value:number}[],assign:(run:()=>void)=>void,force:(pass?:any)=>()=>void):string{
 const pass=item.pass;if(!pass)return '';
 const restore=force(pass),d=pass.defines||pass._defines,snap=snapshotOwn(d),shader=pass._shader;
 let got='';
 assign(()=>{
  writeDefines(d,item.patches,bag);pass._shader=null;
  try{const patches=bagPatches(item,bag);
   if(typeof pass.getShaderVariant==='function'){try{got=shaderNameOf(pass.getShaderVariant(patches));}catch{/* miss */}}
   if(!shaderShowsDeparture(got)&&!shaderShowsUnlitHot(got)&&typeof pass.tryCompile==='function'){try{pass.tryCompile();got=shaderNameOf(pass._shader);}catch{/* miss */}}
   const name=item.program||pass.program||pass._programName||pass.programName;const via=compileViaLib(item,String(name||''),bag);
   if(shaderShowsDeparture(via)||shaderShowsUnlitHot(via))got=via;}
  finally{restoreOwn(d,snap);pass._shader=shader;restore();}});
 return got;}
function compileDeparture(item:Item):void{
 // animateCamera bag (TYPE2) then setCamera bag (no TYPE2) — both must land in the live program cache.
 const a=compileOneBag(item,DEPARTURE_SHADOW_MACROS,withAssignDeparture,forceDeparturePipes);
 if(shaderShowsDeparture(a))markCached(item,a);
 const b=compileOneBag(item,SETCAM_SHADOW_MACROS,withAssignSetcam,forceSetcamPipes);
 if(shaderShowsDeparture(b))markCached(item,b);
 // stand_up / leaveHome live keys also include CC_DIR_LIGHT_SHADOW_TYPE1 when the sun casts shadows.
 if(item.hot||item.critical){
  const dBag=withDirLightBag(DEPARTURE_SHADOW_MACROS),sBag=withDirLightBag(SETCAM_SHADOW_MACROS);
  const c=compileOneBag(item,dBag,run=>withAssignMacros(dBag,run),pass=>forceMacroPipes(dBag,pass));
  if(shaderShowsDeparture(c))markCached(item,c);
  const d=compileOneBag(item,sBag,run=>withAssignMacros(sBag,run),pass=>forceMacroPipes(sBag,pass));
  if(shaderShowsDeparture(d))markCached(item,d);}}
function compileItem(item:Item):void{
 if(item.unlit||effectLooksUnlit(item.effect,item.program)){compileUnlitLive(item);return;}
 if(item.depart){compileDeparture(item);
  // Mac board-bg: reflect-map-fs / fwd / pipe families log Invalid forever and never cache — one miss exhausts.
  if(!item.cached&&(item.key.indexOf('reflect~')>=0||item.key.indexOf('fwd~')>=0||item.key.indexOf('pipe~')>=0))exhaustItem(item);
  return;}
 compileLive(item);}
function enqueueAt(item:Item,front:boolean):void{
 if(seen.indexOf(item.key)>=0||seen.length>=SEEN_CAP)return;seen.push(item.key);
 if(!front){jobs.push(item);return;}
 const rest=jobs.splice(kicked);jobs.push(item);for(let i=0;i<rest.length;i++)jobs.push(rest[i]);}
function criticalPending():number{let n=needlesMissing();for(let i=0;i<jobs.length;i++)if(jobs[i].critical&&!jobs[i].cached&&!jobs[i].exhausted)n++;return n;}
function exhaustItem(item:Item):void{item.exhausted=true;item.tries=Math.max(item.tries,13);}
function absorb():void{
 for(let r=roots.length-1;r>=0;r--){const root=roots[r];if(!isValid(root,true)){roots.splice(r,1);continue;}
  const crit:Item[]=[],depart:Item[]=[],hot:Item[]=[],cold:Item[]=[];
  const take=(renderer:any,mat:any,pass:any,index:number,sub:number,force:boolean,departFlag:boolean,extra:readonly {name:string;value:number}[]|null,program:string,tag:string)=>{
   const fx=effectOf(mat),prog=program||passName(pass,index);
   const patches=mergePatches(mergePatches(livePatches(renderer,sub),synthPatches(renderer,sub,force)),extra?extra as Patch[]:[]);
   const base=transitionPassKey(fx,prog,pass&&pass.defines||null,patches);
   const hotFlag=isHot(renderer,sub),unlit=effectLooksUnlit(fx,prog);
   // Unlit hot must be critical on the LIVE path (draw macros), not only depart+shadow.
   const critical=(unlit?(!departFlag&&hotFlag):departFlag)&&isCriticalWarm(hotFlag,pass&&pass.defines||null,fx,prog);
   const item:Item={key:(departFlag?'depart~':'live~')+tag+base,pass,patches:patches.length?patches:null,hot:hotFlag,depart:departFlag,critical,unlit,program:prog,effect:fx,cached:false,exhausted:false,tries:0};
   if(critical)crit.push(item);else if(departFlag)depart.push(item);else if(hotFlag)hot.push(item);else cold.push(item);};
  const families=(renderer:any,mat:any,pass:any,index:number,sub:number,force:boolean)=>{
   const fx=effectOf(mat),pn=passName(pass,index),unlit=effectLooksUnlit(fx,pn),hotNow=isHot(renderer,sub);
   take(renderer,mat,pass,index,sub,force,false,null,'','');
   // Mac residual: morph 73 (±standard) drew with CC_MORPH_PRECOMPUTED1 during stand_up/animateCamera — warm even if mesh flags omit it.
   if(hotNow)take(renderer,mat,pass,index,sub,force,false,[{name:'CC_MORPH_PRECOMPUTED',value:1} as any],'','pre~');
   if(!unlit)take(renderer,mat,pass,index,sub,force,true,null,'','');
   if(!unlit&&hotNow)take(renderer,mat,pass,index,sub,force,true,[{name:'CC_MORPH_PRECOMPUTED',value:1} as any],'','pre~');
   if(unlit||!isCriticalWarm(hotNow,pass&&pass.defines||null,fx,pn))return;
   take(renderer,mat,pass,index,sub,force,true,FWD_PATCHES,'','fwd~');
   take(renderer,mat,pass,index,sub,force,true,PIPE_PATCHES,'','pipe~');
   if(hotNow){take(renderer,mat,pass,index,sub,force,true,mergePatches(FWD_PATCHES as any,[{name:'CC_MORPH_PRECOMPUTED',value:1} as any]),'','fwd-pre~');
    take(renderer,mat,pass,index,sub,force,true,mergePatches(PIPE_PATCHES as any,[{name:'CC_MORPH_PRECOMPUTED',value:1} as any]),'','pipe-pre~');}
   const name=String(pass.program||pass._programName||pass.programName||'');const alt=reflectProgramName(name);
   if(alt){take(renderer,mat,pass,index,sub,force,true,null,alt,'reflect~');
    if(hotNow)take(renderer,mat,pass,index,sub,force,true,[{name:'CC_MORPH_PRECOMPUTED',value:1} as any],alt,'reflect-pre~');}};
  const walk=(node:any)=>{
   if(!node)return;
   const comps=node.components||node._components||[];
   for(let c=0;c<comps.length;c++){const rr=comps[c];if(!rr||!rr.sharedMaterials)continue;
    const mats=rr.sharedMaterials;
    for(let s=0;s<mats.length;s++){const mat=mats[s];if(!mat||!mat.passes)continue;
     for(let p=0;p<mat.passes.length;p++){const pass=mat.passes[p];if(!pass)continue;
      families(rr,mat,pass,p,s,false);if(isHot(rr,s))families(rr,mat,pass,p,s,true);}}}
   const kids=node.children||[];
   for(let i=0;i<kids.length;i++)walk(kids[i]);
  };
  walk(root);
  for(let i=crit.length-1;i>=0;i--)enqueueAt(crit[i],true);
  for(let i=depart.length-1;i>=0;i--)enqueueAt(depart[i],true);
  for(let i=hot.length-1;i>=0;i--)enqueueAt(hot[i],true);
  for(let i=0;i<cold.length;i++)enqueueAt(cold[i],false);}}
function onFrame():void{
 frames++;
 // Bridge hold (B5→board / prime): countdown on after_draw; absorb still runs so city materials enqueue without compile.
 if(armHoldArmed){if(armHoldLeft>0)armHoldLeft--;if(armHoldLeft<=0){armHoldArmed=false;holdTransitionShaders(false);scanIn=0;if(burstLeft<60)burstLeft=60;}}
 // While held: never compile. Still honor heavy-frame skips (flight/B1 note) so absorb cannot stack onto setCamera LONGs.
 // Only absorb on quiet held frames (B5→board bridge) so city mats enqueue before reveal.
 if(held){if(skipNext||skipLeft>0){if(skipNext)skipNext=false;if(skipLeft>0)skipLeft--;sailSkips++;return;}
  if(scanIn<=0){absorb();scanIn=SCAN_EVERY;}else scanIn--;sailSkips++;return;}
 if(skipNext||skipLeft>0){if(skipNext)skipNext=false;if(skipLeft>0)skipLeft--;sailSkips++;return;}
 if(scanIn<=0){absorb();scanIn=SCAN_EVERY;}else scanIn--;
 const pending=Math.max(0,jobs.length-compiled),crit=criticalPending();
 if(compiled>=jobs.length&&!crit){if(jobs.length&&!logged){logged=true;try{console.info('[QF_SHADER_WARM] '+JSON.stringify({compiled,frames,sailSkips,pending:0,criticalPending:0,cached:cachedNames.length}));}catch{/* log only */}}return;}
 logged=false;const plan=meadowWarmPlan(jobs.length-kicked,kicked-compiled);if(plan.ms>maxFrameMs)maxFrameMs=plan.ms;
 let filled=0;const budget=burstLeft>0?STANDUP_CRITICAL_PER_FRAME:CRITICAL_PER_FRAME;if(burstLeft>0)burstLeft--;
 // While critical work remains, only compile critical — non-critical thrash caused the slow-mo feel.
 if(plan.compiles&&compiled<kicked&&!(crit&&!jobs[compiled].critical)){compileItem(jobs[compiled]);compiled++;filled++;}
 while(filled<budget&&kicked<jobs.length&&jobs[kicked].critical){const item=jobs[kicked];
  if(item.cached||item.exhausted){kicked++;compiled++;continue;}
  compileItem(item);item.tries++;
  if(item.cached){kicked++;compiled++;}
  else if(item.tries>12){exhaustItem(item);kicked++;compiled++;}
  filled++;}
 if(!crit&&kicked<jobs.length&&!jobs[kicked].critical){const item=jobs[kicked];
  if(kickCompiledPass(item.pass))kicked++;
  else if(!filled){compileItem(item);kicked++;compiled++;}
  else kicked++;}
 else if(crit&&kicked<jobs.length&&!jobs[kicked].critical){kicked++;}
 if(crit&&filled<budget){for(let i=0;i<jobs.length&&filled<budget;i++){
  if(!jobs[i].critical||jobs[i].cached||jobs[i].exhausted)continue;
  compileItem(jobs[i]);jobs[i].tries++;if(jobs[i].tries>12&&!jobs[i].cached)exhaustItem(jobs[i]);filled++;}}
 if(crit&&frames%60===0){try{console.info('[QF_SHADER_WARM] '+JSON.stringify({compiled,frames,sailSkips,pending,criticalPending:crit,cached:cachedNames.length,burstLeft}));}catch{/* log only */}}}
/** Idempotent. No frame clock → the sail path stays as it is. Never blocks the caller. */
export function beginTransitionShaderWarm():void{
 if(listening)return;const d:any=director;if(!d||typeof d.on!=='function'||typeof d.off!=='function')return;listening=true;
 d.on('director_after_draw',onFrame);off=()=>{try{d.off('director_after_draw',onFrame);}catch{/* already */}};}
export function watchTransitionRoot(node:Node|null):void{beginTransitionShaderWarm();remember(node);absorb();}
/** The next warm step (sail set-off) kicks and compiles nothing. */
export function noteTransitionSailFrame():void{skipNext=true;}
/** Skip warm compiles for the next n after_draw frames (board reveal / setCamera heavy window). */
export function noteTransitionHeavyFrames(n:number=3):void{if(n>skipLeft)skipLeft=n|0;}
export function transitionWarmStats():TransitionWarmStats{return {frames,sailSkips,kicked,compiled,pending:Math.max(0,jobs.length-compiled),criticalPending:criticalPending(),maxFrameMs,done:jobs.length>0&&compiled>=jobs.length&&criticalPending()===0};}
/** Test hook. Production does not call this from the camera. */
export function holdTransitionShaders(on:boolean):void{if(on)holdDepth++;else if(holdDepth>0)holdDepth--;held=holdDepth>0;}
/** Hold warm compiles for n after_draw frames (refcount). Use to bridge B5→board without a compile window. */
export function armTransitionHold(n:number=12):void{
 const want=n|0;if(want<=0)return;if(want>armHoldLeft)armHoldLeft=want;
 if(armHoldArmed)return;armHoldArmed=true;holdTransitionShaders(true);}
export function cachedWarmNames():string[]{const out:string[]=[];for(let i=0;i<cachedNames.length;i++)out.push(cachedNames[i]);return out;}
/** Raise critical drain for the next n after_draw frames (sit→stand_up / leaveHome). Does not hold the camera. */
export function armStandupShaderBurst(n:number=STANDUP_BURST_FRAMES):void{
 const want=n|0;if(want>burstLeft)burstLeft=want;beginTransitionShaderWarm();scanIn=0;absorb();}
export function resetTransitionShaderWarm():void{if(off){const f=off;off=null;f();}roots.length=0;jobs.length=0;seen.length=0;cachedNames.length=0;kicked=0;compiled=0;frames=0;sailSkips=0;maxFrameMs=0;skipNext=false;skipLeft=0;held=false;holdDepth=0;armHoldLeft=0;armHoldArmed=false;burstLeft=0;scanIn=0;listening=false;logged=false;}
