import {Node,director,isValid} from 'cc';
import * as ccmod from 'cc';
import {MEADOW_WARM_BUDGET_MS,kickCompiledPass,meadowWarmPlan} from './MeadowSailWarm';
/** b20: Mac 8571f6d1 world.animateCamera frame 1826 still compiled 70 PCF2 variants in 611 ms after the previous
 *  tip logged pending=0 at ~132 compiles. Those 132 were the boot set (or a silent miss): getProgramVariant copies
 *  programLib.pipeline.macros over pass defines, so a patch cannot force CC_DIR_SHADOW_PCF_TYPE2, and a lib lookup
 *  that misses cc.rendering leaves the live 0 in the key. This forces those two macros on every pipeline bag we can
 *  reach (including pass._root and cc.rendering.programLib), writes them onto the pass defines for that call, and
 *  also queues the spike's extra families (forward-add, CC_PIPELINE_TYPE, reflect-map) for the girl and room
 *  vertex-color standards. Critical jobs compile up to CRITICAL_PER_FRAME times a frame from scene load. The camera
 *  track is not awaited and not held. */
export const MAC_MORPH_COUNTS:readonly number[]=[53,16,3];
/** Exact pipeline macros on the meadow→skycity animateCamera spike. 0 is omitted from the program key, so a boot compile at HARD/none does not hit SOFT_2X. */
export const DEPARTURE_SHADOW_MACROS:readonly {name:string;value:number}[]=[
 {name:'CC_DIR_SHADOW_PCF_TYPE',value:2},
 {name:'CC_SHADOW_TYPE',value:2},
];
const SEEN_CAP=4000;
const SCAN_EVERY=10;
const INVALID_PHASE=0xFFFFFFFF;
export const CRITICAL_PER_FRAME=3;
const FWD_PATCHES:readonly {name:string;value:number}[]=[{name:'CC_FORWARD_ADD',value:1},{name:'CC_IS_TRANSPARENCY_PASS',value:1}];
const PIPE_PATCHES:readonly {name:string;value:number}[]=[{name:'CC_PIPELINE_TYPE',value:1}];
export function reflectProgramName(name:string):string{
 if(!name||name.indexOf('standard-fs')<0)return '';
 return name.replace('standard-fs','reflect-map-fs');
}
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
type Item={key:string;pass:any;patches:Patch[]|null;hot:boolean;depart:boolean;critical:boolean;program:string};
export type TransitionWarmStats={frames:number;sailSkips:number;kicked:number;compiled:number;pending:number;criticalPending:number;maxFrameMs:number;done:boolean};
export function isCriticalWarm(hot:boolean,defines:Record<string,unknown>|null,effect:string,passName:string):boolean{
 if(hot)return true;const d=defines||{};if(d.USE_VERTEX_COLOR)return true;
 const n=(effect||'')+'|'+(passName||'');return n.indexOf('builtin-standard')>=0||n.indexOf('standard-vs')>=0;}
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
  stats:()=>({frames,sailSkips,kicked,compiled,pending:items.length-compiled,criticalPending:0,maxFrameMs,done:compiled>=items.length}),
  dispose(){dead=true;}};}
const roots:Node[]=[];const jobs:Item[]=[];const seen:string[]=[];
let kicked=0,compiled=0,frames=0,sailSkips=0,maxFrameMs=0,skipNext=false,held=false,scanIn=0,listening=false,logged=false,off:(()=>void)|null=null;
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
function forceDeparturePipes(pass?:any):()=>void{
 const pipes=collectPipes(pass),bags=macroBags(pass);
 const saved:{bag:Record<string,unknown>;name:string;had:boolean;value:unknown}[]=[];
 const ints:{pipe:any;name:string}[]=[];
 for(let b=0;b<bags.length;b++)for(let i=0;i<DEPARTURE_SHADOW_MACROS.length;i++){const n=DEPARTURE_SHADOW_MACROS[i].name,bag=bags[b],had=Object.prototype.hasOwnProperty.call(bag,n);
  saved.push({bag,name:n,had,value:bag[n]});bag[n]=DEPARTURE_SHADOW_MACROS[i].value;}
 for(let p=0;p<pipes.length;p++){const pipe=pipes[p];if(!pipe||typeof pipe.setMacroInt!=='function')continue;
  for(let i=0;i<DEPARTURE_SHADOW_MACROS.length;i++){const n=DEPARTURE_SHADOW_MACROS[i].name;try{pipe.setMacroInt(n,DEPARTURE_SHADOW_MACROS[i].value);ints.push({pipe,name:n});}catch{/* setter optional */}}}
 return ()=>{for(let i=0;i<saved.length;i++){const s=saved[i];if(s.had)s.bag[s.name]=s.value;else delete s.bag[s.name];}
  for(let i=0;i<ints.length;i++){const it=ints[i],v=it.pipe.macros&&it.pipe.macros[it.name];try{if(typeof it.pipe.setMacroInt==='function'&&v!==undefined)it.pipe.setMacroInt(it.name,v);}catch{/* restore optional */}}};
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
function writeDefines(d:any,patches:Patch[]|null):void{
 if(!d)return;if(patches)for(let i=0;i<patches.length;i++)d[patches[i].name]=patches[i].value;
 for(let i=0;i<DEPARTURE_SHADOW_MACROS.length;i++)d[DEPARTURE_SHADOW_MACROS[i].name]=DEPARTURE_SHADOW_MACROS[i].value;}
function compileLive(item:Item):void{
 const pass=item.pass,patches=item.patches;
 if(!pass||typeof pass.getShaderVariant!=='function'){if(pass&&typeof pass.tryCompile==='function'){try{pass.tryCompile();}catch{/* miss */}}return;}
 try{pass.getShaderVariant(patches&&patches.length?patches:null);}catch{const d=pass.defines||pass._defines;if(d&&patches)for(let i=0;i<patches.length;i++){try{delete d[patches[i].name];}catch{/* leave */}}}}
function compileViaLib(item:Item,name:string):void{
 const pass=item.pass,lib=programLib(pass);if(!lib||!name)return;
 const phase=pass.phaseID!==undefined?pass.phaseID:pass._phaseID,device=pass.device||pass._device||((director as any).root&&(director as any).root.device);
 if(device==null||typeof phase!=='number'||phase===INVALID_PHASE)return;
 const defines=defineCopy(pass,item.patches);
 try{lib.getProgramVariant(device,phase,name,defines);}catch{/* miss */}}
function compileDeparture(item:Item):void{
 const pass=item.pass;if(!pass)return;
 const restore=forceDeparturePipes(pass),d=pass.defines||pass._defines,snap=snapshotOwn(d),shader=pass._shader;
 writeDefines(d,item.patches);
 try{compileLive(item);const name=item.program||pass.program||pass._programName;compileViaLib(item,name);
  const alt=reflectProgramName(String(name||''));if(alt&&alt!==name)compileViaLib(item,alt);}
 finally{restoreOwn(d,snap);if(shader!==undefined)pass._shader=shader;else if(pass._shader)pass._shader=shader;restore();}}
function compileItem(item:Item):void{if(item.depart)compileDeparture(item);else compileLive(item);}
function enqueueAt(item:Item,front:boolean):void{
 if(seen.indexOf(item.key)>=0||seen.length>=SEEN_CAP)return;seen.push(item.key);
 if(!front){jobs.push(item);return;}
 const rest=jobs.splice(kicked);jobs.push(item);for(let i=0;i<rest.length;i++)jobs.push(rest[i]);}
function criticalPending():number{let n=0;for(let i=compiled;i<jobs.length;i++)if(jobs[i].critical)n++;return n;}
function absorb():void{
 for(let r=roots.length-1;r>=0;r--){const root=roots[r];if(!isValid(root,true)){roots.splice(r,1);continue;}
  const crit:Item[]=[],depart:Item[]=[],hot:Item[]=[],cold:Item[]=[];
  const take=(renderer:any,mat:any,pass:any,index:number,sub:number,force:boolean,departFlag:boolean,extra:readonly {name:string;value:number}[]|null,program:string,tag:string)=>{
   const patches=mergePatches(mergePatches(livePatches(renderer,sub),synthPatches(renderer,sub,force)),extra?extra as Patch[]:[]);
   const base=transitionPassKey(effectOf(mat),program||passName(pass,index),pass&&pass.defines||null,patches);
   const hotFlag=isHot(renderer,sub),critical=departFlag&&isCriticalWarm(hotFlag,pass&&pass.defines||null,effectOf(mat),program||passName(pass,index));
   const item:Item={key:(departFlag?'depart~':'live~')+tag+base,pass,patches:patches.length?patches:null,hot:hotFlag,depart:departFlag,critical,program};
   if(critical)crit.push(item);else if(departFlag)depart.push(item);else if(hotFlag)hot.push(item);else cold.push(item);};
  const families=(renderer:any,mat:any,pass:any,index:number,sub:number,force:boolean)=>{
   take(renderer,mat,pass,index,sub,force,false,null,'','');
   take(renderer,mat,pass,index,sub,force,true,null,'','');
   if(!isCriticalWarm(isHot(renderer,sub),pass&&pass.defines||null,effectOf(mat),passName(pass,index)))return;
   take(renderer,mat,pass,index,sub,force,true,FWD_PATCHES,'','fwd~');
   take(renderer,mat,pass,index,sub,force,true,PIPE_PATCHES,'','pipe~');
   const name=String(pass.program||pass._programName||pass.programName||'');const alt=reflectProgramName(name);
   if(alt)take(renderer,mat,pass,index,sub,force,true,null,alt,'reflect~');};
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
 frames++;if(held)return;if(skipNext){skipNext=false;sailSkips++;return;}
 if(scanIn<=0){absorb();scanIn=criticalPending()?0:SCAN_EVERY;}else scanIn--;
 if(compiled>=jobs.length){if(jobs.length&&!logged){logged=true;try{console.info('[QF_SHADER_WARM] '+JSON.stringify({compiled,frames,sailSkips,pending:0,criticalPending:0}));}catch{/* log only */}}return;}
 logged=false;const plan=meadowWarmPlan(jobs.length-kicked,kicked-compiled);if(plan.ms>maxFrameMs)maxFrameMs=plan.ms;
 let filled=0;
 if(plan.compiles&&compiled<kicked){compileItem(jobs[compiled]);compiled++;filled++;}
 while(filled<CRITICAL_PER_FRAME&&kicked<jobs.length&&jobs[kicked].critical){compileItem(jobs[kicked]);kicked++;compiled++;filled++;}
 if(kicked<jobs.length&&!jobs[kicked].critical){const item=jobs[kicked];
  if(kickCompiledPass(item.pass))kicked++;
  else if(!filled){compileItem(item);kicked++;compiled++;}
  else kicked++;}}
/** Idempotent. No frame clock → the sail path stays as it is. Never blocks the caller. */
export function beginTransitionShaderWarm():void{
 if(listening)return;const d:any=director;if(!d||typeof d.on!=='function'||typeof d.off!=='function')return;listening=true;
 d.on('director_after_draw',onFrame);off=()=>{try{d.off('director_after_draw',onFrame);}catch{/* already */}};}
export function watchTransitionRoot(node:Node|null):void{beginTransitionShaderWarm();remember(node);absorb();}
/** The next warm step (sail set-off) kicks and compiles nothing. */
export function noteTransitionSailFrame():void{skipNext=true;}
export function transitionWarmStats():TransitionWarmStats{return {frames,sailSkips,kicked,compiled,pending:Math.max(0,jobs.length-compiled),criticalPending:criticalPending(),maxFrameMs,done:jobs.length>0&&compiled>=jobs.length};}
/** Test hook. Production does not call this from the camera. */
export function holdTransitionShaders(on:boolean):void{held=on;}
export function resetTransitionShaderWarm():void{if(off){const f=off;off=null;f();}roots.length=0;jobs.length=0;seen.length=0;kicked=0;compiled=0;frames=0;sailSkips=0;maxFrameMs=0;skipNext=false;held=false;scanIn=0;listening=false;logged=false;}
