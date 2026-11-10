const fs=require('fs'),path=require('path'),zlib=require('zlib');
const J=require('../journey-integration/journey-scene.cjs');
const SK=process.env.OLDSK?JSON.parse(zlib.gunzipSync(fs.readFileSync('/workspace/tmp-exp/wt-i4/tools/journey-integration/occlusion/island-palms-skinned.json.gz'))):{objects:{}};
for(const o of J.island){const t=SK.objects[o.name];if(!t)continue;o.tris=Float64Array.from(t);o.bb=undefined;}
const occ=J.island.filter(o=>!/seagull|smoke|beam|glow|glass/.test(o.name));
const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
const ci=J.Cam.islandPoseEntry(),fw=unit(ci.target.map((x,i)=>x-ci.position[i]));
const P0=ci.position.map((x,i)=>x+fw[i]*2.6),BOARD=ci.position.slice();
const H90=[];for(let i=0;i<10;i++)for(let j=0;j<9;j++)H90.push([0.05+i*(1.70/9),-0.2+j*0.05]);
function occl(cam,h,rx){const d=unit([h[0]-cam[0],0,h[2]-cam[2]]),r=[-d[2],0,d[0]];let nh=0,hf=0,lean=0,bd=0;const who={};
 for(const [y,x] of H90){const q=[h[0]+r[0]*x,h[1]+y,h[2]+r[2]*x],b=J.blockers(occ,cam,q);if(b.length)bd++;if(y>=1.4){nh++;if(b.length){hf++;b.forEach(n=>who[n]=(who[n]||0)+1);}if(b.some(n=>/palm_lean_01/.test(n)))lean++;}}
 return {hf:100*hf/nh,lean:100*lean/nh,body:100*bd/90,who};}
// palm verts (skinned) from the gate data
const PV={};for(const n of Object.keys(SK.objects).filter(n=>/palm/.test(n))){const t=SK.objects[n];const v=[];for(let k=0;k<t.length;k+=3)v.push([t[k],t[k+1],t[k+2]]);PV[n]=v;}
for(const o of J.island)if(/beach_palm/.test(o.name)||(!process.env.OLDSK&&/palm/.test(o.name))){const key=/beach_palm/.test(o.name)?o.tag+'#'+o.name:o.name;const v=PV[key]||(PV[key]=[]);for(let k=0;k<o.tris.length;k+=3)v.push([o.tris[k],o.tris[k+1],o.tris[k+2]]);}
const TRUNK={};for(const [n,v] of Object.entries(PV)){const low=v.filter(p=>p[1]<0.7);TRUNK[n]=low;}
function gap(g,top=1.75){let b=99,who=null;for(const [n,v] of Object.entries(PV))for(const p of v)if(Math.hypot(p[0]-g[0],p[2]-g[2])<0.3&&p[1]>g[1]+1.2){const d=p[1]-(g[1]+top);if(d<b){b=d;who=n;}}return [b,who];}
const segd=(p,a,b)=>{const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-dx*t,p[2]-a[2]-dz*t);};
function trunkClear(pth){const r={};for(const [n,low] of Object.entries(TRUNK)){let m=99;for(const p of low)for(let i=1;i<pth.length;i++)m=Math.min(m,segd(p,pth[i-1],pth[i]));r[n]=+m.toFixed(3);}return r;}
const plen=p=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(...p[i].map((x,k)=>x-p[i-1][k]));return L;};
function along(p,s){let acc=0;for(let i=1;i<p.length;i++){const l=Math.hypot(...p[i].map((x,k)=>x-p[i-1][k]));if(acc+l>=s){const t=(s-acc)/l;return p[i-1].map((x,k)=>x+(p[i][k]-x)*t);}acc+=l;}return p[p.length-1];}
function walkSeries(p,fn){const L=plen(p),o=[];for(let k=0;k*0.12<=L+1e-9;k++)o.push([+(k/10).toFixed(1),fn(along(p,k*0.12))]);return o;}
function leanEp(p){const s=walkSeries(p,h=>occl(P0,h));const ep=[];let cur=null;for(const [t,o] of s){if(o.lean>0){if(!cur)cur={from:t,to:t,peak:0};cur.to=t;cur.peak=Math.max(cur.peak,Math.round(o.lean));}else if(cur){ep.push(cur);cur=null;}}if(cur)ep.push(cur);return {ep,series:s.map(([t,o])=>[t,Math.round(o.hf),Math.round(o.lean),Math.round(o.body)])};}
function headroom(p,m=1.2){const o=[];for(let s=0;s<=Math.min(m,plen(p))+1e-9;s+=0.1){const g=along(p,s);const up=J.blockers(occ,[g[0],g[1]+1.75,g[2]],[g[0],g[1]+1.75+1.5,g[2]]);o.push([+s.toFixed(1),up]);}return o;}
module.exports={J,SK,occ,P0,BOARD,ci,occl,gap,trunkClear,plen,along,leanEp,headroom,PV};
