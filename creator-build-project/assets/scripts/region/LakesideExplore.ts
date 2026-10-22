/** b16 P1-3: the lakeside joins free explore (walkable area = LakesideWalkable, baked from the r5h3 export). Pure, no cc. */
import {REGION_NODES,type RegionId,type Vec} from './RegionNodes';
import {LAKESIDE_REGION_GRAPH} from './LakesideRegionNodes';
export type StageRegion=RegionId|'lakeside';
export type StageGraph=Readonly<{nodes:readonly {key:string;at:Vec}[];edges:readonly {path:readonly Vec[]}[];exploreBox:readonly [number,number,number,number]}>;
export function stageGraph(region:StageRegion):StageGraph{return region==='lakeside'?LAKESIDE_REGION_GRAPH as unknown as StageGraph:REGION_NODES[region];}
/** World state that opens lakeside free explore: in the lakeside, arrived (not travelling), no board, not hidden/paused.
 *  Board exit (暂停 → 「回到小岛」 = exitLevel → levelOrigin 'lakeside') lands exactly here. */
export function lakesideExploreWanted(s:any):boolean{
 if(!s||s.state!=='lakeside'||s.hidden||s.needsResume)return false;
 const j=s.journey;if(j&&(j.region!=='lakeside'||(j.phase&&j.phase!=='arrived')))return false;
 return true;
}
/** Open only on the way OUT of a lakeside board (a 'level' seen while she stood in the lakeside, then the lakeside again), never
 *  during the arrival / landing shot: the landing hook owns the lens then and the board opens by itself. Returns the next armed flag. */
export function lakesideExploreArm(prevState:string|null,s:any,armed:boolean):boolean{
 if(!s)return armed;
 if(s.state==='level')return armed||prevState==='lakeside'||s.stable==='lakeside'||s.journey?.region==='lakeside';
 if(s.state==='lakeside')return armed;
 return false;
}
