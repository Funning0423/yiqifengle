const L=require('./lib.cjs'),{bake}=require('./eval.cjs'),fs=require('fs');
const pre=JSON.parse(fs.readFileSync('pre.json')).filter(c=>c.d0>=0.5&&c.d0<=1.6);const out=[];
for(const c of pre.slice(0,+process.argv[2]||40)){let E;try{E=bake(c.at,null,null);}catch(e){out.push({at:c.at,err:String(e).slice(0,80)});continue;}
 const lg={};for(const k of ['I3-I4','I4-I5','I4-I6']){const e=E[k];const tc=L.trunkClear(e.path);lg[k]={g:e.lengthM,p:+L.plen(e.path).toFixed(3),tmin:Math.min(...Object.values(tc))};}
 const hd=[...L.headroom(E['I4-I5'].path),...L.headroom(E['I4-I6'].path)].filter(x=>x[1].length).length;
 out.push({at:c.at,d0:c.d0,lg,hd});console.error(JSON.stringify(out[out.length-1]));}
fs.writeFileSync('sweep.json',JSON.stringify(out));
