const A=require('./audit.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
(async()=>{const G=await A.geometry(),from=A.startCamera(0),S=A.newShot(A.landingFor([390,844]),A.KN);
for(const t of [0,3,6.2]){const pose=S.camera(t,from),g=S.girl(t);console.log(t,'cam',A.toLocal(pose.position).map(x=>x.toFixed(2)).join(','),'girl',A.toLocal(g).map(x=>x.toFixed(2)).join(','),A.los(G,null,pose.position,[g[0],g[1]+1.2,g[2]]),JSON.stringify(A.nearest(G.stat,pose.position)));}
// apron height under the skycity: top-down casts
const o=[];for(const [x,z] of [[2,63],[-3,55.6],[0,50],[-10,50],[0,45],[0,80]]){const p=A.LJ.toWorld([x,40,z]);const hs=[];let q=p.slice(),k=0;while(k++<6){const h=FL.cast(G.stat,q,[0,-1,0],80);if(!h)break;hs.push(h.obj.tag+':'+h.obj.name+'@'+(A.toLocal([q[0],q[1]-h.t,q[2]])[1]).toFixed(2));q=[q[0],q[1]-h.t-.01,q[2]];}o.push([x,z].join(',')+' '+hs.join(' > '));}console.log(o.join('\n'));})();
