const F=require('./sky_full.cjs');const T=[];for(const n of F)for(let i=0;i<n.tris.length;i+=9){const t=n.tris.slice(i,i+9);T.push({n:n.name,t,bb:[Math.min(t[0],t[3],t[6]),Math.max(t[0],t[3],t[6]),Math.min(t[2],t[5],t[8]),Math.max(t[2],t[5],t[8])]});}
function topY(x,z){let best=-1e9,nm='';for(const {n,t,bb} of T){if(x<bb[0]||x>bb[1]||z<bb[2]||z>bb[3])continue;const [ax,ay,az,bx,by,bz,cx,cy,cz]=t;const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,l3=1-l1-l2;if(l1<0||l2<0||l3<0)continue;const y=l1*ay+l2*by+l3*cy;if(y>best&&y<3){best=y;nm=n;}}return [best,nm];}

// tall things on the lawn x 2..12 z 34..48 (posts, railings): tris with y>0.3

module.exports={topY};
