'use strict';
// full6 Mac FAIL (baf51b13): Error 16352 palette release, prepare-slow prewarm, 70 m straight sky walk, QF_SKY dead instance.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const H=require('../board-ui/harness.cjs').createHarness();
const SRC=p=>fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts',p),'utf8');
const out={};
// 1) Error 16352: the shared LK palette ImageAsset is loaded + pinned before any LK glb prefab loads (CLEANUP_IMAGE_CACHE decRefs)
const lb=SRC('region/LakesideBoardBackground.ts');
assert.match(lb,/function loadPrefabs\(b:AssetManager\.Bundle\)\{return pinLakesidePalette\(b\)\.then\(/);
assert.match(lb,/LAKESIDE_PALETTE_PATH=LAKESIDE_MODELS_DIR\+'\/T_LK_palette_256'/);
assert.match(lb,/b\.load\(LAKESIDE_PALETTE_PATH,ImageAsset,\(e,a\)=>\{if\(!e&&a\)a\.addRef\(\)/);
assert.ok(fs.existsSync(path.join(__dirname,'../../creator-build-project/assets/bundles/region_lakeside/models/T_LK_palette_256.png')));
// every LK glb texture that erred on the Mac points at that one image
const dir=path.join(__dirname,'../../creator-build-project/assets/bundles/region_lakeside/models');let shared=0;
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.glb.meta'))){const t=fs.readFileSync(path.join(dir,f),'utf8');if(t.includes('db://assets/bundles/region_lakeside/models/T_LK_palette_256.png'))shared++;}
assert.ok(shared>=18,'LK glbs sharing the palette: '+shared);out.glbsSharingPalette=shared;
// 2) fallback: the L12 lakeside warm runs the asset prewarm and holds it past the 120 s default
const tp=SRC('region/TransitionPreload.ts');assert.match(tp,/if\(target==='lakeside'\)void prewarmLakesideAssets\(LAKESIDE_L12_HOLD_MS\)/);
assert.match(lb,/export function prewarmLakesideAssets\(holdMs=120000\)/);
// 4) QF_SKY: the backdrop binding re-acquires its instance after a transit restored the shared material
const wf=SRC('world-r1/WorldFlowComponent.ts');assert.match(wf,/const followWrite=\(\)=>\{if\(!live\(\)\)return;/);
assert.match(wf,/instance=renderer\.getMaterialInstance\(0\);blended=false;/);
console.log(JSON.stringify({status:'PASS',...out}));
