const S=require('/tmp/wt-v4/tools/journey-integration/journey-scene.cjs');
const leg=S.legs.find(l=>l.id==='08-09'),T=S.routeLength(leg.path),out={yaw:S.yaw,sOff:S.sOff,T,poses:{}};
const inv=p=>S.rotY(-S.yaw,S.sub(p,S.sOff));
for(const d of process.argv.slice(2).map(Number)){const c=S.journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens);out.poses[d]={position:inv(c.position),target:inv(c.target),fov:c.fovVerticalDeg,char:inv(S.sampleRoute(leg.path,d))};}
console.log(JSON.stringify(out));
