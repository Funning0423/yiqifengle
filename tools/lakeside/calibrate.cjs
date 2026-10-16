'use strict';
// Lakeside moves calibration: bounded greedy policy (1-ply, score = goals left) replayed on seeds 1..N in authoring mode.
// Gives a witness length per seed (an UPPER bound on what a careful player needs), not human difficulty.
const path=require('node:path'),fs=require('node:fs');
const R=path.resolve(__dirname,'../../creator-build-project/assets/scripts/regional-r05/runtime');
const Session=require(R+'/regional-session.js'),levels=require(R+'/lakeside-levels-data.js');
const N=+(process.argv[2]||24),CAP=60;
const left=s=>{const g=s.engine.goals;return Object.keys(g).reduce((a,k)=>a+Math.max(0,g[k])*(k==='chimes'?40:1),0)+s.pieces.reduce((a,p)=>a+(p.done?0:(p.hits-p.progress)*8),0);};
function actions(s){const out=[];for(let i=0;i<49;i++){if(i%7<6)out.push(['swap',i,i+1]);if(i<42)out.push(['swap',i,i+7]);out.push(['activate',i]);}return out.filter(a=>s._valid(a));}
function play(stage,seed){const st=JSON.parse(JSON.stringify(stage));st.config.moves=CAP;const s=new Session(st,seed,{authoring:true});const acts=[];
 while(s.engine.status==='playing'&&acts.length<CAP){let best=null,bv=Infinity;for(const a of actions(s)){const f=s.fork();if(!f._act(a))continue;const v=f.engine.status==='won'?-1:left(f);if(v<bv){bv=v;best=a;}}if(!best)break;s.act(best);acts.push(best);}
 return {won:s.engine.status==='won',used:acts.length,actions:acts};}
const report=[];
for(const L of levels){const runs=[];for(let seed=1;seed<=N;seed++){const r=play(L,seed);runs.push({seed,won:r.won,used:r.used,actions:r.actions});}
 const wins=runs.filter(r=>r.won).sort((a,b)=>a.used-b.used),u=wins.map(r=>r.used).sort((a,b)=>a-b);
 const med=u.length?u[Math.floor(u.length/2)]:null,p80=u.length?u[Math.min(u.length-1,Math.floor(u.length*.8))]:null;
 const fit=wins.filter(r=>r.used<=L.config.moves);
 report.push({id:L.id,draftMoves:L.config.moves,seedsTried:N,greedyWins:wins.length,greedyUsedMedian:med,greedyUsedP80:p80,winsWithinDraft:fit.length,seedBank:fit.slice(0,3).map(r=>r.seed),witness:fit.slice(0,3).map(r=>({seed:r.seed,used:r.used,actions:r.actions}))});
 console.error(L.id,'draft',L.config.moves,'wins',wins.length+'/'+N,'median',med,'p80',p80,'withinDraft',fit.length);}
fs.writeFileSync(process.argv[3]||'/dev/stdout',JSON.stringify(report,null,1)+'\n');
