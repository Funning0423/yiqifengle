const L=require('./lib.cjs'),fs=require('fs');
const N=JSON.parse(fs.readFileSync(__dirname+'/../region-nodes/region-nodes.json')).island,E={};for(const e of N.edges)E[e.a+'-'+e.b]=e;
const at=k=>N.nodes.find(n=>n.key===k).at;const {clipCheck}=require('./clipchk.cjs');
const r={palms:{},legs:{}};
for(const [n,v] of Object.entries(L.PV)){const low=v.filter(p=>p[1]<0.7);r.palms[n]={n:v.length,trunkFootXZ:[+(low.reduce((a,p)=>a+p[0],0)/low.length).toFixed(3),+(low.reduce((a,p)=>a+p[2],0)/low.length).toFixed(3)]};}
for(const k of ['I2-I3','I3-I4','I4-I5','I4-I6']){const e=E[k];const c=clipCheck(e.path);r.legs[k]={len:e.lengthM,s:+(e.lengthM/1.2).toFixed(3),path:e.path,trunk:L.trunkClear(e.path),clips:Object.fromEntries(Object.entries(c).filter(([n,x])=>x.minHorizM<1.2))};}
const I4=at('I4');r.I4=I4;r.stand={push:L.occl(L.P0,I4),board:L.occl(L.BOARD,I4)};r.gap=L.gap(I4);
r.head={I4I5:L.headroom(E['I4-I5'].path).filter(x=>x[1].length),I4I6:L.headroom(E['I4-I6'].path).filter(x=>x[1].length)};
r.lean34=L.leanEp(E['I3-I4'].path);r.avoid=N.routeAvoid||null;
console.log(JSON.stringify(r,null,1));
