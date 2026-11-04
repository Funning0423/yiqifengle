'use strict';
/** STANDUP-PERF runtime: warmSampleStandUp pose+morph before stand_up; MorphDriver EPS; no AnimRig rebuild on stand. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..','..');
const S=path.join(ROOT,'creator-build-project/assets/scripts');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const G=require('./glb_rig.cjs');
const {load}=require('../camera-frame-test/load_ts.cjs');
const M=load();const W=M.WorldFlowCore;
const tx=src=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const motion={};vm.runInNewContext(tx(fs.readFileSync(path.join(S,'CharacterMotion.ts'),'utf8')),{exports:motion,Math,Float64Array,RegExp,Object,Array,String,Number,isFinite});
const bootSrc=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');
const classText=bootSrc.slice(bootSrc.indexOf('/** Explicit flow-reference stand-in.'),bootSrc.indexOf("@ccclass('WorldIntegrationBoot')"));
const ctx={...motion,REF:M.CharacterReference.CHARACTER_REFERENCE,Cancelled:W.Cancelled,AnimationClip:{WrapMode:{Loop:2,Normal:1}},SkeletalAnimation:function(){},MeshRenderer:function MeshRenderer(){},pointOnPath:W.pointOnPath,exports:{},console,Date,Math,Number,Float64Array,Error,Promise,globalThis:{}};
vm.runInNewContext(tx(classText+'\nexports.Standin=FlowReferenceStandin;'),ctx);
const Standin=ctx.exports.Standin;
const pick=()=>{for(const p of [process.env.WALK_GLB,'/workspace/yiqifengle/previews/角色动画bot/walk-v1/chr_b_r5g2_walk-v1_TEST.glb',path.join(ROOT,'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')])if(p&&fs.existsSync(p))return p;throw Error('no walk glb');};
const GLB=pick();const META=JSON.parse(fs.readFileSync(path.join(path.dirname(GLB),'anim_meta.json'),'utf8'));
const mockRenderer=(name,counts=[32])=>({node:{name},mesh:{name,struct:{morph:{subMeshMorphs:counts.map(n=>({attributes:['a_position'],targets:new Array(n).fill(0).map(()=>({displacements:[]}))})),targetNames:[]}}},
 enableMorph:true,calls:[],w:{},setWeight(w,sub,shape){this.calls.push([w,sub,shape]);this.w[sub+':'+shape]=w;}});
class Token{constructor(){this.l=new Set();this.cancelled=false;}check(){if(this.cancelled)throw new W.Cancelled();}onCancel(f){if(this.cancelled)f();else this.l.add(f);return()=>this.l.delete(f);}cancel(){this.cancelled=true;for(const f of [...this.l])f();}}
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const rig=G.loadRig(GLB);const clipDefs=Object.keys(rig.clips).map(k=>({name:k,duration:rig.clips[k].duration,apply:t=>G.applyClip(rig.clips[k],t)}));
 const states=new Map();
 const anim={node:rig.root,clips:clipDefs,useBakedAnimation:true,getState(n){if(states.has(n))return states.get(n);const c=clipDefs.find(x=>x.name===n);return c?this.createState(c,n):null;},
  createState(c,n){const st={clip:c,time:0,playing:false,setTime(t){this.time=t;},sample(){c.apply(this.time);},stop(){this.playing=false;},pause(){},play(){this.playing=true;}};states.set(n,st);return st;},play(n){this.getState(n).play();}};
 const node={active:true,worldPosition:{x:0,y:0,z:0},yaw:0,setWorldPosition(x,y,z){this.worldPosition={x,y,z};},setRotationFromEuler(a,b){this.yaw=b*Math.PI/180;},destroy(){}};
 const ap=mockRenderer('LOD0_G2_APRON'),dr=mockRenderer('LOD0_G2_DRESS'),body=mockRenderer('LOD0_G2_BODY',[16]);
 const s=new Standin(node);s.setAnimMeta(META);s.bindVisual({getComponent:()=>anim,getComponentInChildren:()=>null,getComponentsInChildren:()=>[body,ap,dr]});
 s.setWindSource(()=>0);
 const seat={seatedControllerRoot:[0,0,0],standingControllerRoot:[0,0,.494],yawRad:0};
 s.cancelAndReset({kind:'seated',seat});for(let i=0;i<20;i++)s.advance(1/60);
 const repaired0=(s.diagnostics().motion.repairedStates||[]).slice();
 const warm=s.warmSampleStandUp({restoreMorph:false});
 assert.ok(warm.ok,'warm ok');assert.ok(warm.samples>=12,'samples');
 const mid=ap.calls.length+dr.calls.length;
 const warm2=s.warmSampleStandUp({restoreMorph:false});
 const delta=ap.calls.length+dr.calls.length-mid;
 assert.ok(warm2.ok);assert.ok(delta<=mid,'second warm mostly EPS-skip delta='+delta+' first='+mid);
 const sp=s.perform({kind:'stand',seat},new Token());
 let first3=0;for(let i=0;i<3;i++){const b=ap.calls.length+dr.calls.length;s.advance(1/60);await flush();first3+=ap.calls.length+dr.calls.length-b;}
 for(let i=0;i<90;i++){s.advance(1/60);await flush();}await sp;
 const repaired1=s.diagnostics().motion.repairedStates||[];
 assert.deepEqual(repaired1,repaired0,'AnimRig.repaired must not grow on sit→stand');
 const ev=(s.diagnostics().events||[]).filter(e=>e&&e.kind==='standup-warm-sample');
 assert.ok(ev.length>=2,'standup-warm-sample events');
 assert.ok(first3<200,'first3 setWeight '+first3);
 const boot=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');
 const pb=boot.slice(boot.indexOf("if(action.kind==='stand')"),boot.indexOf("if(action.kind==='stand')")+400);
 assert.doesNotMatch(pb,/repairStates|requireDirectTrsStates|new AnimRig/);
 console.log(JSON.stringify({status:'PASS',warm,deltaWarm2:delta,first3,warmEvents:ev.length,repairedStates:repaired1.length,glb:path.basename(GLB)},null,1));
})().catch(e=>{console.error(e);process.exitCode=1;});
