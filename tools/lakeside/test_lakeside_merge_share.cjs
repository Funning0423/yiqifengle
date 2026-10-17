// r4-prep (first-entry frame): the board reuses the journey copy's merged geometry (same r5h3 scene, baked relative to the scenery
// root) instead of rebuilding ~58k vertices in the board-entry frame. Real mergeLakesideStatic on a fake cc: second identical merge
// reuses (utils.createMesh not called again), refcounted handles free the meshes exactly once after the last holder, any
// difference in the scene → fresh merge, and a failed fresh merge never destroys shared meshes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
let created=0,destroyed=0;
class Mat4{constructor(){this.m=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}static invert(o,a){o.m=a.m.slice();o.m[12]=-a.m[12];o.m[13]=-a.m[13];o.m[14]=-a.m[14];return o;}
 static multiply(o,a,b){o.m=b.m.slice();o.m[12]=a.m[12]+b.m[12];o.m[13]=a.m[13]+b.m[13];o.m[14]=a.m[14]+b.m[14];return o;}static toArray(arr,a){return a.m.slice();}}
class Node{constructor(name){this.name=name;this.children=[];this.parent=null;this.layer=1;this.position={x:0,y:0,z:0};this.comps=[];this.valid=true;}
 get worldMatrix(){const m=new Mat4();let n=this;while(n){m.m[12]+=n.position.x;m.m[13]+=n.position.y;m.m[14]+=n.position.z;n=n.parent;}return m;}
 addChild(c){c.parent=this;this.children.push(c);}addComponent(C){const c=new C();c.node=this;this.comps.push(c);return c;}
 getComponentsInChildren(C){const out=[];const walk=n=>{for(const c of n.comps)if(c instanceof C)out.push(c);n.children.forEach(walk);};walk(this);return out;}
 destroy(){this.valid=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}}
class MeshRenderer{constructor(){this.enabled=true;this.sharedMaterials=[];this.shadowCastingMode=0;this.receiveShadow=1;}setSharedMaterial(m,k){this.sharedMaterials[k]=m;}}
const gfx={AttributeName:{ATTR_POSITION:'a_position',ATTR_NORMAL:'a_normal',ATTR_TEX_COORD:'a_texCoord',ATTR_COLOR:'a_color'},PrimitiveMode:{TRIANGLE_LIST:7},Format:{RGBA8:1},Attribute:class{}};
const F32={type:6,size:12,count:3};
class Mesh{constructor(uuid,n){this._uuid=uuid;this.name=uuid;this.n=n;this.valid=true;this.struct={primitives:[{indexView:{count:3},primitiveMode:7,vertexBundelIndices:[0]}],vertexBundles:[{view:{count:n}}]};}
 readAttributeFormat(k,a){return a==='a_position'||a==='a_normal'?F32:null;}readAttribute(k,a){return new Float32Array(this.n*3).fill(a==='a_normal'?0.5:1);}readIndices(){return new Uint16Array([0,1,2]);}destroy(){this.valid=false;}}
const palette={effectName:'builtin-standard',technique:0,passes:[{defines:{USE_INSTANCING:true},rasterizerState:{cullMode:2},blendState:{targets:[{blend:false}]},priority:128}],getProperty:k=>k==='roughness'?0.8:null};
let failCreate=false;
const cc=new Proxy({Node,MeshRenderer,Mat4,gfx,Mesh,Material:class{},isValid:o=>!!o&&o.valid!==false,
 utils:{createMesh:()=>{if(failCreate)throw Error('create failed');created++;const m={valid:true,destroy(){this.valid=false;destroyed++;}};return m;}}},
 {get:(t,k)=>k in t?t[k]:class{static ProjectionType={};static FOVAxis={};static ClearFlag={};}});
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:7}}).outputText;
 const req=spec=>spec==='cc'?cc:spec==='cc/env'?{DEBUG:false}:spec.endsWith('.js')?require(path.resolve(path.dirname(file),spec)):load(path.resolve(path.dirname(file),spec)+'.ts');
 vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,req,m);return m.exports;}
const B=load(S+'region/LakesideBoardBackground.ts');
function scene(extra=0){const root=new Node('scenery');for(let i=0;i<6+extra;i++){const c=new Node('LK_rock_'+i);c.position={x:i,y:0,z:-i};root.addChild(c);const r=c.addComponent(MeshRenderer);r.mesh=new Mesh('rock-uuid',20);r.setSharedMaterial(palette,0);}
 const w=new Node('LK_water_0');root.addChild(w);const wr=w.addComponent(MeshRenderer);wr.mesh=new Mesh('water-uuid',40);wr.setSharedMaterial(palette,0);return root;}
const skip=n=>n.name.startsWith('LK_water');const pass=n=>console.log('PASS '+n);
const journey=scene(),board=scene();
const a=B.mergeLakesideStatic(journey,skip);assert.equal(created,1);assert.equal(a.stats.chunks,1);assert.equal(a.stats.pieces,6);assert(!a.stats.reused);assert.equal(a.meshes.length,1,'one handle per merge');
assert.deepEqual(B.lakesideMergeShareInfo(),{refs:1,meshes:1,sigLength:B.lakesideMergeShareInfo().sigLength});pass('journey merge builds and publishes the geometry (water skipped)');
const b=B.mergeLakesideStatic(board,skip);assert.equal(created,1,'board entry: no rebuild (createMesh not called again)');assert.equal(b.stats.reused,true);assert.equal(b.stats.chunks,1);assert.equal(b.stats.vertices,120);
assert.equal(B.lakesideMergeShareInfo().refs,2);assert(board.children.find(n=>n.name==='LakesideMerged_0').comps[0].mesh.valid,'board node draws the shared mesh');
assert.equal(board.getComponentsInChildren(MeshRenderer).filter(r=>r.enabled).length,2,'board: originals disabled, merged + water drawn');pass('board reuses the journey geometry (same draws, no rebuild)');
a.meshes[0].destroy();a.meshes[0].destroy();assert.equal(destroyed,0,'journey leaves first: the board still holds it');assert.equal(B.lakesideMergeShareInfo().refs,1);
b.meshes[0].destroy();assert.equal(destroyed,1,'last holder frees the meshes exactly once');assert.equal(B.lakesideMergeShareInfo(),null);b.meshes[0].destroy();assert.equal(destroyed,1);pass('refcounted handles: freed exactly once after the last holder');
const c=B.mergeLakesideStatic(scene(),skip);assert.equal(created,2,'nothing shared any more: fresh merge');const d=B.mergeLakesideStatic(scene(1),skip);assert.equal(created,3,'different scene: fresh merge, no reuse');assert(!d.stats.reused);
failCreate=true;const e=B.mergeLakesideStatic(scene(2),skip);failCreate=false;assert(e.stats.skipped,'failed merge reverts');assert.equal(e.meshes.length,0);assert.equal(destroyed,1,'a failed merge never destroys the shared meshes');
c.meshes[0].destroy();d.meshes[0].destroy();assert.equal(destroyed,3);pass('mismatch → fresh merge; failure → revert without touching shared meshes');
const src=fs.readFileSync(S+'region/LakesideBoardBackground.ts','utf8');assert(/if\(merged\)\{for\(const m of merged\.meshes\.splice\(0\)\)m\.destroy\(\);merged=null;\}/.test(src),'board dispose drops its handle');
const jb=fs.readFileSync(S+'region/LakesideJourneyBatching.ts','utf8');assert(/for\(const m of merged\.meshes\)owned\.push\(m\);/.test(jb),'journey release drops its handle');pass('wiring: board dispose and journey release drop their handles');
