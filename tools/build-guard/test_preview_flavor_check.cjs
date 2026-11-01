'use strict';
// J7 (204e4d83): preview-flavor --check must read the flag in the shape Cocos really emits. Real WeChat build (box test report
// 20261030T2029_diag-7e0f2c72-clean/bx/wechat-test/subpackages/main/game.js) emits module consts via the SystemJS exporter:
//   var v=a("SEA_REVEAL_DEFAULT",!1);  t("CHARACTER_POSE_BLEND",!0)  y=t("AMBIENCE_BED_REF",.4)
// Fixtures use that exact shape with the flag name. Positives: exporter !0 / true, both quote styles, plain `=` form.
// Negatives: missing, !1, false, mixed (one true + one false), non-literal value, name-prefix lookalike, old regex on real shape.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const PF=require('./preview-flavor.cjs'),CLI=path.join(__dirname,'preview-flavor.cjs');
const real=v=>`var n=Math.hypot(a[0],a[1],a[2])||1;System.register("chunks:///_virtual/PreTransitionKeys.ts",["cc"],(function(t){"use strict";return{execute:function(){a("SEA_STANDIN_PREFAB","x");var v=t("QF_DEVICE_PREVIEW",${v}),q=t("QF_DEVICE_PREVIEW_PRE","journal-sky-gated");}}}));`;
const run=files=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'pfc-'));for(const [n,t] of Object.entries(files)){const p=path.join(d,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,t);}
 const lib=PF.check(d),r=cp.spawnSync(process.execPath,[CLI,'--check',d],{encoding:'utf8'});fs.rmSync(d,{recursive:true,force:true});return {lib,code:r.status,out:r.stdout.trim()};};
const M='subpackages/main/game.js',OLD=/QF_DEVICE_PREVIEW\s*=\s*(?:true|!0)/;
const pass=[['exporter !0 (minified, real shape)',{[M]:real('!0')}],['exporter true',{[M]:real('true')}],["exporter single quotes",{[M]:real('!0').replace('"QF_DEVICE_PREVIEW"',"'QF_DEVICE_PREVIEW'")}],
 ['plain = !0',{'game.js':'var QF_DEVICE_PREVIEW=!0;'}],['plain = true',{'game.js':'const QF_DEVICE_PREVIEW = true;'}]];
const fail=[['missing',{[M]:real('!0').replace(/t\("QF_DEVICE_PREVIEW",!0\),/,'')}],['exporter !1',{[M]:real('!1')}],['exporter false',{[M]:real('false')}],
 ['plain = false',{'game.js':'var QF_DEVICE_PREVIEW=!1;'}],['mixed true + false',{[M]:real('!0'),'other/game.js':real('!1')}],
 ['non-literal value',{[M]:real('x')}],['lookalike name only',{[M]:'t("QF_DEVICE_PREVIEW_PRE",!0);var QF_DEVICE_PREVIEWX=!0;'}],['true only in a .json',{'x.json':'{"QF_DEVICE_PREVIEW":true}'}],['no js at all',{}]];
for(const [n,f] of pass){const r=run(f);assert(r.lib.length>0&&r.code===0&&/^PASS preview-flavor check files=/.test(r.out),'should PASS: '+n+' '+JSON.stringify(r));}
for(const [n,f] of fail){const r=run(f);assert(r.lib.length===0&&r.code===1&&/^FAIL preview-flavor check files=-/.test(r.out),'should FAIL: '+n+' '+JSON.stringify(r));}
assert(!OLD.test(real('!0')),'negative: the 204e4d83 regex misses the real exporter shape (the J7 blind spot)');
assert.deepEqual(PF.flagDefs(real('!0')+real('!1')),[true,false]);
// guard keeps the failed preview output for inspection
const sh=fs.readFileSync(path.join(__dirname,'build-wechat-guarded.sh'),'utf8');assert(/--check "\$dest" \|\| \{ kept="\$P\/build\/\$out-preview-FAILED"; rm -rf "\$kept"; cp -R "\$dest" "\$kept"/.test(sh),'guard copies the failed preview output to build/<out>-preview-FAILED');
console.log(`PASS preview-flavor-check: ${pass.length} real/legacy shapes PASS (exporter t("QF_DEVICE_PREVIEW",!0) etc.), ${fail.length} negatives FAIL (missing, !1, false, mixed, non-literal, lookalike, json-only, empty); old regex misses the exporter shape; failed output kept`);
