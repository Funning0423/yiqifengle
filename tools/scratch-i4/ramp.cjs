const fs=require('fs');const L=require('./lib.cjs');
(async()=>{const ty=await require('./terr.cjs')();const ext={};for(let z=7.9;z<=9.0;z+=0.05){let a=null,b=null;for(let x=-2.3;x<=-0.6;x+=0.01){const t=ty(x,z,1);if(t!==null){if(a===null)a=x;b=x;}}ext[z.toFixed(2)]=[a,b];}
console.log(JSON.stringify(Object.fromEntries(Object.entries(ext).filter((_,i)=>i%2==0).map(([k,v])=>[k,v.map(x=>x===null?null:+x.toFixed(2))]))));
for(const [tag,f] of [['3a05ca8a',process.argv[2]],['new','tools/region-nodes/region-nodes.json']])for(const e of JSON.parse(fs.readFileSync(f)).island.edges.filter(e=>e.b==='I6')){const Lt=L.plen(e.path);let m={d:9};
 for(let s=0;s<=Lt;s+=0.02){const g=L.along(e.path,s);if(g[2]<8.0||g[2]>8.9)continue;const [a,b]=ext[(Math.round(g[2]/0.05)*0.05).toFixed(2)]||[null,null];if(a===null)continue;const d=Math.min(g[0]-a,b-g[0]);if(d<m.d)m={d:+d.toFixed(3),at:[+g[0].toFixed(2),+g[2].toFixed(2)],ramp:[+a.toFixed(2),+b.toFixed(2)]};}
 console.log(tag,e.a+'-'+e.b,JSON.stringify(m));}})();
