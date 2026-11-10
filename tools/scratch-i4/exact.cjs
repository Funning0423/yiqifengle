const RN=require('../region-nodes/bake-region-nodes.cjs'),EX=require('../region-nodes/exact-clearance.cjs'),CP=require('../region-nodes/classify-island-props.cjs'),fs=require('fs');
(async()=>{const spec=RN.REGIONS.island;const {grid:g}=await RN.decodeDraco(spec.file,spec);
const CLS=JSON.parse(fs.readFileSync('tools/region-nodes/fixtures/island-props-classes.json')).components,idx=new Map(CLS.map(c=>[c.cx+','+c.cz+','+c.tris,c]));
const items=[];for(const c of CP.components(CP.propsMesh())){const e=idx.get(c.cx+','+c.cz+','+c.tris);if(!e){console.log('UNK',c.cx,c.cz);continue;}for(let k=0;k<c.v.length;k+=9){const v=Array.from(c.v.slice(k,k+9));const MV=(process.env.MOVE||'').split(',').map(Number);if(process.env.MOVE&&e.pl===MV[0])for(let q=0;q<9;q+=3){v[q]+=MV[1];v[q+2]+=MV[2];}const cx=(v[0]+v[3]+v[6])/3,cz=(v[2]+v[5]+v[8])/3,cy=Math.min(v[1],v[4],v[7]);const f=g.floorAt(cx,cz,Math.max(v[1],v[4],v[7]));items.push({v,tag:e.asset+'#'+e.id,cls:e.cls,grade:e.grade,floor:f??cy});}}
const I=EX.index(items);const N=JSON.parse(fs.readFileSync('tools/region-nodes/region-nodes.json')).island;
for(const e of N.edges){const veg=EX.minDist(I,e.path,0.6,(it)=>[it.floor+0.3,it.floor+1.7],it=>it.cls==='vegetation');console.log(e.a+'-'+e.b,'veg',veg.d.toFixed(3),veg.who,veg.at,'top',veg.top);}
})();
