import { _decorator, Component, Node, UITransform, Graphics, Color, EventTouch, game, Game, isValid } from 'cc';
import { WarmButtonSkin } from './ui/WarmButtonSkin';
const { ccclass } = _decorator;

/** Lit bevelled ceramic/wood buttons. The root hit rectangle and all layout coordinates stay fixed.
 * Only the inset face moves: no scaling, timers, tween races, audio, or gameplay side effects. */
@ccclass('WarmButton')
export class WarmButton extends Component {
  static readonly ACTIVATED = 'warm-button-activated';
  private face:Node|null=null;
  private skin:WarmButtonSkin|null=null;
  private width=46; private height=46; private ivory=false;
  private pointer:number|null=null; private pressed=false; private bound=false;
  private toolStart:{x:number,y:number}|null=null;private toolMoved=false;
  private action:(()=>unknown)|null=null;
  private content:Array<{node:Node,x:number,y:number,z:number}>=[];
  configure(width:number,height:number,ivory=false){
    this.width=width;this.height=height;this.ivory=ivory;
    if(!this.face){this.face=new Node('WarmButtonFace');this.face.layer=this.node.layer;this.node.addChild(this.face);this.face.addComponent(UITransform).setContentSize(width,height);this.face.addComponent(Graphics);}
    const g=this.face.getComponent(Graphics)!;g.clear();
    this.paintBase();
    if(!this.skin)this.skin=new WarmButtonSkin(this.node);
    this.skin.configure(width,height,ivory,()=>{if(isValid(this,true)&&isValid(this.node,true))this.node.getComponent(Graphics)?.clear();});
    this.positionFace();
    return g; // Caller-owned icons stay crisp UI geometry, separate from the 3D surface.
  }
  private paintBase(){
    const g=this.node.getComponent(Graphics)||this.node.addComponent(Graphics);g.clear();
    // Emergency/loading silhouette only. It is cleared after the genuine 3D bake succeeds.
    g.fillColor=new Color(this.ivory?'#eee2c5':'#315b4d');
    g.roundRect(-this.width/2+2,-this.height/2+2,this.width-4,this.height-4,Math.min(13,(this.height-4)/2));g.fill();
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
  private positionFace(){this.skin?.setPressed(this.pressed);const y=this.pressed?0:2;this.face?.setPosition(0,y,0);for(const c of this.content)if(c.node.isValid)c.node.setPosition(c.x,c.y+y,c.z);}
  onDisable(){this.cancelPress();}
  onDestroy(){
    this.node.off(Node.EventType.TOUCH_START,this.startPress,this);
    this.node.off(Node.EventType.TOUCH_MOVE,this.movePress,this);
    this.node.off(Node.EventType.TOUCH_END,this.endPress,this);
    this.node.off(Node.EventType.TOUCH_CANCEL,this.cancelPointer,this);
    game.off(Game.EVENT_HIDE,this.cancelPress,this);
    this.skin?.destroy();this.skin=null;this.cancelPress();this.action=null;this.content=[];this.face?.destroy();this.face=null;
  }
}
export function warmButton(node:Node,width:number,height:number,ivory=false){const surface=node.getComponent(WarmButton)||node.addComponent(WarmButton);surface.configure(width,height,ivory);return surface;}
export function warmButtonGraphics(node:Node,width:number,height:number,ivory=false){const surface=node.getComponent(WarmButton)||node.addComponent(WarmButton);return surface.configure(width,height,ivory);}
