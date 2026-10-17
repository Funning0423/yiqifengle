const J=require('/tmp/wt-jw/tools/journey-integration/journey-scene.cjs'),{H,S,routeLength,journeyCamera,start}=J;
const LK=H.load(S+'region/LakesideCameraLayout.ts');const j=LK.lakesideJourney(start),path=[...j.approach,...j.bridge.slice(1),...j.arrival],T=routeLength(path);
const leg=J.legs[0];const startCam=leg.start;
const out=[];for(let t=-4;t<=0;t+=1/60){const d=Math.max(0,T+t*j.speed);out.push({t,...journeyCamera(path,d,startCam,j.focus,undefined,0,j.landing)});}
const frame={width:390,height:844,boardTop:300};const b=LK.lakesideAlignedLookAt(frame);
const toW=p=>j.toWorld(p);const board={position:toW(b.position),target:toW(b.target),fovVerticalDeg:b.fovVerticalDeg};
for(let t=1/60;t<=1.5;t+=1/60)out.push({t,...board});
console.log(JSON.stringify({speed:j.speed,T,out}));
