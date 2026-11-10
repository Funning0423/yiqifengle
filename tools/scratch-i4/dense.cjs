const RN=require('../region-nodes/bake-region-nodes.cjs');const fs=require('fs');const L=require('./lib.cjs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);const pts=[];for(const a of g.tall.values())for(let k=0;k<a.length;k+=2)pts.push([a[k],a[k+1]]);
for(const e of JSON.parse(fs.readFileSync('tools/region-nodes/region-nodes.json')).island.edges){const Lt=L.plen(e.path);let n=0,best={d:9};const near=new Set();
 for(let s=0;s<=Lt;s+=0.05){const q=L.along(e.path,s);pts.forEach((p,i)=>{const d=Math.hypot(p[0]-q[0],p[1]-q[2]);if(d<0.6)near.add(i);if(d<best.d)best={d:+d.toFixed(3),s:+s.toFixed(2),t:+(s/1.2).toFixed(2),her:q.map(v=>+v.toFixed(3)),prop:p.map(v=>+v.toFixed(2)),dir:L.along(e.path,Math.min(Lt,s+0.3)).map((v,j)=>v-q[j])};});}
 console.log(e.a+'-'+e.b,'tallSamplesWithin0.6',near.size,JSON.stringify(best));}})();
