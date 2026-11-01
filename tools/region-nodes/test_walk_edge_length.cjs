'use strict';
// GGbot full9c: edge lengthM (declared, baked) vs the polyline (measured) differ by up to 1.048 m (skycity S4–S6), which stopped walks
// short of their node (finale: 1.048 m before S6) and ran them at ≠ WALK_SPEED_MPS. HARD, every region, every node pair, planWalk + planSkip:
//  (1) the last run ends ON the target node (≤ 1 mm); (2) every run's duration = its polyline length / WALK_SPEED_MPS (±1 ms);
//  (3) the declared-vs-measured table is printed, and any edge off by > 2 m (or a declared ≤ 0) fails (data sanity; route choice uses lengthM).
const ROOT=process.cwd();const {createHarness}=require(ROOT+'/tools/board-ui/harness.cjs');const H=createHarness();
const NW=H.load('region/NodeWalker.ts'),RN=H.load('region/RegionNodes.ts');
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),L=p=>{let n=0;for(let i=1;i<p.length;i++)n+=d3(p[i-1],p[i]);return n;};
const bad=[],edges=[];let plans=0;
for(const [r,D] of Object.entries(RN.REGION_NODES)){
 for(const e of D.edges){const m=L(e.path),dm=m-e.lengthM;edges.push({r,edge:e.a+'-'+e.b,declared:e.lengthM,measured:+m.toFixed(3),diff:+dm.toFixed(3)});if(Math.abs(dm)>2||!(e.lengthM>0))bad.push('edge '+r+' '+e.a+'-'+e.b+' declared '+e.lengthM+' measured '+m.toFixed(3));}
 const ks=D.nodes.map(n=>n.key);
 for(const f of ks)for(const t of ks){if(f===t)continue;let route;try{route=NW.routeKeys(r,f,t);}catch{continue;}const node=D.nodes.find(n=>n.key===t).at;
  for(const k of ['planWalk','planSkip']){const p=NW[k](r,f,t);plans++;const end=p.segments.at(-1).path.at(-1);
   if(d3(end,node)>1e-3)bad.push(k+' '+r+' '+f+'>'+t+' ends '+d3(end,node).toFixed(3)+' m from '+t);
   p.segments.forEach((s,i)=>{const want=L(s.path)/NW.WALK_SPEED_MPS;if(Math.abs(s.duration-want)>1e-3)bad.push(k+' '+r+' '+f+'>'+t+' run '+i+' '+s.duration.toFixed(3)+'s ≠ '+want.toFixed(3)+'s (speed)');});}}}
console.log(JSON.stringify({test:'walk-edge-length',plans,edgesOff:edges.filter(e=>Math.abs(e.diff)>0.01),bad:bad.slice(0,20),badN:bad.length,status:bad.length?'FAIL':'PASS'},null,1));process.exit(bad.length?1:0);
