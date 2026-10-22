/** b16 (Grok Bot build16 acceptance: the sky city at night read almost as bright as by day). Pure, no cc import.
 *  Why it was bright: (1) the board copy is lit by its own key SphereLight (SkycityBackgroundKey, warm, luminance x12) that
 *  never followed the world night - only the board clear colour did; (2) M_sky_cloud (env_sky_cloud_small, cumulus, mist) is
 *  self-lit (emissiveTexture = its albedo, emissiveFactor 1), so those clouds ignore every light; (3) M_sky_palette_emissive
 *  (ruins / state_*_after accents) glows the whole palette at strength 3 day and night.
 *  Fix = the island's global night parameters (DayNightContract.resolveDayNight('night'): main light x0.35, moon colour
 *  180/198/232), the same ones the island, meadow (journey grade) and lakeside (lakesideIslandLightScale) already follow:
 *  key light x0.35 + moon colour, self-lit clouds emissive x0.35 x moon tint, warm accents kept but x0.45 (a few warm lamps). */
import {resolveDayNight} from '../world-r1/DayNightContract';
const N=resolveDayNight('night',true);
export type Rgb3=readonly [number,number,number];
export const SKYCITY_NIGHT=Object.freeze({
 keyLightScale:N.lightScale,
 keyLightColor:N.lightColor as Rgb3,
 cloudEmissive:N.lightColor.map(c=>+(c/255*N.lightScale).toFixed(4)) as unknown as Rgb3,
 lampEmissive:.45,
});
export type SkycityNightKind='cloud'|'lamp';
/** Which sky-city materials carry their own light (by imported material name). Everything else is lit and follows the lights. */
export function skycityNightKind(materialName:string|null|undefined):SkycityNightKind|null{
 const n=String(materialName||'');if(/^M_sky_cloud\b/.test(n))return 'cloud';if(/^M_sky_palette_emissive\b/.test(n))return 'lamp';return null;}
const clamp01=(w:number)=>Number.isFinite(w)?Math.max(0,Math.min(1,w)):0;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
/** Night weight w (0 day .. 1 night) -> multipliers. Day (w=0) is exactly 1 everywhere (day look unchanged). */
export function skycityNightScale(w:number):{key:number;keyColor:[number,number,number];cloud:[number,number,number];lamp:number}{
 const t=clamp01(w),S=SKYCITY_NIGHT;
 return {key:mix(1,S.keyLightScale,t),keyColor:[0,1,2].map(i=>Math.round(mix(255,S.keyLightColor[i],t))) as [number,number,number],
  cloud:[0,1,2].map(i=>mix(1,S.cloudEmissive[i],t)) as [number,number,number],lamp:mix(1,S.lampEmissive,t)};}
/** Rec.709 luminance of a linear-ish RGB multiplier triple (for the brightness lock). */
export function lum(c:readonly number[]):number{return .2126*c[0]+.7152*c[1]+.0722*c[2];}
