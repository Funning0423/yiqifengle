import { _decorator, Component, Node, UITransform, Graphics, Color, EventTouch, game, Game, isValid } from 'cc';
import { WarmButtonSkin } from './ui/WarmButtonSkin';
import { GameAudio } from './audio/GameAudio';
const { ccclass } = _decorator;

/** Lit bevelled ceramic/wood buttons. The root hit rectangle and all layout coordinates stay fixed.
 * Only the inset face moves: no scaling, timers, or tween races. Valid input unlocks audio before its action. */
@ccclass('WarmButton')
export class WarmButton extends Component {
  static readonly ACTIVATED = 'warm-button-activated';
  private face:Node|null=null;
  private skin:WarmButtonSkin|null=null;
  private disposing=false;
  private width=46; private height=46; private ivory=false;
  private pointer:number|null=null; private pressed=false; private bound=false;
  private toolStart:{x:number,y:number}|null=null;private toolMoved=false;
  private action:(()=>unknown)|null=null;
  private content:Array<{node:Node,x:number,y:number,z:number}>=[];
  configure(width:number,height:number,ivory=false){
    this.width=width;this.height=height;this.ivory=ivory;
    if(!this.face){this.face=new Node('WarmButtonFace');this.face.layer=this.node.layer;this.node.addChild(this.face);this.face.addComponent(UITransform).setContentSize(width,height);this.face.addComponent(Graphics);}
    else this.face.getComponent(UITransform)?.setContentSize(width,height); // b16 复核3 ④：重配尺寸时底板跟着变（原来只在创建时设 240，木牌模式下点击包围盒仍 240 宽、越出屏幕）
    const g=this.face.getComponent(Graphics)!;g.clear();
    this.paintBase();
    if(!this.skin)this.skin=new WarmButtonSkin(this.node);
    this.skin.configure(width,height,ivory,()=>{if(isValid(this,true)&&isValid(this.node,true))this.node.getComponent(Graphics)?.clear();});
    this.positionFace();
    return g; // Caller-owned icons stay crisp UI geometry, separate from the 3D surface.
  }
  private paintBase(){
    const g=this.node.getComponent(Graphics)||this.node.addComponent(Graphics);g.clear();
    // A sculpted loading surface remains legible while the shared mesh bake is pending.
    // The successful bake clears it; input geometry and 2px cap travel stay unchanged.
    const w=this.width,h=this.height,r=Math.min(13,(h-4)/2);
    g.fillColor=new Color('#24443c55');g.roundRect(-w/2+1,-h/2+1,w-2,h-3,r);g.fill();
    g.fillColor=new Color('#775936');g.roundRect(-w/2+2,-h/2+2,w-4,h-4,r);g.fill();
    g.fillColor=new Color('#c9a666');g.roundRect(-w/2+3,-h/2+5,w-6,h-7,r-1);g.fill();
    g.fillColor=new Color(this.ivory?'#fff0cb':'#377f6c');g.roundRect(-w/2+4,-h/2+8,w-8,h-11,r-2);g.fill();
    g.strokeColor=new Color(this.ivory?'#fff9e2':'#84bda2');g.lineWidth=1;g.roundRect(-w/2+5,-h/2+9,w-10,h-13,r-3);g.stroke();
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
  private endPress(e:EventTouch){if(this.pointer===null||this.pointer!==e.getID())return;let fire=this.pressed&&this.canInteract()&&this.inside(e);if(this.toolStart){const p=e.getUILocation();fire=fire&&!this.toolMoved&&Math.hypot(p.x-this.toolStart.x,p.y-this.toolStart.y)<12;}this.cancelPress();if(fire){GameAudio.notifyUserGesture();if(this.action?.()!==false)this.node.emit(WarmButton.ACTIVATED,e);}}
  private cancelPointer(e:EventTouch){if(this.pointer===e.getID())this.cancelPress();}
  private resetPressState(){this.pointer=null;this.pressed=false;this.toolStart=null;this.toolMoved=false;}
  private cancelPress(){this.resetPressState();this.positionFace();}
  private positionFace(){
    if(this.disposing||!isValid(this,true)||!isValid(this.node,true))return;
    this.skin?.setPressed(this.pressed);const y=this.pressed?0:2;
    if(isValid(this.face,true))this.face.setPosition(0,y,0);
    for(const c of this.content)if(isValid(c.node,true))c.node.setPosition(c.x,c.y+y,c.z);
  }
  onDisable(){this.cancelPress();}
  onDestroy(){
    if(this.disposing)return;this.disposing=true;
    // Cocos destroys child nodes before this component. Cancellation here must not repaint them.
    this.resetPressState();
    this.node.off(Node.EventType.TOUCH_START,this.startPress,this);
    this.node.off(Node.EventType.TOUCH_MOVE,this.movePress,this);
    this.node.off(Node.EventType.TOUCH_END,this.endPress,this);
    this.node.off(Node.EventType.TOUCH_CANCEL,this.cancelPointer,this);
    game.off(Game.EVENT_HIDE,this.cancelPress,this);
    this.skin?.destroy();this.skin=null;this.action=null;this.content=[];if(isValid(this.face,true))this.face.destroy();this.face=null;
  }
}
export function warmButton(node:Node,width:number,height:number,ivory=false){const surface=node.getComponent(WarmButton)||node.addComponent(WarmButton);surface.configure(width,height,ivory);return surface;}
export function warmButtonGraphics(node:Node,width:number,height:number,ivory=false){const surface=node.getComponent(WarmButton)||node.addComponent(WarmButton);return surface.configure(width,height,ivory);}
