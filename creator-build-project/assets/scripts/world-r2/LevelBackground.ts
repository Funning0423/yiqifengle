import type { Node } from 'cc';
import type { Cancellation } from '../world-r1/WorldFlowCore';
import type { Selection } from './ManagedBoardSession';
/** The composition root must supply verified region art and framing. No fallback island, loading art or solid fill. */
/** board: optional 2D grid rect (BoardLayout.grid, centre x/y and side, top-left px) so a 3D background can align to it. */
export type LevelBackgroundFrame=Readonly<{width:number;height:number;boardTop:number;board?:Readonly<{x:number;y:number;size:number}>}>;
export interface LevelBackgroundLease {
  frame(portrait:boolean,layout?:LevelBackgroundFrame):void;
  setVisible(visible:boolean):void;
  /** Presentation clock only. Pausing must not hide the last rendered scenery. */
  setPaused?(paused:boolean):void;
  diagnostics?():Readonly<Record<string,unknown>>;
  /** Optional node-board camera. Leases that omit it keep the single regional pose. */
  setAnchor?(pose:Readonly<{position:readonly [number,number,number];target:readonly [number,number,number];fovVerticalDeg:number}>):void;
  /** cand8: optional presentation fade, alpha 1 (full) → 0 (gone). Leases that cannot blend keep drawing until alpha reaches 0. */
  setFade?(alpha:number):void;
  dispose():void;
}
/** cand8: board 3D background fade-out length (Grok Bot: 0.3 s, not an instant switch-off on dispose). */
export const BACKGROUND_FADE_SECONDS=0.3;
/** Pure: eased (smoothstep) alpha at t seconds into a fade of the given length. Monotone, 1 at t≤0, 0 at t≥seconds. */
export function backgroundFadeAlpha(t:number,seconds:number=BACKGROUND_FADE_SECONDS):number{
  if(!(seconds>0))return 0;const u=Math.min(1,Math.max(0,t/seconds));return 1-u*u*(3-2*u);
}
/** Mount under parent, initially hidden. Check token before async writes; release partial resources on failure.
 * Use dedicated background rendering behind UI (priority < 50), never mutate the world camera or Flow layers. */
export type LevelBackgroundFactory=(context:{parent:Node;selection:Readonly<Selection>;token:Cancellation})=>Promise<LevelBackgroundLease|null>|LevelBackgroundLease|null;
export type LevelBackgroundStatus=Readonly<{state:'missing-provider'|'loading'|'ready'|'error'|'disposed';stageId:string;error?:string;rendering?:Readonly<Record<string,unknown>>}>;
/** Owns exactly one stage's background, including late async completion after cancellation. */
export class LevelBackgroundBinding {
  private lease:LevelBackgroundLease|null=null;
  private disposed=false;
  private started=false;
  private paused=true;
  private portrait:boolean|undefined;
  private layout:LevelBackgroundFrame|undefined;
  private state:LevelBackgroundStatus;
  private selection:Readonly<Selection>;
  constructor(selection:Readonly<Selection>){this.selection=selection;this.state={state:'missing-provider',stageId:selection.stageId};}
  diagnostics():LevelBackgroundStatus{return {...this.state,...(this.lease?.diagnostics?{rendering:this.lease.diagnostics()}:{} )};}
  async load(factory:LevelBackgroundFactory|undefined,parent:Node,token:Cancellation):Promise<void>{
    token.check();if(this.disposed)throw Error('Background already disposed');if(this.started)throw Error('Background already initialized');this.started=true;
    if(!factory){console.warn('LEVEL_BACKGROUND_MISSING_PROVIDER '+this.selection.stageId);return;}
    this.state={state:'loading',stageId:this.selection.stageId};
    // The extra continuation releases a provider which ignores cancellation and resolves late.
    const pending=Promise.resolve().then(()=>{token.check();return factory({parent,selection:this.selection,token});}).then(lease=>{
      if(this.disposed||token.cancelled){lease?.dispose();token.check();throw Error('Background disposed during load');}
      if(!lease){this.state={state:'missing-provider',stageId:this.selection.stageId};console.warn('LEVEL_BACKGROUND_MISSING_PROVIDER '+this.selection.stageId);return;}
      this.lease=lease;
      lease.setVisible(false);
      lease.setPaused?.(this.paused);
      if(this.portrait!==undefined)lease.frame(this.portrait,this.layout);
      this.state={state:'ready',stageId:this.selection.stageId};
    });
    try{await token.wait(pending);token.check();}
    catch(error){if(!this.disposed)this.state={state:'error',stageId:this.selection.stageId,error:String(error)};throw error;}
  }
  frame=(portrait:boolean,layout?:LevelBackgroundFrame):void=>{if(this.disposed)return;this.portrait=portrait;this.layout=layout;this.lease?.frame(portrait,layout);};
  setVisible(visible:boolean):void{if(this.disposed)return;this.lease?.setVisible(visible);}
  setPaused(paused:boolean):void{if(this.disposed)return;this.paused=paused;this.lease?.setPaused?.(paused);}
  /** cand8: fade the background out over `seconds` (default 0.3 s) on the caller's frame clock, then dispose it.
   *  tick(dt) is called once per drawn frame; resolves after the frame on which alpha reached 0. Never a blank frame:
   *  the lease keeps drawing (setVisible untouched) until it is disposed at alpha 0. */
  fadeOut(seconds:number=BACKGROUND_FADE_SECONDS,onFrame:(tick:(dt:number)=>boolean)=>void):Promise<void>{
    if(this.disposed||!this.lease){this.dispose();return Promise.resolve();}
    return new Promise<void>(resolve=>{let t=0;this.fading=true;const lease=this.lease;
      onFrame(dt=>{if(this.disposed){resolve();return true;}t+=Math.min(.05,Math.max(0,dt));const a=backgroundFadeAlpha(t,seconds);
        try{lease?.setFade?.(a);}catch{}
        if(a<=0){this.dispose();resolve();return true;}return false;});});
  }
  get isFading():boolean{return this.fading;}
  private fading=false;
  dispose():void{if(this.disposed)return;this.disposed=true;const lease=this.lease;this.lease=null;this.state={state:'disposed',stageId:this.selection.stageId};lease?.dispose();}
}
