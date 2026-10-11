'use strict';
// Actual local WarmButton + Skin + Geometry + ResultChest3D + View share ONE scene/director.
// Cocos APIs/GPU are doubles here; native GLSL rasterization is a separate reproduction step.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'../creator-build-project/assets/scripts');
const counts={mesh:0,material:0,texture:0,frame:0,refs:0},loads=[],warnings=[];let failChestMesh=false;
class Emitter{constructor(){this.events=[];}on(k,f,t){this.events.push({k,f,t,once:false});}once(k,f,t){this.events.push({k,f,t,once:true});}off(k,f,t){this.events=this.events.filter(e=>!(e.k===k&&e.f===f&&e.t===t));}emit(k,...a){for(const e of this.events.filter(e=>e.k===k)){if(e.once)this.off(k,e.f,e.t);e.f.apply(e.t,a);}}}
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}}
class Vec4{constructor(x,y,z,w){Object.assign(this,{x,y,z,w});}}
class Component{constructor(){this.enabled=true;this.isValid=true;}get enabledInHierarchy(){return this.enabled&&this.node.activeInHierarchy;}}
class Node extends Emitter{static EventType={TOUCH_START:'start',TOUCH_MOVE:'move',TOUCH_END:'end',TOUCH_CANCEL:'cancel'};constructor(name=''){super();Object.assign(this,{name,children:[],components:[],position:new Vec3,layer:1,active:true,isValid:true});}get activeInHierarchy(){return this.active&&this.isValid&&(!this.parent||this.parent.activeInHierarchy);}addChild(n){n.removeFromParent();this.children.push(n);n.parent=this;}removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}setPosition(x,y,z=0){this.position=x instanceof Vec3?x:new Vec3(x,y,z);}setRotationFromEuler(...v){this.rotation=v;}lookAt(v){this.look=v;}setSiblingIndex(i){const a=this.parent.children;a.splice(a.indexOf(this),1);a.splice(i,0,this);}addComponent(C){const c=new C;c.node=this;this.components.push(c);return c;}getComponent(C){return this.components.find(c=>c instanceof C)||null;}getComponentsInChildren(C){return [...this.components.filter(c=>c instanceof C),...this.children.flatMap(n=>n.getComponentsInChildren(C))];}destroy(){if(!this.isValid)return;this.isValid=false;for(const c of this.components){c.onDestroy?.();c.isValid=false;}for(const n of [...this.children])n.destroy();this.removeFromParent();this.events=[];}}
class UITransform{setContentSize(w,h){this.width=w;this.height=h;}hitTest(p,windowId){return windowId===0&&Math.abs(p.x)<=this.width/2&&Math.abs(p.y)<=this.height/2;}}
class Graphics{constructor(){this.ops=[];}clear(){this.ops=[];}roundRect(...v){this.current=v;}fill(){this.ops.push(this.current);}}
class Sprite{static SizeMode={CUSTOM:1};}class Label{static Overflow={SHRINK:1};}
class Camera{static ProjectionType={ORTHO:0};static ClearFlag={SOLID_COLOR:7};constructor(){this.visibility=1;this.enabled=true;}}
class Color{constructor(...v){this.value=v;}}class Rect{constructor(...v){this.value=v;}}class Size{constructor(...v){this.value=v;}}
const asset=key=>class{constructor(){this.isValid=true;counts[key]++;}destroy(){assert(this.isValid,'double destroy '+key);this.isValid=false;counts[key]--;}};
class Mesh extends(asset('mesh')){}class Material extends(asset('material')){constructor(){super();this.passes=[{}];}initialize(o){this.options=o;}setProperty(){}}
class RenderTexture extends(asset('texture')){reset(o){Object.assign(this,o);}readPixels(x,y,w,h){return new Uint8Array(w*h*4).fill(255);}}
class SpriteFrame extends(asset('frame')){reset(o){Object.assign(this,o);}}
class EffectAsset{addRef(){counts.refs++;}decRef(){counts.refs--;}}
class MeshRenderer{setMaterial(m){this.material=m;}setSharedMaterial(m){this.material=m;}}
const scene=new Node('scene'),director=new Emitter,game=new Emitter;director.getScene=()=>scene;
const cc={Node,Component,Camera,Color,Vec3,Vec4,Rect,Size,UITransform,Graphics,Sprite,Label,Mesh,Material,MeshRenderer,RenderTexture,SpriteFrame,EffectAsset,game,Game:{EVENT_HIDE:'hide'},director,Director:{EVENT_AFTER_DRAW:'draw'},resources:{load:(path,type,cb)=>loads.push({path,cb})},utils:{createMesh:(g,unused,o)=>{assert(o?.calculateBounds);if(failChestMesh&&g.colors?.[3]===.70)throw Error('combined injected chest mesh failure');const m=new Mesh;m.geometry=g;return m;}},isValid:o=>!!o&&o.isValid!==false,_decorator:{ccclass:()=>x=>x},console:{warn:(...x)=>warnings.push(x)}};
function evaluate(file,returns,extra={}){const text=fs.readFileSync(path.join(root,file),'utf8').replace(/^import .*;\n/gm,'').replace(/^@ccclass.*\n/gm,'').replace(/export /g,'');const v={...cc,...extra};return new Function(...Object.keys(v),stripTypeScriptTypes(text,{mode:'transform'})+';return '+returns)(...Object.values(v));}
const geometry=evaluate('ui/WarmButtonGeometry.ts','{warmButtonPairGeometry}');const Skin=evaluate('ui/WarmButtonSkin.ts','WarmButtonSkin',geometry);
const {WarmButton,warmButton}=evaluate('WarmButton.ts','{WarmButton,warmButton}',{WarmButtonSkin:Skin,GameAudio:{notifyUserGesture(){}}});
const DATA=evaluate('ResultChestGeometry.ts','RESULT_CHEST_GEOMETRY'),resource=evaluate('ResultChest3D.ts','RESULT_CHEST_3D_RESOURCE',{DATA});
const View=evaluate('ResultChestView.ts','ResultChestView',{RESULT_CHEST_RESOURCE:resource,RESULT_CHEST_SIZE:112});
function button(w=130,h=42){const n=new Node('Return');n.layer=1<<25;scene.addChild(n);n.addComponent(UITransform).setContentSize(w,h);const b=warmButton(n,w,h);let calls=0,events=0;b.bind(()=>calls++);n.on(WarmButton.ACTIVATED,()=>events++);return {n,b,get calls(){return calls},get events(){return events}};}
function chest(){const n=new Node('Chest');n.layer=1<<25;scene.addChild(n);n.addComponent(UITransform).setContentSize(112,112);const v=n.addComponent(View);v.initialize(0);return {n,v};}
function loadAll(){while(loads.length)loads.shift().cb(null,new EffectAsset);}
function draw(){director.emit('draw');}
const touch={getID:()=>1,getLocation:()=>({x:0,y:0}),getUILocation:()=>({x:0,y:0}),windowId:0};
function tap(b){b.n.emit('start',touch);b.n.emit('end',touch);b.n.emit('end',touch);}
const world=new Node('world-camera');scene.addChild(world);const worldCam=world.addComponent(Camera);worldCam.visibility=1820327937;worldCam.priority=0;worldCam.exposure=1.7;
const ui=new Node('ui-camera');scene.addChild(ui);const uiCam=ui.addComponent(Camera);uiCam.visibility=1<<25;uiCam.priority=100;
const initialWorld=JSON.stringify({mask:worldCam.visibility,priority:worldCam.priority,exposure:worldCam.exposure,uiMask:uiCam.visibility,uiPriority:uiCam.priority});
function unchanged(){assert.equal(JSON.stringify({mask:worldCam.visibility,priority:worldCam.priority,exposure:worldCam.exposure,uiMask:uiCam.visibility,uiPriority:uiCam.priority}),initialWorld);}
function clean(){for(const[k,v]of Object.entries(counts))assert.equal(v,0,k+' leaked');assert.equal(director.events.length,0);assert.equal(game.events.length,0);assert.deepEqual(scene.children,[world,ui]);assert.equal(loads.length,0);unchanged();}
const checks=[];
for(const order of ['button-first','chest-first']){
 const c=order==='chest-first'?chest():null,b=button(),d=c||chest(),b2=button(240,46);loadAll();
 const cams=scene.getComponentsInChildren(Camera);const buttonCam=cams.find(c=>c.visibility===1<<18),chestCam=cams.find(c=>c.visibility===1<<19);assert(buttonCam&&chestCam);assert.equal(buttonCam.usePostProcess,false);assert.equal(chestCam.usePostProcess,false);assert.notEqual(buttonCam.targetTexture,chestCam.targetTexture);draw();draw();d.v.update(0);assert.equal(d.v.diagnostics().renderer.state,'ready');assert(!buttonCam.enabled&&!chestCam.enabled);assert.equal(b.n.getComponent(Graphics).ops.length,0);assert.equal(b2.n.getComponent(Graphics).ops.length,0);
 tap(b);assert.equal(b.calls,1);assert.equal(b.events,1);d.v.setOpen(1);for(let i=0;i<7;i++){d.v.update(.1);draw();}assert.equal(d.v.diagnostics().renderer.open,1);assert(!chestCam.enabled);tap(b);assert.equal(b.calls,2);assert.equal(b.events,2);unchanged();b.n.destroy();b2.n.destroy();d.n.destroy();clean();
}
checks.push('Both creation orders: actual button/chest modules coexist in one scene on layers 18/19, separate RTs, explicit no-postprocess, idle cameras off, return callback exactly once');
{
 const b=button(),c=chest();c.v.onDisable();loadAll();draw();assert.equal(c.v.diagnostics().renderer.state,'awaiting-first-frame');tap(b);assert.equal(b.calls,1);c.v.onEnable();draw();c.v.update(0);assert.equal(c.v.diagnostics().renderer.state,'ready');c.v.setOpen(1);c.v.update(.1);draw();const open=c.v.diagnostics().renderer.open;c.v.onDisable();c.v.update(.1);assert.equal(c.v.diagnostics().renderer.open,open);c.v.onEnable();for(let i=0;i<7;i++){c.v.update(.1);draw();}assert.equal(c.v.diagnostics().renderer.open,1);b.n.destroy();c.n.destroy();clean();
}
checks.push('Hide-before-first-draw and hide-mid-animation pause only chest; buttons remain usable; show resumes without stale readiness');
{
 const b=button(),c=chest();loadAll();draw();c.v.update(0);c.v.setOpen(1);failChestMesh=true;assert.doesNotThrow(()=>c.v.update(.1));failChestMesh=false;assert.equal(c.v.diagnostics().renderer.state,'error');assert.equal(c.n.getComponent(Label).string,'宝箱图像\n暂未载入');tap(b);assert.equal(b.calls,1);assert.equal(b.events,1);b.n.destroy();c.n.destroy();clean();
}
checks.push('Animation GPU failure frees chest renderer and displays bounded error while actual return-button input continues working once');
for(let i=0;i<30;i++){const b=button(),c=chest();if(i%2){b.n.destroy();c.n.destroy();loadAll();draw();}else{loadAll();draw();b.n.destroy();c.n.destroy();draw();}clean();}
checks.push('30 joint re-entry/disposal cycles, including both asynchronous callbacks after destruction, leave no rig, GPU asset, reference or event listener');
unchanged();checks.push('Existing world/UI camera masks, priorities and exposure remain exact throughout both rendering paths');
const report={status:'PASS',checks,counts,warnings:warnings.length,scope:'Actual integrated TypeScript against one shared Cocos-double scene; not Creator/device acceptance'};const out=path.resolve(__dirname,'../evidence/combined-3d');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
