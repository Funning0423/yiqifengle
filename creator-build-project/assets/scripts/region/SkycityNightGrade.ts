/** b16 (Grok Bot build16 acceptance: the sky city at night read almost as bright as by day). Pure, no cc import.
 *  Why it was bright: (1) the board copy is lit by its own key SphereLight (SkycityBackgroundKey, warm, luminance x12) that
 *  never followed the world night - only the board clear colour did; (2) M_sky_cloud (env_sky_cloud_small, cumulus, mist) is
 *  self-lit (emissiveTexture = its albedo, emissiveFactor 1), so those clouds ignore every light; (3) M_sky_palette_emissive
 *  (ruins / state_*_after accents) glows the whole palette at strength 3 day and night.
 *  Fix = the island's global night parameters (DayNightContract.resolveDayNight('night'): main light x0.35, moon colour
 *  180/198/232), the same ones the island, meadow (journey grade) and lakeside (lakesideIslandLightScale) already follow:
 *  key light x0.35 + moon colour, self-lit clouds emissive x0.35 x moon tint, warm accents kept but x0.45 (a few warm lamps).
 *  b16 r2 (board foreground still day-green): lit ground (M_sky_palette lawn / court, foliage cards, rock strata) is lit
 *  mostly by the scene AMBIENT, and the island night never changes the ambient outdoors (WorldFlow.applyDayNight only scales
 *  the main light; RoomLightingRig touches ambient only for the room view). The key light alone barely moved it. Same fix as
 *  the meadow (MeadowBoardBackground N2b): grade the albedo (r3: meadow grade x ~0.4, see groundAlbedo), props / characters by the meadow prop grade (x0.6 sRGB), and the soft
 *  cloud sea (shares M_sky_palette, was near-white under the arrival) by a moon-blue grade. */
import {resolveDayNight} from '../world-r1/DayNightContract';
const N=resolveDayNight('night',true);
export type Rgb3=readonly [number,number,number];
export const SKYCITY_NIGHT=Object.freeze({
 keyLightScale:N.lightScale,
 keyLightColor:N.lightColor as Rgb3,
 cloudEmissive:N.lightColor.map(c=>+(c/255*N.lightScale).toFixed(4)) as unknown as Rgb3,
 lampEmissive:.45,
 /** r3: lawn / court / foliage / rock (env_sky_static_palette etc., all M_sky_palette family). The meadow constant
  *  MEADOW_NIGHT_LINEAR (0.16/0.20/0.28) left the board foreground reading as day: unlike the meadow (its grass has its own
  *  night shader grade on top) the sky-city lawn faces the main light (x0.35 at night) AND the outdoor ambient, which the
  *  island night never dims (scene ambient skyIllum 20000 vs main light 125000 at EV15). This is the meadow grade x ~0.4,
  *  bluer (r5: 0.12/0.14/0.20 after r4 0.08/0.10/0.15 still read black-green; r4 after Grok Bot found 0.06/0.08/0.12 a black-green lawn): grass -> dark blue-green, white court stone -> moon blue-grey, at the level of the arrival shot. */
 groundAlbedo:[.12,.14,.20] as Rgb3,
 /** r4: island underside (M_sky_rock_strata, the striped rock below the lawn): fills the lower half of the balloon arrival,
  *  which went too dark at the ground grade (r5 target: arrival frame after >= 0.25x night-before, linear). Moon blue-grey, lighter. */
 undersideAlbedo:[.55,.60,.75] as Rgb3,
 /** = MEADOW_PROP_NIGHT 0.6 sRGB, as a linear factor (characters / props stay readable). */
 propAlbedo:+Math.pow(.6,2.2).toFixed(4),
 /** Soft cloud sea (lit M_sky_palette): moon blue-grey, above the ground so the sea still reads as cloud (r4: lifted with the underside for the arrival). */
 cloudseaAlbedo:[.35,.40,.55] as Rgb3,
});
export type SkycityNightKind='cloud'|'lamp'|'ground'|'prop'|'sea'|'underside';
/** Which sky-city materials carry their own light (by imported material name). Everything else is lit and follows the lights. */
export function skycityNightKind(materialName:string|null|undefined,nodeName='',inCloudsea=false):SkycityNightKind|null{
 const n=String(materialName||'');if(/^M_sky_cloud\b/.test(n))return 'cloud';if(/^M_sky_palette_emissive\b/.test(n))return 'lamp';
 if(!/^M_sky_(palette|foliage_cards|rock_strata)\b/.test(n))return null;
 if(inCloudsea)return 'sea';if(/^M_sky_rock_strata\b/.test(n))return 'underside';if(/^chr_|robot|windchime|ambient_props/i.test(String(nodeName)))return 'prop';return 'ground';}
const clamp01=(w:number)=>Number.isFinite(w)?Math.max(0,Math.min(1,w)):0;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
/** Night weight w (0 day .. 1 night) -> multipliers. Day (w=0) is exactly 1 everywhere (day look unchanged). */
type T3=[number,number,number];
export function skycityNightScale(w:number):{key:number;keyColor:T3;cloud:T3;lamp:number;ground:T3;prop:number;sea:T3;underside:T3}{
 const t=clamp01(w),S=SKYCITY_NIGHT;
 return {key:mix(1,S.keyLightScale,t),keyColor:[0,1,2].map(i=>Math.round(mix(255,S.keyLightColor[i],t))) as [number,number,number],
  cloud:[0,1,2].map(i=>mix(1,S.cloudEmissive[i],t)) as T3,lamp:mix(1,S.lampEmissive,t),
  ground:[0,1,2].map(i=>mix(1,S.groundAlbedo[i],t)) as T3,prop:mix(1,S.propAlbedo,t),sea:[0,1,2].map(i=>mix(1,S.cloudseaAlbedo[i],t)) as T3,underside:[0,1,2].map(i=>mix(1,S.undersideAlbedo[i],t)) as T3};}
/** Rec.709 luminance of a linear-ish RGB multiplier triple (for the brightness lock). */
export function lum(c:readonly number[]):number{return .2126*c[0]+.7152*c[1]+.0722*c[2];}
