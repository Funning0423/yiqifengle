'use strict';
/** Joint test with Voice bot's REAL AmbienceAudio (gull call events, work/Voice-bot-bgm fbee3d5 or VOICE_AMBIENCE=<file>), mocked cc
 * as in Voice bot's own test_gull_events: the flock subscribes exactly like GullFlock.ts does (__worldIntegration.onGullCall +
 * gullClock, defensive), the camera follows camera-track.json, WindAudio is simulated (windExit ramp, notifyApronFull at the apron
 * lift, onCraneStart at the track's crane-start). Reports every near 'start' and whether its gull entered the frame (>= 0.25 s
 * within 2.5 s) and its closest camera distance; island idle runs with the real random scheduler (2.5 s lead).
 * SKIP (exit 0) when the AmbienceAudio source is not available. Usage: node tools/scene-fx/test_gulls_voice.cjs [--json out] */
const fs=require('fs'),path=require('path'),Module=require('module'),cp=require('child_process'),crypto=require('crypto');
const S=require('./gull_sim.cjs'),{C}=S.load(),root=S.root;
const args=process.argv.slice(2),jsonOut=args.includes('--json')?args[args.indexOf('--json')+1]:null;
let src=null,from=null;const wt=path.join(root,'creator-build-project/assets/scripts/audio/AmbienceAudio.ts');
if(process.env.VOICE_AMBIENCE&&fs.existsSync(process.env.VOICE_AMBIENCE)){src=fs.readFileSync(process.env.VOICE_AMBIENCE,'utf8');from=process.env.VOICE_AMBIENCE;}
else if(!process.env.VOICE_REF&&fs.existsSync(wt)&&/onGullCall/.test(fs.readFileSync(wt,'utf8'))){src=fs.readFileSync(wt,'utf8');from='worktree audio/AmbienceAudio.ts';}
else{for(const ref of (process.env.VOICE_REF?[process.env.VOICE_REF]:['4a8c474','fbee3d5'])){if(src)break;try{src=cp.execSync('git show '+ref+':creator-build-project/assets/scripts/audio/AmbienceAudio.ts',{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});from=ref;}catch(e){}}}
if(!src||!/onGullCall/.test(src)){console.log('SKIP: AmbienceAudio with onGullCall not available (set VOICE_AMBIENCE or VOICE_REF)');process.exit(0);}
const ts=require('../qf-env.cjs').typescript(),js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES5,experimentalDecorators:true}}).outputText;
const trackFile=process.env.CAMERA_TRACK||path.resolve(root,'../../previews/运镜bot/camera-track.json'),T=JSON.parse(fs.readFileSync(trackFile,'utf8'));
const trackSha=crypto.createHash('sha256').update(fs.readFileSync(trackFile)).digest('hex');
console.warn=()=>{};
function env(seed){
  class AudioSource{constructor(){this.volume=1;this.playing=false;}play(){this.playing=true;}stop(){this.playing=false;}pause(){this.playing=false;}destroy(){}}
  class Node{constructor(){this.comps=[];}addComponent(K){const c=new K();c.node=this;this.comps.push(c);if(c.onLoad)c.onLoad();return c;}getComponent(K){return this.comps.find(c=>c instanceof K)||null;}}
  function Component(){}
  const cam={node:{valid:true,forward:{x:0,y:0,z:-1}}},onceCbs=[];
  const flow={valid:true,w:0,visible:true,rig:true,cranes:[],worldCamera:cam,isWorldVisible(){return this.visible;},getRoomLightWeight(){return this.w;},hasRoomLight(){return this.rig;},onCraneStart(cb){this.cranes.push(cb);return()=>{};}};
  const audioNode=new Node(),GameAudio={instance:{canPlayAmbience(){return true;},node:audioNode,play(){}},ensure(){return this.instance;}};
  const scene={getComponentInChildren(n){return n==='WorldFlowComponent'?flow:null;}};
  const cc={_decorator:{ccclass:()=>K=>K},Component,AudioSource,AudioClip:class{},isValid:o=>!!o&&o.valid!==false,
    resources:{load(p,K,cb){cb(null,{addRef(){},decRef(){}});}},director:{getScene:()=>scene,once(e,cb){onceCbs.push(cb);}},Director:{EVENT_AFTER_SCENE_LAUNCH:'x'}};
  const file=path.join(root,'creator-build-project/assets/scripts/audio/AmbienceAudio.ts'),m=new Module(file);m.filename=file;m.paths=[];const o=m.require.bind(m);
  m.require=id=>id==='cc'?cc:id==='./GameAudio'?{GameAudio}:id==='./AmbienceNight'?{}:o(id);m._compile(js,file);
  const A=m.exports.AmbienceAudio;A.windExit=0;A.rnd=C.rng(seed);onceCbs.forEach(cb=>cb());const a=audioNode.getComponent(A);
  return {A,a,cam,flow};
}
function run(frames,seed,opt){
  globalThis.__worldIntegration={snapshot(){}};const E=env(seed),fl=new C.GullFlock(seed+100);fl.setView(true);
  let subscribed=null;const events=[];const probe=()=>{const wi=globalThis.__worldIntegration;if(!subscribed&&wi&&typeof wi.onGullCall==='function')subscribed=wi.onGullCall(e=>{events.push(Object.assign({t:cur},e));fl.onCall(e,typeof wi.gullClock==='function'?wi.gullClock():undefined);});};
  let cur=0,apron=false,crane=false;const near=[],cancels=[];
  for(let i=1;i<frames.length;i++){const f=frames[i],dt=f.t-frames[i-1].t;if(dt<=0)continue;cur=f.t;const c=S.camOf(f,T.aspect);E.cam.node.forward={x:c.fwd[0],y:c.fwd[1],z:c.fwd[2]};
    if(opt.exit){const w=f.t<10?0:f.t<12.36?.1+.05*(f.t-10)/2.36:f.t<14.73?.15+.85*Math.max(0,(f.t-13.9)/.83):f.t<21.62?1-(f.t-14.73)/6.89:0;E.A.windExit=Math.max(0,Math.min(1,w));
      if(!apron&&f.t>=opt.apronAt){apron=true;E.A.notifyApronFull();} if(!crane&&f.t>=opt.craneAt){crane=true;E.flow.cranes.forEach(cb=>cb());}}
    E.a.update(dt);probe();const P=fl.advance(dt,c,0,f.root);
    for(const e of events.splice(0)){if(e.phase==='cancelled')cancels.push(e);if(e.phase==='start'&&e.dist==='near')near.push({id:e.id,kind:e.kind,t:f.t,in:0,min:1e9});}
    for(const n of near){if(f.t>n.t+2.5)continue;const L=fl.nearLog.find(x=>x.id===n.id);if(!L||L.gull<0)continue;const p=P[L.gull];if(!p.visible)continue;
      n.min=Math.min(n.min,Math.hypot(p.pos[0]-c.pos[0],p.pos[1]-c.pos[1],p.pos[2]-c.pos[2]));if(C.project(c,p.pos).inFrame)n.in+=dt;}}
  if(subscribed)subscribed();delete globalThis.__worldIntegration;
  run.cancels=(run.cancels||0)+cancels.length;
  return near.map(n=>({kind:n.kind,t:+n.t.toFixed(2),seen:n.in>=.25,inFrameS:+n.in.toFixed(2),minCamM:+n.min.toFixed(2)}));
}
const out=T.frames.filter(f=>f.phase==='outbound'),craneAt=(T.events.find(e=>e.kind==='crane-start')||{t:15.567}).t;
const exitRes=[];for(let s=1;s<=30;s++)exitRes.push(...run(out,s,{exit:true,apronAt:14.87+((s%5)-2)*.2,craneAt}));
const idleRoot=(T.frames.find(f=>f.phase==='islandIdle')||T.frames[0]).root,idle=[];for(let i=0;i<60*120;i++)idle.push(Object.assign({},T.islandIdlePose,{t:i/60,root:idleRoot}));
const idleRes=[];for(let s=1;s<=6;s++)idleRes.push(...run(idle,s,{exit:false}));
const pct=a=>a.length?+(100*a.filter(r=>r.seen).length/a.length).toFixed(1):null,mn=a=>a.length?Math.min(...a.map(r=>r.minCamM)):null;
const byKind={};for(const r of exitRes)(byKind[r.kind]=byKind[r.kind]||[]).push(r);
const summary={ambience:from,cancelledEvents:run.cancels||0,track:{sha256:trackSha},exit:{nearStarts:exitRes.length,inFramePct:pct(exitRes),minCamM:mn(exitRes),byKind:Object.fromEntries(Object.entries(byKind).map(([k,v])=>[k,{n:v.length,inFramePct:pct(v),startT:[Math.min(...v.map(r=>r.t)),Math.max(...v.map(r=>r.t))]}]))},
  island:{nearStarts:idleRes.length,inFramePct:pct(idleRes),minCamM:mn(idleRes)}};
console.log(JSON.stringify(summary,null,1));
const ok=exitRes.length>0&&summary.exit.inFramePct>=85&&summary.exit.minCamM>=1&&(idleRes.length===0||summary.island.inFramePct>=90&&summary.island.minCamM>=1);
if(jsonOut)fs.writeFileSync(jsonOut,JSON.stringify({summary,exit:exitRes,island:idleRes},null,1));
console.log(ok?'ALL PASS gulls-voice-contract':'FAILED gulls-voice-contract');process.exitCode=ok?0:1;
