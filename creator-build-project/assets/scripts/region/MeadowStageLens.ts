import {stageNode} from './RegionNodeProgress';

/** 运镜bot b20 meadow-board-lens: which meadow node the board lens frames. 场景设计部 moved M1–M3 (scene/b20-meadow-walk-fixes);
 *  one shared lens on M1 left stage 06 (M2) off-screen on 390×844. Each meadow board 05–08 now frames ITS OWN node with the
 *  same solver (meadowFramedPose: same view direction, pitch and FOV as the shared lens, only the position slides).
 *  05 → M1 keeps the reviewed pose. Unknown / non-meadow stage → M1 (the sail arrival end). Pure state, no camera writes. */
export const MEADOW_STAGE_LENS={fallback:'M1',nodes:['M1','M2','M3','M4']} as const;
let current:string=MEADOW_STAGE_LENS.fallback;
export function meadowLensNodeFor(stageId:string|null|undefined):string{
 const k=stageId?stageNode(stageId):null;
 return k&&(MEADOW_STAGE_LENS.nodes as readonly string[]).indexOf(k)>=0?k:MEADOW_STAGE_LENS.fallback;
}
/** Called when a meadow board is about to be shown (reward walk target, level entry). */
export function setMeadowBoardStage(stageId:string|null|undefined):string{current=meadowLensNodeFor(stageId);return current;}
export function meadowBoardNode():string{return current;}
export function resetMeadowBoardStage():void{current=MEADOW_STAGE_LENS.fallback;}
type P=Readonly<{position:readonly number[];target:readonly number[];fovVerticalDeg?:number}>;
/** Approved gate (Grok Bot, Oct 30), with headroom: a smootherstep blend (ExploreCameraCore.blendPose) of distance d / view angle θ
 *  / FOV Δ over T s peaks at 1.875·d/T, 1.875·θ/T, |e''|max 5.774·θ/T², 1.875·Δ/T. T is the shortest that keeps every peak under
 *  its cap (8 m/s → 6.5 (her 1.2 m/s walk rides on the live follow target), 90°/s → 50 (jitter headroom for the 200°/s² p99), 200°/s² → 120 (real-dt jitter headroom), 1.5°/frame at 30 fps → 40°/s), never below `minS` (the authored BLEND_S) nor floorS (real-dt jitter on the 768×1024 short blends measured p99 > 200°/s² at 0.75 s). */
export const MEADOW_BLEND_CAPS={mps:6.5,degPerS:50,degPerS2:120,fovDegPerS:40,floorS:1.2} as const;
export function meadowBlendSeconds(from:P,to:P,minS:number):number{
 const C=MEADOW_BLEND_CAPS,u=(p:P)=>{const d=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(d[0],d[1],d[2])||1;return [d[0]/l,d[1]/l,d[2]/l];};
 const a=u(from),b=u(to),th=Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])))*180/Math.PI;
 const d=Math.hypot(to.position[0]-from.position[0],to.position[1]-from.position[1],to.position[2]-from.position[2]),df=Math.abs((to.fovVerticalDeg??48)-(from.fovVerticalDeg??48));
 return Math.max(minS,C.floorS,1.875*d/C.mps,1.875*th/C.degPerS,Math.sqrt(5.774*th/C.degPerS2),1.875*df/C.fovDegPerS);
}
