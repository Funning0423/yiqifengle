const RN=require('../region-nodes/bake-region-nodes.cjs');
(async()=>{for(const [n,rx] of [['old',/env_island_main|env_beach_|env_lighthouse_ext|env_island_props_merged/],['noProps',/env_island_main|env_beach_|env_lighthouse_ext/],['noShells',/env_island_main|env_beach_wet|env_beach_tide|env_lighthouse_ext|env_island_props_merged/],['new',RN.REGIONS.island.floor]]){
 const spec={...RN.REGIONS.island,floor:rx};const {grid:g}=await RN.decodeDraco(spec.file,spec);let k=0;
 for(let ci=0;ci<g.layers.length;ci++)g.layers[ci].forEach((y,li)=>{if(g.ok[ci][li]&&g.dist.has(g.key(ci,li)))k++;});console.log(n,k);}})();
