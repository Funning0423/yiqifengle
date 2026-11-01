'use strict';
// RegionJourneyCore.sampleRoute end-snap (v1 change): old vs new on every region route the journey scene builds + 20k random
// polylines. Only the last-segment, within-1e-9-m case may differ (it returns the exact end vertex).
const Jn=require('../journey-integration/journey-scene.cjs'),Core=Jn.H.load(Jn.S+'world-r1/RegionJourneyCore.ts'),assert=require('assert');
const dist=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
function oldSample(path,distance){let left=Math.max(0,distance);for(let i=1;i<path.length;i++){const d=dist(path[i-1],path[i]);if(d>0&&left<=d){const a=path[i-1],b=path[i],t=left/d;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}left-=d;}return path[path.length-1];}
let n=0,maxDiff=0,diffs=0;const check=(path,label)=>{const L=Core.routeLength(path);for(let k=0;k<=400;k++){const d=L*k/400+(k===400?-1e-12:0),a=oldSample(path,d),b=Core.sampleRoute(path,d),e=dist(a,b);n++;if(e>0){diffs++;maxDiff=Math.max(maxDiff,e);assert.ok(e<1e-8,label+' differs by '+e+' at '+d);}}
 assert.deepStrictEqual(Core.sampleRoute(path,L),path[path.length-1].slice(),label+' end');};
const routes=Jn.routes?Jn.routes():[];for(const r of routes)check(r.path,r.name||'route');
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
for(let i=0;i<20000;i++){const m=2+Math.floor(rnd()*30),p=[];for(let j=0;j<m;j++)p.push([rnd()*50,rnd()*5,rnd()*50]);check(p,'random'+i);}
console.log(JSON.stringify({status:'PASS',sceneRoutes:routes.length,samples:n,samplesThatDiffer:diffs,maxDiffM:maxDiff}));
