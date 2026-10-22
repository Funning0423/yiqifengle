'use strict';
// Ground y under path v4 (lake-local): vertical ray against the placed LK_terrain instance(s) (committed GLB + scene transforms).
const LKS=require('../journey-integration/lakeside/lakeside-scene.cjs'),{samples}=require('./geom.cjs');
const T=LKS.instances().filter(i=>/terrain/i.test(i.glb));
function groundAt(x,z){let best=-1e9;for(const I of T){const t=I.tris;if(x<I.box[0][0]||x>I.box[1][0]||z<I.box[0][2]||z>I.box[1][2])continue;
 for(let k=0;k<t.length;k+=9){const ax=t[k],az=t[k+2],bx=t[k+3],bz=t[k+5],cx=t[k+6],cz=t[k+8];const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;
  const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,l3=1-l1-l2;if(l1<-1e-9||l2<-1e-9||l3<-1e-9)continue;const y=l1*t[k+1]+l2*t[k+4]+l3*t[k+7];if(y<3&&y>best)best=y;}}return best;}
module.exports={groundAt,terrains:T.map(i=>i.name)};
if(require.main===module){console.log('terrain instances',T.map(i=>i.name));const r=samples();
 for(const q of [[8.7525,25.7099],[3.8,24.3],[4.758,24.508],[3.2531,25.0904]])console.log('check',q,groundAt(q[0],q[1]).toFixed(4));
 const prof=[];for(let s=0;s<=r.length+1e-9;s+=.25){let i=1;while(i<r.pts.length-1&&r.pts[i][2]<s)i++;const a=r.pts[i-1],b=r.pts[i],u=b[2]>a[2]?(s-a[2])/(b[2]-a[2]):0;const x=a[0]+(b[0]-a[0])*u,z=a[1]+(b[1]-a[1])*u;prof.push([+s.toFixed(2),+groundAt(x,z).toFixed(4)]);}
 prof.push([+r.length.toFixed(4),+groundAt(r.end[0],r.end[1]).toFixed(4)]);console.log(JSON.stringify(prof));}
