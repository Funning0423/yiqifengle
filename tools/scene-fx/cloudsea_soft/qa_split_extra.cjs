// audit-only: subdivide extra tris to <=4 m edges (same surface), drop tris entirely beyond 470 m of the island centre (rays are 400 m)
const fs=require('fs');const src=JSON.parse(fs.readFileSync(process.argv[2])).skycity.env_sky_cloudsea_soft,SEA=+process.argv[4],cumIgnored=process.argv[5]==='ignore';
const O=[-3,12],out={sea:[],cum:[]};
function sub(t,acc){const L=[0,1,2].map(i=>Math.hypot(...[0,1,2].map(k=>t[i][k]-t[(i+1)%3][k])));const m=Math.max(...L);if(m<=4){acc.push(t);return;}
 const i=L.indexOf(m),a=t[i],b=t[(i+1)%3],c=t[(i+2)%3],mid=a.map((v,k)=>(v+b[k])/2);sub([a,mid,c],acc);sub([mid,b,c],acc);}
src.forEach((t,i)=>{if(t.every(p=>Math.hypot(p[0]-O[0],p[2]-O[1])>470))return;sub(t,i<SEA?out.sea:out.cum);});
const r={skycity:{env_sky_cloudsea_soft:out.sea}};r.skycity[cumIgnored?'env_sky_cumulus_soft':'env_sky_cloudsea_soft_cumulus']=out.cum;
fs.writeFileSync(process.argv[3],JSON.stringify(r));console.log(out.sea.length,out.cum.length);
