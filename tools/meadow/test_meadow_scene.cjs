'use strict';
// Real TS provider/loader with asset boundaries doubled from current derivative GLB.
// This validates ownership and identity, not Creator import or GPU rendering.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHarness}=require('../board-ui/harness.cjs');
function setup(){
 const H=createHarness(),cc=H.cc;
 cc.EffectAsset=class{constructor(){this.refs=0;}addRef(){this.refs++;}decRef(){this.refs--;}};
 cc.AnimationClip={WrapMode:{Normal:1,Loop:2}};
 cc.Animation=class extends cc.Component {
  constructor(){super();this.playOnLoad=true;this.clips=[];this._states=new Map();}
  getState(name){return this._states.get(name)||null;}
  createState(clip){const state={name:clip.name,clip,wrapMode:cc.AnimationClip.WrapMode.Normal,repeatCount:1,isPlaying:false,isPaused:false,time:0,play(){this.isPlaying=true;this.isPaused=false;},pause(){this.isPaused=true;},resume(){this.isPlaying=true;this.isPaused=false;}};this._states.set(clip.name,state);return state;}
 };
 cc.Vec4=class{constructor(x,y,z,w){Object.assign(this,{x,y,z,w});}};
 cc.Material.prototype.initialize=function(){this.passes=[{}];this.values={};};cc.Material.prototype.setProperty=function(k,v){this.values[k]=v;};cc.Material.prototype.destroy=function(){this.destroyed=true;};
 cc.Camera.ProjectionType={PERSPECTIVE:1};cc.Camera.FOVAxis={VERTICAL:0};cc.Camera.ClearFlag={SOLID_COLOR:1};cc.MeshRenderer.ShadowCastingMode={OFF:0};
 cc.MeshRenderer.prototype.getMaterialInstance=function(i){if(!this._mi)this._mi=[];if(!this._mi[i]){const defines={};this._mi[i]={values:{},defines,setProperty(k,v){this.values[k]=v;},recompileShaders(d){Object.assign(defines,d);}};}return this._mi[i];};
 cc.Node.prototype.setWorldPosition=cc.Node.prototype.setPosition;cc.Node.prototype.setWorldRotation=function(x,y,z,w){this.rotation={x,y,z,w};};
 const bytes=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/bundles/region_meadow/env_meadow.glb')),g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const prefab={name:'env_meadow',refs:0,addRef(){this.refs++;},decRef(){this.refs--;}};const effect=new cc.EffectAsset();let fail=false,missing=false,dropClip=false,delay=null;const mounts=[];
 cc.assetManager.getBundle=()=>bundle;cc.assetManager.loadBundle=(_n,cb)=>queueMicrotask(()=>cb(null,bundle));
 const bundle={loadDir(_p,_type,cb){if(delay){delay.push(()=>cb(null,[prefab]));return;}queueMicrotask(()=>cb(fail?Error('missing prefab'):null,[prefab]));},load(_path,_type,cb){queueMicrotask(()=>cb(null,effect));}};
 cc.instantiate=()=>{
  const nodes=g.nodes.map(n=>new cc.Node(n.name));for(let i=0;i<g.nodes.length;i++){const n=g.nodes[i];if(n.mesh!==undefined){const r=nodes[i].addComponent(cc.MeshRenderer);r.sharedMaterials=[{}];if(n.name==='meadow_clouds_near')r.mesh={struct:{vertexBundles:[{attributes:[{name:'a_color'}]}]}};}if(n.camera!==undefined)nodes[i].addComponent(cc.Camera);for(const j of n.children||[])nodes[i].addChild(nodes[j]);}
  const model=new cc.Node('env_meadow');for(const i of g.scenes[g.scene||0].nodes)model.addChild(nodes[i]);
  const anim=model.addComponent(cc.Animation);anim.clips=(g.animations||[]).map(a=>({name:a.name}));if(dropClip)anim.clips=anim.clips.filter(c=>c.name!=='meadow_birds_loop');
  if(missing)model.find('player_spawn').name='wrong_spawn';mounts.push(model);return model;
 };
 const M=H.load('region/MeadowBoardBackground'),{Cancellation}=H.load('world-r1/WorldFlowCore');
 return {H,cc,M,Cancellation,prefab,effect,mounts,setFail:v=>fail=v,setMissing:v=>missing=v,setDropClip:v=>dropClip=v,setDelay:v=>delay=v};
}
(async()=>{
 const x=setup(),parent=new x.cc.Node('LevelHost');x.cc._scene.addChild(parent);const camNode=new x.cc.Node('UnchangedWorldCamera');x.cc._scene.addChild(camNode);const world=camNode.addComponent(x.cc.Camera);world.visibility=1<<30;
 await x.M.preflightMeadowScene();assert(x.mounts[0].isValid===false);assert.equal(x.prefab.refs,0);
 const token=new x.Cancellation(),lease=await x.M.createMeadowBoardBackground({parent,selection:{provider:'mainline',stageId:'mainline-05',seed:1},token});
 assert.equal(x.prefab.refs,1);assert.equal(x.effect.refs,1);assert.equal(parent.children.length,1);const rig=parent.children[0];assert(!rig.active);assert.equal(lease.diagnostics().renderer,'region-live-3d');
 const loops=['windmill_sails_loop','meadow_butterflies_loop','meadow_birds_loop','windmill_flag_loop'];
 const assertLoops=(motion,paused)=>{const rows=motion.diagnostics().loops;assert.deepEqual(rows.map(s=>s.name),loops);for(const s of rows){assert.equal(s.wrapMode,x.cc.AnimationClip.WrapMode.Loop);assert.equal(s.repeatCount,Infinity);assert.equal(s.playing,true);assert.equal(s.paused,paused);}assert.equal(new Set(rows.map(s=>s.paused)).size,1);};
 lease.frame(true,{width:390,height:844,boardTop:300});const motion=rig.getComponent(x.M.MeadowSceneMotion);motion.onLoad();assertLoops(motion,true);
 lease.setVisible(true);assertLoops(motion,true);lease.setPaused(false);assertLoops(motion,false);motion.update(.08);assert(motion.diagnostics().seconds>0);assertLoops(motion,false);
 const hub=rig.find('windmill_sail_hub');assert.deepEqual([hub.euler.x,hub.euler.y,hub.euler.z],[0,0,0],'sail clip owns the hub; the clock must not overwrite it');
 const before=motion.diagnostics().seconds;lease.setPaused(true);assertLoops(motion,true);motion.update(.1);assert.equal(motion.diagnostics().seconds,before);assertLoops(motion,true);lease.setPaused(false);assertLoops(motion,false);x.cc.game.emit(x.cc.Game.EVENT_HIDE);assertLoops(motion,true);motion.update(.1);assert.equal(motion.diagnostics().seconds,before);assertLoops(motion,true);x.cc.game.emit(x.cc.Game.EVENT_SHOW);assertLoops(motion,false);motion.update(.1);assert(motion.diagnostics().seconds>before);assertLoops(motion,false);
 const background=rig.find('MeadowBackgroundCamera').getComponent(x.cc.Camera);assert.equal(background.visibility,1<<20);assert.equal(background.priority,44);assert.equal(background.fov,49.42635311494791);assert.deepEqual([background.node.position.x,background.node.position.y,background.node.position.z],[0,24,45]);
 const N=x.H.load('ui/NightTint');const near=(a,b)=>Math.abs(a-b)<1e-6;
 assert.equal(motion.cloudMaterial.defines.USE_VERTEX_COLOR,true,'cloud unlit keeps vertex colour so mainColor multiplies it');
 assert.equal(motion.skyMaterial.defines.USE_VERTEX_COLOR,undefined);
 assert.ok(motion.structureMaterials.length>=3,'windmill sails, tower/house and flag take the sky night weight');
 const dayRgb=[background.clearColor.r,background.clearColor.g,background.clearColor.b];
 globalThis.__worldDayNight={snapshot:()=>({mode:'night'})};N.resetUiNightWeight();
 lease.setPaused(true);const held=motion.diagnostics().seconds;motion.update(.1);
 assert.equal(motion.diagnostics().seconds,held,'night tint does not require the motion clock');
 assert.equal(N.uiNightWeight(),1);
 assert.deepEqual([motion.skyMaterial.values.mainColor.x,motion.skyMaterial.values.mainColor.y,motion.skyMaterial.values.mainColor.z],x.M.MEADOW_SKY_NIGHT.slice());
 assert.deepEqual([motion.cloudMaterial.values.mainColor.x,motion.cloudMaterial.values.mainColor.y,motion.cloudMaterial.values.mainColor.z],x.M.MEADOW_CLOUD_NIGHT.slice());
 for(const material of motion.structureMaterials)assert.deepEqual([material.values.mainColor.x,material.values.mainColor.y,material.values.mainColor.z],x.M.MEADOW_SKY_NIGHT.slice());
 assert.deepEqual([motion.material.values.windParams.x,motion.material.values.windParams.y,motion.material.values.windParams.z].slice(1),[1,1]);
 assert.deepEqual([background.clearColor.r,background.clearColor.g,background.clearColor.b],[0x2e,0x3d,0x75]);
 const grass=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/bundles/region_meadow/meadow-grass-wind.effect'),'utf8');
 assert.ok(grass.includes('mix(vec3(1.0), vec3(0.18, 0.24, 0.46), windParams.z)'),'grass uses the sky night colour');
 globalThis.__worldDayNight={snapshot:()=>({mode:'day'})};N.resetUiNightWeight();motion.update(0);
 assert.equal(N.uiNightWeight(),0,'daytime night weight is exactly 0');
 assert.deepEqual([motion.cloudMaterial.values.mainColor.x,motion.cloudMaterial.values.mainColor.y,motion.cloudMaterial.values.mainColor.z],[1,1,1]);
 assert.deepEqual([motion.skyMaterial.values.mainColor.x,motion.skyMaterial.values.mainColor.y,motion.skyMaterial.values.mainColor.z],[1,1,1]);
 for(const material of motion.structureMaterials)assert.deepEqual([material.values.mainColor.x,material.values.mainColor.y,material.values.mainColor.z],[1,1,1]);
 assert.equal(motion.material.values.windParams.z,0);
 assert.deepEqual([background.clearColor.r,background.clearColor.g,background.clearColor.b],dayRgb);
 const absent=x.M.bindMeadowNightSurfaces(new x.cc.Node('no-sky'));assert.equal(absent.sky,null);assert.equal(absent.cloud,null);
 delete globalThis.__worldDayNight;N.resetUiNightWeight();lease.setPaused(false);
 const old=background.node.position.clone();lease.frame(false,{width:844,height:390,boardTop:180});assert.notDeepEqual(background.node.position,old);assert.equal(world.visibility,1<<30);assert.deepEqual(camNode.position,new x.cc.Vec3());
 lease.hide?.();lease.setVisible(false);assertLoops(motion,true);const frozen=motion.diagnostics().seconds;motion.update(.1);assert.equal(motion.diagnostics().seconds,frozen);assertLoops(motion,true);lease.dispose();lease.dispose();assert.equal(x.prefab.refs,0);assert.equal(x.effect.refs,0);assert.equal(parent.children.length,0);assert.equal(x.cc.game.listeners('hide'),0);lease.frame(true,{width:390,height:844,boardTop:300});
 x.setMissing(true);await assert.rejects(x.M.createMeadowBoardBackground({parent,selection:{stageId:'r05-meadow-01'},token:new x.Cancellation()}),/player_spawn/);assert.equal(parent.children.length,0);assert.equal(x.prefab.refs,0);assert.equal(x.effect.refs,0); x.setMissing(false);
 const dropped=setup();dropped.setDropClip(true);await assert.rejects(dropped.M.preflightMeadowScene(),/Meadow loop clip missing: meadow_birds_loop/);
 const pending=[],late=new x.Cancellation();x.setDelay(pending);const entry=x.M.createMeadowBoardBackground({parent,selection:{stageId:'mainline-05'},token:late});await Promise.resolve();await Promise.resolve();late.cancel();await assert.rejects(entry,/cancelled/);for(const done of pending)done();await Promise.resolve();assert.equal(parent.children.length,0);assert.equal(x.prefab.refs,0);x.setDelay(null);
 const orphanParent=new x.cc.Node('DestroyedWhileLoading');x.cc._scene.addChild(orphanParent);const orphanPending=[];x.setDelay(orphanPending);
 const orphan=x.M.createMeadowBoardBackground({parent:orphanParent,selection:{stageId:'mainline-05'},token:new x.Cancellation()});await Promise.resolve();await Promise.resolve();orphanParent.destroy();for(const done of orphanPending)done();await assert.rejects(orphan,/owner destroyed/);assert.equal(x.prefab.refs,0);assert.equal(x.effect.refs,0);x.setDelay(null);
 // Advance uses the actual preflight before surrendering the saved board.
 const C=x.H.load('world-r2/WorldNativeComposition').WorldNativeComposition,c=Object.create(C.prototype),order=[];
 c.world={commands:()=>({exitLevel(){order.push('exit');return {ok:true};}})};c.activeSession={snapshot:()=>({provider:'mainline-v33',state:'result.saved',result:{completionRecorded:true},nextStageId:'mainline-05'})};c.enterMainlineStage=async id=>{order.push(id);return {ok:true};};
 x.setFail(true);assert.equal((await c.advanceMainline()).reason,'meadow-scene-load-failed');assert.deepEqual(order,[]);x.setFail(false);assert((await c.advanceMainline()).ok);assert.deepEqual(order,['exit','mainline-05']);
 console.log(JSON.stringify({status:'PASS',cases:['current derivative model mounts through RegionLoader, dedicated 3D camera behind board','imported camera/animation autoplay disabled; required anchors and five merged grass renderers validated','windmill_sails_loop, meadow_butterflies_loop, meadow_birds_loop and windmill_flag_loop loop together and pause on result, hide, explicit pause and background','sail hub is driven by its clip, not a second Euler clock','paused night still tints meadow_sky_dome and vertex-coloured meadow_clouds_near and clears to #2e3d75; windmill, house and grass use the sky night weight; day weight is exactly 0; missing sky nodes are skipped','actual source portrait/landscape camera pose applied without world-camera mutation','resource refs, nodes and app listeners released on double dispose, missing anchor, missing clip and late cancelled load','failed preflight retains saved board; successful preflight permits actual mainline05 transition'],scope:'Actual TypeScript against Cocos node/asset doubles created from current GLB. Creator importer/shader and native visual acceptance pending'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
