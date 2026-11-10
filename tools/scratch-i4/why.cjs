const RN=require('../region-nodes/bake-region-nodes.cjs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);for(const [x,z] of JSON.parse(process.argv[2])){const ci=g.cell(x,z);const y=Math.max(...g.layers[ci]);
console.log(x,z,'c',g.c,'route',g.route.has(ci),'veg',g.tall.near(x,z,spec.solidKeepM+.05),'solid',g.tall.nearSolid(x,y,z,.05),'avoid',(spec.routeAvoid||[]).filter(([a,b,r])=>Math.hypot(x-a,z-b)<=r));}})();
