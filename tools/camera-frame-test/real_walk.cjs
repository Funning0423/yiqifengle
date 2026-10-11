'use strict';
/** --real-walk: GGbot's REAL walk driver (FlowReferenceStandin from WorldIntegrationBoot.ts + CharacterMotion.ts, walk GLB
 * evaluated by tools/walk-driver/glb_rig.cjs) as the flow_sim character, so camera tracks follow the driver's own
 * walkProgress() (distance-driven) and her root/yaw come from the driven node. Setup mirrors tools/walk-driver/test_walk_driver.cjs.
 * env WALK_GLB (default: the committed repo character GLB = walk_loop v2 since int/v1 c38c880). */
const fs=require('fs'),path=require('path'),vm=require('vm');
function create(M,W){const ROOT=path.resolve(__dirname,'..','..'),S=path.join(ROOT,'creator-build-project/assets/scripts');
  const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript()),G=require('../walk-driver/glb_rig.cjs');
  const tx=src=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const motion={};vm.runInNewContext(tx(fs.readFileSync(path.join(S,'CharacterMotion.ts'),'utf8')),{exports:motion,Math,Float64Array,RegExp,Object,Array,String,Number,isFinite});
  const boot=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');const cls=boot.slice(boot.indexOf('/** Explicit flow-reference stand-in.'),boot.indexOf("@ccclass('WorldIntegrationBoot')"));
  const ctx={...motion,REF:M.CharacterReference.CHARACTER_REFERENCE,Cancelled:W.Cancelled,AnimationClip:{WrapMode:{Loop:2,Normal:1}},SkeletalAnimation:function(){},pointOnPath:W.pointOnPath,exports:{},console,Date,Math,Number,Float64Array,Error,Promise,globalThis:{}};
  vm.runInNewContext(tx(cls+'\nexports.Standin=FlowReferenceStandin;'),ctx);
  const P='/workspace/yiqifengle/previews/角色动画bot/';const glb=[process.env.WALK_GLB,path.join(ROOT,'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb'),P+'walk-v2/chr_b_r5g2_walk-v2_TEST.glb'].find(p=>p&&fs.existsSync(p));
  const mp=path.join(path.dirname(glb),'anim_meta.json'),meta=fs.existsSync(mp)?JSON.parse(fs.readFileSync(mp,'utf8')):null;
  const rig=G.loadRig(glb),clips=Object.keys(rig.clips).map(k=>({name:k,duration:rig.clips[k].duration,apply:t=>G.applyClip(rig.clips[k],t)})),states=new Map();
  const anim={node:rig.root,clips,useBakedAnimation:true,getState(n){if(states.has(n))return states.get(n);const c=clips.find(x=>x.name===n);return c?this.createState(c,n):null;},
    createState(c,n){const st={clip:c,time:0,playing:false,setTime(t){this.time=t;},sample(){c.apply(this.time);},stop(){this.playing=false;},pause(){},play(){this.playing=true;}};states.set(n,st);return st;},play(n){this.getState(n).play();}};
  const node={active:true,worldPosition:{x:0,y:0,z:0},yaw:0,setWorldPosition(x,y,z){this.worldPosition={x,y,z};},setRotationFromEuler(a,b,c){this.yaw=b*Math.PI/180;},destroy(){}};
  const s=new ctx.exports.Standin(node);s.setAnimMeta(meta);s.bindVisual({getComponent:()=>anim,getComponentInChildren:()=>null});
  return {standin:s,node,glb:path.relative(path.join(ROOT,'..','..'),glb)};}
module.exports={create};
