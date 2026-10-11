/** The actual TS component executes against a deliberately minimal cc double. NOT Cocos import/runtime. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {stripTypeScriptTypes}=require('node:module');
const babelModules=process.env.WORLD_BABEL_MODULES||'/workspace/shared/grok-takeover/gameplay/r4-compat-work/compiler/node_modules';
const babel=require(path.join(babelModules,'@babel/core'));
const commonjs=require(path.join(babelModules,'@babel/plugin-transform-modules-commonjs'));
const {FIRSTSLICE}=require('../components/FirstsliceFacts.ts');
class Vec3 {constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}clone(){return new Vec3(this.x,this.y,this.z)}}
const quat=()=>({x:0,y:0,z:0,w:1,clone(){return {...this}}});
class Node {constructor(name){this.name=name;this.parent=null;this.children=[];this.position=new Vec3();this.rotation=quat();this.scale=new Vec3(1,1,1);this.renderers=[];this.isValid=true;this.destroyCount=0;}
 get worldPosition(){return this.position}get worldRotation(){return this.rotation}get worldScale(){return this.scale}
 addChild(n){n.parent=this;this.children.push(n)}getChildByName(name){return this.children.find(n=>n.name===name)||null}
 getComponents(){return this.renderers}getComponentsInChildren(){return [...this.renderers,...this.children.flatMap(n=>n.getComponentsInChildren())]}
 setWorldPosition(...args){this.position=args.length===1?args[0].clone():new Vec3(...args)}setWorldRotation(q){this.rotation={...q}}
 setRotationFromEuler(x,y,z){this.euler=[x,y,z]}lookAt(target){this.lookTarget=target}
 destroy(){this.isValid=false;this.destroyCount++}
}
class MeshRenderer{constructor(node){this.node=node;this.enabled=true}}
class Component{constructor(){this.node=new Node('WorldFlowOwner')}}
class Camera{constructor(){this.node=new Node('WorldCamera')}}
const events=new Map();const game={on:(name,fn,target)=>events.set(name,{fn,target}),off:(name)=>events.delete(name)};
function loadComponent(){const file=path.resolve(__dirname,'../components/WorldFlowComponent.ts');const ts=fs.readFileSync(file,'utf8').replace(/@ccclass\([^\n]+\)\n/g,'').replace(/@property\([^)]*\) /g,'');
 const js=stripTypeScriptTypes(ts,{mode:'transform'});const cjs=babel.transformSync(js,{plugins:[commonjs],configFile:false,babelrc:false}).code;
 const mod={exports:{}};new Function('require','module','exports',cjs)(id=>id==='cc'?{_decorator:{ccclass:()=>()=>{},property:()=>()=>{}},Component,Prefab:class{},instantiate:p=>p.factory(),Camera,Vec3,MeshRenderer,Node,game,Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'}}:require(path.resolve(path.dirname(file),id+'.ts')),mod,mod.exports);return mod.exports.WorldFlowComponent;
}
const WorldFlowComponent=loadComponent();
function model(){const root=new Node('ImportedCombined');function get(p){let n=root;for(const part of p.split('/')){let x=n.getChildByName(part);if(!x){x=new Node(part);n.addChild(x)}n=x;}return n;}
 for(const a of Object.values(FIRSTSLICE.anchors))get(a.path).position=new Vec3(...a.position);
 get(FIRSTSLICE.anchors.seat_anchor.path).rotation={x:0,y:Math.sin(-1),z:0,w:Math.cos(-1)};
 get(FIRSTSLICE.door.path).position=new Vec3(...FIRSTSLICE.door.hinge);
 for(const a of FIRSTSLICE.renderers){const n=get(a.path);n.renderers.push(new MeshRenderer(n));}
 return root;
}
function rig(){const comp=new WorldFlowComponent(),scene=new Node('Scene'),camera=new Camera();scene.addChild(comp.node);scene.addChild(camera.node);let imported;
 comp.firstsliceModel={factory:()=>imported=model()};comp.worldCamera=camera;const ui=new Node('NativeBoardUI');scene.addChild(ui);
 return {comp,scene,camera,ui,get imported(){return imported}};}
const levels={enter:async()=>({requestExit(){return {ok:true}},hide(){},showPaused(){},resume(){return {ok:true}},dispose(){}})};

test('real component validates imported paths, classifies 24 renderers, and touches no UI node',async()=>{
 const r=rig();assert.equal((await r.comp.initialize(levels)).ok,true);assert.equal(r.comp.commands().snapshot().state,'home');assert.equal(r.imported.getComponentsInChildren().length,24);
 for(const info of FIRSTSLICE.renderers){let n=r.imported;for(const part of info.path.split('/'))n=n.getChildByName(part);assert.equal(n.renderers[0].enabled,info.layer!=='exterior');}
 assert.equal(r.ui.isValid,true);assert.equal(r.ui.children.length,0);assert.deepEqual(Object.keys(r.comp.commands()).sort(),['cancelTransition','enterLevel','exitLevel','leaveHome','resume','returnHome','setMode','snapshot'].sort());
 r.comp.onDestroy();assert.equal(r.imported.destroyCount,1);assert.equal(r.ui.isValid,true);assert.equal(events.size,0);
});
test('camera is prohibited from owning the static world, and vice versa',async()=>{
 const r=rig();r.camera.node.addChild(r.comp.node);await assert.rejects(()=>r.comp.initialize(levels),/independent siblings/);
 const q=rig();q.comp.node.addChild(q.camera.node);await assert.rejects(()=>q.comp.initialize(levels),/independent siblings/);
});
test('imported anchor mismatch destroys only the newly instantiated model',async()=>{
 const r=rig();let imported;r.comp.firstsliceModel={factory:()=>{imported=model();imported.getChildByName('scene_root').getChildByName('interaction_anchors').getChildByName('seat_anchor').position.x+=.2;return imported;}};
 const result=await r.comp.initialize(levels);assert.equal(result.ok,false);assert.match(result.reason,/Anchor changed/);assert.equal(imported.destroyCount,1);assert.equal(r.ui.isValid,true);r.comp.onDestroy();
});
test('extra or residual mesh fails closed rather than leaking across scene layers',async()=>{
 const r=rig();let imported;r.comp.firstsliceModel={factory:()=>{imported=model();const stray=new Node('stray-interior-copy');stray.renderers.push(new MeshRenderer(stray));imported.addChild(stray);return imported;}};
 const result=await r.comp.initialize(levels);assert.equal(result.ok,false);assert.match(result.reason,/Unclassified renderer/);assert.equal(imported.destroyCount,1);r.comp.onDestroy();
});
test('component disable / show requires explicit resume and destroy restores camera',async()=>{
 const r=rig();r.camera.node.setWorldPosition(8,6,12);await r.comp.initialize(levels);r.comp.onDisable();r.comp.onEnable();assert.equal(r.comp.commands().snapshot().state,'paused');assert.equal(r.comp.commands().resume().ok,true);r.comp.onDestroy();assert.deepEqual(r.camera.node.worldPosition,new Vec3(8,6,12));
});
test('rotating the static root is detected rather than counter-rotating the environment',async()=>{
 const r=rig();await r.comp.initialize(levels);r.imported.rotation={x:0,y:.1,z:0,w:Math.sqrt(.99)};assert.throws(()=>r.comp.update(.016),/World root must stay identity/);assert.equal(r.imported.rotation.y,.1);assert.equal(r.comp.commands().snapshot().needsResume,true);r.comp.onDestroy();
});

test('seat yaw mismatch is rejected even when its position remains exact',async()=>{
 const r=rig();r.comp.firstsliceModel={factory:()=>{const m=model();m.getChildByName('scene_root').getChildByName('interaction_anchors').getChildByName('seat_anchor').rotation=quat();return m;}};
 const result=await r.comp.initialize(levels);assert.equal(result.ok,false);assert.match(result.reason,/Seat anchor yaw/);r.comp.onDestroy();
});
test('component update clock advances jobs, cancellation rejects, and destroy prevents late writes',async()=>{
 const r=rig();await r.comp.initialize(levels);const {Cancellation}=require('../components/WorldFlowCore.ts');let value=-1;
 const done=r.comp.run(.2,new Cancellation(),t=>value=t);r.comp.update(10);assert.equal(value,.5);r.comp.update(.1);await done;assert.equal(value,1);
 const interrupted=r.comp.run(1,new Cancellation(),t=>value=t);r.comp.onDisable();await assert.rejects(()=>interrupted,/cancelled/);const before=value;r.comp.update(10);assert.equal(value,before);r.comp.onDestroy();r.comp.update(10);assert.equal(value,before);
});
