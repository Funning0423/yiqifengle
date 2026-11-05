/**
 * Standup-only GPU program warm for CC_USE_SKINNING|CC_USE_MORPH|CC_MORPH_TARGET_COUNT53.
 *
 * Independent of TransitionShaderWarm: do NOT import TSW, do NOT call its standup burst API,
 * do NOT enqueue into TSW critical/hold/burst. Spreads getProgramVariant / getShaderVariant
 * across sit_hold frames (1–2 / frame) so sit→stand does not live-compile the COUNT53 family.
 *
 * Acceptance = Funning phone standup feel. Mac setCamera/board=0 is NOT a veto (CONTROL_FAIL_NOISE).
 */
import {Node,director,isValid} from 'cc';
import * as ccmod from 'cc';

export const STANDUP_MORPH_COUNT=53;
/** Variants compiled per advance tick while priming. */
export const STANDUP_WARM_PER_FRAME=2;
/** Soft cap on frames spent priming (safety; queue is usually shorter). */
export const STANDUP_WARM_MAX_FRAMES=8;
/** MorphDriver setWeight budget for the first STANDUP_MORPH_BUDGET_FRAMES of stand_up. */
export const STANDUP_MORPH_BUDGET_FIRST=12;
export const STANDUP_MORPH_BUDGET_FRAMES=4;

export type StandupWarmDefines=Record<string,unknown>;
export type StandupWarmJob={
 key:string;
 program:string;
 defines:StandupWarmDefines;
 patches:{name:string;value:boolean|number}[]|null;
 pass:any|null;
 label:string;
};

export type StandupWarmStats={
 armed:boolean;
 pending:number;
 warmed:number;
 frames:number;
 lastLabel:string;
 count53:boolean;
};

type Patch={name:string;value:boolean|number};

const INVALID_PHASE=0xFFFFFFFF;
let jobs:StandupWarmJob[]=[];
let cursor=0;
let warmed=0;
let frames=0;
let armed=false;
let lastLabel='';
let rootRef:Node|null=null;

/** COUNT53 skin+morph define bag (standup-critical family). */
export function standupCount53Defines(extra?:{
 precomputed?:boolean;
 forwardAdd?:boolean;
 receiveShadow?:boolean;
 fog?:boolean;
 hdr?:boolean;
 pipeline?:boolean;
 vertexColor?:boolean;
 albedo?:boolean;
}):StandupWarmDefines{
 const d:StandupWarmDefines={
  CC_USE_SKINNING:true,
  CC_USE_REAL_TIME_JOINT_TEXTURE:false,
  CC_USE_MORPH:true,
  CC_MORPH_TARGET_COUNT:STANDUP_MORPH_COUNT,
  CC_MORPH_TARGET_HAS_POSITION:true,
 };
 if(extra?.receiveShadow!==false)d.CC_RECEIVE_SHADOW=true;
 if(extra?.precomputed)d.CC_MORPH_PRECOMPUTED=true;
 if(extra?.forwardAdd){d.CC_FORWARD_ADD=true;d.CC_IS_TRANSPARENCY_PASS=1;}
 if(extra?.fog!==false)d.CC_USE_FOG=4;
 if(extra?.hdr!==false)d.CC_USE_HDR=1;
 if(extra?.pipeline)d.CC_PIPELINE_TYPE=1;
 if(extra?.vertexColor!==false)d.USE_VERTEX_COLOR=true;
 if(extra?.albedo!==false)d.USE_ALBEDO_MAP=true;
 return d;
}

/** Synthetic fallback queue when no character materials are available (offline / early boot). */
export function buildStandupWarmQueueSynthetic():StandupWarmJob[]{
 const out:StandupWarmJob[]=[];
 const push=(program:string,defines:StandupWarmDefines,label:string)=>{
  out.push({key:label+'|'+program,program,defines,patches:null,pass:null,label});
 };
 const std='standard-vs|standard-fs';
 push(std,standupCount53Defines(),'std-count53');
 push(std,standupCount53Defines({precomputed:true}),'std-count53-pre');
 push(std,standupCount53Defines({forwardAdd:true}),'std-count53-fwd');
 push(std,standupCount53Defines({pipeline:true}),'std-count53-pipe');
 push('shadow-caster-vs|shadow-caster-fs',standupCount53Defines({hdr:false,fog:true,albedo:true}),'caster-count53');
 push('planar-shadow-vs|planar-shadow-fs',standupCount53Defines({fog:false,hdr:false,albedo:true}),'planar-count53');
 push('unlit-vs:vert|unlit-fs:frag',standupCount53Defines({vertexColor:false,albedo:false,fog:true,hdr:true}),'unlit-count53');
 push('unlit-vs:vert|unlit-fs:frag',Object.assign(standupCount53Defines({vertexColor:false,albedo:false,precomputed:true}),{USE_TEXTURE:true}),'unlit-count53-pre');
 return out;
}

function programLib(pass?:any):any{
 const d:any=director,g:any=typeof globalThis==='undefined'?null:globalThis,mod:any=ccmod;
 const bags=[mod,mod&&mod.legacyCC,mod&&mod.cclegacy,d,d&&d.root,pass,pass&&pass._root,pass&&pass.root,g,g&&g.cc,g&&g.CC,g&&g.cclegacy,g&&g.legacyCC];
 for(let i=0;i<bags.length;i++){const b=bags[i];if(!b)continue;
  const lib=b.rendering&&b.rendering.programLib||b.programLib||(b.pipeline&&b.pipeline.programLib);
  if(lib&&typeof lib.getProgramVariant==='function')return lib;}
 return null;
}

function attrHit(attrs:any[],name:string):boolean{
 for(let i=0;i<attrs.length;i++){const a=attrs[i];const n=String(a&&(a.name||a)||'');if(n===name||n==='a_'+name)return true;}
 return false;
}

function morphCountOf(renderer:any,sub:number):number{
 const morph=renderer&&renderer.mesh&&renderer.mesh.struct&&renderer.mesh.struct.morph;
 const sm=morph&&morph.subMeshMorphs&&morph.subMeshMorphs[sub];
 return sm&&sm.targets?sm.targets.length:0;
}

function isHotRenderer(renderer:any,sub:number):boolean{
 if(renderer.skeleton||renderer.skinningRoot)return true;
 return morphCountOf(renderer,sub)>0;
}

function synthPatches(renderer:any,sub:number,forceReceive:boolean,forcePre:boolean):Patch[]{
 const out:Patch[]=[];
 if(forceReceive||renderer.receiveShadow)out.push({name:'CC_RECEIVE_SHADOW',value:true});
 if(renderer.skeleton||renderer.skinningRoot){
  out.push({name:'CC_USE_SKINNING',value:true});
  out.push({name:'CC_USE_REAL_TIME_JOINT_TEXTURE',value:false});
 }
 const morph=renderer.mesh&&renderer.mesh.struct&&renderer.mesh.struct.morph;
 const sm=morph&&morph.subMeshMorphs&&morph.subMeshMorphs[sub];
 if(sm&&sm.targets&&sm.targets.length){
  const attrs=sm.attributes||[];
  const count=sm.targets.length>=STANDUP_MORPH_COUNT?STANDUP_MORPH_COUNT:sm.targets.length;
  out.push({name:'CC_USE_MORPH',value:true});
  out.push({name:'CC_MORPH_TARGET_COUNT',value:count});
  if(attrHit(attrs,'position'))out.push({name:'CC_MORPH_TARGET_HAS_POSITION',value:true});
  if(attrHit(attrs,'normal'))out.push({name:'CC_MORPH_TARGET_HAS_NORMAL',value:true});
  const pre=forcePre||!!(morph&&(morph.precomputedWeights||morph.usePrecomputedWeights||sm.precomputedWeights||renderer.usePrecomputedMorph||renderer.precomputedMorph));
  if(pre)out.push({name:'CC_MORPH_PRECOMPUTED',value:true});
 }
 return out;
}

function livePatches(renderer:any,sub:number):Patch[]{
 const model=renderer.model,subs=model&&(model.subModels||model._subModels),one=subs&&subs[sub],raw=one&&(one.patches||one._patches);
 if(!raw||!raw.length)return [];
 const out:Patch[]=[];for(let i=0;i<raw.length;i++)if(raw[i]&&raw[i].name)out.push({name:String(raw[i].name),value:raw[i].value});
 return out;
}

function mergePatches(a:Patch[],b:Patch[]):Patch[]{
 const out:Patch[]=[],have:string[]=[];
 for(let i=0;i<a.length;i++){out.push(a[i]);have.push(a[i].name);}
 for(let i=0;i<b.length;i++)if(have.indexOf(b[i].name)<0){out.push(b[i]);have.push(b[i].name);}
 return out;
}

function effectOf(mat:any):string{return String(mat&&(mat.effectName||(mat.effectAsset&&mat.effectAsset.name))||'fx');}
function passNameOf(pass:any,index:number):string{return String(pass&&(pass.programName||pass._programName||pass.program)||('p'+index));}

function patchesHaveCount53(patches:Patch[]):boolean{
 for(let i=0;i<patches.length;i++){
  if(patches[i].name==='CC_MORPH_TARGET_COUNT'&&Number(patches[i].value)===STANDUP_MORPH_COUNT)return true;
 }
 return false;
}

function forceCount53(patches:Patch[]):Patch[]{
 const out=patches.slice();let hit=false;
 for(let i=0;i<out.length;i++)if(out[i].name==='CC_MORPH_TARGET_COUNT'){out[i]={name:'CC_MORPH_TARGET_COUNT',value:STANDUP_MORPH_COUNT};hit=true;}
 if(!hit)out.push({name:'CC_MORPH_TARGET_COUNT',value:STANDUP_MORPH_COUNT});
 let morph=false,skin=false,pos=false;
 for(let i=0;i<out.length;i++){
  if(out[i].name==='CC_USE_MORPH')morph=true;
  if(out[i].name==='CC_USE_SKINNING')skin=true;
  if(out[i].name==='CC_MORPH_TARGET_HAS_POSITION')pos=true;
 }
 if(!morph)out.push({name:'CC_USE_MORPH',value:true});
 if(!skin){out.push({name:'CC_USE_SKINNING',value:true});out.push({name:'CC_USE_REAL_TIME_JOINT_TEXTURE',value:false});}
 if(!pos)out.push({name:'CC_MORPH_TARGET_HAS_POSITION',value:true});
 return out;
}

/** Collect COUNT53 skin+morph jobs from a character visual root (MeshRenderer tree). */
export function collectStandupWarmJobs(root:Node|null):StandupWarmJob[]{
 const out:StandupWarmJob[]=[],seen:string[]=[];
 if(!root||!isValid(root,true))return out;
 const take=(renderer:any,mat:any,pass:any,index:number,sub:number,forcePre:boolean)=>{
  if(!isHotRenderer(renderer,sub))return;
  const count=morphCountOf(renderer,sub);
  // Prefer real COUNT53 meshes; also force-count53 on any skinned+morph so standup keys land.
  if(count>0&&count!==STANDUP_MORPH_COUNT&&count<16)return;
  let patches=mergePatches(livePatches(renderer,sub),synthPatches(renderer,sub,true,forcePre));
  patches=forceCount53(patches);
  if(forcePre){
   let pre=false;for(let i=0;i<patches.length;i++)if(patches[i].name==='CC_MORPH_PRECOMPUTED')pre=true;
   if(!pre)patches.push({name:'CC_MORPH_PRECOMPUTED',value:true});
  }
  const prog=passNameOf(pass,index);
  const key=effectOf(mat)+'|'+prog+'|pre='+(forcePre?'1':'0')+'|sub='+sub;
  if(seen.indexOf(key)>=0)return;seen.push(key);
  const defines:StandupWarmDefines={};
  for(let i=0;i<patches.length;i++)defines[patches[i].name]=patches[i].value;
  out.push({key,program:prog,defines,patches,pass,label:(forcePre?'pre:':'')+effectOf(mat)+'|'+prog});
 };
 const walk=(node:any)=>{
  if(!node)return;
  const comps=node.components||node._components||[];
  for(let c=0;c<comps.length;c++){
   const r=comps[c];if(!r||!r.sharedMaterials)continue;
   const mats=r.sharedMaterials;
   for(let s=0;s<mats.length;s++){
    const mat=mats[s];if(!mat)continue;
    const passes=mat.passes||[];
    for(let p=0;p<passes.length;p++){
     const pass=passes[p];if(!pass)continue;
     take(r,mat,pass,p,s,false);
     take(r,mat,pass,p,s,true);
    }
   }
  }
  const kids=node.children||[];
  for(let i=0;i<kids.length;i++)walk(kids[i]);
 };
 walk(root);
 return out;
}

function shaderNameOf(sh:any):string{
 return String(sh&&(sh.name||sh._name||(sh.shader&&(sh.shader.name||sh.shader._name)))||'');
}

function compileJob(job:StandupWarmJob):boolean{
 const pass=job.pass;
 if(pass&&typeof pass.getShaderVariant==='function'){
  try{
   const sh=pass.getShaderVariant(job.patches&&job.patches.length?job.patches:null);
   const nm=shaderNameOf(sh);
   if(nm&&(nm.indexOf('CC_MORPH_TARGET_COUNT53')>=0||nm.indexOf('CC_USE_MORPH')>=0))return true;
   if(sh)return true;
  }catch{/* fall through to lib */}
 }
 const lib=programLib(pass);
 if(!lib)return false;
 const device=pass&&(pass.device||pass._device)||((director as any).root&&(director as any).root.device);
 const phase=pass?(pass.phaseID!==undefined?pass.phaseID:pass._phaseID):0;
 if(device==null||typeof phase!=='number'||phase===INVALID_PHASE){
  // Synthetic job without a live pass: still poke the lib with phase 0 when device exists.
  if(device==null)return false;
 }
 const name=job.program||(pass&&(pass.program||pass._programName||pass.programName))||'';
 if(!name)return false;
 try{
  const prog=lib.getProgramVariant(device,phase===INVALID_PHASE?0:phase,name,job.defines);
  return !!prog;
 }catch{return false;}
}

/** Arm multi-frame COUNT53 warm against a character visual (or synthetic fallback). Idempotent. */
export function armStandupProgramWarm(visual?:Node|null):StandupWarmStats{
 const root=visual&&isValid(visual,true)?visual:rootRef;
 if(root&&isValid(root,true))rootRef=root;
 let next=root?collectStandupWarmJobs(root):[];
 if(!next.length)next=buildStandupWarmQueueSynthetic();
 // Keep existing progress if same queue length and still armed; else reset.
 if(!armed||jobs.length!==next.length){
  jobs=next;cursor=0;warmed=0;frames=0;lastLabel='';
 }
 armed=true;
 return standupProgramWarmStats();
}

/** Compile up to `n` pending COUNT53 variants (default STANDUP_WARM_PER_FRAME). */
export function stepStandupProgramWarm(n:number=STANDUP_WARM_PER_FRAME):StandupWarmStats{
 if(!armed)return standupProgramWarmStats();
 if(frames>=STANDUP_WARM_MAX_FRAMES&&cursor>=jobs.length)return standupProgramWarmStats();
 frames++;
 const budget=Math.max(1,n|0);
 let filled=0;
 while(filled<budget&&cursor<jobs.length){
  const job=jobs[cursor++];
  lastLabel=job.label;
  if(compileJob(job))warmed++;
  filled++;
 }
 return standupProgramWarmStats();
}

/** Drain a few remaining jobs right before sit→stand (never the whole queue at once). */
export function flushStandupProgramWarmBeforeStand(max:number=2):StandupWarmStats{
 if(!armed)armStandupProgramWarm(rootRef);
 return stepStandupProgramWarm(max);
}

export function standupProgramWarmStats():StandupWarmStats{
 const pending=Math.max(0,jobs.length-cursor);
 let count53=false;
 for(let i=0;i<jobs.length;i++){
  const d=jobs[i].defines;
  if(Number(d.CC_MORPH_TARGET_COUNT)===STANDUP_MORPH_COUNT&&d.CC_USE_SKINNING&&d.CC_USE_MORPH){count53=true;break;}
  const p=jobs[i].patches;
  if(p&&patchesHaveCount53(p)){count53=true;break;}
 }
 return {armed,pending,warmed,frames,lastLabel,count53};
}

export function resetStandupProgramWarm():void{
 jobs=[];cursor=0;warmed=0;frames=0;armed=false;lastLabel='';rootRef=null;
}

/** True when the module never touches TransitionShaderWarm symbols (static contract for tests). */
export function standupProgramWarmIsolatedFromTsw(sourceText:string):boolean{
 const burst='armStandup'+'ShaderBurst';
 if(new RegExp('\\b'+burst+'\\s*\\(').test(sourceText))return false;
 if(/from\s+['"]\.\/TransitionShaderWarm['"]/.test(sourceText))return false;
 const banned=['beginTransition'+'ShaderWarm','holdTransition'+'Shaders','resetTransition'+'ShaderWarm','armTransition'+'ShaderWarm'];
 for(let i=0;i<banned.length;i++)if(new RegExp('\\b'+banned[i]+'\\b').test(sourceText))return false;
 return true;
}
