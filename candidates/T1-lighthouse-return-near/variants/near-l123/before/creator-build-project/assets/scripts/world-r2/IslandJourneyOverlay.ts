import { Node, UITransform, Graphics, Color, Label, Layers, BlockInputEvents, EventTouch, isValid } from 'cc';
import { warmButton } from '../WarmButton';
import { applyJourneyNavigationSkin, type JourneyNavigationRole } from '../ui/JourneyNavigationSkin';

type Options={invoke:(fn:()=>any)=>void;mainlineStatus:()=>any;gates:()=>any;enterRegion:(id:string)=>any;enterR4:()=>any;enterSkycity:()=>any;returnHome:()=>any;toggleDayNight:()=>any;dayNight:()=>any};
type Page='bag'|'journal'|'settings'|'tide'|'meadow'|'sky';
const CHAPTERS=[{id:'tide',name:'潮汐小径',description:'听潮声，寻找贝壳里的珍珠。'},{id:'meadow',name:'花粉草甸',description:'循着花粉与风，走进草甸。'},{id:'sky',name:'天空回声',description:'连起光的回声，探索云上的远方。'}];
/** Island presentation only. Closed: three compact utilities. Regions are chapters in a
 * journal, never a second wall of island buttons. Providers retain every gate and write. */
export class IslandJourneyOverlay {
 private root:Node;private dock:Node;private modal:Node;private shade:Node;private panel:Node;
 private buttons:Node[]=[];private width=0;private height=0;private enabled=false;private dead=false;private page:Page|null=null;private serial=0;
 private pointer:number|null=null;private start={x:0,y:0};private moved=false;
 constructor(parent:Node,private options:Options){
  this.root=this.box('IslandJourneyOverlay',parent,0,0,1,1);this.root.active=false;
  this.dock=this.box('IslandUtilityDock',this.root,0,0,1,1);
  for(const [role,name] of [['bag','行囊'],['journal','旅程册'],['settings','设置']] as [JourneyNavigationRole,string][]){
   const n=this.box('Island-'+role,this.dock,0,0,64,64),surface=warmButton(n,64,64,true),l=this.text(n,name,0,-20,12,60);surface.addContent(l.node);applyJourneyNavigationSkin(n,role,64,64);
   surface.bind(()=>{if(!this.enabled||this.dead||this.page)return false;this.open(role as Page);});this.buttons.push(n);
  }
  this.modal=this.box('IslandJournalModal',this.root,0,0,1,1);this.modal.addComponent(BlockInputEvents);this.modal.active=false;
  this.shade=this.box('IslandModalShade',this.modal,0,0,1,1);this.shade.addComponent(Graphics);this.shade.addComponent(BlockInputEvents);
  this.panel=this.box('IslandParchment',this.modal,0,0,1,1);this.panel.addComponent(Graphics);this.panel.addComponent(BlockInputEvents);
  this.shade.on(Node.EventType.TOUCH_START,this.down,this);this.shade.on(Node.EventType.TOUCH_MOVE,this.move,this);this.shade.on(Node.EventType.TOUCH_END,this.up,this);this.shade.on(Node.EventType.TOUCH_CANCEL,this.cancel,this);
 }
 sync(width:number,height:number,enabled:boolean){
  if(this.dead||!isValid(this.root,true))return;const resized=width!==this.width||height!==this.height;this.enabled=enabled;this.root.active=enabled;
  if(!enabled){this.close();return;}
  this.width=width;this.height=height;if(!resized)return;this.root.getComponent(UITransform)!.setContentSize(width,height);const portrait=width<height,bottom=portrait?34:20,gap=Math.min(100,(width-48)/3);
  this.buttons.forEach((n,i)=>n.setPosition(portrait||width<568?(i-1)*gap:width/2-56+(i-2)*84,-height/2+bottom+38,0));
  this.modal.getComponent(UITransform)!.setContentSize(width,height);this.shade.getComponent(UITransform)!.setContentSize(width,height);
  const g=this.shade.getComponent(Graphics)!;g.clear();g.fillColor=new Color('#173f3aaa');g.rect(-width/2,-height/2,width,height);g.fill();if(this.page)this.paint();
 }
 isOpen(){return !this.dead&&this.page!==null;}
 close(){this.cancel();this.page=null;this.serial++;if(isValid(this.modal,true))this.modal.active=false;if(isValid(this.dock,true))this.dock.active=true;}
 private open(page:Page){if(this.dead||!this.enabled)return;this.cancel();this.page=page;this.serial++;this.dock.active=false;this.modal.active=true;this.root.setSiblingIndex(this.root.parent!.children.length-1);this.paint();}
 private dispatch(fn:()=>any){if(!this.enabled||this.dead||!this.page)return;this.close();this.options.invoke(fn);}
 private safeRead(fn:()=>any){try{return fn();}catch{return null;}}
 private gate(region:string){const gates=this.safeRead(this.options.gates);return gates?.r5?.find((x:any)=>x.region===region);}
 private paint(){
  if(!this.page||this.dead)return;this.serial++;for(const child of [...this.panel.children]){child.removeFromParent();child.destroy();}
  const portrait=this.width<this.height,w=Math.max(232,Math.min(360,this.width-(portrait?32:112))),h=Math.max(236,Math.min(472,this.height-(portrait?120:60))),cy=portrait?-14:0;
  this.panel.setPosition(0,cy,0);this.panel.getComponent(UITransform)!.setContentSize(w,h);const g=this.panel.getComponent(Graphics)!;g.clear();
  g.fillColor=new Color('#173f3a33');g.roundRect(-w/2,-h/2-4,w,h,22);g.fill();g.fillColor=new Color('#dac79e');g.roundRect(-w/2,-h/2,w,h,22);g.fill();g.fillColor=new Color('#f7efd8');g.roundRect(-w/2+2,-h/2+3,w-4,h-5,20);g.fill();g.strokeColor=new Color('#fffaf0');g.lineWidth=1;g.roundRect(-w/2+7,-h/2+8,w-14,h-15,16);g.stroke();
  const title=this.page==='bag'?'旅人的行囊':this.page==='journal'?'旅程册':this.page==='settings'?'海岛小憩':CHAPTERS.find(c=>c.id===this.page)!.name;
  this.text(this.panel,title,-10,h/2-29,20,w-90);this.button('Close','×',w/2-29,h/2-29,44,44,()=>this.close(),true);
  if(this.page==='journal'){
   const pitch=portrait?88:62,cardH=portrait?70:52,top=h/2-(portrait?100:82);
   CHAPTERS.forEach((c,i)=>{const gate=this.gate(c.id),label=gate?.ok?'翻开这一章':'查看这一章';this.button('Chapter-'+c.id,c.name+'  ›',0,top-i*pitch,w-36,cardH,()=>this.open(c.id as Page),true,portrait?8:11);this.text(this.panel,label,0,top-i*pitch-cardH/2+16,10,w-60,'#697b59');});
  }else if(this.page==='bag'){
   const status=this.safeRead(this.options.mainlineStatus),tools=status?.journey?.inventory?.tools,names:Record<string,string>={windBell:'风语铃',tideBottle:'潮汐瓶',tideNet:'潮汐网',sunSeed:'日光籽',starShears:'星剪'};
   this.text(this.panel,'随身物品 · 只读查看',0,h/2-61,12,w-40,'#788466');
   const items=tools&&typeof tools==='object'?Object.keys(tools).filter(k=>typeof tools[k]==='number'&&Number.isFinite(tools[k])):[];
   if(!items.length)this.text(this.panel,tools?'行囊里还没有道具':'暂时无法读取行囊记录',0,8,14,w-44);
   else {const line=Math.min(35,(h-136)/items.length);items.forEach((k,i)=>this.text(this.panel,(names[k]||k)+'    × '+tools[k],0,h/2-100-i*line,15,w-44));}
   this.text(this.panel,'在关卡中使用道具',0,-h/2+29,12,w-40,'#788466');
  }else if(this.page==='settings'){
   const night=this.safeRead(this.options.dayNight)?.mode==='night';this.text(this.panel,'让旅程慢一点',0,h/2-68,13,w-40,'#788466');
   this.button('DayNight',night?'迎接晴昼':'看看夜色',0,18,w-60,48,()=>this.dispatch(this.options.toggleDayNight));this.button('ReturnHome','回屋小憩',0,-46,w-60,48,()=>this.dispatch(this.options.returnHome),true);
  }else{
   const region=this.page,chapter=CHAPTERS.find(c=>c.id===region)!,gate=this.gate(region),extra=region==='tide'||region==='sky';
   const blocked=gate?.reason==='stage-locked'?'主线解锁后开启':gate?.reason==='completion-unsaved'?'先保存当前成绩':['finish-or-discard-current-attempt','pending-stage-start'].includes(gate?.reason)?'请先继续当前挑战':'暂不可进入';
   this.text(this.panel,chapter.description,0,h/2-70,13,w-46,'#697b59');
   this.button('Continue-'+region,gate?.ok?'继续挑战':blocked,0,-h/2+(extra?146:108),w-54,46,()=>{if(!this.gate(region)?.ok)return false;this.dispatch(()=>this.options.enterRegion(region));},!gate?.ok);
   if(region==='sky')this.button('VisitSkycity','前往天空城',0,-h/2+88,w-54,46,()=>this.dispatch(this.options.enterSkycity),true);
   if(region==='tide')this.button('LegacyTide',this.safeRead(this.options.gates)?.r4?.some((x:any)=>x.unlocked)?'旧日潮汐':'旧日潮汐 · 未开启',0,-h/2+88,w-54,46,()=>{const gates=this.safeRead(this.options.gates);if(!gates?.r4?.some((x:any)=>x.unlocked))return false;this.dispatch(this.options.enterR4);},true);
   this.button('BackToChapters','返回章节',0,-h/2+30,140,44,()=>this.open('journal'),true);
  }
 }
 private button(name:string,value:string,x:number,y:number,w:number,h:number,fn:()=>any,ivory=false,labelY=0){const n=this.box(name,this.panel,x,y,w,h),surface=warmButton(n,w,h,ivory),label=this.text(n,value,0,labelY,16,w-20,ivory?'#355f53':'#fff4d6');surface.addContent(label.node);const serial=this.serial;surface.bind(()=>{if(this.dead||!this.enabled||!this.page||serial!==this.serial)return false;return fn();});return n;}
 private box(name:string,parent:Node,x:number,y:number,w:number,h:number){const n=new Node(name);n.layer=Layers.Enum.UI_2D;parent.addChild(n);n.setPosition(x,y,0);n.addComponent(UITransform).setContentSize(w,h);return n;}
 private text(parent:Node,value:string,x:number,y:number,size:number,w:number,color='#355f53'){const n=this.box('Text',parent,x,y,w,size+10),l=n.addComponent(Label);l.string=value;l.fontSize=size;l.lineHeight=size+4;l.color=new Color(color);l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.SHRINK;return l;}
 private down(e:EventTouch){if(!this.isOpen()||this.pointer!==null)return;if(this.panel.getComponent(UITransform)!.hitTest(e.getLocation(),e.windowId))return;this.pointer=e.getID();const p=e.getUILocation();this.start={x:p.x,y:p.y};this.moved=false;}
 private move(e:EventTouch){if(e.getID()!==this.pointer)return;const p=e.getUILocation();if(Math.hypot(p.x-this.start.x,p.y-this.start.y)>10)this.moved=true;}
 private up(e:EventTouch){if(e.getID()!==this.pointer)return;const p=e.getUILocation(),close=!this.moved&&Math.hypot(p.x-this.start.x,p.y-this.start.y)<=10&&!this.panel.getComponent(UITransform)!.hitTest(e.getLocation(),e.windowId);this.cancel();if(close)this.close();}
 private cancel(){this.pointer=null;this.moved=false;}
 dispose(){if(this.dead)return;this.dead=true;this.close();if(isValid(this.shade,true)){this.shade.off(Node.EventType.TOUCH_START,this.down,this);this.shade.off(Node.EventType.TOUCH_MOVE,this.move,this);this.shade.off(Node.EventType.TOUCH_END,this.up,this);this.shade.off(Node.EventType.TOUCH_CANCEL,this.cancel,this);}if(isValid(this.root,true))this.root.destroy();}
}
