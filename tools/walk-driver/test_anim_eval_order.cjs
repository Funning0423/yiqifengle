'use strict';
/** Mac r4 bug (GGbot animfix): girl slid in her bind pose - no walk/sit/door animation - with CHARACTER_POSE_BLEND=true.
 * Cause (Cocos Creator 3.8.8 engine source, /tmp/ce = cocos-engine 3.8.8 411f98d):
 *   animation-component.ts:162-163   onLoad: this.clips = this._clips -> clips setter :77-81 createState(clip) for every clip
 *   animation-component.ts:284-288   createState -> _doCreateState :438-446 -> state.initialize(this.node)
 *   skeletal-animation-state.ts:72-83  initialize: baked = parent.useBakedAnimation; _doNotCreateEval = baked; super.initialize
 *   animation-state.ts:334-336,370-379 initialize builds _clipEval ONLY if !_doNotCreateEval (once: _curveLoaded guard)
 *   skeletal-animation-state.ts:101-113 setUseBaked(false): _curveLoaded=false; super.initialize again - but _doNotCreateEval
 *                                      is still true from :76, so still no _clipEval
 *   animation-state.ts:546-552       _sampleCurves: evaluates only `if (clipEval)` -> sample() writes no joint
 *   skeletal-animation.ts:144-146,360-362 useBakedAnimation setter -> _applyBakeFlagChange -> state.setUseBaked (no states yet
 *                                      before onLoad -> nothing to fix up; states created later read the flag = false)
 * Boot used to add the girl to the scene (onLoad, flag still the prefab's true) and only then set the flag false.
 * This test runs the REAL AnimRig (from WorldIntegrationBoot.ts) against a faithful JS transcription of exactly that engine
 * logic, and checks the mountWorld ordering in the Boot source.
 *   node tools/walk-driver/test_anim_eval_order.cjs [--boot <WorldIntegrationBoot.ts>]   (QF_TYPESCRIPT_MODULE like the others)
 * Exit 0 = PASS. With --boot pointing at the pre-fix Boot (int/v1 484d941) it must FAIL (bug reproduced). */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..','..'),S=path.join(ROOT,'creator-build-project/assets/scripts');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const tx=src=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const args=process.argv.slice(2),bootPath=args.includes('--boot')?path.resolve(args[args.indexOf('--boot')+1]):path.join(S,'WorldIntegrationBoot.ts');
const motion={};vm.runInNewContext(tx(fs.readFileSync(path.join(S,'CharacterMotion.ts'),'utf8')),{exports:motion,Math,Float64Array,RegExp,Object,Array,String,Number,isFinite});
const boot=fs.readFileSync(bootPath,'utf8');const rigText=boot.slice(boot.indexOf('/** Cocos side of the pose pipeline.'),boot.indexOf("@ccclass('WorldIntegrationBoot')"));
/* ---------- faithful mock of the Creator 3.8.8 logic cited above ---------- */
class MNode{constructor(name){this.name=name;this.children=[];this.parent=null;this.components=[];this.inScene=false;this.position={x:0,y:0,z:0};this.rotation={x:0,y:0,z:0,w:1};this.scale={x:1,y:1,z:1};}
  setPosition(x,y,z){this.position={x,y,z};}setRotation(x,y,z,w){this.rotation={x,y,z,w};}setScale(x,y,z){this.scale={x,y,z};}
  addComponent(c){c.node=this;this.components.push(c);return c;}getComponent(k){return this.components.find(c=>c.kind===k)||null;}
  getComponentsInChildren(k){const out=[];const w=n=>{for(const c of n.components)if(c.kind===k)out.push(c);n.children.forEach(w);};w(this);return out;}
  addChild(n){n.parent=this;this.children.push(n);if(this.inScene)activate(n);}}
/** node enters the active scene -> onLoad of its components (then start on the first frame, see run order below). */
function activate(n){n.inScene=true;for(const c of n.components)if(!c._loaded){c._loaded=true;c.onLoad();}n.children.forEach(activate);}
let evalCreated=0;
class MState{constructor(clip,name){this.clip=clip;this.name=name||clip.name;this._curveLoaded=false;this._doNotCreateEval=false;this._curvesInited=false;this.time=0;this._sampleCurves=this._sampleReal;}
  initialize(root){if(this._curveLoaded)return;this._parent=root.getComponent('cc.SkeletalAnimation');const baked=this._parent.useBakedAnimation;  // skeletal-animation-state.ts:72-76
    this._doNotCreateEval=baked;this._baseInitialize(root);this._curvesInited=!baked;this.setUseBaked(baked);}                                  // :77-83
  _baseInitialize(root){if(this._curveLoaded)return;this._curveLoaded=true;this._clipEval=undefined;this._targetNode=root;                     // animation-state.ts:334-353
    if(!this._doNotCreateEval){evalCreated++;this._clipEval={evaluate:t=>this.clip.apply(root,t)};}}                                          // :370-379
  setUseBaked(b){if(b)this._sampleCurves=this._sampleBaked;else{this._sampleCurves=this._sampleReal;if(!this._curvesInited){this._curveLoaded=false;this._baseInitialize(this._targetNode);this._curvesInited=true;}}} // :101-113
  _sampleReal(t){if(this._clipEval)this._clipEval.evaluate(t);}       // animation-state.ts:546-552
  _sampleBaked(t){this.bakedFrame=t;}                                 // skeletal-animation-state.ts:172+: GPU texture frame, no joint writes
  setTime(t){this.time=t;}sample(){this._sampleCurves(this.time);return {time:this.time};}stop(){this.playing=false;}play(){this.playing=true;}pause(){}}
class MSkeletalAnimation{constructor(clips){this.kind='cc.SkeletalAnimation';this._clips=clips;this._useBakedAnimation=true;this._nameToState={};}   // prefab: serialized true
  get clips(){return this._clips;}set clips(v){for(const c of this._clips)if(c)for(const n in this._nameToState)if(this._nameToState[n].clip===c)delete this._nameToState[n];for(const c of v)if(c)this.createState(c);} // animation-component.ts:67-81
  get useBakedAnimation(){return this._useBakedAnimation;}set useBakedAnimation(v){this._useBakedAnimation=v;this._applyBakeFlagChange();}         // skeletal-animation.ts:144-146
  _applyBakeFlagChange(){for(const n in this._nameToState)this._nameToState[n].setUseBaked(this._useBakedAnimation);}                              // :357-362
  onLoad(){this.clips=this._clips;for(const n in this._nameToState)this._nameToState[n].initialize(this.node);}                                  // animation-component.ts:162-167
  start(){this._applyBakeFlagChange();}                                                                                                            // skeletal-animation.ts:184-188
  createState(clip,name){name=name||clip.name;this.removeState(name);const st=new MState(clip,name);if(this.node)st.initialize(this.node);this._nameToState[name]=st;return st;} // :284-288, :438-446
  removeState(name){const st=this._nameToState[name];if(st){st.stop();delete this._nameToState[name];}}                                           // :298-305
  getState(name){return this._nameToState[name]||null;}play(name){const st=this.getState(name);if(st)st.play();}}
/** character: anim node with joints thigh.L (child) and spine; clip rotates them by t (rad) about X. */
function character(){const girl=new MNode('B_PASS2G_CURSOR'),arm=new MNode('Armature'),hips=new MNode('hips'),thigh=new MNode('thigh.L'),spine=new MNode('spine');
  girl.addChild(arm);arm.addChild(hips);hips.addChild(thigh);hips.addChild(spine);
  const mk=(name,dur)=>({name,duration:dur,wrapMode:2,apply(root,t){const a=.5*Math.sin(2*Math.PI*t/dur)+(name==='sit_hold'?.9:0);thigh.setRotation(Math.sin(a/2),0,0,Math.cos(a/2));spine.setRotation(Math.sin(a/4),0,0,Math.cos(a/4));}});
  const anim=arm.addComponent(new MSkeletalAnimation([mk('walk_loop',1.1333),mk('idle_breathing_loop',4),mk('sit_hold',1.29)]));return {girl,anim,thigh,spine};}
const ctx={...motion,AnimationClip:{WrapMode:{Loop:2,Normal:1}},Node:MNode,console:{warn(){},log:console.log},Float64Array,Math,Number,Object,Array,exports:{}};
vm.runInNewContext(tx(rigText+'\nexports.AnimRig=AnimRig;'),ctx);const AnimRig=ctx.exports.AnimRig;
const ang=q=>2*Math.acos(Math.min(1,Math.abs(q.w)))*180/Math.PI;
function scenario(order){const scene=new MNode('scene');scene.inScene=true;const reference=new MNode('FLOW_REFERENCE');scene.addChild(reference);const c=character();evalCreated=0;
  if(order==='fixed'){for(const a of c.girl.getComponentsInChildren('cc.SkeletalAnimation'))a.useBakedAnimation=false;}   // new mountWorld: before addChild
  reference.addChild(c.girl);                                                                                             // onLoad here
  for(const a of c.girl.getComponentsInChildren('cc.SkeletalAnimation'))a.useBakedAnimation=false;                        // old + new: the seated loop
  c.anim.start();
  const rig=new AnimRig(c.anim,true);const t0=ang(c.thigh.rotation);
  const samples=[];for(const t of [0,.14,.28,.42]){rig.apply({base:{clip:'walk_loop',time:t,loop:true},out:null,layers:[]});samples.push({thigh:ang(c.thigh.rotation),spine:ang(c.spine.rotation)});}
  rig.apply({base:{clip:'sit_hold',time:0,loop:true},out:null,layers:[]});
  return {evalCreated,repaired:rig.repaired||null,clipEval:Object.keys(c.anim._nameToState).map(n=>n+':'+!!c.anim._nameToState[n]._clipEval).join(' '),thighRangeDeg:+(Math.max(...samples.map(s=>s.thigh))-Math.min(...samples.map(s=>s.thigh))).toFixed(2),
    spineRangeDeg:+(Math.max(...samples.map(s=>s.spine))-Math.min(...samples.map(s=>s.spine))).toFixed(2),sitThighDeg:+ang(c.thigh.rotation).toFixed(2),restDeg:t0};}
const results=[];const check=(name,fn)=>{try{results.push({name,ok:true,info:fn()});}catch(e){results.push({name,ok:false,error:String(e&&e.message||e)});}};
const oldOrder=scenario('old'),fixed=scenario('fixed');
check('engine mock reproduces the r4 bug: girl added (onLoad, baked) BEFORE useBakedAnimation=false -> states without _clipEval; AnimRig must repair them or bones stay in bind pose',()=>{
  assert(oldOrder.thighRangeDeg>5,'old order: bones did not move (thigh range '+oldOrder.thighRangeDeg+' deg) - this Boot has the r4 bug');assert(oldOrder.repaired&&oldOrder.repaired.length===3,'repaired '+JSON.stringify(oldOrder.repaired));return oldOrder;});
check('fixed order (flag set before the girl enters the scene): every state has an evaluator from onLoad, nothing to repair, walk + sit poses written',()=>{
  assert.equal(fixed.repaired.length,0,JSON.stringify(fixed.repaired));assert(!/false/.test(fixed.clipEval),fixed.clipEval);assert(fixed.thighRangeDeg>5&&fixed.spineRangeDeg>2);assert(fixed.sitThighDeg>40);return fixed;});
check('Boot mountWorld order: useBakedAnimation set on the girl BEFORE reference.addChild(girl)',()=>{const m=boot.slice(boot.indexOf('private async mountWorld'));const a=m.indexOf('useBakedAnimation=!CHARACTER_POSE_BLEND'),b=m.indexOf('reference.addChild(girl)');
  assert(a>=0&&b>=0&&a<b,'flag at '+a+', addChild at '+b);return {flagBeforeAddChild:true};});
const failed=results.filter(r=>!r.ok);console.log(JSON.stringify({status:failed.length?'FAIL':'PASS',boot:path.relative(ROOT,bootPath),results},null,1));if(failed.length)process.exitCode=1;
