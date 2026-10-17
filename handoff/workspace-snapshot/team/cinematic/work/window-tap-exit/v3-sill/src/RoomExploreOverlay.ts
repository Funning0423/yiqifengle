import {Node,UITransform,Label,Layers,Color,EventTouch,isValid,Graphics,UIOpacity} from 'cc';
import {AudioUnlock} from './audio/AudioUnlock';
type RoomView={enabled:boolean;settling:boolean;door:{visible:boolean;x:number;y:number;direction:number};window?:{visible:boolean;x:number;y:number;glass:{x0:number;y0:number;x1:number;y1:number}}};
/** Window-tap exit (Funning 2026-10-15, prototype for review). Caption candidates; pick one, the others are for the A/B video only. */
/** Caption config. Funning 2026-10-15: fixed to 「出发去看海」 (index 0); the list stays configurable. */
export const WINDOW_CAPTIONS=Object.freeze(['出发去看海']);
export const WINDOW_GUIDE_UI=Object.freeze({caption:0,icon:12,iconSize:14,textSize:13,padX:10,tipH:26,gap:8,hitMin:44,period:1.6,minScale:.9,maxScale:1.1,minOpacity:.6,margin:16,safeTop:64,safeBottom:96});
type Commands={roomView:(aspect:number)=>RoomView;lookRoom:(dx:number,dy:number)=>boolean;leaveHome:()=>unknown};
/** Plain scene-linked copy: no Button, panel, extra camera, asset load, timer or global input hook.
 * Audio (GGbot 2026-10-11): this full-screen surface swallows every room touch, so it forwards the gesture to GameAudio itself,
 * synchronously, on touch start/end (room-swipe) and before leaving through the door (door-tap). The global first-touch
 * unlock lives in audio/AudioUnlock.ts (wx/canvas/cocos layers); these calls are the in-handler backup. */
export class RoomExploreOverlay {
 private root:Node;private prompt:Label;private guide:Label;private pointer:number|null=null;private start={x:0,y:0};private last={x:0,y:0};private dragged=false;private blocked=false;private width=1;private height=1;private disposed=false;private rect={x:0,y:0,w:0,h:0};private handle={x:0,y:0,visible:false};private win={x:0,y:0,visible:false};private winHit={x:0,y:0,w:0,h:0};private glassHit={x:0,y:0,w:0,h:0};private winNode!:Node;private winRing!:Node;private winBg!:Graphics;private winW=0;private winOpacity!:UIOpacity;private winCaption!:Label;private t0=Date.now();
 private leave:()=>void;
 constructor(parent:Node,private commands:()=>Commands|null,private allowed:()=>boolean,leave:()=>void){
  this.leave=()=>{AudioUnlock.gesture('door-tap','leave');leave();};
  this.root=new Node('RoomExploreSurface');this.root.layer=Layers.Enum.UI_2D;parent.addChild(this.root);this.root.addComponent(UITransform);this.root.active=false;
  this.prompt=this.text('DoorHandleInvitation','推开门，开始冒险',17,224);this.guide=this.text('RoomLookGuide','向左轻拖，看看门口  ›',14,260);
  this.buildWindowGuide();
  this.root.on(Node.EventType.TOUCH_START,this.down,this);this.root.on(Node.EventType.TOUCH_MOVE,this.move,this);this.root.on(Node.EventType.TOUCH_END,this.up,this);this.root.on(Node.EventType.TOUCH_CANCEL,this.cancel,this);
 }
 private text(name:string,text:string,size:number,width:number){const n=new Node(name);n.layer=Layers.Enum.UI_2D;this.root.addChild(n);n.addComponent(UITransform).setContentSize(width,48);const l=n.addComponent(Label);l.string=text;l.fontSize=size;l.lineHeight=size+5;l.color=new Color('#fff2cf');l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.enableOutline=true;l.outlineColor=new Color(33,45,45,170);l.outlineWidth=1;return l;}
 /** v3 sill tip: small breathing ring+leaf icon and a short caption on a semi-transparent pill, under the glass. Pure nodes, no asset load;
  * breathing is driven by sync() (called every frame). */
 private buildWindowGuide(){const u=WINDOW_GUIDE_UI;this.winNode=new Node('WindowTapGuide');this.winNode.layer=Layers.Enum.UI_2D;this.root.addChild(this.winNode);this.winNode.addComponent(UITransform).setContentSize(160,u.tipH);
  this.winBg=this.winNode.addComponent(Graphics);
  this.winRing=new Node('WindowTapRing');this.winRing.layer=Layers.Enum.UI_2D;this.winNode.addChild(this.winRing);this.winRing.addComponent(UITransform).setContentSize(u.icon*2+6,u.icon*2+6);const g=this.winRing.addComponent(Graphics);this.winOpacity=this.winRing.addComponent(UIOpacity); // only the icon breathes; pill + text stay readable
  g.lineWidth=2;g.strokeColor=new Color(255,242,207,240);g.fillColor=new Color(255,236,180,60);g.circle(0,0,u.icon);g.fill();g.stroke();
  const icon=new Node('WindowTapIcon');icon.layer=Layers.Enum.UI_2D;this.winRing.addChild(icon);icon.addComponent(UITransform).setContentSize(u.icon*2,u.icon*2);const il=icon.addComponent(Label);il.string='🍃';il.fontSize=u.iconSize;il.lineHeight=u.iconSize+2;il.horizontalAlign=Label.HorizontalAlign.CENTER;il.verticalAlign=Label.VerticalAlign.CENTER;
  this.winCaption=this.text('WindowTapCaption',WINDOW_CAPTIONS[u.caption]??WINDOW_CAPTIONS[0],u.textSize,120);this.winCaption.node.removeFromParent();this.winNode.addChild(this.winCaption.node);this.winCaption.overflow=Label.Overflow.NONE;
  this.layoutTip();this.winNode.active=false;}
 /** Pill = padX + icon + 6 + text + padX; text width estimated from the CJK glyph count (no measure API needed). */
 private layoutTip(){const u=WINDOW_GUIDE_UI,tw=Math.ceil(this.winCaption.string.length*u.textSize*1.02),w=u.padX+u.icon*2+6+tw+u.padX;this.winW=w;
  this.winNode.getComponent(UITransform)!.setContentSize(w,u.tipH);this.winRing.setPosition(-w/2+u.padX+u.icon,0,0);
  this.winCaption.node.getComponent(UITransform)!.setContentSize(tw+4,u.tipH);this.winCaption.node.setPosition(-w/2+u.padX+u.icon*2+6+tw/2,0,0);
  const b=this.winBg;b.clear();b.fillColor=new Color(20,32,32,120);b.roundRect(-w/2,-u.tipH/2,w,u.tipH,u.tipH/2);b.fill();}
 /** Set the caption (index into WINDOW_CAPTIONS) for review builds. */
 setWindowCaption(i:number){if(WINDOW_CAPTIONS[i]){this.winCaption.string=WINDOW_CAPTIONS[i];this.layoutTip();}}
 private paintWindowGuide(v:RoomView,width:number,height:number){const u=WINDOW_GUIDE_UI,w=v.window;const show=!!w&&w.visible&&!v.door.visible&&!this.dragged&&!v.settling;this.winNode.active=show;
  if(!show){this.win={x:0,y:0,visible:false};this.winHit={x:0,y:0,w:0,h:0};this.glassHit={x:0,y:0,w:0,h:0};return;}
  const gl=w!.glass,gx0=gl.x0*width,gx1=gl.x1*width,gy0=gl.y0*height,gy1=gl.y1*height; // UI space, y up: gy0 = glass bottom edge
  const tw=this.winW,x=Math.max(tw/2+u.margin,Math.min(width-tw/2-u.margin,w!.x*width));
  // Tip top sits u.gap below the glass bottom edge (never over the glass); clamp only against the bottom safe margin.
  const y=Math.max(u.safeBottom+u.tipH/2,gy0-u.gap-u.tipH/2);
  this.winNode.setPosition(x-width/2,y-height/2,0);this.win={x,y,visible:true};
  const hw=Math.max(tw,u.hitMin),hh=Math.max(u.tipH,u.hitMin);this.winHit={x:x-hw/2,y:y-hh/2,w:hw,h:hh};
  this.glassHit={x:gx0,y:gy0,w:gx1-gx0,h:gy1-gy0};
  const ph=((Date.now()-this.t0)/1000%u.period)/u.period,e=.5-.5*Math.cos(ph*2*Math.PI); // ease-in-out 0..1..0 over one period
  const sc=u.minScale+(u.maxScale-u.minScale)*e;this.winRing.setScale(sc,sc,1);this.winOpacity.opacity=Math.round(255*(u.minOpacity+(1-u.minOpacity)*e));}
 /** Tap target: the tip (>= 44x44) or the whole projected glass quad. */
 private onWindow(p:{x:number,y:number}){if(!this.win.visible)return false;const inside=(r:{x:number,y:number,w:number,h:number})=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;return inside(this.winHit)||inside(this.glassHit);}
 sync(width:number,height:number){if(this.disposed||!isValid(this.root,true))return;this.width=width;this.height=height;this.root.getComponent(UITransform)!.setContentSize(width,height);
  const c=this.commands(),v=c?.roomView(width/height),enabled=!!v?.enabled&&this.allowed();this.root.active=enabled;
  if(!enabled){this.cancel();return;}
  this.handle={x:v!.door.x*width,y:v!.door.y*height,visible:v!.door.visible};
  this.prompt.node.active=v!.door.visible;this.guide.node.active=!v!.door.visible;
  this.paintWindowGuide(v!,width,height);if(this.win.visible)this.guide.node.active=false;
  if(v!.door.visible){const w=Math.min(224,width-32),h=48;this.prompt.node.getComponent(UITransform)!.setContentSize(w,h);const x=Math.max(w/2+16,Math.min(width-w/2-16,this.handle.x)),y=Math.max(84,Math.min(height-100,this.handle.y+42));this.prompt.node.setPosition(x-width/2,y-height/2,0);this.rect={x:x-w/2,y:y-h/2,w,h};}
  else {this.guide.string=v!.door.direction>0?'向左轻拖，看看门口  ›':'‹  向右轻拖，看看门口';this.guide.node.setPosition(0,-height/2+88,0);this.rect={x:0,y:0,w:0,h:0};}
 }
 private down(e:EventTouch){AudioUnlock.gesture(this.onDoor(e)||this.onWindowEvent(e)?'door-tap':'room-swipe','touchstart');if(!this.root.active||!this.allowed())return;const id=e.getID();if(id===null)return;if(this.pointer!==null||e.getAllTouches().length>1){this.blocked=true;return;}const p=e.getUILocation();this.pointer=id;this.start={x:p.x,y:p.y};this.last={...this.start};this.dragged=false;}
 private move(e:EventTouch){if(e.getID()!==this.pointer||this.blocked)return;if(!this.allowed()||!this.commands()?.roomView(this.width/this.height).enabled){this.cancel();return;}const p=e.getUILocation();if(Math.hypot(p.x-this.start.x,p.y-this.start.y)>8)this.dragged=true;if(this.dragged)this.commands()?.lookRoom((p.x-this.last.x)/this.width,(p.y-this.last.y)/this.height);this.last={x:p.x,y:p.y};}
 private up(e:EventTouch){AudioUnlock.gesture(this.onDoor(e)||this.onWindowEvent(e)?'door-tap':'room-swipe','touchend');if(e.getID()!==this.pointer){if(e.getAllTouches().length===0)this.cancel();return;}const p=e.getUILocation(),r=this.rect;const still=!this.blocked&&!this.dragged&&Math.hypot(p.x-this.start.x,p.y-this.start.y)<=8,winTap=still&&this.onWindow(p);const tap=winTap||still&&this.handle.visible&&((p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)||Math.hypot(p.x-this.handle.x,p.y-this.handle.y)<=28);this.cancel();if(tap&&this.allowed()&&this.commands()?.roomView(this.width/this.height).enabled)this.leave();}
 /** Same door-handle hit area as up(): rect or within 28 px of the handle, door on screen. */
 private onDoor(e:EventTouch){try{const p=e.getUILocation(),r=this.rect;return this.handle.visible&&((p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)||Math.hypot(p.x-this.handle.x,p.y-this.handle.y)<=28);}catch{return false;}}
 private onWindowEvent(e:EventTouch){try{return this.onWindow(e.getUILocation());}catch{return false;}}
 private cancel(){this.pointer=null;this.dragged=false;this.blocked=false;}
 diagnostics(){return {visible:this.root.active,doorVisible:this.handle.visible,windowGuide:{...this.win,tipHit:{...this.winHit},glassHit:{...this.glassHit},caption:this.winCaption.string},prompt:this.prompt.string,handle:{...this.handle},rect:{...this.rect},dragging:this.dragged,buttonless:true};}
 dispose(){if(this.disposed)return;this.disposed=true;this.cancel();if(isValid(this.root,true)){this.root.off(Node.EventType.TOUCH_START,this.down,this);this.root.off(Node.EventType.TOUCH_MOVE,this.move,this);this.root.off(Node.EventType.TOUCH_END,this.up,this);this.root.off(Node.EventType.TOUCH_CANCEL,this.cancel,this);this.root.destroy();}}
}
