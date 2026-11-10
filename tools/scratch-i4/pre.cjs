const L=require('./lib.cjs');const out=[];
const gh=(x,z)=>{let b=null,n=null;for(const o of L.J.island){o.bb??=L.J.bbox(o.tris);if(x<o.bb[0][0]||x>o.bb[1][0]||z<o.bb[0][2]||z>o.bb[1][2])continue;const t=L.J.rayHit([x,8,z],[0,-1,0],20,o.tris);if(t!==null&&(b===null||t<b)){b=t;n=o.name;}}return b===null?null:[8-b,n];};
for(let ix=-12;ix<=12;ix++)for(let iz=-8;iz<=18;iz++){const x=+(4.1+ix*0.1).toFixed(2),z=+(2.7+iz*0.1).toFixed(2);const g0=gh(x,z);if(!g0||!/env_island_main/.test(g0[1]))continue;
 const g=[x,g0[0],z];const [gp]=L.gap(g);if(gp<1.5)continue;const a=L.occl(L.P0,g),b=L.occl(L.BOARD,g);if(a.hf>0||b.hf>0)continue;
 out.push({at:g.map(v=>+v.toFixed(3)),gap:+gp.toFixed(2),d0:+Math.hypot(x-4.1,z-2.7).toFixed(2)});}
out.sort((p,q)=>p.d0-q.d0);require('fs').writeFileSync('pre.json',JSON.stringify(out));console.log(out.length,JSON.stringify(out.slice(0,25)));
