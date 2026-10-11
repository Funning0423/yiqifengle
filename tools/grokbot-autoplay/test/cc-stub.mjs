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
 addComponent(C){const name=C?.name||String(C);let c;if(C===UITransform)c=new UITransform();else if(C===Label)c=new Label();else c=comp();c.node=this;this._c.set(name,c);return c;}
 getComponent(C){return this._c.get(C?.name||String(C))||null;}
 static EventType={TOUCH_START:'touch-start',TOUCH_MOVE:'touch-move',TOUCH_END:'touch-end',TOUCH_CANCEL:'touch-cancel'};}
export class UITransform{constructor(){this.width=0;this.height=0;} setContentSize(w,h){this.width=w;this.height=h;} hitTest(){return false;}}
export class Label{constructor(){this.string='';} static HorizontalAlign={CENTER:1}; static VerticalAlign={CENTER:1}; static Overflow={SHRINK:2};}
export class Graphics{} export class BlockInputEvents{} export class EventTouch{}
export class Vec2{constructor(x=0,y=0){this.x=x;this.y=y;} set(x,y){this.x=x;this.y=y;return this;}}
export class Color{constructor(...a){this.a=a;}}
export const Layers={Enum:{UI_2D:1}};
export const isValid=(n)=>!!n&&n.isValid!==false;
class Emitter{constructor(){this._h={};} on(t,f,target){(this._h[t]||(this._h[t]=[])).push([f,target]);} off(t,f,target){this._h[t]=(this._h[t]||[]).filter(([g,tg])=>!(g===f&&(target===undefined||tg===target)));} emit(t,...a){for(const [f,tg] of [...(this._h[t]||[])])f.apply(tg,a);}}
export class Game{static EVENT_HIDE='game_on_hide';static EVENT_SHOW='game_on_show';}
export const game=Object.assign(new Emitter(),{canvas:null});
export class Input{static EventType={TOUCH_START:'touch-start',TOUCH_MOVE:'touch-move',TOUCH_END:'touch-end',TOUCH_CANCEL:'touch-cancel'};}
export const input=Object.assign(new Emitter(),{_count:0,getTouchCount(){return this._count;}});
export const screen={devicePixelRatio:3,windowSize:{width:390*3,height:844*3}};
const classes={};export const js={getClassByName:(n)=>classes[n]||null,_register:(n,c)=>{classes[n]=c;}};
export class Director{static EVENT_AFTER_UPDATE='director_after_update';constructor(){this._h=[];this.scene=null;this.frames=0;}
 on(t,f){if(t===Director.EVENT_AFTER_UPDATE)this._h.push(f);} off(t,f){this._h=this._h.filter(g=>g!==f);} getScene(){return this.scene;} getTotalFrames(){return this.frames;}
 _frame(){this.frames++;for(const f of [...this._h])f();}}
export const director=new Director();
