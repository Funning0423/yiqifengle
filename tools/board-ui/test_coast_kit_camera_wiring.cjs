'use strict';
/* coast-kit-camera-wiring (coast-kit-int, Grok Bot 10/30 item 4). With the coast kit ON (?qfcoastkit=1) WorldNativeComposition makes
 * enter-level end on CoastBoardLens.coastBoardPose(w,h) via WorldFlowComponent.setEnterLevelEnd; OFF nothing changes.
 * - kitBoardPose(COAST_KIT) = coastBoardPose on all 7 screens (position ≤ 1 mm, same quaternion / FOV 50): one board pose.
 * - WorldNativeComposition: every setEnterLevelEnd call sits behind `coastKit` (region coast AND boardKitFor('coast') ≠ DEFAULT_KIT).
 * - WorldFlowComponent = base 571b6af6 + ONLY the added lines of 运镜bot's diff 01 (no line changed or removed); enterLevelEnd defaults to
 *   null and its branch is guarded, so the default enter-level path is the base code.
 * - No camera writes in BoardKit / BoardProjection / CoastBoardPieces / CompactHud / CoastBoardLens / ManagedMobileBoardUI kit code.
 *   (After-reveal 0 writes and push limits: coast-board-lens gate, 运镜bot.) Self-checks: an unguarded call and a changed WFC line FAIL. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');const {createHarness}=require('./harness.cjs');const H=createHarness();
const ROOT=path.resolve(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts'),rd=f=>fs.readFileSync(path.join(S,f),'utf8');
const K=H.load('ui/BoardKit'),CB=H.load('region/CoastBoardLens');
for(const [w,h] of [[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]]){const a=K.kitBoardPose(K.COAST_KIT.camera,w,h),b=CB.coastBoardPose(w,h);
 a.position.forEach((x,i)=>assert.ok(Math.abs(x-b.position[i])<1e-3,`${w}x${h} kit pose ${a.position} ≠ CoastBoardLens ${b.position}`));assert.equal(a.fovVerticalDeg,b.fovVerticalDeg);assert.deepEqual([...b.target],[...K.COAST_KIT.camera.lookAtWorld]);}
console.log('ok   kitBoardPose = CoastBoardLens.coastBoardPose on 7 screens (≤ 1 mm, FOV 50, same look-at)');
function guarded(src){const calls=[...src.matchAll(/setEnterLevelEnd\?\.\(/g)].map(m=>m.index);if(!calls.length)return false;
 return calls.every(i=>src.slice(Math.max(0,i-90),i).includes('if(coastKit)'))&&/const coastKit=region==='coast'&&boardKitFor\('coast'\)!==DEFAULT_KIT/.test(src);}
const wnc=rd('world-r2/WorldNativeComposition.ts');assert.ok(guarded(wnc),'WorldNativeComposition: setEnterLevelEnd outside the coastKit guard');
assert.ok(!guarded(wnc.replace("if(coastKit){const w=window.innerWidth","{const w=window.innerWidth")),'self-check: unguarded call not detected');
console.log('ok   WorldNativeComposition: setEnterLevelEnd only behind coastKit (self-check: unguarded call detected)');
const base0=cp.execFileSync('git',['show','571b6af6:creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts'],{cwd:ROOT,encoding:'utf8',maxBuffer:64<<20});
/* approved frozen diff 05 (Grok Bot 2026-10-31 04:06 ET, fin e1db013b): reportRuntime diagnostic write async on wx. Base = 571b6af6 + exactly that hunk. */
const D05_OLD="    try {if(event!=='tick')sys.localStorage.setItem('dot-runtime-diagnostics-20261010:world-flow',JSON.stringify(data));}catch(error){console.warn('[OI_WORLD_FLOW] diagnostic storage unavailable',String(error));}";
const D05_NEW=["    // P0 finR: never a sync host write from a world state change; WeChat writes the diagnostic asynchronously.",
 "    try {if(event!=='tick'){const key='dot-runtime-diagnostics-20261010:world-flow',json=JSON.stringify(data),wx=(globalThis as any).wx;",
 "      if(wx&&typeof wx.setStorage==='function')wx.setStorage({key,data:json,fail:(e:any)=>console.warn('[OI_WORLD_FLOW] diagnostic storage unavailable',String(e?.errMsg||e))});",
 "      else sys.localStorage.setItem(key,json);}}catch(error){console.warn('[OI_WORLD_FLOW] diagnostic storage unavailable',String(error));}"].join('\n');
assert.equal(base0.split(D05_OLD).length,2,'diff 05 anchor');const base=base0.replace(D05_OLD,D05_NEW);
const DIFF=fs.readFileSync(path.join(ROOT,'tools/coast-board-lens/01-WorldFlowComponent-enter-level-board-pose.diff'),'utf8');
assert.ok(!/^-[^-]/m.test(DIFF),'diff 01 removes a line');const added=DIFF.split('\n').filter(l=>/^\+[^+]/.test(l)||l==='+').map(l=>l.slice(1));
function onlyAdded(cur){const lines=cur.split('\n'),rest=[];const pool=added.slice();for(const l of lines){const j=pool.indexOf(l);if(j>=0)pool.splice(j,1);else rest.push(l);}return pool.length===0&&rest.join('\n')===base;}
const wfc=rd('world-r1/WorldFlowComponent.ts');assert.ok(onlyAdded(wfc),'WorldFlowComponent ≠ base + diff 01 added lines');assert.ok(!onlyAdded(wfc.replace('holdEnterLevel(on:boolean){this.enterLevelHold=on;}','holdEnterLevel(on:boolean){this.enterLevelHold=!on;}')),'self-check: changed line not detected');
assert.match(wfc,/private enterLevelEnd:\(\(\)=>Pose\)\|null=null;/);assert.match(wfc,/if\(this\.enterLevelEnd\)\{/);
console.log(`ok   WorldFlowComponent = 571b6af6 + ${added.length} added lines of diff 01 only; enterLevelEnd null by default (self-check: changed line detected)`);
const NOWRITE=/setCamera|applyCameraPose|worldCamera\s*=|\.fov\s*=|camera\.node\.set(Position|Rotation|WorldPosition|WorldRotation)/;
for(const f of ['ui/BoardKit.ts','ui/BoardProjection.ts','ui/CoastBoardPieces.ts','ui/CompactHud.ts','region/CoastBoardLens.ts']){const s=rd(f).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');assert.ok(!NOWRITE.test(s),f+' writes the camera');}
{const m=rd('ManagedMobileBoardUI.ts'),k=m.slice(m.indexOf('private layoutKit('),m.indexOf('private cellAt('));assert.ok(k.length>100&&!NOWRITE.test(k)&&!/camera/i.test(k),'ManagedMobileBoardUI kit code touches the camera');}
console.log('ok   no camera writes in the kit / lens modules or the ManagedMobileBoardUI kit branch');
console.log('coast-kit-camera-wiring: PASS');
