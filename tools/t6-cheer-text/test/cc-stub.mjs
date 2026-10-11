export const _decorator={ccclass:()=>c=>c};
export class Vec3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}
export class Color{constructor(h){this.h=h;}}
export const Layers={Enum:{UI_2D:1}};
export class Component{constructor(){this.node=null;}}
export class Node{constructor(n){this.name=n;this.children=[];this.parent=null;this.comps=[];this.active=true;this.pos=new Vec3();this.scale=new Vec3(1,1,1);this.worldPosition=new Vec3();this._valid=true;}
 addChild(c){c.parent=this;this.children.push(c);} setSiblingIndex(i){const a=this.parent.children;a.splice(a.indexOf(this),1);a.splice(i,0,this);}
 addComponent(C){const c=new C();c.node=this;this.comps.push(c);c.onLoad?.();return c;} getComponent(C){return this.comps.find(c=>c instanceof C)||null;}
 setPosition(x,y,z){this.pos.set(x,y,z);} setScale(x,y,z){this.scale.set(x,y,z);} destroy(){this._valid=false;}
 getComponentsInChildren(C){const o=[];const w=n=>{for(const c of n.comps)if(c instanceof C)o.push(c);n.children.forEach(w);};w(this);return o;}}
export class UITransform extends Component{constructor(){super();this.width=0;this.height=0;}convertToNodeSpaceAR(w,out){return out.set(w.x-this.node.worldPosition.x,w.y-this.node.worldPosition.y,0);}}
export class UIOpacity extends Component{constructor(){super();this.opacity=255;}}
export class Label extends Component{constructor(){super();this.shadowOffset=new Vec3();this.string='';}updateRenderData(){const t=this.node.getComponent(UITransform);t.width=this.string.length*this.fontSize*0.55;t.height=this.lineHeight;}}
Label.HorizontalAlign={CENTER:1};Label.VerticalAlign={CENTER:1};Label.Overflow={NONE:0};
export function isValid(o){return !!o&&(o._valid!==false)&&(!o.node||o.node._valid!==false);}
let scene=null;export const director={getScene:()=>scene,once(){},__setScene(s){scene=s;}};export const Director={EVENT_AFTER_SCENE_LAUNCH:'l'};
