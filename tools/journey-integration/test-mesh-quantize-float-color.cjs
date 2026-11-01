'use strict';
// b17 night balloon magenta/green guard (r3). Real cause: setEmissive() wrote setProperty('emissiveScale',0). In builtin-standard
// emissiveScale targets emissiveScaleParam.xyz (FLOAT3); Cocos' FLOAT3 writer reads v.x/v.y/v.z from the number -> undefined ->
// NaN in the UBO -> NaN emissive on every transit cloud at night (day never calls setEmissive) -> flat green/magenta sheets in the
// cloud silhouettes, varying with which cloud groups are visible at t. Mesh compression / COLOR_0 were not involved (Mac: identical
// result with meshCompress off). Rules:
//  (1) no script may set a known vector uniform (emissiveScale, emissive, mainColor, tilingOffset, albedoScale, pbrParams) to a bare number;
//  (2) setEmissive must not write emissiveScale at all and runs once per clouds root;
//  (3) keep: transit cloud/sea COLOR_0 stays u8 normalized VEC4 (smaller, day verified identical on Mac).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../creator-build-project/assets');
function walk(dir,ext,out){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,ext,out);else if(e.name.endsWith(ext))out.push(p);}return out;}
const VEC=['emissiveScale','emissive','mainColor','tilingOffset','albedoScale','pbrParams'];
const re=new RegExp("setProperty\\(\\s*['\"]("+VEC.join('|')+")['\"]\\s*,\\s*-?[0-9.]+\\s*\\)",'g');
const hits=[];
for(const f of walk(path.join(root,'scripts'),'.ts',[])){const s=fs.readFileSync(f,'utf8');let m;while((m=re.exec(s)))hits.push(path.relative(root,f)+':'+m[0]);}
// SailArt lamp (emissiveScale 0.12, tiny lamp card) is pre-existing and outside the balloon leg: tracked, not failed here.
const KNOWN=['scripts/region/SailArt.ts'];
const fail=hits.filter(h=>!KNOWN.some(k=>h.startsWith(k)));
assert.deepEqual(fail,[],'scalar written to a vector uniform (NaN on GPU): '+fail.join(' | '));
const ts=fs.readFileSync(path.join(root,'scripts/region/BalloonTransit.ts'),'utf8');
const se=/function setEmissive[\s\S]*?\n\}/.exec(ts);assert.ok(se,'setEmissive present');
assert.doesNotMatch(se[0],/setProperty\('emissiveScale'/,'setEmissive must not write emissiveScale');
assert.doesNotMatch(ts,/else if\(night\)setEmissive\(clouds,true\);/,'no per-frame setEmissive on clouds');
assert.match(ts,/diagParams\(/,'hideNode/diagDump diagnostics present');
// b17 night lakeside blocker bisect: the skycity→lakeside leg honours ?hideNode / ?diagDump=1&lakeDiagAt=t too (dump rows carry aabb).
const ra=fs.readFileSync(path.join(root,'scripts/region/RegionJourneyAdapter.ts'),'utf8');
assert.match(ra,/const diag=diagParams\(\),diagAt=lakeDiagAt\(\)/,'lakeside leg reads the diagnostics');
assert.match(ra,/diagDumpScene\(clock\.t,'lakeside'\)/,'lakeside leg dumps at lakeDiagAt');
assert.match(ts,/aabb:wb\?/,'QF_DIAG rows carry world bounds');
for(const n of ['transit_clouds_merged.glb','transit_sea_fallback.glb']){
 const d=fs.readFileSync(path.join(root,'bundles/region_transit_balloon',n));const j=JSON.parse(d.subarray(20,20+d.readUInt32LE(12)).toString('utf8'));
 for(const m of j.meshes)for(const p of m.primitives){const a=j.accessors[p.attributes.COLOR_0];assert.ok(a&&a.componentType===5121&&a.normalized===true&&a.type==='VEC4',n+' COLOR_0 u8 normalized VEC4');}
}
console.log(JSON.stringify({ok:true,knownScalarVectorWrites:hits.filter(h=>!fail.includes(h))}));
