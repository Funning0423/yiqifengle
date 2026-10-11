import { _decorator, Component, Node, UITransform, Graphics, Color, EventTouch, game, Game, isValid } from 'cc';
const { ccclass } = _decorator;

/** Painted ceramic/wood buttons. The root hit rectangle and all layout coordinates stay fixed.
 * Only the inset face moves: no scaling, timers, tween races, audio, or gameplay side effects. */
@ccclass('WarmButton')
export class WarmButton extends Component {
  static readonly ACTIVATED = 'warm-button-activated';
  private face:Node|null=null;
  private width=46; private height=46; private ivory=false;
  private pointer:number|null=null; private pressed=false; private bound=false;
  private toolStart:{x:number,y:number}|null=null;private toolMoved=false;
  private action:(()=>unknown)|null=null;
  private content:Array<{node:Node,x:number,y:number,z:number}>=[];
  configure(width:number,height:number,ivory=false){
    this.width=width;this.height=height;this.ivory=ivory;
    if(!this.face){this.face=new Node('WarmButtonFace');this.face.layer=this.node.layer;this.node.addChild(this.face);this.face.addComponent(UITransform).setContentSize(width,height);this.face.addComponent(Graphics);}
    this.paintBase();this.positionFace();
    const g=this.face.getComponent(Graphics)!;g.clear();
    const w=width-4,h=height-9,r=Math.min(14,h/2);
    // Warm rim, dark lower bevel, softly lit ceramic centre and a narrow upper glint.
    this.round(g,-w/2,-h/2,w,h,r,ivory?'#b99353':'#a48b58');
    this.round(g,-w/2+1,-h/2+1,w-2,h-2,r-1,ivory?'#e4d2a6':'#254d47');
    this.round(g,-w/2+2,-h/2+4,w-4,h-5,r-2,ivory?'#f7edcf':'#365b50');
    g.strokeColor=new Color(ivory?'#fffbed':'#96aa86');g.lineWidth=1;
    g.moveTo(-w/2+r,h/2-2);g.lineTo(w/2-r,h/2-2);g.stroke();
    return g;
  }
  private round(g:Graphics,x:number,y:number,w:number,h:number,r:number,color:string){g.fillColor=new Color(color);g.roundRect(x,y,w,h,Math.max(1,r));g.fill();}
  private paintBase(){const g=this.node.getComponent(Graphics)||this.node.addComponent(Graphics);g.clear();const w=this.width,h=this.height,r=Math.min(16,(h-4)/2);
    // All layers fit within the existing hit area; shadows never invade safe-area margins.
    this.round(g,-w/2,-h/2,w,h-4,r,'#27271938');
    this.round(g,-w/2+1,-h/2+2,w-2,h-6,r-1,this.ivory?'#947542':'#665b3d');
    this.round(g,-w/2+2,-h/2+4,w-4,h-7,r-2,this.ivory?'#c1a46c':'#81724d');
  }
  addContent(node:Node){const p=node.position;this.content.push({node,x:p.x,y:p.y,z:p.z});this.positionFace();}
  bind(action:(()=>unknown)|null){this.action=action;if(this.bound)return;this.bound=true;
    this.node.on(Node.EventType.TOUCH_START,this.startPress,this);
    this.node.on(Node.EventType.TOUCH_MOVE,this.movePress,this);
    this.node.on(Node.EventType.TOUCH_END,this.endPress,this);
    this.node.on(Node.EventType.TOUCH_CANCEL,this.cancelPointer,this);
    game.on(Game.EVENT_HIDE,this.cancelPress,this);
  }
  // hitTest expects screen coordinates and performs the UI camera/window conversion.
  private inside(e:EventTouch){return this.node.getComponent(UITransform)!.hitTest(e.getLocation(),e.windowId);}
  private canInteract(){return this.enabledInHierarchy&&isValid(this,true)&&this.node.activeInHierarchy;}
  private startPress(e:EventTouch){if(this.pointer!==null||!this.canInteract()||!this.inside(e))return;this.pointer=e.getID();this.pressed=true;if(this.action===null){const p=e.getUILocation();this.toolStart={x:p.x,y:p.y};this.toolMoved=false;}this.positionFace();}
  private movePress(e:EventTouch){if(this.pointer!==e.getID())return;if(this.toolStart){const p=e.getUILocation();this.toolMoved=this.toolMoved||Math.hypot(p.x-this.toolStart.x,p.y-this.toolStart.y)>=12;}if(!this.inside(e)){this.pressed=false;this.positionFace();}}
  private endPress(e:EventTouch){if(this.pointer===null||this.pointer!==e.getID())return;let fire=this.pressed&&this.canInteract()&&this.inside(e);if(this.toolStart){const p=e.getUILocation();fire=fire&&!this.toolMoved&&Math.hypot(p.x-this.toolStart.x,p.y-this.toolStart.y)<12;}this.cancelPress();if(fire&&this.action?.()!==false)this.node.emit(WarmButton.ACTIVATED,e);}
  private cancelPointer(e:EventTouch){if(this.pointer===e.getID())this.cancelPress();}
  private cancelPress(){this.pointer=null;this.pressed=false;this.toolStart=null;this.toolMoved=false;this.positionFace();}
  private positionFace(){const y=this.pressed?0:2;this.face?.setPosition(0,y,0);for(const c of this.content)if(c.node.isValid)c.node.setPosition(c.x,c.y+y,c.z);}
  onDisable(){this.cancelPress();}
  onDestroy(){
    this.node.off(Node.EventType.TOUCH_START,this.startPress,this);
    this.node.off(Node.EventType.TOUCH_MOVE,this.movePress,this);
    this.node.off(Node.EventType.TOUCH_END,this.endPress,this);
    this.node.off(Node.EventType.TOUCH_CANCEL,this.cancelPointer,this);
    game.off(Game.EVENT_HIDE,this.cancelPress,this);
    this.cancelPress();this.action=null;this.content=[];this.face?.destroy();this.face=null;
  }
}
export function warmButton(node:Node,width:number,height:number,ivory=false){const surface=node.getComponent(WarmButton)||node.addComponent(WarmButton);surface.configure(width,height,ivory);return surface;}
export function warmButtonGraphics(node:Node,width:number,height:number,ivory=false){const surface=node.getComponent(WarmButton)||node.addComponent(WarmButton);return surface.configure(width,height,ivory);}
