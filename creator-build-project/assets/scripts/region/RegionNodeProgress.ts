import {REGION_NODES,type RegionId} from './RegionNodes';
import {LAKESIDE_REGION_GRAPH} from './LakesideRegionNodes';
/** Kept in lockstep with PersistentMainlinePort.MAINLINE_KEYS and PersistentR5Port.R5_KEYS. The progress test asserts equality. */
export const PROGRESS_KEYS:readonly string[]=['forest-mainline-cocos-r1-active','forest-v33-journey','forest-v3-progress','forest-v3-completed'];
export const R5_PROGRESS_KEYS:readonly string[]=['forest-regional-r05-active','forest-regional-r05-progress','forest-regional-r05-active-v1-backup'];

export const REGION_NODES_KEY='forest-r5-region-nodes-v1';
export type ProgressRegion=RegionId|'lakeside';
export const REGION_ORDER:readonly ProgressRegion[]=['island','meadow','skycity','lakeside'];
const REGION_GRAPHS:Readonly<Record<ProgressRegion,{nodes:readonly {key:string;role:string;opens?:string}[]}>>={
 island:REGION_NODES.island,meadow:REGION_NODES.meadow,skycity:REGION_NODES.skycity,lakeside:LAKESIDE_REGION_GRAPH,
};
/** The shipped stage ids. This module only reads them. */
export const MAINLINE_STAGE_IDS:readonly string[]=['mainline-01','mainline-02','mainline-03','mainline-04','mainline-05','mainline-06','mainline-07','mainline-08','mainline-09','mainline-10','mainline-11','mainline-12'];
const REGION_STAGES:Readonly<Record<RegionId,readonly string[]>>={
 island:MAINLINE_STAGE_IDS.slice(0,4),
 meadow:MAINLINE_STAGE_IDS.slice(4,8),
 skycity:MAINLINE_STAGE_IDS.slice(8,12),
};
const STAGE_NODE:Readonly<Record<string,string>>={
 'mainline-01':'I1','mainline-02':'I2','mainline-03':'I3','mainline-04':'I4',
 'mainline-05':'M1','mainline-06':'M2','mainline-07':'M3','mainline-08':'M4',
 'mainline-09':'S1','mainline-10':'S2','mainline-11':'S3','mainline-12':'S4',
};
export type NodePhase='locked'|'playable'|'passed';
export type MainlineView=Readonly<{completed?:readonly string[]|null}>;
export type R5View=Readonly<{records?:Readonly<Record<string,unknown>>|null;openChallenges?:readonly string[]|null}>;
/** b18 lakeside order (DESIGN §3.2/R4: 新13 教学 → 新16 小高峰 → 新17 回落 → 新18 剧情关). Board stage ids in play order. */
export const LAKESIDE_STAGE_IDS:readonly string[]=['r04-lake-01','r04-lake-02','r04-lake-03','r04-lake-04','r04-lake-05','r04-lake-06'];
export const LAKESIDE_STAGE_LABEL:Readonly<Record<string,string>>={'r04-lake-01':'L13','r04-lake-02':'L14','r04-lake-03':'L15','r04-lake-04':'L16','r04-lake-05':'L17','r04-lake-06':'L18'};
/** 「刻名的桥」(story finale). It never opens before L13–L15 are all cleared, on top of the one-after-another order. */
export const LAKESIDE_BRIDGE_ID='r04-lake-06';
export const LAKESIDE_BRIDGE_REQUIRES:readonly string[]=['r04-lake-01','r04-lake-02','r04-lake-03'];
/** Lakeside stage phases. Locked until S4. A recorded clear is 'passed', and a stage an old save already lists as open stays
 *  'playable' — order only ever opens stages, it never locks an opened or cleared one again. */
export function lakesideStagePhases(s4Passed:boolean,r5View:R5View|null|undefined):Record<string,NodePhase>{
 const out:Record<string,NodePhase>={},records=(r5View&&r5View.records)||{},open=(r5View&&r5View.openChallenges)||[];
 const has=(id:string)=>Object.prototype.hasOwnProperty.call(records,id)&&!!records[id];
 for(let i=0;i<LAKESIDE_STAGE_IDS.length;i++){
  const id=LAKESIDE_STAGE_IDS[i];
  if(has(id)){out[id]='passed';continue;}
  if(open.indexOf(id)>=0){out[id]='playable';continue;}
  if(!s4Passed){out[id]='locked';continue;}
  let ok=i===0||has(LAKESIDE_STAGE_IDS[i-1]);
  if(ok&&id===LAKESIDE_BRIDGE_ID)for(let k=0;k<LAKESIDE_BRIDGE_REQUIRES.length;k++)if(!has(LAKESIDE_BRIDGE_REQUIRES[k]))ok=false;
  out[id]=ok?'playable':'locked';
 }
 return out;
}
/** 2026-10-29 海岸支线 (data side only, not wired into derive/IslandPanels yet). Same rule as the lake: locked until S4
 *  (mainline-12) is passed, then C1..C9 open one after another; a recorded clear or an already-open stage never re-locks.
 *  Display counting follows the lake: the journal pill reads challenges.coast as 「挑战 x/9」 (COAST_STAGES). */
export const COAST_STAGE_IDS:readonly string[]=['r06-coast-01','r06-coast-02','r06-coast-03','r06-coast-04','r06-coast-05','r06-coast-06','r06-coast-07','r06-coast-08','r06-coast-09'];
export const COAST_STAGE_LABEL:Readonly<Record<string,string>>={'r06-coast-01':'C1','r06-coast-02':'C2','r06-coast-03':'C3','r06-coast-04':'C4','r06-coast-05':'C5','r06-coast-06':'C6','r06-coast-07':'C7','r06-coast-08':'C8','r06-coast-09':'C9'};
export const COAST_STAGES=9;
/** 夜航印记 (coast reward) = C7–C9 cleared; mirrors progress-journal COAST_NIGHT_REQUIRES. */
export const COAST_NIGHT_REQUIRES:readonly string[]=['r06-coast-07','r06-coast-08','r06-coast-09'];
export function coastStagePhases(s4Passed:boolean,r5View:R5View|null|undefined):Record<string,NodePhase>{
 const out:Record<string,NodePhase>={},records=(r5View&&r5View.records)||{},open=(r5View&&r5View.openChallenges)||[];
 const has=(id:string)=>Object.prototype.hasOwnProperty.call(records,id)&&!!records[id];
 for(let i=0;i<COAST_STAGE_IDS.length;i++){
  const id=COAST_STAGE_IDS[i];
  if(has(id)){out[id]='passed';continue;}
  if(open.indexOf(id)>=0){out[id]='playable';continue;}
  out[id]=s4Passed&&(i===0||has(COAST_STAGE_IDS[i-1]))?'playable':'locked';
 }
 return out;
}
/** Journal display counter key for a regional stage id (lake as today, plus coast). */
export function challengeRegionOf(stageId:string):'tide'|'meadow'|'sky'|'lake'|'coast'|null{
 const m=/^r05-(tide|meadow|sky)-/.exec(stageId)||/^r0[45]-(lake)-/.exec(stageId)||/^r06-(coast)-/.exec(stageId);return m?m[1] as any:null;
}
export type NodeStates=Readonly<{
 nodes:Readonly<Record<string,NodePhase>>;
 explore:Readonly<Record<ProgressRegion,boolean>>;
 lastPassed:Readonly<Record<ProgressRegion,string|null>>;
 /** b18: per-stage lakeside order (see lakesideStagePhases). */
 lakeStages:Readonly<Record<string,NodePhase>>;
}>;
export type Presentation=Readonly<{lastNode:Readonly<Record<ProgressRegion,string|undefined>>;exploreHintSeen:readonly [boolean,boolean,boolean];v:1}>;

const FORBIDDEN=new Set<string>(PROGRESS_KEYS.concat(R5_PROGRESS_KEYS));
export function forbiddenProgressKeys():readonly string[]{return PROGRESS_KEYS.concat(R5_PROGRESS_KEYS);}

function completedSet(view:MainlineView|null|undefined):Set<string>{
 const out=new Set<string>();const list=view&&view.completed;if(!list)return out;
 for(let i=0;i<list.length;i++)if(MAINLINE_STAGE_IDS.indexOf(list[i])>=0)out.add(list[i]);
 return out;
}
function regionCleared(done:Set<string>,region:ProgressRegion):boolean{
 const stages=REGION_STAGES[region];for(let i=0;i<stages.length;i++)if(!done.has(stages[i]))return false;return true;
}
function challengeOpen(r5:R5View|null|undefined,opens:string|undefined):boolean{
 if(!opens||!r5)return false;
 const open=r5.openChallenges||[];
 for(let i=0;i<open.length;i++)if(open[i]===opens)return true;
 const records=r5.records||{};
 const prefix=opens==='challenge-meadow'?'r05-meadow-':opens==='challenge-sky'?'r05-sky-':opens==='challenge-island'?'r05-tide-':'';
 if(!prefix)return false;
 for(const id of Object.keys(records))if(id.indexOf(prefix)===0)return true;
 return false;
}
export function stageNode(stageId:string):string|null{return STAGE_NODE[stageId]||null;}
export function nodeRegion(key:string):ProgressRegion|null{
 for(let i=0;i<REGION_ORDER.length;i++){const id=REGION_ORDER[i],nodes=REGION_GRAPHS[id].nodes;for(let n=0;n<nodes.length;n++)if(nodes[n].key===key)return id;}
 return null;
}
export function derive(mainlineView:MainlineView|null|undefined,r5View:R5View|null|undefined):NodeStates{
 const done=completedSet(mainlineView);
 const nodes:Record<string,NodePhase>={};
 const explore:Record<ProgressRegion,boolean>={island:regionCleared(done,'island'),meadow:regionCleared(done,'meadow'),skycity:regionCleared(done,'skycity'),lakeside:false};
 const lastPassed:Record<ProgressRegion,string|null>={island:null,meadow:null,skycity:null,lakeside:null};
 for(let s=0;s<MAINLINE_STAGE_IDS.length;s++){
  const id=MAINLINE_STAGE_IDS[s],key=STAGE_NODE[id],region=nodeRegion(key)!;
  const prev=s===0?null:MAINLINE_STAGE_IDS[s-1];
  const first=REGION_STAGES[region][0]===id;
  const prevRegion=region==='island'?null:region==='meadow'?'island':'meadow';
  let phase:NodePhase='locked';
  if(done.has(id))phase='passed';
  else if(first&&(prevRegion===null||regionCleared(done,prevRegion)))phase='playable';
  else if(prev&&done.has(prev))phase='playable';
  nodes[key]=phase;
  if(phase==='passed')lastPassed[region]=key;
 }
 explore.lakeside=nodes.S4==='passed';
 const lakeStages=lakesideStagePhases(nodes.S4==='passed',r5View);
 for(let i=0;i<REGION_ORDER.length;i++){
  const id=REGION_ORDER[i],list=REGION_GRAPHS[id].nodes;
  if(id==='lakeside'){
   // b18: the shore node is only the way in; the 6 boards open one after another (lakeStages), the bridge after L13–L15.
   const open=nodes.S4==='passed';
   let any=false;for(let k=0;k<LAKESIDE_STAGE_IDS.length;k++)if(lakeStages[LAKESIDE_STAGE_IDS[k]]!=='locked')any=true;
   for(let n=0;n<list.length;n++){
    const node=list[n];
    nodes[node.key]=node.role==='arrival'?(open||any?'passed':'locked'):open||any?'playable':'locked';
    if(node.role==='arrival'&&(open||any))lastPassed.lakeside=node.key;
   }
   continue;
  }
  for(let n=0;n<list.length;n++){
   const node=list[n];
   if(node.role==='mainline')continue;
   if(node.role==='optional'){
    const prevMain=id==='island'?'I4':id==='meadow'?'M4':'S4';
    nodes[node.key]=challengeOpen(r5View,node.opens)||nodes[prevMain]==='passed'?'playable':'locked';
   }else if(node.role==='arrival'){
    const prev=id==='meadow'?'island':'meadow';
    nodes[node.key]=explore[prev]||explore[id]?'passed':'locked';
   }else if(node.role==='departure'){
    const prev=id==='island'?'I4':'M4';
    nodes[node.key]=nodes[prev]==='passed'||explore[id]?'playable':'locked';
   }else if(node.role==='finale'){
    nodes[node.key]=nodes.S4==='passed'?'playable':'locked';
   }
  }
 }
 return {nodes,explore,lastPassed,lakeStages};
}
/** Lake chapter opens with the skycity finale: both wait until mainline-12 (S4) is passed. */
export function lakesideDeparture():{region:ProgressRegion;from:string;to:string;departure:boolean;nextRegion:ProgressRegion}{
 return {region:'skycity',from:'S4',to:'S6',departure:true,nextRegion:'lakeside'};
}
/** Where a reward/next-level walk starts and ends. Crossing a region walks to the dock, not into the bridge. */
export function walkPair(fromStage:string,toStage:string):{region:ProgressRegion;from:string;to:string;departure:boolean;nextRegion:ProgressRegion|null}{
 const from=stageNode(fromStage),to=stageNode(toStage);
 if(!from||!to)throw Error('unknown-stage');
 if(fromStage==='mainline-04'&&toStage==='mainline-05')return {region:'island',from:'I4',to:'I6',departure:true,nextRegion:'meadow'};
 if(fromStage==='mainline-08'&&toStage==='mainline-09')return {region:'meadow',from:'M4',to:'M6',departure:true,nextRegion:'skycity'};
 const region=nodeRegion(from)!;
 return {region,from,to,departure:false,nextRegion:null};
}
export function fallbackPresentation(states:NodeStates):Presentation{
 return {v:1,lastNode:{island:states.lastPassed.island||undefined,meadow:states.lastPassed.meadow||undefined,skycity:states.lastPassed.skycity||undefined,lakeside:states.lastPassed.lakeside||undefined},exploreHintSeen:[false,false,false]};
}
export function readPresentation(raw:string|null|undefined,states:NodeStates):Presentation{
 const fallback=fallbackPresentation(states);
 if(!raw)return fallback;
 try{
  const data=JSON.parse(raw);
  if(!data||data.v!==1||!data.lastNode||!Array.isArray(data.exploreHintSeen)||data.exploreHintSeen.length!==3)return fallback;
  const hints:[boolean,boolean,boolean]=[!!data.exploreHintSeen[0],!!data.exploreHintSeen[1],!!data.exploreHintSeen[2]];
  const last:Record<ProgressRegion,string|undefined>={island:undefined,meadow:undefined,skycity:undefined,lakeside:undefined};
  for(let i=0;i<REGION_ORDER.length;i++){const id=REGION_ORDER[i],key=data.lastNode[id];last[id]=typeof key==='string'&&nodeRegion(key)===id?key:fallback.lastNode[id];}
  return {v:1,lastNode:last,exploreHintSeen:hints};
 }catch{return fallback;}
}
export function savePresentation(state:Presentation,setItem:(key:string,value:string)=>void):void{
 if(FORBIDDEN.has(REGION_NODES_KEY))throw Error('presentation-key-collides-with-progress');
  const payload={v:1 as const,lastNode:{island:state.lastNode.island,meadow:state.lastNode.meadow,skycity:state.lastNode.skycity,lakeside:state.lastNode.lakeside},exploreHintSeen:[!!state.exploreHintSeen[0],!!state.exploreHintSeen[1],!!state.exploreHintSeen[2]]};
 setItem(REGION_NODES_KEY,JSON.stringify(payload));
}
export function presentationTouchesProgress(key:string):boolean{return FORBIDDEN.has(key);}
