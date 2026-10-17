// water-ref candidate (VB): the [QF_LAKE_DIAG] print is gated: cc/env DEBUG (false in release) AND ?lakediag=1, once, at the board
// light apply; it never runs or prints otherwise; failures console.error, no silent fallback.
const fs=require('fs'),path=require('path'),assert=require('assert');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const src=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/LakesideBoardBackground.ts'),'utf8');
assert(/^import \{DEBUG\} from 'cc\/env';$/m.test(src),'DEBUG from cc/env');
const fn=src.match(/export function lakesideDiagEnabled\([^)]*\):boolean\{[^\n]*\}/)[0];
const m={exports:{}};new Function('module','exports',ts.transpileModule(fn,{compilerOptions:{module:1,target:7}}).outputText)(m,m.exports);
const on=m.exports.lakesideDiagEnabled;
assert.equal(on(false,'?lakediag=1'),false,'release (DEBUG false) never');assert.equal(on(true,''),false,'debug without the switch: off');
assert.equal(on(true,null),false);assert.equal(on(true,'?lakediag=0'),false);assert.equal(on(true,'?xlakediag=1'),false);
assert.equal(on(true,'?lakediag=1'),true);assert.equal(on(true,'?a=1&lakediag=1&b=2'),true);
const once=src.match(/function lakesideDiagOnce\([\s\S]*?\n catch\(error\)\{[^\n]*\}\}/)[0];
assert(/if\(lakeDiagDone\)return;/.test(once)&&/if\(!lakesideDiagEnabled\(DEBUG,q\)\)return;lakeDiagDone=true;/.test(once),'gate before anything else, once');
assert(once.indexOf('console.log')>once.indexOf('lakesideDiagEnabled(DEBUG,q)'),'print only after the gate');
assert((src.match(/\[QF_LAKE_DIAG\]/g)||[]).length===2&&(once.match(/\[QF_LAKE_DIAG\]/g)||[]).length===2,'no other diag print');
assert(/console\.error\('\[QF_LAKE_DIAG\] '\+JSON\.stringify\(\{event:'diag-failed'/.test(once),'errors are logged');
for(const k of ['isHDR','toneMappingType','exposure','mainLightIlluminance','skyIllum','usePostProcess'])assert(once.includes(k+':'),k);
assert.equal((src.match(/lakesideDiagOnce\(camera,l,amb\);/g)||[]).length,1,'one call site (applyDir)');
console.log('lakeside diag OK (gated by DEBUG && ?lakediag=1)');
