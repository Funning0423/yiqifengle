import { Node, UITransform, Graphics, Color, Label, Layers, UIOpacity, isValid } from 'cc';
import { ManagedToolArt } from '../ManagedToolArt';
import { BoardArt } from '../ui/BoardArt';
import { PopupStack } from '../ui/PopupKit';
import { openBag, openSettings } from '../ui/CommonPanels';
import { CHAPTERS, openChapter, openJourney, openRest } from '../ui/IslandPanels';
import { warmButton } from '../WarmButton';
import { applyJourneyNavigationSkin, type JourneyNavigationRole } from '../ui/JourneyNavigationSkin';
import { emitPropTap, type PropTapTarget } from './IslandPropTaps';
import { ISLAND_PROPS, propButtonLayout, propNightWeight, tagColorsAt, type PropButtonSlot } from './IslandPropsLayout';
const TAP_TARGET:Record<string,PropTapTarget>={bag:'bag',journal:'book',settings:'settings'};

type Options={invoke:(fn:()=>any)=>void;mainlineStatus:()=>any;gates:()=>any;enterRegion:(id:string)=>any;enterR4:()=>any;enterSkycity:()=>any;returnHome:()=>any;toggleDayNight:()=>any;dayNight:()=>any};
type Page='bag'|'journal'|'settings'|'rest'|'tide'|'meadow'|'sky';
export { CHAPTERS };
/** Island presentation only. Closed: three compact utilities (bag / journey book / full settings). Regions are chapters
 * in the journey book, never a second wall of island buttons. The island rest opens from the cabin (openRest).
 * Every dialog is a lite popup (ui/PopupKit); providers retain every gate and write. */
export class IslandJourneyOverlay {
 private root:Node;private dock:Node;private layer:Node;private popups:PopupStack;private toolArt:ManagedToolArt;private lastMs=0;
 private buttons:Node[]=[];private width=0;private height=0;private enabled=false;private dead=false;private page:Page|null=null;private serial=0;
 private propMode=false;private tags:Node[]=[];private tagSlots:PropButtonSlot[]=[];private tagNight=-1;
 constructor(parent:Node,private options:Options){
  this.root=this.box('IslandJourneyOverlay',parent,0,0,1,1);this.root.active=false;
  this.dock=this.box('IslandUtilityDock',this.root,0,0,1,1);
  for(const [role,name] of [['bag','行囊'],['journal','旅程册'],['settings','设置']] as [JourneyNavigationRole,string][]){
   const n=this.box('Island-'+role,this.dock,0,0,64,64),surface=warmButton(n,64,64,true),l=this.text(n,name,0,-20,12,60);surface.addContent(l.node);applyJourneyNavigationSkin(n,role,64,64);
   // T9: press/confirm for IslandPropTaps (click sounds, T0 marks); the action itself is unchanged.
   const target=TAP_TARGET[role],blocked=()=>!this.enabled||this.dead||!!this.page;n.on(Node.EventType.TOUCH_START,()=>emitPropTap(target,'press',blocked()));
   surface.bind(()=>{const b=blocked();emitPropTap(target,'confirm',b);if(b)return false;this.open(role as Page);});this.buttons.push(n);
  }
  this.layer=this.box('IslandPopups',this.root,0,0,1,1);
  this.popups=new PopupStack(this.layer,()=>({width:this.width||1,height:this.height||1}));
  this.toolArt=this.root.addComponent(ManagedToolArt);this.toolArt.initialize(()=>{});void BoardArt.shared().load('popup');void BoardArt.shared().load('r2');void BoardArt.shared().load('r3');
 }
 sync(width:number,height:number,enabled:boolean){
  if(this.dead||!isValid(this.root,true))return;const resized=width!==this.width||height!==this.height;this.enabled=enabled;this.root.active=enabled;
  if(!enabled){this.close();return;}
  const now=Date.now(),dt=this.lastMs?Math.min(.1,(now-this.lastMs)/1000):0;this.lastMs=now;this.popups.update(dt);if(this.page&&!this.popups.any())this.page=null;if(!this.page&&!this.dock.active)this.dock.active=true;
  // T9n: tags follow the props' night weight (repaint only on a visible step; ends exact)
  if(this.propMode&&this.tags.length){const nw=propNightWeight();if(Math.abs(nw-this.tagNight)>=.02||nw!==this.tagNight&&(nw===0||nw===1)){this.tagNight=nw;if(!resized)this.paintTags();}}
  this.width=width;this.height=height;if(!resized)return;this.root.getComponent(UITransform)!.setContentSize(width,height);const portrait=width<height,bottom=portrait?34:20,gap=Math.min(100,(width-48)/3);
  if(this.propMode)this.layoutProps();else this.buttons.forEach((n,i)=>n.setPosition(portrait||width<568?(i-1)*gap:width/2-56+(i-2)*84,-height/2+bottom+38,0));
  this.layer.getComponent(UITransform)!.setContentSize(width,height);this.popups.layout();
 }
 isOpen(){return !this.dead&&this.page!==null;}
 /** 海岛小憩: opened by tapping the cabin (Boot / IslandHomeInteraction). */
 openRest(){if(this.dead||!this.enabled||this.page)return false;this.open('rest');return true;}
 /** T9: true while the three utilities are on screen (the 3D props follow this). */
 dockVisible(){return !this.dead&&this.enabled&&this.page===null&&isValid(this.dock,true)&&this.dock.active&&this.root.active;}
 /** T9: 3D prop look. The WarmButton nodes stay as the (invisible) hit areas with the same handlers; a cream tag
  * with dark-brown system-font text sits under each prop. off = original flat buttons (props failed to load). */
 setPropMode(on:boolean){
  if(this.dead||on===this.propMode)return;this.propMode=on;
  this.buttons.forEach(n=>{const o=n.getComponent(UIOpacity)||n.addComponent(UIOpacity);o.opacity=on?0:255;if(!on)n.getComponent(UITransform)!.setContentSize(64,64);});
  if(on&&!this.tags.length)for(const role of ['bag','journal','settings'] as const){const t=this.box('IslandPropTag-'+role,this.dock,0,0,40,24);t.addComponent(Graphics);const l=this.text(t,ISLAND_PROPS.buttons[role].label,0,0,13,40,ISLAND_PROPS.tag.text);l.isBold=true;l.overflow=Label.Overflow.NONE;this.tags.push(t);}
  for(const t of this.tags)t.active=on;const w=this.width,h=this.height;this.width=0;this.height=0;if(this.enabled&&w>0&&h>0)this.sync(w,h,true);
 }
 private layoutProps(){
  const L=propButtonLayout(this.width,this.height);
  L.slots.forEach((s,i)=>{const n=this.buttons[i],t=n.getComponent(UITransform)!;if(t.width!==s.hit.width||t.height!==s.hit.height)t.setContentSize(s.hit.width,s.hit.height);n.setPosition(s.hit.x,s.hit.y,0);
   const tag=this.tags[i];if(!tag)return;tag.setPosition(s.tag.x,s.tag.y,0);tag.getComponent(UITransform)!.setContentSize(s.tag.width,s.tag.height);
   this.tagSlots[i]=s;});
  this.paintTags();
 }
 /** Tag card + label colours at the current night weight (T9n; day colours at weight 0 are the T9 ones). */
 private paintTags(){
  const c=tagColorsAt(Math.max(0,this.tagNight));
  this.tagSlots.forEach((s,i)=>{const tag=this.tags[i];if(!tag||!s)return;
   const g=tag.getComponent(Graphics)!,w=s.tag.width,h=s.tag.height,r=h/2,lw=Math.max(1.5,s.tag.fontSize/10);g.clear();
   g.fillColor=new Color(c.shadow);g.roundRect(-w/2,-h/2-2,w,h,r);g.fill();
   g.fillColor=new Color(c.fill);g.roundRect(-w/2,-h/2,w,h,r);g.fill();g.strokeColor=new Color(c.edge);g.lineWidth=lw;g.roundRect(-w/2+lw/2,-h/2+lw/2,w-lw,h-lw,r-lw/2);g.stroke();
   const l=tag.getComponentInChildren(Label)!;l.color=new Color(c.text);l.fontSize=s.tag.fontSize;l.lineHeight=s.tag.fontSize+4;l.node.getComponent(UITransform)!.setContentSize(w,h);});
 }
 close(){this.page=null;this.serial++;this.popups?.clear();if(isValid(this.dock,true))this.dock.active=true;}
 private open(page:Page){if(this.dead||!this.enabled)return;this.page=page;this.serial++;this.dock.active=false;this.root.setSiblingIndex(this.root.parent!.children.length-1);this.paint();}
 private dispatch(fn:()=>any){if(!this.enabled||this.dead||!this.page)return;this.close();this.options.invoke(fn);}
 private safeRead(fn:()=>any){try{return fn();}catch{return null;}}
 private gate(region:string){const gates=this.safeRead(this.options.gates);return gates?.r5?.find((x:any)=>x.region===region);}
 private paint(){
  if(!this.page||this.dead)return;const page=this.page,serial=++this.serial,live=()=>!this.dead&&this.enabled&&serial===this.serial;
  const done=()=>{if(serial===this.serial&&!this.popups.any()){this.page=null;this.dock.active=true;}};
  if(page==='bag'){const status=this.safeRead(this.options.mainlineStatus);openBag(this.popups,status?.journey,'island',this.toolArt).options.onClose=done;}
  else if(page==='settings')openSettings(this.popups,{onClose:done});
  else if(page==='rest'){const night=this.safeRead(this.options.dayNight)?.mode==='night';openRest(this.popups,night,()=>{if(live())this.dispatch(this.options.toggleDayNight);}).options.onClose=done;}
  else if(page==='journal'){const status=this.safeRead(this.options.mainlineStatus),gates=this.safeRead(this.options.gates);
   openJourney(this.popups,status?.journey,gates?.challenges,id=>{if(live())this.chapter(id);},gates?.r5).options.onClose=done;}
  else this.chapter(page);
 }
 private chapter(region:string){
  const serial=this.serial,live=()=>!this.dead&&this.enabled&&serial===this.serial&&!!this.page;
  openChapter(this.popups,region,{gate:()=>this.gate(region),r4Open:()=>!!this.safeRead(this.options.gates)?.r4?.some((x:any)=>x.unlocked),
   enter:()=>{if(live())this.dispatch(()=>this.options.enterRegion(region));},skycity:()=>{if(live())this.dispatch(this.options.enterSkycity);},
   legacyTide:()=>{if(live())this.dispatch(this.options.enterR4);},back:()=>{}}).options.onClose=()=>{if(serial===this.serial&&!this.popups.any()){this.page=null;this.dock.active=true;}};
 }
 private box(name:string,parent:Node,x:number,y:number,w:number,h:number){const n=new Node(name);n.layer=Layers.Enum.UI_2D;parent.addChild(n);n.setPosition(x,y,0);n.addComponent(UITransform).setContentSize(w,h);return n;}
 private text(parent:Node,value:string,x:number,y:number,size:number,w:number,color='#355f53'){const n=this.box('Text',parent,x,y,w,size+10),l=n.addComponent(Label);l.string=value;l.fontSize=size;l.lineHeight=size+4;l.color=new Color(color);l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.SHRINK;return l;}
 dispose(){if(this.dead)return;this.dead=true;this.close();if(isValid(this.root,true))this.root.destroy();}
}
