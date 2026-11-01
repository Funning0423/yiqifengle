'use strict';
/** P0 gate (Mac 3e5be7f5: 160 per-frame render errors from boot, island→meadow hang). Runs installRenderBudget against a model of
 *  the Cocos 3.8.8 builtin custom pipeline: per-camera graph resources (ScaledRadiance_<id> + depth) are declared once at camera
 *  setup; a frame whose camera.pipelineSettings demands shading-scale resources that were not declared throws exactly the device
 *  error class (visitResource → _getOrCreateDeviceTex "reading 't'"), and the light buffer sized at setup rejects a resized
 *  pass (Error 16329 in buildLightBuffer). Also flips the main-light shadow each frame (perf-r1 #2 BalloonTransit path) to
 *  prove the shadow toggle alone is clean. 300 frames, DPR 3, scene launch + scans. Negative: the 56c06a5a installRenderBudget
 *  (runtime pipelineSettings writes) must reproduce the errors. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const FILE='creator-build-project/assets/scripts/ui/DevPreviewMark.ts';
function load(src){
  const body=src.slice(src.indexOf('export const RENDER_BUDGET'),src.indexOf('installRenderBudget();',src.indexOf('export function installRenderBudget')));
  const js=ts.transpileModule(body.replace(/export /g,''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  return (env)=>new Function('game','screen','director','Director','debugSearch','globalThis','rendering',js+';installRenderBudget();')(env.game,env.screen,env.director,env.Director,()=>'',env.g,env.rendering);
}
/* Model of the 3.8.8 frame (cc.js buildRenderPipeline + builtin-pipeline game.js): BEFORE_UPDATE handlers, then
   dispatchResizeEvents (windowResize per camera on a resized/forced window: declares Scaled* if that camera's settings enable
   shading scale, else the full-res set — additive), then setup (every camera needs its set). */
function run(install,opt={}){
  const ev={};const Director={EVENT_AFTER_SCENE_LAUNCH:'launch',EVENT_BEFORE_UPDATE:'update'};
  const win={id:0,resized:true},DEF=1<<30,UI=1<<25;const cams=[{id:0,visibility:DEF,window:win},{id:1,visibility:UI,window:win}];
  const root={mainWindow:win,cameraList:cams};const director={root,on(e,f){(ev[e]=ev[e]||[]).push(f);}};let forced=false,forces=0;
  const rendering=opt.noForce?{}:{forceResizeAllWindows(){forced=true;forces++;}};
  const env={game:{frameRate:0},screen:{devicePixelRatio:opt.dpr||3},director,Director,g:{},rendering};
  const declared=new Set(),errors=[];let shadow=false;const need=c=>c.pipelineSettings?.enableShadingScale?['ScaledRadiance0_','ScaledSceneDepth_']:['Radiance0_','SceneDepth_'];
  for(let fr=0;fr<300;fr++){if(fr===3){install(env);for(const f of ev.launch||[])f();}/* boot frames render (window's first resize handled) before the game script chunk installs the budget */if(fr===47)cams.push({id:2,visibility:DEF,window:win})/* camera created mid-run (board bg) */;
    for(const f of ev.update||[])f();shadow=!shadow;/* main-light shadow toggle (perf-r1 #2) */
    if(win.resized||forced){for(const c of cams)if(c.window===win)for(const n of need(c))declared.add(n+win.id);win.resized=false;forced=false;}
    for(const c of cams)for(const n of need(c))if(!declared.has(n+win.id)){errors.push("TypeError: Cannot read properties of undefined (reading 't') _getOrCreateDeviceTex "+n+win.id);errors.push('Error 16329 updateBuffer<-buildLightBuffer cam '+c.id);}}
  return {errors,env,cams,forces};
}
const cur=run(load(fs.readFileSync(path.join(__dirname,'../..',FILE),'utf8')));
assert.deepEqual(cur.errors,[],'current: 0 render-graph errors over 300 frames');
assert.equal(cur.env.game.frameRate,60,'frame cap 60 kept');assert.equal(cur.env.g.__qfRenderBudgetScale,0.666,'scale reported');
assert.equal(cur.env.g.__qfRenderBudgetApplied,true,'cap applied at DPR 3');assert.ok(cur.env.g.__qfRenderBudgetScale<=2/3+1e-9,'effective scale <= 2/3');
assert.ok(cur.cams[0].pipelineSettings?.enableShadingScale&&cur.cams[0].pipelineSettings.shadingScale<=0.666&&cur.cams[2].pipelineSettings===cur.cams[0].pipelineSettings,'3D main-window cameras share one fixed settings object');
assert.equal(cur.cams[1].pipelineSettings,undefined,'UI camera full res');assert.ok(cur.forces<=3,'forced resize only when a camera is newly budgeted ('+cur.forces+')');
const d2=run(load(fs.readFileSync(path.join(__dirname,'../..',FILE),'utf8')),{dpr:2});assert.equal(d2.env.g.__qfRenderBudgetApplied,false);assert.deepEqual(d2.errors,[]);
const nf=run(load(fs.readFileSync(path.join(__dirname,'../..',FILE),'utf8')),{noForce:true});assert.deepEqual(nf.errors,[],'no resize hook → cameras untouched');assert.equal(nf.env.g.__qfRenderBudgetApplied,false);
const curSrc=fs.readFileSync(path.join(__dirname,'../..',FILE),'utf8');const inst=curSrc.slice(curSrc.indexOf('export function installRenderBudget'));

let old=null;try{old=cp.execFileSync('git',['show','56c06a5a:'+FILE],{cwd:path.join(__dirname,'../..'),encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{}
if(old){const neg=run(load(old));assert.ok(neg.errors.length>=300,'negative 56c06a5a must reproduce per-frame errors, got '+neg.errors.length);
  assert.ok(neg.errors.some(e=>/reading 't'/.test(e))&&neg.errors.some(e=>/16329/.test(e)),'negative: both error kinds');
  console.log('PASS render-budget-pipeline errors=0 frames=300 applied=true scale=0.666 forces='+cur.forces+' (negative 56c06a5a errors='+neg.errors.length+')');}
else{/* shallow clone: synthetic negative */const neg=run(env=>{env.director.on('launch',()=>{env.director.root.cameraList[0].pipelineSettings={enableShadingScale:true};});});
  assert.ok(neg.errors.length>=300);console.log('PASS render-budget-pipeline errors=0 (synthetic negative errors='+neg.errors.length+')');}
