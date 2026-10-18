import type {JourneyRegion as CoreJourneyRegion} from '../world-r1/RegionJourneyCore';
/** Rainbow-bridge switch. island→meadow is sail, meadow→skycity is balloon, island→lakeside stays the bridge.
 * Unknown pairs fall back to the bridge. `?transport=` and `__QF_TRANSPORT` are QA overrides.
 * A 6 s sail preload timeout falls back to the bridge for the next island→meadow prepare. */
export type TransportKind='bridge'|'sail'|'balloon';
export type JourneyRegion=CoreJourneyRegion;
export const JOURNEY_TRANSPORT:{'island-meadow':TransportKind;'meadow-skycity':TransportKind;'island-lakeside':TransportKind}={
 'island-meadow':'sail','meadow-skycity':'balloon','island-lakeside':'bridge',
};
/** Set when the meadow bundle does not finish warming within 6 s. The next island→meadow prepare takes the bridge. */
let sailPreloadFallback=false;
export function noteSailPreloadFallback(reason:string):void{
 sailPreloadFallback=true;
 try{console.info('[QF_SAIL] '+JSON.stringify({event:'preload-fallback',transport:'bridge',reason}));}catch{}
}
export function sailPreloadFellBack():boolean{return sailPreloadFallback;}
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
 return m[1] as TransportKind;
}
function isKind(v:unknown):v is TransportKind{return v==='bridge'||v==='sail'||v==='balloon';}
function overrideFromHost(host:any):TransportKind|null{
 if(!qaTransportEnabled(host))return null;
 const direct=host?.__QF_TRANSPORT;if(isKind(direct))return direct;
 try{const q=host?.location?.search;if(typeof q==='string'&&q.includes('transport=')){const v=new URLSearchParams(q).get('transport');if(isKind(v))return v;}}catch{}
 return null;
}
/** Third argument is a sail QA kind (`'bridge'`), `null` (no override), or a balloon host object. Omitted: read the page query, then `globalThis`. */
export function transportFor(from:JourneyRegion|string,to:JourneyRegion|string,third?:TransportKind|null|object):TransportKind{
 let override:TransportKind|null=null;
 if(isKind(third))override=third;
 else if(third===null)override=null;
 else if(third===undefined)override=transportQaOverride()??overrideFromHost(globalThis);
 else override=overrideFromHost(third);
 if(override)return override;
 if(from==='island'&&to==='meadow'&&sailPreloadFallback)return 'bridge';
 if(from==='island'&&to==='meadow')return JOURNEY_TRANSPORT['island-meadow'];
 if(from==='meadow'&&to==='skycity')return JOURNEY_TRANSPORT['meadow-skycity'];
 if(from==='island'&&to==='lakeside')return JOURNEY_TRANSPORT['island-lakeside'];
 return 'bridge';
}
/** Sail/balloon legs skip RainbowBridgeStrip. Bridge keeps the existing mesh. */
export function usesRainbowBridge(kind:TransportKind):boolean{return kind==='bridge';}
