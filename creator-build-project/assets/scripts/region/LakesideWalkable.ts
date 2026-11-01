/** 风铃湖畔 shims over RegionWalkable (b16). Model-local metres of the lakeside scene. New code: use RegionWalkable directly. */
import {lineWalkable,nearestWalkable,walkFloorY,walkGrid,walkPath,walkPathLengthM,walkRayHit,WALK_STEP_M,type WVec} from './RegionWalkable';
export type LVec=WVec;
export const LAKESIDE_WATER_Y=0;
export const LAKESIDE_STEP_M=WALK_STEP_M;
export function lakesideWalkGrid(){return walkGrid('lakeside');}
export function lakesideFloorY(x:number,z:number):number|null{return walkFloorY('lakeside',x,z);}
export function lakesideWalkable(x:number,z:number):boolean{return walkFloorY('lakeside',x,z)!==null;}
export function lakesideSnap(p:LVec,radiusM=1.2):LVec|null{return nearestWalkable('lakeside',p,radiusM)?.at??null;}
export function lakesideRayHit(o:LVec,d:LVec,maxM=160,stepM=.05){return walkRayHit('lakeside',o,d,maxM,stepM);}
export function lakesidePath(from:LVec,to:LVec):LVec[]|null{return walkPath('lakeside',from,to);}
export function lakesideLineWalkable(a:LVec,b:LVec):boolean{return lineWalkable('lakeside',a,b);}
export function pathLengthM(p:readonly LVec[]):number{return walkPathLengthM(p);}
