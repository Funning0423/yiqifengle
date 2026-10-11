import {Node,UITransform,Label,Layers,Color,EventTouch,isValid} from 'cc';
import {AudioUnlock} from './audio/AudioUnlock';
type RoomView={enabled:boolean;settling:boolean;door:{visible:boolean;x:number;y:number;direction:number}};
type Commands={roomView:(aspect:number)=>RoomView;lookRoom:(dx:number,dy:number)=>boolean;leaveHome:()=>unknown};
/** Plain scene-linked copy: no Button, panel, extra camera, asset load, timer or global input hook.
 * Audio (GGbot 2026-10-11): this full-screen surface swallows every room touch, so it forwards the gesture to GameAudio itself,
 * synchronously, on touch start/end (room-swipe) and before leaving through the door (door-tap). The global first-touch
 * unlock lives in audio/AudioUnlock.ts (wx/canvas/cocos layers); these calls are the in-handler backup. */
export class RoomExploreOverlay {
 private root:Node;private prompt:Label;private guide:Label;private pointer:number|null=null;private start={x:0,y:0};private last={x:0,y:0};private dragged=false;private blocked=false;private width=1;private height=1;private disposed=false;private rect={x:0,y:0,w:0,h:0};private handle={x:0,y:0,visible:false};
 private leave:()=>void;
 constructor(parent:Node,private commands:()=>Commands|null,private allowed:()=>boolean,leave:()=>void){
  this.leave=()=>{AudioUnlock.gesture('door-tap','leave');leave();};
  this.root=new Node('RoomExploreSurface');this.root.layer=Layers.Enum.UI_2D;parent.addChild(this.root);this.root.addComponent(UITransform);this.root.active=false;
  this.prompt=this.text('DoorHandleInvitation','推开门，开始冒险',17,224);this.guide=this.text('RoomLookGuide','向左轻拖，看看门口  ›',14,260);
  this.root.on(Node.EventType.TOUCH_START,this.down,this);this.root.on(Node.EventType.TOUCH_MOVE,this.move,this);this.root.on(Node.EventType.TOUCH_END,this.up,this);this.root.on(Node.EventType.TOUCH_CANCEL,this.cancel,this);
 }
 private text(name:string,text:string,size:number,width:number){const n=new Node(name);n.layer=Layers.Enum.UI_2D;this.root.addChild(n);n.addComponent(UITransform).setContentSize(width,48);const l=n.addComponent(Label);l.string=text;l.fontSize=size;l.lineHeight=size+5;l.color=new Color('#fff2cf');l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.enableOutline=true;l.outlineColor=new Color(33,45,45,170);l.outlineWidth=1;return l;}
 sync(width:number,height:number){if(this.disposed||!isValid(this.root,true))return;this.width=width;this.height=height;this.root.getComponent(UITransform)!.setContentSize(width,height);
  const c=this.commands(),v=c?.roomView(width/height),enabled=!!v?.enabled&&this.allowed();this.root.active=enabled;
  if(!enabled){this.cancel();return;}
  this.handle={x:v!.door.x*width,y:v!.door.y*height,visible:v!.door.visible};
  this.prompt.node.active=v!.door.visible;this.guide.node.active=!v!.door.visible;
  if(v!.door.visible){const w=Math.min(224,width-32),h=48;this.prompt.node.getComponent(UITransform)!.setContentSize(w,h);const x=Math.max(w/2+16,Math.min(width-w/2-16,this.handle.x)),y=Math.max(84,Math.min(height-100,this.handle.y+42));this.prompt.node.setPosition(x-width/2,y-height/2,0);this.rect={x:x-w/2,y:y-h/2,w,h};}
  else {this.guide.string=v!.door.direction>0?'向左轻拖，看看门口  ›':'‹  向右轻拖，看看门口';this.guide.node.setPosition(0,-height/2+88,0);this.rect={x:0,y:0,w:0,h:0};}
 }
 private down(e:EventTouch){AudioUnlock.gesture(this.onDoor(e)?'door-tap':'room-swipe','touchstart');if(!this.root.active||!this.allowed())return;const id=e.getID();if(id===null)return;if(this.pointer!==null||e.getAllTouches().length>1){this.blocked=true;return;}const p=e.getUILocation();this.pointer=id;this.start={x:p.x,y:p.y};this.last={...this.start};this.dragged=false;}
 private move(e:EventTouch){if(e.getID()!==this.pointer||this.blocked)return;if(!this.allowed()||!this.commands()?.roomView(this.width/this.height).enabled){this.cancel();return;}const p=e.getUILocation();if(Math.hypot(p.x-this.start.x,p.y-this.start.y)>8)this.dragged=true;if(this.dragged)this.commands()?.lookRoom((p.x-this.last.x)/this.width,(p.y-this.last.y)/this.height);this.last={x:p.x,y:p.y};}
 private up(e:EventTouch){AudioUnlock.gesture(this.onDoor(e)?'door-tap':'room-swipe','touchend');if(e.getID()!==this.pointer){if(e.getAllTouches().length===0)this.cancel();return;}const p=e.getUILocation(),r=this.rect;const tap=!this.blocked&&!this.dragged&&Math.hypot(p.x-this.start.x,p.y-this.start.y)<=8&&this.handle.visible&&((p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)||Math.hypot(p.x-this.handle.x,p.y-this.handle.y)<=28);this.cancel();if(tap&&this.allowed()&&this.commands()?.roomView(this.width/this.height).enabled)this.leave();}
 /** Same door-handle hit area as up(): rect or within 28 px of the handle, door on screen. */
 private onDoor(e:EventTouch){try{const p=e.getUILocation(),r=this.rect;return this.handle.visible&&((p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)||Math.hypot(p.x-this.handle.x,p.y-this.handle.y)<=28);}catch{return false;}}
 private cancel(){this.pointer=null;this.dragged=false;this.blocked=false;}
 diagnostics(){return {visible:this.root.active,doorVisible:this.handle.visible,prompt:this.prompt.string,handle:{...this.handle},rect:{...this.rect},dragging:this.dragged,buttonless:true};}
 dispose(){if(this.disposed)return;this.disposed=true;this.cancel();if(isValid(this.root,true)){this.root.off(Node.EventType.TOUCH_START,this.down,this);this.root.off(Node.EventType.TOUCH_MOVE,this.move,this);this.root.off(Node.EventType.TOUCH_END,this.up,this);this.root.off(Node.EventType.TOUCH_CANCEL,this.cancel,this);this.root.destroy();}}
}
