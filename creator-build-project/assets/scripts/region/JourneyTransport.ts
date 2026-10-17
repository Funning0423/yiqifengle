/** Rainbow-bridge switch. This branch keeps every leg on the old bridge. */
export type TransportKind='bridge'|'sail'|'balloon';
export type JourneyRegion='island'|'meadow'|'skycity'|'lakeside';
export const JOURNEY_TRANSPORT:{'island-meadow':TransportKind;'meadow-skycity':TransportKind;'island-lakeside':TransportKind}={
 'island-meadow':'bridge','meadow-skycity':'bridge','island-lakeside':'bridge',
};
export function transportFor(from:JourneyRegion|string,to:JourneyRegion|string):TransportKind{
 const key=from+'-'+to;
 if(key==='island-meadow'||key==='meadow-skycity'||key==='island-lakeside')return JOURNEY_TRANSPORT[key];
 return 'bridge';
}
/** Sail/balloon legs skip RainbowBridgeStrip. Bridge keeps the existing mesh. */
export function usesRainbowBridge(kind:TransportKind):boolean{return kind==='bridge';}
