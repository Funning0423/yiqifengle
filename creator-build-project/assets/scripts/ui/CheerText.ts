/** T6 combo cheer floating text (GGbot). Single source: GameAudio.onCheer((level, visual)) (Voice bot A2 b200456; same decision
 * point as the cheer voice; fires even when muted/backgrounded). Position: visual is the triggering kind==='clear' frame ->
 * centroid of visual.wave.removed[].index cells -> board-canvas UI space; falls back to the board centre when it has no cells. System-font Label with outline + shadow: zero asset bytes.
 * Pool: 4 nodes (one per tier) created once per board canvas; per frame only scale/position/opacity are written (no allocations). */
import {_decorator,Component,Node,Label,UITransform,UIOpacity,Color,Layers,Vec3,director,Director,isValid} from 'cc';
import {GameAudio} from '../audio/GameAudio';
import {ManagedMobileBoardUI} from '../ManagedMobileBoardUI';
import {CHEER_STYLES,CHEER_TOTAL_S,decide,poseAt,removedIndexes,clampToSafe,tierOf} from './CheerTextModel';
const {ccclass}=_decorator;
type Slot={node:Node;label:Label;opacity:UIOpacity;hw:number;hh:number};
@ccclass('CheerTextHost')
export class CheerTextHost extends Component {
 static instance:CheerTextHost|null=null;
 private off:(()=>void)|null=null;private board:ManagedMobileBoardUI|null=null;private layer:Node|null=null;private slots:Slot[]=[];
 private active=-1;private age=0;private x=0;private y=0;private readonly pose={scale:1,dy:0,alpha:1,done:true};private readonly tmp=new Vec3();
 static ensure(){try{const a=GameAudio.ensure();if(!a.node.getComponent(CheerTextHost))a.node.addComponent(CheerTextHost);}catch(e){console.warn('[CheerText] mount failed (gameplay unaffected)',e);}}
 onLoad(){CheerTextHost.instance=this;this.off=GameAudio.onCheer((level,visual)=>{try{this.show(level,visual);}catch(e){console.warn('[CheerText] show failed (gameplay unaffected)',e);}});}
 onDestroy(){this.off?.();this.off=null;this.hideAll();if(this.layer&&isValid(this.layer,true))this.layer.destroy();this.layer=null;this.slots=[];if(CheerTextHost.instance===this)CheerTextHost.instance=null;}
 private findBoard():ManagedMobileBoardUI|null{if(this.board&&isValid(this.board,true)&&isValid(this.board.node,true))return this.board;
  const s=director.getScene();this.board=s?s.getComponentsInChildren(ManagedMobileBoardUI).find(b=>isValid(b,true)&&isValid(b.node,true))||null:null;return this.board;}
 /** Pool lives under the board canvas (same UI camera as the cells), built once per canvas. */
 private ensureLayer(root:Node):boolean{if(this.layer&&isValid(this.layer,true)&&this.layer.parent===root)return true;
  this.layer=new Node('CheerTextLayer');this.layer.layer=Layers.Enum.UI_2D;root.addChild(this.layer);this.layer.addComponent(UITransform);this.slots=[];
  CHEER_STYLES.forEach((st,i)=>{const n=new Node('Cheer-'+i);n.layer=Layers.Enum.UI_2D;this.layer!.addChild(n);n.addComponent(UITransform);const l=n.addComponent(Label);
   l.string=st.word;l.fontSize=st.size;l.lineHeight=st.size+8;l.isBold=true;l.useSystemFont=true;l.fontFamily='Arial Rounded MT Bold';l.color=new Color(st.fill);
   l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.NONE;
   l.enableOutline=true;l.outlineColor=new Color(st.outline);l.outlineWidth=4;l.enableShadow=true;l.shadowColor=new Color(st.shadow);l.shadowOffset.set(0,-3);l.shadowBlur=2;
   const o=n.addComponent(UIOpacity);l.updateRenderData(true);const t=n.getComponent(UITransform)!;n.active=false;this.slots.push({node:n,label:l,opacity:o,hw:Math.max(40,t.width/2),hh:Math.max(18,t.height/2)});});
  this.active=-1;return true;}
 /** Returns what happened (used by the T0 GB_MARK observer). */
 show(level:number,visual?:any):{tier:number;word:string;decision:string;source:string;x:number;y:number;replaced:number}{
  const tier=tierOf(level),word=CHEER_STYLES[tier]?.word??'?';const d=decide(this.active,this.age,tier);const res={tier,word,decision:d as string,source:'-',x:0,y:0,replaced:-1};
  if(d==='skip')return res;const board=this.findBoard();const root:Node|null=board?(board as any).root:null;if(!board||!root||!isValid(root,true)){res.decision='no-board';return res;}
  this.ensureLayer(root);const info=(board as any).layoutInfo,rt=root.getComponent(UITransform);let x=0,y=0,source='center';
  const idx=removedIndexes(visual),cells:Node[]=(board as any).cells||[];
  if(idx.length&&rt){let sx=0,sy=0,n=0;for(const i of idx){const c=cells[i];if(!c||!isValid(c,true))continue;rt.convertToNodeSpaceAR(c.worldPosition,this.tmp);sx+=this.tmp.x;sy+=this.tmp.y;n++;}if(n){x=sx/n;y=sy/n;source='clear';}}
  if(source==='center'&&info?.boardCenter){x=info.boardCenter.x;y=info.boardCenter.y;}
  const s=this.slots[tier],w=info?.width??rt?.width??390,h=info?.height??rt?.height??844,safe=info?.safe??{top:0,bottom:0,left:0,right:0};
  const p=clampToSafe(x,y,s.hw,s.hh,w,h,safe);if(this.active>=0&&this.active!==tier){this.slots[this.active].node.active=false;res.replaced=this.active;}
  this.active=tier;this.age=0;this.x=p.x;this.y=p.y;this.layer!.setSiblingIndex(root.children.length-1);s.node.active=true;this.apply(s,0);
  res.source=source;res.x=Math.round(p.x);res.y=Math.round(p.y);return res;}
 private apply(s:Slot,t:number){const q=poseAt(t,this.pose);s.node.setScale(q.scale,q.scale,1);s.node.setPosition(this.x,this.y+q.dy,0);s.opacity.opacity=Math.round(255*q.alpha);return q.done;}
 update(dt:number){if(this.active<0)return;const s=this.slots[this.active];if(!s||!isValid(s.node,true)){this.active=-1;return;}
  this.age+=Math.min(dt,0.1);if(this.apply(s,this.age)){s.node.active=false;this.active=-1;}}
 private hideAll(){for(const s of this.slots)if(isValid(s.node,true))s.node.active=false;this.active=-1;}
 diagnostics(){return {active:this.active,age:this.age,word:CHEER_STYLES[this.active]?.word??null,pool:this.slots.length,totalS:CHEER_TOTAL_S};}
}
director.once(Director.EVENT_AFTER_SCENE_LAUNCH,()=>CheerTextHost.ensure());
