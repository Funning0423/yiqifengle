const L=require('./lib.cjs'),{bake}=require('./eval.cjs');
const AV=JSON.parse(process.argv[2]);const C=JSON.parse(process.argv[3]);
for(const at of C){let E;try{E=bake(at,null,AV);}catch(e){console.log(at,'ERR',String(e).slice(0,60));continue;}
 const r={};for(const k of ['I2-I3','I3-I4','I4-I5','I4-I6','I5-I6']){const e=E[k];const tc=L.trunkClear(e.path);r[k]=[e.lengthM,+L.plen(e.path).toFixed(3),+Math.min(...Object.values(tc)).toFixed(2)];}
 const hd=[...L.headroom(E['I4-I5'].path),...L.headroom(E['I4-I6'].path)].filter(x=>x[1].length).length;console.log(JSON.stringify(at),JSON.stringify(r),'hd',hd);}
