/** v3.3: one full-screen cover shared by flow transitions (04→05 set-off fade; 主页 uses the same cover in 88506aa).
 * Pure registry (no cc imports): WorldIntegrationBoot registers its UI cover; WorldFlowComponent's WorldLease.fadeCover
 * forwards here. No cover registered = transitions run without a fade (old behaviour).
 * WindWipe (SPEC post-island §1): the registered cover draws the 风云擦除 cloud band instead of black. Callers may also set the
 * hold content (one vehicle + one sign), fade music with the picture and gate the reveal on readiness (load / placement). */
export type ScreenCoverFn=(alpha:number,seconds:number)=>Promise<void>;
export type CoverContent={vehicle:'sailboat'|'balloon'|'chime'|null;sign:string|null};
let cover:ScreenCoverFn|null=null;
let content:((c:CoverContent|null)=>void)|null=null;
let audio:{out(seconds:number):void;in(seconds:number):void}|null=null;
const readyChecks=new Set<()=>boolean>();
export function setScreenCover(fn:ScreenCoverFn|null):void{cover=fn;}
export function hasScreenCover():boolean{return !!cover;}
export function screenCover(alpha:number,seconds:number):Promise<void>{return cover?cover(alpha,seconds):Promise.resolve();}
export function setCoverContentHost(fn:((c:CoverContent|null)=>void)|null):void{content=fn;}
export function coverContent(c:CoverContent|null):void{try{content?.(c);}catch{}}
export function setCoverAudioHost(a:{out(seconds:number):void;in(seconds:number):void}|null):void{audio=a;}
export function coverAudioOut(seconds:number):void{try{audio?.out(seconds);}catch{}}
export function coverAudioIn(seconds:number):void{try{audio?.in(seconds);}catch{}}
/** Reveal gate: every registered check must pass (scene loaded, loading layer settled …). Throwing counts as not ready. */
export function addCoverReadyCheck(fn:()=>boolean):()=>void{readyChecks.add(fn);return ()=>{readyChecks.delete(fn);};}
export function coverReady():boolean{for(const f of Array.from(readyChecks)){try{if(!f())return false;}catch{return false;}}return true;}
/** ── WindWipe lifecycle hooks (for 运镜bot camera shots and any scene code) ─────────────────────────────────────────────
 *  Every WindWipe transition (TR1 sail, TR3 balloon, island set-off, TR8 主页, TR9 ending, 回小岛) emits, in order:
 *   1. onWipeCovered(e)       — the cloud band is fully opaque. Safe to switch/load scenes and place camera + character.
 *   2. addWipeBeforeReveal(f) — awaited after the minimum hold; the reveal does not start until every hook resolves (and
 *                               every addCoverReadyCheck passes). Return a Promise (or false = "poll me again next frame").
 *   3. onWipeRevealed(e)      — the IN ramp finished; the scene is fully visible (start idle cams / hints here).
 *  e = {id, kind, content}. kind: 'setoff'|'ride'|'home'|'ending'|'ending-home'. All hooks are try/catch-guarded; a hook that
 *  never resolves is cut at WINDWIPE.maxHoldS (warned) so the game cannot lock behind the cloud.
 *  Example (运镜bot):
 *    const off=addWipeBeforeReveal(async e=>{ if(e.kind==='ride'){ placeRideCamera(); await lensSettled(); } });
 *    onWipeRevealed(e=>startArrivalShot(e.content?.sign));   // both return an unsubscribe function */
export type WipeEvent={id:number;kind:string;content:CoverContent|null};
const covered=new Set<(e:WipeEvent)=>void>(),revealed=new Set<(e:WipeEvent)=>void>(),before=new Set<(e:WipeEvent)=>Promise<unknown>|boolean|void>();
let wipeSerial=0;
export function onWipeCovered(fn:(e:WipeEvent)=>void):()=>void{covered.add(fn);return ()=>{covered.delete(fn);};}
export function onWipeRevealed(fn:(e:WipeEvent)=>void):()=>void{revealed.add(fn);return ()=>{revealed.delete(fn);};}
export function addWipeBeforeReveal(fn:(e:WipeEvent)=>Promise<unknown>|boolean|void):()=>void{before.add(fn);return ()=>{before.delete(fn);};}
export function newWipeEvent(kind:string,content:CoverContent|null):WipeEvent{return {id:++wipeSerial,kind,content};}
export function emitWipeCovered(e:WipeEvent):void{for(const f of Array.from(covered)){try{f(e);}catch(err){console.warn('[WindWipe] covered hook',String(err));}}}
export function emitWipeRevealed(e:WipeEvent):void{for(const f of Array.from(revealed)){try{f(e);}catch(err){console.warn('[WindWipe] revealed hook',String(err));}}}
/** Runs every beforeReveal hook once; returns a predicate that is true once all have settled (promises resolved/rejected,
 *  boolean hooks returned true when re-polled). Hosts poll it together with coverReady() each frame. */
export function startWipeBeforeReveal(e:WipeEvent):()=>boolean{
  const pend:{done:boolean;poll?:()=>boolean}[]=[];
  for(const f of Array.from(before)){const p={done:false} as {done:boolean;poll?:()=>boolean};pend.push(p);
    try{const r=f(e);if(r&&typeof (r as any).then==='function')(r as Promise<unknown>).then(()=>{p.done=true;},()=>{p.done=true;});
      else if(r===false)p.poll=()=>{try{return f(e)!==false;}catch{return true;}};else p.done=true;}catch{p.done=true;}}
  return ()=>{let ok=true;for(const p of pend){if(!p.done&&p.poll&&p.poll())p.done=true;if(!p.done)ok=false;}return ok;};
}
