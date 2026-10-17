const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');const {evalAt,SCR}=require('./feas.cjs');
const leg2=J.legs.find(l=>l.id==='08-09').path;const rest=J.routeLength(leg2)-J.routeLength(J.appr2);const ex=J.exit02to08;
const out=require('./feas_meadow.json');const res=[];
for(const o of out){if(!o.g.slice(0,7).some(g=>g>=13))continue;const j=J.meadowSrc.map.toJourney(o.p),ap=[j,...J.Lay.meadowExitFrom(j,ex)],extra=(J.routeLength(ap)+rest-42.865)/1.2;res.push({p:o.p,g:o.g,extra});}
for(let k=0;k<7;k++){const c=res.filter(r=>r.g[k]>=13);const ok=c.filter(r=>r.extra<=3);ok.sort((a,b)=>b.g[k]-a.g[k]);
 const b=ok[0];console.log(SCR[k].join('x'),'clear13',c.length,'&O5',ok.length,b?('best '+b.p.map(v=>v.toFixed(2))+' gap '+b.g[k].toFixed(1)+' extra '+b.extra.toFixed(2)+' box '+JSON.stringify(Object.values(evalAt(b.p,...SCR[k]).b).map(Math.round))):'',
 'minExtra',c.length?Math.min(...c.map(r=>r.extra)).toFixed(2):'-');}
require('fs').writeFileSync('o5grid.json',JSON.stringify(res));
