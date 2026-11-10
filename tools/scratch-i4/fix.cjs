const L=require('./lib.cjs'),{bake}=require('./eval.cjs'),{clipCheck}=require('./clipchk.cjs');
const [I4,via,av]=JSON.parse(process.argv[2]);const E=bake(I4,via,av);
for(const k of ['I2-I3','I3-I4','I4-I5','I4-I6','I5-I6']){const e=E[k],c=clipCheck(e.path);console.log(k,e.lengthM,L.plen(e.path).toFixed(3),'trunkmin',JSON.stringify(L.trunkClear(e.path)),'clip:',Object.entries(c).filter(([n,v])=>v.clip).map(([n,v])=>n+'@'+v.minHorizM+'/'+v.vertexHeightAboveFeet).join()||'none');}
console.log('I2-I3 path',JSON.stringify(E['I2-I3'].path));console.log('I4-I5 path',JSON.stringify(E['I4-I5'].path));
