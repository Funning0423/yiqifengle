'use strict';
// Actual production WarmButton + Skin code, with an explicit Cocos 3.8.8 lifecycle-order model.
// This is NOT a Creator runtime test. The setPosition body and isValid flags follow the cited engine source.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'..'),scripts=root+'/creator-build-project/assets/scripts/',evidence=root+'/evidence/childfirst-lifecycle/';
const source={button:fs.readFileSync(scripts+'WarmButton.ts','utf8'),skin:fs.readFileSync(scripts+'ui/WarmButtonSkin.ts','utf8'),oldButton:fs.readFileSync(evidence+'WarmButton.ts.before','utf8'),oldSkin:fs.readFileSync(evidence+'WarmButtonSkin.ts.before','utf8')};
const Destroyed=1,ToDestroy=4,Destroying=128;
function isValid(value,strictMode){if(typeof value==='object')return !!value&&!(value._objFlags&(strictMode?(Destroyed|ToDestroy):Destroyed));return typeof value!=='undefined'}
const Vec3={copy(out,v){out.x=v.x;out.y=v.y;out.z=v.z;return out},set(out,x,y,z){out.x=x;out.y=y;out.z=z;return out}};
let positionWrites=0,invalidWrites=0,releaseCalls=0,audioGestures=0;
class Emitter{constructor(){this.events=new Map()}on(k,f,t){const a=this.events.get(k)||[];a.push({f,t});this.events.set(k,a)}once(k,f,t){this.on(k,f,t)}off(k,f,t){const a=this.events.get(k)||[];this.events.set(k,a.filter(x=>x.f!==f||x.t!==t))}emit(k,...args){const a=this.events.get(k)||[];for(const x of a)x.f.apply(x.t,args)}}
class Component{constructor(){this._objFlags=0;this.enabledInHierarchy=true}}
class Node extends Emitter{
 static EventType={TOUCH_START:'start',TOUCH_MOVE:'move',TOUCH_END:'end',TOUCH_CANCEL:'cancel'};
 constructor(name=''){super();this._objFlags=0;this.name=name;this.children=[];this.components=[];this._lpos={x:0,y:0,z:0};this.activeInHierarchy=true;this.layer=1}
 get isValid(){return isValid(this)}get position(){return this._lpos}
 setPosition(val,y,z){ // Cocos 3.8.8 node.ts L2253-2269 numeric/vector semantics.
  positionWrites++;if(!isValid(this,true))invalidWrites++;
  const localPosition=this._lpos;
  if(y===undefined)Vec3.copy(localPosition,val);else{if(z===undefined)z=localPosition.z;Vec3.set(localPosition,val,y,z)}
  this.invalidateChildren(1);if(this._eventMask&1)this.emit('transform-changed',1);
 }
 invalidateChildren(){}
 addChild(n){n.parent=this;this.children.push(n)}addComponent(C){const c=new C;c.node=this;this.components.push(c);return c}getComponent(C){return this.components.find(c=>c instanceof C)||null}
 setSiblingIndex(i){const a=this.parent.children;a.splice(a.indexOf(this),1);a.splice(i,0,this)}getComponentsInChildren(C){let found=this.components.filter(c=>c instanceof C);for(const n of this.children)found=found.concat(n.getComponentsInChildren(C));return found}
 destroy(){if(!isValid(this,true))return false;this._objFlags|=ToDestroy;deactivate(this);pending.push(this);return true}
 _destroyImmediate(){if(!isValid(this))return;this._objFlags|=Destroying;const parent=this.parent;
  if(parent&&!(parent._objFlags&Destroying))parent.children=parent.children.filter(n=>n!==this);
  // Official Node order: all child _destroyImmediate calls precede own component destruction.
  for(let i=0;i<this.children.length;i++)this.children[i]._destroyImmediate();
  for(let i=0;i<this.components.length;i++)destroyComponent(this.components[i],true);
  // Official CCObject._destruct nulls own object/function properties; Destroyed is set afterward.
  destruct(this);this._objFlags|=Destroyed;
 }
}
let pending=[];
function destruct(o){for(const k of Object.keys(o)){const t=typeof o[k];if(t==='object'||t==='function')o[k]=null;else if(t==='string')o[k]=''}}
function deactivate(n){n.activeInHierarchy=false;for(const c of n.components)if(c.onDisable)c.onDisable();for(const child of n.children)deactivate(child)}
function flush(){while(pending.length){const q=pending;pending=[];for(const n of q)if(isValid(n))n._destroyImmediate()}}
function destroyComponent(c,byParent=false){if(!isValid(c))return;c.onDisable?.();c.onDestroy?.();if(!byParent&&c.node)c.node.components=c.node.components.filter(x=>x!==c);destruct(c);c._objFlags|=Destroyed}
class UITransform extends Component{setContentSize(w,h){this.width=w;this.height=h}hitTest(p){return Math.abs(p.x-this.node.position.x)<=this.width/2&&Math.abs(p.y-this.node.position.y)<=this.height/2}}
class Graphics extends Component{clear(){}roundRect(){}fill(){}}class Color{constructor(...v){this.v=v}}
class Sprite extends Component{static SizeMode={CUSTOM:0};get spriteFrame(){return this._spriteFrame}set spriteFrame(v){if(!isValid(this,true)){invalidWrites++;throw Error('sprite write after destroy')}this._spriteFrame=v}}
class Camera extends Component{static ProjectionType={ORTHO:1};static ClearFlag={SOLID_COLOR:7};set enabled(v){if(!isValid(this,true)){invalidWrites++;throw Error('camera write after destroy')}this._enabled=v}}
class MeshRenderer extends Component{set mesh(v){if(!isValid(this,true)){invalidWrites++;throw Error('renderer write after destroy')}this._mesh=v}}
const game=new Emitter,director=new Emitter;director.getScene=()=>null;
const cc={Component,Node,UITransform,Graphics,Color,Sprite,Camera,MeshRenderer,Vec3,game,Game:{EVENT_HIDE:'hide'},director,Director:{EVENT_AFTER_DRAW:'draw'},isValid,_decorator:{ccclass:()=>x=>x},GameAudio:{notifyUserGesture(){audioGestures++}}};
function compile(text,vars,end){let js=stripTypeScriptTypes(text.replace(/^import .*;\n/gm,'').replace(/^@ccclass.*\n/gm,''),{mode:'transform'}).replace(/export /g,'');return new Function(...Object.keys(vars),js+';return '+end)(...Object.values(vars))}
function api(old=false){const visual=compile(old?source.oldSkin:source.skin,cc,'{WarmButtonSkin,SkinCache}');return {...visual,...compile(old?source.oldButton:source.button,{...cc,...visual},'{WarmButton,warmButton}')};}
function create(A){const board=new Node('Board'),n=new Node('BackButton');board.addChild(n);n.addComponent(UITransform).setContentSize(46,46);const b=A.warmButton(n,46,46),label=new Node('Label');n.addChild(label);b.addContent(label);b.skin.release=()=>releaseCalls++;return {board,n,b,label,face:b.face,skin:b.skin}}
const event=(id=1,x=0,y=0)=>({getID:()=>id,getLocation:()=>({x,y}),getUILocation:()=>({x,y}),windowId:0});
const checks=[];function check(name,fn){game.events.clear();director.events.clear();pending=[];positionWrites=invalidWrites=releaseCalls=audioGestures=0;fn();checks.push(name)}
check('negative control: old actual onDestroy repaints a child whose _lpos was nulled before owner component destruction',()=>{const A=api(true),x=create(A);x.b.bind(()=>{});x.face._destroyImmediate();assert(isValid(x.b,true));assert(isValid(x.n,true));assert.equal(x.face._lpos,null);assert.throws(()=>x.b.onDestroy(),/Cannot set properties of null/);assert.equal(releaseCalls,1)});
check('negative control: old complete child-first Board destruction throws through onDisable or onDestroy',()=>{const A=api(true),x=create(A);x.b.bind(()=>{});assert.throws(()=>x.board._destroyImmediate(),/Cannot set properties of null|sprite write after destroy/)});
check('normal back action queues Board destruction and completes full child-first teardown with no dead-node writes',()=>{const A=api(),x=create(A);let back=0,activated=0;x.b.bind(()=>{back++;x.board.destroy()});x.n.on(A.WarmButton.ACTIVATED,()=>activated++);x.n.emit('start',event());x.n.emit('end',event());assert.equal(back,1);assert.equal(activated,1);assert.equal(audioGestures,1);flush();assert(!isValid(x.board));assert.equal(invalidWrites,0);assert.equal(releaseCalls,1);assert(!(game.events.get('hide')||[]).some(v=>v.t===x.b))});
check('cascade destruction while component and owner are still strict-valid skips dead face/content in onDisable',()=>{const A=api(),x=create(A);x.b.bind(null);x.n.emit('start',event());x.face._destroyImmediate();x.label._destroyImmediate();assert(isValid(x.n,true)&&isValid(x.b,true));const writes=positionWrites;x.b.onDisable();assert.equal(positionWrites,writes);assert.equal(x.b.pointer,null);assert.equal(x.b.pressed,false);x.board._destroyImmediate();assert.equal(invalidWrites,0);assert.equal(releaseCalls,1)});
check('queued face/content are ignored under strict validity even before their object fields are cleared',()=>{const A=api(),x=create(A);x.face._objFlags|=ToDestroy;x.label._objFlags|=ToDestroy;assert(x.face.isValid&&x.label.isValid);const writes=positionWrites;x.b.cancelPress();assert.equal(positionWrites,writes);x.board._destroyImmediate();assert.equal(invalidWrites,0)});
check('live disable/hide/drag-out cancellation restores the raised face and blocks a late release',()=>{const A=api(),x=create(A);let fired=0;x.b.bind(()=>fired++);for(const kind of ['disable','hide','drag']){x.n.emit('start',event());assert.equal(x.face.position.y,0);if(kind==='disable')x.b.onDisable();else if(kind==='hide')game.emit('hide');else x.n.emit('move',event(1,100,0));assert.equal(x.face.position.y,2);x.n.emit('end',event());assert.equal(fired,0)}x.board.destroy();flush();assert.equal(invalidWrites,0)});
check('component-only removal releases its skin, removes listeners and owned face, then recreation accepts one tap',()=>{const A=api(),x=create(A);let old=0,next=0;x.b.bind(()=>old++);x.n.emit('start',event());x.b._objFlags|=ToDestroy;destroyComponent(x.b);flush();assert(isValid(x.n,true));assert.equal(releaseCalls,1);x.n.emit('end',event());assert.equal(old,0);const fresh=A.warmButton(x.n,46,46);fresh.bind(()=>next++);x.n.emit('start',event());x.n.emit('end',event());assert.equal(next,1);x.board.destroy();flush();assert.equal(invalidWrites,0)});
check('skin releases exactly once even after its Sprite and UI node have already been destructed',()=>{const A=api(),x=create(A);x.skin.node._destroyImmediate();x.skin.destroy();x.skin.destroy();assert.equal(releaseCalls,1);assert.equal(invalidWrites,0);x.b.onDestroy();assert.equal(releaseCalls,1);flush()});
check('cache teardown skips already destroyed camera/renderer/rig but still releases owned GPU assets',()=>{const A=api(),c=new A.SkinCache(new Node('Scene'));let assets=0;const gpu=()=>({destroy(){assets++}});const rig=new Node('Rig');c.camera=rig.addComponent(Camera);c.renderer=rig.addComponent(MeshRenderer);c.rig=rig;c.mesh=gpu();c.material=gpu();c.effect={decRef(){assets++}};c.entries.set('one',{key:'one',frames:[gpu(),gpu()],texture:gpu(),bytes:8});c.bytes=8;rig._destroyImmediate();c.dispose();assert.equal(assets,6);assert.equal(c.entries.size,0);assert.equal(invalidWrites,0)});
check('onDestroy cancellation does not call positionFace and remains idempotent while the component object exists',()=>{const A=api(),x=create(A);x.b.positionFace=()=>{throw Error('teardown must not repaint')};x.b.onDestroy();x.b.onDestroy();assert.equal(releaseCalls,1);assert.equal(x.b.pointer,null);assert.equal(x.b.pressed,false);flush()});
const report={status:'PASS',scope:'Actual before/after WarmButton and Skin methods executed with explicit Cocos 3.8.8 child-first/field-nulling lifecycle model and matching setPosition/isValid semantics; NOT full Creator or WeChat execution',checks};fs.writeFileSync(evidence+'childfirst-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
