const RN=require('../region-nodes/bake-region-nodes.cjs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);const [X,Z]=process.argv.slice(2).map(Number);
const B=.5;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const a=g.tall.get((Math.floor(X/B)+i)+','+(Math.floor(Z/B)+j));if(!a)continue;const out=[];for(let k=0;k<a.length;k+=2)if(Math.hypot(a[k]-X,a[k+1]-Z)<0.4)out.push([+a[k].toFixed(2),+a[k+1].toFixed(2)]);if(out.length)console.log(out.length,JSON.stringify(out.slice(0,8)));}
const ci=g.cell(X,Z);console.log('layers',g.layers[ci],'solids',g.solids[ci].slice().sort((a,b)=>a-b).map(v=>+v.toFixed(2)).filter((v,i,A)=>i%5==0).join(' '));})();
