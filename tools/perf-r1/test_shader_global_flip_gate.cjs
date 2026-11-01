'use strict';
/** perf-r1 #2 gate: no runtime toggle of scene-global shader macros (CC_SHADOW_TYPE / CC_USE_FOG / CC_USE_HDR …).
 *  A) source: no script writes pipelineSceneData.shadows.enabled from a per-frame path; BalloonTransit toggles only the light.
 *  B) trace verdict (also used on Mac [QF_GPU] SHADER logs): after the first frame with a global set, a builtin-standard compile
 *     whose global macro set differs from the established one = a global flip → FAIL.
 *  Negatives: the b3394140 meadow log (frame 5327 drops CC_SHADOW_TYPE2) and the pre-fix BalloonTransit snippet must FAIL. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts');
const GLOBAL=/^CC_(USE_FOG|SHADOW_TYPE|USE_HDR|SUPPORT_CASCADED_SHADOW_MAP|SHADOWMAP_FORMAT|SHADOWMAP_USE_LINEAR_DEPTH)/;
function flips(log){const rows=[...log.matchAll(/SHADER n=\d+ frame=(\d+) name=(builtin-standard\|\S+)/g)].map(m=>({f:+m[1],g:m[2].split('|').filter(x=>GLOBAL.test(x)).filter(x=>!/SHADOW_TYPE|SHADOWMAP_|CASCADED/.test(x)||true).sort().join('|')}));
 // Shadow-caster passes carry no CC_SHADOW_TYPE by design; compare only lit forward variants (those with CC_USE_HDR).
 const lit=rows.filter(r=>/CC_USE_HDR/.test(r.g));if(!lit.length)return [];const base=lit[0].g;return lit.filter(r=>r.g!==base).map(r=>({frame:r.f,set:r.g,base}));}
function srcViolations(files){const out=[];for(const [f,t] of files){const re=/pipelineSceneData\?*\.shadows;if\(g\)g\.enabled=(?!true;\}catch\{\}\s*\n\s*rig\.active)/g;if(re.test(t)&&/BalloonTransit/.test(f))out.push(f);}return out;}
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.ts')?[path.join(d,e.name)]:[]);
const files=walk(S).map(f=>[f,fs.readFileSync(f,'utf8')]);
assert.deepEqual(srcViolations(files),[],'no transit write to the scene-global shadows flag');
const bt=fs.readFileSync(path.join(S,'region/BalloonTransit.ts'),'utf8');
assert.ok(!/pipelineSceneData\?\.shadows/.test(bt),'BalloonTransit never touches pipelineSceneData.shadows');
assert.match(bt,/shadowEnabled!==wantShadow\)\{try\{\(mainLight as any\)\.shadowEnabled=wantShadow/,'light toggled only on change');
// negative A: pre-fix snippet
const pre="try{const g=(director as any).root?.pipeline?.pipelineSceneData?.shadows;if(g)g.enabled=wantShadow;}catch{}";
assert.equal(srcViolations([['region/BalloonTransit.ts',pre]]).length,1,'negative: pre-fix transit write detected');
// B synthetic positive
const ok='[QF_GPU] SHADER n=1 frame=69 name=builtin-standard|standard-vs|standard-fs|CC_USE_FOG4|CC_SUPPORT_CASCADED_SHADOW_MAP1|CC_USE_HDR1|CC_SHADOWMAP_FORMAT1|CC_SHADOWMAP_USE_LINEAR_DEPTH1|CC_SHADOW_TYPE2\n'+
 '[QF_GPU] SHADER n=2 frame=900 name=builtin-standard|standard-vs|standard-fs|USE_ALBEDO_MAP1|CC_USE_FOG4|CC_SUPPORT_CASCADED_SHADOW_MAP1|CC_USE_HDR1|CC_SHADOWMAP_FORMAT1|CC_SHADOWMAP_USE_LINEAR_DEPTH1|CC_SHADOW_TYPE2\n';
assert.deepEqual(flips(ok),[]);
const bad=ok+'[QF_GPU] SHADER n=3 frame=5327 name=builtin-standard|standard-vs|standard-fs|CC_USE_FOG4|CC_SUPPORT_CASCADED_SHADOW_MAP1|CC_USE_HDR1|CC_SHADOWMAP_FORMAT1|CC_SHADOWMAP_USE_LINEAR_DEPTH1\n';
assert.equal(flips(bad).length,1,'negative: CC_SHADOW_TYPE drop is a flip');
const real='/workspace/qifengle/test-reports/20261101T1155_perf-b3394140/raw/console.log';
let realNote='b3394140 log not on this box (skipped)';
if(fs.existsSync(real)){const f=flips(fs.readFileSync(real,'utf8'));assert.ok(f.length>0,'negative: b3394140 log must show global flips');realNote=`b3394140 flips=${f.length} first@frame=${f[0].frame}`;}
module.exports={flips};
if(process.argv[2]){const f=flips(fs.readFileSync(process.argv[2],'utf8'));console.log(f.length?`FAIL global-macro flips=${f.length} first@frame=${f[0].frame}`:'PASS no global-macro flips');process.exit(f.length?1:0);}
console.log('PASS shader-global-flip src-clean negatives=3 '+realNote);
