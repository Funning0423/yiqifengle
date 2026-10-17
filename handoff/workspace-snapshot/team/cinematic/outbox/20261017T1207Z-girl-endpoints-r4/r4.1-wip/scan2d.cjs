const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');const {evalAt,SCR}=require('./feas.cjs');
const {Lay,L,routeLength,sampleRoute,journeyCamera}=J;const leg2=J.legs[1];const rest=leg2.path.slice(J.appr2.length);const ex=J.exit02to08;
const spawnB=J.meadowSrc.map.toBoard(J.mA('player_spawn'));
const facing=(path,d)=>{const a=sampleRoute(path,d),b=sampleRoute(path,d+.08);let x=b[0]-a[0],z=b[2]-a[2];if(Math.hypot(x,z)<1e-4){const c=sampleRoute(path,Math.max(0,d-.08));x=a[0]-c[0];z=a[2]-c[2];}const l=Math.hypot(x,z)||1;return [x/l,z/l];};
function f7(pB){const s=J.meadowSrc.map.toJourney(pB),l1=[...J.appr1,...J.bridge1.slice(1),s];const appr=[s,...Lay.meadowExitFrom(s,ex)],path=[...appr,...rest],T=routeLength(path),start=J.readPose(journeyCamera(l1,routeLength(l1),J.legs[0].start,undefined,undefined,0)),lens=Lay.lensKeys(L.skyLens,routeLength(appr));
 let worst=-999;for(let x=0;x<T-10;x+=.2){const c=journeyCamera(path,x,start,leg2.focus,lens,0),q=sampleRoute(path,x),[hx,hz]=facing(path,x),vx=c.position[0]-q[0],vz=c.position[2]-q[2],back=-(vx*hx+vz*hz),right=vx*(-hz)+vz*hx,a=Math.atan2(-right,back)*180/Math.PI;if(a>worst)worst=a;}return {worst,extra:(T-42.865)/1.2};}
module.exports={f7};
if(require.main===module){const res=require('./o5grid.json').filter(r=>r.extra<=3&&r.g.slice(0,7).some(g=>g>=13));console.log('cands',res.length);
for(const r of res){const e=f7(r.p);r.f7=e.worst;}require('fs').writeFileSync('scan2d.json',JSON.stringify(res));
for(let k=0;k<7;k++){const c=res.filter(r=>r.g[k]>=13&&r.f7<=0);c.sort((a,b)=>b.g[k]-a.g[k]);console.log(SCR[k].join('x'),'ok',c.length,c.slice(0,3).map(r=>r.p.map(v=>v.toFixed(2)).join(',')+' g'+r.g[k].toFixed(0)+' f7 '+r.f7.toFixed(1)+' O5 '+r.extra.toFixed(2)).join(' | '));}}
