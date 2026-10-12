/** T0 boot timing (GGbot): startup-phase GB_MARK boot:* timeline. Pure logic, no 'cc' import (glue lives in GrokbotAutoplay.ts BootProbe).
 * Debug/test-build only: copied into assets/ ONLY by install.sh, so the release build has zero bytes of it.
 * Every boot mark carries t=<ms since the boot origin>. Origin, best first:
 *   prelude-game.js        = Date.now() at the first line of game.js (prelude/gb-touch-prelude.js, inject_prelude.sh; autoplay builds)
 *   performance.timeOrigin = page/runtime origin when the platform exposes it (web preview; WeChat usually does not)
 *   t0-eval                = Date.now() when this T0 module was evaluated (everything earlier is then invisible)
 * Loose-ES5 safe: no spread / for-of over Map or Set; plain objects and arrays only. */
export type BootOriginVia='prelude-game.js'|'performance.timeOrigin'|'t0-eval';
export type BootOrigin={epoch:number;via:BootOriginVia};
const sane=(n:any,now:number)=>typeof n==='number'&&isFinite(n)&&n>1e12&&n<=now+1000;
export function pickOrigin(g:any,nowEpoch:number):BootOrigin{
 try{const p=g&&g.__gbBoot;if(p&&sane(p.epoch,nowEpoch))return {epoch:p.epoch,via:'prelude-game.js'};}catch(e){/* ignore */}
 try{const to=g&&g.performance&&g.performance.timeOrigin;if(sane(to,nowEpoch))return {epoch:to,via:'performance.timeOrigin'};}catch(e){/* ignore */}
 return {epoch:nowEpoch,via:'t0-eval'};
}
/** Value-safe token for a mark field (no spaces). */
export function tok(v:any):string{const s=v===undefined||v===null||v===''?'-':String(v);return s.replace(/\s+/g,'_').slice(0,120);}
/** Deltas printed by boot:summary (from -> to); a missing end point prints '-'. */
export const SUMMARY_DELTAS:ReadonlyArray<readonly [string,string,string]>=[
 ['gameJsToT0','game-js','t0-eval'],
 ['engineToT0','engine-init','t0-eval'],
 ['t0ToSceneLaunch','t0-eval','scene-launch-end'],
 ['sceneToWorldLoading','scene-launch-end','world-loading'],
 ['islandBundle','bundle-begin:region_island','bundle-end:region_island'],
 ['islandBundleToReady','bundle-end:region_island','world-ready'],
 ['readyToHidden','world-ready','loading-hidden'],
 ['hiddenToFrame','loading-hidden','room-first-frame'],
 ['worldLoadingToFrame','world-loading','room-first-frame'],
];
/** Keys listed (with their t) in boot:summary, in this order when present. */
export const SUMMARY_KEYS=['game-js','engine-init','t0-eval','game-inited','splash-end','scene-loading','scene-launch-begin','scene-launch-end','boot-found',
 'world-loading','loading-shown','loading-image','bundle-begin:resources','bundle-end:resources','bundle-begin:region_island','bundle-end:region_island',
 'subpackage:region_island','loading-fade-start','world-ready','loading-hidden','room-first-frame'];
export class BootTimeline {
 readonly t:Record<string,number>={};private summaryDone=false;
 constructor(readonly origin:BootOrigin,private nowEpoch:()=>number,private emit:(name:string,extra:string)=>void){}
 rel(epoch?:number):number{return Math.round((epoch===undefined?this.nowEpoch():epoch)-this.origin.epoch);}
 has(key:string){return this.t[key]!==undefined;}
 /** Once per key: boot:<key> t=<ms> [extra]. Returns false if the key was already set. */
 point(key:string,extra?:string,epoch?:number):boolean{if(this.t[key]!==undefined)return false;const v=this.rel(epoch);this.t[key]=v;this.emit('boot:'+key,'t='+v+(extra?' '+extra:''));return true;}
 /** Repeatable: boot:<name> t=<ms> [extra]; not kept for the summary. */
 note(name:string,extra?:string,epoch?:number):void{this.emit('boot:'+name,'t='+this.rel(epoch)+(extra?' '+extra:''));}
 get summarized(){return this.summaryDone;}
 /** ONE line: origin, every known key's t, the fixed deltas. reason=room-first-frame|cap-<ms>. */
 summary(reason:string):string|null{if(this.summaryDone)return null;this.summaryDone=true;
  const parts:string[]=['origin='+this.origin.via,'reason='+tok(reason)];
  for(let i=0;i<SUMMARY_KEYS.length;i++){const k=SUMMARY_KEYS[i];if(this.t[k]!==undefined)parts.push(k+'='+this.t[k]);}
  for(let i=0;i<SUMMARY_DELTAS.length;i++){const d=SUMMARY_DELTAS[i],a=this.t[d[1]],b=this.t[d[2]];parts.push('d.'+d[0]+'='+(a!==undefined&&b!==undefined?String(b-a):'-'));}
  const total=this.t['room-first-frame'];parts.push('total='+(total!==undefined?String(total):'-'));
  if(total===undefined)parts.push('incomplete=1');
  const line=parts.join(' ');this.note('summary',line);return line;}
}
