const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const {Lay,L,routeLength,sampleRoute,journeyCamera,blockers,clearance}=J;const leg2=J.legs[1];const rest=leg2.path.slice(J.appr2.length);const ex=J.exit02to08;
const facing=(path,d)=>{const a=sampleRoute(path,d),b=sampleRoute(path,d+.08);let x=b[0]-a[0],z=b[2]-a[2];if(Math.hypot(x,z)<1e-4){const c=sampleRoute(path,Math.max(0,d-.08));x=a[0]-c[0];z=a[2]-c[2];}const l=Math.hypot(x,z)||1;return [x/l,z/l];};
const out=[];for(const [w,h] of [[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]]){const l1=J.leg1For(w,h),s=l1.at(-1),appr=[s,...Lay.meadowExitFrom(s,ex)],path=[...appr,...rest],T=routeLength(path);
 const start=J.readPose(journeyCamera(l1,routeLength(l1),J.legs[0].start,undefined,undefined,0)),lens=Lay.lensKeys(L.skyLens,routeLength(appr));
 let worst=-999,wat=0,occ=[],minLens=9,maxTurn=0,prev=null;for(let x=0;x<=T;x+=.05){const c=journeyCamera(path,x,start,leg2.focus,lens,0),q=sampleRoute(path,x);
  if(x<T-10){const [hx,hz]=facing(path,x),vx=c.position[0]-q[0],vz=c.position[2]-q[2],back=-(vx*hx+vz*hz),right=vx*(-hz)+vz*hx,a=Math.atan2(-right,back)*180/Math.PI;if(a>worst){worst=a;wat=x;}}
  if(x<=20){const hit=[.15,.5,.9,1.25,1.6].map(hh=>blockers(leg2.objs,c.position,[q[0],q[1]+hh,q[2]])),face=blockers(leg2.objs,c.position,[q[0],q[1]+1.5,q[2]]),hidden=hit.filter(z=>z.length).length;if(hit[2].length||hit[4].length||face.length||hidden>1)occ.push(+x.toFixed(2));const [cl]=clearance(c.position,leg2.objs);minLens=Math.min(minLens,cl);}}
 out.push({screen:w+'x'+h,O5s:+((T-42.865)/1.2).toFixed(2),F7bWorstDeg:+worst.toFixed(2),at:+wat.toFixed(1),occludedFirst20m:occ.length?occ.slice(0,3).concat(['…',occ.length]):[],minLensFirst20m:+minLens.toFixed(2),leg1M:+routeLength(l1).toFixed(2)});}
console.log(JSON.stringify(out,null,0).replace(/\},\{/g,'},\n{'));require('fs').writeFileSync('perscreen.json',JSON.stringify(out,null,1));
