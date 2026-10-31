'use strict';
/** Runtime path of the skirt gates: the REAL CharacterMotion.ts (MotionClock: crossfades, wind_flutter_loop additive layer,
 *  morphWeights) and the REAL AnimRig class text from WorldIntegrationBoot.ts (sample/blendPose/applyLayer/writePose), both
 *  transpiled with QF_TYPESCRIPT_MODULE, drive her GLB joints through a structural SkeletalAnimation stand-in whose clip
 *  states write the glTF channels (hem_lib.sampleChannel = Cocos LINEAR/slerp).  Every frame is then skinned (morphs + LBS)
 *  and measured with hem_lib.  Engine rendering is not involved (Mac recording = visual acceptance).
 *  Scenarios cover every clip the game plays her with, joined the way the game joins them (play() with the default 0.2 s
 *  crossfade, walk clips advanced by distance at 0.7 m/s, wind 1.0 while walking = full flutter weight, 0 seated). */
const fs=require('fs'),path=require('path'),vm=require('vm'),H=require('./hem_lib.cjs');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const SRC=path.join(H.ROOT,'creator-build-project/assets/scripts');
const tx=src=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function loadRuntime(){const motion={};vm.runInNewContext(tx(fs.readFileSync(path.join(SRC,'CharacterMotion.ts'),'utf8')),{exports:motion,Math,Float64Array,RegExp,Object,Array,String,Number,isFinite,console});
  const boot=fs.readFileSync(path.join(SRC,'WorldIntegrationBoot.ts'),'utf8');const a=boot.indexOf('/** Cocos side of the pose pipeline.'),b=boot.indexOf("@ccclass('WorldIntegrationBoot')");
  if(a<0||b<0)throw Error('AnimRig not found in WorldIntegrationBoot.ts');let rigText=boot.slice(a,b);const cut=rigText.indexOf('const RESULT_ACTION_IDS');if(cut>0)rigText=rigText.slice(0,cut);
  const ctx={...motion,AnimationClip:{WrapMode:{Loop:2,Normal:1}},console:{warn(){},log(){}},Float64Array,Math,Number,Object,Array,isFinite,Infinity,exports:{}};
  vm.runInNewContext(tx(rigText+'\nexports.AnimRig=AnimRig;'),ctx);return {motion,AnimRig:ctx.exports.AnimRig};}
/** structural SkeletalAnimation over hem_lib's rig: joint nodes = live objects mirroring R.nodes. */
function stage(R){const mk=n=>({name:n.name,children:[],position:{x:n.p[0],y:n.p[1],z:n.p[2]},rotation:{x:n.q[0],y:n.q[1],z:n.q[2],w:n.q[3]},scale:{x:n.s[0],y:n.s[1],z:n.s[2]},
    setPosition(x,y,z){this.position={x,y,z};},setRotation(x,y,z,w){this.rotation={x,y,z,w};},setScale(x,y,z){this.scale={x,y,z};}});
  H.resetRest(R);const N=R.nodes.map(mk);R.nodes.forEach((n,i)=>n.children.forEach(c=>N[i].children.push(N[c])));const root={name:'CHAR_ROOT',children:R.nodes.filter(n=>n.parent<0).map(n=>N[n.i])};
  const clips=Object.values(R.clips).map(c=>({name:c.name,duration:c.duration,enableTrsBlending:false}));const states={};
  const mkState=c=>({_clipEval:true,time:0,setTime(t){this.time=t;},sample(){for(const ch of R.clips[c.name].channels){const v=H.sampleChannel(ch,this.time),nd=N[ch.node];if(ch.path==='translation')nd.setPosition(...v);else if(ch.path==='rotation')nd.setRotation(...v);else nd.setScale(...v);}},stop(){},play(){},pause(){}});
  const anim={node:root,clips,useBakedAnimation:false,getState(n){return states[n]||null;},createState(c,n){return states[n||c.name]=mkState(c);},removeState(n){delete states[n];},play(){}};
  clips.forEach(c=>anim.createState(c,c.name));
  const sync=()=>R.nodes.forEach((n,i)=>{const d=N[i];n.p=[d.position.x,d.position.y,d.position.z];n.q=[d.rotation.x,d.rotation.y,d.rotation.z,d.rotation.w];n.s=[d.scale.x,d.scale.y,d.scale.z];});
  return {anim,sync};}
const SPEED=0.7;
/** Scenario = list of steps: {play, loop, fade?, until:'end'|seconds, walk:boolean, wind}. */
const SCENARIOS={
  walk_stopL:[{play:'idle_breathing_loop',loop:true,until:.6},{play:'walk_start',until:'end',walk:true,wind:1},{play:'walk_loop',loop:true,until:3.0,walk:true,wind:1},{play:'walk_stop_bodyL',until:'end',walk:true,wind:1},{play:'idle_breathing_loop',loop:true,until:1.0}],
  walk_stopR:[{play:'idle_breathing_loop',loop:true,until:.4},{play:'walk_start',until:'end',walk:true,wind:.5},{play:'walk_loop',loop:true,until:2.3,walk:true,wind:.5},{play:'walk_stop_bodyR',until:'end',walk:true,wind:.5},{play:'idle_breathing_loop',loop:true,until:1.0}],
  turns:[{play:'walk_loop',loop:true,until:1.1,walk:true,wind:1},{play:'walk_turn_90_bodyL',until:'end',walk:true,wind:1},{play:'walk_loop',loop:true,until:.9,walk:true,wind:1},{play:'walk_turn_90_bodyR',until:'end',walk:true,wind:1},
    {play:'walk_loop',loop:true,until:.7,walk:true,wind:1},{play:'walk_turn_180',until:'end',walk:true,wind:1},{play:'walk_loop',loop:true,until:.8,walk:true,wind:1},{play:'walk_turn_180_bodyR',until:'end',walk:true,wind:1},{play:'walk_stop_bodyL',until:'end',walk:true,wind:1},{play:'idle_breathing_loop',loop:true,until:.6}],
  door_stepdown:[{play:'idle_breathing_loop',loop:true,until:.5},{play:'door_reach',until:'end'},{play:'walk_start_stepdown',until:'end',walk:true,wind:1},{play:'walk_loop',loop:true,until:1.5,walk:true,wind:1},{play:'walk_stop_bodyR',until:'end',walk:true,wind:1},{play:'idle_breathing_loop',loop:true,until:.5}],
  /* boat / balloon: walk to the seat, door_reach (basket door), sit_down -> sit_hold, stand_up, walk off */
  ride:[{play:'walk_loop',loop:true,until:1.2,walk:true,wind:1},{play:'walk_stop_bodyL',until:'end',walk:true,wind:1},{play:'door_reach',until:'end'},{play:'walk_start',until:'end',walk:true,wind:.3},{play:'walk_stop_bodyR',until:'end',walk:true,wind:.3},
    {play:'sit_down',until:'end'},{play:'sit_hold',loop:true,until:1.5},{play:'stand_up',until:'end'},{play:'walk_start',until:'end',walk:true,wind:1},{play:'walk_loop',loop:true,until:1.0,walk:true,wind:1},{play:'walk_stop_bodyL',until:'end',walk:true,wind:1}],
  idle_gust:[{play:'idle_breathing_loop',loop:true,until:4.0,gust:true}]};
const SEATED=/^(sit_down|sit_hold|stand_up)$/;
/** Runs every scenario at dt mode (60 | 30 | 'uneven') and returns per-frame metric rows. */
function run(glb,mode,{penetration=true,scenarios=Object.keys(SCENARIOS),onFrame=null,patch=null}={}){const {motion,AnimRig}=loadRuntime();const R=H.load(glb),S=H.sets(R);if(patch)patch(R);const meta=JSON.parse(fs.readFileSync(path.join(path.dirname(glb),'anim_meta.json'),'utf8'));
  const cfg=motion.parseAnimMeta(meta);const rows=[];
  for(const name of scenarios){const {anim,sync}=stage(R);const rig=new AnimRig(anim,true);const clock=new motion.MotionClock(cfg,rig);const dtf=mode==='uneven'?H.lcg(name.length*7919+13):()=>1/mode;let T=0;
    for(const st of SCENARIOS[name]){clock.play(st.play,!!st.loop,{fade:-1,keep:false});if(st.gust)clock.startGust(3);let t=0,ended=false;
      while(true){const dt=dtf();const res=clock.tick(dt,st.walk?SPEED*dt:null,st.wind||0);t+=dt;T+=dt;if(res.ended===st.play)ended=true;
        const plan=clock.plan();rig.apply(plan);sync();const mw=motion.morphWeights(cfg,plan,clock.windDrive());
        const m=H.hemMetrics(R,S,mw);const seated=(SEATED.test(plan.base.clip)||(plan.out&&SEATED.test(plan.out.clip)))&&m.thighDeg>30;
        const row={scenario:name,mode,T,clip:plan.base.clip,time:plan.base.time,out:plan.out?plan.out.clip:null,fade:plan.out?plan.out.weight:0,flutter:plan.layers.length?plan.layers[0].weight:0,seatedSkip:seated,thighDeg:m.thighDeg,dress:m.dress,apron:m.apron};
        if(penetration){const p=H.penetration(R,S,mw,m.W);row.pen={count:p.count,maxDepth:p.maxDepth,worst:p.worst};}
        rows.push(row);if(onFrame)onFrame(row,R,mw);
        if(st.until==='end'?ended:t>=st.until)break;if(t>30)throw Error('scenario '+name+' step '+st.play+' did not end');}}}
  return rows;}
module.exports={run,SCENARIOS,loadRuntime};
if(require.main===module){const glb=process.argv[2]||H.GLB;for(const mode of [60,30,'uneven']){const rows=run(glb,mode);const by={};
  for(const r of rows){const k=r.clip;const b=by[k]||(by[k]={n:0,lift:-9,apron:-9,flare:-9,vert:-9,bk:9,pen:0,pd:0});b.n++;if(r.pen&&r.pen.count){b.pen+=r.pen.count;b.pd=Math.max(b.pd,r.pen.maxDepth);}if(r.seatedSkip)continue;
    b.lift=Math.max(b.lift,r.dress.lift);b.apron=Math.max(b.apron,r.apron.lift);b.flare=Math.max(b.flare,r.dress.flare,r.apron.flare);b.vert=Math.max(b.vert,r.dress.maxVertLift,r.apron.maxVertLift);b.bk=Math.min(b.bk,r.dress.belowKnee);}
  for(const [k,b] of Object.entries(by))console.log(String(mode).padEnd(6),k.padEnd(22),'n',b.n,'lift',(b.lift*100).toFixed(1),'bk',(b.bk*100).toFixed(1),'apron',(b.apron*100).toFixed(1),'flare',(b.flare*100).toFixed(1),'vert',(b.vert*100).toFixed(1),'pen',b.pen,(b.pd*100).toFixed(2));}}
