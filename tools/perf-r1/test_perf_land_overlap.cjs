'use strict';
/** perf-land gate (perf-r1 onto integrate bg2): (1) TransitionShaderWarm stays default OFF and byte-identical to the integrate
 *  reference (PR #66 / dc248d14) — never reopened by perf work; (2) region release never frees region_lakeside while the
 *  root-less chapter-page prewarm (pin) or the board-preload holder still hold its assets. Negatives: TSW=true source and an
 *  unpinned prewarm must FAIL. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts');
const tsw=fs.readFileSync(path.join(S,'region/TransitionShaderWarm.ts'),'utf8');
const tswOff=t=>/export let TRANSITION_SHADER_WARM_ENABLED=false;/.test(t)&&!/TRANSITION_SHADER_WARM_ENABLED\s*=\s*true/.test(t.replace(/setTransitionShaderWarmEnabled[\s\S]*$/,''));
assert.ok(tswOff(tsw),'TSW default OFF');
assert.ok(!tswOff(tsw.replace('ENABLED=false;','ENABLED=true;')),'negative: TSW=true detected');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(S,'region/TransitionShaderWarm.ts'))).digest('hex'),'59d9c96d7d3661b6e505be1a303a7d684cafeb8ae00aacaaf608737bace7d8a4','TSW byte-identical to integrate e976a733');
const full=fs.readFileSync(path.join(S,'region/RegionLoader.ts'),'utf8');const src=full.slice(full.indexOf('/* ===== perf-r1 #3 region asset release ===== */'));
const js=ts.transpileModule('const assetManager=null;const isValid=(n)=>!!n&&!n.destroyed;'+src,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
delete globalThis.__qfRegionPins;delete globalThis.__qfRegionRoots;
const m={exports:{}};new Function('module','exports','console',js)(m,m.exports,{log(){},warn(){}});const R=m.exports;
const pins=globalThis.__qfRegionPins;assert.ok(pins instanceof Map,'pin map shared on globalThis');
assert.ok(R.planRegionRelease('island',{}).includes('lakeside'),'negative: unpinned, unmounted lakeside is releasable');
pins.set('lakeside',1);assert.ok(!R.planRegionRelease('island',{}).includes('lakeside'),'pinned prewarm blocks lakeside release');
pins.set('lakeside',0);const holder={destroyed:false};globalThis.__qfRegionRoots.add({key:'lakeside',node:holder});
assert.ok(!R.planRegionRelease('island',{}).includes('lakeside'),'board-preload holder blocks lakeside release');
holder.destroyed=true;assert.ok(R.planRegionRelease('island',{}).includes('lakeside'),'destroyed holder frees it');
const lb=fs.readFileSync(path.join(S,'region/LakesideBoardBackground.ts'),'utf8');
assert.match(lb,/pins\.set\('lakeside',\(pins\.get\('lakeside'\)\|\|0\)\+1\)/,'prewarm pins');
assert.match(lb,/function releaseLakesidePrewarm[^\n]*Reflect\.get\(globalThis,'__qfRegionPins'\)[^\n]*pins\.set\('lakeside',Math\.max\(0/,'prewarm release unpins');
assert.match(lb,/new Node\('LakesideBoardPreload'\);\(\(globalThis as any\)\.__qfRegionRoots\|\|=new Set\(\)\)\.add\(\{key:'lakeside',node:holder\}\)/,'preload holder registered');
assert.match(lb,/new Node\(LAKESIDE_NODES\.rig\);\(\(globalThis as any\)\.__qfRegionRoots/,'kit board rig registered');
console.log('PASS perf-land-overlap tsw-off+identical lakeside pin/holder negatives=2');
