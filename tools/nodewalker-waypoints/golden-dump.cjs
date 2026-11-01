'use strict';
// Golden of the DEFAULT NodeWalker behaviour (no waypoints): every ordered node pair per region through planWalk / planSkip, and
// planTapWalk for every pair of baked polyline vertices sampled every 3rd point. Paths rounded to 1e-6 m and hashed; durations kept.
// Usage: node golden-dump.cjs > golden-default.json   (generated from ggbot/cand-20261030 @ fc3123fa NodeWalker.ts)
const crypto=require('crypto'),{createHarness}=require('../board-ui/harness.cjs');
function dump(){const H=createHarness(),W=H.load('region/NodeWalker.ts'),N=H.load('region/RegionNodes.ts').REGION_NODES;
 const r6=x=>Math.round(x*1e6)/1e6,ser=p=>p?{cut:p.cut,fades:p.fades,lengthM:r6(p.lengthM),durations:p.segments.map(s=>r6(s.duration)),
  pathSha:crypto.createHash('sha256').update(JSON.stringify(p.segments.map(s=>s.path.map(v=>v.map(r6))))).digest('hex').slice(0,16)}:null;
 const out={};
 for(const region of Object.keys(N)){const keys=N[region].nodes.map(n=>n.key),pts=[];for(const e of N[region].edges)for(let i=0;i<e.path.length;i+=3)pts.push(e.path[i]);
  for(const a of keys)for(const b of keys){let w,s;try{w=ser(W.planWalk(region,a,b));}catch(e){w='ERR '+e.message;}try{s=ser(W.planSkip(region,a,b));}catch(e){s='ERR '+e.message;}out[`${region}:${a}>${b}`]={walk:w,skip:s};}
  const tap=[];for(let i=0;i<pts.length;i+=2)for(let j=0;j<pts.length;j+=5){let t;try{t=ser(W.planTapWalk(region,pts[i],pts[j]));}catch(e){t='ERR '+e.message;}tap.push(t);}
  out[`${region}:tap`]=crypto.createHash('sha256').update(JSON.stringify(tap)).digest('hex').slice(0,16)+' n='+tap.length;}
 return out;}
module.exports={dump};if(require.main===module)process.stdout.write(JSON.stringify(dump(),null,0).replace(/\},"/g,'},\n"')+'\n');
