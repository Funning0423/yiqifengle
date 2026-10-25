import { managedTools } from './ManagedTools';
import { openMainlineSession } from './MainlineHost';
import CampaignHost from '../regional-r05/runtime/campaign-host.js';
/** No cc imports. NativeBoardUI managed seam + unchanged R4 binder + selected real provider. */
export type Selection={provider:'r4'|'r5'|'mainline';stageId:string;seed:number};
export type Reply={ok:boolean;reason?:string;token?:string};
export type DisposableStores={r4:Map<string,string>;r5:Map<string,string>};
export type Dependencies={R4:new(options:any)=>any;R5:new(options:any)=>any;port:any;mainlinePort?:any;r4Persistence?:any;r5Persistence?:{platform:any;journey:any;inspect:()=>any}};
const copy=(value:any)=>value==null?value:JSON.parse(JSON.stringify(value));
const BOARD_COMMANDS=new Set(['previewAction','cancelPreview','commitAction','pause','resume','requestExit','retrySave']);
/** Presentation only: retain intermediate frame state rather than leaking R5's final turn board. */
export class FramePresenter {
  private display:any=null;
  present(snapshot:any,edge:'before'|'after'='before'):any {
    if(snapshot.provider!=='regional-r05')return snapshot;
    const s=copy(snapshot),v=s.visual;
    if(!v||s.state!=='run.resolving')this.display=copy(s.active);
    else {
      if(!this.display)throw Error('R5 presenter requires the pre-commit stable snapshot');
      if(edge==='before'&&Array.isArray(v.before))this.display.board=copy(v.before);
      if(edge==='after'){
        if(Array.isArray(v.after))this.display.board=copy(v.after);
        else if(Array.isArray(v.board))this.display.board=copy(v.board);
        if(v.goalsAfter)this.display.goals=copy(v.goalsAfter);
        if(v.piecesAfter)this.display.regionPieces=copy(v.piecesAfter);
        for(const hit of v.wave?.obstacleHits||[]){
          if(hit.kind==='moss'&&hit.removed)this.display.moss=this.display.moss.filter((i:number)=>i!==hit.index);
          if(hit.kind==='roots')this.display.roots=this.display.roots.filter((r:any)=>r[0]!==hit.index).concat(hit.after>0?[[hit.index,hit.after]]:[]);
        }
        if(v.kind==='tool'){
          if(v.tool==='sunSeed'&&v.tile)this.display.board[v.index]=copy(v.tile);
          if(v.tool==='prismShift')this.display.regionPieces=this.display.regionPieces.map((p:any)=>p.index===v.from?{...p,index:v.to,shifted:true}:p);
          if(v.tool==='tideAnchor')this.display.scene={...this.display.scene,phase:v.phase,heldTurns:v.heldTurns};
        }
        if(v.kind==='scene')this.display.scene={...this.display.scene,phase:v.after,heldTurns:v.heldTurns,clock:s.active.scene.clock};
      }
      // A commit has consumed a move; do not show final score/goals/pieces until their visual frame.
      this.display.moves=s.active.moves;this.display.tool=copy(s.active.tool);
      s.active=copy(this.display);
    }
    s.stages=[];s.regions=[];s.readOnly=s.state==='error.readonly';
    const region=s.active?.region,names:any={tide:'潮汐小径',meadow:'花粉草甸',sky:'天空回声'};
    s.uiTitle=names[region]||'地区旅程';
    if(s.state==='result.session-saved'){
      s.uiResultTitle=s.active?.status==='won'?'本局完成':'再试一阵风';
      s.uiResultCaption=`${s.active?.score||0} 分 · 本局已保存，成绩未登记`;
      s.uiStatus='未接通关账本，不解锁、不发奖励';
    }else if(s.state==='run.unsaved'||s.state==='error.readonly'){
      s.uiResultTitle=s.state==='run.unsaved'?'保存待重试':'只读保护';
      s.uiResultCaption='保留当前记录，不开启新局';s.uiStatus=s.state==='run.unsaved'?'保存暂未完成 · 请重试':'记录保护 · 请返回检查';
    }else if(s.active){s.uiStatus=s.state==='run.paused'?'已暂停 · 请显式继续':`${names[region]} · ${String(s.active.scene?.phase)} · ${v?.kind||'ready'}`;}
    return s;
  }
}
export function createManagedBoardSession(selection:Selection,deps:Dependencies,stores:DisposableStores,navigation:{exit:()=>Reply;resume:()=>Reply|undefined},afterPaint:(s:any,cells:any[])=>void) {
  if(selection.provider==='mainline'){
    if(!deps.mainlinePort)throw Error('Mainline requires persistent port');
    const session=openMainlineSession({port:deps.mainlinePort,stageId:selection.stageId,seed:selection.seed,navigation});
    let bound:any=null,disposed=false;
    const originalBind=session.binding.bind;
    session.binding.bind=(c:any,v:any)=>bound=originalBind(c,v);
    session.binding.storageEntries=()=>deps.mainlinePort.inspect();
    return {binding:session.binding,controller:session.controller,selection,submit:session.binding.submit,
      command:(name:string,...args:any[])=>disposed?{ok:false,reason:'disposed'}:bound.command(name,...args),
      snapshot:session.snapshot,hide:()=>bound.hide(),show:()=>bound.show(),resume:()=>disposed?{ok:false,reason:'disposed'}:bound.command('resume'),
      requestExit:session.requestExit,dispose:()=>{if(disposed)return {ok:true,duplicate:true};disposed=true;return bound?.dispose();},
      claimMemento:()=>({ok:false,reason:'mainline-has-original-rewards'}),
    };
  }
  // R5 uses injected durable storage; only the existing demo fallback/R4 remains disposable.
  if(selection.provider==='r5'&&!deps.r5Persistence)throw Error('R5 requires persistent Cocos storage; Map fallback forbidden');
  const values=stores[selection.provider];
  const platform=selection.provider==='r5'&&deps.r5Persistence?deps.r5Persistence.platform:deps.r4Persistence?.platform??deps.port.createSynchronousStorage({getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)});
  const controller=selection.provider==='r4'?new deps.R4({platform,journey:deps.mainlinePort?.journey??deps.r4Persistence?.journey}):new deps.R5({platform,journey:deps.r5Persistence?.journey,stageId:selection.stageId,seed:selection.seed});
  if(selection.provider==='r4'){
    const s=controller.snapshot();let result:Reply;
    if(s.active){if(s.active.stageId!==selection.stageId)throw Error('Existing R4 attempt belongs to a different stage');result=controller.resumeActive();}
    else result=controller.startStage(selection.stageId,{seed:selection.seed});
    if(!result.ok)throw Error('R4 open failed: '+result.reason);
  }
  // Selecting a saved failed R5 stage is an explicit new attempt, not a restore loop.
  // Leave playing, unsaved, read-only and completed-win records untouched.
  if(selection.provider==='r5'){
    const s=controller.snapshot();
    if(s.state==='result.saved'&&s.active?.status==='lost'&&s.active.stageId===selection.stageId){
      const opened=controller.startStage(selection.stageId,{seed:selection.seed});
      if(!opened.ok)throw Error('R5 retry could not be saved; existing record retained: '+opened.reason);
    }
  }
  const initial=controller.snapshot();if(!initial.active||initial.active.stageId!==selection.stageId||initial.state==='error.readonly')throw Error('Provider refused selected stage; existing data retained');
  const presenter=new FramePresenter();presenter.present(initial);
  let host:any=null,view:any=null,disposed=false,epoch=0;
  const safeCommand=(name:string,...args:any[]):Reply=>{
    if(disposed)return {ok:false,reason:'disposed'};
    // Do not expose arbitrary stage navigation through the board UI. Retry only
    // the selected, durably saved loss using the provider's existing transaction.
    if(name==='retryStage'){
      const s=controller.snapshot();
      if(args.length||selection.provider!=='r5'||s.state!=='result.saved'||s.active?.status!=='lost'||s.active.stageId!==selection.stageId)
        return {ok:false,reason:'retry-not-available'};
      return host.command('startStage',selection.stageId,{seed:selection.seed});
    }
    if(!BOARD_COMMANDS.has(name))return {ok:false,reason:'host-navigation-only'};
    return host.command(name,...args);
  };
  const submit=(action:any):Reply=>{const preview=safeCommand('previewAction',action);return preview.ok?safeCommand('commitAction',preview.token):preview;};
  const binding={controller,storageEntries:()=>selection.provider==='r5'&&deps.r5Persistence?deps.r5Persistence.inspect():deps.r4Persistence?.inspect()??Array.from(values),
    bind:(_controller:any,nativeView:any)=>{
      if(host)throw Error('Only one NativeBoardUI binding per session');view=nativeView;
      host=deps.port.bindChallengeController(controller,{
        render:(s:any)=>view.render(Object.assign(presenter.present(s),selection.provider==='r5'?(CampaignHost as any).resultPresentation(s):{})),
        animate:(v:any,s:any,done:()=>void)=>{const ownEpoch=epoch;let used=false;
          view.animate(v,presenter.present(s),()=>{
            if(used||disposed||ownEpoch!==epoch)return;used=true;
            // This presenter runs before the port's done callback, possibly on a later tick.
            try{view.render(presenter.present(s,'after'));done();}
            catch(error){
              controller.pause();
              try{host.refresh();}finally{view.onError?.(error);console.error('[QF_BOARD_PRESENTATION_ERROR]',String(error));}
            }
          });},
        cancelAnimations:()=>{epoch++;view.cancelAnimations();},
        onError:(error:Error)=>view.onError?.(error),
      });
      return {command:safeCommand,hide:()=>{epoch++;return host.hide();},show:()=>host.show(),dispose:()=>dispose()};
    },
    intercept:(name:string)=>name==='requestExit'?navigation.exit():name==='resume'?navigation.resume():undefined,
    submit,
    clearNotice:()=>{if(!disposed&&typeof controller.clearNotice==='function')controller.clearNotice();},
    tools:()=>managedTools(controller.snapshot()),
    useTool:(kind:string,index:number):Reply=>{
      const s=controller.snapshot(),tool=s.active?.tool;
      if(selection.provider!=='r5'||kind!==tool?.kind||!tool?.charges)return {ok:false,reason:'no-stage-tool'};
      if(tool.kind==='sunSeed'&&(!Number.isInteger(index)||index<0||index>48))return {ok:false,reason:'先选择播种格'};
      return submit(tool.kind==='sunSeed'?['tool',tool.kind,index]:['tool',tool.kind]);
    },afterPaint,
  };
  function dispose(){if(disposed)return {ok:true,duplicate:true};disposed=true;epoch++;return host?.dispose()||{ok:true};}
  return {binding,controller,selection,submit,command:safeCommand,snapshot:()=>controller.snapshot(),
    hide:()=>{epoch++;return host.hide();},show:()=>host.show(),dispose,
    resume:()=>controller.snapshot().state==='run.paused'?safeCommand('resume'):{ok:true},
    claimMemento:(region:string)=>disposed?{ok:false,reason:'disposed'}:host.command('claimMemento',region),
    requestExit:()=>safeCommand('requestExit'),
  };
}
