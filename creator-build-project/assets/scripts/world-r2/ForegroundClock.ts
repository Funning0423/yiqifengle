/** r4.1b: foreground-only time for host-side waits (home walk / home fade watchdog, cover ramps). Pure (no cc imports).
 *  It advances only by frame dt while the world is visible and running, capped per frame like WorldFlowComponent's own
 *  step (0.1 s), so a background stay of any length (3 s, 10 s, 60 s, 10 min) adds at most one capped frame. The walk it
 *  guards is driven by the same frame clock, so the watchdog and the walk pause and resume together. */
export const FOREGROUND_MAX_STEP_S=.1;
export class ForegroundTimers{
  private t=0;private waits:{at:number;r:()=>void}[]=[];
  /** Foreground seconds since creation. */
  readonly now=():number=>this.t;
  /** Resolves after `seconds` of foreground time (never rejects). */
  readonly wait=(seconds:number):Promise<void>=>new Promise<void>(r=>{this.waits.push({at:this.t+Math.max(0,Number(seconds)||0),r});});
  /** One frame: `paused` = the flow is hidden or waiting for an explicit resume (the walk is frozen too). */
  tick(dt:number,paused:boolean):void{if(!paused&&Number.isFinite(dt)&&dt>0)this.t+=Math.min(dt,FOREGROUND_MAX_STEP_S);}
  flush():void{if(!this.waits.length)return;const now=this.t,due=this.waits.filter(w=>w.at<=now);this.waits=this.waits.filter(w=>w.at>now);for(const w of due)w.r();}
  pending():number{return this.waits.length;}
}
