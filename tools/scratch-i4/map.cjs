const RN=require('../region-nodes/bake-region-nodes.cjs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);const [X,Z,N]=process.argv.slice(2).map(Number);
for(let dz=N;dz>=-N;dz--){let row='';for(let dx=-N;dx<=N;dx++){const x=X+dx*.2,z=Z+dz*.2,ci=g.cell(x,z);const av=(spec.routeAvoid||[]).some(([a,b,r])=>Math.hypot(x-a,z-b)<=r);
 row+=(dx==0&&dz==0)?'@':!g.layers[ci].some((y,li)=>g.ok[ci][li])?'x':av?'o':g.route.has(ci)?'#':'.';}console.log((Z+dz*.2).toFixed(1).padStart(5),row);}
console.log('x from',(X-N*.2).toFixed(1));})();
