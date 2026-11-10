const RN=require('../region-nodes/bake-region-nodes.cjs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);
for(const n of RN.NODES.island){const [x,,z]=n.at;let blk=[];for(let dx=-0.6;dx<=0.61;dx+=0.2)for(let dz=-0.6;dz<=0.61;dz+=0.2){const ci=g.cell(x+dx,z+dz);blk.push(g.route.has(ci)?'#':(g.layers[ci].some((y,li)=>g.ok[ci][li])?'.':'x'));}
 console.log(n.key,n.at,blk.join('').match(/.{7}/g).join(' '));}})();
