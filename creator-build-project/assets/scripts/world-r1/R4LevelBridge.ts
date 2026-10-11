import type { Cancellation, LevelAdapter, LevelLease, Result } from './WorldFlowCore';
/** Passed in by the native board owner. World code gets no Canvas/UI/world node. */
export interface NativeBoardHandle {
  host:{command:(name:string,...args:unknown[])=>Result;hide:()=>unknown;show:()=>unknown;dispose:()=>unknown};
  snapshot:()=>{state:string};
  openStage:(stageId:string)=>Result; // Choose startStage or resumeActive from the actual controller snapshot.
  setVisible:(visible:boolean)=>void;
  destroyView:()=>void; // Destroy only the board owner's own UI/tweens/listeners.
}
/** Uses the existing R4 command interface; it never implements rules, saves or rewards. */
export function createR4LevelAdapter(createBoard:(token:Cancellation)=>Promise<NativeBoardHandle>):LevelAdapter {
  return {enter:async(stageId,token)=>{
    const board=await createBoard(token);let disposed=false;
    const dispose=()=>{if(disposed)return;disposed=true;board.host.dispose();board.destroyView();};
    try {
      token.check();const opened=board.openStage(stageId);if(!opened.ok)throw Error('R4 stage entry: '+opened.reason);
      board.setVisible(true);
      const lease:LevelLease={
        requestExit:()=>board.host.command('requestExit'),
        hide:()=>{board.host.hide();board.setVisible(false);},
        showPaused:()=>{board.host.show();board.setVisible(true);},
        resume:()=>board.snapshot().state==='run.paused'?board.host.command('resume'):{ok:true},
        dispose,
      };
      return lease;
    } catch(e) {dispose();throw e;}
  }};
}
