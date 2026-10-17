/** One sky dome at a time (§8 B1). Day keeps the island dome. Night keeps the meadow dome.
 * The destination dome, if any, replaces the current one over the last second — it never stacks. */
export type TransitDome='island'|'meadow'|'skycity';
export type BackdropFrame={
 /** Which dome is allowed to render. */
 dome:TransitDome;
 /** 0 = fully the outgoing dome, 1 = fully `dome` (crossfade window only). */
 blend:number;
 /** Sea plane stays as the far horizon until the sky city's cloud sea takes the lower frame. */
 sea:boolean;
 cloudSea:boolean;
};
export function transitBackdrop(t:number,total:number,night:boolean,cloudSeaFrom:number):BackdropFrame{
 const dome:TransitDome=night?'meadow':'island';
 const fade=1;
 const cloudSea=t>=cloudSeaFrom;
 return {dome,blend:fade,sea:!cloudSea,cloudSea};
}
/** Names the journey copy may show. Anything else that is a sky dome stays hidden. */
export const DOME_NODES:Record<TransitDome,string>={island:'env_sky_dome',meadow:'meadow_sky_dome',skycity:'env_sky_dome'};
export function domeVisible(nodeName:string,frame:BackdropFrame):boolean{
 if(nodeName==='meadow_sky_dome')return frame.dome==='meadow';
 if(nodeName==='env_sky_dome')return frame.dome==='island'||frame.dome==='skycity';
 if(nodeName==='meadow_far_hills')return false;
 return true;
}
