import {LAKESIDE_DIR_LIGHT_PARAMS,LAKESIDE_LAYERED_FOG,LAKESIDE_LIGHT_MODE,lakesideFogEnd,lakesideModeLighting,lakesideCocosLightColor,type LakesideDayNight,type LakesideFogMode} from './LakesideSceneData';
import {resolveDayNight} from '../world-r1/DayNightContract';
/** build05-next (lead, 03:00): the island→lakeside journey's final stretch takes the lakeside board lighting (v3.2: main
 *  directional light direction/colour/illuminance, ambient sky/ground/illum, clear colour, layered fog), so the landing frame
 *  matches the board. One smootherstep weight over the last part of the route (mid-bridge → 1 m before her stop): no pop.
 *  Pure numbers only (no engine imports); RegionJourneyAdapter writes them to the scene and restores everything on dispose.
 *  Targets are exactly LakesideBoardBackground.applyDir/applyFog's values, computed from the SAME base (the island values
 *  captured before the blend), so the board's own apply at entry is a no-op visually. */
export const LAKESIDE_JOURNEY_ATMOSPHERE=Object.freeze({
 /** Blend starts this fraction along the rainbow bridge (she is crossing into the lake world)... */
 startBridgeFraction:.5,
 /** ...and is complete this many metres before her stop, so the landing frame (and the 1 s landing→board blend) is fully lit. */
 endBeforeStopM:1,
 /** Layered fog strength floor while primed: fogRange/weight, weight ≥ this (density ∝ weight; 1e-3 ≈ invisible). */
 minFogWeight:1e-3,
 /** Linear-fog A/B (?lakefog=linear60): start/end pushed this far out at weight 0. */
 linearFogPushM:2000,
});
export type Rgb=readonly [number,number,number];
export type LakesideAtmosphereBase=Readonly<{illum:number;color:Rgb;sky:Rgb;ground:Rgb;skyIllum:number;clear:Rgb}>;
export type LakesideAtmosphereFog=Readonly<{type:0|3;color:Rgb;top:number;range:number;atten:number;start:number;end:number}>;
export type LakesideAtmosphereFrame=Readonly<{weight:number;illum:number;color:Rgb;sky:Rgb;ground:Rgb;skyIllum:number;clear:Rgb;fog:LakesideAtmosphereFog|null}>;
const smooth5=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(10+u*(-15+6*u));};
/** 0 before mid-bridge, 1 from (total - endBeforeStopM) on; C2-smooth in between. Distance = the controller's walked distance. */
export function lakesideAtmosphereWeight(route:Readonly<{bridgeStart:number;bridgeEnd:number}>,total:number,distance:number):number{
 const A=LAKESIDE_JOURNEY_ATMOSPHERE,a=route.bridgeStart+(route.bridgeEnd-route.bridgeStart)*A.startBridgeFraction,b=Math.max(a+1e-3,total-A.endBeforeStopM);
 return Number.isFinite(distance)?smooth5((distance-a)/(b-a)):0;
}
export function hexRgb(hex:string):Rgb{const h=String(hex).replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
const mix=(a:Rgb,b:Rgb,w:number):Rgb=>[Math.round(a[0]+(b[0]-a[0])*w),Math.round(a[1]+(b[1]-a[1])*w),Math.round(a[2]+(b[2]-a[2])*w)];
/** True when the board uses the directional-light look (the journey then blends toward it; otherwise nothing is touched). */
export const LAKESIDE_JOURNEY_ATMOSPHERE_ON=LAKESIDE_LIGHT_MODE==='dir';
/** The board's targets for a base = the island values in the SAME day/night mode (LakesideBoardBackground.applyDir: illum ×
 *  sunIlluminanceScale, skyIllum = illum × ambientSkyIllumToSun; colours, clear and fog colour from lakesideModeLighting(mode)). */
export function lakesideAtmosphereTarget(base:LakesideAtmosphereBase,mode:LakesideDayNight='day'):LakesideAtmosphereBase{
 const M=lakesideModeLighting(mode);
 return {illum:base.illum*M.sunIlluminanceScale,color:lakesideCocosLightColor(M.sunColorLinear),sky:lakesideCocosLightColor(M.ambientSkyColorLinear),ground:lakesideCocosLightColor(M.ambientGroundColorLinear),skyIllum:base.illum*M.ambientSkyIllumToSun,clear:hexRgb(M.clearColor)};
}
/** build05-next r2: current world day/night mode (the island's __worldDayNight; day when absent). */
export function lakesideDayNightMode():LakesideDayNight{try{return (globalThis as any).__worldDayNight?.snapshot?.()?.mode==='night'?'night':'day';}catch{return 'day';}}
/** Island main-light scale for a mode (DayNightContract: night 0.35). */
export function lakesideIslandLightScale(mode:LakesideDayNight):number{return resolveDayNight(mode,true).lightScale;}
/** Island values for `mode` from a capture taken in `capturedMode`: main light = day base × the mode's island scale and the
 *  island's light colour for that mode (WorldFlowComponent.applyDayNight writes exactly these); ambient/clear do not change with
 *  the island mode (applyDayNight does not write them). */
export function lakesideIslandBaseFor(captured:LakesideAtmosphereBase,capturedMode:LakesideDayNight,mode:LakesideDayNight):LakesideAtmosphereBase{
 if(mode===capturedMode)return captured;const day=captured.illum/lakesideIslandLightScale(capturedMode),c=resolveDayNight(mode,true).lightColor;
 return {...captured,illum:day*lakesideIslandLightScale(mode),color:[c[0],c[1],c[2]]};
}
/** Scene values at weight w. Fog (same mode switch as the board, ?lakefog): layered = the board's slab with fogRange/w
 *  (density ∝ w, so it grows from nothing; type/enable never change during the blend, no shader-variant switch mid-walk);
 *  (waterY: world height of the lakeside root, the slab is authored relative to the lake; the board rig sits at 0);
 *  linear60 = the board's start/end pushed out by (1-w)·linearFogPushM; off = fog untouched (null). */
export function lakesideAtmosphereAt(base:LakesideAtmosphereBase,weight:number,fogMode:LakesideFogMode,waterY:number=0,mode:LakesideDayNight='day'):LakesideAtmosphereFrame{
 const w=Math.max(0,Math.min(1,Number.isFinite(weight)?weight:0)),t=lakesideAtmosphereTarget(base,mode),M=lakesideModeLighting(mode),P=LAKESIDE_DIR_LIGHT_PARAMS,L=LAKESIDE_LAYERED_FOG,A=LAKESIDE_JOURNEY_ATMOSPHERE;
 const fog:LakesideAtmosphereFog|null=!P.fogEnabled||fogMode==='off'?null:fogMode==='layered'
  ?{type:3,color:M.fogColorSrgb,top:L.fogTop+waterY,range:L.fogRange/Math.max(A.minFogWeight,w),atten:L.fogAtten,start:P.fogStart,end:lakesideFogEnd(P)}
  :{type:0,color:M.fogColorSrgb,top:L.fogTop,range:L.fogRange,atten:L.fogAtten,start:P.fogStart+(1-w)*A.linearFogPushM,end:lakesideFogEnd(P)+(1-w)*A.linearFogPushM};
 return {weight:w,illum:base.illum+(t.illum-base.illum)*w,color:mix(base.color,t.color,w),sky:mix(base.sky,t.sky,w),ground:mix(base.ground,t.ground,w),skyIllum:base.skyIllum+(t.skyIllum-base.skyIllum)*w,clear:mix(base.clear,t.clear,w),fog};
}
/** While a journey holds the lighting, the island main-light illuminance it captured, as the DAY base (illum / island scale of
 *  the capture mode). The board scales from base × the current mode's island scale instead of the (already blended) current
 *  value, so the board lands on the same numbers (no double scale) in both modes. */
let journeyBaseIllum:number|null=null;
export function setLakesideJourneyBaseIllum(v:number|null){journeyBaseIllum=typeof v==='number'&&Number.isFinite(v)?v:null;}
export function lakesideJourneyBaseIllum():number|null{return journeyBaseIllum;}
/** build05-next r2: while the board shows it owns the lighting (its fog slab, its water); the journey's day/night listener
 *  stands down, and when the board hides the journey re-applies its own look for the current mode. */
let boardHolding=false,journeyReapply:(()=>void)|null=null;
export function setLakesideBoardHolding(v:boolean){boardHolding=!!v;}
export function lakesideBoardHolding():boolean{return boardHolding;}
export function setLakesideJourneyReapply(fn:(()=>void)|null){journeyReapply=fn;}
/** true when a journey took over (it re-applied); false when no journey holds the lighting. */
export function reapplyLakesideJourney():boolean{const f=journeyReapply;if(!f)return false;try{f();}catch{}return true;}
