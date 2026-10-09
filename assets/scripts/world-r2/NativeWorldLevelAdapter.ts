import { Node } from 'cc';
import { ManagedMobileBoardUI as NativeBoardUI } from '../ManagedMobileBoardUI';
import R4 from '../r4-cloud-compat/runtime/challenge-controller.js';
import Port from '../r4-cloud-compat/adapter/cocos-port.js';
import R5 from '../regional-r05/runtime/board-session-provider.js';
import type { LevelAdapter, LevelLease, Cancellation, Result } from '../world-r1/WorldFlowCore';
import { createManagedBoardSession } from './ManagedBoardSession';
import type { Selection, DisposableStores } from './ManagedBoardSession';
import { paintRegionalOverlay } from './RegionalOverlay';
/** Direct adapter to the ACTUAL NativeBoardUI with the managed-mode patch. No idealized boardFactory. */
export function createNativeWorldLevelAdapter(options:{
  uiParent:Node; select:(stageId:string)=>Selection; fixture:any;
  navigation:{exit:()=>Result;resume:()=>Result|undefined};
  stores?:DisposableStores;
  onSession?:(session:any)=>void;
  mainlinePort?:any; r4Persistence?:any;
  r5Persistence?:{platform:any;journey:any;inspect:()=>any};
}):LevelAdapter {
  const stores=options.stores??{r4:new Map<string,string>(),r5:new Map<string,string>()};
  let active:LevelLease|null=null;
  return {enter:async(stageId:string,token:Cancellation)=>{
    token.check();if(active)throw Error('Exit and dispose previous board before switching provider');
    const selection=options.select(stageId);if(selection.stageId!==stageId)throw Error('Provider selection changed requested stage');
    const root=new Node('ManagedNativeBoardHost');root.active=false;options.uiParent.addChild(root);
    let session:ReturnType<typeof createManagedBoardSession>|null=null,disposed=false;
    const dispose=()=>{if(disposed)return;disposed=true;session?.dispose();options.onSession?.(null);root.destroy();active=null;};
    try {
      session=createManagedBoardSession(selection,{R4:R4 as any,R5:R5 as any,port:Port,r5Persistence:options.r5Persistence,mainlinePort:options.mainlinePort,r4Persistence:options.r4Persistence},stores,options.navigation,paintRegionalOverlay);
      const ui=root.addComponent(NativeBoardUI);
      if(typeof (ui as any).initializeManaged!=='function')throw Error('Apply NativeBoardUI managed-mode patch before use');
      (ui as any).initializeManaged(options.fixture,session.binding);token.check();
      const lease:LevelLease={requestExit:()=>session!.requestExit() as Result,
        hide:()=>{session!.hide();root.active=false;},showPaused:()=>{session!.show();root.active=true;},
        resume:()=>session!.resume() as Result,dispose};
      root.active=true;active=lease;options.onSession?.(session);return lease;
    }catch(e){dispose();throw e;}
  }};
}
