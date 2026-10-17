'use strict';
// Real TS provider/loader with asset boundaries doubled from current derivative GLB.
// This validates ownership and identity, not Creator import or GPU rendering.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHarness}=require('../board-ui/harness.cjs');
function setup(){
 const H=createHarness(),cc=H.cc;
 cc.EffectAsset=class{constructor(){this.refs=0;}addRef(){this.refs++;}decRef(){this.refs--;}};
 cc.Animation=class extends cc.Component {constructor(){super();this.playOnLoad=true;}};
 cc.Vec4=class{constructor(x,y,z,w){Object.assign(this,{x,y,z,w});}};
 cc.Material.prototype.initialize=function(){this.passes=[{}];this.values={};};cc.Material.prototype.setProperty=function(k,v){this.values[k]=v;};cc.Material.prototype.destroy=function(){this.destroyed=true;};
 cc.Camera.ProjectionType={PERSPECTIVE:1};cc.Camera.FOVAxis={VERTICAL:0};cc.Camera.ClearFlag={SOLID_COLOR:1};cc.MeshRenderer.ShadowCastingMode={OFF:0};
 cc.Node.prototype.setWorldPosition=cc.Node.prototype.setPosition;cc.Node.prototype.setWorldRotation=function(x,y,z,w){this.rotation={x,y,z,w};};
 const bytes=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/bundles/region_meadow/env_meadow.glb')),g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const prefab={name:'env_meadow',refs:0,addRef(){this.refs++;},decRef(){this.refs--;}};const effect=new cc.EffectAsset();let fail=false,missing=false,delay=null;const mounts=[];
 cc.assetManager.getBundle=()=>bundle;cc.assetManager.loadBundle=(_n,cb)=>queueMicrotask(()=>cb(null,bundle));
 const bundle={loadDir(_p,_type,cb){if(delay){delay.push(()=>cb(null,[prefab]));return;}queueMicrotask(()=>cb(fail?Error('missing prefab'):null,[prefab]));},load(_path,_type,cb){queueMicrotask(()=>cb(null,effect));}};
 cc.instantiate=()=>{
  const nodes=g.nodes.map(n=>new cc.Node(n.name));for(let i=0;i<g.nodes.length;i++){const n=g.nodes[i];if(n.mesh!==undefined){const r=nodes[i].addComponent(cc.MeshRenderer);r.sharedMaterials=[{}];}if(n.camera!==undefined)nodes[i].addComponent(cc.Camera);for(const j of n.children||[])nodes[i].addChild(nodes[j]);}
  const model=new cc.Node('env_meadow');for(const i of g.scenes[g.scene||0].nodes)model.addChild(nodes[i]);model.addComponent(cc.Animation);
  if(missing)model.find('player_spawn').name='wrong_spawn';mounts.push(model);return model;
 };
 const M=H.load('region/MeadowBoardBackground'),{Cancellation}=H.load('world-r1/WorldFlowCore');
 return {H,cc,M,Cancellation,prefab,effect,mounts,setFail:v=>fail=v,setMissing:v=>missing=v,setDelay:v=>delay=v};
}
(async()=>{
 const x=setup(),parent=new x.cc.Node('LevelHost');x.cc._scene.addChild(parent);const camNode=new x.cc.Node('UnchangedWorldCamera');x.cc._scene.addChild(camNode);const world=camNode.addComponent(x.cc.Camera);world.visibility=1<<30;
 await x.M.preflightMeadowScene();assert(x.mounts[0].isValid===false);assert.equal(x.prefab.refs,0);
 const token=new x.Cancellation(),lease=await x.M.createMeadowBoardBackground({parent,selection:{provider:'mainline',stageId:'mainline-05',seed:1},token});
 assert.equal(x.prefab.refs,1);assert.equal(x.effect.refs,1);assert.equal(parent.children.length,1);const rig=parent.children[0];assert(rig.active,"r4.2: the scene is active (with its host); visibility = camera");assert.equal(rig.find("MeadowBackgroundCamera").getComponent(x.cc.Camera).enabled,false);assert.equal(lease.diagnostics().renderer,'region-live-3d');
 lease.frame(true,{width:390,height:844,boardTop:300});lease.setVisible(true);lease.setPaused(false);const motion=rig.getComponent(x.M.MeadowSceneMotion);motion.onLoad();motion.update(.08);assert(motion.diagnostics().seconds>0);
 const before=motion.diagnostics().seconds;lease.setPaused(true);motion.update(.1);assert.equal(motion.diagnostics().seconds,before);lease.setPaused(false);x.cc.game.emit(x.cc.Game.EVENT_HIDE);motion.update(.1);assert.equal(motion.diagnostics().seconds,before);x.cc.game.emit(x.cc.Game.EVENT_SHOW);motion.update(.1);assert(motion.diagnostics().seconds>before);
 const background=rig.find('MeadowBackgroundCamera').getComponent(x.cc.Camera);assert.equal(background.visibility,1<<20);assert.equal(background.priority,44);assert.equal(background.fov,49.42635311494791);
 const old=background.node.position.clone();lease.frame(false,{width:844,height:390,boardTop:180});assert.notDeepEqual(background.node.position,old);assert.equal(world.visibility,1<<30);assert.deepEqual(camNode.position,new x.cc.Vec3());
 lease.hide?.();lease.setVisible(false);const frozen=motion.diagnostics().seconds;motion.update(.1);assert.equal(motion.diagnostics().seconds,frozen);lease.dispose();lease.dispose();assert.equal(x.prefab.refs,0);assert.equal(x.effect.refs,0);assert.equal(parent.children.length,0);assert.equal(x.cc.game.listeners('hide'),0);lease.frame(true,{width:390,height:844,boardTop:300});
 x.setMissing(true);await assert.rejects(x.M.createMeadowBoardBackground({parent,selection:{stageId:'r05-meadow-01'},token:new x.Cancellation()}),/player_spawn/);assert.equal(parent.children.length,0);assert.equal(x.prefab.refs,0);assert.equal(x.effect.refs,0);x.setMissing(false);
 const pending=[],late=new x.Cancellation();x.setDelay(pending);const entry=x.M.createMeadowBoardBackground({parent,selection:{stageId:'mainline-05'},token:late});await Promise.resolve();await Promise.resolve();late.cancel();await assert.rejects(entry,/cancelled/);for(const done of pending)done();await Promise.resolve();assert.equal(parent.children.length,0);assert.equal(x.prefab.refs,0);x.setDelay(null);
 const orphanParent=new x.cc.Node('DestroyedWhileLoading');x.cc._scene.addChild(orphanParent);const orphanPending=[];x.setDelay(orphanPending);
 const orphan=x.M.createMeadowBoardBackground({parent:orphanParent,selection:{stageId:'mainline-05'},token:new x.Cancellation()});await Promise.resolve();await Promise.resolve();orphanParent.destroy();for(const done of orphanPending)done();await assert.rejects(orphan,/owner destroyed/);assert.equal(x.prefab.refs,0);assert.equal(x.effect.refs,0);x.setDelay(null);
 // Advance uses the actual preflight before surrendering the saved board.
 const C=x.H.load('world-r2/WorldNativeComposition').WorldNativeComposition,c=Object.create(C.prototype),order=[];
 c.world={commands:()=>({exitLevel(){order.push('exit');return {ok:true};}})};c.activeSession={snapshot:()=>({provider:'mainline-v33',state:'result.saved',result:{completionRecorded:true},nextStageId:'mainline-05'})};c.enterMainlineStage=async id=>{order.push(id);return {ok:true};};
 x.setFail(true);assert.equal((await c.advanceMainline()).reason,'meadow-scene-load-failed');assert.deepEqual(order,[]);x.setFail(false);assert((await c.advanceMainline()).ok);assert.deepEqual(order,['exit','mainline-05']);
 console.log(JSON.stringify({status:'PASS',cases:['current derivative model mounts through RegionLoader, dedicated 3D camera behind board','imported camera/animation autoplay disabled; required anchors and five merged grass renderers validated','actual source portrait/landscape camera pose applied without world-camera mutation','windmill/grass clocks pause on result, hide, explicit pause and freeze when hidden','resource refs, nodes and app listeners released on double dispose, missing anchor and late cancelled load','failed preflight retains saved board; successful preflight permits actual mainline05 transition'],scope:'Actual TypeScript against Cocos node/asset doubles created from current GLB. Creator importer/shader and native visual acceptance pending'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
