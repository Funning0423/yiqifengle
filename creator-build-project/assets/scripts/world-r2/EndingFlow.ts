/** L16 → ending (TR9) and 回小岛 (pure; no cc imports). The last lakeside challenge's registered win shows 「继续」 on the
 *  result page; it runs a WindWipe (vehicle: 3D 风铃) under which the TEMPORARY EndingScreen is built. 回小岛 runs another
 *  WindWipe under which the board exits normally (saves already written at result.saved) and she is stood on the island. */
export const LAKE_STAGE_COUNT=4;
/** Result-page gate: a registered (saved) regional-r05 win of the last lake stage with all four lake records. */
export function endingAvailable(world:{state?:string;needsResume?:boolean}|null|undefined,b:any):boolean{
  if(!world||world.state!=='level'||world.needsResume||!b)return false;
  if(b.provider!=='regional-r05'||b.state!=='result.saved'||!b.result?.completionRecorded||b.nextStageId)return false;
  if(b.active?.region!=='lake')return false;
  const ids=Object.keys(b.progress?.records||{}).filter(id=>/-lake-/.test(id));return ids.length>=LAKE_STAGE_COUNT;
}
/** Temporary ending layout in visible-size points (origin centre, y up). Button: width min(240, W−48), 62 high, bottom 24 above safe. */
export function endingLayout(w:number,h:number,safeBottom:number=0){
  const buttonW=Math.min(240,w-48),buttonY=-h/2+safeBottom+24+31;
  return {buttonW,buttonY,titleY:h*.06,sealY:h*.06-80,glowY:h*.18,edgeInset:(w-buttonW)/2};
}
export interface EndingHost{
  wipe(o:{kind:string;content:{vehicle:'chime'|null;sign:string|null}|null;work:()=>Promise<{ok:boolean;reason?:string}>;ready:()=>boolean}):Promise<{ok:boolean;reason?:string}>;
  showEnding():void;hideEnding():void;endingShown():boolean;
  exitLevel():{ok:boolean;reason?:string};toIsland():{ok:boolean;reason?:string};state():string;islandMusic():void;
  markComplete?():void;
}
export async function playEnding(h:EndingHost){
  return h.wipe({kind:'ending',content:{vehicle:'chime',sign:null},ready:()=>h.endingShown(),
    work:async()=>{h.showEnding();try{h.markComplete?.();}catch{}return {ok:true};}});
}
export async function endingToIsland(h:EndingHost){
  return h.wipe({kind:'ending-home',content:null,ready:()=>h.state()==='island',work:async()=>{
    h.hideEnding();const ex=h.exitLevel();if(!ex.ok&&h.state()==='level')return ex;
    if(h.state()!=='island'){const r=h.toIsland();if(!r.ok)return r;}
    return h.state()==='island'?{ok:true}:{ok:false,reason:'ending-home-wrong-state:'+h.state()};}});
}
