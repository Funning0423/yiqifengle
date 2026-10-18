import { Node, director } from 'cc';
import { LevelBackgroundBinding } from './LevelBackground';
import type { LevelBackgroundFactory } from './LevelBackground';
import { ManagedMobileBoardUI as NativeBoardUI } from '../ManagedMobileBoardUI';
import R4 from '../r4-cloud-compat/runtime/challenge-controller.js';
import Port from '../r4-cloud-compat/adapter/cocos-port.js';
import R5 from '../regional-r05/runtime/board-session-provider.js';
import type { LevelAdapter, LevelLease, Cancellation, Result } from '../world-r1/WorldFlowCore';
import { createManagedBoardSession } from './ManagedBoardSession';
import type { Selection, DisposableStores } from './ManagedBoardSession';
import { paintRegionalOverlay } from './RegionalOverlay';
import { requiresLakesideScene } from './LevelRegion';
/** Direct adapter to the ACTUAL NativeBoardUI with the managed-mode patch. No idealized boardFactory. */
export function createNativeWorldLevelAdapter(options:{
  uiParent:Node; select:(stageId:string)=>Selection; fixture:any;
  navigation:{exit:()=>Result;resume:()=>Result|undefined};
  stores?:DisposableStores;
  background?:LevelBackgroundFactory;
  onSession?:(session:any)=>void;
  mainlinePort?:any; r4Persistence?:any;
  r5Persistence?:{platform:any;journey:any;inspect:()=>any};
}):LevelAdapter {
  const stores=options.stores??{r4:new Map<string,string>(),r5:new Map<string,string>()};
  let active:LevelLease|null=null;let entering=false;
  return {enter:async(stageId:string,token:Cancellation)=>{
    token.check();if(active||entering)throw Error('Exit and dispose previous board before switching provider');
    const selection=options.select(stageId);if(selection.stageId!==stageId)throw Error('Provider selection changed requested stage');
    entering=true;
    const root=new Node('ManagedNativeBoardHost');root.active=false;options.uiParent.addChild(root);
    const background=new LevelBackgroundBinding(Object.freeze({...selection}));
    const modalNodes:Node[]=[];let presentationPaused=true;
    const syncPaused=()=>background.setPaused(presentationPaused||modalNodes.some(node=>node.active));
    let ui:NativeBoardUI|null=null;
    let session:ReturnType<typeof createManagedBoardSession>|null=null,disposed=false,ownedLease:LevelLease|null=null;
    const dispose=()=>{
      if(disposed)return;disposed=true;
      // Node.destroy() may defer onDestroy until frame end. Surrender the old
      // entry request now, before another lease can attach to the shared loader.
      try{(ui as any)?.releaseEntryResources?.();}
      finally {
        try {
          try { for(const node of modalNodes)node.off(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED,syncPaused);modalNodes.length=0; }
          finally { background.dispose(); }
        } finally {
          try { session?.dispose(); }
          finally { try { options.onSession?.(null); } finally { root.destroy();if(active===ownedLease)active=null; } }
        }
      }
    };
    try {
      // The board's whenInteractive timeout starts only AFTER background.load.
      // Bound this earlier callback too, so a missing resource callback cannot own input forever.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([background.load(options.background,root,token),new Promise<never>((_,reject)=>{
          timer=setTimeout(()=>{console.error('[QF_BOARD_ENTRY_TIMEOUT] background',stageId);reject(Error('enter-level-not-ready'));},12000);
        })]);
      } finally { if(timer!==undefined)clearTimeout(timer); }
      token.check();
      session=createManagedBoardSession(selection,{R4:R4 as any,R5:R5 as any,port:Port,r5Persistence:options.r5Persistence,mainlinePort:options.mainlinePort,r4Persistence:options.r4Persistence},stores,options.navigation,paintRegionalOverlay);
      // Observe the existing presentation callback, never poll/clone controller snapshots each frame.
      // The view owns modal/pause state; the background owns only its presentation clock.
      const bind=session.binding.bind;
      if(typeof bind==='function')session.binding.bind=(controller:any,view:any)=>bind(controller,{
        ...view,render:(snapshot:any)=>{
          presentationPaused=!!snapshot.readOnly||!(snapshot.state==='run.ready'||snapshot.state==='run.resolving');syncPaused();
          return view.render(snapshot);
        },
      });
      ui=root.addComponent(NativeBoardUI);
      if(typeof (ui as any).initializeManaged!=='function')throw Error('Apply NativeBoardUI managed-mode patch before use');
      // Hold touches until WorldFlow reveals, after the shot and a finger-ready board. Test boards leave this unset.
      (ui as any).deferPresentation=true;
      // r4-prep: 风铃湖畔 is entered by landing from the journey; a restored attempt resumes on reveal (no 「暂停一下」 first).
      (ui as any).resumeRestoredOnPresent=requiresLakesideScene(selection);
      (ui as any).initializeManaged(options.fixture,session.binding,background.frame,()=>background.diagnostics());token.check();
      // These existing local dialogs do not change the controller's run state.
      // Observe their active event once, so original boardTime also freezes for bag/restart dialogs.
      const canvasRoot=root.getChildByName?.('NativeBoardCanvas');
      for(const name of ['Backpack','RetryConfirm']){const panel=canvasRoot?.getChildByName(name);if(panel){modalNodes.push(panel);panel.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED,syncPaused);}}
      syncPaused();
      // r4.2 items 10/11: while the cover plays, the UI switches itself on hidden (a slice per frame); reveal then only toggles visibility.
      const afterFrame=(go:()=>void)=>{let done=false;const run=()=>{if(done)return;done=true;if(!disposed&&!token.cancelled)go();};try{director.once('director_after_draw' as any,run);}catch{}};
      const prewarm=(ui as any).prewarmPresentation;if(typeof prewarm==='function')prewarm.call(ui,afterFrame);
      const reveal=()=>{if(disposed)return;root.active=true;background.setVisible(true);const present=(ui as any).presentForPlay;if(typeof present==='function')present.call(ui);};
      const lease:LevelLease={requestExit:()=>session!.requestExit() as Result,
        hide:()=>{root.active=false;background.setPaused(true);try{session!.hide();}finally{background.setVisible(false);}},showPaused:()=>{background.setPaused(true);try{session!.show();}finally{root.active=true;background.setVisible(true);}},
        resume:()=>session!.resume() as Result,dispose,
        isSettledResult:()=>{const s=session!.snapshot();return !s.readOnly&&s.state==='result.saved'&&!!s.active&&(s.active.status==='won'||s.active.status==='lost');},
        whenPlayable:()=>typeof (ui as any).whenInteractive==='function'?(ui as any).whenInteractive():Promise.resolve(),
        reveal};
      // Host stays hidden so the island shot is what the player sees. r4.2: the background stays invisible (camera off, no sun/fog write)
      // until reveal; its scene is already active under the host by then, so the swap frame only turns its camera on.
      ownedLease=lease;active=lease;options.onSession?.(session);return lease;
    }catch(e){dispose();throw e;}finally{entering=false;}
  }};
}
