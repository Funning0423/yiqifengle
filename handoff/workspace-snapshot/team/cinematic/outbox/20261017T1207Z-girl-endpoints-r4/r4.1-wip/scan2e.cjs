const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');const {f7}=require('./scan2d.cjs');const {evalAt}=require('./feas.cjs');
const out=require('./feas_meadow.json');const ex=J.exit02to08;
for(const [k,scr] of [[0,[390,844]],[2,[360,780]]]){const c=out.filter(o=>o.g[k]>=5).map(o=>{const j=J.meadowSrc.map.toJourney(o.p);const e=J.Lay.meadowExitExtraM(j,ex);return {...o,ex:e};}).filter(o=>o.ex<=0.432);
 const r=c.map(o=>({...o,f:f7(o.p)})).filter(o=>o.f.worst<=0).sort((a,b)=>b.g[k]-a.g[k]);
 console.log(scr.join('x'),'O5&F7b',r.length,r.slice(0,4).map(o=>o.p.map(v=>v.toFixed(2)).join(',')+' g'+o.g[k].toFixed(1)+' f7 '+o.f.worst.toFixed(1)+' O5 '+o.f.extra.toFixed(2)+' box '+Object.values(evalAt(o.p,...scr).b).map(Math.round)).join(' | '));}
