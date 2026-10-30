'use strict';
// 海岸支线 calibration (场景设计部 2026-10-29). Relative curve only, not human difficulty.
//  greedy : 1-ply greedy (score = goals left) per seed 1..S with a 80-move cap -> witness length (upper bound of what a careful player needs)
//  random / eps0.5 : win rate over N runs on seedBank[0] at the stage's moves (same policies as tools/lakeside/difficulty_curve.cjs)
// Usage: node tools/coast/calibrate.cjs [data.js|json] [N] [S]   env ONLY=<id>  MOVES=<n> (override moves)
const path=require('path'),R=path.resolve(__dirname,'../../creator-build-project/assets/scripts/regional-r05/runtime');
const Session=require(R+'/regional-session.js');
let levels=require(path.resolve(process.argv[2]||R+'/coast-levels-data.js'));
const N=+(process.argv[3]||200),S=+(process.argv[4]||24),CAP=80;
function prng(s){return ()=>{s=(Math.imul(s,1103515245)+12345)>>>0;return s/4294967296;};}
const left=s=>{const g=s.engine.goals;return Object.keys(g).reduce((a,k)=>a+Math.max(0,g[k])*(k==='beacons'?6:1),0);};
function run(L,seed,policy,ps,moves){const st=JSON.parse(JSON.stringify(L));st.config.moves=moves;const s=new Session(st,seed,{authoring:true});const rnd=prng(ps);const acts=[];
 while(s.engine.status==='playing'&&acts.length<moves){const all=s.legalActions({tools:false});if(!all.length)break;let a;
  if(policy==='random')a=all[Math.floor(rnd()*all.length)];
  else{let bv=Infinity,best=[];for(const x of all){const f=s.fork();if(!f._act(x))continue;const v=f.engine.status==='won'?-1:left(f);if(v<bv){bv=v;best=[x];}else if(v===bv)best.push(x);}
   if(!best.length)break;a=policy==='greedy'?best[0]:(rnd()<.5?all[Math.floor(rnd()*all.length)]:best[Math.floor(rnd()*best.length)]);}
  s.act(a);acts.push(a);}
 return {won:s.engine.status==='won',used:acts.length,actions:acts,remaining:s.engine.moves};}
const out={};
for(const L of levels){if(process.env.ONLY&&L.id!==process.env.ONLY)continue;const moves=+(process.env.MOVES||L.config.moves);
 const g=[];for(let seed=1;seed<=S;seed++){const r=run(L,seed,'greedy',1,CAP);g.push({seed,won:r.won,used:r.used});}
 const u=g.filter(x=>x.won).map(x=>x.used).sort((a,b)=>a-b),med=u.length?u[u.length>>1]:null,p80=u.length?u[Math.min(u.length-1,Math.floor(u.length*.8))]:null;
 const fit=g.filter(x=>x.won&&x.used<=moves).sort((a,b)=>a.used-b.used);
 const seed=(L.seedBank&&L.seedBank.length?L.seedBank[0]:(fit[0]||{}).seed)||1;const r={moves,band:L.intendedBand,greedyWins:u.length+'/'+S,greedyMedian:med,greedyP80:p80,greedyWithin:fit.length+'/'+S,seed0:seed,seedCandidates:fit.slice(0,3).map(x=>x.seed+':'+x.used)};
 for(const pol of ['random','eps0.5']){let w=0,rem=0;for(let i=1;i<=N;i++){const x=run(L,seed,pol,i*7919,moves);if(x.won){w++;rem+=x.remaining;}}r[pol]=+(w/N).toFixed(3);r[pol+'_avgLeft']=w?+(rem/w).toFixed(1):null;}
 out[L.id]=r;console.error(L.id,JSON.stringify(r));}
console.log(JSON.stringify(out,null,1));
