const path=require('path');// Lakeside difficulty curve (场景设计部 r7): win rate on each stage's seedBank[0] for random / eps-greedy play (N runs), plus 1-ply greedy.
// Not human difficulty; relative curve only.  N=200 node tools/lakeside/difficulty_curve.cjs  (OVERRIDE='{"id":..,"config":{..},"rules":{..}}' to try a variant)
const WT=process.env.WT||path.resolve(__dirname,'../..'),R=path.resolve(WT,'creator-build-project/assets/scripts/regional-r05/runtime');
const Session=require(R+'/regional-session.js');let levels=require(R+'/lakeside-levels-data.js');
if(process.env.OVERRIDE){const o=JSON.parse(process.env.OVERRIDE);levels=levels.map(l=>l.id===o.id?Object.assign(JSON.parse(JSON.stringify(l)),{config:Object.assign({},l.config,o.config||{}),rules:o.rules||l.rules,seedBank:o.seedBank||l.seedBank}):l);}
const N=+(process.env.N||200);
function prng(s){return ()=>{s=(Math.imul(s,1103515245)+12345)>>>0;return s/4294967296;};}
const left=s=>{const g=s.engine.goals;return Object.keys(g).reduce((a,k)=>a+Math.max(0,g[k])*(k==='chimes'?40:1),0)+s.pieces.reduce((a,p)=>a+(p.done?0:(p.hits-p.progress)*8),0);};
function run(L,seed,policy,ps){const s=new Session(JSON.parse(JSON.stringify(L)),seed,{authoring:true});const rnd=prng(ps);let used=0;
 while(s.engine.status==='playing'&&used<200){const acts=s.legalActions({tools:false});if(!acts.length)break;let a;
  if(policy==='random')a=acts[Math.floor(rnd()*acts.length)];
  else{let bv=Infinity,best=[];for(const x of acts){const f=s.fork();if(!f._act(x))continue;const v=f.engine.status==='won'?-1:left(f);if(v<bv){bv=v;best=[x];}else if(v===bv)best.push(x);}
   if(policy==='greedy')a=best[0];else a=rnd()<(+policy.slice(3))?acts[Math.floor(rnd()*acts.length)]:best[Math.floor(rnd()*best.length)];}
  s.act(a);used++;}
 const g=s.engine.goals;return {won:s.engine.status==='won',left:g.chimes};}
const out={};
for(const L of levels){if(process.env.ONLY&&L.id!==process.env.ONLY)continue;const seed=L.seedBank[0];const r={moves:L.config.moves,band:L.intendedBand};
 for(const pol of ['random','eps0.5','eps0.2']){let w=0,miss1=0;for(let i=1;i<=N;i++){const x=run(L,seed,pol,i*7919);if(x.won)w++;else if(x.left===1)miss1++;}r[pol]=+(w/N).toFixed(3);r[pol+'_miss1chime']=+(miss1/N).toFixed(3);}
 const g=run(L,seed,'greedy',1);r.greedySeed0=g.won;out[L.id]=r;console.error(L.id,JSON.stringify(r));}
console.log(JSON.stringify(out));
