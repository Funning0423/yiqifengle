/** A/B (2026-11-05): meadow→skycity ascent + post-land walk-to-plaza hitch with TSW already OFF.
 *  Whole-phone period stutter ROOT HIT remains TransitionShaderWarm (default OFF; do NOT re-open).
 *  Funning still saw periodic hitch on balloon ascent AND continuous hitch walking toward the square
 *  after skycity landing → shared skycity-leg heavy paths (not TSW).
 *  When false (default), skip:
 *   1) BalloonTransit ascent: scanSeas full-scene rewalk every ~0.5 s; per-frame city showNamed /
 *      meadow-grass tree walks when visibility key unchanged; duplicate apply() from TransitDriver.step
 *      (EVENT_BEFORE_DRAW stays the single paint writer)
 *   2) SkycityCloudsea post-land: per-frame syncDay full-scene walk + camera sweeps (keep soft pose /
 *      active; re-run day/camera only on night flip or setFlightHidden)
 *  Threshold crossings / vehicle / camera / light / sea / flame / handoff / standup / Morph / TSW /
 *  lakeside LAKESIDE_KIT / PeriodHeavy / SceneAudioPoll untouched.
 *  Kill-switch: setSkycityLegHeavyEnabled(true) or ?qfskyheavy=1 / __qfSkyLegHeavy=true
 *  (force off: ?qfskyheavy=0 / __qfSkyLegHeavy=false). */
import {debugSearch} from './DebugQuery';
export let SKYCITY_LEG_HEAVY_ENABLED=false;
export function setSkycityLegHeavyEnabled(on:boolean):void{SKYCITY_LEG_HEAVY_ENABLED=!!on;}
/** Resolve query / __qf flag into SKYCITY_LEG_HEAVY_ENABLED. Default OFF. */
export function skycityLegHeavyFromFlag(host:any=globalThis):boolean{
 let on=false;
 try{const g=host?.__qfSkyLegHeavy;if(g===true)on=true;else if(g===false)on=false;}catch{/* */}
 try{
  const s=debugSearch(host);
  if(/[?&]qfskyheavy=1(&|$)/.test(s))on=true;
  else if(/[?&]qfskyheavy=0(&|$)/.test(s))on=false;
 }catch{/* */}
 SKYCITY_LEG_HEAVY_ENABLED=on;
 return on;
}
