const RN=require('../region-nodes/bake-region-nodes.cjs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);const out=[];
for(let x=-2.8;x<=-1.9;x+=0.05)for(let z=1.0;z<=2.2;z+=0.05){const ci=g.cell(x,z);if(g.route.has(ci))continue;if(!g.layers[ci].some((y,li)=>g.ok[ci][li]))continue;
 const y0=g.floorDisc(x,z,2);if(y0===null)continue;let lo=9,hi=-9;for(const r of [0.1,0.2,0.3])for(let k=0;k<16;k++){const y=g.floorAt(x+r*Math.cos(k*Math.PI/8),z+r*Math.sin(k*Math.PI/8),y0+0.5);if(y===null){lo=-9;continue;}lo=Math.min(lo,y);hi=Math.max(hi,y);}
 out.push({x:+x.toFixed(2),z:+z.toFixed(2),y:+y0.toFixed(3),spread:+(hi-lo).toFixed(3),d:+Math.hypot(x+2.3,z-1.5).toFixed(2)});}
out.sort((a,b)=>a.spread-b.spread||a.d-b.d);console.log(out.slice(0,15).map(o=>JSON.stringify(o)).join('\n'));console.log('n',out.length,'near',JSON.stringify(out.filter(o=>o.d<0.15)));})();
