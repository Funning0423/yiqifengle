const RN=require('../region-nodes/bake-region-nodes.cjs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);const pts=[];for(const a of g.tall.values())for(let k=0;k<a.length;k+=2)pts.push([+a[k].toFixed(3),+a[k+1].toFixed(3)]);
require('fs').writeFileSync('/workspace/tmp-exp/dec/tall_pts.json',JSON.stringify({pts,avoid:spec.routeAvoid}));console.log(pts.length);})();
