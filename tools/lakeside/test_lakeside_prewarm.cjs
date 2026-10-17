// v3.3 first-entry hitch (Mac v3.2: 1683 ms frame on the first lake entry): lakeside assets are warmed when the 风铃湖畔 chapter opens.
const fs=require('fs'),path=require('path'),assert=require('assert');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts'),rd=f=>fs.readFileSync(path.join(S,f),'utf8');
const bg=rd('region/LakesideBoardBackground.ts'),ov=rd('world-r2/IslandJourneyOverlay.ts'),boot=rd('WorldIntegrationBoot.ts');
assert(/export function prewarmLakesideAssets\(\):Promise<void>\{\n if\(prewarm\)return prewarm\.promise;/.test(bg),'one prewarm at a time');
for(const re of [/keep\(await loadJson\(b,LAKESIDE_TRANSFORMS\)\)/,/for\(const p of await loadPrefabs\(b\)\)keep\(p\)/,/keep\(await loadLakesideWaterAsset\(b\)\)/])assert(re.test(bg),String(re));
assert(/if\(a&&prewarm===st\)\{a\.addRef\(\);st\.held\.push\(a\);\}/.test(bg),'no refs kept after release');
assert(/st\.timer=setTimeout\(releaseLakesidePrewarm,120000\)/.test(bg),'released if never used');
assert(/releaseLakesidePrewarm\(\);\n  camera\.priority=44;/.test(bg),'lease drops prewarm refs after taking its own');
assert(/catch\(error\)\{try\{console\.warn\('\[QF_LAKESIDE\] '\+JSON\.stringify\(\{event:'prewarm-failed'/.test(bg),'never throws');
assert(/if\(this\.gate\(region\)\?\.ok\)\{try\{this\.options\.prewarm\?\.\(region\);\}catch\{\}\}/.test(ov),'only for an open chapter');
assert(/prewarm:id=>\{if\(id==='lake'\)void prewarmLakesideAssets\(\);\}/.test(boot));
// behaviour of release on stand-ins
const body=bg.match(/export function releaseLakesidePrewarm\(\)\{([^\n]*)\}\n/)[1];
let n=0;const st={held:[{decRef(){n++;}},{decRef(){n++;}}],timer:null};
new Function('ctx','let prewarm=ctx;'+body)(st);assert.equal(n,2);
console.log('lakeside prewarm OK');
