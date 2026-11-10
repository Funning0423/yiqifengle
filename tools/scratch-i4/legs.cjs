const L=require('./lib.cjs'),{clipCheck}=require('./clipchk.cjs'),fs=require('fs');
const N=JSON.parse(fs.readFileSync(__dirname+'/../region-nodes/region-nodes.json')).island;
for(const e of N.edges){const t=L.trunkClear(e.path);const m=Object.entries(t).sort((a,b)=>a[1]-b[1])[0];const c=clipCheck(e.path);console.log(e.a+'-'+e.b,e.lengthM,(e.lengthM/1.2).toFixed(2),m[0],m[1],'clip:'+Object.keys(c).filter(n=>c[n].clip).join(','));}
