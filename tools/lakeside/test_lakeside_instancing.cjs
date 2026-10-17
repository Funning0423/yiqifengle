// B1: lakeside scenery is GPU-instanced (one shared USE_INSTANCING copy per source material), copies destroyed on dispose.
const fs=require('fs'),path=require('path'),assert=require('assert');
const s=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/LakesideBoardBackground.ts'),'utf8');
assert(/m=new Material\(\);m\.copy\(src,\{defines:\{USE_INSTANCING:true\}\}\);shared\.set\(src,m\);\}r\.setSharedMaterial\(m,k\);/.test(s),'shared instanced copy');
assert(/instanced=enableLakesideInstancing\(scenery\);\n  setLayer\(scenery\);/.test(s),'applied after instantiate');
assert(/for\(const m of instanced\.splice\(0\)\)m\.destroy\(\);/.test(s),'destroyed on dispose');
assert(/instancedMaterials:instanced\.length/.test(s),'diagnostics');
// Behaviour on stand-ins: 3 renderers over 2 source materials -> 2 copies, renderers sharing a source share the copy.
const body=s.match(/export function enableLakesideInstancing\(root:Node\):Material\[\]\{\n([\s\S]*?)\n\}\n/)[1].replace(/:Material\[\]|<Material,Material>/g,'');
class Material{copy(src,o){this.src=src;this.defines=o.defines;}}
const A={},B={},rs=[A,A,B].map(m=>({sharedMaterials:[m],set:[],setSharedMaterial(x,k){this.set[k]=x;}}));
const out=new Function('root','Material','MeshRenderer',body)({getComponentsInChildren:()=>rs},Material,{});
assert.equal(out.length,2);assert(rs[0].set[0]===rs[1].set[0]&&rs[0].set[0]!==rs[2].set[0]&&rs[0].set[0].defines.USE_INSTANCING===true);
console.log('lakeside instancing OK');
