/** r4.2 item 9 (Mac r4 2153a65: meadow and sky-city boards showed a daytime background at night). Pure helpers shared by the
 *  meadow and sky-city board leases: the board sky (camera clear colour) eases from its day colour to the night sky the region
 *  journey shows just before the swap, by the same UI night weight (uiNightWeight, 0.5 s approach) the rest of the board follows.
 *  REGION_BOARD_NIGHT_CLEAR = the r4 Mac journey night sky sampled above the horizon on swap/lk4_{sky,meadow}_night_ml.jpg
 *  (sRGB ~0,10-13,63-74). No cc import. */
export const REGION_BOARD_NIGHT_CLEAR:readonly [number,number,number]=[0,12,68];
export function regionBoardClear(day:readonly number[],nightWeight:number):[number,number,number]{
 const t=Number.isFinite(nightWeight)?Math.max(0,Math.min(1,nightWeight)):0,N=REGION_BOARD_NIGHT_CLEAR;
 return [0,1,2].map(i=>Math.round(day[i]+(N[i]-day[i])*t)) as [number,number,number];}
export function hexToRgb(hex:string):[number,number,number]{const h=String(hex).replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
/** World day/night mode right now (WorldFlowComponent's __worldDayNight); day when there is no world. */
export function regionNightNow():boolean{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}}
/** Writes the eased clear colour onto a camera-like {clearColor} only when it changes (no per-frame allocation when steady). */
export function writeRegionBoardClear(camera:{clearColor:{r:number;g:number;b:number;a:number}}|null,day:readonly number[],nightWeight:number,make:(r:number,g:number,b:number)=>any):boolean{
 if(!camera)return false;const c=regionBoardClear(day,nightWeight),o=camera.clearColor;if(o&&o.r===c[0]&&o.g===c[1]&&o.b===c[2])return false;camera.clearColor=make(c[0],c[1],c[2]);return true;}
/** b16-fix P2（build05 全流程测试 P2-2：夜间天空城棋盘背景仍是白天光照）：天空城棋盘背景自带一盏暖色补光 SphereLight
 *  (#fff3da, luminance x12)，夜间也不变，所以只有天空（clear 色）变夜、草坪和白塔仍是白天亮度。夜间按世界主光同一口径处理：
 *  亮度 x DayNightContract.lightScale(night)=0.35，颜色 x lightColor(night)=180/198/232（偏蓝月光），按 nightWeight 线性过渡。纯函数，无 cc 依赖。 */
export const REGION_BOARD_KEY_NIGHT_SCALE=0.35;
export const REGION_BOARD_KEY_NIGHT_COLOR:readonly [number,number,number]=[180,198,232];
export function regionBoardKeyLight(dayColor:readonly number[],dayLuminance:number,nightWeight:number):{color:[number,number,number];luminance:number}{
 const t=Number.isFinite(nightWeight)?Math.max(0,Math.min(1,nightWeight)):0,K=REGION_BOARD_KEY_NIGHT_COLOR;
 const color=[0,1,2].map(i=>Math.round(dayColor[i]*(1+(K[i]/255-1)*t))) as [number,number,number];
 return {color,luminance:dayLuminance*(1+(REGION_BOARD_KEY_NIGHT_SCALE-1)*t)};}
