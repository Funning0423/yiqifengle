import {REGION_NODES,type RegionId} from './RegionNodes';
/** Kept in lockstep with PersistentMainlinePort.MAINLINE_KEYS and PersistentR5Port.R5_KEYS. The progress test asserts equality. */
export const PROGRESS_KEYS:readonly string[]=['forest-mainline-cocos-r1-active','forest-v33-journey','forest-v3-progress','forest-v3-completed'];
export const R5_PROGRESS_KEYS:readonly string[]=['forest-regional-r05-active','forest-regional-r05-progress','forest-regional-r05-active-v1-backup'];

export const REGION_NODES_KEY='forest-r5-region-nodes-v1';
export const REGION_ORDER:readonly RegionId[]=['island','meadow','skycity'];
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
export type NodeStates=Readonly<{
 nodes:Readonly<Record<string,NodePhase>>;
 explore:Readonly<Record<RegionId,boolean>>;
 lastPassed:Readonly<Record<RegionId,string|null>>;
}>;
export type Presentation=Readonly<{lastNode:Readonly<Record<RegionId,string|undefined>>;exploreHintSeen:readonly [boolean,boolean,boolean];v:1}>;

const FORBIDDEN=new Set<string>(PROGRESS_KEYS.concat(R5_PROGRESS_KEYS));
export function forbiddenProgressKeys():readonly string[]{return PROGRESS_KEYS.concat(R5_PROGRESS_KEYS);}

function completedSet(view:MainlineView|null|undefined):Set<string>{
 const out=new Set<string>();const list=view&&view.completed;if(!list)return out;
 for(let i=0;i<list.length;i++)if(MAINLINE_STAGE_IDS.indexOf(list[i])>=0)out.add(list[i]);
 return out;
}
function regionCleared(done:Set<string>,region:RegionId):boolean{
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
export function nodeRegion(key:string):RegionId|null{
 for(let i=0;i<REGION_ORDER.length;i++){const id=REGION_ORDER[i],nodes=REGION_NODES[id].nodes;for(let n=0;n<nodes.length;n++)if(nodes[n].key===key)return id;}
 return null;
}
export function derive(mainlineView:MainlineView|null|undefined,r5View:R5View|null|undefined):NodeStates{
 const done=completedSet(mainlineView);
 const nodes:Record<string,NodePhase>={};
 const explore={island:regionCleared(done,'island'),meadow:regionCleared(done,'meadow'),skycity:regionCleared(done,'skycity')};
 const lastPassed:{island:string|null;meadow:string|null;skycity:string|null}={island:null,meadow:null,skycity:null};
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
 for(let i=0;i<REGION_ORDER.length;i++){
  const id=REGION_ORDER[i],list=REGION_NODES[id].nodes;
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
 return {nodes,explore,lastPassed};
}
/** Where a reward/next-level walk starts and ends. Crossing a region walks to the dock, not into the bridge. */
export function walkPair(fromStage:string,toStage:string):{region:RegionId;from:string;to:string;departure:boolean;nextRegion:RegionId|null}{
 const from=stageNode(fromStage),to=stageNode(toStage);
 if(!from||!to)throw Error('unknown-stage');
 if(fromStage==='mainline-04'&&toStage==='mainline-05')return {region:'island',from:'I4',to:'I6',departure:true,nextRegion:'meadow'};
 if(fromStage==='mainline-08'&&toStage==='mainline-09')return {region:'meadow',from:'M4',to:'M6',departure:true,nextRegion:'skycity'};
 const region=nodeRegion(from)!;
 return {region,from,to,departure:false,nextRegion:null};
}
export function fallbackPresentation(states:NodeStates):Presentation{
 return {v:1,lastNode:{island:states.lastPassed.island||undefined,meadow:states.lastPassed.meadow||undefined,skycity:states.lastPassed.skycity||undefined},exploreHintSeen:[false,false,false]};
}
export function readPresentation(raw:string|null|undefined,states:NodeStates):Presentation{
 const fallback=fallbackPresentation(states);
 if(!raw)return fallback;
 try{
  const data=JSON.parse(raw);
  if(!data||data.v!==1||!data.lastNode||!Array.isArray(data.exploreHintSeen)||data.exploreHintSeen.length!==3)return fallback;
  const hints:[boolean,boolean,boolean]=[!!data.exploreHintSeen[0],!!data.exploreHintSeen[1],!!data.exploreHintSeen[2]];
  const last:Record<RegionId,string|undefined>={island:undefined,meadow:undefined,skycity:undefined};
  for(let i=0;i<REGION_ORDER.length;i++){const id=REGION_ORDER[i],key=data.lastNode[id];last[id]=typeof key==='string'&&nodeRegion(key)===id?key:fallback.lastNode[id];}
  return {v:1,lastNode:last,exploreHintSeen:hints};
 }catch{return fallback;}
}
export function savePresentation(state:Presentation,setItem:(key:string,value:string)=>void):void{
 if(FORBIDDEN.has(REGION_NODES_KEY))throw Error('presentation-key-collides-with-progress');
 const payload={v:1 as const,lastNode:{island:state.lastNode.island,meadow:state.lastNode.meadow,skycity:state.lastNode.skycity},exploreHintSeen:[!!state.exploreHintSeen[0],!!state.exploreHintSeen[1],!!state.exploreHintSeen[2]]};
 setItem(REGION_NODES_KEY,JSON.stringify(payload));
}
export function presentationTouchesProgress(key:string):boolean{return FORBIDDEN.has(key);}
