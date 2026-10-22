'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'creator-build-project/assets/bundles/region_skycity');
function read(name){const b=fs.readFileSync(path.join(dir,name));return {b,j:JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};}
const base=read('env_skycity.glb'),soft=read('env_sky_cloudsea_soft.glb');
assert.equal(crypto.createHash('sha256').update(soft.b).digest('hex'),'5e21d6c05aef8dd3cbcd821a25c438e2fd7c1b485067f0ca8e6df10e0d6e9a94','accepted r3fix handoff');
assert.equal(soft.b.length,29632,'accepted r3fix bytes');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'env_sky_cloudsea_soft.glb.meta'))).digest('hex'),'3b27fa7581159a2a0860758ddb29dec3a34ca4612b4ce0b02a2c739e1b380c9a','r3fix meta handoff');
assert.equal(crypto.createHash('sha256').update(base.b).digest('hex'),'7e52d0feab33a8a9d53f7fb491340d3b40cd7673c995e38da803301bb6c58cf0','accepted 872 ground unchanged');
let triangles=0,primitives=0;
for(const {j} of [base,soft])for(const n of j.nodes){
 if(n.mesh===undefined||['env_sky_cloudsea','env_sky_cumulus_far'].includes(n.name))continue;
 for(const p of j.meshes[n.mesh].primitives){
  triangles+=j.accessors[p.indices].count/3;primitives++;
  // Cocos imports 3xUINT8 color as RGB8 (stride 35). RGBA8 or float attributes stay aligned.
  const c=p.attributes.COLOR_0;if(c!==undefined){const a=j.accessors[c];assert(a.componentType!==5121||a.type==='VEC4','WebGL-aligned color '+n.name);}
 }
}
const triangleLimit=90000; // b15 (Grok Bot 2026-10-22): back to the 90k budget; cloud sea 13,110 -> 4,259 (never-visible faces dropped, far field collapsed).
assert.equal(triangles,89989);assert(triangles<=triangleLimit);assert(primitives<=64);
const H=require('../board-ui/harness.cjs').createHarness(),cc=H.cc;
const scene=new cc.Node('Scene');cc.director.getScene=()=>scene;
const draw=new cc.Emitter();cc.Director.EVENT_BEFORE_DRAW='before-draw';
cc.director.on=draw.on.bind(draw);cc.director.off=draw.off.bind(draw);
cc.instantiate=()=>{const n=new cc.Node('env_sky_cloudsea_soft');n.addComponent(cc.MeshRenderer);return n;};
const {SkycityCloudsea}=H.load('region/SkycityCloudsea.ts');
const sea=new cc.Node('env_sea_surface');scene.addChild(sea);
const camNode=new cc.Node('WorldCamera');scene.addChild(camNode);const camera=camNode.addComponent(cc.Camera);camera.visibility=1<<20;camera.far=1000;camera.clearFlags=14;camera.clearColor=new cc.Color(51,51,51,255);
const room=new cc.Node('room_no_original_chair');scene.addChild(room);
const socket=new cc.Node('scene_root Socket');room.addChild(socket);
const oldNodes=['env_sky_dome','env_cloud_layer','balloon_basket','balloon_envelope'].map(name=>{const n=new cc.Node(name);socket.addChild(n);return n;});
oldNodes[3].active=false; // Preserve an authored inactive node on release.
const unrelated=new cc.Node('env_sky_dome');scene.addChild(unrelated);
let mode='day';globalThis.__worldDayNight={snapshot:()=>({mode})};
function dayState(hidden){
 assert.equal(oldNodes[0].active,!hidden);assert.equal(oldNodes[1].active,!hidden);assert.equal(oldNodes[2].active,!hidden);assert.equal(oldNodes[3].active,false);
 assert.equal(unrelated.active,true,'scope is the old room');
 assert.equal(camera.clearFlags,hidden?cc.Camera.ClearFlag.SOLID_COLOR:14);
 assert.deepEqual([camera.clearColor.r,camera.clearColor.g,camera.clearColor.b],hidden?[156,202,223]:[51,51,51]);
}
let refs=0;const prefab={addRef(){refs++;},decRef(){refs--;}};
function mount(){
 const rig=new cc.Node('SkyRig');scene.addChild(rig);const model=new cc.Node('env_skycity');rig.addChild(model);model.layer=1<<20;
 model.setPosition(30,12,6);model.setScale(1,2,1);model.setRotation(new cc.Quat().set({x:0,y:.5,z:0,w:.866}));
 for(const name of ['skycity_float_root','env_sky_cloudsea','env_sky_cumulus_far','env_sky_cloud_small','env_sky_islets_far'])model.addChild(new cc.Node(name));
 // Use the actual base GLB names, not the soft GLB's M_env_palette.
 const materials=base.j.materials.map(m=>({name:m.name})),palette=materials.find(m=>m.name==='M_sky_palette');
 assert(palette,'base GLB has the non-emissive sky palette');
 const r=model.getChildByName('skycity_float_root').addComponent(cc.MeshRenderer);r.sharedMaterials=materials;
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
const a=mount(),b=mount();assert.equal(refs,2);dayState(true);
const vehicle=new cc.Node('transport_balloon');a.model.parent.addChild(vehicle);
a.c.setFlightHidden(false);assert.equal(vehicle.active,false,'arrival hides journey balloon');
a.c.setFlightHidden(true);dayState(true);assert.equal(vehicle.active,false,'other city still owns day backdrop');
b.c.onDisable();dayState(false);assert.equal(vehicle.active,true,'last day owner restores balloon');
// A single owner switches day/night live and releases without touching the night backdrop.
a.c.setFlightHidden(false);dayState(true);
mode='night';a.c.setFlightHidden(false);dayState(false);assert.equal(vehicle.active,true);
mode='day';a.c.setFlightHidden(false);dayState(true);
// Event-driven refresh covers normal visit visibility and qaShot without a transit ride.
a.c.onEnable();a.model.parent.active=false;draw.emit(cc.Director.EVENT_BEFORE_DRAW);dayState(false);
a.model.parent.active=true;a.c.onEnable();draw.emit(cc.Director.EVENT_BEFORE_DRAW);dayState(true);a.c.onDisable();dayState(false);
a.c.setFlightHidden(false);b.c.setFlightHidden(false);
a.c.setFlightHidden(true);assert.equal(a.sibling.active,false);assert.equal(sea.active,false,'second city still owns sea visibility');
b.c.onDisable();assert.equal(sea.active,true,'last owner restores sea');
a.c.setFlightHidden(false);assert.equal(a.sibling.active,true);assert.equal(sea.active,false);
a.model.setPosition(1,2,3);a.c.setFlightHidden(false);assert.deepEqual(a.sibling.position,a.model.position,'follow later rigid placement');
a.c.onDisable();assert.equal(a.sibling.active,false);assert.equal(sea.active,true);
a.c.onDestroy();b.c.onDestroy();assert.equal(refs,0);assert.equal(a.sibling.isValid,false);assert.equal(b.sibling.isValid,false);dayState(false);delete globalThis.__worldDayNight;
function basePaletteName(){return base.j.materials.find(m=>m.name==='M_sky_palette').name;}
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
 const palette={name:basePaletteName()};
 L.cc.instantiate=p=>{
  const n=new L.cc.Node(p.name),child=new L.cc.Node('mesh');n.addChild(child);
  child.addComponent(L.cc.MeshRenderer).sharedMaterials=p===base?[{name:'M_sky_palette_emissive'},palette]:[{name:'M_env_palette'}];
  return n;
 };
 const model=loader.mountRegion(loader.REGIONS.skycity,base,parent);
 const sibling=parent.getChildByName('SkycityCloudseaSoft');
 assert.equal(sibling.getComponentsInChildren(L.cc.MeshRenderer)[0].sharedMaterials[0],palette,'loader mount reuses base palette object');
 model.getComponent(L.load('region/SkycityCloudsea.ts').SkycityCloudsea).onDestroy();
 assert.equal(refs,0,'successful loader mount releases extra prefab');
}
loaderChecks().then(()=>console.log(JSON.stringify({status:'PASS',triangles,triangleLimit,primitiveUpperBound:primitives,scope:'Exact GLB and WebGL color format checks; real loader/component with Cocos doubles for asset readiness/cache, failed mount cleanup, sibling placement, flight hiding, shared palette, layers, far plane, sea ownership and cleanup. Actual build/DC validation remains separate.'}))).catch(e=>{console.error(e);process.exitCode=1;});
