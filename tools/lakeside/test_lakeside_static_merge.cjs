// v3.3 draw calls: static merge of the lakeside scenery (Mac v3.2: 79 = background 36 + board/UI ~43; target <= 55).
const fs=require('fs'),path=require('path'),assert=require('assert');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const A=path.join(__dirname,'../../creator-build-project/assets'),R=path.join(A,'bundles/region_lakeside');
const load=f=>{const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(path.join(A,'scripts/region',f),'utf8'),{compilerOptions:{module:1,target:6}}).outputText)(m,m.exports,require);return m.exports;};
const M=load('LakesideStaticMerge.ts'),D=load('LakesideSceneData.ts');
// half floats / normalized ints exactly as Mesh.readAttribute hands them out (raw storage)
assert.equal(M.halfToFloat(0x3c00),1);assert.equal(M.halfToFloat(0xc000),-2);assert.equal(M.halfToFloat(0x5640),100);assert.equal(M.halfToFloat(0),0);
assert.deepEqual(M.lakesideAttrToFloat([0x3c00,0x3800],{type:6,size:4,count:2},false),[1,0.5],'RG16F');
assert.deepEqual(M.lakesideAttrToFloat(new Float32Array([1.5,-2]),{type:6,size:8,count:2},false),[1.5,-2],'RG32F');
assert.deepEqual(M.lakesideAttrToFloat([255,0,51,255],{type:1,size:4,count:4},true),[1,0,0.2,1],'RGBA8 unorm');
assert.deepEqual(M.lakesideAttrToFloat([127,-127,0],{type:2,size:3,count:3},true),[1,-1,0],'RGB8 snorm');
// material content key: per-GLB copies with equal content share a key; USE_INSTANCING ignored; blend / texture / colour differ
const base={effect:'builtin-standard',technique:0,defines:{USE_INSTANCING:true,USE_ALBEDO_MAP:true,USE_VERTEX_COLOR:true},props:{mainTexture:'asset:pal',roughness:0.8},cull:0,blend:false,priority:128};
const k=M.lakesideMaterialKey;assert.equal(k(base),k({...base,defines:{USE_ALBEDO_MAP:true,USE_VERTEX_COLOR:true}}));
assert.notEqual(k(base),k({...base,blend:true}));assert.notEqual(k(base),k({...base,props:{...base.props,mainTexture:'asset:other'}}));assert.notEqual(k(base),k({...base,props:{...base.props,roughness:0.5}}));
assert(k({...base,blend:true}).includes('|blend|'));
// chunking at 65,535 vertices, per group, stable order; single oversize pieces stay unmerged
const plan=M.lakesideMergePlan([{group:'a',vertices:40000,indices:3},{group:'b',vertices:10,indices:3},{group:'a',vertices:30000,indices:3},{group:'a',vertices:20000,indices:3},{group:'a',vertices:70000,indices:3}]);
assert.deepEqual(plan.map(c=>[c.group,c.pieces,c.vertices]),[['a',[0],40000],['b',[1],10],['a',[2,3],50000]]);
// world-space append: translation, non-uniform scale (normal via inverse-transpose), mirrored placement, index offset
const dst={positions:[],normals:[],uvs:[],colors:[],indices:[],vertices:0},L={position:true,normal:true,uv:true,color:true};
const piece={positions:[1,0,0, 0,1,0, 0,0,1],normals:[0.7071,0.7071,0, 0,1,0, 0,0,1],uvs:[0,0,1,0,0,1],colors:[1,0,0,1, 0,1,0,1, 0,0,1,1],indices:[0,1,2]};
const S=[2,0,0,0, 0,1,0,0, 0,0,1,0, 10,0,5,1];M.lakesideAppendPiece(dst,piece,S,L);M.lakesideAppendPiece(dst,piece,[-1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],L);
assert.deepEqual(dst.positions.slice(0,9),[12,0,5, 10,1,5, 10,0,6]);assert.deepEqual(dst.indices,[0,1,2,3,4,5]);assert.equal(dst.vertices,6);
const n0=dst.normals.slice(0,3);assert(Math.abs(Math.hypot(...n0)-1)<1e-9&&Math.abs(n0[0]/n0[1]-0.5)<1e-6,'normal follows inverse-transpose of scale(2,1,1)');
assert.deepEqual(dst.normals.slice(9,12).map(x=>+x.toFixed(4)),[-0.7071,0.7071,0],'mirrored placement keeps an outward normal');
assert.equal(dst.colors.length,24);assert.equal(dst.uvs.length,12);
assert.equal(M.lakesideStaticMergeEnabled(''),true);assert.equal(M.lakesideStaticMergeEnabled('?lakemerge=off'),false);assert.equal(M.lakesideStaticMergeEnabled('?x=1&lakemerge=0'),false);
// expected background draw calls from the REAL bundle: group the placed instances by glTF material content + vertex layout
const tr=JSON.parse(fs.readFileSync(path.join(R,'scene_r5h_slim_transforms.json'),'utf8')),list=D.lakesideSceneInstances(tr.instances);
const glb=f=>{const b=fs.readFileSync(path.join(R,'models',f));const l=b.readUInt32LE(12);return JSON.parse(b.slice(20,20+l));};
const water=new Set(D.LAKESIDE_DIR_LIGHT_PARAMS.waterGlbs),pieces=[],info={};let singles=0;
for(const i of list){if(water.has(i.glb))continue;const j=info[i.glb]||(info[i.glb]=glb(i.glb));const p=j.meshes[0].primitives[0],mat=j.materials[p.material];
 const key=JSON.stringify({...mat,name:undefined})+'#'+Object.keys(p.attributes).sort().join('+');
 if(mat.alphaMode==='BLEND'){singles++;continue;}pieces.push({group:key,vertices:j.accessors[p.attributes.POSITION].count,indices:j.accessors[p.indices].count});}
const chunks=M.lakesideMergePlan(pieces),merged=chunks.filter(c=>c.pieces.length>1),lone=chunks.filter(c=>c.pieces.length===1).length;
const instancedKinds=new Set(chunks.filter(c=>c.pieces.length===1).map(c=>c.group)).size;
const bgDraws=merged.length+instancedKinds+singles+1/*water*/;
console.log('merge plan: '+pieces.length+' pieces -> '+merged.length+' merged chunk(s) ('+merged.map(c=>c.vertices+' v').join(', ')+'), '+lone+' unmerged, '+singles+' blended; background ~'+bgDraws+' draws (was 36); total ~'+(bgDraws+43)+' (was 79)');
assert(bgDraws<=8,'background draws '+bgDraws);assert(bgDraws+43<=55,'total under 55 with margin');
// lease wiring
const bg=fs.readFileSync(path.join(A,'scripts/region/LakesideBoardBackground.ts'),'utf8');
assert(/instanced=enableLakesideInstancing\(scenery\);[\s\S]*waterTinted=tinted\.size;\}\n  step='static-merge';if\(lakesideStaticMergeFromEnv\(\)\)\{[^\n]*merged=mergeLakesideStatic\(scenery,n=>water\.has\(n\.name\)\);\}\n  setLayer\(scenery\);/.test(bg),'after instancing + water, before layers');
assert(/if\(merged\)\{for\(const m of merged\.meshes\.splice\(0\)\)m\.destroy\(\);merged=null;\}/.test(bg),'merged meshes destroyed with the lease');
assert(/for\(const r of out\.disabled\.splice\(0\)\)if\(isValid\(r,true\)\)r\.enabled=true;/.test(bg)&&/static-merge-skipped/.test(bg),'failure reverts to the instanced scene');
assert(/key\.includes\('\|blend\|'\)/.test(bg)&&/c=>c\.pieces\.length>1/.test(bg),'no blended merges, no 1-piece chunks');
assert(/new gfx\.Attribute\(A\.ATTR_COLOR,gfx\.Format\.RGBA8,true\)/.test(bg)&&/utils\.createMesh\(geo,undefined,\{calculateBounds:true\}\)/.test(bg));
assert(/staticMerge:merged\?merged\.stats:null/.test(bg),'diagnostics');
// per-GLB Texture2D sub-assets over ONE image: the key must use the image + sampler (else nothing merges in the engine)
assert(/'img:'\+img\+'\/'\+\[v\._minFilter,v\._magFilter,v\._mipFilter,v\._wrapS,v\._wrapT,v\._anisotropy\]/.test(bg),'texture keyed by image+sampler');
const metas=fs.readdirSync(path.join(R,'models')).filter(f=>f.endsWith('.glb.meta')).map(f=>JSON.parse(fs.readFileSync(path.join(R,'models',f),'utf8')));
const tex=new Set(),img=new Set();for(const m of metas)for(const [id,sm] of Object.entries(m.subMetas))if(sm.importer==='texture'){tex.add(m.uuid+'@'+id);const u={...sm.userData};img.add(JSON.stringify(u));}
assert(tex.size>=40&&img.size===1,'45 texture sub-assets, one image+sampler ('+tex.size+'/'+img.size+')');
console.log('lakeside static merge OK');
