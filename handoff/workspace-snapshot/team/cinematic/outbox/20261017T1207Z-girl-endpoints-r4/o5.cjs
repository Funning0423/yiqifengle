const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');const {evalAt,SCR}=require('./feas.cjs');
const leg2=J.legs.find(l=>l.id==='08-09').path;const base=J.routeLength(leg2);const a2=J.appr2;const rest=J.routeLength(leg2)-J.routeLength(a2);
const ex=J.exit02to08;const len=p=>{let s=0;for(let i=1;i<p.length;i++)s+=Math.hypot(p[i][0]-p[i-1][0],p[i][2]-p[i-1][2],p[i][1]-p[i-1][1]);return s;};
console.log('current leg2',base.toFixed(2),'appr2',J.routeLength(a2).toFixed(2),'rest',rest.toFixed(2));
const line=require('./stand_v2.json');const pts=[[0,1.21,20],...line];const dense=[];for(let k=1;k<pts.length;k++){const a=pts[k-1],b=pts[k],n=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.1);for(let s=1;s<=n;s++)dense.push(a.map((v,i)=>v+(b[i]-v)*s/n));}
for(let i=0;i<dense.length;i+=3){const m=dense[i],j=J.meadowSrc.map.toJourney(m),ap=[j,...J.Lay.meadowExitFrom(j,ex)],T=J.routeLength(ap)+rest,extra=(T-42.865)/1.2;
 console.log(m.map(v=>v.toFixed(2)).join(','),'extra',extra.toFixed(2),'gaps',SCR.slice(0,7).map(([w,h])=>{const e=evalAt(m,w,h);return e?e.gap.toFixed(0):'x'}).join(' '));}
