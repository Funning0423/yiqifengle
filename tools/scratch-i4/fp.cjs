// min horizontal distance from each island edge (5 cm samples) to the footprint of tall props (bake's tall map)
const RN=require('../region-nodes/bake-region-nodes.cjs');const L=require('./lib.cjs');const fs=require('fs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);const pts=[];for(const a of g.tall.values())for(let k=0;k<a.length;k+=2)pts.push([a[k],a[k+1]]);
for(const f of process.argv.slice(2)){console.log(f);for(const e of JSON.parse(fs.readFileSync(f)).island.edges){const Lt=L.plen(e.path);let m={d:99};
 for(let s=0;s<=Lt+1e-9;s+=0.05){const q=L.along(e.path,s);for(const p of pts){const d=Math.hypot(p[0]-q[0],p[1]-q[2]);if(d<m.d)m={d:+d.toFixed(3),at:[+q[0].toFixed(2),+q[2].toFixed(2)],prop:[+p[0].toFixed(2),+p[1].toFixed(2)]};}}
 console.log(' ',e.a+'-'+e.b,JSON.stringify(m));}}})();
