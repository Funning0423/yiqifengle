const L=require('./lib.cjs'),{bake}=require('./eval.cjs');const AV=JSON.parse(process.argv[2]);
for(const at of JSON.parse(process.argv[3])){let E;try{E=bake(at,null,AV);}catch(e){console.log(at,'ERR');continue;}
 const ys=k=>E[k].path.map(p=>p[1]);const r={};for(const k of ['I3-I4','I4-I5','I4-I6']){const e=E[k];r[k]=[e.lengthM,+L.plen(e.path).toFixed(2),Math.max(...ys(k)).toFixed(3),+Math.min(...Object.values(L.trunkClear(e.path))).toFixed(2)];}
 console.log(JSON.stringify(at),JSON.stringify(r),'p34',JSON.stringify(E['I3-I4'].path));}
