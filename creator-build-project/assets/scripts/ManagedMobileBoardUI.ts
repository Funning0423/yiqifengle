import { ManagedToolArt } from './ManagedToolArt';
import { tactileToolButton, tactileToolGraphics } from './ui/TactileToolButton';
import { managedTools, type ManagedTool } from './world-r2/ManagedTools';
import { ResultChestView } from './ResultChestView';
import { RESULT_CHEST_SIZE } from './ResultChestResource';
import { resultLayout, resultActionCount } from './ResultLayout';
import { _decorator, Component, BlockInputEvents, Node, Canvas, Camera, Layers, UITransform, Graphics, Color, Label, Vec3, EventTouch, game, Game, view, ResolutionPolicy, tween, Tween, profiler, resources, ImageAsset, Texture2D, SpriteFrame, Sprite, Rect, director, isValid } from 'cc';
import type { LevelBackgroundStatus, LevelBackgroundFrame } from './world-r2/LevelBackground';
import { WarmButton, warmButton, warmButtonGraphics } from './WarmButton';
import { GameAudio } from './audio/GameAudio';
import Controller from './r4-cloud-compat/runtime/challenge-controller.js';
import Port from './r4-cloud-compat/adapter/cocos-port.js';
const { ccclass } = _decorator;
const { createSynchronousStorage, bindChallengeController } = Port;
@ccclass('ManagedMobileBoardUI')
export class ManagedMobileBoardUI extends Component {
  private managed:any=null;private disposing=false;private frameKinds=new Set<string>();
  initializeManaged(fixture:any,binding:any,backgroundFrame?: (portrait:boolean,layout?:LevelBackgroundFrame)=>void,backgroundStatus?:()=>LevelBackgroundStatus){if(this.managed||this.root)throw Error('Already initialized');this.managed=binding;this.backgroundStatus=backgroundStatus;this.initialize(fixture,backgroundFrame);}
  managedViewVersion(){return 'mobile-managed-v1';}
  diagnostics(){return {background:this.backgroundStatus?.()??{state:'missing-provider'},snapshot:this.controller.snapshot(),checkpoint:this.controller.session?.checkpoint()||null,presentation:this.snapshot,layout:this.measureLayout(),storage:this.managed?.storageEntries?.()||[],frameKinds:Array.from(this.frameKinds),goalSemantics:this.goalKeys.map((key,i)=>({key,value:this.goalLabels[i]?.string,icon:key}))};}
  lateEnd(index:number){this.cells[index]?.emit(Node.EventType.TOUCH_END);}

  private backgroundStatus?:()=>LevelBackgroundStatus;
  private root!:Node; private grid!:Node; private stagePanel!:Node; private resultPanel!:Node; private camera!:Camera;
  private hud!:Node; private tray!:Node; private boardFrame!:Node; private utilityRail!:Node; private regionalFocus!:Node; private status!:Label; private moves!:Label;
  private controller:any; private host:any; private cells:Node[]=[]; private selected=-1;
  private snapshot:any; private fixture:any; private epoch=0; private timer:any=null;
  private values=new Map<string,string>(); private attempt=0; private dragStart:any=null;
  private journey={readOnly:false,records:Array.from({length:12},()=>({bestStars:3}))};
  private pieceTexture:Texture2D|null=null;private pieceImage:ImageAsset|null=null;
  private frames:SpriteFrame[]=[]; private layoutInfo:any=null; private cell=50; private goalLabels:Label[]=[];
  private goalNodes:Node[]=[];   private goalKeys:string[]=[]; private targets:Record<string,Node>={}; private boardCenter=new Vec3();
  private back!:Node;private pause!:Node;private tools:Node[]=[];private spriteReady=false;private backgroundFrame?: (portrait:boolean,layout?:LevelBackgroundFrame)=>void;
  private titleLabel!:Label;private bagBtn!:Node;private retryBtn!:Node;private hintBtn!:Node;private bagPanel!:Node;private retryPanel!:Node;private hintCells:number[]=[];private bagOpen=false;private bagPage=0;
  private hide=()=>{this.selected=-1;this.host?.hide();};private show=()=>this.host?.show();
  private resize=()=>{if(!this.disposing&&this.root&&isValid(this.root,true))this.layout();};
  initialize(fixture:any,backgroundFrame?: (portrait:boolean,layout?:LevelBackgroundFrame)=>void){
    this.fixture=fixture;this.backgroundFrame=backgroundFrame;if(!this.managed)profiler.hideStats();view.resizeWithBrowserSize(true);
    this.root=this.box('NativeBoardCanvas',this.node,0,0,1,1);
    const canvas=this.root.addComponent(Canvas);canvas.alignCanvasWithScreen=false;
    const cameraNode=new Node('NativeUICamera');cameraNode.layer=Layers.Enum.UI_2D;this.node.addChild(cameraNode);cameraNode.setPosition(0,0,1000);
    this.camera=cameraNode.addComponent(Camera);this.camera.projection=Camera.ProjectionType.ORTHO;this.camera.near=.1;this.camera.far=2000;this.camera.priority=50;this.camera.visibility=Layers.Enum.UI_2D;this.camera.clearFlags=Camera.ClearFlag.DEPTH_ONLY;canvas.cameraComponent=this.camera;
    this.hud=this.box('LightGoalHUD',this.root,0,0,1,1);this.tray=this.box('CompactToolTray',this.root,0,0,1,1);
    this.boardFrame=this.box('IslandBoardCarving',this.root,0,0,1,1);this.boardFrame.addComponent(Graphics);
    this.utilityRail=this.box('IslandUtilityRail',this.tray,0,0,1,1);this.utilityRail.addComponent(Graphics);
    this.tray.addComponent(Graphics);
    this.grid=this.box('CenteredNativeGrid',this.root,0,0,1,1);
    this.regionalFocus=this.box('RegionalFocusCue',this.root,0,0,1,1);this.regionalFocus.addComponent(Graphics);
    for(let i=0;i<49;i++){
      const n=this.box('Tile-'+i,this.grid,0,0,50,50);n.addComponent(Graphics);
      const art=this.box('ProjectPieceArt',n,0,0,42,42);art.addComponent(Sprite);this.box('GoalMarkers',n,0,0,50,50).addComponent(Graphics);
      n.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{if(this.modalOpen()||this.snapshot?.state!=='run.ready'||this.snapshot?.readOnly)return;this.dragStart={index:i,point:e.getLocation()};},this);
      n.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{const d=this.dragStart;if(!d||d.consumed||d.index!==i)return;const p=e.getLocation(),dx=p.x-d.point.x,dy=p.y-d.point.y;if(Math.max(Math.abs(dx),Math.abs(dy))<Math.min(18,this.cell*.35))return;d.consumed=true;if(this.armedTool)return;const j=i+(Math.abs(dx)>Math.abs(dy)?(dx>0?1:-1):(dy>0?-7:7));if(j>=0&&j<49&&Math.abs(i%7-j%7)+Math.abs(Math.floor(i/7)-Math.floor(j/7))===1)this.swap(i,j);},this);
      n.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{const d=this.dragStart;this.dragStart=null;if(e&&d&&d.index===i)GameAudio.notifyUserGesture();if(d&&d.index===i&&!d.consumed)this.tap(i);},this);
      n.on(Node.EventType.TOUCH_CANCEL,()=>{this.dragStart=null;this.cancelToolInput();this.paintToolTray();this.paint();},this);this.cells.push(n);
    }
    for(let i=0;i<4;i++){
      const n=this.box('Goal-'+i,this.hud,0,0,58,42);this.islandPlate(n.addComponent(Graphics),58,42,'ivory');
      const icon=this.box('Icon',n,-14,1,24,24);this.drawIcon(icon,['lamp','moss','shell'][i]);const ga=this.box('GoalPieceArt',icon,0,0,24,24);ga.addComponent(Sprite);
      this.goalLabels.push(this.text(n,'',14,1,17,26,'#345f54'));this.goalNodes.push(n);
    }
    const steps=this.box('Moves',this.hud,0,0,62,46);this.islandPlate(steps.addComponent(Graphics),62,46,'sea');
    this.drawIcon(this.box('Footstep',steps,-18,0,18,24),'steps');this.moves=this.text(steps,'',10,1,23,34,'#fff4d6');this.targets.moves=steps;
    this.back=this.iconButton('back',this.root,()=>this.command('requestExit'));this.pause=this.iconButton('pause',this.root,()=>this.command(this.snapshot.state==='run.paused'?'resume':'pause'));
    const title=this.box('LevelTitle',this.hud,0,0,220,42);title.addComponent(Graphics);this.titleLabel=this.text(title,'',0,1,17,200,'#fff4d6');
    this.bagBtn=this.labeledIcon('bag','行囊',()=>this.toggleBag());this.retryBtn=this.labeledIcon('retry','重来',()=>this.askRestart());this.hintBtn=this.labeledIcon('hint','提示',()=>this.showHint());
    this.bagPanel=this.box('Backpack',this.root,0,0,1,1);this.bagPanel.active=false;this.bagPanel.addComponent(BlockInputEvents);this.retryPanel=this.box('RetryConfirm',this.root,0,0,1,1);this.retryPanel.active=false;this.retryPanel.addComponent(BlockInputEvents);
    for(let i=0;i<5;i++)this.tools.push(this.toolSlot(i));
    this.toolArt=this.tray.addComponent(ManagedToolArt);this.toolArt.initialize(()=>this.paintToolTray());
    this.status=this.text(this.root,'',0,0,12,250);
    this.stagePanel=this.box('NativeStageSelection',this.root,0,0,1,1);this.resultPanel=this.box('NativeResult',this.root,0,0,1,1);
    this.layout();this.bind();if(!this.managed){game.on(Game.EVENT_HIDE,this.hide);game.on(Game.EVENT_SHOW,this.show);}view.on('canvas-resize',this.resize,this);if(typeof window!=='undefined')window.addEventListener('resize',this.resize);
    this.loadPieceArt();
    if(!this.managed)(globalThis as any).__nativeBoard={snapshot:()=>this.controller.snapshot(),storage:()=>Array.from(this.values),coldReload:()=>this.coldReload(),hide:()=>this.hide(),show:()=>this.show(),fixture:()=>this.fixture,layout:()=>this.measureLayout(),scope:'Native Cocos UI; existing project art; disposable memory'};
  }
  /** Runtime-created frames/textures are not destroyed automatically with their Sprite nodes. */
  private loadPieceArt(){
    resources.load('ui/pieces',ImageAsset,(error,asset)=>{
      if(this.disposing||!isValid(this,true)||!isValid(this.node,true)||!isValid(this.root,true))return;
      if(error||!asset){console.error('Project piece atlas failed',error);return;}
      const frames:SpriteFrame[]=[];let texture:Texture2D|null=null;asset.addRef();
      try{texture=new Texture2D();texture.image=asset;for(let i=0;i<6;i++){const frame=new SpriteFrame();frames.push(frame);frame.texture=texture;frame.rect=new Rect(i%3*320,Math.floor(i/3)*320,320,320);}}
      catch(error){for(const frame of frames)frame.destroy();texture?.destroy();asset.decRef();console.error('Project piece atlas setup failed',error);return;}
      this.releasePieceArt();this.pieceImage=asset;this.pieceTexture=texture;this.frames=frames;this.spriteReady=true;this.paint();
    });
  }
  private releasePieceArt(){
    if(this.root&&isValid(this.root,true))for(const sprite of this.root.getComponentsInChildren(Sprite))if(isValid(sprite,true)&&sprite.spriteFrame&&this.frames.includes(sprite.spriteFrame))sprite.spriteFrame=null;
    for(const frame of this.frames)frame.destroy();this.frames=[];this.pieceTexture?.destroy();this.pieceTexture=null;this.pieceImage?.decRef();this.pieceImage=null;this.spriteReady=false;
  }
  private toolArt!:ManagedToolArt;private armedTool:string|null=null;private toolTapAccepted=false;
  private toolDrag:{kind:string,slot:number,pointer:number,start:{x:number,y:number},moved:boolean,version:string}|null=null;private toolGhost:Node|null=null;
  private toolCatalog():ManagedTool[]{return this.managed?.tools?.()||managedTools(this.snapshot);}
  private toolVersion(){const a=this.snapshot?.active;return `${a?.attemptId||a?.stageId}:${a?.actions?.length??a?.turn??0}:${a?.version??0}`;}
  private canUseTools(){return !this.modalOpen()&&this.snapshot?.state==='run.ready'&&!this.snapshot?.readOnly;}
  private cancelToolInput(){this.toolDrag=null;this.armedTool=null;this.toolTapAccepted=false;if(!this.disposing&&this.toolGhost&&isValid(this.toolGhost,true))this.toolGhost.active=false;this.selected=-1;}
  private useToolAt(kind:string,index:number){
    if(!this.canUseTools()||!this.managed)return false;
    const tool=this.toolCatalog().find(t=>t.kind===kind);
    if(!tool?.available){this.status.string=tool?.reason||'本关没有可用道具';return false;}
    if(tool.targeted&&(!Number.isInteger(index)||index<0||index>48)){this.status.string='先点道具再选格子，或把道具拖到格子上';return false;}
    const r=this.managed.useTool(kind,index);
    if(!r.ok)this.status.string=r.reason==='illegal-or-unsupported-action'?'换一个有作用的落点，道具还在':'暂不可操作 · '+r.reason;
    else {this.armedTool=null;this.selected=-1;}
    this.paintToolTray();this.paint();return !!r.ok;
  }
  private tapTool(slot:number){
    if(!this.canUseTools())return false;
    const tool=this.toolCatalog()[slot];
    if(!tool?.available){this.cancelToolInput();this.status.string=tool?.reason||'本关没有可用道具';this.paintToolTray();this.paint();return false;}
    if(!tool.targeted)return this.useToolAt(tool.kind,-1);
    this.armedTool=this.armedTool===tool.kind?null:tool.kind;this.selected=-1;
    this.status.string=this.armedTool?`${tool.name} · 点选目标，或再次点道具取消`:'已收回，道具没有消耗';this.paintToolTray();this.paint();return true;
  }
  private cellAt(x:number,y:number){const d=this.layoutInfo;if(!d)return -1;const g=this.grid.worldPosition;const lx=x-d.width/2-g.x,ly=y-d.height/2-g.y;
    const col=Math.round(lx/this.cell)+3,row=3-Math.round(ly/this.cell);if(Math.abs(lx)>=this.cell*3.5||Math.abs(ly)>=this.cell*3.5||col<0||col>6||row<0||row>6)return -1;return row*7+col;}
  private moveGhost(x:number,y:number){const d=this.layoutInfo;if(!this.toolGhost){this.toolGhost=this.box('ToolDragGhost',this.root,0,0,48,48);this.toolGhost.addComponent(Sprite);this.toolGhost.addComponent(Graphics);}
    const sprite=this.toolGhost.getComponent(Sprite)!;sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=this.toolArt.frame(this.toolDrag!.kind);const ghost=this.toolGhost.getComponent(Graphics)!;ghost.clear();if(!sprite.spriteFrame)this.drawToolEmblem(ghost,this.toolDrag!.kind,true);
    this.toolGhost.active=true;this.toolGhost.setWorldPosition(x-d.width/2,y-d.height/2+28,0);}
  private endToolDrag(e:EventTouch,slot?:number){const d=this.toolDrag;if(!d||d.pointer!==e.getID()||(slot!==undefined&&slot!==d.slot))return;this.toolDrag=null;this.toolTapAccepted=false;if(!this.disposing&&this.toolGhost&&isValid(this.toolGhost,true))this.toolGhost.active=false;
    if(!this.canUseTools()||d.version!==this.toolVersion()){this.cancelToolInput();this.paintToolTray();this.paint();return;}
    GameAudio.notifyUserGesture();
    const p=e.getUILocation(),moved=d.moved||Math.hypot(p.x-d.start.x,p.y-d.start.y)>=12;
    if(!moved){if(this.tools[d.slot].getComponent(UITransform)!.hitTest(e.getLocation(),e.windowId))this.toolTapAccepted=this.tapTool(d.slot);return;}
    const i=this.cellAt(p.x,p.y);this.armedTool=null;this.selected=-1;this.paintToolTray();this.paint();
    if(i<0){this.status.string='已收回，道具没有消耗';return;}this.useToolAt(d.kind,i);
  }
  private toolSlot(slot:number){const n=this.box('slot-'+slot,this.tray,0,0,46,46),surface=tactileToolButton(n);
    const art=this.box('OriginalToolArt',n,0,1,40,40);art.addComponent(Sprite);art.addComponent(Graphics);surface.addContent(art);
    const label=this.text(n,'',0,-30,11,56,'#fff3d3');label.node.name='ToolLabel';
    const count=this.box('ToolCount',n,18,18,22,22);count.addComponent(Graphics);const quantity=this.text(count,'',0,1,12,24,'#355c51');quantity.node.name='Quantity';
    const selected=this.box('ToolSelection',n,0,0,46,46);selected.addComponent(Graphics);
    n.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{if(this.toolDrag||!this.canUseTools())return;const tool=this.toolCatalog()[slot];if(!tool?.available){this.cancelToolInput();this.paintToolTray();this.paint();this.status.string=tool?.reason||'本关没有可用道具';return;}this.toolTapAccepted=false;const p=e.getUILocation();this.toolDrag={kind:tool.kind,slot,pointer:e.getID(),start:{x:p.x,y:p.y},moved:false,version:this.toolVersion()};},this);
    n.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{const d=this.toolDrag;if(!d||d.pointer!==e.getID())return;if(!this.canUseTools()||d.version!==this.toolVersion()){this.cancelToolInput();this.paintToolTray();return;}const p=e.getUILocation();if(!d.moved&&Math.hypot(p.x-d.start.x,p.y-d.start.y)<12)return;d.moved=true;this.armedTool=null;this.moveGhost(p.x,p.y);const i=this.cellAt(p.x,p.y);if(i!==this.selected){this.selected=i;this.paint();}this.paintToolTray();},this);
    // Registered before WarmButton: its activation event observes the accepted tap result.
    n.on(Node.EventType.TOUCH_END,(e:EventTouch)=>this.endToolDrag(e,slot),this);
    n.on(Node.EventType.TOUCH_CANCEL,(e:EventTouch)=>{if(this.toolDrag?.pointer!==e.getID())return;if(e.getEventCode()===Node.EventType.TOUCH_END){this.endToolDrag(e,slot);return;}this.cancelToolInput();this.paintToolTray();this.paint();},this);
    surface.bind(()=>{const accepted=this.toolTapAccepted;this.toolTapAccepted=false;return accepted;});return n;
  }
  private paintToolTray(){
    if(this.disposing||!this.root||!isValid(this.root,true)||!this.snapshot||!this.layoutInfo)return;const catalog=this.toolCatalog(),d=this.layoutInfo;
    if(d.safe.portrait){this.tray.getComponent(Graphics)!.clear();if(this.snapshot.provider==='regional-r05'){const guide=!!this.snapshot.active?.guide;this.hintBtn.setPosition(-36,d.utilityY);this.pause.setPosition(guide?36:0,d.utilityY);this.utilityRail.getComponent(Graphics)!.clear();}}
    for(const key of Object.keys(this.targets))if(key==='bomb'||key.startsWith('tool-'))delete this.targets[key];
    this.tools.forEach((n,i)=>{const tool=catalog[i];n.active=!!tool;if(!tool)return;
      if(d.safe.portrait)n.setPosition((i-(catalog.length-1)/2)*Math.min(62,(d.width-36)/catalog.length),d.toolY);
      else n.setPosition(d.width/2-d.safe.right-83+(i%2)*58,d.height/2-d.safe.top-95-Math.floor(i/2)*72);
      const sprite=n.getChildByName('OriginalToolArt')!.getComponent(Sprite)!;sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=tool.art?this.toolArt?.frame(tool.art):null;sprite.color=new Color(tool.available?'#ffffffff':'#ffffff99');const fallback=n.getChildByName('OriginalToolArt')!.getComponent(Graphics)!;fallback.clear();if(!tool.art)this.drawToolEmblem(fallback,tool.kind,tool.available);
      const label=n.getChildByName('ToolLabel')!.getComponent(Label)!;label.string=tool.name;label.color=new Color(tool.available?'#fff3d3':'#c7d5be');
      const badge=n.getChildByName('ToolCount')!,badgeGraphics=badge.getComponent(Graphics)!;badgeGraphics.clear();badgeGraphics.fillColor=new Color('#153f3866');badgeGraphics.circle(0,-1,11);badgeGraphics.fill();badgeGraphics.fillColor=new Color(tool.available?'#ffde88':'#cbd2bf');badgeGraphics.circle(0,1,10);badgeGraphics.fill();badgeGraphics.strokeColor=new Color('#fff4c9');badgeGraphics.lineWidth=1;badgeGraphics.circle(0,1,8.5);badgeGraphics.stroke();badge.getChildByName('Quantity')!.getComponent(Label)!.string=String(tool.count);
      const g=n.getChildByName('ToolSelection')!.getComponent(Graphics)!;g.clear();if(this.armedTool===tool.kind||this.toolDrag?.kind===tool.kind){g.strokeColor=new Color('#ffdc76');g.lineWidth=3;g.circle(0,0,25);g.stroke();g.fillColor=new Color('#ffdc76');g.moveTo(-4,30);g.lineTo(4,30);g.lineTo(0,25);g.close();g.fill();}
      this.targets['tool-'+tool.kind]=n;if(tool.kind==='bomb')this.targets.bomb=n;
    });
  }
  private drawToolEmblem(g:Graphics,kind:string,available:boolean){
    // Original vector facets fill the two regional tools that have no atlas entry.
    if(kind==='prismShift'){
      const polygon=(points:number[][],color:string)=>{g.fillColor=new Color(available?color:'#91afa0');points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.close();g.fill();};
      polygon([[-13,-1],[0,-18],[13,-1],[0,15]],'#234f52');polygon([[-12,1],[0,17],[0,1]],'#f7e3a2');polygon([[0,17],[12,1],[0,1]],'#a7e4d0');polygon([[-12,1],[0,1],[0,-15]],'#58b7ac');polygon([[0,1],[12,1],[0,-15]],'#398e91');
      g.strokeColor=new Color('#fff5cf');g.lineWidth=1;g.moveTo(-12,1);g.lineTo(0,17);g.lineTo(12,1);g.stroke();
    }else if(kind==='tideAnchor'){
      g.strokeColor=new Color(available?'#f0ce81':'#96b3a3');g.lineWidth=3;g.circle(0,11,4);g.stroke();g.moveTo(0,7);g.lineTo(0,-13);g.moveTo(-8,1);g.lineTo(8,1);g.moveTo(-12,-5);g.lineTo(-9,-11);g.lineTo(0,-16);g.lineTo(9,-11);g.lineTo(12,-5);g.stroke();g.strokeColor=new Color('#fff5d3');g.lineWidth=1;g.moveTo(-1,6);g.lineTo(-1,-11);g.stroke();
    }
  }
  private safeInsets(w:number,h:number){
    const portrait=w<h*1.1;let top=portrait?62:12,bottom=portrait?34:21,left=portrait?0:44,right=left;
    if(typeof document!=='undefined'&&document.documentElement&&typeof getComputedStyle==='function'){const css=getComputedStyle(document.documentElement);const read=(name:string)=>parseFloat(css.getPropertyValue(name))||0;top=Math.max(top,read('--safe-top'));bottom=Math.max(bottom,read('--safe-bottom'));left=Math.max(left,read('--safe-left'));right=Math.max(right,read('--safe-right'));}
    // Original WeChat entry used the real safeArea and menu.bottom + 4, not a fixed notch guess.
    // API coordinates are logical window pixels; map them to this Canvas's current layout units.
    const wx=(globalThis as any).wx;let info:any=null,capsule:any=null;
    try{info=wx?.getWindowInfo?.();}catch{}if(!info)try{info=wx?.getSystemInfoSync?.();}catch{}
    const ww=Number(info?.windowWidth)||w,hh=Number(info?.windowHeight)||h,sx=w/ww,sy=h/hh;
    const finite=(x:any)=>typeof x==='number'&&Number.isFinite(x);
    if(ww>0&&hh>0&&Number.isFinite(sx)&&Number.isFinite(sy)){
      const a=info?.safeArea;
      if(a&&[a.top,a.bottom,a.left,a.right].every(finite)&&a.top>=0&&a.bottom>=a.top&&a.bottom<=hh&&a.left>=0&&a.right>=a.left&&a.right<=ww){top=Math.max(top,a.top*sy);bottom=Math.max(bottom,(hh-a.bottom)*sy);left=Math.max(left,a.left*sx);right=Math.max(right,(ww-a.right)*sx);}
      try{const r=wx?.getMenuButtonBoundingClientRect?.();if(r&&[r.top,r.bottom,r.left,r.right].every(finite)&&r.top>=0&&r.bottom>r.top&&r.bottom<hh*.35&&r.left>=0&&r.right>r.left&&r.right<=ww){capsule={top:r.top*sy,bottom:r.bottom*sy,left:r.left*sx,right:r.right*sx};if(portrait)top=Math.max(top,(r.bottom+4)*sy);else right=Math.max(right,(ww-r.left+4)*sx);}}catch{}
    }
    return {top,bottom,left,right,portrait,capsule};
  }
  private layout(){
    const frame=typeof window!=='undefined'?{width:window.innerWidth,height:window.innerHeight}:view.getFrameSize();const w=Math.max(240,frame.width),h=Math.max(320,frame.height);if(!this.managed)view.setDesignResolutionSize(w,h,ResolutionPolicy.EXACT_FIT);if(game.canvas)director.root?.resize(game.canvas.width,game.canvas.height);this.camera.orthoHeight=h/2;this.root.getComponent(UITransform)!.setContentSize(w,h);
    const safe=this.safeInsets(w,h),usableWidth=w-safe.left-safe.right;
    // Keep a continuous board / utility / tool stack. Tall phones gain a scenery band,
    // while short phones reserve the complete footer before choosing their cell size.
    const board=Math.max(98,safe.portrait?Math.min(460,usableWidth-36,h-safe.top-safe.bottom-258):Math.min(460,h-safe.top-safe.bottom-40,usableWidth-272));
    const spare=Math.max(0,h-safe.top-safe.bottom-258-board),boardTop=safe.top+114+spare*.35;
    this.cell=board/7;const y=safe.portrait?h/2-boardTop-board/2:(safe.bottom-safe.top)/2;
    const utilityY=y-board/2-36,toolY=y-board/2-99;
    this.boardCenter.set(safe.portrait?0:(safe.left-safe.right)/2,y,0);this.grid.setPosition(this.boardCenter);this.grid.getComponent(UITransform)!.setContentSize(board,board);
    this.boardFrame.setPosition(this.boardCenter);this.regionalFocus.setPosition(this.boardCenter);this.boardFrame.getComponent(UITransform)!.setContentSize(board+20,board+24);this.paintBoardFrame(board);
    this.cells.forEach((n,i)=>{n.setPosition((i%7-3)*this.cell,(3-Math.floor(i/7))*this.cell);n.getComponent(UITransform)!.setContentSize(this.cell,this.cell);n.children[0].getComponent(UITransform)!.setContentSize(this.cell*.82,this.cell*.82);});
    const hudY=h/2-safe.top-23,title=this.titleLabel.node.parent!,titleWidth=safe.portrait?Math.min(240,usableWidth-124):118;this.hud.setPosition(0,0);
    title.getComponent(UITransform)!.setContentSize(titleWidth,42);this.islandPlate(title.getComponent(Graphics)!,titleWidth,42,'sea');this.titleLabel.node.getComponent(UITransform)!.setContentSize(titleWidth-16,30);this.titleLabel.overflow=Label.Overflow.SHRINK;
    if(safe.portrait){title.setPosition(0,hudY);this.targets.moves.setPosition(w/2-safe.right-36,hudY-55);this.back.setPosition(-w/2+safe.left+28,hudY);this.bagBtn.setPosition(w/2-safe.right-28,hudY);this.pause.setPosition(72,utilityY);this.retryBtn.setPosition(-72,utilityY);this.hintBtn.setPosition(0,utilityY);
      this.utilityRail.setPosition(0,utilityY);this.utilityRail.getComponent(Graphics)!.clear();const g=this.tray.getComponent(Graphics)!;g.clear();g.clear();
    }else{title.setPosition(-w/2+safe.left+64,hudY-6);this.targets.moves.setPosition(w/2-safe.right-54,hudY-3);this.back.setPosition(-w/2+safe.left+36,-h/2+safe.bottom+30);this.bagBtn.setPosition(-w/2+safe.left+94,-h/2+safe.bottom+30);this.pause.setPosition(w/2-safe.right-25,h/2-safe.top-239);this.retryBtn.setPosition(-w/2+safe.left+36,-h/2+safe.bottom+88);this.hintBtn.setPosition(-w/2+safe.left+94,-h/2+safe.bottom+88);
      this.utilityRail.getComponent(Graphics)!.clear();this.tray.getComponent(Graphics)!.clear();
    }
    this.status.node.setPosition(safe.portrait?0:-w/2+safe.left+64,safe.portrait?y+board/2+23:0);this.status.color=new Color('#284f46');this.status.node.getComponent(UITransform)!.setContentSize(safe.portrait?Math.min(board,310):112,28);this.status.overflow=Label.Overflow.SHRINK;this.status.enableWrapText=true;this.status.lineHeight=14;
    for(const panel of [this.bagPanel,this.retryPanel])panel.getComponent(UITransform)!.setContentSize(w,h);this.stagePanel.setPosition(0,y);this.resultPanel.setPosition(0,y);this.layoutInfo={width:w,height:h,safe,board,cell:this.cell,boardCenter:{x:this.boardCenter.x,y},toolY,utilityY,skyReserved:safe.portrait?h/2-safe.top-(y+board/2):h/2-safe.top-board/2};
    this.backgroundFrame?.(safe.portrait,{width:w,height:h,boardTop:h/2-y-board/2});
    this.paint();if(this.snapshot)this.render(this.snapshot);
  }
  private islandPlate(g:Graphics,w:number,h:number,style:'ivory'|'sea',x=0,y=0){
    g.clear();const r=Math.min(18,h*.3),rect=(dx:number,dy:number,ww:number,hh:number,rr:number,color:string)=>{g.fillColor=new Color(color);g.roundRect(x+dx-ww/2,y+dy-hh/2,ww,hh,rr);g.fill();};
    rect(0,-7,w+2,h+2,r+1,'#193d3538');rect(0,-4,w,h,r,'#694a34');rect(0,-1,w,h,r,'#bc9158');rect(0,2,w-3,h-3,r-1,'#ecd298');rect(0,3,w-7,h-7,r-2,style==='sea'?'#397b6d':'#f7edcf');
    g.strokeColor=new Color(style==='sea'?'#79b59b':'#fff9e6');g.lineWidth=1.2;g.roundRect(x-w/2+6,y-h/2+8,w-12,h-12,Math.max(3,r-4));g.stroke();
  }
  private paintBoardFrame(board:number){
    const g=this.boardFrame.getComponent(Graphics)!;this.islandPlate(g,board+20,board+24,'sea');
    g.fillColor=new Color('#254e46');g.roundRect(-board/2-2,-board/2-3,board+4,board+6,10);g.fill();
    // Small brass pegs read as a carved island game tray rather than a flat card.
    for(const x of [-1,1])for(const y of [-1,1]){g.fillColor=new Color('#664b36');g.circle(x*(board/2+4),y*(board/2+5),2.6);g.fill();g.fillColor=new Color('#f8d68a');g.circle(x*(board/2+4)-.5,y*(board/2+5)+.5,1.4);g.fill();}
  }
  private layoutGoals(count:number){const d=this.layoutInfo;if(!d)return;
    if(d.safe.portrait&&d.height<700&&count===1){this.status.node.setPosition(4,d.height/2-d.safe.top-78);this.status.node.getComponent(UITransform)!.setContentSize(d.width-158,28);}
    else if(d.safe.portrait){this.status.node.setPosition(0,d.boardCenter.y+d.board/2+23);this.status.node.getComponent(UITransform)!.setContentSize(Math.min(d.board,310),28);}
    this.goalNodes.forEach((n,i)=>{n.active=i<count;n.setScale(1,1,1);if(d.safe.portrait){const available=d.width-d.safe.left-d.safe.right-86,step=Math.min(64,available/Math.max(1,count));n.setPosition(-d.width/2+d.safe.left+14+step/2+i*step,d.height/2-d.safe.top-78);n.setScale(Math.min(1,step/60),1,1);}else{const paired=count>2;n.setPosition(-d.width/2+d.safe.left+64+(paired?(i%2-.5)*56:0),d.height/2-d.safe.top-76-(paired?Math.floor(i/2):i)*53);if(paired)n.setScale(.9,.9,1);}});
  }
  private measureLayout(){const info=this.layoutInfo;const point=(n:Node)=>({x:n.worldPosition.x+info.width/2,y:info.height/2-n.worldPosition.y});const rect=(n:Node)=>{const p=point(n),t=n.getComponent(UITransform)!;return{x:p.x-t.width/2,y:p.y-t.height/2,width:t.width,height:t.height};};return{...info,spriteReady:this.spriteReady,tiles:this.cells.map(point),targets:Object.fromEntries(Object.entries(this.targets).map(([k,n])=>[k,point(n)])),tileRects:this.cells.map(rect),back:point(this.back),pause:point(this.pause),goalRects:this.goalNodes.filter(n=>n.active).map(rect),controlRects:[this.back,this.pause,...this.tools,this.targets.moves].map(rect),spriteSizes:this.cells.map(n=>{const t=n.children[0].getComponent(UITransform)!;return{width:t.width,height:t.height}}),canvasPixels:game.canvas?{width:game.canvas.width,height:game.canvas.height}:null,renderPixels:this.camera.camera?{width:this.camera.camera.width,height:this.camera.camera.height}:null};}
  private bind(){
    const storage=createSynchronousStorage({getItem:(k:string)=>this.values.get(k)??null,setItem:(k:string,v:string)=>this.values.set(k,v)});
    this.controller=this.managed?this.managed.controller:new Controller({platform:storage,journey:this.journey});
    this.host=(this.managed?this.managed.bind:bindChallengeController)(this.controller,{render:(s:any)=>this.render(s),animate:(_:any,s:any,done:()=>void)=>{
      if(this.disposing||!this.root||!isValid(this.root,true))return;
      const epoch=this.epoch;for(const c of this.cells)tween(c).to(0.08,{scale:new Vec3(.94,.94,1)}).to(.08,{scale:Vec3.ONE}).start();
      this.timer=setTimeout(()=>{this.timer=null;if(epoch===this.epoch)done();},180);
    },cancelAnimations:()=>this.cancelAnimations()});
  }
  private cancelAnimations(){
    // Invalidate delayed completion before any optional presentation work. A parent Node
    // destroys children before this component, so teardown must never repaint those children.
    this.epoch++;if(this.timer!==null)clearTimeout(this.timer);this.timer=null;
    this.cancelToolInput();this.selected=-1;this.dragStart=null;
    for(const c of this.cells){Tween.stopAllByTarget(c);if(!this.disposing&&isValid(c,true))c.setScale(1,1,1);}
    if(!this.disposing)this.paintToolTray();
  }
  private coldReload(){const before=this.controller.snapshot();this.host.dispose();this.bind();return {before:before.state,after:this.controller.snapshot().state};}
  private command(name:string,...args:any[]){this.cancelToolInput();this.paintToolTray();this.selected=-1;this.dragStart=null;const r=this.managed?.intercept?.(name,...args)??this.host.command(name,...args);if(!r.ok)this.status.string='暂不可操作 · '+r.reason;return r;}
  private swap(a:number,b:number){
    if(this.modalOpen()||this.snapshot.state!=='run.ready'||this.snapshot.readOnly)return;
    this.selected=-1;const p=this.host.command('previewAction',['swap',a,b]);
    if(!p.ok){this.status.string='这两格暂时不能交换';this.paint();return;}
    const c=this.host.command('commitAction',p.token);if(!c.ok)this.status.string='行动未提交 · '+c.reason;
  }
  private tap(i:number){if(this.modalOpen()||this.snapshot.state!=='run.ready'||this.snapshot.readOnly)return;if(this.armedTool){this.useToolAt(this.armedTool,i);return;}if(this.selected<0){this.selected=i;this.paint();return;}
    const a=this.selected;if(a===i){if(this.managed&&this.snapshot.active?.board[i]?.special)this.managed.submit(['activate',i]);this.selected=-1;this.paint();return;}
    if(Math.abs(a%7-i%7)+Math.abs(Math.floor(a/7)-Math.floor(i/7))===1)this.swap(a,i);else{this.selected=i;this.paint();}}
  hostPresentation(){return this.snapshot;}
  hostModalOpen(){return this.modalOpen();}
  hostLayout(){return this.layoutInfo;}
  private render(s:any){
    if(this.disposing||!this.root||!isValid(this.root,true))return;
    this.snapshot=s;if(s.visual?.kind)this.frameKinds.add(s.visual.kind);if(!this.managed)(globalThis as any).__forestLiveSnapshot=s;const book=['book.ready','stage.detail'].includes(s.state),result=s.state.startsWith('result.')||s.state==='run.unsaved'||s.state==='error.readonly';this.grid.active=!book&&!result;this.boardFrame.active=!book&&!result;this.regionalFocus.active=!book&&!result&&s.provider==='regional-r05';this.stagePanel.active=book;this.resultPanel.active=result;this.hud.active=!book&&!result;this.pause.active=!book&&!result;this.tray.active=!book&&!result;this.back.active=!book;
    this.moves.string=s.active?String(s.active.moves):'';const goalKeys=s.provider==='mainline-v33'?(s.active?.goalOrder||[]):s.provider==='regional-r05'?Object.keys(s.active?.goals||{}):['beacons','moss','type5'];this.goalKeys=goalKeys;this.layoutGoals(goalKeys.length);if(s.state!=='run.ready'||s.readOnly)this.cancelToolInput();this.paintToolTray();const mainline=s.provider==='mainline-v33';const playing=!book&&!result&&(s.state==='run.ready'||s.state==='run.paused');this.titleLabel.string=s.active?.name?`${String((s.active.level??0)+1).padStart(2,'0')}  ${s.active.name}`:'';this.titleLabel.node.parent!.active=!!s.active&&!book&&!result;this.bagBtn.active=mainline&&!!s.journey?.inventory&&!book;this.retryBtn.active=playing&&typeof this.managed?.restart==='function';this.hintBtn.active=playing&&((s.provider==='regional-r05'&&!!s.active?.guide)||(s.state==='run.ready'&&typeof this.managed?.hint==='function'));this.drawIcon(this.hintBtn,s.provider==='regional-r05'?'guide':'hint',true);if(!playing)this.hintCells=[];this.goalLabels.forEach((l,i)=>l.string=String(s.active?.goals[goalKeys[i]]??0));this.status.string=s.uiStatus||'';this.status.node.active=!result;this.drawIcon(this.pause,s.state==='run.paused'?'play':'pause',true);this.paint();
    if(book){this.clearChildren(this.stagePanel);this.targets={moves:this.targets.moves};const stages=s.stages.filter((x:any)=>x.region==='tide').slice(0,3);stages.forEach((x:any,i:number)=>{const n=this.button(this.stagePanel,`${x.ordinal}  ${x.name}${x.record?'  \u2713':!x.unlocked?'  \u00b7':''}`,0,70-i*62,Math.min(290,this.layoutInfo.width-40),48,()=>{if(this.snapshot.active){this.status.string='\u8bf7\u5148\u7ee7\u7eed\u5f53\u524d\u65c5\u7a0b';return;}if(!this.command('selectStage',x.id).ok)return;this.command('startStage',x.id,{seed:x.id===this.fixture.stageId?this.fixture.seed:undefined,attemptId:'native-ui-'+(++this.attempt)});});this.targets['stage'+i]=n;});if(s.active)this.targets.resume=this.button(this.stagePanel,'\u7ee7\u7eed',0,-135,150,44,()=>this.command('resumeActive'));}
    if(result)this.paintResult(s);this.positionResultUtilityControls(result);
  }
  private clearChildren(n:Node){for(const child of [...n.children]){child.removeFromParent();child.destroy();}}
  private paint(){if(this.disposing||!this.root||!isValid(this.root,true)||!this.snapshot?.active)return;this.goalNodes.forEach((n,i)=>{const icon=n.getChildByName('Icon')!,art=icon.getChildByName('GoalPieceArt')!,sprite=art.getComponent(Sprite)!,key=this.goalKeys[i]||'';const piece=/^type[0-5]$/.test(key);art.active=piece;if(piece){icon.getComponent(Graphics)!.clear();sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=this.frames[Number(key.slice(4))]||null;}else this.drawIcon(icon,({beacons:'lamp',type5:'shell',roots:'roots',moss:'moss',pearls:'pearls',blooms:'blooms',relays:'relays'} as any)[key]||key);});this.cells.forEach((n,i)=>{const g=n.getComponent(Graphics)!;g.clear();const half=this.cell*.445,radius=Math.min(9,this.cell*.17),selected=this.selected===i;
      g.fillColor=new Color('#173a3466');g.roundRect(-half-1,-half-3,half*2+2,half*2+1,radius);g.fill();g.fillColor=new Color(selected?'#cfa04c':'#b4b996');g.roundRect(-half,-half-1,half*2,half*2,radius);g.fill();g.fillColor=new Color(selected?'#ffe6a1':'#f2efd8');g.roundRect(-half,-half+2,half*2,half*2-2,radius);g.fill();g.strokeColor=new Color(selected?'#fff6cf':'#fffcdf');g.lineWidth=1;g.roundRect(-half+1,-half+3,half*2-2,half*2-4,Math.max(3,radius-1));g.stroke();const tile=this.snapshot.active.board[i],sprite=n.children[0].getComponent(Sprite)!;const marks=n.children[1].getComponent(Graphics)!;marks.clear();sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=tile?this.frames[tile.type%6]||null:null;n.children[0].getComponent(UITransform)!.setContentSize(this.cell*.82,this.cell*.82);
      if(this.snapshot.active.moss.includes(i)){marks.fillColor=new Color('#568b5d');marks.circle(half-5,-half+5,3);marks.fill();}if(this.snapshot.active.roots.some((r:any)=>Array.isArray(r)?r[0]===i:r===i)||this.snapshot.active.beaconTarget?.index===i){marks.strokeColor=new Color(this.snapshot.active.beaconTarget?.index===i?'#ffe59c':'#896e4b');marks.lineWidth=2;marks.roundRect(-half,-half,half*2,half*2,8);marks.stroke();}if(tile?.special){marks.strokeColor=new Color('#fff1b4');marks.lineWidth=2;marks.circle(0,0,this.cell*.37);marks.stroke();}
      if(selected){marks.strokeColor=new Color('#ffda76');marks.lineWidth=2.5;marks.roundRect(-half-1,-half-1,half*2+2,half*2+2,radius);marks.stroke();}
      if(this.hintCells.includes(i)){marks.strokeColor=new Color('#d4a017');marks.lineWidth=3;marks.roundRect(-half+2,-half+2,half*2-4,half*2-4,8);marks.stroke();}
    });if(this.managed)this.managed.afterPaint(this.snapshot,this.cells);this.paintRegionalFocus();}
  private paintRegionalFocus(){
    const s=this.snapshot,a=s?.active,g=this.regionalFocus.getComponent(Graphics)!;g.clear();if(s?.provider!=='regional-r05')return;
    const pieces=a.regionPieces||[],current=pieces.find((p:any)=>!p.done),p=pieces.find((p:any)=>p.index===this.selected)||current;
    // The guide belongs to the rule provider. Only consume its settled instructions;
    // animation geometry continues to follow piecesAfter, never a future guide snapshot.
    const stable=s.state==='run.ready'||s.state==='run.paused',target=stable?a.guide?.targets?.find((t:any)=>t.cell.index===this.selected):null;
    if(target&&!this.armedTool&&!this.toolDrag)this.status.string=target.instruction;
    if(a.region!=='sky'||!p||p.done||!Number.isInteger(p.partner)||p.partner<0||p.partner>48)return;
    const point=(i:number)=>({x:(i%7-3)*this.cell,y:(3-Math.floor(i/7))*this.cell}),from=point(p.index),to=point(p.partner),length=Math.hypot(to.x-from.x,to.y-from.y),segments=Math.max(1,Math.ceil(length/10));
    g.strokeColor=new Color('#f4c764bb');g.lineWidth=2;
    for(let i=0;i<segments;i++){const start=i/segments,end=Math.min(1,(i+.55)/segments);g.moveTo(from.x+(to.x-from.x)*start,from.y+(to.y-from.y)*start);g.lineTo(from.x+(to.x-from.x)*end,from.y+(to.y-from.y)*end);g.stroke();}
    g.strokeColor=new Color('#ffe08a');g.lineWidth=2.5;g.circle(from.x,from.y,this.cell*.43);g.stroke();g.strokeColor=new Color('#6ad0c1');g.circle(to.x,to.y,this.cell*.38);g.stroke();
  }
  private box(name:string,parent:Node,x:number,y:number,w:number,h:number){const n=new Node(name);n.layer=Layers.Enum.UI_2D;parent.addChild(n);n.setPosition(x,y);n.addComponent(UITransform).setContentSize(w,h);return n;}
  private text(parent:Node,value:string,x:number,y:number,size:number,width:number,color='#fff9e4'){const n=this.box('Text',parent,x,y,width,size+12);const l=n.addComponent(Label);l.string=value;l.fontSize=size;l.lineHeight=size+4;l.color=new Color(color);l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;return l;}
  private button(parent:Node,value:string,x:number,y:number,w:number,h:number,fn:()=>void,ivory=false){const n=this.box(value,parent,x,y,w,h);const surface=warmButton(n,w,h,ivory);const label=this.text(n,value,0,0,18,w-10,ivory?'#355f53':'#fff4d6');surface.addContent(label.node);surface.bind(fn);return n;}
  private iconButton(type:string,parent:Node,fn:()=>void){const n=this.box(type,parent,0,0,46,46);this.drawIcon(n,type,true);n.getComponent(WarmButton)!.bind(()=>{if(this.modalOpen())return false;fn();});return n;}
  private drawIcon(n:Node,type:string,bg=false){const ivory=type==='back'||type==='bag'||type==='retry'||type==='hint'||type==='guide'||type==='pause'||type==='play';const g=bg?(['retry','hint','guide','pause','play'].includes(type)?tactileToolGraphics(n):warmButtonGraphics(n,46,46,ivory)):(n.getComponent(Graphics)||n.addComponent(Graphics));if(!bg)g.clear();g.strokeColor=new Color(bg&&!ivory?'#fff2cf':type==='slot'?'#d8e4d288':'#6a5432');g.fillColor=new Color(bg&&!ivory?'#fff2cf':'#c4a15a');g.lineWidth=2;
    if(type==='back'){g.moveTo(5,9);g.lineTo(-5,0);g.lineTo(5,-9);g.stroke();}
    else if(type==='bag'){g.roundRect(-8,-6,16,12,3);g.stroke();g.moveTo(-4,-6);g.lineTo(-2,-10);g.lineTo(4,-10);g.lineTo(6,-6);g.stroke();}
    else if(type==='retry'){g.arc(0,1,8,0.4,5.4,false);g.stroke();g.moveTo(6,8);g.lineTo(8,2);g.lineTo(2,3);g.stroke();}
    else if(type==='guide'){g.roundRect(-10,-8,20,17,3);g.stroke();g.moveTo(0,-7);g.lineTo(0,8);g.moveTo(-7,3);g.lineTo(-3,3);g.moveTo(3,3);g.lineTo(7,3);g.stroke();}
    else if(type==='hint'){g.circle(-1,1,7);g.stroke();g.moveTo(4,-4);g.lineTo(10,-10);g.stroke();}
    else if(type==='starlight'){g.moveTo(0,10);g.lineTo(3,3);g.lineTo(10,2);g.lineTo(4,-2);g.lineTo(6,-10);g.lineTo(0,-5);g.lineTo(-6,-10);g.lineTo(-4,-2);g.lineTo(-10,2);g.lineTo(-3,3);g.close();g.fill();}
    else if(type==='pause'){g.rect(-7,-8,4,16);g.rect(3,-8,4,16);g.fill();}
    else if(type==='play'){g.moveTo(-5,-9);g.lineTo(8,0);g.lineTo(-5,9);g.close();g.fill();}
    else if(type==='lamp'){g.roundRect(-7,-8,14,16,3);g.stroke();g.moveTo(-10,10);g.lineTo(10,10);g.moveTo(-9,-11);g.lineTo(9,-11);g.stroke();g.circle(0,0,3);g.fill();}
    else if(type==='moss'){for(const [x,y]of [[-6,-3],[0,4],[6,-3]]){g.circle(x,y,4);g.stroke();}}
    else if(type==='shell'){g.arc(0,2,9,Math.PI,2*Math.PI);g.lineTo(0,9);g.close();g.stroke();g.moveTo(0,9);g.lineTo(-5,-3);g.moveTo(0,9);g.lineTo(5,-3);g.stroke();}
    else if(type==='roots'){g.moveTo(0,9);g.lineTo(0,-8);g.moveTo(0,2);g.lineTo(-8,-5);g.moveTo(0,-2);g.lineTo(8,-8);g.stroke();}
    else if(type==='pearls'){g.circle(0,0,8);g.stroke();g.circle(-2,3,2);g.fill();}
    else if(type==='blooms'){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;g.circle(Math.cos(a)*6,Math.sin(a)*6,3);g.stroke();}g.circle(0,0,2);g.fill();}
    else if(type==='relays'){g.moveTo(-9,0);g.lineTo(9,0);g.moveTo(5,4);g.lineTo(9,0);g.lineTo(5,-4);g.moveTo(-5,4);g.lineTo(-9,0);g.lineTo(-5,-4);g.stroke();}
    else if(type==='bomb'){g.circle(0,-2,8);g.stroke();g.moveTo(3,6);g.lineTo(7,12);g.stroke();}
    else if(type==='lines'){g.moveTo(-9,-6);g.lineTo(9,-6);g.moveTo(-9,0);g.lineTo(9,0);g.moveTo(-9,6);g.lineTo(9,6);g.stroke();}
    else if(type==='specials'){g.moveTo(0,10);g.lineTo(3,3);g.lineTo(10,0);g.lineTo(3,-3);g.lineTo(0,-10);g.lineTo(-3,-3);g.lineTo(-10,0);g.lineTo(-3,3);g.close();g.stroke();}
    else if(type==='steps'){g.ellipse(-4,3,3,6);g.ellipse(4,-3,3,6);g.fill();}
    else{g.circle(0,0,9);g.stroke();g.moveTo(-4,0);g.lineTo(4,0);g.stroke();}
  }
  private labeledIcon(type:string,label:string,fn:()=>void){const n=this.iconButton(type,this.root,fn);const caption=this.text(n,label,0,-30,12,52,'#fff4d6');caption.node.active=false;return n;}
  private modalOpen(){return this.bagOpen||!!this.retryPanel?.active;}
  private showHint(){
    if(this.snapshot?.active?.guide){this.showRuleGuide();return;}
    const hint=this.managed?.hint?.();this.hintCells=Array.isArray(hint?.cells)?hint.cells.slice():[];
    this.status.string=!this.hintCells.length?'这一步没有可提示的走法':this.hintCells.length===2?'试试交换高亮的两格':'试试启动高亮的特殊果实';
    this.paint();
  }
  private showRuleGuide(){
    const guide=this.snapshot?.active?.guide;if(!guide||this.modalOpen())return;
    this.bagOpen=true;this.bagPanel.active=true;this.bagPanel.setSiblingIndex(this.root.children.length-1);this.cancelToolInput();this.dragStart=null;this.paintToolTray();this.clearChildren(this.bagPanel);
    const d=this.layoutInfo,w=Math.min(d.safe.portrait?340:520,d.width-d.safe.left-d.safe.right-32),h=Math.min(420,d.height-d.safe.top-d.safe.bottom-20);
    const plate=this.box('RegionalRuleGuide',this.bagPanel,0,(d.safe.bottom-d.safe.top)/2,w,h);this.islandPlate(plate.addComponent(Graphics)!,w,h,'ivory');
    this.text(plate,guide.title,0,h/2-29,18,w-28,'#315e50');this.text(plate,guide.phaseLabel+(guide.heldTurns?' · 固定 '+guide.heldTurns+' 次行动':''),0,h/2-55,13,w-28,'#876334');
    const body=this.text(plate,[guide.rule,guide.tool?.description].filter(Boolean).join('\n\n'),0,-4,14,w-36,'#355c51');body.lineHeight=20;body.enableWrapText=true;body.overflow=Label.Overflow.SHRINK;body.node.getComponent(UITransform)!.setContentSize(w-36,h-144);
    this.button(plate,'明白了',0,-h/2+30,140,44,()=>{this.bagOpen=false;this.bagPanel.active=false;});
  }
  private askRestart(){if(this.modalOpen()||typeof this.managed?.restart!=='function')return;this.retryPanel.active=true;this.retryPanel.setSiblingIndex(this.root.children.length-1);this.selected=-1;this.dragStart=null;this.cancelToolInput();this.paintToolTray();this.clearChildren(this.retryPanel);const d=this.layoutInfo,w=Math.min(280,d.width-40);const plate=this.box('plate',this.retryPanel,0,0,w,150);const g=plate.addComponent(Graphics);g.fillColor=new Color('#f6edd4');g.roundRect(-w/2,-75,w,150,16);g.fill();g.strokeColor=new Color('#c4a15a');g.lineWidth=2;g.roundRect(-w/2,-75,w,150,16);g.stroke();this.text(plate,'要重开这一关吗？当前这局会丢掉。',0,36,16,w-24,'#426750');this.button(plate,'重来',-70,-28,120,44,()=>{if(!this.retryPanel.active)return;this.retryPanel.active=false;const r=this.managed.restart();if(!r?.ok)this.status.string=r?.reason||'暂时不能重来';});this.button(plate,'留下',70,-28,120,44,()=>{if(!this.retryPanel.active)return;this.retryPanel.active=false;});}
  private toggleBag(){
    const bag=this.snapshot?.journey;if(!bag?.inventory){this.status.string='这一关没有行囊';return;}
    this.bagOpen=!this.bagOpen;this.bagPanel.active=this.bagOpen;if(!this.bagOpen)return;
    this.bagPanel.setSiblingIndex(this.root.children.length-1);this.bagPage=0;this.selected=-1;this.dragStart=null;this.cancelToolInput();this.paintToolTray();this.paintBag();
  }
  private paintBag(){
    const bag=this.snapshot?.journey;if(!bag?.inventory)return;
    this.clearChildren(this.bagPanel);const d=this.layoutInfo,w=Math.min(320,d.width-24),h=Math.min(420,d.height-80);
    const plate=this.box('plate',this.bagPanel,0,0,w,h);const g=plate.addComponent(Graphics);g.fillColor=new Color('#f6edd4');g.roundRect(-w/2,-h/2,w,h,18);g.fill();g.strokeColor=new Color('#c4a15a');g.lineWidth=2;g.roundRect(-w/2,-h/2,w,h,18);g.stroke();this.text(plate,'旅人的行囊',0,h/2-28,20,w-20,'#365b54');
    const tools=bag.inventory.tools||{},names:any={windBell:'风语铃',tideBottle:'潮汐瓶',tideNet:'潮汐网',sunSeed:'日光籽',starShears:'星剪'};
    const items=Object.keys(tools).map(id=>`${names[id]||id} ${tools[id]}`);
    this.text(plate,items.slice(0,3).join(' · '),0,h/2-60,13,w-20,'#426750');
    this.text(plate,items.slice(3).join(' · '),0,h/2-80,13,w-20,'#426750');
    const charms:string[]=bag.inventory.charms||[];this.text(plate,charms.length?`装扮 ${charms.length} 件`:'还没有装扮',0,h/2-102,13,w-20,'#426750');
    const chests:any[]=(bag.chests||[]).filter((c:any)=>c.earned);
    const capacity=Math.max(1,Math.min(4,1+Math.floor((h-240)/46))),pages=Math.max(1,Math.ceil(chests.length/capacity));
    this.bagPage=Math.max(0,Math.min(this.bagPage,pages-1));
    chests.slice(this.bagPage*capacity,(this.bagPage+1)*capacity).forEach((c,i)=>{
      this.button(plate,c.opened?`第${c.level+1}关宝箱已打开`:`打开第${c.level+1}关宝箱`,0,h/2-134-i*46,Math.min(240,w-40),40,()=>{
        if(c.opened){this.status.string='这个宝箱已经打开';return;}
        const r=this.command('openChest',c.level);if(!r?.ok)this.status.string=r?.reason||'现在还不能打开';else{this.bagOpen=false;this.bagPanel.active=false;}
      });
    });
    const pageY=-h/2+64;this.text(plate,`${this.bagPage+1} / ${pages}`,0,pageY,13,70,'#426750');
    if(this.bagPage>0)this.button(plate,'上一页',-90,pageY,76,30,()=>{this.bagPage--;this.paintBag();});
    if(this.bagPage+1<pages)this.button(plate,'下一页',90,pageY,76,30,()=>{this.bagPage++;this.paintBag();});
    this.button(plate,'关上',0,-h/2+26,120,36,()=>{this.bagOpen=false;this.bagPanel.active=false;});
  }
  private positionResultUtilityControls(result:boolean){const d=this.layoutInfo,s=d.safe;
    if(result&&!s.portrait){const layout=resultLayout(d,resultActionCount(this.snapshot)),x=layout.actions[0]?.x??(-d.width/2+s.left+31);this.back.setPosition(x,-d.height/2+s.bottom+31);this.bagBtn.setPosition(x,d.height/2-s.top-31);}
    else if(s.portrait){const y=d.height/2-s.top-23;this.back.setPosition(-d.width/2+s.left+28,y);this.bagBtn.setPosition(d.width/2-s.right-28,y);}
    else{this.back.setPosition(-d.width/2+s.left+36,-d.height/2+s.bottom+30);this.bagBtn.setPosition(-d.width/2+s.left+94,-d.height/2+s.bottom+30);}
  }
  private paintResult(s:any){const chestKey=s.provider+'/'+(s.active?.stageId??s.active?.level??'none');let priorChest=this.resultPanel.getChildByName('ResultPage')?.getChildByName('Chest')??null;if(priorChest?.getComponent(ResultChestView)?.resultKey===chestKey)priorChest.removeFromParent();else priorChest=null;delete this.targets.resultBack;delete this.targets.retry;delete this.targets.replay;this.clearChildren(this.resultPanel);const d=this.layoutInfo,layout=resultLayout(d,resultActionCount(s)),w=layout.width,h=layout.height;d.resultViewportSupported=layout.supportedViewport;const plate=this.box('ResultPage',this.resultPanel,layout.panelX,layout.panelY-d.boardCenter.y,w,h);const bg=plate.addComponent(Graphics);this.islandPlate(bg,w,h,'ivory');
    const won=s.active?.status==='won',stars=typeof s.result?.stars==='number'?s.result.stars:null,compact=h<350;
    const retry=s.state==='result.unsaved'||s.state==='run.unsaved',replay=!retry&&s.provider==='mainline-v33'&&s.active?.status==='lost'&&s.state==='result.saved';
    const titleY=h/2-(compact?24:29),scoreY=compact?titleY:titleY-35,starsY=compact?titleY-33:scoreY-32;
    this.text(plate,won?'过关了':retry?'还没存上':'再走一次',compact?-w/4:0,titleY,compact?20:22,compact?w/2-16:w-20,'#365b54');this.text(plate,`${s.active?.score||0} 分`,compact?w/4:0,scoreY,compact?18:20,compact?w/2-16:w-20,'#426750');
    if(stars!==null){const row=this.box('Stars',plate,0,starsY,140,28);const sg=row.addComponent(Graphics);for(let i=0;i<3;i++){const x=(i-1)*36;sg.fillColor=new Color(i<stars?'#e2b657':'#d9d0bc');sg.moveTo(x,10);sg.lineTo(x+4,3);sg.lineTo(x+12,2);sg.lineTo(x+6,-3);sg.lineTo(x+8,-12);sg.lineTo(x,-6);sg.lineTo(x-8,-12);sg.lineTo(x-6,-3);sg.lineTo(x-12,2);sg.lineTo(x-4,3);sg.close();sg.fill();}}
    // Reserve the complete bounded chest surface, including the opened lid and glow.
    // Reserve action/caption rows first, then fit the chest between them and the stars.
    const paired=compact&&(retry||replay),actionWidth=paired?Math.min(130,(w-28)/2):130;
    const backY=-h/2+30,secondaryY=backY+(paired?0:48),actionTop=(retry||replay)&&!paired?secondaryY+20:backY+21;
    const captionHeight=s.state==='error.readonly'?34:30,captionY=actionTop+6+captionHeight/2,captionText=s.state==='error.readonly'?[s.uiStatus,s.uiResultCaption].filter(Boolean).join('\n'):s.uiResultCaption;
    if(captionText){const caption=this.text(plate,captionText,0,captionY,13,w-24,'#5e7559');caption.node.getComponent(UITransform)!.setContentSize(w-24,captionHeight);caption.overflow=Label.Overflow.SHRINK;caption.enableWrapText=true;}
    const chest=s.provider==='mainline-v33'?s.journey?.chests?.find((x:any)=>x.level===s.active?.level):null;
    if(chest?.earned){const upper=(stars!==null?(compact?starsY-14:starsY-18):scoreY-(compact?15:16))-(compact?6:8),lower=(captionText?captionY+captionHeight/2:actionTop)+(compact?6:8);const scale=Math.min(1.3,Math.max(0,(upper-lower)/RESULT_CHEST_SIZE));if(scale>0){const cy=(upper+lower)/2;for(const [radius,color]of [[.48,'#e2bb5922'],[.39,'#ffe6a544'],[.3,'#fff4c966']] as [number,string][]){bg.fillColor=new Color(color);bg.circle(0,cy,RESULT_CHEST_SIZE*scale*radius);bg.fill();}const chestNode=this.drawChest(plate,0,(upper+lower)/2,chest.opened?1:0,priorChest);priorChest=null;chestNode.getComponent(ResultChestView)!.resultKey=chestKey;chestNode.setScale(scale,scale,1);}}
    if(priorChest)priorChest.destroy();
    this.targets.resultBack=this.button(plate,'返回海岛',paired?-(actionWidth+10)/2:0,backY,actionWidth,42,()=>this.command('requestExit'),true);
    if(retry)this.targets.retry=this.button(plate,'重试保存',paired?(actionWidth+10)/2:0,secondaryY,paired?actionWidth:150,40,()=>this.command('retrySave'));
    else if(replay)this.targets.replay=this.button(plate,'再试一次',paired?(actionWidth+10)/2:0,secondaryY,paired?actionWidth:150,40,()=>this.command('startStage',s.active.stageId,{}));
  }
  private drawChest(parent:Node,x:number,y:number,open:number,previous:Node|null=null){const n=previous||this.box('Chest',parent,x,y,RESULT_CHEST_SIZE,RESULT_CHEST_SIZE);if(previous){parent.addChild(n);n.setPosition(x,y,0);n.getComponent(ResultChestView)!.setOpen(open);}else n.addComponent(ResultChestView).initialize(open);return n;}
  onDestroy(){
    if(this.disposing)return;this.disposing=true;
    this.cancelAnimations();this.backgroundFrame=undefined;this.backgroundStatus=undefined;
    game.off(Game.EVENT_HIDE,this.hide);game.off(Game.EVENT_SHOW,this.show);view.off('canvas-resize',this.resize,this);if(typeof window!=='undefined')window.removeEventListener('resize',this.resize);
    // dispose() can synchronously call cancelAnimations/render again through the host binder.
    try{this.host?.dispose();}finally{this.releasePieceArt();if(!this.managed)delete (globalThis as any).__nativeBoard;}
  }
}
