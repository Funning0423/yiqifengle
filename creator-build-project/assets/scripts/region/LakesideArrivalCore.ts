/** T-03 风铃湖畔 arrival UI core (GGbot; UI设计部 SPEC §6, ui/post-island-ui 6d93c1f4). Pure: no engine imports.
 *  - Place-name sign: timing comes from LAKESIDE_TOUCHDOWN (signAtS / signS) or from an explicit arrival event, never
 *    hard-coded here; 运镜bot can retime the landing by changing those constants or by passing {signAtS, signS} in the event.
 *  - Skip badge: from the 2nd viewing (seenT03 in the normal save), only during the visible flight; a tap runs a WindWipe
 *    kind 'ride' and calls the registered ride-skip handler under the cover (registerLakesideRideSkip, for 运镜bot).
 *  - Arrival trace: __qfLakesideArrival marks (touchdown → ride-resolved → landing-hook → board-load → interactive). */
export const LAKESIDE_TOUCHDOWN_EVENT='qf-lakeside-touchdown';
/** fired by the ride when it reaches touchdown after a skip (the sign shows at reveal + revealSignS instead of signAtS) */
export const LAKESIDE_SIGN_SPEC={w:176,h:54,font:22,spacing:3,color:[0x5a,0x3a,0x1e],shadow:[0xff,0xfa,0xec],shadowPt:2,
 night:[.85,.85,.92],belowCapsule:24,dropPt:12,inS:.3,outS:.2,revealSignS:.3,text:'风铃湖畔',
 /** fallback capsule bottom on the 390×844 reference (SPEC: centre y 139) */refCapsuleBottom:88} as const;
export const LAKESIDE_SKIP_SPEC={w:76,h:32,r:16,hitW:88,hitH:48,edge:16,dayBg:[0xff,0xf6,0xe2],nightBg:[0x28,0x30,0x4c],bgA:.55,
 dayText:[0x5a,0x3a,0x1e],nightText:[0xff,0xec,0xc8],textA:.85,font:14,arrowPt:1.6,text:'跳过',
 inAfterFlightS:3.0,fadeS:.4,outBeforeTouchdownS:1.0,pressScale:.94,pressS:.12} as const;
export type Rect={x:number;y:number;w:number;h:number};/* screen px, y down, x/y = top-left */
const sm=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
const easeInQuad=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x;};
export type SignTiming={signAtS:number;signS:number};
/** sign state at time `since` (s) after the arrival anchor (touchdown, or the skip reveal). alpha 0..1, dy pt (+ = up). */
export function signState(since:number,t:SignTiming,spec=LAKESIDE_SIGN_SPEC):{visible:boolean;alpha:number;dy:number;done:boolean}{
 const u=since-t.signAtS,S=Math.max(spec.inS+spec.outS,t.signS);
 if(!(u>=0))return {visible:false,alpha:0,dy:spec.dropPt,done:false};
 if(u>=S)return {visible:false,alpha:0,dy:-spec.dropPt,done:true};
 if(u<spec.inS){const k=sm(u/spec.inS);return {visible:true,alpha:k,dy:spec.dropPt*(1-k),done:false};}
 const o=u-(S-spec.outS);if(o>0){const k=easeInQuad(o/spec.outS);return {visible:true,alpha:1-k,dy:-spec.dropPt*k,done:false};}
 return {visible:true,alpha:1,dy:0,done:false};}
export const rectsOverlap=(a:Rect,b:Rect)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
/** Sign centre (screen px, y down). SPEC: horizontally centred, centre y = capsule bottom + 24 + 27. If that rect would cover
 *  her or the balloon (envelope + ropes + basket: `avoid`, projected screen rects), it moves up into the strip between the
 *  capsule top and the safe top only if it fits, else just below the lowest avoid rect, else stays (logged as overlap). */
export function signPlacement(w:number,h:number,capsuleBottom:number|null,avoid:readonly Rect[]=[],safeTop=47,spec=LAKESIDE_SIGN_SPEC):{cx:number;cy:number;rect:Rect;moved:'spec'|'below'|'overlap'}{
 const cb=capsuleBottom??spec.refCapsuleBottom*Math.min(1,h/844),cx=w/2,mk=(cy:number):Rect=>({x:cx-spec.w/2,y:cy-spec.h/2-spec.dropPt,w:spec.w,h:spec.h+2*spec.dropPt});
 const cy0=cb+spec.belowCapsule+spec.h/2,hit=(r:Rect)=>avoid.some(a=>rectsOverlap(r,a));
 if(!hit(mk(cy0)))return {cx,cy:cy0,rect:mk(cy0),moved:'spec'};
 const low=Math.max(...avoid.filter(a=>rectsOverlap(mk(cy0),a)).map(a=>a.y+a.h)),cy1=low+spec.belowCapsule+spec.h/2;
 const r1=mk(cy1);if(r1.y+r1.h<h*.55&&!hit(r1))return {cx,cy:cy1,rect:r1,moved:'below'};
 return {cx,cy:cy0,rect:mk(cy0),moved:'overlap'};}
/** Skip badge: bottom-right; hit area outer edge 16 pt from the right and from the safe bottom (home bar inset included). */
export function skipPlacement(w:number,h:number,safeBottom:number,spec=LAKESIDE_SKIP_SPEC):{cx:number;cy:number;hit:Rect;pill:Rect}{
 const hit={x:w-spec.edge-spec.hitW,y:h-safeBottom-spec.edge-spec.hitH,w:spec.hitW,h:spec.hitH},cx=hit.x+hit.w/2,cy=hit.y+hit.h/2;
 return {cx,cy,hit,pill:{x:cx-spec.w/2,y:cy-spec.h/2,w:spec.w,h:spec.h}};}
/** Badge alpha during the ride: in 3.0 s after the flight starts (cover revealed), out 1.0 s before touchdown; 0 if not seen. */
export function skipAlpha(rideT:number,flightAt:number,touchdownAt:number,seen:boolean,spec=LAKESIDE_SKIP_SPEC):number{
 if(!seen||!(touchdownAt>flightAt))return 0;const a=flightAt+spec.inAfterFlightS,b=touchdownAt-spec.outBeforeTouchdownS;if(b<=a)return 0;
 return Math.max(0,Math.min(1,(rideT-a)/spec.fadeS,(b-rideT)/spec.fadeS));}
/** --- seen flag (normal save: the same storage the game already uses for its local markers) --- */
export const SEEN_T03_KEY='qf-seen-t03';
export type KV={getItem(k:string):string|null;setItem(k:string,v:string):void};
export function seenT03(kv:KV|null|undefined):boolean{try{return kv?.getItem(SEEN_T03_KEY)==='1';}catch{return false;}}
export function markSeenT03(kv:KV|null|undefined):void{try{kv?.setItem(SEEN_T03_KEY,'1');}catch{/* storage optional */}}
/** --- ride state published by the lakeside ride every frame (RegionJourneyAdapter) --- */
export type LakesideRideState={t:number;flightAt:number;touchdownAt:number;skippable:boolean;landed:boolean;skipped:boolean};
let rideState:LakesideRideState|null=null;
export function publishLakesideRide(s:LakesideRideState|null){rideState=s;try{(globalThis as any).__qfLakesideRide=s;}catch{}}
export function lakesideRide():LakesideRideState|null{return rideState;}
/** --- ride-skip API (for 运镜bot): the ride registers what "skip to touchdown" means; the badge only calls it under the
 *  WindWipe 'ride' cover. The handler must place her/the basket in the landed state synchronously or return a promise that
 *  resolves once placed; the wipe reveal waits for it (and for lakesideRide().landed). One skip per ride. --- */
type SkipFn=()=>void|Promise<unknown>;let skipFn:SkipFn|null=null;
export function registerLakesideRideSkip(fn:SkipFn|null):()=>void{skipFn=fn;return ()=>{if(skipFn===fn)skipFn=null;};}
export function canSkipLakesideRide():boolean{return !!skipFn&&!!rideState&&rideState.skippable&&!rideState.landed&&!rideState.skipped;}
export async function runLakesideRideSkip():Promise<{ok:boolean;reason?:string}>{
 const f=skipFn;if(!f||!canSkipLakesideRide())return {ok:false,reason:'not-skippable'};skipFn=null;
 try{await f();return {ok:true};}catch(e){return {ok:false,reason:String((e as any)?.message||e)};}}
/** --- arrival anchor (touchdown or skip reveal) consumed by the sign --- */
export type ArrivalAnchor={at:number/* game clock s */;signAtS:number;signS:number;via:'touchdown'|'skip'};
export function arrivalAnchor(now:number,via:'touchdown'|'skip',k:{signAtS:number;signS:number},ev?:Partial<SignTiming>|null,spec=LAKESIDE_SIGN_SPEC):ArrivalAnchor{
 const signS=Number.isFinite(ev?.signS as number)?ev!.signS!:k.signS;
 const signAtS=via==='skip'?spec.revealSignS:Number.isFinite(ev?.signAtS as number)?ev!.signAtS!:k.signAtS;
 return {at:now,signAtS,signS,via};}
/** --- arrival trace (P1 45 s investigation): wall-clock ms marks, first write wins per key per ride --- */
export function arrivalMark(key:string,data?:Record<string,unknown>){try{const g=globalThis as any;if(key==='ride-start')g.__qfLakesideArrival={};const a=g.__qfLakesideArrival||(g.__qfLakesideArrival={});
 if(a[key]===undefined){a[key]={ms:Date.now(),...(data||{})};const t0=a.touchdown?.ms;if(t0!==undefined)a[key].afterTouchdownS=+((Date.now()-t0)/1000).toFixed(2);
  try{console.info('[QF_LAKESIDE_ARRIVAL] '+key+(a[key].afterTouchdownS!==undefined?' +'+a[key].afterTouchdownS+'s':''));}catch{}}}catch{/* trace only */}}
try{(globalThis as any).__qfArrivalMark=arrivalMark;}catch{/* trace only */}
