'use strict';
// b17 night balloon magenta/green guard. Root cause: transit_clouds_merged.glb / transit_sea_fallback.glb carried FLOAT VEC3
// COLOR_0 under meshCompress (meshopt). meta quantize=false proved a no-op on Creator 3.8.8 (byte-identical .bin, still
// "quantized":true), and the decoded float colour stream reached a_color as garbage. Day hides it (balloon-grade clamps to a
// grey/white ramp); night builtin-unlit multiplies it straight in -> flat (0,229,140) / (196,23,98) sheets that flip per build.
// Rules: (1) no transit-balloon glb under meshCompress may carry a FLOAT COLOR_n (every proven glb uses normalized UNSIGNED_BYTE VEC4);
// (2) the night cloud path uses the clamped + NaN-guarded balloon-grade technique, not raw builtin-unlit vertex colour.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const proj=path.resolve(__dirname,'../../creator-build-project');const root=path.join(proj,'assets');
function glbJson(f){const d=fs.readFileSync(f);if(d.readUInt32LE(0)!==0x46546c67)return null;const len=d.readUInt32LE(12);return JSON.parse(d.subarray(20,20+len).toString('utf8'));}
function walk(dir,out){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else if(e.name.endsWith('.glb'))out.push(p);}return out;}
const bad=[];let colourGlbs=0;
for(const f of walk(root,[])){
 const j=glbJson(f);if(!j)continue;
 const cols=(j.meshes||[]).flatMap(m=>(m.primitives||[]).flatMap(p=>Object.entries(p.attributes||{}).filter(([k])=>/^COLOR_/.test(k)).map(([,i])=>j.accessors[i])));
 if(!cols.length)continue;colourGlbs++;
 let mc=false;try{mc=!!JSON.parse(fs.readFileSync(f+'.meta','utf8')).userData?.meshCompress?.enable;}catch{mc=false;}
 if(mc&&cols.some(a=>a.componentType===5126))bad.push(path.relative(root,f));
}
const scoped=bad.filter(f=>f.startsWith('bundles/region_transit_balloon/'));
// Others (meadow/character/room) render through materials that do not read a_color at night; listed, not failed.
assert.deepEqual(scoped,[],'float COLOR_n glb under meshCompress (run tools/glb-color/color0-to-u8.cjs): '+bad.join(', '));
for(const n of ['transit_clouds_merged.glb','transit_sea_fallback.glb']){
 const j=glbJson(path.join(root,'bundles/region_transit_balloon',n));
 for(const m of j.meshes)for(const p of m.primitives){const a=j.accessors[p.attributes.COLOR_0];assert.ok(a&&a.componentType===5121&&a.normalized===true&&a.type==='VEC4',n+' COLOR_0 must be u8 normalized VEC4');}
}
const fx=fs.readFileSync(path.join(root,'bundles/region_transit_balloon/balloon-grade.effect'),'utf8');
assert.match(fx,/name:\s*cloud-night/,'cloud-night technique');
assert.match(fx,/notEqual\(s,\s*s\)/,'NaN guard in cloud-night');
const ts=fs.readFileSync(path.join(root,'scripts/region/BalloonTransit.ts'),'utf8');
assert.match(ts,/technique:2/,'night clouds use balloon-grade technique 2');
assert.doesNotMatch(ts,/else if\(night\)setEmissive\(clouds,true\);/,'no per-frame setEmissive on clouds');
console.log(JSON.stringify({ok:true,colourGlbs,floatColourCompressedElsewhere:bad}));
