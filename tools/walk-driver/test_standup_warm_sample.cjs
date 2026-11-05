'use strict';
/** Strategy C standup-only isolation: warmSampleStandUp on sit→stand trigger (short window),
 *  NOT in bindVisual; no armStandupShaderBurst; TransitionShaderWarm untouched. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..','..');
const S=path.join(ROOT,'creator-build-project/assets/scripts');
const ts=process.env.QF_TYPESCRIPT_MODULE?require(process.env.QF_TYPESCRIPT_MODULE):require('../qf-env.cjs').typescript();
const G=require('./glb_rig.cjs');
const {load}=require('../camera-frame-test/load_ts.cjs');
const M=load();const W=M.WorldFlowCore;
const tx=src=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const motion={};vm.runInNewContext(tx(fs.readFileSync(path.join(S,'CharacterMotion.ts'),'utf8')),{exports:motion,Math,Float64Array,RegExp,Object,Array,String,Number,isFinite});
const bootSrc=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');
const adSrc=fs.readFileSync(path.join(S,'region/RegionJourneyAdapter.ts'),'utf8');
const warmSrc=fs.readFileSync(path.join(S,'region/TransitionShaderWarm.ts'),'utf8');
const balloonSrc=fs.readFileSync(path.join(S,'region/BalloonTransit.ts'),'utf8');
const skyBg=fs.readFileSync(path.join(S,'region/SkycityBoardBackground.ts'),'utf8');
const skyLive=fs.readFileSync(path.join(S,'region/SkycityBoardLive.ts'),'utf8');
const cmSrc=fs.readFileSync(path.join(S,'CharacterMotion.ts'),'utf8');

/* Static isolation gates */
assert.match(bootSrc,/warmSampleStandUp/);
assert.match(bootSrc,/standup-warm-sample/);
assert.match(adSrc,/warmSampleStandUp/);

/* StandupProgramWarm COUNT16/15/3: present, isolated from TSW, wired in boot (not balloon) */
const spwSrc=fs.readFileSync(path.join(S,'region/StandupProgramWarm.ts'),'utf8');
assert.match(spwSrc,/STANDUP_MORPH_APRON\s*=\s*16/);
assert.match(spwSrc,/STANDUP_MORPH_DRESS\s*=\s*15/);
assert.match(spwSrc,/STANDUP_MORPH_BOW\s*=\s*3/);
assert.doesNotMatch(spwSrc,/STANDUP_MORPH_COUNT\s*=\s*53/);
assert.doesNotMatch(spwSrc,/from\s+['"]\.\/TransitionShaderWarm['"]/);
assert.doesNotMatch(spwSrc,/\barmStandupShaderBurst\s*\(|export\s+function\s+armStandupShaderBurst/);
assert.match(bootSrc,/armStandupProgramWarm|stepStandupProgramWarm|flushStandupProgramWarmBeforeStand/);
assert.doesNotMatch(balloonSrc,/StandupProgramWarm|armStandupProgramWarm/);
assert.match(cmSrc,/maxCalls\?:number/);
assert.match(cmSrc,/起身段无整表清零重写/);
assert.match(cmSrc,/MORPH_EPS/);
const hasBurstWiring=(s)=>/\barmStandupShaderBurst\s*\(|import\s*\{[^}]*armStandupShaderBurst|export\s+function\s+armStandupShaderBurst|armStandupShaderBurst\s*=/.test(s);
assert.equal(hasBurstWiring(bootSrc),false);
assert.equal(hasBurstWiring(adSrc),false);
assert.equal(hasBurstWiring(warmSrc),false);
assert.doesNotMatch(warmSrc,/warmSampleStandUp/);
assert.doesNotMatch(balloonSrc,/warmSampleStandUp/);
assert.doesNotMatch(skyBg,/warmSampleStandUp/);
assert.doesNotMatch(skyLive,/warmSampleStandUp/);
const bindSnip=bootSrc.slice(bootSrc.indexOf('bindVisual(visual:Node)'),bootSrc.indexOf('private requireClip'));
assert.doesNotMatch(bindSnip,/warmSampleStandUp/,'warmSample must NOT run in bindVisual');
const pb=bootSrc.slice(bootSrc.indexOf("if(action.kind==='stand')"),bootSrc.indexOf("if(action.kind==='stand')")+500);
assert.match(pb,/warmSampleStandUp/);
assert.doesNotMatch(pb,/repairStates|requireDirectTrsStates|new AnimRig/);
assert.doesNotMatch(pb,/armStandupShaderBurst/);
assert.match(adSrc,/warmSampleStandUp\?\.?\(\{restoreMorph:false\}\)/);

const classText=bootSrc.slice(bootSrc.indexOf('/** Explicit flow-reference stand-in.'),bootSrc.indexOf("@ccclass('WorldIntegrationBoot')"));
const standupWarmStub={armed:false,pending:0,warmed:0,frames:0,lastLabel:'',bagReady:true,count53:false};
const ctx={...motion,REF:M.CharacterReference.CHARACTER_REFERENCE,Cancelled:W.Cancelled,AnimationClip:{WrapMode:{Loop:2,Normal:1}},SkeletalAnimation:function(){},MeshRenderer:function MeshRenderer(){},pointOnPath:W.pointOnPath,
 armStandupProgramWarm:(v)=>{standupWarmStub.armed=true;standupWarmStub.pending=6;standupWarmStub.bagReady=true;standupWarmStub.count53=false;return standupWarmStub;},
 stepStandupProgramWarm:(n)=>{const take=Math.min(n||2,standupWarmStub.pending);standupWarmStub.pending-=take;standupWarmStub.warmed+=take;standupWarmStub.frames++;return Object.assign({},standupWarmStub);},
 flushStandupProgramWarmBeforeStand:(max)=>ctx.stepStandupProgramWarm(max||2),
 standupProgramWarmStats:()=>Object.assign({},standupWarmStub),
 STANDUP_WARM_PER_FRAME:2,STANDUP_MORPH_BUDGET_FIRST:12,STANDUP_MORPH_BUDGET_FRAMES:4,
 exports:{},console,Date,Math,Number,Float64Array,Error,Promise,globalThis:{}};
vm.runInNewContext(tx(classText+'\nexports.Standin=FlowReferenceStandin;'),ctx);
const Standin=ctx.exports.Standin;
const pick=()=>{for(const p of [process.env.WALK_GLB,'/workspace/yiqifengle/previews/角色动画bot/walk-v1/chr_b_r5g2_walk-v1_TEST.glb',path.join(ROOT,'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')])if(p&&fs.existsSync(p))return p;throw Error('no walk glb');};
const GLB=pick();
const metaCandidates=[path.join(path.dirname(GLB),'anim_meta.json'),path.join(ROOT,'creator-build-project/assets/bundles/region_island/character/anim_meta.json')];
const META=JSON.parse(fs.readFileSync(metaCandidates.find(p=>fs.existsSync(p)),'utf8'));
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
 assert.ok(warm.ok,'warm ok');assert.ok(warm.samples>=4&&warm.samples<=8,'short-window samples got '+warm.samples);
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
 const out={status:'PASS',strategy:'C_standup_only_isolation',warm,deltaWarm2:delta,first3,warmEvents:ev.length,repairedStates:repaired1.length,glb:path.basename(GLB),
  isolation:{bindVisual:false,performStand:true,lakeside:true,armStandupShaderBurst:false,TransitionShaderWarm:false,StandupProgramWarm:true,COUNT16_15_3:true,COUNT53:false},
  stack:'6fd22962 COUNT16/15 GLB+meta / integrate 6bd40657',acceptance:'standup feel / frame marks — NOT setCamera/board=0 veto'};
 console.log(JSON.stringify(out,null,1));
})().catch(e=>{console.error(e);process.exitCode=1;});
