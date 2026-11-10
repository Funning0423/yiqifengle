const L=require('./lib.cjs'),{bake}=require('./eval.cjs');const AV=JSON.parse(process.argv[2]);
const gh=(x,z)=>{let b=null;for(const o of L.J.island){if(!/env_island_main/.test(o.name))continue;o.bb??=L.J.bbox(o.tris);const t=L.J.rayHit([x,8,z],[0,-1,0],20,o.tris);if(t!==null&&(b===null||t<b))b=t;}return b===null?null:+(8-b).toFixed(3);};
function gap(g,r=0.4){let b=99;for(const v of Object.values(L.PV))for(const p of v)if(Math.hypot(p[0]-g[0],p[2]-g[2])<r&&p[1]>g[1]+0.5)b=Math.min(b,p[1]-(g[1]+1.75));return +b.toFixed(2);}
for(const x of [3.5,3.7,3.9,4.1,4.3,4.5])for(const z of [3.7,3.9,4.1,4.3,4.5]){const y=gh(x,z);if(y===null)continue;const g=[x,y,z];const gp=gap(g);if(gp<1.5)continue;
 const a=L.occl(L.P0,g),b=L.occl(L.BOARD,g);if(a.hf>0||b.hf>0){console.log(JSON.stringify(g),'stand-occ',a.hf.toFixed(0),b.hf.toFixed(0));continue;}
 let E;try{E=bake(g,null,AV);}catch(e){console.log(JSON.stringify(g),'ERR');continue;}
 const r={};for(const k of ['I3-I4','I4-I5','I4-I6']){const e=E[k];r[k]=[e.lengthM,+L.plen(e.path).toFixed(2),+Math.max(...e.path.map(p=>p[1])).toFixed(2),+Math.min(...Object.values(L.trunkClear(e.path))).toFixed(2)];}
 let hmin=99;for(const k of ['I4-I5','I4-I6'])for(let s=0;s<=1.2;s+=0.1)hmin=Math.min(hmin,gap(L.along(E[k].path,s)));
 console.log(JSON.stringify(g),'gap',gp,'h1.2',hmin,JSON.stringify(r));}
