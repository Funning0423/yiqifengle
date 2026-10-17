const S=require('/tmp/wt-gg/tools/journey-integration/journey-scene.cjs');const inv=p=>S.rotY(-S.yaw,S.sub(p,S.sOff));
const A=JSON.parse(require('fs').readFileSync('/tmp/vid/LA.json'));const Z=JSON.parse(require('fs').readFileSync('/tmp/vid/L0.json'));
const conv=x=>({d:x.d,position:inv(x.position),target:inv(x.target),fov:x.fov,char:inv(x.root)});
console.log(JSON.stringify({yaw:S.yaw,sOff:S.sOff,focus:inv(S.focus2),A:A.map(conv),cur:Z.map(conv)}));
const L=S.legs[1],T=S.routeLength(L.path),R=[];for(let d=0;d<=T;d+=0.25)R.push(inv(S.sampleRoute(L.path,d)));require('fs').writeFileSync('/tmp/rc/route.json',JSON.stringify(R));
