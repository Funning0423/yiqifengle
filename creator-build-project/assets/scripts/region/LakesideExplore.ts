/** b16 free explore after a board exit, for meadow / skycity / lakeside, and (b17 r7) the island too: same RegionWalkable ground taps;
 *  while explore is on, WorldFlowComponent's own island orbit stands down (settleOrbit returns when exploreEnabled()).
 *  Pure, no cc. Walkable areas: RegionWalkable.ts. */
import {REGION_NODES,type RegionId,type Vec} from './RegionNodes';
import {LAKESIDE_REGION_GRAPH} from './LakesideRegionNodes';
export type StageRegion=RegionId|'lakeside';
export type ExploreRegion='island'|'meadow'|'skycity'|'lakeside';
export const EXIT_EXPLORE_REGIONS:readonly ExploreRegion[]=['meadow','skycity','lakeside','island'];
export type StageGraph=Readonly<{nodes:readonly {key:string;at:Vec}[];edges:readonly {path:readonly Vec[]}[];exploreBox:readonly [number,number,number,number]}>;
export function stageGraph(region:StageRegion):StageGraph{return region==='lakeside'?LAKESIDE_REGION_GRAPH as unknown as StageGraph:REGION_NODES[region];}
/** World state where `region` free explore may be open: she stands in that journey region, arrived (not travelling), no board,
 *  not hidden / waiting for resume. Board exit (暂停 →「离开棋盘」 = exitLevel → levelOrigin) lands exactly here. */
export function exploreWanted(region:ExploreRegion,s:any):boolean{
 if(!s||s.state!==region||s.hidden||s.needsResume)return false;
 const j=s.journey;
 // island: home region, no journey of its own (or one that has come back to the island) - just not mid-travel
 // b17r12: a journey that never left (or came home) sits at region 'island', phase 'idle' (RegionJourneyCore start / returnToIsland)
 if(region==='island')return !j||!j.region||j.region==='island'&&(!j.phase||j.phase==='arrived'||j.phase==='idle');if(!j||j.region!==region||(j.phase&&j.phase!=='arrived'))return false;
 return true;
}
/** Armed only on the way OUT of a board of that region ('level' seen while her journey region is `region`), never by the arrival /
 *  landing / transit shots (those own the lens; the board opens by itself). Returns the next armed flag. */
export function exploreArm(region:ExploreRegion,prevState:string|null,s:any,armed:boolean):boolean{
 if(!s)return armed;
 if(s.state==='level')return armed||prevState===region||s.journey?.region===region||(region==='island'&&!s.journey?.region&&prevState!=='home');
 if(s.state===region)return armed;
 return false;
}
/** First region whose explore should open now (armed + wanted), or null. */
export function exploreTarget(s:any,armed:Readonly<Partial<Record<ExploreRegion,boolean>>>):ExploreRegion|null{
 for(const r of EXIT_EXPLORE_REGIONS)if(armed[r]&&exploreWanted(r,s))return r;
 return null;
}
export function lakesideExploreWanted(s:any):boolean{return exploreWanted('lakeside',s);}
export function lakesideExploreArm(prevState:string|null,s:any,armed:boolean):boolean{return exploreArm('lakeside',prevState,s,armed);}
