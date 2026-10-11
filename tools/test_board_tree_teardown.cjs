'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'../creator-build-project/assets/scripts');
class Emitter{constructor(){this.events=new Map()}on(t,f,c){if(!this.events.has(t))this.events.set(t,[]);this.events.get(t).push([f,c])}off(t,f,c){this.events.set(t,(this.events.get(t)||[]).filter(x=>x[0]!==f||x[1]!==c))}emit(t,...args){for(const[f,c]of [...this.events.get(t)||[]])f.apply(c,args)}}
const Destroyed=1,ToDestroy=4,Destroying=128;let invalidWrites=0,destroyedNodes=0,pending=[];
function valid(v,strict=false){return !!v&&!(v._objFlags&(strict?(Destroyed|ToDestroy):Destroyed));}
function write(v){if(!valid(v)){invalidWrites++;throw Error('write to destructed '+v.constructor.name);}}
function destruct(v){for(const k of Object.keys(v)){const t=typeof v[k];if(t==='object'||t==='function')v[k]=null;else if(t==='string')v[k]='';}v._objFlags|=Destroyed;}
function destroyComponent(c){if(!valid(c))return;c.onDisable?.();c.onDestroy?.();destruct(c);}
function deactivate(n){for(const c of n.components)c.onDisable?.();for(const child of n.children)deactivate(child);}
function flush(){while(pending.length){const q=pending;pending=[];for(const n of q)if(valid(n))n._destroyImmediate();}}
class Component{constructor(){this._objFlags=0;this._enabled=true}get isValid(){return valid(this)}get enabled(){return this._enabled}set enabled(v){write(this);this._enabled=v}get enabledInHierarchy(){return this.enabled&&this.node.activeInHierarchy}}
class Vec3{constructor(x=0,y=0,z=0){this.set(x,y,z)}set(x,y,z){this.x=x;this.y=y;this.z=z}static ONE=new Vec3(1,1,1)}
class Node extends Emitter{
 static EventType={TOUCH_START:'start',TOUCH_MOVE:'move',TOUCH_END:'end',TOUCH_CANCEL:'cancel'};
 constructor(name=''){super();this._objFlags=0;this.name=name;this.children=[];this.components=[];this._lpos=new Vec3();this.scale=new Vec3(1,1,1);this._active=true;this.layer=1}
 get isValid(){return valid(this)}get position(){return this._lpos}get active(){return this._active}set active(v){if(!valid(this))invalidWrites++;this._active=v}
 get activeInHierarchy(){return this.active&&valid(this)&&(!this.parent||this.parent.activeInHierarchy)}
 get worldPosition(){const p=this.parent?.worldPosition||new Vec3();return new Vec3(p.x+this.position.x,p.y+this.position.y,p.z+this.position.z)}
 addChild(n){n.removeFromParent();n.parent=this;this.children.push(n)}
 addComponent(C){const c=new C();c.node=this;this.components.push(c);return c}
 getComponent(C){return this.components.find(c=>c instanceof C)||null}
 getComponentInChildren(C){return this.getComponent(C)||this.children.map(c=>c.getComponentInChildren(C)).find(Boolean)||null}
 getComponentsInChildren(C){return [...this.components.filter(c=>c instanceof C),...this.children.flatMap(c=>c.getComponentsInChildren(C))]}
 getChildByName(n){return this.children.find(c=>c.name===n)||null}
 setPosition(v,y,z){const p=this._lpos;if(y===undefined){p.x=v.x;p.y=v.y;p.z=v.z}else{if(z===undefined)z=p.z;p.x=v;p.y=y;p.z=z}write(this)}
 setWorldPosition(x,y,z=0){const p=this.parent?.worldPosition||new Vec3();this.setPosition(x-p.x,y-p.y,z-p.z)}
 setScale(x,y=x,z=x){write(this);this.scale=new Vec3(x,y,z)}setSiblingIndex(){}
 removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null}
 destroy(){if(!valid(this,true))return false;this._objFlags|=ToDestroy;deactivate(this);pending.push(this);return true}
 _destroyImmediate(){if(!valid(this))return;this._objFlags|=Destroying;const parent=this.parent;if(parent&&!(parent._objFlags&Destroying))this.removeFromParent();
  // Cocos v3.8.8 Node._onPreDestroyBase: children BEFORE own components.
  for(let i=0;i<this.children.length;i++)this.children[i]._destroyImmediate();
  for(let i=0;i<this.components.length;i++)destroyComponent(this.components[i]);
  // CCObject._destroyImmediate calls _destruct before setting Destroyed.
  destruct(this);destroyedNodes++;
 }
}

let viewport={width:390,height:844};class UITransform extends Component{setContentSize(w,h){this.width=w;this.height=h}hitTest(p){const q=this.node.worldPosition;return Math.abs(p.x-viewport.width/2-q.x)<=this.width/2&&Math.abs(p.y-viewport.height/2-q.y)<=this.height/2}}
class Graphics extends Component{clear(){write(this)}roundRect(){}fill(){}stroke(){}moveTo(){}lineTo(){}close(){}circle(){}rect(){}arc(){}ellipse(){}}
class Color{constructor(hex){this.hex=hex}}class Label extends Component{static HorizontalAlign={CENTER:1};static VerticalAlign={CENTER:1};static Overflow={SHRINK:1};constructor(){super();this.string=''}}
class Sprite extends Component{static SizeMode={CUSTOM:1}}class ImageAsset{constructor(){this.refs=0}addRef(){this.refs++;return this}decRef(){this.refs--;return this}}
let textureFault=false,frameFault=0,frameCount=0;const madeTextures=[],madeFrames=[];
class Texture2D{constructor(){madeTextures.push(this)}set image(value){if(textureFault)throw Error('Injected texture setter failure');this._image=value}destroy(){this.destroyed=true}}
class SpriteFrame{constructor(){this.id=++frameCount;madeFrames.push(this)}set texture(value){this._texture=value}get texture(){return this._texture}set rect(value){if(this.id===frameFault)throw Error('Injected frame setter failure');this._rect=value}destroy(){this.destroyed=true}}
class Rect{constructor(x,y,w,h){Object.assign(this,{x,y,width:w,height:h})}}
class Canvas extends Component{}class Camera extends Component{static ProjectionType={ORTHO:1};static ClearFlag={DEPTH_ONLY:1}}class BlockInputEvents extends Component{}
const resourceCalls=[],resources={load:(name,type,fn)=>resourceCalls.push({name,type,fn})};const game=new Emitter();game.canvas=null;
const view=new Emitter();view.resizeWithBrowserSize=()=>{};view.getFrameSize=()=>viewport;view.setDesignResolutionSize=()=>{};
const timers=new Map(),allTimers=[],tweens=new Set();let timerID=0;
const cc={Component,Node,UITransform,Graphics,Color,Label,Sprite,ImageAsset,Texture2D,SpriteFrame,Rect,Canvas,Camera,BlockInputEvents,Vec3,resources,game,Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},view,ResolutionPolicy:{EXACT_FIT:1},Layers:{Enum:{UI_2D:1}},isValid:valid,profiler:{hideStats(){}},director:{},_decorator:{ccclass:()=>x=>x},Tween:{stopAllByTarget(n){tweens.delete(n)}},tween:n=>({to(){return this},start(){tweens.add(n);return this}})};
function evaluate(file,names,vars={}){let s=fs.readFileSync(file,'utf8').replace(/^import .*?;\n/gm,'').replace(/@ccclass\([^\n]+\)\n/g,'').replace(/export /g,'');const js=stripTypeScriptTypes(s,{mode:'transform'}),v={...cc,...vars};return new Function(...Object.keys(v),js+';return {'+names.join(',')+'}')(...Object.values(v))}
const localWarm=root+'/WarmButton.ts';
// Integrated regression must execute this tree's WarmButton; external fallbacks can hide a broken merge.
const warmPath=localWarm;
assert(fs.readFileSync(warmPath,'utf8').includes('static readonly ACTIVATED'),'Local WarmButton must include the reviewed successful-activation contract');
// GPU allocation is covered by the real skin/cache and joint-renderer suites; these doubles isolate UI input.
let skinReleases=0;const WarmButtonSkin=class{configure(){}setPressed(){}destroy(){skinReleases++}};
const GameAudio={notifyUserGesture(){}};
const warm=evaluate(warmPath,['WarmButton','warmButton','warmButtonGraphics'],{WarmButtonSkin,GameAudio});assert(warm.WarmButton.ACTIVATED,'This regression requires the reviewed successful-activation WarmButton');
const {managedTools}=evaluate(root+'/world-r2/ManagedTools.ts',['managedTools']);const {ManagedToolArt}=evaluate(root+'/ManagedToolArt.ts',['ManagedToolArt']);
const {resultLayout,resultActionCount}=evaluate(root+'/ResultLayout.ts',['resultLayout','resultActionCount']);
let chestDisposes=0;const RESULT_CHEST_SIZE=112,RESULT_CHEST_RESOURCE={id:'lifecycle-lease-double',kind:'model-3d',create(){let disposed=false;return {setOpen(){},setVisible(){},diagnostics(){return {state:'ready'}},dispose(){if(!disposed){disposed=true;chestDisposes++}}}}};
const {ResultChestView}=evaluate(root+'/ResultChestView.ts',['ResultChestView'],{RESULT_CHEST_SIZE,RESULT_CHEST_RESOURCE});
const {ManagedMobileBoardUI:UI}=evaluate(root+'/ManagedMobileBoardUI.ts',['ManagedMobileBoardUI'],{ResultChestView,RESULT_CHEST_SIZE,GameAudio,...warm,managedTools,ManagedToolArt,resultLayout,resultActionCount,Controller:class{},Port:{createSynchronousStorage:()=>({}),bindChallengeController:()=>({})},setTimeout:f=>{const id=++timerID;timers.set(id,f);allTimers.push(f);return id},clearTimeout:id=>timers.delete(id)});
function snapshot(provider='mainline-v33',region=0){return {provider,state:'run.ready',readOnly:false,stages:[],journey:{inventory:{tools:{windBell:2,tideBottle:2,tideNet:1,sunSeed:1,starShears:1}},regionRewards:[{region,claimed:true}]},active:{stageId:'test',attemptId:'test-1',level:region*4,name:'test',board:Array.from({length:49},(_,i)=>({id:i,type:i%6})),moss:[],roots:[],moves:20,bombs:2,score:0,status:'playing',actions:[],goals:{type0:20},goalOrder:['type0'],tool:{kind:['tideAnchor','sunSeed','prismShift'][region],charges:1},scene:{}},capabilities:{oceanEvents:false}}}
function originalSetup(provider='mainline-v33',region=0,w=390,h=844){viewport={width:w,height:h};const s=snapshot(provider,region),u=new UI;u.node=new Node('owner');u.calls=[];let render;
const binding={controller:{snapshot:()=>s},tools:()=>managedTools(s),useTool:(kind,i)=>{u.calls.push([kind,i]);s.active.actions.push(['tool',kind,i]);if(kind==='bomb')s.active.bombs--;else if(provider==='mainline-v33')s.journey.inventory.tools[kind]--;else s.active.tool.charges--;s.state='run.resolving';render(s);return {ok:true}},afterPaint:()=>{},bind:(c,v)=>{render=v.render;render(s);return {command:()=>({ok:true}),hide:()=>{s.state='run.paused';v.cancelAnimations();v.render(s)},show:()=>{},dispose:()=>{}}},restart:()=>({ok:true}),hint:()=>({cells:[0,1]})};u.initializeManaged({},binding);return {u,s,ready(){s.state='run.ready';u.render(s)}}}
function point(n){const p=n.worldPosition;return{x:p.x+viewport.width/2,y:p.y+viewport.height/2}}
function event(p,id=1,code='end'){return{getLocation:()=>p,getUILocation:()=>p,getID:()=>id,getEventCode:()=>code,windowId:0}}
function tapNode(n,id=1){const e=event(point(n),id);n.emit('start',e);n.emit('end',e)}
function drag(u,slot,target,options={}){const n=u.tools[slot],start=point(n),p=typeof target==='number'?point(u.cells[target]):target,id=options.id||1;n.emit('start',event(start,id));n.emit('move',event(p,id));n.emit(options.cancel?'cancel':'end',event(p,id,options.cancel?'cancel':'end'))}

const MainlinePort=require(root+'/mainline-r1/adapter/mainline-port.js');
const R4Port=require(root+'/r4-cloud-compat/adapter/cocos-port.js');
function setup({old=false,binder='mainline',result=false}={}){
 viewport={width:390,height:844};const s=snapshot(),UIClass=old?evaluate(path.resolve(__dirname,'../evidence/board-teardown/ManagedMobileBoardUI.ts.before'),['ManagedMobileBoardUI'],{ResultChestView,RESULT_CHEST_SIZE,GameAudio,...warm,managedTools,ManagedToolArt,resultLayout,resultActionCount,Controller:class{},Port:R4Port,setTimeout:f=>{const id=++timerID;timers.set(id,f);allTimers.push(f);return id},clearTimeout:id=>timers.delete(id)}).ManagedMobileBoardUI:UI;
 const owner=new Node('NativeBoardRoot'),u=owner.addComponent(UIClass);let calls=0,completions=0,adapterView;
 const c={snapshot:()=>s,onHide:()=>({ok:true}),onShow:()=>({ok:true}),finishVisualStep:()=>{completions++;return {ok:true}},requestExit:()=>({ok:true})};
 const binding={controller:c,tools:()=>managedTools(s),afterPaint(){},bind(c,v){adapterView=v;return binder==='mainline'?MainlinePort.bind(c,v):R4Port.bindChallengeController(c,v)},intercept(name){if(name==='requestExit'){calls++;u.host.dispose();owner.destroy();return {ok:true}}},hint:()=>({cells:[]}),restart:()=>({ok:true})};
 const startResource=resourceCalls.length;u.initializeManaged({},binding);
 for(const load of resourceCalls.slice(startResource))load.fn(null,new ImageAsset());
 if(result){s.state='result.saved';s.active.status='won';s.result={saved:true,outcome:'won',stars:3,completionRecorded:true};s.journey.chests=[{level:0,earned:true,opened:false}];u.render(s);}
 return {u,s,owner,binding,get view(){return adapterView},get calls(){return calls},get completions(){return completions}};
}
const checks=[];
function check(name,fn){pending=[];timers.clear();allTimers.length=0;tweens.clear();invalidWrites=destroyedNodes=skinReleases=chestDisposes=0;game.events.clear();view.events.clear();fn();checks.push(name)}
function tree(n){return [n,...n.children.flatMap(tree)]}
function arm(x){x.u.armedTool='windBell';x.u.toolDrag={kind:'windBell',slot:1,pointer:8,start:{x:0,y:0},moved:true,version:x.u.toolVersion()};x.u.moveGhost(180,280);}
function ensureReleased(x,nodes,frames,textures,images){assert(!valid(x.owner));assert(nodes.every(n=>!valid(n)));assert.equal(invalidWrites,0);assert.equal(timers.size,0);assert.equal(tweens.size,0);assert(frames.every(f=>f.destroyed));assert(textures.every(t=>t.destroyed));assert(images.every(a=>a.refs===0));assert(!(view.events.get('canvas-resize')||[]).some(e=>e[1]===x.u));assert.equal(game.events.get('hide')?.length||0,0);}
check('negative control: exact old UI source plus already-fixed WarmButton still throws reading z on complete Board return',()=>{
 const x=setup({old:true});tapNode(x.u.back);assert.equal(x.calls,1);assert.throws(flush,/Cannot read properties of null \(reading 'z'\)/);
});
for(const binder of ['mainline','r4'])for(const mode of ['playing','dragging','result','backpack','retry'])check('complete '+binder+' Board tree destruction from '+mode+' releases timers/tweens/atlases/listeners/chest',()=>{
 const fi=madeFrames.length,ti=madeTextures.length,x=setup({binder,result:mode==='result'});if(mode==='dragging')arm(x);if(mode==='backpack')x.u.toggleBag();if(mode==='retry')x.u.askRestart();
 const images=[x.u.pieceImage,x.u.toolArt.image],nodes=tree(x.owner);let done=0;x.view.animate(null,x.s,()=>done++);const stale=allTimers.at(-1);
 // Modals are intentionally closed through normal state before a back click; normal back is blocked while open.
 if(mode==='backpack')x.u.toggleBag();if(mode==='retry')x.u.retryPanel.active=false;
 tapNode(mode==='result'?x.u.targets.resultBack:x.u.back);assert.equal(x.calls,1);flush();stale();assert.equal(done,0);assert.equal(x.completions,0);ensureReleased(x,nodes,madeFrames.slice(fi),madeTextures.slice(ti),images);assert(skinReleases>=10);if(mode==='result')assert.equal(chestDisposes,1);
});
check('immediate ancestor destruction with active drag ghost and pending animation never paints dead descendants',()=>{
 const fi=madeFrames.length,ti=madeTextures.length,x=setup();arm(x);x.view.animate(null,x.s,()=>{throw Error('late done')});const nodes=tree(x.owner),images=[x.u.pieceImage,x.u.toolArt.image];x.owner._destroyImmediate();for(const stale of allTimers)stale();ensureReleased(x,nodes,madeFrames.slice(fi),madeTextures.slice(ti),images);
});
check('component-only destruction is idempotent, blocks reentrant rendering and late piece callback without killing surviving children',()=>{
 const x=setup();arm(x);x.view.animate(null,x.s,()=>{throw Error('late completion')});const images=[x.u.pieceImage];x.u.loadPieceArt();const late=resourceCalls.at(-1),newImage=new ImageAsset();let paints=0;const original=x.u.paintToolTray;x.u.paintToolTray=function(){if(this.disposing)paints++;return original.call(this)};x.u.onDestroy();x.u.onDestroy();late.fn(null,newImage);x.view.render(x.s);x.view.animate(null,x.s,()=>{throw Error('late animate')});assert.equal(paints,0);assert.equal(newImage.refs,0);assert.equal(images[0].refs,0);assert.equal(timers.size,0);assert(valid(x.u.root,true));x.owner.destroy();flush();assert.equal(invalidWrites,0);
});
check('live hide/pause cancel resets selection and ghost, clears pending animation, retains resource refs and raised buttons',()=>{
 const x=setup();arm(x);x.view.animate(null,x.s,()=>{throw Error('stale callback')});const stale=allTimers.at(-1);x.u.host.hide();assert.equal(x.u.armedTool,null);assert.equal(x.u.toolDrag,null);assert.equal(x.u.toolGhost.active,false);assert.equal(timers.size,0);assert.equal(tweens.size,0);assert.equal(x.u.pieceImage.refs,1);for(const c of x.u.cells)assert.equal(c.scale.x,1);stale();x.owner.destroy();flush();assert.equal(invalidWrites,0);
});
check('late atlas callbacks after complete tree destruction allocate nothing and invoke no painting',()=>{
 const x=setup();x.u.loadPieceArt();const late=resourceCalls.at(-1),f=madeFrames.length,t=madeTextures.length;x.owner.destroy();flush();late.fn(null,new ImageAsset());assert.equal(madeFrames.length,f);assert.equal(madeTextures.length,t);assert.equal(invalidWrites,0);
});
check('20 repeated enter/return cycles destroy the entire initialized tree and leave no timers, tweens, listeners or atlas refs',()=>{
 for(let i=0;i<20;i++){const fi=madeFrames.length,ti=madeTextures.length,x=setup({result:i%2===1}),images=[x.u.pieceImage,x.u.toolArt.image],nodes=tree(x.owner);tapNode(i%2===1?x.u.targets.resultBack:x.u.back);flush();ensureReleased(x,nodes,madeFrames.slice(fi),madeTextures.slice(ti),images);}
});
check('resource release still runs if a host dispose independently throws, without repainting or retaining pending timers',()=>{
 const x=setup(),frames=x.u.frames.slice(),texture=x.u.pieceTexture,image=x.u.pieceImage;x.view.animate(null,x.s,()=>{});x.u.host={dispose(){throw Error('injected host failure')}};assert.throws(()=>x.u.onDestroy(),/injected host failure/);assert(frames.every(f=>f.destroyed));assert(texture.destroyed);assert.equal(image.refs,0);assert.equal(timers.size,0);assert.equal(tweens.size,0);x.owner.destroy();flush();assert.equal(invalidWrites,0);
});
const report={status:'PASS',checks:checks.length,results:checks,scope:'Actual full initialized ManagedMobileBoardUI, WarmButton, ManagedToolArt, ResultChestView and production mainline/R4 binder. Cocos child-first destruction + object-field nulling doubles; skin GPU/3D lease have separate actual-resource suites. Not Creator/WeChat execution.'};fs.writeFileSync(path.resolve(__dirname,'../evidence/board-teardown/full-tree-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
