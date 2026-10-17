const R='/tmp/wtE';const S=require(R+'/tools/journey-integration/journey-scene.cjs'),F=require(R+'/tools/journey-integration/journey-framing-lib.cjs');
const L=S.legs[1],f=S.focus2,P=require('/tmp/vid/LA.json'),p=P.at(-1);
const ring=[];for(const r of [0,2,4,6])for(let a=0;a<(r?8:1);a++)ring.push([f[0]+r*Math.cos(a*Math.PI/4),f[1]+.1,f[2]+r*Math.sin(a*Math.PI/4)]);
const c={position:p.position,target:p.target,fovVerticalDeg:p.fov},b=F.body(c,p.root),pl=F.ndc(c,f);
const ys=P.map(q=>q.position[1]-q.root[1]);
console.log(JSON.stringify({frames:P.length,h:b.height,fromTop:(1-pl[1])/2*100,fromLeft:(pl[0]+1)/2*100,vis:ring.filter(q=>!S.blockers(L.objs,p.position,q).length).length/ring.length,aboveFloor:p.position[1]-f[1],maxAboveHer:Math.max(...ys),hMin:Math.min(...P.map(q=>F.body({position:q.position,target:q.target,fovVerticalDeg:q.fov},q.root).height))}));
