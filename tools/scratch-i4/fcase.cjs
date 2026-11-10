const fs=require('fs');const L=require('./lib.cjs');
(async()=>{const ty=await require('./terr.cjs')();const old=JSON.parse(fs.readFileSync('/workspace/tmp-exp/dec/walk_old.json')).island,nw=JSON.parse(fs.readFileSync('/workspace/tmp-exp/dec/walk_new.json')).island;
const cell=(d,x,z)=>Math.floor((z-d.z0)/d.c)*d.W+Math.floor((x-d.x0)/d.c);
for(const [tag,f] of [['old','/workspace/tmp-exp/dec/rn_old.json'],['new','tools/region-nodes/region-nodes.json']]){for(const e of JSON.parse(fs.readFileSync(f)).island.edges){const seen=new Map();const Lt=L.plen(e.path);
 for(let s=0;s<=Lt;s+=0.05){const g=L.along(e.path,s);const k=cell(old,g[0],g[2]);if(seen.has(k))continue;const t=ty(g[0],g[2],(old.h[k]??g[1])+0.6);const ho=old.h[k],hn=nw.h[k];if(t===null||ho===undefined)continue;if(ho-t>0.03&&ho-(hn??-9)>0.005)seen.set(k,{cellXZ:[+(old.x0+(k%old.W+.5)*old.c).toFixed(1),+(old.z0+(((k/old.W)|0)+.5)*old.c).toFixed(1)],oldFloor:ho,newFloor:hn??null,terrain:+t.toFixed(3),pathYhere:+g[1].toFixed(3),s:+s.toFixed(2)});}
 console.log(tag,e.a+'-'+e.b,seen.size?JSON.stringify([...seen.values()]):'none');}}})();
