// usage: node gate.cjs region-nodes.json  -> per island edge gates
const fs=require('fs');const L=require('./lib.cjs');const {createHarness}=require('../board-ui/harness.cjs');const RW=createHarness().load('region/RegionWalkable.ts');
const RN=require('../region-nodes/bake-region-nodes.cjs');const AV=RN.REGIONS.island.routeAvoid||[];
const old=JSON.parse(fs.readFileSync('/workspace/tmp-exp/dec/walk_old.json')).island;const oldY=(x,z)=>{const ci=Math.floor((z-old.z0)/old.c)*old.W+Math.floor((x-old.x0)/old.c);return old.h[ci];};
const F=JSON.parse(fs.readFileSync('/workspace/tmp-exp/dec/props_clusters.json')).map(f=>({...f,asset:f.label,h:+(f.top-f.yMin).toFixed(3)})).filter(f=>!/rock|bench|fence/.test(f.asset)&&f.h>0.3);
const ALL=[];
const E=JSON.parse(fs.readFileSync(process.argv[2])).island.edges;const out={};
for(const e of E){const k=e.a+'-'+e.b,p=e.path,Lt=L.plen(p);const hits={};let vm={d:99},am={d:99},yd={d:-9},od={d:-9};
 for(let s=0;s<=Lt+1e-9;s+=0.05){const g=L.along(p,s);
  for(const f of F){const d0=Math.hypot(g[0]-f.x,g[2]-f.z)-(f.r+0.15);if(d0<0){const kk=f.asset+'@'+f.x.toFixed(2)+','+f.z.toFixed(2)+' r'+f.r+' h'+f.h;hits[kk]=Math.min(hits[kk]??9,+d0.toFixed(3));}const d=Math.hypot(g[0]-f.x,g[2]-f.z)-(f.r+0.15);if(d<vm.d)vm={d:+d.toFixed(3),who:f.asset+'@'+f.x.toFixed(2)+','+f.z.toFixed(2)+' r'+f.r+' h'+f.h,s:+s.toFixed(2)};}
  for(const [ax,az,ar] of AV){const d=Math.hypot(g[0]-ax,g[2]-az)-ar;if(d<am.d)am={d:+d.toFixed(3),c:[ax,az,ar],s:+s.toFixed(2)};}
  const ty=RW.walkFloorY('island',g[0],g[2]);if(ty!==null&&g[1]-ty>yd.d)yd={d:+(g[1]-ty).toFixed(3),at:[+g[0].toFixed(2),+g[2].toFixed(2)]};
  const oy=oldY(g[0],g[2]);if(oy!==undefined&&ty!==null&&oy-ty>od.d)od={d:+(oy-ty).toFixed(3),at:[+g[0].toFixed(2),+g[2].toFixed(2)],old:oy,terr:ty};}
 const tc=L.trunkClear(p);const tmin=Object.entries(tc).sort((a,b)=>a[1]-b[1])[0];
 out[k]={vegHits:hits,polyM:+Lt.toFixed(3),pinS:+(Lt/1.2).toFixed(3),vegMargin:vm,avoidMargin:am,yOverTerrainMax:yd,oldFloorOverTerrainOnPath:od,trunkMin:tmin};}
console.log(JSON.stringify(out,null,1));
