// Contract double only. It does not emulate rendering, touch hit testing, Cocos import or device timing.
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}clone(){return new Vec3(this.x,this.y,this.z)}}Vec3.ONE=new Vec3(1,1,1);
class Component{}
class Node{
 static EventType={TOUCH_START:'start',TOUCH_MOVE:'move',TOUCH_END:'end',TOUCH_CANCEL:'cancel'};
 constructor(name){this.name=name;this.children=[];this.components=[];this.events=new Map();this.active=true;this.isValid=true;this.scale=Vec3.ONE;this.position=new Vec3();this.parent=null;}
 addChild(n){n.parent=this;this.children.push(n)}removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
 addComponent(C){const x=new C();x.node=this;this.components.push(x);return x;}getComponent(C){return this.components.find(x=>x instanceof C)||null;}
 getChildByName(n){return this.children.find(x=>x.name===n)||null;}
 setPosition(x,y,z=0){this.position=new Vec3(x,y,z)}setScale(x,y,z){this.scale=x instanceof Vec3?x:new Vec3(x,y,z);}
 on(name,fn,target){if(!this.events.has(name))this.events.set(name,[]);this.events.get(name).push({fn,target});}
 emit(name,event){for(const x of [...this.events.get(name)||[]])x.fn.call(x.target,event);}
 destroy(){if(!this.isValid)return;this.isValid=false;for(const c of this.components)c.onDestroy?.();for(const n of [...this.children])n.destroy();this.events.clear();this.removeFromParent();}
}
class Graphics{constructor(){this.calls=[]}}for(const name of ['clear','roundRect','fill','stroke','moveTo','lineTo','close','circle','rect','bezierCurveTo'])Graphics.prototype[name]=function(...args){this.calls.push([name,...args]);};
class Label{static HorizontalAlign={CENTER:0};static VerticalAlign={CENTER:0};string='';}
class UITransform{setContentSize(w,h){this.width=w;this.height=h}}
class Color{constructor(hex){this.hex=hex}}class Canvas{}class Camera{static ProjectionType={ORTHO:0};static ClearFlag={DEPTH_ONLY:0}}
const events=new Map(),game={on:(n,fn)=>{if(!events.has(n))events.set(n,new Set());events.get(n).add(fn)},off:(n,fn)=>events.get(n)?.delete(fn)};
let next=0;const timers=new Map(),allCallbacks=[];
function setTimeoutDouble(fn){const id=++next;timers.set(id,fn);allCallbacks.push(fn);return id}function clearTimeoutDouble(id){timers.delete(id)}
function tick(){const e=timers.entries().next();if(e.done)return false;const [id,fn]=e.value;timers.delete(id);fn();return true;}
const cc={_decorator:{ccclass:()=>()=>{}},Component,Node,Canvas,Camera,Layers:{Enum:{UI_2D:1<<25}},UITransform,Graphics,Color,Label,Vec3,EventTouch:class{},game,Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},view:{setDesignResolutionSize(){}},ResolutionPolicy:{SHOW_ALL:0},profiler:{hideStats(){}},tween:()=>({to(){return this},start(){return this}}),Tween:{stopAllByTarget(){}}};
module.exports={cc,events,timers,allCallbacks,tick,setTimeoutDouble,clearTimeoutDouble};
