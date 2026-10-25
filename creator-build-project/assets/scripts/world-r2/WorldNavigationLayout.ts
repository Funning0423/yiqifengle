/** Restored primary/secondary hierarchy: one journey action on the island.
 * Chapter selection belongs inside the journey journal, not a button grid. */
export const ISLAND_NAV_IDS=['mainline'] as const;
export function worldNavigationLayout(width:number,height:number){
  if(![width,height].every(Number.isFinite)||width<=0||height<=0)throw Error('Invalid navigation frame');
  const portrait=width<height,bottom=portrait?50:33;
  const landscapeRow=!portrait&&width>=568;
  const primaryWidth=landscapeRow?Math.min(250,width-344):Math.min(250,width-64);
  return {portrait,supported:width>=320&&height>=320,
    buttons:{mainline:{x:landscapeRow?-width/2+24+primaryWidth/2:0,y:landscapeRow?-height/2+58:-height/2+bottom+(portrait&&height<680?104:116),width:primaryWidth,height:52}},
    back:{x:0,y:-height/2+bottom+23,width:Math.min(220,width-64),height:46},
    dayNight:{x:0,y:height/2-(portrait?82:32),width:144,height:36},
    region:regionNavigationRow(width,height)};
}
/** Journey regions (meadow / journey-skycity): 继续旅程 and 主页 share one low row
 * with equal widths so neither covers her body at the arrival framing (her feet sit
 * at ~84-88% of the screen height). Island slots above are deliberately unchanged. */
export const REGION_NAV_GAP=12;
export function regionNavigationRow(width:number,height:number){
  const portrait=width<height,h=48,safe=portrait?(height>=780?42:16):16;
  const w=Math.min(170,(width-48-REGION_NAV_GAP)/2),y=-height/2+safe+h/2,dx=(w+REGION_NAV_GAP)/2;
  return {mainline:{x:-dx,y,width:w,height:h},home:{x:dx,y,width:w,height:h}};
}

/** b16 真机复核 ①（入场中快速连点木牌：进关→59 ms 回岛→再进一次）：主线点击防抖。一次有效点击后锁 MAINLINE_TAP_LOCK_MS；
 *  不在小岛（进关加载、棋盘里、转场中）时锁一直续到离开后 MAINLINE_RETURN_LOCK_MS，回岛后的残余连点也吃掉。纯函数。 */
export const MAINLINE_TAP_LOCK_MS=1200,MAINLINE_RETURN_LOCK_MS=500;
export function mainlineTapAllowed(now:number,lockUntil:number,busy:boolean):boolean{return !busy&&now>=lockUntil;}
export function mainlineLockAfterTap(now:number):number{return now+MAINLINE_TAP_LOCK_MS;}
export function mainlineLockForState(lockUntil:number,state:string,now:number):number{return state==='island'?lockUntil:Math.max(lockUntil,now+MAINLINE_RETURN_LOCK_MS);}
