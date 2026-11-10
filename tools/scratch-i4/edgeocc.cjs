const L=require('./lib.cjs'),fs=require('fs');const E0=L.J.H.load(L.J.S+'region/ExploreCameraCore.ts'),lu=E0.followLookUp('island',99);const RW=L.J.H.load(L.J.S+'region/RegionWalkable.ts');
const N=JSON.parse(fs.readFileSync(__dirname+'/../region-nodes/region-nodes.json')).island;const e=N.edges.find(x=>x.a+'-'+x.b===process.argv[2]);const p=e.path,Lt=L.plen(p);
const fol=[],push=[];for(let k=0;k*0.12<=Lt+1e-9;k++){const s=k*0.12,g=L.along(p,s),a=L.along(p,Math.max(0,s-0.3)),b=L.along(p,Math.min(Lt,s+0.3));const c=E0.followPose(g,Math.atan2(b[0]-a[0],b[2]-a[2]),390,844,lu);const o=L.occl(c.position,g);if(o.hf>0)fol.push([+(k/10).toFixed(1),Math.round(o.hf),Object.keys(o.who).join("|")]);const q=L.occl(L.P0,g);if(q.hf>0)push.push([+(k/10).toFixed(1),Math.round(q.hf)]);}
const head=[];for(let s=0;s<=Lt;s+=0.1){const g=L.along(p,s);if(L.J.blockers(L.occ,[g[0],g[1]+1.75,g[2]],[g[0],g[1]+3.25,g[2]]).length)head.push(+s.toFixed(1));}
let unw=0;for(let s=0;s<=Lt;s+=0.05){const g=L.along(p,s),y=RW.walkFloorY('island',g[0],g[2]);if(y==null||!isFinite(y))unw++;}
console.log(JSON.stringify({edge:process.argv[2],len:e.lengthM,path:e.path,follow:fol,pushin:push,headroom:head,unwalkable:unw}));
