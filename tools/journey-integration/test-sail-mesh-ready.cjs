'use strict';
// P0 f08fd878 DevTools real-touch run: island->meadow sail failed ("Malformed buffer data: -1", then null.length in
// MeshRenderer._updateModelParams, then "[QF_SAIL] cannot depart: rider or seat missing"). Cause: SailArt edited meshes of
// prefabs mounted under the INACTIVE journey rig, so Mesh.initialize() had never run and readAttribute()/struct/data were the
// still meshopt-encoded / zlib-compressed bytes; writeMeshPositions() wrote floats into the packed stream and the reset() copy
// failed to decode, throwing out of mountSailArt (seat=null). Guard: every SailArt mesh edit decodes first (sailMeshReady) and
// the per-renderer edits inside mountSailArt are isolated so one bad mesh cannot drop the boat/seat.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/region/SailArt.ts'),'utf8');
const ready=/export function sailMeshReady[\s\S]*?\n\}/.exec(src);assert.ok(ready,'sailMeshReady present');
assert.match(ready[0],/mesh\.initialize\(\)/,'sailMeshReady decodes via Mesh.initialize()');
assert.match(ready[0],/compressed\|\|st\.encoded/,'still-packed meshes are refused');
for(const fn of ['digChannel','clearLandingGrass','taperMouthShore']){
 const m=new RegExp('function '+fn+'\\([^)]*\\)[^{]*\\{\\n([^\\n]*)').exec(src);assert.ok(m,fn+' present');
 assert.match(m[1],/sailMeshReady\(renderer\.mesh\)/,fn+' must decode the mesh before readAttribute');
}
// No raw readAttribute on an un-readied renderer mesh anywhere in SailArt.
const body=src.replace(/export function sailMeshReady[\s\S]*?\n\}/,'');
assert.doesNotMatch(body,/const mesh=renderer\.mesh;/,'raw renderer.mesh read before readAttribute');
const mount=/export async function mountSailArt[\s\S]*?\n\}\n/.exec(src);assert.ok(mount,'mountSailArt present');
assert.doesNotMatch(mount[0].split('\n').filter(l=>!/safeEdit\(/.test(l)).join('\n'),/\b(digChannel|clearLandingGrass|taperMouthShore)\(r,/,'mesh edits inside mountSailArt must run through safeEdit');
assert.equal((mount[0].match(/safeEdit\(/g)||[]).length,5,'dig, grass and 3 mouth tapers are isolated');
// Behavioural model of the engine contract (cocos 3.8.8 mesh.ts: readAttribute does not initialize; initialize sets _initialized
// before decoding and leaves renderingSubMeshes null when decode throws).
class FakeMesh{constructor(encoded){this.struct={encoded};this._init=false;this.decoded=false;}
 initialize(){if(this._init)return;this._init=true;if(this.struct.encoded){this.struct={...this.struct,encoded:false};this.decoded=true;}}}
const tsMod=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ts=tsMod.transpile(ready[0].replace(/^export /,''),{target:tsMod.ScriptTarget.ES2019});
const fnReady=new Function(ts+';return sailMeshReady;')();
const m=new FakeMesh(true);assert.equal(fnReady(m),m,'encoded mesh decoded and returned');assert.ok(m.decoded&&!m.struct.encoded);
const bad={name:'x',initialize(){throw Error('Malformed buffer data: -1');},struct:{encoded:true}};
const w=console.warn;console.warn=()=>{};try{assert.equal(fnReady(bad),null,'decode failure skips the edit');}finally{console.warn=w;}
assert.equal(fnReady(null),null);
console.log(JSON.stringify({ok:true}));
