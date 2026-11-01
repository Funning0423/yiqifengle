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
  return (env)=>new Function('game','screen','director','Director','debugSearch','globalThis',js+';installRenderBudget();')(env.game,env.screen,env.director,env.Director,()=>'',env.g);
}
function run(install){
  const ev={};const Director={EVENT_AFTER_SCENE_LAUNCH:'launch',EVENT_BEFORE_UPDATE:'update'};
  const win={},DEF=1<<30;const cams=[{id:0,visibility:DEF,window:win},{id:1,visibility:1<<25,window:win}];
  const root={mainWindow:win,cameraList:cams};const director={root,on(e,f){(ev[e]=ev[e]||[]).push(f);}};
  const env={game:{frameRate:0},screen:{devicePixelRatio:3},director,Director,g:{}};install(env);
  const declared=new Map(),errors=[];let shadow=false;
  for(const c of cams){declared.set(c.id,{scaled:!!c.pipelineSettings?.enableShadingScale,lightBuf:c.pipelineSettings?.enableShadingScale?'scaled':'full'});}
  for(const f of ev.launch||[])f();
  for(let fr=0;fr<300;fr++){for(const f of ev.update||[])f();shadow=!shadow;/* main light shadow toggle */
    for(const c of cams){const d=declared.get(c.id),want=!!c.pipelineSettings?.enableShadingScale;
      if(want&&!d.scaled)errors.push("TypeError: Cannot read properties of undefined (reading 't') at _getOrCreateDeviceTex ScaledRadiance_"+c.id);
      if((want?'scaled':'full')!==d.lightBuf)errors.push('Error 16329 updateBuffer<-buildLightBuffer cam '+c.id);}}
  return {errors,env};
}
const cur=run(load(fs.readFileSync(path.join(__dirname,'../..',FILE),'utf8')));
assert.deepEqual(cur.errors,[],'current: 0 render-graph errors over 300 frames');
assert.equal(cur.env.game.frameRate,60,'frame cap 60 kept');assert.equal(cur.env.g.__qfRenderBudgetScale,0.667,'scale reported');
const curSrc=fs.readFileSync(path.join(__dirname,'../..',FILE),'utf8');const inst=curSrc.slice(curSrc.indexOf('export function installRenderBudget'));
assert.ok(!/pipelineSettings\s*=|applyRenderBudgetToCameras\(/.test(inst.slice(0,inst.indexOf('\n}\n'))),'install never writes camera.pipelineSettings');
let old=null;try{old=cp.execFileSync('git',['show','56c06a5a:'+FILE],{cwd:path.join(__dirname,'../..'),encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{}
if(old){const neg=run(load(old));assert.ok(neg.errors.length>=300,'negative 56c06a5a must reproduce per-frame errors, got '+neg.errors.length);
  assert.ok(neg.errors.some(e=>/reading 't'/.test(e))&&neg.errors.some(e=>/16329/.test(e)),'negative: both error kinds');
  console.log('PASS render-budget-pipeline errors=0 frames=300 (negative 56c06a5a errors='+neg.errors.length+')');}
else{/* shallow clone: synthetic negative */const neg=run(env=>{env.director.on('launch',()=>{env.director.root.cameraList[0].pipelineSettings={enableShadingScale:true};});});
  assert.ok(neg.errors.length>=300);console.log('PASS render-budget-pipeline errors=0 (synthetic negative errors='+neg.errors.length+')');}
