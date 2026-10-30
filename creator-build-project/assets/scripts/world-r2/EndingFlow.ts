/** L18 「刻名的桥」 (r04-lake-06) → ending (TR9) and 回小岛 (pure; no cc imports). The last lakeside challenge's registered win shows 「继续」 on the
 *  result page; it runs a WindWipe (vehicle: 3D 风铃) under which the EndingScreen (v2 lake view) is built. 回小岛 runs another
 *  WindWipe under which the board exits normally (saves already written at result.saved) and she is stood on the island. */
export const LAKE_STAGE_COUNT=4;
/** Result-page gate: a registered (saved) regional-r05 win of the last lake stage with all four lake records. */
export function endingAvailable(world:{state?:string;needsResume?:boolean}|null|undefined,b:any):boolean{
  if(!world||world.state!=='level'||world.needsResume||!b)return false;
  if(b.provider!=='regional-r05'||b.state!=='result.saved'||!b.result?.completionRecorded||b.nextStageId)return false;
  if(b.active?.region!=='lake')return false;
  const ids=Object.keys(b.progress?.records||{}).filter(id=>/-lake-/.test(id));return ids.length>=LAKE_STAGE_COUNT;
}
/** Ending v2 art (UI设计部 ui/post-island-ui 94b821fd SPEC §3): layered Blender renders of the real lakeside scene
 *  (lakeside_r5h3.blend, camera on the south shore looking north, 20 mm), day and night lit separately. Source frames are
 *  rendered at 1170×2532 px (3×) = 390×844 pt; boxes below are in those source points (top-left origin). The board on the chime post is
 *  removed in the bg render; the chime is a live low-poly 3D layer built in code (EndingChimeGeometry), swung around its hang point. */
export const ENDING_ART=Object.freeze({
  dir:'ending/',srcW:390,srcH:844,
  chime:{x0:134,y0:159,x1:215,y1:359},   // LK_windchime ×1.25 hanging from the LK_chime_post arm; hang point = top centre
  girl:{x0:220.5,y0:546.5,x1:258.5,y1:681.5},
  swayDeg:4,swayPeriodS:3.2,
  nightGlow:{r:150,color:[0xff,0xce,0x82],alpha:.42},
  shade:{day:{rgb:[0x28,0x1a,0x0a],a:.24},night:{rgb:[0x05,0x08,0x14],a:.39},from:.70},
});
/** Chime swing angle (degrees, + = counter-clockwise) at time t: ±4°, 3.2 s sine, starts centred. */
export function endingSwayDeg(t:number){return ENDING_ART.swayDeg*Math.sin(2*Math.PI*t/ENDING_ART.swayPeriodS);}
/** Ending layout (SPEC §3 v2) in visible-size points, TOP-LEFT origin, y down (EndingScreen converts). safeBottom/safeTop
 *  default to the notch heuristic of the design (H/W>1.9: 47/34, else 20/0). Button: width min(240,W−48), 62 high, bottom
 *  24 above safe. Short screens (H≤600) lift the seals 8 pt so her head keeps ≥12 pt below them. */
export function endingLayout(w:number,h:number,safeBottom:number=0,safeTop?:number){
  const notch=h/w>1.9,top=safeTop??(notch?47:20),bot=safeBottom>0?safeBottom:(notch?34:0);
  const buttonW=Math.min(240,w-48),buttonH=62,buttonTop=h-bot-24-buttonH,usable=buttonTop-top;
  const chimeCy=top+usable*.36,chimeSize=Math.min(w*.62,usable*.42),plankCy=chimeCy+chimeSize*.5+44;
  const sealsCy=plankCy+64-(h<=600?8:0);
  const A=ENDING_ART,k=Math.max(w/A.srcW,h/A.srcH),bgW=A.srcW*k,bgH=A.srcH*k;
  const srcChimeCy=(A.chime.y0+A.chime.y1)/2*k,bgX=-(bgW-w)/2,bgY=-Math.max(0,Math.min(bgH-h,srcChimeCy-chimeCy));
  const chime={x0:bgX+A.chime.x0*k,y0:bgY+A.chime.y0*k,x1:bgX+A.chime.x1*k,y1:bgY+A.chime.y1*k};
  const gNative=(A.girl.y1-A.girl.y0)*k,gTop=sealsCy+22+12,gBottom=buttonTop-16,gh=Math.max(48,Math.min(gNative,gBottom-gTop));
  const gw=gh*(A.girl.x1-A.girl.x0)/(A.girl.y1-A.girl.y0),gcx=w*.64;
  const girl={x0:gcx-gw/2,y0:gBottom-gh,x1:gcx+gw/2,y1:gBottom};
  return {top,bot,buttonW,buttonH,buttonTop,buttonCy:buttonTop+buttonH/2,edgeInset:(w-buttonW)/2,
    titleCy:plankCy,sealsCy,chimeCy,bg:{x:bgX,y:bgY,w:bgW,h:bgH,k},chime,hang:{x:(chime.x0+chime.x1)/2,y:chime.y0},girl,
    glowR:A.nightGlow.r*k};
}
/** Layout checks of the design's 7-size sheet (src/ending_sheets.py), pure: used by tests and __qfEnding.layoutCheck. */
/** new-regions SPEC §4 seal row: 6 × Ø40 at 48 pitch (droop 1.2·(i−2.5)², max ≈ 7.5 pt). */
export const ENDING_SEALS={count:6,d:40,pitch:48,width:5*48+40,droop:1.2*2.5*2.5} as const;
export function endingLayoutChecks(w:number,h:number,safeBottom:number=0){
  const L=endingLayout(w,h,safeBottom),g=L.girl,sealBottom=L.sealsCy+22,plank={x0:w/2-98,y0:L.titleCy-29,x1:w/2+98,y1:L.titleCy+29};
  const btn={x0:L.edgeInset,y0:L.buttonTop,x1:w-L.edgeInset,y1:L.buttonTop+L.buttonH};
  const hit=(a:any,b:any)=>!(a.x1<=b.x0||b.x1<=a.x0||a.y1<=b.y0||b.y1<=a.y0);
  return {buttonEdge:L.edgeInset>=16,buttonInSafe:btn.y1<=h-L.bot,girlInFrame:g.x0>=0&&g.x1<=w&&g.y0>=0&&g.y1<=h,
    girlClear:!hit(g,btn)&&!hit(g,plank),headBelowSeals:g.y0-sealBottom>=12-1e-6,
    chimeClear:L.chime.y0>=L.top-1e-6&&L.chime.y1<=plank.y0+1e-6&&L.chime.x0>=0&&L.chime.x1<=w,
    // new-regions SPEC §4: 6 seals Ø40 / pitch 48 = 280 pt must leave ≥ 20 pt each side.
    sealsFit:ENDING_SEALS.width<=w-40};
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
