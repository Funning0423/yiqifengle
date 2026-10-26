import {REGION_NODES,type RegionEdge,type RegionId,type Vec} from './RegionNodes';

export const WALK_SPEED_MPS=1.2;
export const DIRECT_MAX_M=9.6;
export const CUT_RUN_M=4.2;
export const SKIP_REMAIN_M=1.2;
export const VISIBLE_MAX_S=7.6;
export type WalkSegment=Readonly<{path:readonly Vec[];duration:number}>;
export type WalkPlan=Readonly<{segments:readonly WalkSegment[];cut:boolean;fades:number;lengthM:number}>;

const sub=(a:Vec,b:Vec):number[]=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const hypot=(v:number[])=>Math.hypot(v[0],v[1],v[2]);
function segLen(a:Vec,b:Vec){return hypot(sub(b,a));}
export function pathLength(path:readonly Vec[]):number{let n=0;for(let i=1;i<path.length;i++)n+=segLen(path[i-1],path[i]);return n;}
function lerp(a:Vec,b:Vec,t:number):Vec{return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
/** Point at arc length `dist` along a polyline. */
export function pointAlong(path:readonly Vec[],dist:number):Vec{
 if(path.length===0)throw Error('empty-path');
 if(dist<=0)return path[0];
 let left=dist;
 for(let i=1;i<path.length;i++){const L=segLen(path[i-1],path[i]);if(left<=L)return lerp(path[i-1],path[i],L?left/L:0);left-=L;}
 return path[path.length-1];
}
export function slicePath(path:readonly Vec[],fromM:number,toM:number):Vec[]{
 const a=Math.max(0,fromM),b=Math.max(a,toM);
 const out:Vec[]=[pointAlong(path,a)];
 let acc=0;
 for(let i=1;i<path.length;i++){const L=segLen(path[i-1],path[i]);const next=acc+L;if(next>a&&acc<b){if(acc>a&&next<b)out.push(path[i]);}acc=next;}
 const end=pointAlong(path,b);
 const last=out[out.length-1];
 if(segLen(last,end)>1e-4)out.push(end);
 return out;
}
function edgesOf(region:RegionId):readonly RegionEdge[]{return REGION_NODES[region].edges;}
function undirected(region:RegionId,a:string,b:string):{path:Vec[];lengthM:number}|null{
 const list=edgesOf(region);
 for(let i=0;i<list.length;i++){const e=list[i];
  if(e.a===a&&e.b===b)return {path:e.path.slice(),lengthM:e.lengthM};
  if(e.a===b&&e.b===a)return {path:e.path.slice().reverse(),lengthM:e.lengthM};
 }
 return null;
}
/** Shortest path on the baked node graph (undirected). */
export function routeKeys(region:RegionId,fromKey:string,toKey:string):{keys:string[];path:Vec[];lengthM:number}{
 if(fromKey===toKey){const node=REGION_NODES[region].nodes.find(n=>n.key===fromKey);if(!node)throw Error('missing-node');return {keys:[fromKey],path:[node.at],lengthM:0};}
 const nodes=REGION_NODES[region].nodes.map(n=>n.key);
 const dist:Record<string,number>={};const prev:Record<string,string|null>={};
 for(let i=0;i<nodes.length;i++){dist[nodes[i]]=Infinity;prev[nodes[i]]=null;}
 dist[fromKey]=0;
 const used:Record<string,boolean>={};
 for(let step=0;step<nodes.length;step++){
  let u:string|null=null,best=Infinity;
  for(let i=0;i<nodes.length;i++){const k=nodes[i];if(!used[k]&&dist[k]<best){best=dist[k];u=k;}}
  if(u===null)break;used[u]=true;if(u===toKey)break;
  for(let i=0;i<nodes.length;i++){const v=nodes[i];if(used[v])continue;const e=undirected(region,u,v);if(!e)continue;const nd=dist[u]+e.lengthM;if(nd<dist[v]){dist[v]=nd;prev[v]=u;}}
 }
 if(!isFinite(dist[toKey]))throw Error('no-route '+fromKey+' '+toKey);
 const keys:string[]=[toKey];let cur:string|null=toKey;
 while(prev[cur!]!==null){cur=prev[cur!];keys.push(cur!);}keys.reverse();
 const path:Vec[]=[];let lengthM=0;
 for(let i=1;i<keys.length;i++){const e=undirected(region,keys[i-1],keys[i])!;if(path.length)path.pop();for(let p=0;p<e.path.length;p++)path.push(e.path[p]);lengthM+=e.lengthM;}
 return {keys,path,lengthM};
}
/** full9c (Grok Bot / 运镜bot finale S6): edge lengthM is the DECLARED (baked) length and differs from the polyline by up to 1.05 m
 *  (skycity S4–S6 31.12 vs 32.168). Slicing at the declared length stopped walks short of the target node (finale: 1.048 m before S6)
 *  and the fixed CUT_RUN_M duration made the real speed ≠ WALK_SPEED_MPS. Root fix, shared walker: the last run ENDS ON THE TARGET NODE
 *  (snap — no skipped interior vertex is re-added, so the arrival heading of the final run is kept) and every run's duration is its measured
 *  polyline length / WALK_SPEED_MPS (speed unchanged). Head runs / start points are unchanged. */
function endOn(seg:Vec[],node:Vec):Vec[]{const out=seg.slice();if(segLen(out[out.length-1],node)>1e-6){if(out.length>1)out[out.length-1]=node;else out.push(node);}return out;}
function run(path:Vec[]):WalkSegment{return {path,duration:pathLength(path)/WALK_SPEED_MPS};}
function clip(path:readonly Vec[],lengthM:number):WalkPlan{
 const node=path[path.length-1];
 if(lengthM<=DIRECT_MAX_M){const p=path.slice();return {segments:[run(p)],cut:false,fades:0,lengthM:pathLength(p)};}
 const head=slicePath(path,0,CUT_RUN_M),tail=endOn(slicePath(path,Math.max(0,lengthM-CUT_RUN_M),lengthM),node);
 return {segments:[run(head),run(tail)],cut:true,fades:1,lengthM};
}
export function planWalk(region:RegionId,fromKey:string,toKey:string):WalkPlan{
 const route=routeKeys(region,fromKey,toKey);return clip(route.path,route.lengthM);
}
/** One fade, then a 1 s walk of the last 1.2 m. */
export function planSkip(region:RegionId,fromKey:string,toKey:string):WalkPlan{
 const route=routeKeys(region,fromKey,toKey);
 const start=Math.max(0,route.lengthM-SKIP_REMAIN_M);
 const path=endOn(slicePath(route.path,start,route.lengthM),route.path[route.path.length-1])/* full9c: ends on the node */;
 const remain=pathLength(path);
 return {segments:[{path,duration:remain/WALK_SPEED_MPS}],cut:true,fades:1,lengthM:remain};
}
function closestOnPath(path:readonly Vec[],p:Vec):{dist:number;along:number;point:Vec}{
 let best=Infinity,along=0,point=path[0],acc=0;
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],ab=sub(b,a),L=hypot(ab)||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*ab[0]+(p[1]-a[1])*ab[1]+(p[2]-a[2])*ab[2])/(L*L)));
  const q=lerp(a,b,t),d=hypot(sub(p,q));if(d<best){best=d;point=q;along=acc+segLen(a,q);}acc+=segLen(a,b);}
 return {dist:best,along,point};
}
export function planTapWalk(region:RegionId,from:Vec,to:Vec):WalkPlan|null{
 const list=edgesOf(region);let bestFrom:null|{edge:number;hit:ReturnType<typeof closestOnPath>}=null,bestTo:null|{edge:number;hit:ReturnType<typeof closestOnPath>}=null;
 for(let i=0;i<list.length;i++){const hf=closestOnPath(list[i].path,from),ht=closestOnPath(list[i].path,to);
  if(!bestFrom||hf.dist<bestFrom.hit.dist)bestFrom={edge:i,hit:hf};
  if(!bestTo||ht.dist<bestTo.hit.dist)bestTo={edge:i,hit:ht};}
 if(!bestFrom||!bestTo||bestFrom.hit.dist>3||bestTo.hit.dist>3)return null;
 if(bestFrom.edge===bestTo.edge){
  const a=Math.min(bestFrom.hit.along,bestTo.hit.along),b=Math.max(bestFrom.hit.along,bestTo.hit.along);
  const path=bestFrom.hit.along<=bestTo.hit.along?slicePath(list[bestFrom.edge].path,a,b):slicePath(list[bestFrom.edge].path,a,b).reverse() as Vec[];
  return clip(path,Math.abs(b-a));
 }
 const ea=list[bestFrom.edge],eb=list[bestTo.edge];
 const fromKey=bestFrom.hit.along<ea.lengthM/2?ea.a:ea.b;
 const toKey=bestTo.hit.along<eb.lengthM/2?eb.a:eb.b;
 const route=routeKeys(region,fromKey,toKey);
 return clip(route.path,route.lengthM);
}
export function visibleSeconds(plan:WalkPlan):number{let n=0;for(let i=0;i<plan.segments.length;i++)n+=plan.segments[i].duration;return n;}
/** Distance from a point to the baked polyline. Cut points are constructed on it. */
export function distanceToPolyline(path:readonly Vec[],p:Vec):number{return closestOnPath(path,p).dist;}
