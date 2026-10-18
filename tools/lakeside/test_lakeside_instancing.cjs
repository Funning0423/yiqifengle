// B1: lakeside scenery is GPU-instanced (one shared USE_INSTANCING copy per source material), copies destroyed on dispose.
const fs=require('fs'),path=require('path'),assert=require('assert');
const s=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/LakesideBoardBackground.ts'),'utf8');
assert(/m=new Material\(\);const mask=cls\?lakesideFillMaskTexture\(mode\):null;m\.copy\(src,\{defines:mask\?\{USE_INSTANCING:true,USE_EMISSIVE_MAP:true\}:\{USE_INSTANCING:true\}\}\);if\(cls\)initLakesideLandFill\(m,cls,glb\|\|'',mode\);cache\.set\(src,m\);out\.push\(m\);\}r\.setSharedMaterial\(m,k\);/.test(s),'shared instanced copy (r4: one per source material and land class; r5: fill copies sample the per-part mask)');
assert(/instanced=enableLakesideInstancing\(scenery\);\n[\s\S]{0,4000}?  setLayer\(scenery\);/.test(s),'applied after instantiate');
assert(/for\(const m of instanced\.splice\(0\)\)m\.destroy\(\);/.test(s),'destroyed on dispose');
assert(/instancedMaterials:instanced\.length/.test(s),'diagnostics');
// Behaviour on stand-ins: 3 renderers over 2 source materials -> 2 copies, renderers sharing a source share the copy.
const body=s.match(/export function enableLakesideInstancing\(root:Node\):Material\[\]\{\n([\s\S]*?)\n\}\n/)[1].replace(/<string,Map<Material,Material>>|:Material\[\]|<Material,Material>/g,'');
class Material{copy(src,o){this.src=src;this.defines=o.defines;}}
const A={},B={},rs=[A,A,B].map(m=>({sharedMaterials:[m],set:[],setSharedMaterial(x,k){this.set[k]=x;}}));
const MASK={mask:1};let mask=MASK;
const run=(glbOf,landOf)=>{const inits=[];const out=new Function('root','Material','MeshRenderer','lakesideTopGlb','lakesideLandFillClass','lakesideDayNightMode','initLakesideLandFill','lakesideFillMaskTexture',body)(
 {getComponentsInChildren:()=>rs},Material,{},(root,n)=>glbOf(n),g=>landOf[g]||null,()=>'day',(m,cls,glb,mode)=>inits.push([m,cls,glb,mode]),()=>mask);return {out,inits};};
for(const r of rs)r.node={};
{const {out,inits}=run(()=>'LK_bridge.glb',{});
 assert.equal(out.length,2);assert(rs[0].set[0]===rs[1].set[0]&&rs[0].set[0]!==rs[2].set[0]&&rs[0].set[0].defines.USE_INSTANCING===true);assert.equal(inits.length,0,'no land: nothing filled');}
// r4 land fill: same source material on a land GLB and a non-land GLB -> two copies; only the land one is initialised
{rs.forEach(r=>{r.set=[];});const glbs=new Map([[rs[0],'LK_terrain.glb'],[rs[1],'LK_bridge.glb'],[rs[2],'LK_far_hills.glb']]);rs.forEach(r=>{r.node={r};});
 const {out,inits}=run(n=>glbs.get(n.r),{'LK_terrain.glb':'near','LK_far_hills.glb':'far'});
 assert.equal(out.length,3);assert(rs[0].set[0]!==rs[1].set[0],'land and bridge never share a copy');
 assert.deepEqual(inits.map(i=>[i[1],i[2],i[3]]),[['near','LK_terrain.glb','day'],['far','LK_far_hills.glb','day']]);assert(inits[0][0]===rs[0].set[0]&&inits[1][0]===rs[2].set[0]);
 // r5 per-part fill: fill copies get USE_EMISSIVE_MAP (the palette-cell mask), the plain copy never does
 assert.deepEqual(rs[0].set[0].defines,{USE_INSTANCING:true,USE_EMISSIVE_MAP:true});assert.deepEqual(rs[1].set[0].defines,{USE_INSTANCING:true});}
// r5: no mask texture (creation failed) -> the fill copy keeps the r4 flat fill (no USE_EMISSIVE_MAP)
{rs.forEach(r=>{r.set=[];});mask=null;const glbs=new Map([[rs[0],'LK_terrain.glb'],[rs[1],'LK_bridge.glb'],[rs[2],'LK_far_hills.glb']]);
 const {inits}=run(n=>glbs.get(n.r),{'LK_terrain.glb':'near','LK_far_hills.glb':'far'});assert.equal(inits.length,2);assert.deepEqual(rs[0].set[0].defines,{USE_INSTANCING:true});mask=MASK;}
console.log('lakeside instancing OK');
