import {Node,UITransform,Layers,Vec2,EventTouch,game,Game,isValid,input,Input} from 'cc';
import {GameAudio} from '../audio/GameAudio';
// T1 PROTOTYPE (GGbot, 2026-10-11) — 方案草稿，未安装、未原生验证。基于冻结候选 8e9f4156…，只改多指判定。
type Options={canUse:()=>boolean;hit:(screenX:number,screenY:number)=>boolean;returnHome:()=>unknown};
type RawTouch={identifier:number};type RawTouchEvent={touches?:RawTouch[];changedTouches?:RawTouch[]};
/** Actual scene hit only; no visible button or persistent floating label. UI siblings stay above this surface. */
export class IslandHomeInteraction {
 private root:Node;private transform:UITransform;private pointer:number|null=null;private start=new Vec2();private point=new Vec2();private screen=new Vec2();private moved=false;private blocked=false;private hitStart=false;private pending=false;private dead=false;private width=1;private height=1;
 /** L3: 平台层原始触点监听（微信小游戏）。在 Cocos UI 认领之前/之外看到每一根手指。 */
 private rawStart:((e:RawTouchEvent)=>void)|null=null;
 constructor(parent:Node,private options:Options){this.root=new Node('IslandLighthouseTouch');this.root.layer=Layers.Enum.UI_2D;parent.addChild(this.root);this.root.setSiblingIndex(0);this.transform=this.root.addComponent(UITransform);this.root.active=false;this.root.on(Node.EventType.TOUCH_START,this.down,this);this.root.on(Node.EventType.TOUCH_MOVE,this.move,this);this.root.on(Node.EventType.TOUCH_END,this.up,this);this.root.on(Node.EventType.TOUCH_CANCEL,this.cancel,this);game.on(Game.EVENT_HIDE,this.cancel,this);input.on(Input.EventType.TOUCH_START,this.observeTouch,this);
  const wx=(globalThis as any).wx;if(wx&&typeof wx.onTouchStart==='function'&&typeof wx.offTouchStart==='function'){this.rawStart=e=>this.observeRaw(e);try{wx.onTouchStart(this.rawStart);}catch{this.rawStart=null;}}}
 sync(width:number,height:number,enabled:boolean){if(this.dead)return;if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0){this.root.active=false;this.cancel();return;}if(width!==this.width||height!==this.height){this.cancel();this.width=width;this.height=height;this.transform.setContentSize(width,height);}this.root.active=enabled;if(!this.root.active){this.cancel();return;}this.pollTouchCount();}
 private allowed(){return !this.dead&&this.root.active&&!this.pending&&this.options.canUse();}
 /** L2: 引擎 touchManager 在任何派发之前更新；每帧及每个本节点事件都检查，UI 认领不影响计数。 */
 private pollTouchCount(){if(this.pointer!==null&&input.getTouchCount()>1)this.blocked=true;}
 /** 除本指外是否还有其他触点（兼容“END 时 allTouches 含/不含本指”两种语义）。 */
 private othersDown(e:EventTouch){return e.getAllTouches().some(t=>t.getID()!==this.pointer);}
 private safe(p:Vec2){if(p.x<0||p.y<0||p.x>this.width||p.y>this.height)return false;const wx=(globalThis as any).wx;if(!wx)return true;try{const info=wx.getWindowInfo?.()??wx.getSystemInfoSync?.();const w=info?.windowWidth,h=info?.windowHeight;if(!(Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0))return true;const x=p.x/this.width*w,y=(1-p.y/this.height)*h,a=info.safeArea;if(a&&[a.left,a.right,a.top,a.bottom].every(Number.isFinite)&&(x<a.left||x>a.right||y<a.top||y>a.bottom))return false;const r=wx.getMenuButtonBoundingClientRect?.();if(r&&[r.left,r.right,r.top,r.bottom].every(Number.isFinite)&&r.right>r.left&&r.bottom>r.top){const pad=4,left=r.left-(r.bottom-r.top)-12;if(x>=left-pad&&x<=r.right+pad&&y>=r.top-pad&&y<=r.bottom+pad)return false;}}catch{}return true;}
 private observeTouch(e:EventTouch){if(this.pointer!==null&&(e.getID()!==this.pointer||this.othersDown(e)))this.blocked=true;}
 private observeRaw(e:RawTouchEvent){if(this.pointer===null)return;const all=[...(e?.touches??[]),...(e?.changedTouches??[])];if(all.some(t=>t&&t.identifier!==this.pointer))this.blocked=true;}
 private down(e:EventTouch){if(!this.allowed())return;if(this.pointer!==null||e.getAllTouches().length>1||input.getTouchCount()>1){this.blocked=true;return;}const id=e.getID();if(id===null)return;const p=e.getUILocation(this.point);this.pointer=id;this.start.set(p.x,p.y);this.moved=false;this.blocked=false;const s=e.getLocation(this.screen);this.hitStart=this.safe(p)&&this.options.hit(s.x,s.y);}
 private move(e:EventTouch){if(e.getID()!==this.pointer)return;if(this.othersDown(e))this.blocked=true;this.pollTouchCount();if(!this.allowed()){this.cancel();return;}const p=e.getUILocation(this.point);if(Math.hypot(p.x-this.start.x,p.y-this.start.y)>8)this.moved=true;}
 private up(e:EventTouch){if(e.getID()!==this.pointer){if(e.getAllTouches().length===0)this.cancel();return;}
  // L1: 抬起时除本指外不得有任何仍按住的触点（原候选为 getAllTouches().length<=1，第二指被 UI 认领时放行）。
  const others=this.othersDown(e)||input.getTouchCount()>(e.getAllTouches().some(t=>t.getID()===this.pointer)?1:0);
  const p=e.getUILocation(this.point),s=e.getLocation(this.screen);const fire=this.allowed()&&!this.blocked&&!others&&!this.moved&&this.hitStart&&Math.hypot(p.x-this.start.x,p.y-this.start.y)<=8&&this.safe(p)&&this.options.hit(s.x,s.y);this.cancel();if(!fire)return;this.pending=true;try{GameAudio.notifyUserGesture();Promise.resolve(this.options.returnHome()).then(()=>{this.pending=false;},()=>{this.pending=false;});}catch(error){this.pending=false;throw error;}}
 private cancel(){this.pointer=null;this.moved=false;this.blocked=false;this.hitStart=false;}
 dispose(){if(this.dead)return;this.dead=true;this.cancel();game.off(Game.EVENT_HIDE,this.cancel,this);input.off(Input.EventType.TOUCH_START,this.observeTouch,this);const wx=(globalThis as any).wx;if(this.rawStart&&wx&&typeof wx.offTouchStart==='function'){try{wx.offTouchStart(this.rawStart);}catch{}}this.rawStart=null;if(isValid(this.root,true)){this.root.off(Node.EventType.TOUCH_START,this.down,this);this.root.off(Node.EventType.TOUCH_MOVE,this.move,this);this.root.off(Node.EventType.TOUCH_END,this.up,this);this.root.off(Node.EventType.TOUCH_CANCEL,this.cancel,this);this.root.destroy();}}
}
