const RN=require('../region-nodes/bake-region-nodes.cjs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);const D=g.tall.discs;require('fs').writeFileSync('/workspace/tmp-exp/dec/bake_discs.json',JSON.stringify(D));
console.log(D.length,'discs; r>1:',JSON.stringify(D.filter(d=>d[2]>1)));
for(const n of RN.NODES.island){const h=D.filter(([x,z,r])=>Math.hypot(x-n.at[0],z-n.at[2])<r+spec.solidKeepM);if(h.length)console.log(n.key,'inside',JSON.stringify(h));}})();
