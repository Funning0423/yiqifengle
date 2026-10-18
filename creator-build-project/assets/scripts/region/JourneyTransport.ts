import type {JourneyRegion as CoreJourneyRegion} from '../world-r1/RegionJourneyCore';
/** Rainbow-bridge switch. island→meadow is sail, meadow→skycity is balloon, skycity→lakeside is balloon.
 * Unknown pairs still report bridge. `?transport=bridge` and `__QF_TRANSPORT=bridge` are ignored with a warn.
 * A slow sail preload stays on the sail. The island→lakeside bridge row is gone. */
export type TransportKind='bridge'|'sail'|'balloon';
export type JourneyRegion=CoreJourneyRegion;
export const JOURNEY_TRANSPORT:{'island-meadow':TransportKind;'meadow-skycity':TransportKind;'skycity-lakeside':TransportKind}={
 'island-meadow':'sail','meadow-skycity':'balloon','skycity-lakeside':'balloon',
};
function warnKept(via:string,requested:string,kept:string):void{
 try{console.warn('[QF_TRANSPORT] '+JSON.stringify({event:'bridge-ignored',via,requested,kept}));}catch{/* ignore */}
}
/** Old preload hook. A slow meadow warm no longer selects the bridge. */
export function noteSailPreloadFallback(reason:string):void{
 warnKept('sail-preload',String(reason||'slow'),'sail');
}
export function sailPreloadFellBack():boolean{return false;}
/** QA builds only: web (no wx) or a WeChat develop/trial env. Release minigames ignore the query. */
export function transportQaEnabled(host:any=(globalThis as any).wx):boolean{
 if(!host)return true;
 try{const env=host.getAccountInfoSync?.()?.miniProgram?.envVersion;return env==='develop'||env==='trial';}catch{return false;}
}
/** Balloon callers pass a host (`globalThis` or `{wx,__QF_TRANSPORT,location}`). No wx means QA is on. */
export function qaTransportEnabled(host:any=globalThis):boolean{
 try{
  const wx=host?.wx;if(!wx)return true;
  const env=wx.getAccountInfoSync?.()?.miniProgram?.envVersion;
  if(env==='develop'||env==='trial')return true;
  return false;
 }catch{return false;}
}
export function transportQaOverride(search?:string,host:any=(globalThis as any).wx):TransportKind|null{
 let q=search;
 if(q===undefined){try{q=String((globalThis as any).location?.search||'');}catch{q='';}}
 const m=/[?&]transport=(bridge|sail|balloon)(?:&|$)/.exec(q||'');
 if(!m||!transportQaEnabled(host))return null;
 if(m[1]==='bridge'){warnKept('query','bridge','sail-or-balloon');return null;}
 return m[1] as TransportKind;
}
function isKind(v:unknown):v is TransportKind{return v==='bridge'||v==='sail'||v==='balloon';}
function overrideFromHost(host:any):TransportKind|null{
 if(!qaTransportEnabled(host))return null;
 const direct=host?.__QF_TRANSPORT;
 if(direct==='bridge')warnKept('__QF_TRANSPORT','bridge','sail-or-balloon');
 else if(isKind(direct))return direct;
 try{const q=host?.location?.search;if(typeof q==='string'&&q.includes('transport=')){const v=new URLSearchParams(q).get('transport');if(v==='bridge')warnKept('location','bridge','sail-or-balloon');else if(isKind(v))return v;}}catch{/* ignore */}
 return null;
}
/** Third argument is a QA kind, `null` (no override), or a balloon host object. Omitted: read the page query, then `globalThis`.
 * `bridge` is not a selectable kind for the sail, meadow balloon, or lakeside balloon. */
export function transportFor(from:JourneyRegion|string,to:JourneyRegion|string,third?:TransportKind|null|object):TransportKind{
 let override:TransportKind|null=null;
 if(isKind(third))override=third==='bridge'?(warnKept('argument','bridge',from+'-'+to),null):third;
 else if(third===null)override=null;
 else if(third===undefined)override=transportQaOverride()??overrideFromHost(globalThis);
 else override=overrideFromHost(third);
 if(from==='island'&&to==='meadow'){if(override&&override!=='sail')warnKept('island-meadow',override,'sail');return 'sail';}
 if(from==='meadow'&&to==='skycity'){if(override&&override!=='balloon')warnKept('meadow-skycity',override,'balloon');return 'balloon';}
 if(from==='skycity'&&to==='lakeside'){if(override&&override!=='balloon')warnKept('skycity-lakeside',override,'balloon');return 'balloon';}
 if(override)return override;
 return 'bridge';
}
/** Sail/balloon legs skip RainbowBridgeStrip. Bridge keeps the existing mesh. */
export function usesRainbowBridge(kind:TransportKind):boolean{return kind==='bridge';}
