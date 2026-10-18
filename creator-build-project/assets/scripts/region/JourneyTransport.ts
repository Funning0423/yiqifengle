import type {JourneyRegion as CoreJourneyRegion} from '../world-r1/RegionJourneyCore';
/** Rainbow-bridge switch. island→meadow is the sail leg. meadow→skycity stays on the bridge until the balloon merge.
 * Unknown pairs fall back to the bridge. `?transport=bridge` is a QA override. A 6 s sail preload timeout falls back too. */
export type TransportKind='bridge'|'sail'|'balloon';
export type JourneyRegion=CoreJourneyRegion;
export const JOURNEY_TRANSPORT:{'island-meadow':TransportKind;'meadow-skycity':TransportKind;'island-lakeside':TransportKind}={
 'island-meadow':'sail','meadow-skycity':'bridge','island-lakeside':'bridge',
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
export function transportQaOverride(search?:string,host:any=(globalThis as any).wx):TransportKind|null{
 let q=search;
 if(q===undefined){try{q=String((globalThis as any).location?.search||'');}catch{q='';}}
 const m=/[?&]transport=(bridge|sail|balloon)(?:&|$)/.exec(q||'');
 if(!m||!transportQaEnabled(host))return null;
 return m[1] as TransportKind;
}
export function transportFor(from:JourneyRegion|string,to:JourneyRegion|string,override:TransportKind|null=transportQaOverride()):TransportKind{
 if(override)return override;
 if(from==='island'&&to==='meadow'&&sailPreloadFallback)return 'bridge';
 if(from==='island'&&to==='meadow')return JOURNEY_TRANSPORT['island-meadow'];
 if(from==='meadow'&&to==='skycity')return JOURNEY_TRANSPORT['meadow-skycity'];
 if(from==='island'&&to==='lakeside')return JOURNEY_TRANSPORT['island-lakeside'];
 return 'bridge';
}
/** Sail/balloon legs skip RainbowBridgeStrip. Bridge keeps the existing mesh. */
export function usesRainbowBridge(kind:TransportKind):boolean{return kind==='bridge';}
