/** P0 fin (Mac fc3123fa / 7e0f2c72: lake-02 freezes under 5–6 GB swap): regions she has LEFT give their assets back.
 *  Pure ledger, no engine import (box-testable). Safe by construction:
 *   - only RELEASABLE regions (meadow, sail); island / skycity / balloon / lakeside are never released (ending returns to skycity);
 *   - assets are released ONLY by refcount: the ledger takes exactly one addRef per asset when it is loaded and gives exactly
 *     that one back with decRef(); the engine frees an asset only when nobody else holds it;
 *   - only after the exit transition has fully finished, after no live node references any held asset, and at least one drawn
 *     frame later (re-checked after the frame). Anything not met → nothing released, reason returned and logged. */
export const RELEASABLE_REGIONS=Object.freeze(['meadow','sail'] as const);
export const RETAINED_REGIONS=Object.freeze(['island','skycity','balloon','lakeside'] as const);
export type RefAsset={addRef():unknown;decRef(autoRelease?:boolean):unknown;readonly refCount?:number;name?:string;_nativeAsset?:unknown};
export type ReleaseEnv={
 transitionDone():boolean;               // her exit transition from the region has fully finished
 referenced(asset:RefAsset):boolean;     // a live (not destroyed) node / renderer still uses this asset
 nextFrame():Promise<void>;              // resolves after at least one drawn frame
 bytesEst(asset:RefAsset):number;
 log(line:string):void;
};
export type ReleaseResult={region:string;released:number;bytesEst:number;reason:'released'|'retained-region'|'nothing-held'|'transition-pending'|'still-referenced'|'busy'};
export class RegionReleaseLedger{
 private held=new Map<string,Set<RefAsset>>();private busy=new Set<string>();
 /** Take the region's one ref on a freshly loaded asset (idempotent per asset). Retained regions are not tracked. */
 hold(region:string,asset:RefAsset|null|undefined):void{
  if(!asset||!(RELEASABLE_REGIONS as readonly string[]).includes(region))return;
  let s=this.held.get(region);if(!s)this.held.set(region,s=new Set());if(s.has(asset))return;asset.addRef();s.add(asset);}
 count(region:string):number{return this.held.get(region)?.size??0;}
 async release(region:string,env:ReleaseEnv):Promise<ReleaseResult>{
  const out=(reason:ReleaseResult['reason'],released=0,bytesEst=0):ReleaseResult=>({region,released,bytesEst,reason});
  if(!(RELEASABLE_REGIONS as readonly string[]).includes(region))return out('retained-region');
  const s=this.held.get(region);if(!s||!s.size)return out('nothing-held');
  if(this.busy.has(region))return out('busy');
  const check=():ReleaseResult['reason']|null=>{if(!env.transitionDone())return 'transition-pending';for(const a of s)if(env.referenced(a))return 'still-referenced';return null;};
  const first=check();if(first)return out(first);
  this.busy.add(region);
  try{
   await env.nextFrame();
   const again=check();if(again)return out(again);
   let n=0,bytes=0;const list=Array.from(s);s.clear();
   for(const a of list){bytes+=Math.max(0,env.bytesEst(a)||0);try{a.decRef(true);n++;}catch{}}
   env.log('[QF_RELEASE] '+JSON.stringify({region,assets:n,bytesEst:bytes}));
   return out('released',n,bytes);
  }finally{this.busy.delete(region);}
 }
}
