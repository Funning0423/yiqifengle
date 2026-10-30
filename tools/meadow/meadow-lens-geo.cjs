'use strict';
/** 运镜bot b20: meadow env_meadow.glb geometry for lens checks: terrain height under a point, distance to solids, segment occlusion. */
const path=require('node:path');
const {load}=require('../journey-integration/occlusion/lib-glb.cjs');
const SOLID=/meadow_fence|meadow_trees|windmill_static|windmill_sails|wind_bell_frame/,GROUND=/^meadow_terrain$|^meadow_river_bank$|^meadow_path$/;
let G=null;
function geo(){if(G)return G;const nodes=load(path.join(__dirname,'../../creator-build-project/assets/bundles/region_meadow/env_meadow.glb')).filter(n=>n.tris);
 const pack=re=>{const out=[];for(const n of nodes)if(re.test(n.name)){const T=n.tris;for(let k=0;k<T.length;k+=9)out.push({name:n.name,v:[T[k],T[k+1],T[k+2],T[k+3],T[k+4],T[k+5],T[k+6],T[k+7],T[k+8]],lo:[Math.min(T[k],T[k+3],T[k+6]),Math.min(T[k+1],T[k+4],T[k+7]),Math.min(T[k+2],T[k+5],T[k+8])],hi:[Math.max(T[k],T[k+3],T[k+6]),Math.max(T[k+1],T[k+4],T[k+7]),Math.max(T[k+2],T[k+5],T[k+8])]});}return out;};
 return G={solid:pack(SOLID),ground:pack(GROUND)};}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function segD(p,a,b){const ab=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(p,a),ab)/(dot(ab,ab)||1)));return Math.hypot(...sub(p,[a[0]+ab[0]*t,a[1]+ab[1]*t,a[2]+ab[2]*t]));}
function triD(p,t){const a=t.v.slice(0,3),b=t.v.slice(3,6),c=t.v.slice(6,9),n=cross(sub(b,a),sub(c,a)),nn=Math.hypot(...n);if(nn>1e-12){const u=n.map(x=>x/nn),d=dot(sub(p,a),u),q=sub(p,u.map(x=>x*d));
 if(dot(cross(sub(b,a),sub(q,a)),n)>=0&&dot(cross(sub(c,b),sub(q,b)),n)>=0&&dot(cross(sub(a,c),sub(q,c)),n)>=0)return Math.abs(d);}return Math.min(segD(p,a,b),segD(p,b,c),segD(p,c,a));}
/** nearest solid (m), searched within `r` (beyond → r). */
function solidClear(p,r=6){let best=r,name=null;for(const t of geo().solid){if(p[0]<t.lo[0]-best||p[0]>t.hi[0]+best||p[1]<t.lo[1]-best||p[1]>t.hi[1]+best||p[2]<t.lo[2]-best||p[2]>t.hi[2]+best)continue;const d=triD(p,t);if(d<best){best=d;name=t.name;}}return {d:best,name};}
function rayTri(o,d,t){const a=t.v.slice(0,3),e1=sub(t.v.slice(3,6),a),e2=sub(t.v.slice(6,9),a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-12)return null;const f=1/det,s=sub(o,a),u=f*dot(s,h);if(u<0||u>1)return null;const q=cross(s,e1),v=f*dot(d,q);if(v<0||u+v>1)return null;const k=f*dot(e2,q);return k>1e-6?k:null;}
/** height of the highest ground surface under (x,z), or -Infinity. */
function groundY(x,z){let y=-Infinity;for(const t of geo().ground){if(x<t.lo[0]||x>t.hi[0]||z<t.lo[2]||z>t.hi[2])continue;const k=rayTri([x,1e4,z],[0,-1,0],t);if(k!==null)y=Math.max(y,1e4-k);}return y;}
/** min height above ground within radius r of p (8 samples + centre). */
function groundClear(p,r=0.5){let m=Infinity;for(let i=-1;i<8;i++){const x=i<0?p[0]:p[0]+r*Math.cos(i*Math.PI/4),z=i<0?p[2]:p[2]+r*Math.sin(i*Math.PI/4),g=groundY(x,z);if(g>-Infinity)m=Math.min(m,p[1]-g);}return m;}
/** first blocker between a and b (solids + ground), ignoring the last `skip` metres at b. */
function blocked(a,b,skip=0.35){const d=sub(b,a),L=Math.hypot(...d),u=d.map(x=>x/L);const g=geo();for(const set of [g.solid,g.ground])for(const t of set){
  const lo=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.min(a[2],b[2])],hi=[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.max(a[2],b[2])];if(t.hi[0]<lo[0]||t.lo[0]>hi[0]||t.hi[1]<lo[1]||t.lo[1]>hi[1]||t.hi[2]<lo[2]||t.lo[2]>hi[2])continue;
  const k=rayTri(a,u,t);if(k!==null&&k<L-skip)return t.name;}return null;}
module.exports={geo,solidClear,groundClear,groundY,blocked};
