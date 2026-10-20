'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'creator-build-project/assets/bundles/region_skycity');
function read(name){const b=fs.readFileSync(path.join(dir,name));return {b,j:JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};}
const base=read('env_skycity.glb'),soft=read('env_sky_cloudsea_soft.glb');
assert.equal(crypto.createHash('sha256').update(soft.b).digest('hex'),'bed3ed546423a27fa3592695506822a08b44311f30904242834d3bb039238674','exact handoff');
assert.equal(crypto.createHash('sha256').update(base.b).digest('hex'),'c8558e31ab312a9c0dd94c82e859e34de4cb929407cd0faa893dd64d29657aaa','accepted 872 ground unchanged');
let triangles=0,primitives=0;
for(const {j} of [base,soft])for(const n of j.nodes){
 if(n.mesh===undefined||['env_sky_cloudsea','env_sky_cumulus_far'].includes(n.name))continue;
 for(const p of j.meshes[n.mesh].primitives){
  triangles+=j.accessors[p.indices].count/3;primitives++;
  // Cocos imports 3xUINT8 color as RGB8 (stride 35). RGBA8 or float attributes stay aligned.
  const c=p.attributes.COLOR_0;if(c!==undefined){const a=j.accessors[c];assert(a.componentType!==5121||a.type==='VEC4','WebGL-aligned color '+n.name);}
 }
}
const triangleLimit=100000; // User-approved r3 limit; supersedes the handoff's obsolete 90k gate.
assert.equal(triangles,98840);assert(triangles<=triangleLimit);assert(primitives<=64);
const H=require('../board-ui/harness.cjs').createHarness(),cc=H.cc;
const scene=new cc.Node('Scene');cc.director.getScene=()=>scene;
cc.instantiate=()=>{const n=new cc.Node('env_sky_cloudsea_soft');n.addComponent(cc.MeshRenderer);return n;};
const {SkycityCloudsea}=H.load('region/SkycityCloudsea.ts');
const sea=new cc.Node('env_sea_surface');scene.addChild(sea);
const camNode=new cc.Node('WorldCamera');scene.addChild(camNode);const camera=camNode.addComponent(cc.Camera);camera.visibility=1<<20;camera.far=1000;
let refs=0;const prefab={addRef(){refs++;},decRef(){refs--;}};
function mount(){
 const rig=new cc.Node('SkyRig');scene.addChild(rig);const model=new cc.Node('env_skycity');rig.addChild(model);model.layer=1<<20;
 model.setPosition(30,12,6);model.setScale(1,2,1);model.setRotation(new cc.Quat().set({x:0,y:.5,z:0,w:.866}));
 for(const name of ['skycity_float_root','env_sky_cloudsea','env_sky_cumulus_far','env_sky_cloud_small','env_sky_islets_far'])model.addChild(new cc.Node(name));
 const palette={name:'M_env_palette'},r=model.addComponent(cc.MeshRenderer);r.sharedMaterials=[palette];
 const c=model.addComponent(SkycityCloudsea);c.mount(prefab);
 const sibling=rig.getChildByName('SkycityCloudseaSoft');
 assert(sibling&&sibling.parent===model.parent,'sibling placement');
 assert.deepEqual(sibling.position,model.position);assert.deepEqual(sibling.rotation,model.rotation);assert.deepEqual(sibling.scale,model.scale);
 assert.equal(sibling.layer,1<<20);assert.equal(sibling.getComponent(cc.MeshRenderer).sharedMaterials[0],palette);
 assert.equal(sibling.getComponent(cc.MeshRenderer).shadowCastingMode,0);assert.equal(sibling.getComponent(cc.MeshRenderer).receiveShadow,0);
 for(const name of ['env_sky_cloudsea','env_sky_cumulus_far'])assert.equal(model.getChildByName(name).active,false);
 for(const name of ['env_sky_cloud_small','env_sky_islets_far'])assert.equal(model.getChildByName(name).active,true);
 assert.equal(sea.active,false);assert.equal(camera.far,1200);
 return {c,model,sibling};
}
const a=mount(),b=mount();assert.equal(refs,2);
a.c.setFlightHidden(true);assert.equal(a.sibling.active,false);assert.equal(sea.active,false,'second city still owns sea visibility');
b.c.onDisable();assert.equal(sea.active,true,'last owner restores sea');
a.c.setFlightHidden(false);assert.equal(a.sibling.active,true);assert.equal(sea.active,false);
a.model.setPosition(1,2,3);a.c.setFlightHidden(false);assert.deepEqual(a.sibling.position,a.model.position,'follow later rigid placement');
a.c.onDisable();assert.equal(a.sibling.active,false);assert.equal(sea.active,true);
a.c.onDestroy();b.c.onDestroy();assert.equal(refs,0);assert.equal(a.sibling.isValid,false);assert.equal(b.sibling.isValid,false);
async function loaderChecks(){
 const overrides={};for(const name of ['RegionAmbientAnimation','SkycityPennantWind','SkycityRobotInteract'])overrides['region/'+name]={[name]:class {}};
 const L=require('../board-ui/harness.cjs').createHarness({overrides}),loader=L.load('region/RegionLoader.ts');
 let refs=0,loads=0;const base={name:'env_skycity'},makeSoft=()=>({name:'env_sky_cloudsea_soft',isValid:true,addRef(){refs++;},decRef(){refs--;}});
 let soft=makeSoft(),available=false;
 L.cc.assetManager.loadBundle=(_name,done)=>done(null,{loadDir(_dir,_type,cb){loads++;cb(null,available?[base,soft]:[base]);}});
 L.cc.assetManager.loadAny=(_request,_options,_progress,done)=>done(null,base);
 await assert.rejects(loader.loadRegionPrefab(loader.REGIONS.skycity),/prefab env_sky_cloudsea_soft not found/,'missing soft asset never substitutes the sole base prefab');
 available=true;assert.equal(await loader.loadRegionPrefab(loader.REGIONS.skycity),base);assert.equal(loads,2);
 await loader.loadRegionPrefab(loader.REGIONS.skycity);assert.equal(loads,2,'reuse valid prepared asset');
 soft.isValid=false;soft=makeSoft();await loader.loadRegionPrefab(loader.REGIONS.skycity);assert.equal(loads,3,'reload a released prefab');
 const parent=new L.cc.Node('Owner');
 assert.throws(()=>loader.mountRegion(loader.REGIONS.skycity,base,parent),/skycity-shared-palette-missing/);
 assert.equal(parent.children.length,0,'failed mount cleans both nodes');assert.equal(refs,0,'failed mount releases extra prefab');
}
loaderChecks().then(()=>console.log(JSON.stringify({status:'PASS',triangles,triangleLimit,primitiveUpperBound:primitives,scope:'Exact GLB and WebGL color format checks; real loader/component with Cocos doubles for asset readiness/cache, failed mount cleanup, sibling placement, flight hiding, shared palette, layers, far plane, sea ownership and cleanup. Actual build/DC validation remains separate.'}))).catch(e=>{console.error(e);process.exitCode=1;});
