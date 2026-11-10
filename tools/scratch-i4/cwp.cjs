const L=require('./lib.cjs'),{clipCheck}=require('./clipchk.cjs');const RW=L.J.H.load(L.J.S+'region/RegionWalkable.ts');
const E0=L.J.H.load(L.J.S+'region/ExploreCameraCore.ts');const lu=E0.followLookUp('island',99);
const W=JSON.parse(process.argv[2]);const pts=W.map(([x,z])=>[x,RW.walkFloorY('island',x,z),z]);
// densify + walkability
const dense=[pts[0]];let unw=[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/0.1);for(let k=1;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[2]+(b[2]-a[2])*k/n,y=RW.walkFloorY('island',x,z);if(y==null||!isFinite(y))unw.push([+x.toFixed(2),+z.toFixed(2)]);dense.push([x,y??a[1],z]);}}
const seg=[];for(let i=1;i<pts.length;i++)seg.push(+Math.hypot(...pts[i].map((v,k)=>v-pts[i-1][k])).toFixed(3));
const c=clipCheck(dense);const p=dense,Lt=L.plen(p);
const fol=[];for(let k=0;k*0.12<=Lt+1e-9;k++){const s=k*0.12,g=L.along(p,s),a=L.along(p,Math.max(0,s-0.3)),b=L.along(p,Math.min(Lt,s+0.3));const yaw=Math.atan2(b[0]-a[0],b[2]-a[2]);const cp=E0.followPose(g,yaw,390,844,lu);const o=L.occl(cp.position,g);if(o.hf>0)fol.push([+(k/10).toFixed(1),Math.round(o.hf),Object.keys(o.who)]);}
const head=[];for(let s=0;s<=Lt;s+=0.1){const g=L.along(p,s);const up=L.J.blockers(L.occ,[g[0],g[1]+1.75,g[2]],[g[0],g[1]+3.25,g[2]]);if(up.length)head.push([+s.toFixed(1),up]);}
const r={waypoints:pts.map(q=>q.map(v=>+(+v).toFixed(3))),segM:seg,maxSeg:Math.max(...seg),len:+Lt.toFixed(3),s:+(Lt/1.2).toFixed(2),unwalkable:unw,trunk:L.trunkClear(p),clips:Object.fromEntries(Object.entries(c).filter(([n,x])=>x.clip)),lean:L.leanEp(p).ep,follow:fol,headroomHits:head.length,head:head.slice(0,5)};
console.log(JSON.stringify(r));
