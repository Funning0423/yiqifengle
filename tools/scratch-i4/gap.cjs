const RN=require('../region-nodes/bake-region-nodes.cjs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);
for(let x=1.8;x<=3.8;x+=0.1){let row=x.toFixed(1)+' ';for(let z=3.9;z<=4.6;z+=0.025){const y=g.floorDisc(x,z,2);const v=g.tall.near(x,z,.15),s=g.tall.nearSolid(x,y,z,.05),a=(spec.routeAvoid||[]).some(([cx,cz,cr])=>Math.hypot(x-cx,z-cz)<cr);row+=a?'o':v?'v':s?'s':'.';}console.log(row);}console.log('z from 3.9 step .025');})();
