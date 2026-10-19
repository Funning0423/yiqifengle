const A=require('./audit.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
(async()=>{const G=await A.geometry(),from=A.startCamera(0),kn={...A.KN,...JSON.parse(process.argv[2])},t=+process.argv[3],W=390,H=844;
const S=A.newShot(A.landingFor([W,H]),kn),p=S.camera(t,from),bb=A.balAt(G,S.vehicle(t));
const f=p.target.map((v,i)=>v-p.position[i]),fl=Math.hypot(...f),fw=f.map(v=>v/fl),r0=[fw[2],0,-fw[0]],rl=Math.hypot(...r0),r=r0.map(v=>-v/rl),up=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]],th=Math.tan(p.fovVerticalDeg*Math.PI/360),asp=W/H;
const cnt={};for(let py=0;py<=60;py+=4)for(let px=0;px<W;px+=6){const x=((px+.5)/W*2-1)*th*asp,y=(1-(py+.5)/H*2)*th,d=[0,1,2].map(c=>fw[c]+r[c]*x+up[c]*y),l=Math.hypot(...d),u=d.map(v=>v/l);
 const a=FL.cast(G.stat,p.position,u,800),b=FL.cast(bb,p.position,u,800),h=[a,b].filter(Boolean).sort((q,w)=>q.t-w.t)[0];const k=h?h.obj.tag+':'+h.obj.name:'(none)';
 (cnt[k]=cnt[k]||{n:0,px:[],d:[]}).n++;if(cnt[k].px.length<3)cnt[k].px.push(px+','+py);if(h&&cnt[k].d.length<2){const q=A.toLocal(p.position.map((v,i)=>v+u[i]*h.t));cnt[k].d.push(h.t.toFixed(1)+'m@'+q.map(v=>v.toFixed(1)).join(','));}}
console.log('cam',A.toLocal(p.position).map(v=>v.toFixed(2)).join(','));for(const [k,v] of Object.entries(cnt).sort((a,b)=>b[1].n-a[1].n))console.log(k,v.n,v.px.join(' '),v.d.join(' '));})();
;(async()=>{if(!process.env.MAP)return;const G=await A.geometry(),from=A.startCamera(0),kn={...A.KN,...JSON.parse(process.argv[2])},t=+process.argv[3],W=390,H=844;
const S=A.newShot(A.landingFor([W,H]),kn),p=S.camera(t,from),bb=A.balAt(G,S.vehicle(t));
const f=p.target.map((v,i)=>v-p.position[i]),fl=Math.hypot(...f),fw=f.map(v=>v/fl),r0=[fw[2],0,-fw[0]],rl=Math.hypot(...r0),r=r0.map(v=>-v/rl),up=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]],th=Math.tan(p.fovVerticalDeg*Math.PI/360),asp=W/H;
const key={};let next=65;const rows=[];for(let py=0;py<=120;py+=8){let row='';for(let px=0;px<W;px+=10){const x=((px+.5)/W*2-1)*th*asp,y=(1-(py+.5)/H*2)*th,d=[0,1,2].map(c=>fw[c]+r[c]*x+up[c]*y),l=Math.hypot(...d),u=d.map(v=>v/l);
 const a=FL.cast(G.stat,p.position,u,800),b=FL.cast(bb,p.position,u,800),h=[a,b].filter(Boolean).sort((q,w)=>q.t-w.t)[0];const k=h?h.obj.tag+':'+h.obj.name:'.';if(k==='.'){row+='.';continue;}if(!key[k])key[k]=String.fromCharCode(next++);row+=key[k];}rows.push(String(py).padStart(3)+' '+row);}
console.log(rows.join('\n'));console.log(JSON.stringify(key));})();
