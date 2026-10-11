import { _decorator, Component, Node, Canvas, Camera, Layers, UITransform, Graphics, Color, Label, Vec3, EventTouch, game, Game, view, ResolutionPolicy, tween, Tween, profiler, SpriteFrame, Sprite, director } from 'cc';
import { BoardArt, PIECE_KEYS } from './ui/BoardArt';
import Controller from './r4-cloud-compat/runtime/challenge-controller.js';
import Port from './r4-cloud-compat/adapter/cocos-port.js';
const { ccclass } = _decorator;
const { createSynchronousStorage, bindChallengeController } = Port;
@ccclass('NativeBoardUI')
export class NativeBoardUI extends Component {
  private root!:Node; private grid!:Node; private stagePanel!:Node; private resultPanel!:Node; private camera!:Camera;
  private hud!:Node; private tray!:Node; private status!:Label; private moves!:Label;
  private controller:any; private host:any; private cells:Node[]=[]; private selected=-1;
  private snapshot:any; private fixture:any; private epoch=0; private timer:any=null;
  private values=new Map<string,string>(); private attempt=0; private dragStart:any=null;
  private journey={readOnly:false,records:Array.from({length:12},()=>({bestStars:3}))};
  private frames:SpriteFrame[]=[]; private layoutInfo:any=null; private cell=50; private goalLabels:Label[]=[];
  private goalNodes:Node[]=[]; private targets:Record<string,Node>={}; private boardCenter=new Vec3();
  private back!:Node;private pause!:Node;private tools:Node[]=[];private spriteReady=false;private backgroundFrame?: (portrait:boolean)=>void;
  private hide=()=>{this.selected=-1;this.host?.hide();};private show=()=>this.host?.show();
  private resize=()=>{this.layout();};
  initialize(fixture:any,backgroundFrame?: (portrait:boolean)=>void){
    this.fixture=fixture;this.backgroundFrame=backgroundFrame;profiler.hideStats();view.resizeWithBrowserSize(true);
    this.root=this.box('NativeBoardCanvas',this.node,0,0,1,1);
    const canvas=this.root.addComponent(Canvas);canvas.alignCanvasWithScreen=false;
    const cameraNode=new Node('NativeUICamera');cameraNode.layer=Layers.Enum.UI_2D;this.node.addChild(cameraNode);cameraNode.setPosition(0,0,1000);
    this.camera=cameraNode.addComponent(Camera);this.camera.projection=Camera.ProjectionType.ORTHO;this.camera.near=.1;this.camera.far=2000;this.camera.priority=50;this.camera.visibility=Layers.Enum.UI_2D;this.camera.clearFlags=Camera.ClearFlag.DEPTH_ONLY;canvas.cameraComponent=this.camera;
    this.hud=this.box('LightGoalHUD',this.root,0,0,1,1);this.tray=this.box('CompactToolTray',this.root,0,0,1,1);
    this.grid=this.box('CenteredNativeGrid',this.root,0,0,1,1);
    for(let i=0;i<49;i++){
      const n=this.box('Tile-'+i,this.grid,0,0,50,50);n.addComponent(Graphics);
      const art=this.box('ProjectPieceArt',n,0,0,42,42);art.addComponent(Sprite);this.box('GoalMarkers',n,0,0,50,50).addComponent(Graphics);
      n.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{this.dragStart={index:i,point:e.getLocation()};},this);
      n.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{const d=this.dragStart;if(!d||d.consumed||d.index!==i)return;const p=e.getLocation(),dx=p.x-d.point.x,dy=p.y-d.point.y;if(Math.max(Math.abs(dx),Math.abs(dy))<Math.min(18,this.cell*.35))return;d.consumed=true;const j=i+(Math.abs(dx)>Math.abs(dy)?(dx>0?1:-1):(dy>0?-7:7));if(j>=0&&j<49&&Math.abs(i%7-j%7)+Math.abs(Math.floor(i/7)-Math.floor(j/7))===1)this.swap(i,j);},this);
      n.on(Node.EventType.TOUCH_END,()=>{const d=this.dragStart;this.dragStart=null;if(!d?.consumed)this.tap(i);},this);
      n.on(Node.EventType.TOUCH_CANCEL,()=>{this.dragStart=null;this.selected=-1;this.paint();},this);this.cells.push(n);
    }
    for(let i=0;i<3;i++){
      const n=this.box('Goal-'+i,this.hud,0,0,58,40);const badge=n.addComponent(Graphics);badge.fillColor=new Color('#153b3da6');badge.roundRect(-29,-20,58,40,16);badge.fill();const icon=this.box('Icon',n,-14,0,24,24);this.drawIcon(icon,['lamp','moss','shell'][i]);this.goalLabels.push(this.text(n,'',14,0,16,24));this.goalNodes.push(n);
    }
    const steps=this.box('Moves',this.hud,0,0,58,42);const stepBadge=steps.addComponent(Graphics);stepBadge.fillColor=new Color('#153b3da6');stepBadge.roundRect(-29,-21,58,42,16);stepBadge.fill();this.drawIcon(this.box('Footstep',steps,-16,0,22,24),'steps');this.moves=this.text(steps,'',13,0,21,30);this.targets.moves=steps;
    this.back=this.iconButton('back',this.root,()=>this.command('requestExit'));this.pause=this.iconButton('pause',this.root,()=>this.command(this.snapshot.state==='run.paused'?'resume':'pause'));
    for(let i=0;i<3;i++){const n=this.iconButton('slot',this.tray,()=>{this.status.string='\u9053\u5177\u5c1a\u672a\u5f00\u653e';});this.tools.push(n);}
    this.status=this.text(this.root,'',0,0,12,250);
    this.stagePanel=this.box('NativeStageSelection',this.root,0,0,1,1);this.resultPanel=this.box('NativeResult',this.root,0,0,1,1);
    this.layout();this.bind();game.on(Game.EVENT_HIDE,this.hide);game.on(Game.EVENT_SHOW,this.show);view.on('canvas-resize',this.resize,this);if(typeof window!=='undefined')window.addEventListener('resize',this.resize);
    const art=BoardArt.shared(),ready=()=>{if(!art.loaded('board')||this.spriteReady)return;this.frames=PIECE_KEYS.map(k=>art.frame(k)!);this.spriteReady=true;this.paint();};art.onChange(ready);void art.load('board');ready();
    (globalThis as any).__nativeBoard={snapshot:()=>this.controller.snapshot(),storage:()=>Array.from(this.values),coldReload:()=>this.coldReload(),hide:()=>this.hide(),show:()=>this.show(),fixture:()=>this.fixture,layout:()=>this.measureLayout(),scope:'Native Cocos UI; existing project art; disposable memory'};
  }
  private safeInsets(w:number,h:number){
    const portrait=w<h*1.1;let top=portrait?62:12,bottom=portrait?34:21,left=portrait?0:44,right=left;
    if(typeof document!=='undefined'&&document.documentElement&&typeof getComputedStyle==='function'){const css=getComputedStyle(document.documentElement);const read=(name:string)=>parseFloat(css.getPropertyValue(name))||0;top=Math.max(top,read('--safe-top'));bottom=Math.max(bottom,read('--safe-bottom'));left=Math.max(left,read('--safe-left'));right=Math.max(right,read('--safe-right'));}
    return {top,bottom,left,right,portrait};
  }
  private layout(){
    const frame=typeof window!=='undefined'?{width:window.innerWidth,height:window.innerHeight}:view.getFrameSize();const w=Math.max(240,frame.width),h=Math.max(320,frame.height);view.setDesignResolutionSize(w,h,ResolutionPolicy.EXACT_FIT);if(game.canvas)director.root?.resize(game.canvas.width,game.canvas.height);this.camera.orthoHeight=h/2;this.root.getComponent(UITransform)!.setContentSize(w,h);
    const safe=this.safeInsets(w,h);this.backgroundFrame?.(safe.portrait);const board=safe.portrait?Math.min(460,w-safe.left-safe.right-24,h-safe.top-safe.bottom-190):Math.min(460,h-safe.top-safe.bottom-40,w-safe.left-safe.right-220);
    this.cell=board/7;const y=safe.portrait?Math.max(-h*.08,-h/2+safe.bottom+94+board/2):0;this.boardCenter.set(0,y,0);this.grid.setPosition(this.boardCenter);this.grid.getComponent(UITransform)!.setContentSize(board,board);
    this.cells.forEach((n,i)=>{n.setPosition((i%7-3)*this.cell,(3-Math.floor(i/7))*this.cell);n.getComponent(UITransform)!.setContentSize(this.cell,this.cell);n.children[0].getComponent(UITransform)!.setContentSize(this.cell*.88,this.cell*.88);});
    const hudY=h/2-safe.top-23;this.hud.setPosition(0,0);
    if(safe.portrait){this.goalNodes.forEach((n,i)=>n.setPosition(-w/2+safe.left+90+i*61,hudY));this.targets.moves.setPosition(w/2-safe.right-31,hudY);this.back.setPosition(-w/2+safe.left+28,hudY);this.pause.setPosition(w/2-safe.right-32,-h/2+safe.bottom+34);this.tools.forEach((n,i)=>n.setPosition((i-1)*58,-h/2+safe.bottom+34));}
    else{this.goalNodes.forEach((n,i)=>n.setPosition(-w/2+safe.left+58,90-i*66));this.targets.moves.setPosition(w/2-safe.right-54,115);this.back.setPosition(-w/2+safe.left+58,-h/2+safe.bottom+30);this.pause.setPosition(w/2-safe.right-54,-h/2+safe.bottom+30);this.tools.forEach((n,i)=>n.setPosition(w/2-safe.right-54,47-i*55));}
    this.status.node.setPosition(safe.portrait?0:-w/2+safe.left+58,safe.portrait?y+board/2+20:-h/2+safe.bottom+78);this.status.node.getComponent(UITransform)!.setContentSize(safe.portrait?250:110,24);
    this.stagePanel.setPosition(0,y);this.resultPanel.setPosition(0,y);this.layoutInfo={width:w,height:h,safe,board,cell:this.cell,boardCenter:{x:0,y},skyReserved:safe.portrait?h/2-safe.top-(y+board/2):h/2-safe.top-board/2};
    this.paint();if(this.snapshot)this.render(this.snapshot);
  }
  private measureLayout(){const info=this.layoutInfo;const point=(n:Node)=>({x:n.worldPosition.x+info.width/2,y:info.height/2-n.worldPosition.y});const rect=(n:Node)=>{const p=point(n),t=n.getComponent(UITransform)!;return{x:p.x-t.width/2,y:p.y-t.height/2,width:t.width,height:t.height};};return{...info,spriteReady:this.spriteReady,tiles:this.cells.map(point),targets:Object.fromEntries(Object.entries(this.targets).map(([k,n])=>[k,point(n)])),tileRects:this.cells.map(rect),back:point(this.back),pause:point(this.pause),goalRects:this.goalNodes.map(rect),controlRects:[this.back,this.pause,...this.tools,this.targets.moves].map(rect),spriteSizes:this.cells.map(n=>{const t=n.children[0].getComponent(UITransform)!;return{width:t.width,height:t.height}}),canvasPixels:game.canvas?{width:game.canvas.width,height:game.canvas.height}:null,renderPixels:this.camera.camera?{width:this.camera.camera.width,height:this.camera.camera.height}:null};}
  private bind(){
    const storage=createSynchronousStorage({getItem:(k:string)=>this.values.get(k)??null,setItem:(k:string,v:string)=>this.values.set(k,v)});
    this.controller=new Controller({platform:storage,journey:this.journey});
    this.host=bindChallengeController(this.controller,{render:(s:any)=>this.render(s),animate:(_:any,s:any,done:()=>void)=>{
      const epoch=this.epoch;for(const c of this.cells)tween(c).to(0.08,{scale:new Vec3(.94,.94,1)}).to(.08,{scale:Vec3.ONE}).start();
      this.timer=setTimeout(()=>{this.timer=null;if(epoch===this.epoch)done();},180);
    },cancelAnimations:()=>this.cancelAnimations()});
  }
  private cancelAnimations(){this.epoch++;if(this.timer!==null)clearTimeout(this.timer);this.timer=null;for(const c of this.cells){Tween.stopAllByTarget(c);c.setScale(1,1,1);}}
  private coldReload(){const before=this.controller.snapshot();this.host.dispose();this.bind();return {before:before.state,after:this.controller.snapshot().state};}
  private command(name:string,...args:any[]){this.selected=-1;const r=this.host.command(name,...args);if(!r.ok)this.status.string='暂不可操作 · '+r.reason;return r;}
  private swap(a:number,b:number){
    if(this.snapshot.state!=='run.ready'||this.snapshot.readOnly)return;
    this.selected=-1;const p=this.host.command('previewAction',['swap',a,b]);
    if(!p.ok){this.status.string='这两格暂时不能交换';this.paint();return;}
    const c=this.host.command('commitAction',p.token);if(!c.ok)this.status.string='行动未提交 · '+c.reason;
  }
  private tap(i:number){if(this.snapshot.state!=='run.ready')return;if(this.selected<0){this.selected=i;this.paint();return;}
    const a=this.selected;if(a===i){this.selected=-1;this.paint();return;}
    if(Math.abs(a%7-i%7)+Math.abs(Math.floor(a/7)-Math.floor(i/7))===1)this.swap(a,i);else{this.selected=i;this.paint();}}
  private render(s:any){
    this.snapshot=s;(globalThis as any).__forestLiveSnapshot=s;const book=['book.ready','stage.detail'].includes(s.state),result=s.state.startsWith('result.');this.grid.active=!book&&!result;this.stagePanel.active=book;this.resultPanel.active=result;this.hud.active=!book;this.pause.active=!book&&!result;this.tray.active=!book&&!result;this.back.active=!book;
    this.moves.string=s.active?String(s.active.moves):'';this.goalLabels.forEach((l,i)=>l.string=String(s.active?.goals[['beacons','moss','type5'][i]]??0));this.status.string='';this.drawIcon(this.pause,s.state==='run.paused'?'play':'pause',true);this.paint();
    if(book){this.clearChildren(this.stagePanel);this.targets={moves:this.targets.moves};const stages=s.stages.filter((x:any)=>x.region==='tide').slice(0,3);stages.forEach((x:any,i:number)=>{const n=this.button(this.stagePanel,`${x.ordinal}  ${x.name}${x.record?'  \u2713':!x.unlocked?'  \u00b7':''}`,0,70-i*62,Math.min(290,this.layoutInfo.width-40),48,()=>{if(this.snapshot.active){this.status.string='\u8bf7\u5148\u7ee7\u7eed\u5f53\u524d\u65c5\u7a0b';return;}if(!this.command('selectStage',x.id).ok)return;this.command('startStage',x.id,{seed:x.id===this.fixture.stageId?this.fixture.seed:undefined,attemptId:'native-ui-'+(++this.attempt)});});this.targets['stage'+i]=n;});if(s.active)this.targets.resume=this.button(this.stagePanel,'\u7ee7\u7eed',0,-135,150,44,()=>this.command('resumeActive'));}
    if(result){this.clearChildren(this.resultPanel);const badge=this.box('ResultContrastBadge',this.resultPanel,0,57,172,114);const bg=badge.addComponent(Graphics);bg.fillColor=new Color('#123233');bg.roundRect(-86,-57,172,114,18);bg.fill();bg.strokeColor=new Color('#fff2cf');bg.lineWidth=2;bg.roundRect(-86,-57,172,114,18);bg.stroke();this.text(this.resultPanel,s.active?.status==='won'?'\u2713':'\u00b7',0,78,44,120);this.text(this.resultPanel,String(s.active?.score||0),0,26,28,130);this.targets.resultBack=this.button(this.resultPanel,'\u8fd4\u56de',0,-46,130,46,()=>this.command('requestExit'));if(s.state==='result.unsaved')this.targets.retry=this.button(this.resultPanel,'\u91cd\u8bd5\u4fdd\u5b58',0,-104,150,44,()=>this.command('retrySave'));}
  }
  private clearChildren(n:Node){for(const child of [...n.children]){child.removeFromParent();child.destroy();}}
  private paint(){if(!this.snapshot?.active)return;this.cells.forEach((n,i)=>{const g=n.getComponent(Graphics)!;g.clear();const half=this.cell*.47;g.fillColor=new Color(this.selected===i?'#fff0b5dc':'#eff5e5bb');g.roundRect(-half,-half,half*2,half*2,Math.min(10,this.cell*.18));g.fill();const tile=this.snapshot.active.board[i],sprite=n.children[0].getComponent(Sprite)!;const marks=n.children[1].getComponent(Graphics)!;marks.clear();sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=tile?this.frames[tile.type%6]||null:null;n.children[0].getComponent(UITransform)!.setContentSize(this.cell*.88,this.cell*.88);
      if(this.snapshot.active.moss.includes(i)){marks.fillColor=new Color('#568b5d');marks.circle(half-5,-half+5,3);marks.fill();}if(this.snapshot.active.roots.includes(i)||this.snapshot.active.beaconTarget?.index===i){marks.strokeColor=new Color(this.snapshot.active.beaconTarget?.index===i?'#ffe59c':'#896e4b');marks.lineWidth=2;marks.roundRect(-half,-half,half*2,half*2,8);marks.stroke();}if(tile?.special){marks.strokeColor=new Color('#fff1b4');marks.lineWidth=2;marks.circle(0,0,this.cell*.37);marks.stroke();}
    });}
  private box(name:string,parent:Node,x:number,y:number,w:number,h:number){const n=new Node(name);n.layer=Layers.Enum.UI_2D;parent.addChild(n);n.setPosition(x,y);n.addComponent(UITransform).setContentSize(w,h);return n;}
  private text(parent:Node,value:string,x:number,y:number,size:number,width:number){const n=this.box('Text',parent,x,y,width,size+12);const l=n.addComponent(Label);l.string=value;l.fontSize=size;l.lineHeight=size+4;l.color=new Color('#fff9e4');l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;return l;}
  private button(parent:Node,value:string,x:number,y:number,w:number,h:number,fn:()=>void){const n=this.box(value,parent,x,y,w,h);const g=n.addComponent(Graphics);g.fillColor=new Color('#183b3dd9');g.roundRect(-w/2,-h/2,w,h,16);g.fill();this.text(n,value,0,0,18,w-10);n.on(Node.EventType.TOUCH_END,fn,this);return n;}
  private iconButton(type:string,parent:Node,fn:()=>void){const n=this.box(type,parent,0,0,46,46);this.drawIcon(n,type,true);n.on(Node.EventType.TOUCH_END,fn,this);return n;}
  private drawIcon(n:Node,type:string,bg=false){const g=n.getComponent(Graphics)||n.addComponent(Graphics);g.clear();if(bg){g.fillColor=new Color(type==='back'?'#123233':'#183b3daa');g.circle(0,0,22);g.fill();if(type==='back'){g.strokeColor=new Color('#fff2cf');g.lineWidth=2;g.circle(0,0,22);g.stroke();}}g.strokeColor=new Color(type==='slot'?'#d8e4d288':'#fff2cf');g.fillColor=new Color('#fff2cf');g.lineWidth=2;
    if(type==='back'){g.moveTo(5,9);g.lineTo(-5,0);g.lineTo(5,-9);g.stroke();}
    else if(type==='pause'){g.rect(-7,-8,4,16);g.rect(3,-8,4,16);g.fill();}
    else if(type==='play'){g.moveTo(-5,-9);g.lineTo(8,0);g.lineTo(-5,9);g.close();g.fill();}
    else if(type==='lamp'){g.roundRect(-7,-8,14,16,3);g.stroke();g.moveTo(-10,10);g.lineTo(10,10);g.moveTo(-9,-11);g.lineTo(9,-11);g.stroke();g.circle(0,0,3);g.fill();}
    else if(type==='moss'){for(const [x,y]of [[-6,-3],[0,4],[6,-3]]){g.circle(x,y,4);g.stroke();}}
    else if(type==='shell'){g.arc(0,2,9,Math.PI,2*Math.PI);g.lineTo(0,9);g.close();g.stroke();g.moveTo(0,9);g.lineTo(-5,-3);g.moveTo(0,9);g.lineTo(5,-3);g.stroke();}
    else if(type==='steps'){g.ellipse(-4,3,3,6);g.ellipse(4,-3,3,6);g.fill();}
    else{g.circle(0,0,9);g.stroke();g.moveTo(-4,0);g.lineTo(4,0);g.stroke();}
  }
  onDestroy(){game.off(Game.EVENT_HIDE,this.hide);game.off(Game.EVENT_SHOW,this.show);view.off('canvas-resize',this.resize,this);if(typeof window!=='undefined')window.removeEventListener('resize',this.resize);this.host?.dispose();this.cancelAnimations();delete (globalThis as any).__nativeBoard;}
}
