'use strict';
// P2 (Mac full5 06:01:04 home→island: "[WarmButton] Frame creation failed: Button RT did not produce both opaque faces").
// The bake read the RT on the first AFTER_DRAW; on a heavy frame the newly enabled bake camera had not rendered yet.
// Now the same bake waits up to WARM_BAKE_RETRIES more frames before the flat fallback + warn. Real module (pure helper) + source checks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,SRC}=require('../t9-island-props/load_ts.cjs');
const src=fs.readFileSync(path.join(SRC,'ui/WarmButtonSkin.ts'),'utf8');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const head=src.slice(0,src.indexOf('type Entry='));const m={exports:{}};
new Function('exports','module',ts.transpileModule(head.replace(/^import[^\n]*\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m.exports,m);
const {warmFacesOpaque,WARM_BAKE_RETRIES}=m.exports;
const row=(w,a,b)=>{const r=new Uint8Array(w*2*4);r[Math.floor(w/2)*4+3]=a;r[Math.floor(w*1.5)*4+3]=b;return r;};
assert.equal(warmFacesOpaque(row(100,255,255),100),true);assert.equal(warmFacesOpaque(row(100,0,0),100),false);assert.equal(warmFacesOpaque(row(100,255,10),100),false);
assert.equal(warmFacesOpaque(null),false);assert.equal(warmFacesOpaque(new Uint8Array(4),100),false);assert.equal(warmFacesOpaque(row(64,255,255)),true,'width inferred');
console.log('PASS warmFacesOpaque: both faces opaque at the centre row');
assert(WARM_BAKE_RETRIES>=1&&WARM_BAKE_RETRIES<=3,'bounded retries');
assert(/if\(live&&\(e\.tries\|\|0\)<WARM_BAKE_RETRIES&&!warmFacesOpaque\(row0\)\)\{e\.tries=\(e\.tries\|\|0\)\+1;director\.once\(Director\.EVENT_AFTER_DRAW,this\.finish,this\);return;\}/.test(src),'transparent first readback re-arms the same bake for the next frame');
assert(src.indexOf('if(live&&(e.tries')<src.indexOf('this.stopDraw();this.current=null;'),'retry happens before the bake camera is stopped');
assert(/const row=row0;\s*if\(!warmFacesOpaque\(row,w\)\)throw Error\('Button RT did not produce both opaque faces'\)/.test(src),'after the retries the old fallback + warn stays');
console.log('PASS bake retry: up to '+WARM_BAKE_RETRIES+' extra frames, then the unchanged flat fallback');
