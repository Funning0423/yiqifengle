// Minimal 'cc' stand-in for Node tests: enough for RoomExploreOverlay, IslandJourneyOverlay, T1 IslandHomeInteraction and the autoplay glue.
const comp=()=>new Proxy({},{get(t,k){if(k in t)return t[k];if(k==='then')return undefined;return (...a)=>undefined;},set(t,k,v){t[k]=v;return true;}});
export class Node{constructor(name){this.name=name;this.children=[];this.parent=null;this.active=true;this.isValid=true;this._h={};this._c=new Map();this.layer=0;this.pos={x:0,y:0};}
 addChild(c){c.parent=this;this.children.push(c);} removeFromParent(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
 destroy(){this.isValid=false;} setPosition(x,y){this.pos={x:x||0,y:y||0};} setScale(){}
 setSiblingIndex(i){if(!this.parent)return;const c=this.parent.children;c.splice(c.indexOf(this),1);c.splice(Math.max(0,Math.min(i,c.length)),0,this);}
 get activeInHierarchy(){let n=this;while(n){if(!n.active||!n.isValid)return false;n=n.parent;}return true;}
 get worldPosition(){let x=0,y=0,n=this;while(n){x+=n.pos.x;y+=n.pos.y;n=n.parent;}return {x,y,z:0};}
 on(t,f,target){(this._h[t]||(this._h[t]=[])).push([f,target]);} off(t,f){this._h[t]=(this._h[t]||[]).filter(([g])=>g!==f);}
 emit(t,e){for(const [f,target] of [...(this._h[t]||[])])f.call(target,e);}
 addComponent(C){const name=C?.name||String(C);let c;
  if(typeof C==='function'&&C.prototype instanceof Component){c=new C();c.node=this;(this._list||(this._list=[])).push(c);this._c.set(name,c);c.onLoad?.();return c;}if(C===UITransform)c=new UITransform();else if(C===Label)c=new Label();else c=comp();c.node=this;this._c.set(name,c);return c;}
 getComponent(C){if(typeof C==='function'&&this._list){const f=this._list.find(c=>c instanceof C&&c.isValid!==false);if(f)return f;}return this._c.get(C?.name||String(C))||null;}
 getComponentsInChildren(C){const o=[];const w=n=>{for(const c of (n._list||[]))if(c instanceof C)o.push(c);for(const k of n.children)w(k);};w(this);return o;}
 static EventType={TOUCH_START:'touch-start',TOUCH_MOVE:'touch-move',TOUCH_END:'touch-end',TOUCH_CANCEL:'touch-cancel'};}
export class UITransform{constructor(){this.width=0;this.height=0;} setContentSize(w,h){this.width=w;this.height=h;} hitTest(){return false;}
 convertToNodeSpaceAR(w,out){const o=this.node.worldPosition;return out.set(w.x-o.x,w.y-o.y,0);}}
export class Label{constructor(){this.string='';this.fontSize=20;this.lineHeight=28;this.shadowOffset=new Vec2();} static HorizontalAlign={CENTER:1}; static VerticalAlign={CENTER:1}; static Overflow={NONE:0,SHRINK:2};
 updateRenderData(){const t=this.node?.getComponent(UITransform);if(t){t.width=this.string.length*this.fontSize*0.55;t.height=this.lineHeight;}}}
export class Graphics{} export class BlockInputEvents{} export class EventTouch{}
export class Vec2{constructor(x=0,y=0){this.x=x;this.y=y;} set(x,y){this.x=x;this.y=y;return this;}}
export class Color{constructor(...a){this.a=a;}}
export const Layers={Enum:{UI_2D:1}};
export const isValid=(n)=>!!n&&n.isValid!==false;
class Emitter{constructor(){this._h={};} on(t,f,target){(this._h[t]||(this._h[t]=[])).push([f,target]);} off(t,f,target){this._h[t]=(this._h[t]||[]).filter(([g,tg])=>!(g===f&&(target===undefined||tg===target)));} emit(t,...a){for(const [f,tg] of [...(this._h[t]||[])])f.apply(tg,a);}}
export class Game{static EVENT_HIDE='game_on_hide';static EVENT_SHOW='game_on_show';}
export const game=Object.assign(new Emitter(),{canvas:null});
export class Input{static EventType={TOUCH_START:'touch-start',TOUCH_MOVE:'touch-move',TOUCH_END:'touch-end',TOUCH_CANCEL:'touch-cancel',MOUSE_UP:'mouse-up',KEY_DOWN:'key-down'};}
export const input=Object.assign(new Emitter(),{_count:0,getTouchCount(){return this._count;}});
export const screen={devicePixelRatio:3,windowSize:{width:390*3,height:844*3}};
const classes={};export const js={getClassByName:(n)=>classes[n]||null,_register:(n,c)=>{classes[n]=c;}};
export class Director{static EVENT_AFTER_UPDATE='director_after_update';static EVENT_AFTER_SCENE_LAUNCH='director_after_scene_launch';constructor(){this._h=[];this.scene=null;this.frames=0;}
 on(t,f){if(t===Director.EVENT_AFTER_UPDATE)this._h.push(f);} once(t,f){(this._once||(this._once=[])).push([t,f]);} _launch(){const l=this._once||[];this._once=[];for(const [t,f] of l)if(t===Director.EVENT_AFTER_SCENE_LAUNCH)f();} addPersistRootNode(){} off(t,f){this._h=this._h.filter(g=>g!==f);} getScene(){return this.scene;} getTotalFrames(){return this.frames;}
 _frame(){this.frames++;for(const f of [...this._h])f();}}
export const director=new Director();
// ---- combo-mode additions: enough engine for the REAL GameAudio.ts and REAL ui/CheerText.ts (int/v1) ----
export const _decorator={ccclass:(name)=>(cls)=>{classes[name]=cls;return cls;},property:()=>()=>{}};
export class Component{constructor(){this.node=null;this._destroyed=false;this.enabled=true;} get isValid(){return !this._destroyed;} get enabledInHierarchy(){return this.enabled&&!!this.node?.activeInHierarchy;} destroy(){this._destroyed=true;return true;}}
export class Vec3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z||0;return this;}}
export class UIOpacity extends Component{constructor(){super();this.opacity=255;}}
export class AudioClip{constructor(name,duration=1){this.name=name;this.duration=duration;this.refs=0;} addRef(){this.refs++;return this;} decRef(){this.refs--;return this;}}
/** Fake player: playing until clip.duration of (fake performance.now) time has passed; AudioSource.__advance() ends due voices. */
export class AudioSource extends Component{constructor(){super();this.clip=null;this.volume=1;this.loop=false;this.playOnAwake=false;this.playing=false;this.state=0;this.currentTime=0;AudioSource._all.add(this);}
 get duration(){return this.clip?.duration??0;} play(){if(!this.clip)return;this.playing=true;this.state=1;this._t=performance.now();} pause(){this.playing=false;this.state=2;} stop(){this.playing=false;this.state=3;} destroy(){this.playing=false;this.state=3;AudioSource._all.delete(this);return super.destroy();}
 static _all=new Set(); static __advance(){const t=performance.now();for(const s of AudioSource._all)if(s.playing&&!s.loop&&t-s._t>=s.duration*1000){s.playing=false;s.state=3;s.node?.emit?.(AudioSource.EventType.ENDED,s);}}
 static EventType={STARTED:'started',ENDED:'ended'}; static AudioState={INIT:0,PLAYING:1,PAUSED:2,STOPPED:3}; static maxAudioChannel=10;}
export class BitmapFont{constructor(cfg){this.fntConfig=cfg||null;} addRef(){return this;} decRef(){return this;}}
export const resources={loads:[],dirs:[],load(path,type,cb){this.loads.push({path,type,cb});},loadDir(path,type,cb){this.dirs.push({path,type,cb});}};
/** GameAudio v0.4 setMusic(path,bundle): fake asset bundles (loadBundle/getBundle), loads recorded like resources.load. */
export const assetManager={bundles:new Map(),bundleLoads:[],getBundle(n){return this.bundles.get(n)||null;},loadBundle(n,cb){this.bundleLoads.push({name:n,cb});}};
const store=new Map();export const sys={localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{store.set(k,String(v));},removeItem:k=>{store.delete(k);}}};
