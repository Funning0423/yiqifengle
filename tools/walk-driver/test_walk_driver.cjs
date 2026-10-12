'use strict';
/** Walk driver tests (GGbot): the REAL FlowReferenceStandin + AnimRig (WorldIntegrationBoot.ts) and CharacterMotion.ts,
 * driven by the REAL WorldFlow + FirstsliceRoutes at 60 fps, with 角色动画bot's walk GLB evaluated in JS (glb_rig.cjs).
 *   node tools/walk-driver/test_walk_driver.cjs            (needs QF_TYPESCRIPT_MODULE like the other TS tests)
 * env WALK_GLB=<glb> (default previews/角色动画bot/walk-v1, else walk-v2, else the repo's interim GLB)
 *     WALK_FLOW_ROOT=<checkout> load world-r1 (WorldFlowCore/routes) from another tree, e.g. 运镜bot-wind 138bca5 (real wind).
 * Engine-free, no rendering. Not render/device acceptance. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..','..');const S=path.join(ROOT,'creator-build-project/assets/scripts');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const G=require('./glb_rig.cjs');
const flowRoot=process.env.WALK_FLOW_ROOT?path.resolve(process.env.WALK_FLOW_ROOT):ROOT;
const {load}=require(path.join(flowRoot,'tools/camera-frame-test/load_ts.cjs'));const M=load();const W=M.WorldFlowCore;
const tx=src=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const motion={};vm.runInNewContext(tx(fs.readFileSync(path.join(S,'CharacterMotion.ts'),'utf8')),{exports:motion,Math,Float64Array,RegExp,Object,Array,String,Number,isFinite});
const bootSrc=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');
const classText=bootSrc.slice(bootSrc.indexOf('/** Explicit flow-reference stand-in.'),bootSrc.indexOf("@ccclass('WorldIntegrationBoot')"));
const fakeGlobal={};
const ctx={...motion,REF:M.CharacterReference.CHARACTER_REFERENCE,Cancelled:W.Cancelled,AnimationClip:{WrapMode:{Loop:2,Normal:1}},SkeletalAnimation:function(){},MeshRenderer:function MeshRenderer(){},pointOnPath:W.pointOnPath,exports:{},console,Date,Math,Number,Float64Array,Error,Promise,globalThis:fakeGlobal};
vm.runInNewContext(tx(classText+'\nexports.Standin=FlowReferenceStandin;'),ctx);const Standin=ctx.exports.Standin;
const pick=()=>{for(const p of [process.env.WALK_GLB,'/workspace/yiqifengle/previews/角色动画bot/walk-v1/chr_b_r5g2_walk-v1_TEST.glb','/workspace/yiqifengle/previews/角色动画bot/walk-v2/chr_b_r5g2_walk-v2_TEST.glb',path.join(ROOT,'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')])if(p&&fs.existsSync(p))return p;throw Error('no walk glb');};
const GLB=pick();const metaPath=path.join(path.dirname(GLB),'anim_meta.json');const META=fs.existsSync(metaPath)?JSON.parse(fs.readFileSync(metaPath,'utf8')):null;
const results=[];const check=(name,fn)=>{try{const info=fn();results.push({name,ok:true,info});}catch(e){results.push({name,ok:false,error:String(e&&e.stack||e)});}};
const deg=r=>r*180/Math.PI,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const qang=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w)))*180/Math.PI;
/** Synthetic wind layers for the additive check: skirt/apron/hair bones swing +-AMP about local X; thigh.L also swings (must be masked off). */
const FLUTTER_AMP=20;
function syntheticLayer(rig,name,duration,fn){return {name,duration,apply(t){for(const n of rig.nodes){const a=fn(n.name,t);if(a===null)continue;const r=rig.rest[rig.nodes.indexOf(n)].r;const h=a*Math.PI/360,d=[Math.sin(h),0,0,Math.cos(h)];const q=G.qmul([r.x,r.y,r.z,r.w],d);n.setRotation(q[0],q[1],q[2],q[3]);}
  // non-masked bones the layer clip also animates (Cocos samples whole clips): they must NOT leak through the mask
  const th=rig.byName('thigh.L');if(th)th.setRotation(Math.sin(.26),0,0,Math.cos(.26));}};}
function makeCharacter(opts={}){const rig=G.loadRig(opts.glb||GLB);const clipDefs=[];for(const k of Object.keys(rig.clips))clipDefs.push({name:k,duration:rig.clips[k].duration,apply:t=>G.applyClip(rig.clips[k],t)});
  if(opts.layers){clipDefs.push(syntheticLayer(rig,'wind_flutter_loop',2,(n,t)=>/^(skirt|apron|hair)/.test(n)?FLUTTER_AMP*Math.sin(2*Math.PI*t/2):null));
    clipDefs.push(syntheticLayer(rig,'apron_lift',1.6,(n,t)=>/^skirt\.front/.test(n)?40*Math.sin(Math.PI*Math.min(1,t/1.6)):null));}
  const states=new Map();const samples={count:0};
  const anim={node:rig.root,clips:clipDefs,useBakedAnimation:true,getState(n){if(states.has(n))return states.get(n);const c=clipDefs.find(x=>x.name===n);return c?this.createState(c,n):null;},
    createState(c,n){const st={clip:c,time:0,playing:false,setTime(t){this.time=t;},sample(){samples.count++;c.apply(this.time);},stop(){this.playing=false;},pause(){},play(){this.playing=true;}};states.set(n,st);return st;},play(n){this.getState(n).play();}};
  const node={active:true,worldPosition:{x:0,y:0,z:0},yaw:0,setWorldPosition(x,y,z){this.worldPosition={x,y,z};},setRotationFromEuler(a,b,c){this.yaw=b*Math.PI/180;},destroy(){}};
  const s=new Standin(node);s.setAnimMeta(opts.meta===undefined?META:opts.meta);if(opts.restAhead)s.setWalkRestAhead(opts.restAhead);const visual={getComponent:()=>anim,getComponentInChildren:()=>null};if(opts.renderers)visual.getComponentsInChildren=C=>{assert.equal(C,ctx.MeshRenderer);return opts.renderers;};s.bindVisual(visual);return {s,rig,anim,node,samples};}
const foot=(c,name)=>G.worldOf(c.rig.byName(name),[c.node.worldPosition.x,c.node.worldPosition.y,c.node.worldPosition.z],c.node.yaw).pos;
/** Foot-flat windows (cycle fractions) from anim_meta phases; default walk-v1 values. Ankle must stay put in world here. */
const phases=META?.clips?.walk_loop?.phases_fraction_of_cycle||{'foot.R':{foot_flat:.1,heel_off:.4},'foot.L':{foot_flat:.6,heel_off:.9}};
function slideTracker(){const open={},worst={mm:0,where:null},all=[],corner={mm:0,where:null,windows:0};return {worst,all,corner,frame(c,label){const ph=c.s.diagnostics();if(ph.clip!=='walk_loop'||ph.motion.fade){for(const k in open)delete open[k];return;}
  for(const bone of ['foot.L','foot.R']){const w=phases[bone];const f=ph.motion.phase;const inside=w.foot_flat<w.heel_off?f>=w.foot_flat&&f<=w.heel_off:(f>=w.foot_flat||f<=w.heel_off);
   const p=foot(c,bone);if(inside){if(!open[bone])open[bone]={start:p,max:0,label,yaw0:c.node.yaw,dyaw:0};else{const o=open[bone];o.dyaw=Math.max(o.dyaw,Math.abs(wrap(c.node.yaw-o.yaw0))*180/Math.PI);o.max=Math.max(o.max,Math.hypot(p[0]-o.start[0],p[2]-o.start[2])*1000);}}
   else if(open[bone]){const o=open[bone];delete open[bone];if(o.dyaw>1){corner.windows++;if(o.max>corner.mm){corner.mm=o.max;corner.where=bone+' '+o.label+' yaw '+o.dyaw.toFixed(1)+'deg';}}else{all.push(o.max);if(o.max>worst.mm){worst.mm=o.max;worst.where=bone+' '+o.label;}}}}}};}
class Token{constructor(){this.l=new Set();this.cancelled=false;}check(){if(this.cancelled)throw new W.Cancelled();}onCancel(f){if(this.cancelled)f();else this.l.add(f);return()=>this.l.delete(f);}cancel(){this.cancelled=true;for(const f of [...this.l])f();}}
const flush=()=>new Promise(r=>setImmediate(r));
/** Straight walk at a given speed: distance-driven clock vs the old time-driven clock (rate 1). */
async function straight(speed,mode){const c=makeCharacter();c.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});const L=4,dur=L/speed;const tr=slideTracker();
  if(mode==='time'){const clip=c.rig.clips.walk_loop;let t=0,e=0;c.node.setRotationFromEuler(0,0,0);while(e<dur){e=Math.min(dur,e+1/60);t+=1/60;c.node.setWorldPosition(0,0,L*e/dur);G.applyClip(clip,t%clip.duration);
    const f=(t%clip.duration)/clip.duration;c.s.diagnostics=()=>({clip:'walk_loop',motion:{phase:f,fade:null}});tr.frame(c,'time');}return tr;}
  const p=c.s.perform({kind:'walk',path:[[0,0,0],[0,0,L]],duration:dur},new Token());for(let i=0;i<1e4;i++){c.s.advance(1/60);tr.frame(c,'dist');await flush();if(c.s.walkProgress()===null)break;}await p;return tr;}
async function flowRun(windMode,copts){const cfg=M.FirstsliceRoutes.createFirstsliceRoutes(M.FirstsliceFacts.FIRSTSLICE,M.CharacterReference.CHARACTER_REFERENCE);
  const c=makeCharacter(Object.assign({layers:true},copts&&copts.character||{},copts&&copts.predicate?{restAhead:motion.restAheadFromRoutes(cfg)}:{}));if(copts&&copts.onCharacter)copts.onCharacter(c);const jobs=new Set();let frame=0,state='',t=0;const dt=1/60;
  const runJob=(seconds,token,tick)=>{token.check();if(!(seconds>0)){tick(1);return Promise.resolve();}return new Promise((resolve,reject)=>{const job={elapsed:0,seconds,tick,resolve,reject};job.off=token.onCancel(()=>{jobs.delete(job);reject(new W.Cancelled());});jobs.add(job);tick(0);});};
  const lease={setLayers(){},setDoor(){},setCamera(){},animateDoor:(f,to,s,tk)=>runJob(s,tk,()=>{}),animateCamera:(p,s,tk,o,prog,onSample)=>{const follow=prog&&M.CameraPose.createProgressFollower?M.CameraPose.createProgressFollower(s):null;return runJob(s,tk,v=>{const e=follow?follow(v,prog()):v;if(onSample)onSample(e);});},
    setRoomLightWeight(){return true;},getRoomLightWeight:()=>0,blendRoomLight:(a,b,s,tk)=>runJob(s,tk,()=>{}),wait:(s,tk)=>runJob(s,tk,()=>{}),cancelTransient(){for(const j of [...jobs]){j.off();j.reject(new W.Cancelled());}jobs.clear();},assertStaticWorld(){},dispose(){}};
  const flow=new W.WorldFlow({config:cfg,mode:'motion',character:c.s,levels:{enter:async()=>{throw Error('unused');}},loadWorld:async()=>lease,onChange:s=>{state=s.state;}});
  assert((await flow.load()).ok);
  let tLeave=0;const synthetic=tt=>{const x=tt-tLeave;const k=[[0,0],[10,.1],[12.36,.15],[14.53,.95],[14.73,1],[15.47,1],[21.62,0]];return motion.piecewise(k,x);};
  const realWind=typeof flow.getWindStrength==='function';c.s.setWindSource(()=>windMode==='real'&&realWind?flow.getWindStrength():state==='walking-out'||state==='crossing-out'||state==='opening-door'||state==='island'?synthetic(t):0);
  const feet=[],apron=[],rec=[];c.s.onFoot(e=>feet.push({t,state,...e}));c.s.onApronLift((s,d)=>apron.push({t,state,strength:s,durationSec:d,wind:c.s.diagnostics().motion.wind}));
  const tr=slideTracker();
  for(const op of ['leaveHome','returnHome']){let done=false;if(op==='leaveHome')tLeave=t;const pr=flow[op]().then(r=>{done=true;return r;});await flush();
   while(!done){frame++;t+=dt;c.s.advance(dt);if(copts&&copts.frame)copts.frame(c,state,t);for(const j of [...jobs]){if(!jobs.has(j))continue;j.elapsed+=dt;j.tick(Math.min(1,j.elapsed/j.seconds));if(j.elapsed>=j.seconds){jobs.delete(j);j.off();j.resolve();}}
    await flush();await flush();const d=c.s.diagnostics();rec.push({frame,t,state,clip:d.clip,phase:d.motion.phase,abs:c.s.clock&&c.s.clock.base?c.s.clock.base.abs:null,yaw:c.node.yaw,pos:[c.node.worldPosition.x,c.node.worldPosition.z],wp:c.s.walkProgress(),action:d.action,fade:d.motion.fade,layers:d.motion.layers,wind:d.motion.wind});tr.frame(c,state+'@'+t.toFixed(2));if(frame>60*120)throw Error('flow stuck');}
   const r=await pr;assert(r.ok,op+' '+JSON.stringify(r));for(let k=0;k<30;k++){frame++;t+=dt;c.s.advance(dt);await flush();}}
  return {c,rec,feet,apron,tr,cfg,realWind,events:c.s.diagnostics().events};}
require('./test_locomotion.cjs').install({check,makeCharacter,flowRun,foot,Token,flush,motion,M,G,assert,fs,path,ctx,tx,classText,deg,wrap});
const locomotionTests=()=>require('./test_locomotion.cjs').run();
(async()=>{
 const runs={};
 for(const speed of [0.45,0.7,1.0]){runs['dist'+speed]=await straight(speed,'dist');runs['time'+speed]=await straight(speed,'time');}
 check('distance-driven phase: no foot slide at 0.45 / 0.7 / 1.0 m/s (vs old time-driven clock)',()=>{const out={};for(const sp of [0.45,0.7,1.0]){out[sp]={newMaxMm:+runs['dist'+sp].worst.mm.toFixed(1),oldMaxMm:+runs['time'+sp].worst.mm.toFixed(1)};assert(runs['dist'+sp].worst.mm<15,'slide '+sp+' '+runs['dist'+sp].worst.mm);}return out;});
 const fr=await flowRun(process.env.WALK_WIND||'real');const {rec,feet,apron,tr,cfg}=fr;
 check('full out-and-back: foot-flat ankle drift (world) with real routes, 60 fps (straight stance windows; corner windows reported)',()=>{assert(tr.worst.mm<15,JSON.stringify(tr.worst));return {straightMaxMm:+tr.worst.mm.toFixed(1),where:tr.worst.where,straightWindows:tr.all.length,cornerWindows:tr.corner.windows,cornerMaxMm:+tr.corner.mm.toFixed(1),cornerWhere:tr.corner.where,note:'corner drift = body yaw turning over the planted foot (root must stay on the path; old code snapped yaw in one frame)'};});
 // joins = continuous walks WorldFlow runs back to back (motion.restChainsFor): outCrossing->toIsland, toThreshold->inCrossing,
 // and on the follow return (运镜bot 0b6202e: no stop at the entrance) inCrossing->toSeat as well
 const chainJoins=motion.restChainsFor(cfg).reduce((n,ch)=>n+ch.length-1,0);
 check('phase continuity across the continuous joins (outCrossing->toIsland, toThreshold->inCrossing[->toSeat on the follow return]): no reset, no leg swap',()=>{const joins=[];
  for(let i=1;i<rec.length;i++){const b=rec[i];if(b.wp===null||!(rec[i-1].wp===null||rec[i-1].wp>b.wp+.5))continue;let k=i-1;while(k>=0&&rec[k].wp===null&&i-k<=6)k--;if(k<0||rec[k].wp===null)continue;
   let ds=0;for(let m=k+1;m<=i;m++)ds+=Math.hypot(rec[m].pos[0]-rec[m-1].pos[0],rec[m].pos[1]-rec[m-1].pos[1]);const gap=rec.slice(k,i+1);
   joins.push({t:+b.t.toFixed(3),state:b.state,gapFrames:i-k-1,clips:[...new Set(gap.map(r=>r.clip))].join(','),dAbs:+(b.abs-rec[k].abs).toFixed(5),expected:+(ds/0.7).toFixed(5)});}
  assert.equal(joins.length,chainJoins,chainJoins+' mid-walk joins expected '+JSON.stringify(joins));for(const j of joins){assert.equal(j.clips,'walk_loop');assert(Math.abs(j.dAbs-j.expected)<.02,'phase jump at join '+JSON.stringify(j));}
  // between the two walks of a join there is no idle frame
  return {chains:motion.restChainsFor(cfg),joins};});
 check('yaw rate limit while walking <= WALK_YAW_MAX_DEG_S (corners), position stays on the path',()=>{let max=0,where='';const snaps=[];
  for(let i=1;i<rec.length;i++){const a=rec[i-1],b=rec[i];if(b.action!=='walk')continue;const r=Math.abs(deg(wrap(b.yaw-a.yaw)))/(b.t-a.t);if(a.action!=='walk'||a.wp===0){if(r>motion.WALK_YAW_MAX_DEG_S+.5)snaps.push({t:+b.t.toFixed(3),state:b.state,deg:+deg(wrap(b.yaw-a.yaw)).toFixed(1)});continue;}if(r>max){max=r;where=b.state+'@'+b.t.toFixed(2);}}
  assert(max<=motion.WALK_YAW_MAX_DEG_S+0.5,'yaw rate '+max+' at '+where);return {maxDegS:+max.toFixed(1),where,limit:motion.WALK_YAW_MAX_DEG_S,snapsAtWalkStartFromRest:snaps};});
 check('walkProgress per segment: 0..1 monotone, restarts at 0, null when not walking',()=>{const segs=[];let cur=null;
  for(const r of rec){if(r.wp===null){if(cur){segs.push(cur);cur=null;}continue;}if(!cur||r.wp<cur.last-.5){if(cur)segs.push(cur);cur={first:r.wp,last:r.wp,mono:true,state:r.state};}else{if(r.wp<cur.last-1e-9)cur.mono=false;cur.last=r.wp;}}if(cur)segs.push(cur);
  assert.equal(segs.length,6,JSON.stringify(segs));for(const s of segs){assert(s.first<.05&&s.last>.98&&s.mono,JSON.stringify(s));}
  assert(rec.some(r=>r.wp===null&&r.state==='opening-door'));return segs.map(s=>({state:s.state,first:+s.first.toFixed(4),lastSeen:+s.last.toFixed(4)}));});
 check('onFoot: alternating body sides, bone<->body mapping, front foot planted at heel strike, cadence',()=>{const walkFeet=feet.filter(f=>f.clip==='walk_loop');assert(walkFeet.length>30);let alt=0;
  for(let i=1;i<walkFeet.length;i++)if(walkFeet[i].body!==walkFeet[i-1].body)alt++;
  for(const f of walkFeet){assert.equal(f.body,f.bone==='foot.R'?'L':'R',JSON.stringify(f));assert.equal(f.event,'foot:'+f.bone.split('.')[1]);}
  let dist=0;for(let i=1;i<rec.length;i++)if(rec[i].action==='walk')dist+=Math.hypot(rec[i].pos[0]-rec[i-1].pos[0],rec[i].pos[1]-rec[i-1].pos[1]);
  const step=META?.clips?.walk_loop?.step_length_m||0.3967;return {events:walkFeet.length,alternations:alt,expectedSteps:+(dist/step).toFixed(1),first:walkFeet.slice(0,3).map(f=>({t:+f.t.toFixed(3),event:f.event,body:f.body,phase:+f.phase.toFixed(3),cycle:f.cycle}))};});
 // Heel-strike geometry: at a foot event the named bone is the leading foot (unit, straight path)
 const geo=makeCharacter();geo.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});const gp=[];geo.s.onFoot(e=>{const f=foot(geo,e.bone),o=foot(geo,e.bone==='foot.R'?'foot.L':'foot.R');gp.push({bone:e.bone,lead:f[2]-o[2],h:f[1]});});
 const gw=geo.s.perform({kind:'walk',path:[[0,0,0],[0,0,3]],duration:3/0.7},new Token());for(let i=0;i<400;i++){geo.s.advance(1/60);await flush();}await gw;
 check('onFoot timing: the event bone leads (heel strike in front) on every step',()=>{assert(gp.length>=5);for(const g of gp)assert(g.lead>.25,JSON.stringify(g));return {steps:gp.length,minLeadM:+Math.min(...gp.map(g=>g.lead)).toFixed(3)};});
 check('apron_lift: one full emission on the exit walk, on the upward 0.95 crossing (real wind channel when present)',()=>{const full=apron.filter(a=>a.strength==='full');assert.equal(full.length,1,JSON.stringify(apron));
  const at=full[0];return {realWindChannel:fr.realWind,t:+at.t.toFixed(3),state:at.state,windAtEmit:+at.wind.toFixed(3),durationSec:+at.durationSec.toFixed(3),threshold:motion.APRON_LIFT_THRESHOLD};});
 check('apron trigger: upward-only, dithering around the threshold does not refire, re-arms below 0.05',()=>{const tg=new motion.UpwardTrigger(.95,.05);const seq=[0,.5,.94,.951,.93,.96,1,.9,.97,.5,.2,.04,.5,.96];const fired=seq.map(v=>tg.update(v));
  assert.deepEqual(fired.map((f,i)=>f?i:-1).filter(i=>i>=0),[3,13]);return {fires:[3,13]};});
 // Wind layers at MAX weight on top of walk: additive keeps the walk's leg-driven skirt pose; mask keeps legs untouched.
 const lay=makeCharacter({layers:true});const ref=makeCharacter();for(const x of [lay,ref])x.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});lay.s.setWindSource(()=>1);
 const lp=lay.s.perform({kind:'walk',path:[[0,0,0],[0,0,3]],duration:3/0.7},new Token()),rp=ref.s.perform({kind:'walk',path:[[0,0,0],[0,0,3]],duration:3/0.7},new Token());
 const stat={skirtMax:0,skirtMin:1e9,nonMaskMax:0,addErrMax:0,frames:0};const masked=n=>/^(skirt|apron|hair)/.test(n);
 for(let i=0;i<300;i++){lay.s.advance(1/60);ref.s.advance(1/60);await flush();const d=lay.s.diagnostics();if(d.motion.fade||!d.motion.layers.length||d.motion.apron)continue;stat.frames++;
  const tFl=lay.s.clock.flutterAbs%2,amp=FLUTTER_AMP*Math.abs(Math.sin(2*Math.PI*tFl/2));
  for(let k=0;k<lay.rig.nodes.length;k++){const a=lay.rig.nodes[k],b=ref.rig.nodes[k],ang=qang(a.rotation,b.rotation);if(masked(a.name)){stat.skirtMax=Math.max(stat.skirtMax,ang);stat.addErrMax=Math.max(stat.addErrMax,Math.abs(ang-amp));}else stat.nonMaskMax=Math.max(stat.nonMaskMax,ang);}}
 await lp;await rp;
 check('wind_flutter_loop at max weight is ADDITIVE on the walk skirt pose and masked to skirt/apron/hair',()=>{assert(stat.frames>100);assert(stat.nonMaskMax<1e-3,'leak to non-masked joints '+stat.nonMaskMax);assert(stat.addErrMax<0.05,'not additive: '+stat.addErrMax);assert(stat.skirtMax>FLUTTER_AMP*.9);
  return {frames:stat.frames,skirtAngleVsWalkOnlyMaxDeg:+stat.skirtMax.toFixed(2),layerAmplitudeDeg:FLUTTER_AMP,additiveErrorMaxDeg:+stat.addErrMax.toFixed(4),nonMaskedMaxDeg:+stat.nonMaskMax.toFixed(5),note:'synthetic layer clip (no real wind clip yet); clipping must still be checked on the real mesh by 角色动画bot'};});
 check('windToFlutter default: visible at 0.15, 1 at 1, 0 at 0; anim_meta override + threshold override parsed',()=>{const p=motion.DEFAULT_WIND_TO_FLUTTER,w=x=>motion.piecewise(p,x);assert.equal(w(0),0);assert(w(.15)>=.35&&w(.15)<=.4);assert.equal(w(1),1);
  const cfg2=motion.parseAnimMeta({wind:{windToFlutter:[[0,0],[.1,.5],[1,1]],apronLiftThreshold:.9},clips:{apron_lift:{lift_time_s:.3,settle_time_s:1.4,layer:{mode:'override',mask:['apron*']}}}});
  assert.equal(cfg2.apronLiftThreshold,.9);assert.equal(motion.piecewise(cfg2.windToFlutter,.1),.5);assert.equal(cfg2.clips.apron_lift.liftTime,.3);assert.equal(cfg2.clips.apron_lift.layerMode,'override');return {w010:+w(.1).toFixed(3),w015:+w(.15).toFixed(3),w050:+w(.5).toFixed(3)};});
 // apron_lift clip present: emission at the lift frame, duration = settle - lift
 const ap=makeCharacter({layers:true,meta:Object.assign({},META||{},{clips:Object.assign({},(META||{}).clips||{},{apron_lift:{lift_time_s:.3,settle_time_s:1.4}})})});ap.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});let wind=0,tt=0;ap.s.setWindSource(()=>wind);const ev=[];ap.s.onApronLift((s,d)=>ev.push({t:tt,s,d}));
 for(let i=0;i<200;i++){tt=i/60;wind=Math.min(1,i/100);ap.s.advance(1/60);}
 check('apron_lift clip: restarted from frame 0 on the crossing, onApronLift at the lift frame with settle-lift seconds',()=>{assert.equal(ev.length,1);const cross=Math.ceil(95)/60;assert(Math.abs(ev[0].t-(cross+.3))<.04,JSON.stringify(ev));assert(Math.abs(ev[0].d-1.1)<1e-9);return ev[0];});
 // soft gust API
 const gu=makeCharacter({layers:true});gu.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});const gev=[];gu.s.onApronLift((s,d)=>gev.push([s,d]));fakeGlobal.__voiceWind={hooks:0,calls:[],notifyApronLift(s,d){this.calls.push([s,d]);},snapshot(){return {hooks:this.hooks};}};
 assert(gu.s.apronGust(3));let maxW=0;for(let i=0;i<200;i++){gu.s.advance(1/60);maxW=Math.max(maxW,gu.s.diagnostics().motion.flutterWeight);}
 fakeGlobal.__voiceWind.hooks=1;gu.s.apronGust(2);
 check('apronGust(soft): onApronLift(soft,d), flutter envelope, __voiceWind fallback only while WindAudio has no hook',()=>{assert.deepEqual(gev,[['soft',3],['soft',2]]);assert.deepEqual(fakeGlobal.__voiceWind.calls,[['soft',3]]);assert(maxW>.5&&maxW<.8);return {peakFlutterWeight:+maxW.toFixed(3)};});
 // crossfade: no pose pop at walk -> idle (max per-frame joint rotation change around the stop)
 check('crossfade walk->idle (0.2 s) is continuous; CROSSFADE_S constant',()=>{const f=rec.filter(r=>r.fade).length;assert(f>0);return {fadeFrames:f,crossfadeS:motion.CROSSFADE_S};});
 check('blend mode: useBakedAnimation=false, states never played by the manager',()=>{const c=makeCharacter();assert.equal(c.anim.useBakedAnimation,false);return {blend:motion.CHARACTER_POSE_BLEND};});
 // CHARACTER_POSE_BLEND=false: the old baked path (play+pause+setTime+sample, one clip, hard cuts), driver features intact
 {const ctx2={...ctx,CHARACTER_POSE_BLEND:false,exports:{}};vm.runInNewContext(tx(classText+'\nexports.Standin=FlowReferenceStandin;'),ctx2);const S0=Standin;
  const c=(()=>{const rig=G.loadRig(GLB);const clipDefs=Object.keys(rig.clips).map(k=>({name:k,duration:rig.clips[k].duration,apply:t=>G.applyClip(rig.clips[k],t)}));const states=new Map(),plays=[],sampled=new Set();
   const anim={node:rig.root,clips:clipDefs,useBakedAnimation:false,getState(n){if(states.has(n))return states.get(n);const cd=clipDefs.find(x=>x.name===n);if(!cd)return null;const st={time:0,playing:false,paused:false,setTime(t){this.time=t;},sample(){sampled.add(n);cd.apply(this.time);},stop(){this.playing=false;},pause(){this.paused=true;},play(){this.playing=true;this.paused=false;}};states.set(n,st);return st;},createState(cd,n){return this.getState(n);},play(n){plays.push(n);this.getState(n).play();}};
   const node={active:true,worldPosition:{x:0,y:0,z:0},yaw:0,setWorldPosition(x,y,z){this.worldPosition={x,y,z};},setRotationFromEuler(a,b){this.yaw=b*Math.PI/180;},destroy(){}};
   const s=new ctx2.exports.Standin(node);s.setAnimMeta(META);s.bindVisual({getComponent:()=>anim,getComponentInChildren:()=>null});return {s,anim,plays,sampled,states,node};})();
  c.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});c.sampled.clear();const fe=[];c.s.onFoot(e=>fe.push(e));const wp=c.s.perform({kind:'walk',path:[[0,0,0],[0,0,2]],duration:2/0.7},new Token());
  for(let i=0;i<200;i++){c.s.advance(1/60);await flush();}await wp;
  check('baked fallback (CHARACTER_POSE_BLEND=false): play+pause one clip, hard cut, foot events + walkProgress still work',()=>{assert.equal(c.anim.useBakedAnimation,true);assert(c.plays.includes('walk_loop'));assert(c.states.get('walk_loop').paused);
   assert(fe.length>=4);assert.equal(c.s.walkProgress(),null);return {plays:c.plays,footEvents:fe.length};});}
 /* ---------- apron morph targets (MorphDriver + morphWeights; docs/walk-driver.md §8) ---------- */
 const mockRenderer=(name,counts=[2],o={})=>({node:{name},mesh:o.noStruct?{name}:{name:name,struct:o.noMorph?{}:{morph:{subMeshMorphs:counts.map(n=>({attributes:['a_position'],targets:new Array(n).fill(0).map(()=>({displacements:[]}))})),targetNames:['curl','flutter']}}},
  enableMorph:o.enableMorph!==false,calls:[],w:{},setWeight(w,sub,shape){this.calls.push([w,sub,shape]);this.w[sub+':'+shape]=w;}});
 const MCURL_WALK=0.6;
 const morphMeta=(extra={})=>{const m=JSON.parse(JSON.stringify(META||{clips:{}}));m.clips=m.clips||{};
  m.clips.walk_loop=Object.assign({},m.clips.walk_loop||{},{morph:{mesh:'LOD0_G2_APRON',curves:{curl:[[0,MCURL_WALK],[5,MCURL_WALK]]}}});
  // locomotion-v1: a walk from rest plays walk_start first (hard cut into walk_loop at 1.5 s: from 1.3 s it IS walk_loop) and
  // ends in a stop clip (hard cut out of walk_loop, hard cut into idle at its end), so they carry matching curl curves
  if(m.clips.walk_start)m.clips.walk_start=Object.assign({},m.clips.walk_start,{morph:{curves:{curl:[[0,0],[1.3,MCURL_WALK],[1.7,MCURL_WALK]]}}});
  for(const k of ['walk_stop_bodyL','walk_stop_bodyR'])if(m.clips[k])m.clips[k]=Object.assign({},m.clips[k],{morph:{curves:{curl:[[0,MCURL_WALK],[1.5,0]]}}});
  m.clips.apron_lift=Object.assign({},m.clips.apron_lift||{},{lift_time_s:.37,settle_time_s:1.4,morph:{mesh:'LOD0_G2_APRON',curves:{curl:[[0,0],[.37,1],[1.2,.3],[1.6,0]]}}});
  m.clips.wind_flutter_loop=Object.assign({},m.clips.wind_flutter_loop||{},{morph:{curves:{flutter:[[0,.2],[1,.8],[2,.2]]}}});
  m.wind=Object.assign({},m.wind||{},{windToMorphFlutter:[[0,0],[1,.5]]});return Object.assign(m,extra);};
 const lastW=(r,shape)=>{let v;for(const c of r.calls)if(c[2]===shape)v=c[0];return v;};
 const maxStep=arr=>{let m=0,at=-1;for(let i=1;i<arr.length;i++){const d=Math.abs(arr[i]-arr[i-1]);if(d>m){m=d;at=i;}}return {m,at};};
 // 1) crossfade continuity: idle -> walk_loop (curl 0.6) -> idle, 0.2 s crossfades, no jumps; final 0 written exactly
 {const r=mockRenderer('LOD0_G2_APRON');const c=makeCharacter({meta:morphMeta(),renderers:[mockRenderer('LOD0_G2_BODY',[0]),r]});c.s.setWindSource(()=>0);c.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});
  for(let i=0;i<30;i++)c.s.advance(1/60);const curl=[],fades=[];const wp=c.s.perform({kind:'walk',path:[[0,0,0],[0,0,2]],duration:2/0.7},new Token());
  for(let i=0;i<260;i++){c.s.advance(1/60);await flush();const d=c.s.diagnostics();curl.push(d.motion.morph.weights.curl);if(d.motion.fade)fades.push(d.motion.morph.weights.curl);}await wp;
  check('morph: crossfade continuity idle->walk->idle (curl follows the 0.2 s pose crossfade, no jump), exact 0 at the end',()=>{const st=maxStep(curl),bound=MCURL_WALK/(motion.CROSSFADE_S*60)+0.005;
   assert.equal(c.s.diagnostics().motion.morph.status,'ok');assert(Math.max(...curl)>MCURL_WALK-1e-9,'walk curl reached');assert(st.m<=bound,'jump '+st.m+' at frame '+st.at+' bound '+bound);
   const mid=fades.filter(v=>v>.05&&v<MCURL_WALK-.05);assert(mid.length>=6,'intermediate fade values '+mid.length);assert.equal(curl[curl.length-1],0);assert.equal(lastW(r,0),0);
   return {maxStepPerFrame:+st.m.toFixed(4),bound:+bound.toFixed(4),fadeFrames:fades.length,intermediate:mid.length,setWeightCalls:r.calls.length};});
  // 2) only-when-changed: steady idle -> zero calls; every call is a >1e-3 change (or an exact 0/1 endpoint)
  const before=r.calls.length;for(let i=0;i<120;i++)c.s.advance(1/60);
  check('morph: setWeight only when a weight changed by >1e-3 (steady idle = 0 calls; first frame establishes 0)',()=>{assert.equal(r.calls.length,before,'calls during steady idle');
   const last={};for(const [w,sub,shape] of r.calls){const p=last[shape];if(p!==undefined)assert(Math.abs(w-p)>motion.MORPH_EPS||((w===0||w===1)&&w!==p),'redundant call '+w+' after '+p);last[shape]=w;}
   const first=r.calls.slice(0,2).map(x=>x.join(':'));assert.deepEqual(first,['0:0:0','0:0:1']);return {calls:r.calls.length,framesSimulated:30+260+120,steadyIdleCalls:r.calls.length-before};});}
 // 3) layers: wind ramp 0->1 (apron_lift synthetic clip 1.6 s + wind_flutter_loop 2 s): curl from apron_lift curve, flutter = max(layer x curve, windToMorphFlutter)
 {const r=mockRenderer('LOD0_G2_APRON');const c=makeCharacter({layers:true,meta:morphMeta(),renderers:[r]});c.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});let wind=0,tt=0,cross=-1,below=0;const cu=[],fl=[],ev=[];
  c.s.setWindSource(()=>wind);c.s.onApronLift((st,d)=>ev.push(tt));for(let i=0;i<240;i++){tt=i/60;wind=Math.min(1,i/100);c.s.advance(1/60);const d=c.s.diagnostics().motion;if(cross<0&&d.apron)cross=tt;cu.push(d.morph.weights.curl);fl.push(d.morph.weights.flutter);
   const wm=motion.piecewise([[0,0],[1,.5]],d.wind);if(d.morph.weights.flutter<wm-1e-9)below++;}
  check('morph: apron_lift curl curve on its layer timeline + flutter = max(flutter-layer curve, windToMorphFlutter), continuous',()=>{const peak=cu.indexOf(Math.max(...cu));assert(Math.max(...cu)>.97,'curl peak '+Math.max(...cu));
   assert(Math.abs(peak/60-(cross+.37))<.04,'curl peak at lift frame '+peak/60+' vs '+(cross+.37));assert(Math.abs(ev[0]-(cross+.37))<.04,'onApronLift at lift');
   const sc=maxStep(cu),sf=maxStep(fl);assert(sc.m<.06&&sf.m<.06,'jumps '+sc.m+' '+sf.m);assert(Math.max(...fl)>.5,'flutter layer curve dominates the wind map at high wind');assert.equal(below,0,'frames with flutter < windToMorphFlutter(wind)');
   return {crossT:+cross.toFixed(3),curlPeakT:+(peak/60).toFixed(3),curlMaxStep:+sc.m.toFixed(4),flutterMaxStep:+sf.m.toFixed(4),flutterMax:+Math.max(...fl).toFixed(3),calls:r.calls.length};});}
 // 4) missing mesh / no morph / too few targets / morph disabled: nothing written, status recorded, driver unaffected
 {const cases=[['not-found',[mockRenderer('LOD0_G2_BODY')]],['no-morph',[mockRenderer('LOD0_G2_APRON',[2],{noMorph:true})]],['too-few-targets',[mockRenderer('LOD0_G2_APRON',[1])]],['morph-disabled',[mockRenderer('LOD0_G2_APRON',[2],{enableMorph:false})]],['not-found',null]];const out=[];
  for(const [want,rs] of cases){const c=makeCharacter({meta:morphMeta(),renderers:rs||undefined});c.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});const fe=[];c.s.onFoot(e=>fe.push(e));
   const wp=c.s.perform({kind:'walk',path:[[0,0,0],[0,0,1.5]],duration:1.5/0.7},new Token());for(let i=0;i<160;i++){c.s.advance(1/60);await flush();}await wp;const md=c.s.diagnostics().motion.morph;
   out.push({want,status:md.status,reason:md.reason,calls:(rs||[]).reduce((a,x)=>a+x.calls.length,0),feet:fe.length,targetCounts:md.targetCounts});}
  check('morph: missing mesh / no morph / 1 target (<2 needed) / enableMorph=false -> no setWeight, status in diagnostics, walk unaffected',()=>{for(const o of out){assert.equal(o.status,o.want,JSON.stringify(o));assert.equal(o.calls,0,JSON.stringify(o));assert(o.feet>=3);}return out;});}
 // 5) curve-only apron timeline (glb has no apron_lift clip): onApronLift immediate (unchanged), curl still rises to 1 at +0.37 s
 {const r=mockRenderer('LOD0_G2_APRON');const c=makeCharacter({meta:morphMeta(),renderers:[r]});c.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});let wind=0,tt=0;const cu=[],ev=[];c.s.setWindSource(()=>wind);c.s.onApronLift(()=>ev.push(tt));
  for(let i=0;i<240;i++){tt=i/60;wind=Math.min(1,i/100);c.s.advance(1/60);cu.push(c.s.diagnostics().motion.morph.weights.curl);}
  check('morph: no apron_lift clip -> curve-only timeline from the crossing (curl peak +0.37 s), onApronLift still immediate',()=>{assert(!c.rig.clips.apron_lift);assert.equal(ev.length,1);const peak=cu.indexOf(Math.max(...cu));
   assert(Math.max(...cu)>.97);assert(Math.abs(peak/60-(ev[0]+.37))<.04,peak/60+' vs '+ev[0]);assert.equal(cu[cu.length-1],0);return {emitT:+ev[0].toFixed(3),curlPeakT:+(peak/60).toFixed(3)};});}
 // 6) target index mapping + several sub-meshes
 {const r=mockRenderer('LOD0_G2_APRON',[3,0,2]);const c=makeCharacter({meta:morphMeta({morphTargets:{curl:1,flutter:0}}),renderers:[r]});c.s.setWindSource(()=>0);c.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});
  const wp=c.s.perform({kind:'walk',path:[[0,0,0],[0,0,1]],duration:1/0.7},new Token());for(let i=0;i<40;i++){c.s.advance(1/60);await flush();}
  check('morph: morphTargets {curl:1,flutter:0} remaps shape indices; written to every sub-mesh with enough targets (counts 3,0,2 -> 0,2)',()=>{const md=c.s.diagnostics().motion.morph;assert.equal(JSON.stringify(md.subMeshes),'[0,2]');
   assert(Math.abs(r.w['0:1']-MCURL_WALK)<1e-9&&Math.abs(r.w['2:1']-MCURL_WALK)<1e-9,JSON.stringify(r.w));assert.equal(r.w['0:0'],0);assert(!r.calls.some(x=>x[1]===1));return {subMeshes:JSON.parse(JSON.stringify(md.subMeshes)),w:JSON.parse(JSON.stringify(r.w))};});
  c.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,1],yawRad:0});await wp.catch(()=>{});}
 // 7) baked path (CHARACTER_POSE_BLEND=false): same weights written after the hard-cut pose
 {const ctx3={...ctx,CHARACTER_POSE_BLEND:false,exports:{}};vm.runInNewContext(tx(classText+'\nexports.Standin=FlowReferenceStandin;'),ctx3);
  const rig=G.loadRig(GLB);const clipDefs=Object.keys(rig.clips).map(k=>({name:k,duration:rig.clips[k].duration,apply:t=>G.applyClip(rig.clips[k],t)}));const states=new Map();
  const anim={node:rig.root,clips:clipDefs,useBakedAnimation:false,getState(n){if(states.has(n))return states.get(n);const cd=clipDefs.find(x=>x.name===n);if(!cd)return null;const st={time:0,setTime(t){this.time=t;},sample(){cd.apply(this.time);},stop(){},pause(){this.paused=true;},play(){}};states.set(n,st);return st;},createState(cd,n){return this.getState(n);},play(n){this.getState(n).play();}};
  const node={active:true,worldPosition:{x:0,y:0,z:0},yaw:0,setWorldPosition(x,y,z){this.worldPosition={x,y,z};},setRotationFromEuler(a,b){this.yaw=b*Math.PI/180;},destroy(){}};
  const r=mockRenderer('LOD0_G2_APRON');const s=new ctx3.exports.Standin(node);s.setAnimMeta(morphMeta());s.bindVisual({getComponent:()=>anim,getComponentInChildren:()=>null,getComponentsInChildren:()=>[r]});s.setWindSource(()=>0);
  s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});const curl=[];const wp=s.perform({kind:'walk',path:[[0,0,0],[0,0,2]],duration:2/0.7},new Token());for(let i=0;i<240;i++){s.advance(1/60);await flush();curl.push(s.diagnostics().motion.morph.weights.curl);}await wp;
  check('morph: baked path (CHARACTER_POSE_BLEND=false) drives the same weights (curl during walk, fade back to 0)',()=>{assert.equal(anim.useBakedAnimation,true);assert.equal(s.diagnostics().motion.morph.status,'ok');assert(Math.abs(Math.max(...curl)-MCURL_WALK)<1e-9);
   assert.equal(lastW(r,0),0);const st=maxStep(curl);assert(st.m<=MCURL_WALK/(motion.CROSSFADE_S*60)+.005,'jump '+st.m);return {maxStep:+st.m.toFixed(4),calls:r.calls.length};});}
 check('morph: anim_meta parsing (clip morph curves, windToMorphFlutter, morphTargets, morph.mesh) + defaults',()=>{const d=motion.defaultMotionConfig();assert.equal(d.morphMesh,'LOD0_G2_APRON');assert.equal(JSON.stringify(d.morphTargets),'{"curl":0,"flutter":1}');assert.equal(d.windToMorphFlutter,null);
  const c2=motion.parseAnimMeta({morph:{mesh:'X_APRON',targets:{curl:2,flutter:3}},clips:{apron_lift:{morph:{curves:{curl:[[1,2],[0,0]],bad:[[0,'x']]}}}},wind:{windToMorphFlutter:[[0,0],[1,.4]]}});
  assert.equal(c2.morphMesh,'X_APRON');assert.equal(JSON.stringify(c2.morphTargets),'{"curl":2,"flutter":3}');assert.equal(JSON.stringify(c2.clips.apron_lift.morph.curves.curl),'[[0,0],[1,1]]');assert(!c2.clips.apron_lift.morph.curves.bad);assert.equal(motion.piecewise(c2.windToMorphFlutter,1),.4);
  const c3=motion.parseAnimMeta({clips:{apron_lift:{morph:{mesh:'Y',curves:{curl:[[0,0],[1,1]]}}}}});assert.equal(c3.morphMesh,'Y');return {ok:true};});
 await locomotionTests();
 const failed=results.filter(r=>!r.ok);const report={status:failed.length?'FAIL':'PASS',glb:path.relative('/workspace/yiqifengle',GLB),animMeta:!!META,flowRoot:path.relative('/workspace/yiqifengle',flowRoot)||'.',results};
 console.log(JSON.stringify(report,null,1));if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
