const RN=require('../region-nodes/bake-region-nodes.cjs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);for(const [x,z] of JSON.parse(process.argv[2])){const y0=g.floorDisc(x,z,2);let lo=9,hi=-9,mx=0;
for(const r of [0.1,0.2,0.3])for(let k=0;k<16;k++){const y=g.floorAt(x+r*Math.cos(k*Math.PI/8),z+r*Math.sin(k*Math.PI/8),y0+0.5);lo=Math.min(lo,y);hi=Math.max(hi,y);mx=Math.max(mx,Math.abs(y-y0)/r);}
console.log(x,z,'y',y0.toFixed(3),'spread0.3',(hi-lo).toFixed(3),'max slope',(Math.atan(mx)*180/Math.PI).toFixed(1)+'deg');}})();
