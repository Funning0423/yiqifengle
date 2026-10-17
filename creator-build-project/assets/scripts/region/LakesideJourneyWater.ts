import {LAKESIDE_BUNDLE,LAKESIDE_DIR_LIGHT_PARAMS} from './LakesideSceneData';
/** r4 journey fix 1: the island→lakeside journey's lake keeps the imported water look when its own lakeside-water.mtl copy cannot be
 *  made (bundle or material load failed, timed out, or the copy threw). That fallback is no longer silent: one always-on
 *  [QF_LAKE] warn line with the reason and the asset path (not gated by __worldFlowLog, so any device log shows it). A normal run
 *  never prints it. Never throws (the walk goes on with the old look). */
export function logLakesideJourneyWaterFallback(error:unknown,asset:string=LAKESIDE_DIR_LIGHT_PARAMS.waterMaterialPath,bundle:string=LAKESIDE_BUNDLE):string{
 let reason='unknown';try{reason=String((error as any)?.message??error);}catch{}
 try{console.warn('[QF_LAKE] '+JSON.stringify({event:'journey-water-fallback',bundle,asset,reason,look:'imported water (pre-r4 look)'}));}catch{}
 return reason;}
