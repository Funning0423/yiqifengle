import {Node,UITransform,Layers,Graphics,Color,Sprite,SpriteFrame,Texture2D,ImageAsset,UIOpacity,Label,Vec2,assetManager,isValid} from 'cc';
import {ART,BACKDROP_RGB,BAR,PINWHEEL,HINT,DESIGN_W,DESIGN_H,LoadingTimeline,coverTransform,toCentered,ribbonHead,hintForStage} from './StartupLoadingLayout';
/** Scene loading layer (GGbot, docs/first-screen.md). Takes over from build-templates/wechatgame/first-screen.js:
 *  - root ('StartupLoadingLayer', Sprite + UIOpacity) shows the SAME startup-art/first_screen_composite.jpg with the same
 *    cover transform, so its first frame equals the first screen (logo, title, empty track are baked into the picture);
 *  - the picture comes from the decoded image first-screen.js published (globalThis.__firstScreen) -> synchronous, no gap;
 *    without it (web preview, or first-screen failed) assetManager.loadRemote loads the same file and the cream mask
 *    (BACKDROP_RGB, the picture's mean colour) covers the wait instead of a dark plate;
 *  - 'LoadingDynamic' (progress fill, pinwheel, hint text) fades in over INTRO_FADE_S after the first frame;
 *  - startOutro(): the whole layer fades out over OUTRO_FADE_S (ease-out) once the room is ready; tick() reports done.
 * Boot keeps its loadingMask / loadingBackdrop fields pointing at mask / root (T0 BootProbe reads them). */
const G:any=globalThis as any;
function handoff():any{try{return G.__firstScreen||(typeof window!=='undefined'?(window as any).__firstScreen:null)||null;}catch(e){return null;}}
function frameOf(src:any):SpriteFrame{const a=src instanceof ImageAsset?src:new ImageAsset(src);const t=new Texture2D();t.image=a;
 try{t.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);t.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);t.setMipFilter(Texture2D.Filter.NONE);}catch(e){}
 const f=new SpriteFrame();f.texture=t;return f;}
function uiNode(name:string,parent:Node){const n=new Node(name);n.layer=Layers.Enum.UI_2D;parent.addChild(n);n.addComponent(UITransform);return n;}
export class StartupLoadingLayer {
 readonly mask:Node;readonly root:Node;readonly timeline=new LoadingTimeline();
 private dynamic:Node;private base:Sprite;private fill:Sprite;private pin:Node;private hintNode:Node;private hint:Label;
 private rootOpacity:UIOpacity;private maskOpacity:UIOpacity;private dynOpacity:UIOpacity;
 private size={w:1,h:1};private started=false;private retry=false;private disposed=false;
 private sources:{[k:string]:string}={composite:'pending',fill:'pending',pinwheel:'pending'};
 private firstScreen:any=null;
 constructor(parent:Node,private onRetry:()=>void){
  this.mask=uiNode('LoadingOpaqueUntilWorldReady',parent);this.mask.addComponent(Graphics);this.maskOpacity=this.mask.addComponent(UIOpacity);
  this.root=uiNode('StartupLoadingLayer',parent);this.base=this.root.addComponent(Sprite);this.base.sizeMode=Sprite.SizeMode.CUSTOM;this.rootOpacity=this.root.addComponent(UIOpacity);
  this.dynamic=uiNode('LoadingDynamic',this.root);this.dynOpacity=this.dynamic.addComponent(UIOpacity);this.dynOpacity.opacity=0;
  const fillNode=uiNode('LoadingRibbonFill',this.dynamic);this.fill=fillNode.addComponent(Sprite);this.fill.sizeMode=Sprite.SizeMode.CUSTOM;
  this.fill.type=Sprite.Type.FILLED;this.fill.fillType=Sprite.FillType.HORIZONTAL;this.fill.fillStart=0;this.fill.fillRange=ribbonHead(0).fillRange;
  this.pin=uiNode('LoadingPinwheel',this.dynamic);const ps=this.pin.addComponent(Sprite);ps.sizeMode=Sprite.SizeMode.CUSTOM;
  this.hintNode=uiNode('LoadingHint',this.dynamic);this.hint=this.hintNode.addComponent(Label);this.hint.string=hintForStage(0);
  this.hint.color=new Color(HINT.color);this.hint.horizontalAlign=Label.HorizontalAlign.CENTER;this.hint.verticalAlign=Label.VerticalAlign.CENTER;
  try{const l:any=this.hint;l.enableShadow=true;l.shadowColor=new Color(HINT.shadow[0],HINT.shadow[1],HINT.shadow[2],HINT.shadow[3]);l.shadowBlur=0;}catch(e){}
  this.hintNode.on(Node.EventType.TOUCH_END,()=>{if(this.retry)this.onRetry();});
  this.adopt('composite',this.base,'.jpg');this.adopt('fill',this.fill,'.png');this.adopt('pinwheel',ps,'.png');
 }
 /** Prefer the decoded image the first screen already holds; else load the same file from the package root. */
 private adopt(key:'composite'|'fill'|'pinwheel',sprite:Sprite,ext:string){
  const fs=handoff();this.firstScreen=fs;const img=fs&&fs.images?fs.images[key]:null;
  if(img){try{sprite.spriteFrame=frameOf(img);this.sources[key]='first-screen';return;}catch(e){this.sources[key]='first-screen-failed';}}
  const url=(ART as any)[key] as string;this.sources[key]=this.sources[key]==='pending'?'loadRemote':this.sources[key]+'>loadRemote';
  try{assetManager.loadRemote<ImageAsset>(url,{ext},(err,asset)=>{if(this.disposed||!isValid(sprite.node,true))return;
   if(err||!asset){this.sources[key]='failed';console.warn('[startup-loading] '+url+' unavailable',String(err));return;}
   sprite.spriteFrame=frameOf(asset);this.sources[key]='loadRemote:ok';});}catch(e){this.sources[key]='failed';}
 }
 layout(w:number,h:number){if(this.disposed)return;this.size={w,h};const c=coverTransform(w,h);
  this.mask.getComponent(UITransform)!.setContentSize(w,h);const g=this.mask.getComponent(Graphics)!;g.clear();
  g.fillColor=new Color(BACKDROP_RGB[0],BACKDROP_RGB[1],BACKDROP_RGB[2],255);g.rect(-w/2,-h/2,w,h);g.fill();
  this.root.setPosition(0,0,0);this.root.getComponent(UITransform)!.setContentSize(DESIGN_W*c.s,DESIGN_H*c.s);
  this.dynamic.getComponent(UITransform)!.setContentSize(DESIGN_W*c.s,DESIGN_H*c.s);
  const fp=toCentered(c,BAR.x+BAR.w/2,BAR.y+BAR.h/2);this.fill.node.setPosition(fp.x,fp.y,0);this.fill.node.getComponent(UITransform)!.setContentSize(BAR.w*c.s,BAR.h*c.s);
  this.pin.getComponent(UITransform)!.setContentSize(PINWHEEL.w*c.s,PINWHEEL.h*c.s);
  const hp=toCentered(c,DESIGN_W/2,HINT.centerY);this.hintNode.setPosition(hp.x,hp.y,0);this.hintNode.getComponent(UITransform)!.setContentSize(HINT.width*c.s,HINT.height*c.s);
  this.hint.fontSize=HINT.size*c.s;this.hint.lineHeight=HINT.height*c.s;try{(this.hint as any).shadowOffset=new Vec2(c.s,-c.s);}catch(e){}
  this.apply();
 }
 /** loadWorld (re)starts: layer fully visible, bar back to its real start. */
 restart(){this.timeline.reset();this.retry=false;this.hint.string=hintForStage(0);this.rootOpacity.opacity=255;this.maskOpacity.opacity=255;this.apply();}
 setStage(stage:number){this.timeline.setStage(stage);if(!this.retry)this.hint.string=hintForStage(this.timeline.stage);}
 showError(text:string){this.retry=true;this.hint.string=text;}
 startOutro(){this.retry=false;this.timeline.startOutro();}
 get fading(){return this.timeline.fading;}
 /** Per frame while the layer is active. Returns true once the outro finished (Boot then deactivates the nodes). */
 tick(dt:number):boolean{if(this.disposed)return true;
  if(!this.started){this.started=true;this.timeline.begin();}else this.timeline.tick(dt);
  this.apply();return this.timeline.hidden;}
 private apply(){const t=this.timeline,c=coverTransform(this.size.w,this.size.h),head=ribbonHead(t.shown);
  this.rootOpacity.opacity=t.layerOpacity();this.maskOpacity.opacity=t.layerOpacity();this.dynOpacity.opacity=t.introOpacity();
  this.fill.fillRange=head.fillRange;const pp=toCentered(c,head.x,head.y);this.pin.setPosition(pp.x,pp.y,0);this.pin.angle=t.spin;}
 diagnostics(){const fs=this.firstScreen;const t=this.timeline;
  return {sources:{composite:this.sources.composite,fill:this.sources.fill,pinwheel:this.sources.pinwheel},art:ART.composite,artSha256:ART.compositeSha256,
   progressShown:t.shown,progressTarget:t.target,stage:t.stage,introOpacity:t.introOpacity(),layerOpacity:t.layerOpacity(),fading:t.fading,hidden:t.hidden,hint:this.hint.string,retry:this.retry,
   firstScreen:fs?{version:fs.version,ready:!!fs.ready,ended:!!fs.ended,error:fs.error||null,frames:fs.frames,t:fs.t?{start:fs.t.start,image:fs.t.image,firstArtFrame:fs.t.firstArtFrame,end:fs.t.end,released:fs.t.released}:null}:null};}
 /** Drop the handed-off images once the layer is gone (the first screen keeps no other reference). */
 releaseHandoff(){const fs=handoff();if(fs){fs.images={};fs.image=null;}}
 dispose(){this.disposed=true;}
}
