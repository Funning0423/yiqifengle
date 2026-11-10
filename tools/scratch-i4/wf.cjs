const L=require('./lib.cjs');const RW=L.J.H.load(L.J.S+'region/RegionWalkable.ts');
for(const [x,z] of JSON.parse(process.argv[2]))console.log(x,z,RW.walkFloorY('island',x,z));
const hs=(x,z)=>{const o=[];for(const ob of L.J.island){ob.bb??=L.J.bbox(ob.tris);if(x<ob.bb[0][0]-.3||x>ob.bb[1][0]+.3||z<ob.bb[0][2]-.3||z>ob.bb[1][2]+.3)continue;o.push(ob.name);}return o;};console.log(hs(4.6,3.8));
