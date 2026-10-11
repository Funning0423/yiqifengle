const fs=require('fs'),path=require('path'),crypto=require('crypto');
const SOURCE='/workspace/shared/grok-takeover/parallel-development/native-board-r1/COCOS-FIRSTSLICE-COMPAT/creator-build-project/assets/scripts/NativeBoardUI.ts';
function patchNativeUI(source){let s=source;
 const replace=(from,to)=>{if(s.split(from).length!==2)throw Error('Expected exactly one NativeBoardUI seam: '+from.slice(0,70));s=s.replace(from,to);};
 replace('export class NativeBoardUI extends Component {',`export class NativeBoardUI extends Component {
  private managed: any = null;
  initializeManaged(fixture: any, binding: any) {
    if (this.managed || this.root) throw Error('NativeBoardUI already initialized');
    this.managed = binding; this.initialize(fixture);
  }
  managedViewVersion() { return 'native-board-managed-v1'; }`);
 replace('this.fixture = fixture; profiler.hideStats();','this.fixture = fixture; if(!this.managed)profiler.hideStats();');
 replace('view.setDesignResolutionSize(1280,800,ResolutionPolicy.SHOW_ALL);','if(!this.managed)view.setDesignResolutionSize(1280,800,ResolutionPolicy.SHOW_ALL);');
 replace("n.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{this.dragStart={index:i,point:e.getLocation()};},this);","n.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{if(this.snapshot?.state!=='run.ready'||this.snapshot?.readOnly)return;this.dragStart={index:i,point:e.getLocation()};},this);");
 replace("this.dragStart=null;if(d?.consumed)return;","this.dragStart=null;if(!d||d.index!==i||d.consumed)return;");
 replace("private cancelAnimations(){this.epoch++;","private cancelAnimations(){this.selected=-1;this.dragStart=null;this.epoch++;");
 replace('this.bind();game.on(Game.EVENT_HIDE,this.hide);game.on(Game.EVENT_SHOW,this.show);',"this.bind();if (!this.managed) { game.on(Game.EVENT_HIDE,this.hide);game.on(Game.EVENT_SHOW,this.show); }");
 replace('(globalThis as any).__nativeBoard={',"if (!this.managed) (globalThis as any).__nativeBoard={");
 replace('this.controller=new Controller({platform:storage,journey:this.journey});','this.controller=this.managed ? this.managed.controller : new Controller({platform:storage,journey:this.journey});');
 replace('this.host=bindChallengeController(this.controller,{render:(s:any)=>this.render(s),animate:(_:any,s:any,done:()=>void)=>{',"this.host=(this.managed ? this.managed.bind : bindChallengeController)(this.controller,{render:(s:any)=>this.render(s),animate:(_:any,s:any,done:()=>void)=>{");
 replace("private command(name:string,...args:any[]){this.selected=-1;const r=this.host.command(name,...args);", "private command(name:string,...args:any[]){this.selected=-1;this.dragStart=null;const r=this.managed?.intercept?.(name,...args) ?? this.host.command(name,...args);");
 replace("if(a===i){this.selected=-1;this.paint();return;}","if(a===i){if(this.managed&&this.snapshot.active?.board[i]?.special)this.managed.submit(['activate',i]);this.selected=-1;this.paint();return;}");
 replace("slot.on(Node.EventType.TOUCH_END,()=>{this.status.string='道具尚未开放';},this);", "slot.on(Node.EventType.TOUCH_END,()=>{if(this.managed){const r=this.managed.useTool(this.selected);if(!r.ok)this.status.string='暂不可操作 · '+r.reason;}else this.status.string='道具尚未开放';},this);");
 replace('this.snapshot=s;(globalThis as any).__forestLiveSnapshot=s;',"this.snapshot=s;if(!this.managed)(globalThis as any).__forestLiveSnapshot=s;if(s.uiTitle)this.headline.string=s.uiTitle;");
 replace("const result=s.state.startsWith('result.');", "const result=s.state.startsWith('result.')||s.state==='run.unsaved'||s.state==='error.readonly';");
 replace("this.status.string=s.state==='run.paused'?", "this.status.string=s.uiStatus ?? (s.state==='run.paused'?");
 replace("?'风正在整理棋盘…':'相邻两格点按交换，也可轻扫';", "?'风正在整理棋盘…':'相邻两格点按交换，也可轻扫');");
 replace('    this.paint();\n    if(book)', '    this.paint();if(this.managed)this.managed.afterPaint(s,this.cells);\n    if(book)');
 replace("s.active?.status==='won'?'潮汐已点亮':'再试一阵风'", "s.uiResultTitle ?? (s.active?.status==='won'?'潮汐已点亮':'再试一阵风')");
 replace("`${s.active?.score||0} 分 · 旅程${s.result?.saved?'已保存':'待保存'}`", "s.uiResultCaption ?? `${s.active?.score||0} 分 · 旅程${s.result?.saved?'已保存':'待保存'}`");
 replace("if(s.state==='result.unsaved')", "if(s.state==='result.unsaved'||s.state==='run.unsaved')");
 replace('this.snapshot.active.roots.includes(i)',"this.snapshot.active.roots.some((r:any)=>Array.isArray(r)?r[0]===i:r===i)");
 replace('delete (globalThis as any).__nativeBoard;', 'if(!this.managed)delete (globalThis as any).__nativeBoard;');
 return s;
}
module.exports={patchNativeUI,SOURCE};
if(require.main===module){const source=fs.readFileSync(SOURCE,'utf8'),out=patchNativeUI(source);const dest=path.resolve(__dirname,'../evidence/NativeBoardUI.managed.generated.ts');fs.writeFileSync(dest,out);console.log(dest);}
