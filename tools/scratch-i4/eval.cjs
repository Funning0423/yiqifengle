const fs=require('fs'),cp=require('child_process'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),BK=ROOT+'/tools/region-nodes/bake-region-nodes.cjs';
function bake(I4,via,avoid){let s=fs.readFileSync(__dirname+'/bake.orig.cjs','utf8');
 s=s.replace(/\{key:'I4',at:\[4\.1,0\.11,2\.7\]/,`{key:'I4',at:[${I4.join(',')}]`);
 if(process.env.I3)s=s.replace(/\{key:'I3',at:\[[^\]]*\]/,"{key:'I3',at:"+process.env.I3);
 if(via||process.env.VIA23)s=s.replace('const EDGE_VIA={}',`const EDGE_VIA={island:{${via?`'I3-I4':${JSON.stringify(via)},`:''}${process.env.VIA23?`'I2-I3':${process.env.VIA23}`:''}}}`);
 if(avoid)s=s.replace('routeAvoid:[[3.05,2.65,1.05]],',`routeAvoid:${JSON.stringify(avoid)},`);
 fs.writeFileSync(BK,s);cp.execSync('node '+BK,{cwd:ROOT,stdio:'pipe'});cp.execSync('git checkout -q tools/region-nodes/fixtures',{cwd:ROOT});
 const d=JSON.parse(fs.readFileSync(ROOT+'/tools/region-nodes/region-nodes.json','utf8')).island;const E={};for(const e of d.edges)E[e.a+'-'+e.b]=e;return E;}
module.exports={bake};
if(require.main===module){const L=require('./lib.cjs');const [I4,via,avoid]=JSON.parse(process.argv[2]);const E=bake(I4,via,avoid);
 const r={I4,via,avoid,legs:{}};for(const k of ['I3-I4','I4-I5','I4-I6','I5-I6','I2-I3']){const e=E[k];r.legs[k]={graph:e.lengthM,poly:+L.plen(e.path).toFixed(3),s:+(L.plen(e.path)/1.2).toFixed(3),trunk:L.trunkClear(e.path)};}
 const p34=E['I3-I4'].path;r.lean=L.leanEp(p34).ep;r.stand={push:L.occl(L.P0,I4),board:L.occl(L.BOARD,I4)};r.gap=L.gap(I4);
 r.head={I4I5:L.headroom(E['I4-I5'].path).filter(x=>x[1].length),I4I6:L.headroom(E['I4-I6'].path).filter(x=>x[1].length),I3I4end:L.headroom([...p34].reverse()).filter(x=>x[1].length)};
 r.p34=p34;console.log(JSON.stringify(r));}
