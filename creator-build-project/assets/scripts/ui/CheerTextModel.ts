/** T6 cheer floating text (GGbot): engine-independent model. Tier ALWAYS comes from GameAudio.onCheer(level);
 * nothing here maps cascade -> tier, so text and voice can never disagree. */
export type CheerStyle={word:string;fill:string;outline:string;shadow:string;size:number};
/** Soft pastel anime palette (fill / outline / shadow). Outline is the same hue, darker, so the word stays readable on light boards. */
export const CHEER_STYLES:readonly CheerStyle[]=[
 {word:'Great!',       fill:'#FFF4B0',outline:'#E8A04E',shadow:'#B8763A88',size:34}, // butter yellow / apricot
 {word:'Excellent!',   fill:'#C8F5DC',outline:'#45AE86',shadow:'#2E7E6088',size:34}, // mint / jade
 {word:'Amazing!',     fill:'#D2E2FF',outline:'#6B8EE6',shadow:'#4A63A888',size:36}, // periwinkle / cornflower
 {word:'Unbelievable!',fill:'#FFD0E6',outline:'#E0659E',shadow:'#A8467688',size:38}, // sakura / rose
];
export const CHEER_TOTAL_S=0.8;
export const tierOf=(level:number):number=>Number.isInteger(level)&&level>=0&&level<CHEER_STYLES.length?level:-1;
/** One on screen at a time: same or higher tier still showing -> skip (mirrors GameAudio.playCheer); lower -> replaced. */
export function decide(active:number,activeAge:number,level:number):'show'|'replace'|'skip'{
 if(tierOf(level)<0)return 'skip';if(active<0||activeAge>=CHEER_TOTAL_S)return 'show';return level>active?'replace':'skip';}
const clamp01=(t:number)=>t<0?0:t>1?1:t;
const easeOutBack=(t:number)=>{const c=1.9,u=t-1;return 1+(c+1)*u*u*u+c*u*u;};
const easeOutCubic=(t:number)=>1-(1-t)*(1-t)*(1-t);
/** Pose at age t seconds: pop/scale-in (0..0.18 s, overshoot), float up 56 px (whole 0.8 s), hold opacity then fade 0.5..0.8 s. */
export function poseAt(t:number,out:{scale:number;dy:number;alpha:number;done:boolean}){
 out.done=t>=CHEER_TOTAL_S;const p=clamp01(t/0.18);out.scale=t<0.18?0.35+0.65*easeOutBack(p):1;
 out.dy=56*easeOutCubic(clamp01(t/CHEER_TOTAL_S));out.alpha=t<0.5?1:1-clamp01((t-0.5)/0.3);return out;}
/** Cleared cell indexes (0..48 on the 7x7 board) from onCheer's clear visual: wave.removed = [{index,id,type,special}]. Empty -> caller uses board centre. */
export function removedIndexes(visual:any):number[]{const r=visual?.kind==='clear'?visual?.wave?.removed:null;if(!Array.isArray(r))return [];
 const out:number[]=[];for(const c of r){const i=typeof c==='number'?c:c?.index;if(Number.isInteger(i)&&i>=0&&i<49&&out.indexOf(i)<0)out.push(i);}return out;}
/** Keep the whole word (half extents hw/hh, plus the float travel) inside the safe rect of a w x h centred canvas. */
export function clampToSafe(x:number,y:number,hw:number,hh:number,w:number,h:number,safe:{top:number;bottom:number;left:number;right:number},margin=8,travel=56){
 const minX=-w/2+safe.left+margin+hw,maxX=w/2-safe.right-margin-hw,minY=-h/2+safe.bottom+margin+hh,maxY=h/2-safe.top-margin-hh-travel;
 return {x:minX>maxX?(minX+maxX)/2:Math.max(minX,Math.min(maxX,x)),y:minY>maxY?(minY+maxY)/2:Math.max(minY,Math.min(maxY,y))};}
