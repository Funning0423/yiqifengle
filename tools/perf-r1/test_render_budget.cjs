'use strict';
/** perf-r1 #4 gate: frame cap 60 (never 30), effective DPR ≤2 via per-camera shadingScale on main-window 3D cameras only,
 *  full settings object (pipeline reads bloom/fxaa/... directly), RT/UI-only cameras untouched, fullres=1 kill switch, no host API.
 *  Negative cases: partial settings object, DPR 3 left unscaled, frameRate 30, RT camera scaled → must be rejected. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/ui/DevPreviewMark.ts'),'utf8');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const body=src.slice(src.indexOf('export const RENDER_BUDGET'),src.indexOf('export function installRenderBudget'));
const js=ts.transpileModule(body.replace(/export /g,''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText+';({RENDER_BUDGET,budgetShadingScale,budgetCamera,applyRenderBudgetToCameras,budgetPipelineSettings,fullResRequested})';
const M=eval(js);
function verify(M){
  assert.equal(M.RENDER_BUDGET.frameRate,60,'target 60 fps');assert.ok(M.RENDER_BUDGET.maxDpr<=2,'effective DPR ≤2');
  assert.equal(M.budgetShadingScale(3),0.666);assert.equal(M.budgetShadingScale(2),1);assert.equal(M.budgetShadingScale(1),1);assert.equal(M.budgetShadingScale(NaN),1);
  const st=M.budgetPipelineSettings(0.666);for(const k of ['msaa','bloom','toneMapping','colorGrading','fsr','fxaa'])assert.ok(st[k],'settings.'+k);
  for(const k of ['msaa','bloom','colorGrading','fsr','fxaa'])assert.equal(st[k].enabled,false,k+' stays off (no art change)');
  const win={},rt={},DEF=1<<30,UI=1<<25;
  const cams=[{visibility:DEF|UI,window:win},{visibility:UI,window:win},{visibility:DEF,window:rt},{visibility:DEF,window:win,pipelineSettings:{own:1}}];
  const root={mainWindow:win,cameraList:cams};
  assert.equal(M.applyRenderBudgetToCameras(root,0.667),1);assert.equal(cams[0].pipelineSettings.shadingScale,0.667);
  assert.equal(cams[1].pipelineSettings,undefined,'UI-only camera untouched');assert.equal(cams[2].pipelineSettings,undefined,'RT camera untouched');
  assert.deepEqual(cams[3].pipelineSettings,{own:1},'own settings kept');assert.equal(M.applyRenderBudgetToCameras(root,0.667),0,'idempotent');
  assert.equal(M.applyRenderBudgetToCameras(root,1),0,'scale 1 → nothing');
  assert.equal(M.fullResRequested('?fullres=1'),true);assert.equal(M.fullResRequested(''),false);assert.equal(M.fullResRequested('?nofullres=1'),false);
}
verify(M);
const neg=[['frameRate 30',{...M,RENDER_BUDGET:{...M.RENDER_BUDGET,frameRate:30}}],['DPR 3 unscaled',{...M,budgetShadingScale:()=>1}],
 ['partial settings',{...M,budgetPipelineSettings:s=>({enableShadingScale:true,shadingScale:s})}],
 ['RT camera scaled',{...M,applyRenderBudgetToCameras:(r,s)=>{let n=0;for(const c of r.cameraList){if(!c.pipelineSettings){c.pipelineSettings={shadingScale:s};n++;}}return n;}}]];
for(const [name,m] of neg){let failed=false;try{verify(m);}catch{failed=true;}assert.ok(failed,'negative must fail: '+name);}
const inst=src.slice(src.indexOf('export function installRenderBudget'));
assert.ok(!/wx\.|Sync\(|localStorage/.test(inst),'install: no direct host API (flags via cached debugSearch)');
assert.match(src,/\ninstallRenderBudget\(\);/,'installed at import');
console.log('PASS render-budget frameRate=60 maxDpr=2 scale@dpr3=0.666 negatives=4');
