'use strict';
// U1 retime (2026-10-29) constants + registry: every entry's symbol exists in its file; changed values are what the registry says.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=path.resolve(__dirname,'../../creator-build-project'),R=require('./known-timings.json'),src=f=>fs.readFileSync(path.join(C,f),'utf8');
for(const e of R.entries){const s=src(e.file),name=e.symbol.split(/[\s/(]/)[0];assert.ok(s.includes(name),e.file+' has '+name);}
assert.match(src('assets/scripts/ui/RegionArrivalTitleCore.ts'),/inS: 0\.4, holdS: 1\.35, outS: 0\.25/);
const L=src('assets/scripts/region/LakesideArrivalCore.ts');assert.match(L,/inS:\.3,outS:\.2,revealSignS:\.3/);assert.match(L,/const k=easeInQuad\(o\/spec\.outS\)/);
const S=src('assets/scripts/ui/StartupLoadingLayout.ts');assert.match(S,/OUTRO_FADE_S = 0\.45;/);assert.match(S,/1 - easeInOutCubic\(this\.outroT \/ OUTRO_FADE_S\)/);
const M=src('assets/scripts/ManagedMobileBoardUI.ts');assert.match(M,/const TOAST_OUT_S = 0\.15;/);assert.match(M,/private toastFade = 0\.2;/);assert.match(M,/say\(text: string, fade = 0\.2/);assert.match(M,/\(this\.toastT - e\) \/ TOAST_OUT_S/);
assert.match(src('assets/scripts/ui/BoardPanels.ts'),/SCORE_EASE_S = 0\.20;/);
console.log('PASS ui-timing registry ('+R.entries.length+' entries) + U1 retime constants');
