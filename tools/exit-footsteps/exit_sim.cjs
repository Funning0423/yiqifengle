'use strict';
/** Voice Bot: engine-free simulation of the real exit (WorldFlow.leaveHome with FirstsliceRoutes, motion mode, real wind,
 *  restAhead like WorldIntegrationBoot) at 60 fps, driving the REAL FlowReferenceStandin + CharacterMotion with the SHIPPED
 *  character GLB (region_island/character, evaluated by tools/walk-driver/glb_rig.cjs) and its anim_meta.json.
 *  Per frame: flow state, clip, controller root, lowest sole point (solePoints: shoe vertices rigid on foot.L / foot.R).
 *  Also records every onFoot event the runtime would emit. Same set-up as tools/walk-driver/test_walk_driver.cjs. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..'),S=path.join(ROOT,'creator-build-project/assets/scripts');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const G=require('../walk-driver/glb_rig.cjs');
const {load}=require(path.join(ROOT,'tools/camera-frame-test/load_ts.cjs'));
const GLB=path.join(ROOT,'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb');
const META=JSON.parse(fs.readFileSync(path.join(path.dirname(GLB),'anim_meta.json'),'utf8'));
const tx=src=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
async function simulateExit(opts={}){
  const M=load(),W=M.WorldFlowCore,fps=opts.fps||60,dt=1/fps;
  const motion={};vm.runInNewContext(tx(fs.readFileSync(path.join(S,'CharacterMotion.ts'),'utf8')),{exports:motion,Math,Float64Array,RegExp,Object,Array,String,Number,isFinite});
  const bootSrc=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');
  const classText=bootSrc.slice(bootSrc.indexOf('/** Explicit flow-reference stand-in.'),bootSrc.indexOf("@ccclass('WorldIntegrationBoot')"));
  const ctx={...motion,REF:M.CharacterReference.CHARACTER_REFERENCE,Cancelled:W.Cancelled,AnimationClip:{WrapMode:{Loop:2,Normal:1}},SkeletalAnimation:function(){},MeshRenderer:function MeshRenderer(){},pointOnPath:W.pointOnPath,exports:{},console:{log(){},warn(){},error:console.error,info(){}},Date,Math,Number,Float64Array,Error,Promise,globalThis:{}};
  vm.runInNewContext(tx(classText+'\nexports.Standin=FlowReferenceStandin;'),ctx);
  const rig=G.loadRig(GLB),clipDefs=Object.keys(rig.clips).map(k=>({name:k,duration:rig.clips[k].duration,apply:t=>G.applyClip(rig.clips[k],t)}));
  const states=new Map();
  const anim={node:rig.root,clips:clipDefs,useBakedAnimation:true,getState(n){if(states.has(n))return states.get(n);const c=clipDefs.find(x=>x.name===n);return c?this.createState(c,n):null;},
    createState(c,n){const st={clip:c,time:0,playing:false,setTime(t){this.time=t;},sample(){c.apply(this.time);},stop(){this.playing=false;},pause(){},play(){this.playing=true;}};states.set(n,st);return st;},play(n){this.getState(n).play();}};
  const node={active:true,worldPosition:{x:0,y:0,z:0},yaw:0,setWorldPosition(x,y,z){this.worldPosition={x,y,z};},setRotationFromEuler(a,b,c){this.yaw=b*Math.PI/180;},destroy(){}};
  const s=new ctx.exports.Standin(node);s.setAnimMeta(META);
  const cfg=M.FirstsliceRoutes.createFirstsliceRoutes(M.FirstsliceFacts.FIRSTSLICE,M.CharacterReference.CHARACTER_REFERENCE);
  s.setWalkRestAhead(motion.restAheadFromRoutes(cfg));s.bindVisual({getComponent:()=>anim,getComponentInChildren:()=>null});
  const jobs=new Set();let state='',t=0,rlw=1;
  const runJob=(seconds,token,tick)=>{token.check();if(!(seconds>0)){tick(1);return Promise.resolve();}return new Promise((resolve,reject)=>{const job={elapsed:0,seconds,tick,resolve,reject};job.off=token.onCancel(()=>{jobs.delete(job);reject(new W.Cancelled());});jobs.add(job);tick(0);});};
  const lease={setLayers(){},setDoor(){},setCamera(){},animateDoor:(f,to,sec,tk)=>runJob(sec,tk,()=>{}),animateCamera:(p,sec,tk,o,prog,onSample)=>{const follow=prog&&M.CameraPose.createProgressFollower?M.CameraPose.createProgressFollower(sec):null;return runJob(sec,tk,v=>{const e=follow?follow(v,prog()):v;if(onSample)onSample(e);});},
    setRoomLightWeight(w){rlw=w;return true;},getRoomLightWeight:()=>rlw,blendRoomLight:(a,b,sec,tk)=>runJob(sec,tk,v=>{rlw=a+(b-a)*v;}),wait:(sec,tk)=>runJob(sec,tk,()=>{}),cancelTransient(){for(const j of [...jobs]){j.off();j.reject(new W.Cancelled());}jobs.clear();},assertStaticWorld(){},dispose(){}};
  const changes=[];
  const flow=new W.WorldFlow({config:cfg,mode:'motion',character:s,levels:{enter:async()=>{throw Error('unused');}},loadWorld:async()=>lease,onChange:x=>{if(x.state!==state)changes.push({t,state:x.state});state=x.state;}});
  if(!(await flow.load()).ok)throw Error('flow load failed');
  s.setWindSource(()=>typeof flow.getWindStrength==='function'?flow.getWindStrength():0);
  const soles=G.solePoints(GLB),feet=[],frames=[];s.onFoot(e=>feet.push({t,state,event:e.event,bone:e.bone,clip:e.clip,type:e.type,pos:[node.worldPosition.x,node.worldPosition.y,node.worldPosition.z]}));
  const flush=()=>new Promise(r=>setImmediate(r));
  const t0=t;changes.push({t,state});
  const frameDt=i=>opts.jitter?dt*(1+opts.jitter*Math.sin(i*1.7)*Math.sin(i*0.31)):dt;let fi=0;
  const run=async(start)=>{let done=false;const pr=start().then(r=>{done=true;return r;});await flush();
  const tail=opts.tailFrames??60;let after=0;
  while(after<tail){const dt=frameDt(fi++);t+=dt;s.advance(dt);for(const j of [...jobs]){if(!jobs.has(j))continue;j.elapsed+=dt;j.tick(Math.min(1,j.elapsed/j.seconds));if(j.elapsed>=j.seconds){jobs.delete(j);j.off();j.resolve();}}
    await flush();await flush();if(done)after++;
    const d=s.diagnostics(),ctrl=[node.worldPosition.x,node.worldPosition.y,node.worldPosition.z],f={t,dt,state,clip:d.clip,pos:ctrl,yaw:node.yaw,sole:{},wind:typeof flow.getWindStrength==='function'?flow.getWindStrength():0,roomLight:rlw};
    for(const b of ['foot.L','foot.R']){const pts=G.soleWorld(rig.byName(b),soles[b],ctrl,node.yaw);let lo=pts[0];for(const p of pts)if(p[1]<lo[1])lo=p;f.sole[b]=lo;}
    if(opts.onFrame)opts.onFrame(f,s,dt);
    frames.push(f);if(frames.length>fps*240)throw Error('flow did not finish');}
  const r=await pr;if(!r.ok)throw Error('flow '+JSON.stringify(r));return r;};
  await run(()=>flow.leaveHome());
  if(opts.returnHome){changes.push({t,state:'<return>'});await run(()=>flow.returnHome());}
  return {fps,t0,frames,feet,changes,glb:GLB,meta:META};}
module.exports={simulateExit,GLB};
if(require.main===module)simulateExit().then(r=>{const out=process.argv[2];const x={fps:r.fps,changes:r.changes,feet:r.feet,frames:r.frames.map(f=>({t:+f.t.toFixed(4),state:f.state,clip:f.clip,pos:f.pos.map(v=>+v.toFixed(4)),L:f.sole['foot.L'].map(v=>+v.toFixed(4)),R:f.sole['foot.R'].map(v=>+v.toFixed(4))}))};
  if(out)fs.writeFileSync(out,JSON.stringify(x));console.log(JSON.stringify({frames:r.frames.length,changes:r.changes.map(c=>c.state+'@'+c.t.toFixed(3)),feet:r.feet.length}));}).catch(e=>{console.error(e);process.exit(1);});
