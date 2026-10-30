import {REGION_NODES,type RegionEdge,type RegionId,type Vec} from './RegionNodes';

export const WALK_SPEED_MPS=1.2;
export const DIRECT_MAX_M=9.6;
export const CUT_RUN_M=4.2;
export const SKIP_REMAIN_M=1.2;
export const VISIBLE_MAX_S=7.7/* full9c (Grok Bot Oct 26): walks end ON the node at 1.2 m/s — S3>S4 7.65 s; was 7.6 */;
export const CUT_RUN_MAX_S=4.3/* full9c: S3>S4 tail 4.21 s, S4>S6 4.13 s; was 3.5 (CUT_RUN_M/speed) */;
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
/** b21 waypoint walk (Grok Bot): a configured route walks THROUGH its waypoints as ONE continuous walk — no clip, no fade, no stop
 *  or idle at a waypoint. The path is cut into legs ≤ DIRECT_MAX_M at the waypoints (bookkeeping only) and walked by a heading
 *  pursuit (smoothThrough) whose heading rate and heading acceleration are bounded (no snap turn; radius ≥ v/ω). She keeps WALK_SPEED_MPS on the curve (no slow-down, turn cost 0 s), so
 *  duration = curved length / WALK_SPEED_MPS and the walk_loop rate (CharacterMotion.planWalk, L/D) matches her displacement.
 *  Caps (tools/nodewalker-waypoints/test_nodewalker_waypoints.cjs re-derives them from the sources):
 *   heading rate ≤ min(CharacterMotion.WALK_YAW_MAX_DEG_S 150, LensSmooth.yawOursDegS 90, follow-lens arm limit
 *   (8 m/s − 1.2 m/s)/|FOLLOW back,side| 7.023 m = 55.48°/s) = 55.48°/s; heading acceleration ≤ LensSmooth.yawAccDegS2 200°/s².
 *   The pursuit runs at WAYPOINT_DESIGN_MARGIN of both caps (room for the YawFollower lag and its 0.2 m look-ahead).
 *  Default: a route with no entry in WAYPOINT_ROUTES (and no explicit route argument) is planned exactly as before. */
export const WAYPOINT_HEADING_CAP_DEG_S=55.48;
export const WAYPOINT_HEADING_ACC_CAP_DEG_S2=200;
export const WAYPOINT_DESIGN_MARGIN=0.9;
/** via: waypoints in region-local metres, or node keys walked through on the baked graph (pass-through nodes). */
export type WaypointRoute=Readonly<{via:readonly (Vec|string)[]}>;
/** Production waypoint routes, key `${region}:${from}>${to}`. None enabled yet (island I3→I4 waits for 场景设计部's A/C choice;
 *  skycity pass-through walks also need SkyRunLens rails, which are keyed to the two clipped runs). */
export const WAYPOINT_ROUTES:Readonly<Record<string,WaypointRoute>>={};
/** polylineM: the waypoint polyline; baseM: the same after out-and-back spurs are cut (what the pursuit follows). */
export type ChainedPlan=WalkPlan&Readonly<{legs:readonly number[];polylineM:number;baseM:number}>;
const H2=(a:Vec,b:Vec)=>Math.hypot(b[0]-a[0],b[2]-a[2]);
/** Out-and-back spurs (a pass-through dead-end node) are cut where the path comes back within 0.35 m (SkyLakePreWalk.dropLoops rule). */
function dropSpurs(path:readonly Vec[],pin:readonly Vec[],tolM=.35):Vec[]{const p=path.slice();for(let i=0;i<p.length;i++)for(let j=p.length-1;j>i+1;j--)if(H2(p[i],p[j])<=tolM&&!p.slice(i+1,j).some(q=>pin.indexOf(q)>=0)){p.splice(i+1,j-i);break;}return p;}
/** Look-ahead (m) of the heading pursuit. Measured (tools/nodewalker-waypoints): 0.8 m breaks the heading-accel p99 (204°/s² on
 *  skycity S3>S4), 1.6 m cuts corners onto blocked floor (skycity S0>…>S6: 6 cells); 1.2 m keeps every covered route in both. */
export const PURSUIT_LOOKAHEAD_M=1.2;
const PURSUIT_STEP_M=0.02;
/** Constant-speed heading pursuit along `poly` (b21): heading rate ≤ ω and heading acceleration ≤ α (design = WAYPOINT_DESIGN_MARGIN ×
 *  caps) by construction — a time-optimal bang-bang rate profile (ω_cmd = sign(e)·min(ω, √(2α|e|)), rate slews ≤ α) toward the
 *  polyline point PURSUIT_LOOKAHEAD_M past her projection; the last look-ahead is the end node, the path ends ON it. Turn radius
 *  ≥ v/ω. Pinned waypoints are approached like any vertex (passed within the corner cut, reported by the gate). */
export function smoothThrough(poly:readonly Vec[],pin:readonly Vec[]=[]):{path:Vec[];baseM:number}{
 const p=dropSpurs(poly.filter((v,i)=>i===0||segLen(poly[i-1],v)>1e-4),pin),v=WALK_SPEED_MPS,ds=PURSUIT_STEP_M,Ld=PURSUIT_LOOKAHEAD_M;
 const wS=WAYPOINT_DESIGN_MARGIN*WAYPOINT_HEADING_CAP_DEG_S*Math.PI/180/v,aS=WAYPOINT_DESIGN_MARGIN*WAYPOINT_HEADING_ACC_CAP_DEG_S2*Math.PI/180/(v*v);
 const L=pathLength(p),end=p[p.length-1],cum=[0];for(let i=1;i<p.length;i++)cum.push(cum[i-1]+segLen(p[i-1],p[i]));
 if(p.length<2||L<1e-6)return {path:p.slice(),baseM:L};
 const project=(q:Vec,from:number)=>{let best=Infinity,along=from;for(let i=1;i<p.length;i++){if(cum[i]<from-1e-9||cum[i-1]>from+Ld)continue;const a=p[i-1],b=p[i],dx=b[0]-a[0],dz=b[2]-a[2],l2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[2]-a[2])*dz)/l2)),
  s=cum[i-1]+(cum[i]-cum[i-1])*t;if(s<from)continue;const d=Math.hypot(a[0]+dx*t-q[0],a[2]+dz*t-q[2]);if(d<best){best=d;along=s;}}return along;};
 const t0=pointAlong(p,Math.min(L,Ld));let x=p[0][0],z=p[0][2],th=Math.atan2(t0[2]-z,t0[0]-x),w=0,prog=0;const out:Vec[]=[p[0]];
 for(let k=0,max=Math.ceil(4*L/ds)+2000;k<max;k++){
  prog=project([x,0,z],prog);const near=H2([x,0,z],end);
  if(near<=ds*1.5||(prog>=L-1e-6&&near<=ds*3)){out.push(end);break;}
  const tg=prog+Ld>=L?end:pointAlong(p,prog+Ld);let e=Math.atan2(tg[2]-z,tg[0]-x)-th;while(e>Math.PI)e-=2*Math.PI;while(e<-Math.PI)e+=2*Math.PI;
  const wc=Math.sign(e)*Math.min(wS,Math.sqrt(2*aS*Math.abs(e)));w+=Math.max(-aS*ds,Math.min(aS*ds,wc-w));th+=w*ds;x+=Math.cos(th)*ds;z+=Math.sin(th)*ds;
  if(k%5===4){let y=0;for(let j=-4;j<=4;j++)y+=pointAlong(p,Math.max(0,Math.min(L,prog+j*0.1)))[1];out.push([x,y/9,z]);}
  if(k===max-1)out.push(end);}
 // her height: the floor under the projection, averaged over ±0.4 m of her own path (a projection that jumps at a corner is no step)
 const ys=out.map(q=>q[1]),N=out.length,avg=ys.map((_,i)=>{let y=0,n=0;for(let j=Math.max(0,i-4);j<=Math.min(N-1,i+4);j++){y+=ys[j];n++;}return y/n;}),R=Math.min(10,Math.floor((N-1)/2));
 const sm=out.map((q,i)=>{let y=avg[i];if(R>0){if(i<R)y+=(ys[0]-avg[0])*(1-i/R);if(N-1-i<R)y+=(ys[N-1]-avg[N-1])*(1-(N-1-i)/R);}return [q[0],y,q[2]] as Vec;});/* ends ramp back to the exact node height over 1 m */
 return {path:sm.filter((q,i)=>i===0||segLen(sm[i-1],q)>1e-6),baseM:L};}
/** Polyline through the waypoints: a node key walks the baked graph to that node, a point is reached on a straight leg. */
export function waypointPolyline(region:RegionId,fromKey:string,toKey:string,route:WaypointRoute):{poly:Vec[];marks:number[];pins:Vec[]}{
 const at=(k:string)=>{const n=REGION_NODES[region].nodes.find(x=>x.key===k);if(!n)throw Error('missing-node '+k);return n.at as Vec;};
 const pins:Vec[]=[],poly:Vec[]=[at(fromKey)],marks:number[]=[],stops=(route.via as readonly (Vec|string)[]).concat([toKey]);let key:string|null=fromKey;
 for(let i=0;i<stops.length;i++){const s=stops[i];
  if(typeof s==='string'){if(key!==null){const r=routeKeys(region,key,s).path;for(let j=1;j<r.length;j++)poly.push(r[j]);}else poly.push(at(s));key=s;}
  else{poly.push(s);pins.push(s);key=null;}
  if(i<stops.length-1)marks.push(pathLength(poly));}
 return {poly,marks,pins};}
/** One continuous walk through the waypoints. Legs: lengths between waypoints, each long leg split evenly to ≤ DIRECT_MAX_M. */
export function planChained(poly:readonly Vec[],marks:readonly number[]=[],pins:readonly Vec[]=[]):ChainedPlan{
 const sm=smoothThrough(poly,pins),L=pathLength(sm.path),P=pathLength(poly),legs:number[]=[];let last=0;
 const ms=marks.concat([P]);for(let q=0;q<ms.length;q++){const m=ms[q],span=m-last;if(span<=1e-6)continue;const k=Math.max(1,Math.ceil(span/DIRECT_MAX_M-1e-9));for(let j=0;j<k;j++)legs.push(span/k);last=m;}
 return {segments:[run(sm.path)],cut:false,fades:0,lengthM:L,legs,polylineM:P,baseM:sm.baseM};}
export function planWalk(region:RegionId,fromKey:string,toKey:string,route?:WaypointRoute|null):WalkPlan{
 const wp=route===undefined?WAYPOINT_ROUTES[region+':'+fromKey+'>'+toKey]:route;
 if(wp&&wp.via.length){const w=waypointPolyline(region,fromKey,toKey,wp);return planChained(w.poly,w.marks,w.pins);}
 const route0=routeKeys(region,fromKey,toKey);return clip(route0.path,route0.lengthM);
}
/** One fade, then a 1 s walk of the last 1.2 m. */
export function planSkip(region:RegionId,fromKey:string,toKey:string):WalkPlan{
 const route=routeKeys(region,fromKey,toKey),M=pathLength(route.path)/* full9c: measured, so the 1 s run is the real last 1.2 m and ends ON the node */;
 const start=Math.max(0,M-SKIP_REMAIN_M);
 const path=slicePath(route.path,start,M);
 return {segments:[run(path)],cut:true,fades:1,lengthM:pathLength(path)};
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
