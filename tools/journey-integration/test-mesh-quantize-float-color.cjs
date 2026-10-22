'use strict';
// b17 night balloon magenta/green root cause: transit_clouds_merged.glb stores COLOR_0 as FLOAT VEC3 and was imported with
// meshCompress.quantize=true. Every other quantized glb in the project carries UNSIGNED_BYTE VEC4 colours. The quantized float
// RGB colour stream reaches a_color as garbage; day hides it (balloon-grade clamps luminance to grey/white) but at night
// builtin-unlit/standard USE_VERTEX_COLOR multiplies it straight in → flat (0,229,140) in 7d42967c, (229,0,140) in 7a3c3bdc.
// Rule: a glb with a float COLOR_n must not be quantized.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../creator-build-project/assets');
function glbJson(f){const d=fs.readFileSync(f);if(d.readUInt32LE(0)!==0x46546c67)return null;const len=d.readUInt32LE(12);return JSON.parse(d.subarray(20,20+len).toString('utf8'));}
function walk(dir,out){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else if(e.name.endsWith('.glb'))out.push(p);}return out;}
const bad=[],checked=[];
for(const f of walk(root,[])){
 const j=glbJson(f);if(!j)continue;
 const floatColor=(j.meshes||[]).some(m=>(m.primitives||[]).some(p=>Object.entries(p.attributes||{}).some(([k,i])=>/^COLOR_/.test(k)&&j.accessors[i].componentType===5126)));
 if(!floatColor)continue;
 let q=false;try{q=!!JSON.parse(fs.readFileSync(f+'.meta','utf8')).userData?.meshCompress?.quantize;}catch{q=false;}
 checked.push(path.relative(root,f));if(q)bad.push(path.relative(root,f));
}
assert.ok(checked.includes('bundles/region_transit_balloon/transit_clouds_merged.glb'),'balloon clouds glb checked');
assert.deepEqual(bad,[],'float COLOR_0 glb imported with meshCompress.quantize=true: '+bad.join(', '));
console.log(JSON.stringify({ok:true,floatColorGlbs:checked.length}));
