import { ManagedToolArt } from './ManagedToolArt';
import { managedTools, type ManagedTool } from './world-r2/ManagedTools';
import { ResultChestView } from './ResultChestView';
import { RESULT_CHEST_SIZE } from './ResultChestResource';
import { resultLayout, resultActionCount } from './ResultLayout';
import { _decorator, Component, BlockInputEvents, Node, Canvas, Camera, Layers, UITransform, Graphics, Color, Label, Vec3, EventTouch, game, Game, view, ResolutionPolicy, tween, Tween, profiler, resources, ImageAsset, Texture2D, SpriteFrame, Sprite, Rect, director, isValid } from 'cc';
import type { LevelBackgroundStatus, LevelBackgroundFrame } from './world-r2/LevelBackground';
import { WarmButton, warmButton, warmButtonGraphics } from './WarmButton';
import Controller from './r4-cloud-compat/runtime/challenge-controller.js';
import Port from './r4-cloud-compat/adapter/cocos-port.js';
const { ccclass } = _decorator;
const { createSynchronousStorage, bindChallengeController } = Port;
@ccclass('ManagedMobileBoardUI')
export class ManagedMobileBoardUI extends Component {
  private managed:any=null;private frameKinds=new Set<string>();
  initializeManaged(fixture:any,binding:any,backgroundFrame?: (portrait:boolean,layout?:LevelBackgroundFrame)=>void,backgroundStatus?:()=>LevelBackgroundStatus){if(this.managed||this.root)throw Error('Already initialized');this.managed=binding;this.backgroundStatus=backgroundStatus;this.initialize(fixture,backgroundFrame);}
  managedViewVersion(){return 'mobile-managed-v1';}
  diagnostics(){return {background:this.backgroundStatus?.()??{state:'missing-provider'},snapshot:this.controller.snapshot(),checkpoint:this.controller.session?.checkpoint()||null,presentation:this.snapshot,layout:this.measureLayout(),storage:this.managed?.storageEntries?.()||[],frameKinds:Array.from(this.frameKinds),goalSemantics:this.goalKeys.map((key,i)=>({key,value:this.goalLabels[i]?.string,icon:key}))};}
  lateEnd(index:number){this.cells[index]?.emit(Node.EventType.TOUCH_END);}

  private backgroundStatus?:()=>LevelBackgroundStatus;
  private root!:Node; private grid!:Node; private stagePanel!:Node; private resultPanel!:Node; private camera!:Camera;
  private hud!:Node; private tray!:Node; private status!:Label; private moves!:Label;
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
  private resize=()=>{if(this.root&&isValid(this.root,true))this.layout();};
  initialize(fixture:any,backgroundFrame?: (portrait:boolean,layout?:LevelBackgroundFrame)=>void){
    this.fixture=fixture;this.backgroundFrame=backgroundFrame;if(!this.managed)profiler.hideStats();view.resizeWithBrowserSize(true);
    this.root=this.box('NativeBoardCanvas',this.node,0,0,1,1);
    const canvas=this.root.addComponent(Canvas);canvas.alignCanvasWithScreen=false;
    const cameraNode=new Node('NativeUICamera');cameraNode.layer=Layers.Enum.UI_2D;this.node.addChild(cameraNode);cameraNode.setPosition(0,0,1000);
    this.camera=cameraNode.addComponent(Camera);this.camera.projection=Camera.ProjectionType.ORTHO;this.camera.near=.1;this.camera.far=2000;this.camera.priority=50;this.camera.visibility=Layers.Enum.UI_2D;this.camera.clearFlags=Camera.ClearFlag.DEPTH_ONLY;canvas.cameraComponent=this.camera;
    this.hud=this.box('LightGoalHUD',this.root,0,0,1,1);this.tray=this.box('CompactToolTray',this.root,0,0,1,1);
    this.grid=this.box('CenteredNativeGrid',this.root,0,0,1,1);
    for(let i=0;i<49;i++){
      const n=this.box('Tile-'+i,this.grid,0,0,50,50);n.addComponent(Graphics);
      const art=this.box('ProjectPieceArt',n,0,0,42,42);art.addComponent(Sprite);this.box('GoalMarkers',n,0,0,50,50).addComponent(Graphics);
      n.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{if(this.modalOpen()||this.snapshot?.state!=='run.ready'||this.snapshot?.readOnly)return;this.dragStart={index:i,point:e.getLocation()};},this);
      n.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{const d=this.dragStart;if(!d||d.consumed||d.index!==i)return;const p=e.getLocation(),dx=p.x-d.point.x,dy=p.y-d.point.y;if(Math.max(Math.abs(dx),Math.abs(dy))<Math.min(18,this.cell*.35))return;d.consumed=true;if(this.armedTool)return;const j=i+(Math.abs(dx)>Math.abs(dy)?(dx>0?1:-1):(dy>0?-7:7));if(j>=0&&j<49&&Math.abs(i%7-j%7)+Math.abs(Math.floor(i/7)-Math.floor(j/7))===1)this.swap(i,j);},this);
      n.on(Node.EventType.TOUCH_END,()=>{const d=this.dragStart;this.dragStart=null;if(d&&d.index===i&&!d.consumed)this.tap(i);},this);
      n.on(Node.EventType.TOUCH_CANCEL,()=>{this.dragStart=null;this.cancelToolInput();this.paintToolTray();this.paint();},this);this.cells.push(n);
    }
    for(let i=0;i<4;i++){
      const n=this.box('Goal-'+i,this.hud,0,0,58,40);const badge=n.addComponent(Graphics);badge.fillColor=new Color('#f6edd4');badge.roundRect(-29,-20,58,40,16);badge.fill();badge.strokeColor=new Color('#c4a15a');badge.lineWidth=2;badge.roundRect(-29,-20,58,40,16);badge.stroke();const icon=this.box('Icon',n,-14,0,24,24);this.drawIcon(icon,['lamp','moss','shell'][i]);const ga=this.box('GoalPieceArt',icon,0,0,22,22);ga.addComponent(Sprite);this.goalLabels.push(this.text(n,'',14,0,16,24,'#426750'));this.goalNodes.push(n);
    }
    const steps=this.box('Moves',this.hud,0,0,58,42);const stepBadge=steps.addComponent(Graphics);stepBadge.fillColor=new Color('#f6edd4');stepBadge.roundRect(-29,-21,58,42,16);stepBadge.fill();stepBadge.strokeColor=new Color('#c4a15a');stepBadge.lineWidth=2;stepBadge.roundRect(-29,-21,58,42,16);stepBadge.stroke();this.drawIcon(this.box('Footstep',steps,-16,0,22,24),'steps');this.moves=this.text(steps,'',13,0,21,30,'#426750');this.targets.moves=steps;
    this.back=this.iconButton('back',this.root,()=>this.command('requestExit'));this.pause=this.iconButton('pause',this.root,()=>this.command(this.snapshot.state==='run.paused'?'resume':'pause'));
    const title=this.box('LevelTitle',this.hud,0,0,220,36);const tg=title.addComponent(Graphics);tg.fillColor=new Color('#f6edd4');tg.roundRect(-110,-18,220,36,14);tg.fill();tg.strokeColor=new Color('#c4a15a');tg.lineWidth=2;tg.roundRect(-110,-18,220,36,14);tg.stroke();this.titleLabel=this.text(title,'',0,0,18,200,'#426750');
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
      if(!isValid(this,true)||!isValid(this.node,true))return;
      if(error||!asset){console.error('Project piece atlas failed',error);return;}
      const frames:SpriteFrame[]=[];let texture:Texture2D|null=null;asset.addRef();
      try{texture=new Texture2D();texture.image=asset;for(let i=0;i<6;i++){const frame=new SpriteFrame();frames.push(frame);frame.texture=texture;frame.rect=new Rect(i%3*320,Math.floor(i/3)*320,320,320);}}
      catch(error){for(const frame of frames)frame.destroy();texture?.destroy();asset.decRef();console.error('Project piece atlas setup failed',error);return;}
      this.releasePieceArt();this.pieceImage=asset;this.pieceTexture=texture;this.frames=frames;this.spriteReady=true;this.paint();
    });
  }
  private releasePieceArt(){
    if(this.root&&isValid(this.root,true))for(const sprite of this.root.getComponentsInChildren(Sprite))if(sprite.spriteFrame&&this.frames.includes(sprite.spriteFrame))sprite.spriteFrame=null;
    for(const frame of this.frames)frame.destroy();this.frames=[];this.pieceTexture?.destroy();this.pieceTexture=null;this.pieceImage?.decRef();this.pieceImage=null;this.spriteReady=false;
  }
  private toolArt!:ManagedToolArt;private armedTool:string|null=null;private toolTapAccepted=false;
  private toolDrag:{kind:string,slot:number,pointer:number,start:{x:number,y:number},moved:boolean,version:string}|null=null;private toolGhost:Node|null=null;
  private toolCatalog():ManagedTool[]{return this.managed?.tools?.()||managedTools(this.snapshot);}
  private toolVersion(){const a=this.snapshot?.active;return `${a?.attemptId||a?.stageId}:${a?.actions?.length??a?.turn??0}:${a?.version??0}`;}
  private canUseTools(){return !this.modalOpen()&&this.snapshot?.state==='run.ready'&&!this.snapshot?.readOnly;}
  private cancelToolInput(){this.toolDrag=null;this.armedTool=null;this.toolTapAccepted=false;if(this.toolGhost)this.toolGhost.active=false;this.selected=-1;}
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
  private moveGhost(x:number,y:number){const d=this.layoutInfo;if(!this.toolGhost){this.toolGhost=this.box('ToolDragGhost',this.root,0,0,48,48);this.toolGhost.addComponent(Sprite);}
    const sprite=this.toolGhost.getComponent(Sprite)!;sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=this.toolArt.frame(this.toolDrag!.kind);
    this.toolGhost.active=true;this.toolGhost.setWorldPosition(x-d.width/2,y-d.height/2+28,0);}
  private endToolDrag(e:EventTouch,slot?:number){const d=this.toolDrag;if(!d||d.pointer!==e.getID()||(slot!==undefined&&slot!==d.slot))return;this.toolDrag=null;this.toolTapAccepted=false;if(this.toolGhost)this.toolGhost.active=false;
    if(!this.canUseTools()||d.version!==this.toolVersion()){this.cancelToolInput();this.paintToolTray();this.paint();return;}
    const p=e.getUILocation(),moved=d.moved||Math.hypot(p.x-d.start.x,p.y-d.start.y)>=12;
    if(!moved){if(this.tools[d.slot].getComponent(UITransform)!.hitTest(e.getLocation(),e.windowId))this.toolTapAccepted=this.tapTool(d.slot);return;}
    const i=this.cellAt(p.x,p.y);this.armedTool=null;this.selected=-1;this.paintToolTray();this.paint();
    if(i<0){this.status.string='已收回，道具没有消耗';return;}this.useToolAt(d.kind,i);
  }
  private toolSlot(slot:number){const n=this.box('slot-'+slot,this.tray,0,0,46,46),surface=warmButton(n,46,46);
    const art=this.box('OriginalToolArt',n,0,1,40,40);art.addComponent(Sprite);surface.addContent(art);
    const label=this.text(n,'',0,-28,11,54,'#6a5432');label.node.name='ToolLabel';
    const selected=this.box('ToolSelection',n,0,0,46,46);selected.addComponent(Graphics);
    n.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{if(this.toolDrag||!this.canUseTools())return;const tool=this.toolCatalog()[slot];if(!tool?.available){this.cancelToolInput();this.paintToolTray();this.paint();this.status.string=tool?.reason||'本关没有可用道具';return;}this.toolTapAccepted=false;const p=e.getUILocation();this.toolDrag={kind:tool.kind,slot,pointer:e.getID(),start:{x:p.x,y:p.y},moved:false,version:this.toolVersion()};},this);
    n.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{const d=this.toolDrag;if(!d||d.pointer!==e.getID())return;if(!this.canUseTools()||d.version!==this.toolVersion()){this.cancelToolInput();this.paintToolTray();return;}const p=e.getUILocation();if(!d.moved&&Math.hypot(p.x-d.start.x,p.y-d.start.y)<12)return;d.moved=true;this.armedTool=null;this.moveGhost(p.x,p.y);const i=this.cellAt(p.x,p.y);if(i!==this.selected){this.selected=i;this.paint();}this.paintToolTray();},this);
    // Registered before WarmButton: its activation event observes the accepted tap result.
    n.on(Node.EventType.TOUCH_END,(e:EventTouch)=>this.endToolDrag(e,slot),this);
    n.on(Node.EventType.TOUCH_CANCEL,(e:EventTouch)=>{if(this.toolDrag?.pointer!==e.getID())return;if(e.getEventCode()===Node.EventType.TOUCH_END){this.endToolDrag(e,slot);return;}this.cancelToolInput();this.paintToolTray();this.paint();},this);
    surface.bind(()=>{const accepted=this.toolTapAccepted;this.toolTapAccepted=false;return accepted;});return n;
  }
  private paintToolTray(){
    if(!this.snapshot||!this.layoutInfo)return;const catalog=this.toolCatalog(),d=this.layoutInfo;
    for(const key of Object.keys(this.targets))if(key==='bomb'||key.startsWith('tool-'))delete this.targets[key];
    this.tools.forEach((n,i)=>{const tool=catalog[i];n.active=!!tool;if(!tool)return;
      if(d.safe.portrait)n.setPosition((i-(catalog.length-1)/2)*58,-d.height/2+d.safe.bottom+42);
      else n.setPosition(d.width/2-d.safe.right-81+(i%2)*54,d.height/2-d.safe.top-70-Math.floor(i/2)*64);
      const sprite=n.getChildByName('OriginalToolArt')!.getComponent(Sprite)!;sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=tool.art?this.toolArt?.frame(tool.art):null;sprite.color=new Color(tool.available?'#ffffffff':'#ffffff66');
      const label=n.getChildByName('ToolLabel')!.getComponent(Label)!;label.string=`${tool.name} ${tool.count}`;label.color=new Color(tool.available?'#6a5432':'#7f817b');
      const g=n.getChildByName('ToolSelection')!.getComponent(Graphics)!;g.clear();if(this.armedTool===tool.kind||this.toolDrag?.kind===tool.kind){g.strokeColor=new Color('#e9bc51');g.lineWidth=3;g.roundRect(-22,-22,44,44,13);g.stroke();}
      this.targets['tool-'+tool.kind]=n;if(tool.kind==='bomb')this.targets.bomb=n;
    });
  }
  private safeInsets(w:number,h:number){
    const portrait=w<h*1.1;let top=portrait?62:12,bottom=portrait?34:21,left=portrait?0:44,right=left;
    if(typeof document!=='undefined'&&document.documentElement&&typeof getComputedStyle==='function'){const css=getComputedStyle(document.documentElement);const read=(name:string)=>parseFloat(css.getPropertyValue(name))||0;top=Math.max(top,read('--safe-top'));bottom=Math.max(bottom,read('--safe-bottom'));left=Math.max(left,read('--safe-left'));right=Math.max(right,read('--safe-right'));}
    return {top,bottom,left,right,portrait};
  }
  private layout(){
    const frame=typeof window!=='undefined'?{width:window.innerWidth,height:window.innerHeight}:view.getFrameSize();const w=Math.max(240,frame.width),h=Math.max(320,frame.height);if(!this.managed)view.setDesignResolutionSize(w,h,ResolutionPolicy.EXACT_FIT);if(game.canvas)director.root?.resize(game.canvas.width,game.canvas.height);this.camera.orthoHeight=h/2;this.root.getComponent(UITransform)!.setContentSize(w,h);
    const safe=this.safeInsets(w,h);const board=safe.portrait?Math.min(460,w-safe.left-safe.right-24,h-safe.top-safe.bottom-230):Math.min(460,h-safe.top-safe.bottom-104,w-safe.left-safe.right-220);
    this.cell=board/7;const y=safe.portrait?Math.max(-h*.08,-h/2+safe.bottom+132+board/2):0;this.boardCenter.set(0,y,0);this.grid.setPosition(this.boardCenter);this.grid.getComponent(UITransform)!.setContentSize(board,board);
    this.cells.forEach((n,i)=>{n.setPosition((i%7-3)*this.cell,(3-Math.floor(i/7))*this.cell);n.getComponent(UITransform)!.setContentSize(this.cell,this.cell);n.children[0].getComponent(UITransform)!.setContentSize(this.cell*.88,this.cell*.88);});
    const hudY=h/2-safe.top-23;this.hud.setPosition(0,0);
    if(safe.portrait){this.titleLabel.node.parent!.setPosition(0,hudY);this.goalNodes.forEach((n,i)=>n.setPosition(-w/2+safe.left+90+i*61,hudY-42));this.targets.moves.setPosition(w/2-safe.right-31,hudY-42);this.back.setPosition(-w/2+safe.left+28,hudY);this.bagBtn.setPosition(w/2-safe.right-28,hudY);this.pause.setPosition(100,-h/2+safe.bottom+91);this.tools.forEach((n,i)=>n.setPosition((i-1)*58,-h/2+safe.bottom+34));this.retryBtn.setPosition(-100,-h/2+safe.bottom+91);this.hintBtn.setPosition(0,-h/2+safe.bottom+91);}
    else{this.titleLabel.node.parent!.setPosition(-w/2+safe.left+58,140);this.goalNodes.forEach((n,i)=>n.setPosition(-w/2+safe.left+58,90-i*66));this.targets.moves.setPosition(w/2-safe.right-51,h/2-safe.top-21);this.back.setPosition(-w/2+safe.left+58,-h/2+safe.bottom+30);this.bagBtn.setPosition(-w/2+safe.left+58,-h/2+safe.bottom+80);this.pause.setPosition(w/2-safe.right-24,-h/2+safe.bottom+23);this.tools.forEach((n,i)=>n.setPosition(w/2-safe.right-54,47-i*55));this.retryBtn.setPosition(-32,-h/2+safe.bottom+23);this.hintBtn.setPosition(32,-h/2+safe.bottom+23);}
    this.status.node.setPosition(safe.portrait?0:-w/2+safe.left+58,safe.portrait?y+board/2+20:-h/2+safe.bottom+78);this.status.node.getComponent(UITransform)!.setContentSize(safe.portrait?250:110,24);
    for(const panel of [this.bagPanel,this.retryPanel])panel.getComponent(UITransform)!.setContentSize(w,h);this.stagePanel.setPosition(0,y);this.resultPanel.setPosition(0,y);this.layoutInfo={width:w,height:h,safe,board,cell:this.cell,boardCenter:{x:0,y},skyReserved:safe.portrait?h/2-safe.top-(y+board/2):h/2-safe.top-board/2};
    this.backgroundFrame?.(safe.portrait,{width:w,height:h,boardTop:h/2-y-board/2});
    this.paint();if(this.snapshot)this.render(this.snapshot);
  }
  private measureLayout(){const info=this.layoutInfo;const point=(n:Node)=>({x:n.worldPosition.x+info.width/2,y:info.height/2-n.worldPosition.y});const rect=(n:Node)=>{const p=point(n),t=n.getComponent(UITransform)!;return{x:p.x-t.width/2,y:p.y-t.height/2,width:t.width,height:t.height};};return{...info,spriteReady:this.spriteReady,tiles:this.cells.map(point),targets:Object.fromEntries(Object.entries(this.targets).map(([k,n])=>[k,point(n)])),tileRects:this.cells.map(rect),back:point(this.back),pause:point(this.pause),goalRects:this.goalNodes.filter(n=>n.active).map(rect),controlRects:[this.back,this.pause,...this.tools,this.targets.moves].map(rect),spriteSizes:this.cells.map(n=>{const t=n.children[0].getComponent(UITransform)!;return{width:t.width,height:t.height}}),canvasPixels:game.canvas?{width:game.canvas.width,height:game.canvas.height}:null,renderPixels:this.camera.camera?{width:this.camera.camera.width,height:this.camera.camera.height}:null};}
  private bind(){
    const storage=createSynchronousStorage({getItem:(k:string)=>this.values.get(k)??null,setItem:(k:string,v:string)=>this.values.set(k,v)});
    this.controller=this.managed?this.managed.controller:new Controller({platform:storage,journey:this.journey});
    this.host=(this.managed?this.managed.bind:bindChallengeController)(this.controller,{render:(s:any)=>this.render(s),animate:(_:any,s:any,done:()=>void)=>{
      const epoch=this.epoch;for(const c of this.cells)tween(c).to(0.08,{scale:new Vec3(.94,.94,1)}).to(.08,{scale:Vec3.ONE}).start();
      this.timer=setTimeout(()=>{this.timer=null;if(epoch===this.epoch)done();},180);
    },cancelAnimations:()=>this.cancelAnimations()});
  }
  private cancelAnimations(){this.cancelToolInput();this.paintToolTray();this.selected=-1;this.dragStart=null;this.epoch++;if(this.timer!==null)clearTimeout(this.timer);this.timer=null;for(const c of this.cells){if(!isValid(c,true))continue;Tween.stopAllByTarget(c);c.setScale(1,1,1);}}
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
    if(!this.root||!isValid(this.root,true))return;
    this.snapshot=s;if(s.visual?.kind)this.frameKinds.add(s.visual.kind);if(!this.managed)(globalThis as any).__forestLiveSnapshot=s;const book=['book.ready','stage.detail'].includes(s.state),result=s.state.startsWith('result.')||s.state==='run.unsaved'||s.state==='error.readonly';this.grid.active=!book&&!result;this.stagePanel.active=book;this.resultPanel.active=result;this.hud.active=!book&&!result;this.pause.active=!book&&!result;this.tray.active=!book&&!result;this.back.active=!book;
    this.moves.string=s.active?String(s.active.moves):'';const goalKeys=s.provider==='mainline-v33'?(s.active?.goalOrder||[]):s.provider==='regional-r05'?Object.keys(s.active?.goals||{}):['beacons','moss','type5'];this.goalKeys=goalKeys;this.goalNodes.forEach((n,i)=>{n.active=i<goalKeys.length;if(goalKeys.length===4){const d=this.layoutInfo;if(d.safe.portrait){const step=Math.min(61,(d.width-134)/4);n.setPosition(-d.width/2+d.safe.left+72+step/2+i*step,d.height/2-d.safe.top-65);n.setScale(Math.min(1,step/60),1,1);}else{n.setScale(1,1,1);n.setPosition(-d.width/2+d.safe.left+58,99-i*53);}}else n.setScale(1,1,1);});if(s.state!=='run.ready'||s.readOnly)this.cancelToolInput();this.paintToolTray();const mainline=s.provider==='mainline-v33';const playing=!book&&!result&&(s.state==='run.ready'||s.state==='run.paused');this.titleLabel.string=s.active?.name?`${String((s.active.level??0)+1).padStart(2,'0')}  ${s.active.name}`:'';this.titleLabel.node.parent!.active=!!s.active&&!book&&!result;this.bagBtn.active=mainline&&!!s.journey?.inventory&&!book;this.retryBtn.active=playing&&typeof this.managed?.restart==='function';this.hintBtn.active=playing&&s.state==='run.ready'&&typeof this.managed?.hint==='function';if(!playing)this.hintCells=[];this.goalLabels.forEach((l,i)=>l.string=String(s.active?.goals[goalKeys[i]]??0));this.status.string=s.uiStatus||'';this.status.node.active=!result;this.drawIcon(this.pause,s.state==='run.paused'?'play':'pause',true);this.paint();
    if(book){this.clearChildren(this.stagePanel);this.targets={moves:this.targets.moves};const stages=s.stages.filter((x:any)=>x.region==='tide').slice(0,3);stages.forEach((x:any,i:number)=>{const n=this.button(this.stagePanel,`${x.ordinal}  ${x.name}${x.record?'  \u2713':!x.unlocked?'  \u00b7':''}`,0,70-i*62,Math.min(290,this.layoutInfo.width-40),48,()=>{if(this.snapshot.active){this.status.string='\u8bf7\u5148\u7ee7\u7eed\u5f53\u524d\u65c5\u7a0b';return;}if(!this.command('selectStage',x.id).ok)return;this.command('startStage',x.id,{seed:x.id===this.fixture.stageId?this.fixture.seed:undefined,attemptId:'native-ui-'+(++this.attempt)});});this.targets['stage'+i]=n;});if(s.active)this.targets.resume=this.button(this.stagePanel,'\u7ee7\u7eed',0,-135,150,44,()=>this.command('resumeActive'));}
    if(result)this.paintResult(s);this.positionResultUtilityControls(result);
  }
  private clearChildren(n:Node){for(const child of [...n.children]){child.removeFromParent();child.destroy();}}
  private paint(){if(!this.root||!isValid(this.root,true)||!this.snapshot?.active)return;this.goalNodes.forEach((n,i)=>{const icon=n.getChildByName('Icon')!,art=icon.getChildByName('GoalPieceArt')!,sprite=art.getComponent(Sprite)!,key=this.goalKeys[i]||'';const piece=/^type[0-5]$/.test(key);art.active=piece;if(piece){icon.getComponent(Graphics)!.clear();sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=this.frames[Number(key.slice(4))]||null;}else this.drawIcon(icon,({beacons:'lamp',type5:'shell',roots:'roots',moss:'moss',pearls:'pearls',blooms:'blooms',relays:'relays'} as any)[key]||key);});this.cells.forEach((n,i)=>{const g=n.getComponent(Graphics)!;g.clear();const half=this.cell*.47;g.fillColor=new Color(this.selected===i?'#fff0b5dc':'#eff5e5bb');g.roundRect(-half,-half,half*2,half*2,Math.min(10,this.cell*.18));g.fill();const tile=this.snapshot.active.board[i],sprite=n.children[0].getComponent(Sprite)!;const marks=n.children[1].getComponent(Graphics)!;marks.clear();sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=tile?this.frames[tile.type%6]||null:null;n.children[0].getComponent(UITransform)!.setContentSize(this.cell*.88,this.cell*.88);
      if(this.snapshot.active.moss.includes(i)){marks.fillColor=new Color('#568b5d');marks.circle(half-5,-half+5,3);marks.fill();}if(this.snapshot.active.roots.some((r:any)=>Array.isArray(r)?r[0]===i:r===i)||this.snapshot.active.beaconTarget?.index===i){marks.strokeColor=new Color(this.snapshot.active.beaconTarget?.index===i?'#ffe59c':'#896e4b');marks.lineWidth=2;marks.roundRect(-half,-half,half*2,half*2,8);marks.stroke();}if(tile?.special){marks.strokeColor=new Color('#fff1b4');marks.lineWidth=2;marks.circle(0,0,this.cell*.37);marks.stroke();}
      g.strokeColor=new Color('#c4a15a');g.lineWidth=2;g.roundRect(-half,-half,half*2,half*2,Math.min(10,this.cell*.18));g.stroke();
      if(this.hintCells.includes(i)){marks.strokeColor=new Color('#d4a017');marks.lineWidth=3;marks.roundRect(-half+2,-half+2,half*2-4,half*2-4,8);marks.stroke();}
    });if(this.managed)this.managed.afterPaint(this.snapshot,this.cells);}
  private box(name:string,parent:Node,x:number,y:number,w:number,h:number){const n=new Node(name);n.layer=Layers.Enum.UI_2D;parent.addChild(n);n.setPosition(x,y);n.addComponent(UITransform).setContentSize(w,h);return n;}
  private text(parent:Node,value:string,x:number,y:number,size:number,width:number,color='#fff9e4'){const n=this.box('Text',parent,x,y,width,size+12);const l=n.addComponent(Label);l.string=value;l.fontSize=size;l.lineHeight=size+4;l.color=new Color(color);l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;return l;}
  private button(parent:Node,value:string,x:number,y:number,w:number,h:number,fn:()=>void){const n=this.box(value,parent,x,y,w,h);const surface=warmButton(n,w,h);const label=this.text(n,value,0,0,18,w-10);surface.addContent(label.node);surface.bind(fn);return n;}
  private iconButton(type:string,parent:Node,fn:()=>void){const n=this.box(type,parent,0,0,46,46);this.drawIcon(n,type,true);n.getComponent(WarmButton)!.bind(()=>{if(this.modalOpen())return false;fn();});return n;}
  private drawIcon(n:Node,type:string,bg=false){const ivory=type==='back'||type==='bag'||type==='retry'||type==='hint';const g=bg?warmButtonGraphics(n,46,46,ivory):(n.getComponent(Graphics)||n.addComponent(Graphics));if(!bg)g.clear();g.strokeColor=new Color(bg&&!ivory?'#fff2cf':type==='slot'?'#d8e4d288':'#6a5432');g.fillColor=new Color(bg&&!ivory?'#fff2cf':'#c4a15a');g.lineWidth=2;
    if(type==='back'){g.moveTo(5,9);g.lineTo(-5,0);g.lineTo(5,-9);g.stroke();}
    else if(type==='bag'){g.roundRect(-8,-6,16,12,3);g.stroke();g.moveTo(-4,-6);g.lineTo(-2,-10);g.lineTo(4,-10);g.lineTo(6,-6);g.stroke();}
    else if(type==='retry'){g.arc(0,1,8,0.4,5.4,false);g.stroke();g.moveTo(6,8);g.lineTo(8,2);g.lineTo(2,3);g.stroke();}
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
  private labeledIcon(type:string,label:string,fn:()=>void){const n=this.iconButton(type,this.root,fn);this.text(n,label,0,-30,12,52,'#6a5432');return n;}
  private modalOpen(){return this.bagOpen||!!this.retryPanel?.active;}
  private showHint(){const hint=this.managed?.hint?.();this.hintCells=Array.isArray(hint?.cells)?hint.cells.slice():[];if(!this.hintCells.length)this.status.string='这一步没有可提示的走法';this.paint();}
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
    else{this.back.setPosition(-d.width/2+s.left+58,-d.height/2+s.bottom+30);this.bagBtn.setPosition(-d.width/2+s.left+58,-d.height/2+s.bottom+80);}
  }
  private paintResult(s:any){const chestKey=s.provider+'/'+(s.active?.stageId??s.active?.level??'none');let priorChest=this.resultPanel.getChildByName('ResultPage')?.getChildByName('Chest')??null;if(priorChest?.getComponent(ResultChestView)?.resultKey===chestKey)priorChest.removeFromParent();else priorChest=null;delete this.targets.resultBack;delete this.targets.retry;delete this.targets.replay;this.clearChildren(this.resultPanel);const d=this.layoutInfo,layout=resultLayout(d,resultActionCount(s)),w=layout.width,h=layout.height;d.resultViewportSupported=layout.supportedViewport;const plate=this.box('ResultPage',this.resultPanel,layout.panelX,layout.panelY-d.boardCenter.y,w,h);const bg=plate.addComponent(Graphics);bg.fillColor=new Color('#f6edd4');bg.roundRect(-w/2,-h/2,w,h,18);bg.fill();bg.strokeColor=new Color('#c4a15a');bg.lineWidth=3;bg.roundRect(-w/2,-h/2,w,h,18);bg.stroke();
    const won=s.active?.status==='won',stars=typeof s.result?.stars==='number'?s.result.stars:null,compact=h<350;
    const retry=s.state==='result.unsaved'||s.state==='run.unsaved',replay=!retry&&s.provider==='mainline-v33'&&s.active?.status==='lost'&&s.state==='result.saved';
    const titleY=h/2-(compact?24:36),scoreY=compact?titleY:titleY-38,starsY=compact?titleY-36:scoreY-34;
    this.text(plate,won?'过关了':retry?'还没存上':'再走一次',compact?-w/4:0,titleY,compact?20:22,compact?w/2-16:w-20,'#365b54');this.text(plate,`${s.active?.score||0} 分`,compact?w/4:0,scoreY,compact?18:20,compact?w/2-16:w-20,'#426750');
    if(stars!==null){const row=this.box('Stars',plate,0,starsY,140,28);const sg=row.addComponent(Graphics);for(let i=0;i<3;i++){const x=(i-1)*36;sg.fillColor=new Color(i<stars?'#e2b657':'#d9d0bc');sg.moveTo(x,10);sg.lineTo(x+4,3);sg.lineTo(x+12,2);sg.lineTo(x+6,-3);sg.lineTo(x+8,-12);sg.lineTo(x,-6);sg.lineTo(x-8,-12);sg.lineTo(x-6,-3);sg.lineTo(x-12,2);sg.lineTo(x-4,3);sg.close();sg.fill();}if(!compact)this.text(plate,`${stars} 星`,0,starsY-29,14,80,'#6a5432');}
    // Reserve the complete bounded chest surface, including the opened lid and glow.
    // Reserve action/caption rows first, then fit the chest between them and the stars.
    const paired=compact&&(retry||replay),actionWidth=paired?Math.min(130,(w-28)/2):130;
    const backY=-h/2+30,secondaryY=backY+(paired?0:48),actionTop=(retry||replay)&&!paired?secondaryY+20:backY+21;
    const captionHeight=s.state==='error.readonly'?34:30,captionY=actionTop+6+captionHeight/2,captionText=s.state==='error.readonly'?[s.uiStatus,s.uiResultCaption].filter(Boolean).join('\n'):s.uiResultCaption;
    if(captionText){const caption=this.text(plate,captionText,0,captionY,13,w-24,'#5e7559');caption.node.getComponent(UITransform)!.setContentSize(w-24,captionHeight);caption.overflow=Label.Overflow.SHRINK;caption.enableWrapText=true;}
    const chest=s.provider==='mainline-v33'?s.journey?.chests?.find((x:any)=>x.level===s.active?.level):null;
    if(chest?.earned){const upper=(stars!==null?(compact?starsY-14:starsY-42):scoreY-(compact?15:16))-(compact?6:8),lower=(captionText?captionY+captionHeight/2:actionTop)+(compact?6:8);const scale=Math.min(1,Math.max(0,(upper-lower)/RESULT_CHEST_SIZE));if(scale>0){const chestNode=this.drawChest(plate,0,(upper+lower)/2,chest.opened?1:0,priorChest);priorChest=null;chestNode.getComponent(ResultChestView)!.resultKey=chestKey;chestNode.setScale(scale,scale,1);}}
    if(priorChest)priorChest.destroy();
    this.targets.resultBack=this.button(plate,'返回',paired?-(actionWidth+10)/2:0,backY,actionWidth,42,()=>this.command('requestExit'));
    if(retry)this.targets.retry=this.button(plate,'重试保存',paired?(actionWidth+10)/2:0,secondaryY,paired?actionWidth:150,40,()=>this.command('retrySave'));
    else if(replay)this.targets.replay=this.button(plate,'再试一次',paired?(actionWidth+10)/2:0,secondaryY,paired?actionWidth:150,40,()=>this.command('startStage',s.active.stageId,{}));
  }
  private drawChest(parent:Node,x:number,y:number,open:number,previous:Node|null=null){const n=previous||this.box('Chest',parent,x,y,RESULT_CHEST_SIZE,RESULT_CHEST_SIZE);if(previous){parent.addChild(n);n.setPosition(x,y,0);n.getComponent(ResultChestView)!.setOpen(open);}else n.addComponent(ResultChestView).initialize(open);return n;}
  onDestroy(){this.releasePieceArt();this.backgroundFrame=undefined;this.backgroundStatus=undefined;game.off(Game.EVENT_HIDE,this.hide);game.off(Game.EVENT_SHOW,this.show);view.off('canvas-resize',this.resize,this);if(typeof window!=='undefined')window.removeEventListener('resize',this.resize);this.host?.dispose();this.cancelAnimations();if(!this.managed)delete (globalThis as any).__nativeBoard;}
}
