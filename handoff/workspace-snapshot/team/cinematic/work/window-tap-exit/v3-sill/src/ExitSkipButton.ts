import {Node,UITransform,Label,Layers,Color,Graphics,isValid} from 'cc';
/** 「跳过」 for the exit cutscene (运镜bot 2026-10-15, prototype for Funning review).
 * Top-right, inside the portrait safe area (16 px side, 64 px top, same numbers as the window guide), 88x44 px hit box (>= 44 pt).
 * Shown only while WorldFlowCore.leavingHome; a tap calls skipLeave(), which lands on the same end state as watching it through. */
type Commands={leavingHome?:()=>boolean;skipLeave?:()=>{ok:boolean;reason?:string}};
export const EXIT_SKIP_UI=Object.freeze({w:88,h:44,side:16,top:64,text:'跳过',textSize:15});
export class ExitSkipButton {
 private root:Node;private disposed=false;
 constructor(parent:Node,private commands:()=>Commands|null){
  const u=EXIT_SKIP_UI;this.root=new Node('ExitSkipButton');this.root.layer=Layers.Enum.UI_2D;parent.addChild(this.root);this.root.addComponent(UITransform).setContentSize(u.w,u.h);
  const g=this.root.addComponent(Graphics);g.fillColor=new Color(20,32,32,150);g.roundRect(-u.w/2,-u.h/2,u.w,u.h,u.h/2);g.fill();g.lineWidth=1.5;g.strokeColor=new Color(255,242,207,200);g.roundRect(-u.w/2,-u.h/2,u.w,u.h,u.h/2);g.stroke();
  const t=new Node('ExitSkipLabel');t.layer=Layers.Enum.UI_2D;this.root.addChild(t);t.addComponent(UITransform).setContentSize(u.w,u.h);const l=t.addComponent(Label);l.string=u.text+'  ›';l.fontSize=u.textSize;l.lineHeight=u.textSize+4;l.color=new Color('#fff2cf');l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;
  this.root.on(Node.EventType.TOUCH_END,this.tap,this);this.root.active=false;
 }
 sync(width:number,height:number){if(this.disposed||!isValid(this.root,true))return;const u=EXIT_SKIP_UI,show=!!this.commands()?.leavingHome?.();this.root.active=show;if(!show)return;
  this.root.setPosition(width/2-u.side-u.w/2,height/2-u.top-u.h/2,0);}
 private tap(){const r=this.commands()?.skipLeave?.();if(r&&!r.ok)console.warn('[exit-skip]',r.reason);}
 diagnostics(){return {visible:this.root.active,position:this.root.position.clone(),size:{w:EXIT_SKIP_UI.w,h:EXIT_SKIP_UI.h}};}
 dispose(){if(this.disposed)return;this.disposed=true;if(isValid(this.root,true)){this.root.off(Node.EventType.TOUCH_END,this.tap,this);this.root.destroy();}}
}
