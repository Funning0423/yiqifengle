const RN=require('../region-nodes/bake-region-nodes.cjs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);const P=JSON.parse(process.argv[2]);
for(let i=0;i<P.length-1;i++){const a=[P[i][0],0.1,P[i][1]],b=[P[i+1][0],0.1,P[i+1][1]];const r=RN.bfs(g,a,b);console.log(JSON.stringify(P[i]),'->',JSON.stringify(P[i+1]),r?('len '+r.len.toFixed(2)):'NO PATH');}})();
