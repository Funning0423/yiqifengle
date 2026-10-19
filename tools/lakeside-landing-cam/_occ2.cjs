const A=require('./audit.cjs');
(async()=>{const G=await A.geometry(),from=A.startCamera(0),kn={...A.KN,...(process.argv[2]?JSON.parse(process.argv[2]):{})};const S=A.newShot(A.landingFor([390,844]),kn);
for(const t of [10.4,10.6,10.8,11,11.2]){const pose=S.camera(t,from),g=S.girl(t),bb=A.balAt(G,S.vehicle(t));
 console.log(t,'cam',A.toLocal(pose.position).map(x=>x.toFixed(2)).join(','),'girl',A.toLocal(g).map(x=>x.toFixed(2)).join(','),'veh',A.toLocal(S.vehicle(t)).map(x=>x.toFixed(2)).join(','),A.los(G,bb,pose.position,[g[0],g[1]+1.55,g[2]]),A.los(G,bb,pose.position,[g[0],g[1]+1.2,g[2]]));}})();
;(async()=>{const FL=require('../journey-integration/journey-framing-lib.cjs');const G=await A.geometry(),from=A.startCamera(0);const S=A.newShot(A.landingFor([390,844]),A.KN);
for(let t=10.6;t<11.0;t+=.05){const pose=S.camera(t,from),g=S.girl(t),bb=A.balAt(G,S.vehicle(t));for(const dy of [1.2,1.55]){const to=[g[0],g[1]+dy,g[2]],d=to.map((v,i)=>v-pose.position[i]),L=Math.hypot(...d),u=d.map(x=>x/L);const h=FL.cast(bb,pose.position,u,L-.05);
 if(h){const p=pose.position.map((v,i)=>v+u[i]*h.t),v=S.vehicle(t);console.log(t.toFixed(2),dy,h.obj.name,'rel',[p[0]-v[0],p[1]-v[1],p[2]-v[2]].map(x=>x.toFixed(2)).join(','),'dist to her',(L-h.t).toFixed(2));}}}})();
