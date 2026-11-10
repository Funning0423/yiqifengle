const L=require('./lib.cjs');
function clipCheck(path,step=0.05){const Ltot=L.plen(path);const res={};
 for(const [n,v] of Object.entries(L.PV)){let best={d:99};
  for(let s=0;s<=Ltot+1e-9;s+=step){const g=L.along(path,s);for(const p of v){const dy=p[1]-g[1];if(dy<-0.1||dy>1.9)continue;const d=Math.hypot(p[0]-g[0],p[2]-g[2]);if(d<best.d)best={d,dy:+dy.toFixed(2),s:+s.toFixed(2),at:g.map(x=>+x.toFixed(2)),v:p};}}
  const clip=best.d<0.22||(best.d<0.42&&best.dy>=0.6&&best.dy<=1.5);res[n]={minHorizM:+best.d.toFixed(3),vertexHeightAboveFeet:best.dy,alongM:best.s,her:best.at,clip};}
 return res;}
module.exports={clipCheck};
if(require.main===module){const E=JSON.parse(require('fs').readFileSync(process.argv[2])).island.edges;for(const k of process.argv.slice(3)){const e=E.find(x=>x.a+'-'+x.b===k);const r=clipCheck(e.path);console.log(k,JSON.stringify(Object.fromEntries(Object.entries(r).filter(([n])=>!/rear_window/.test(n)))));}}
