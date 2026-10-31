'use strict';
// 运镜bot b21: tiered island clearance (Grok Bot final version, 场景设计部 island-props-classes.json). env_island_props_merged is split into its
// connected sub-objects (1 mm weld, same as classify-island-props.cjs) and every sub-object takes its own tier; the merged mesh is never one solid.
// Walk tiers (horizontal distance from her centre, only geometry inside her body band [feet, feet+1.8 m]):
//   lowRock  rock < 0.3 m      whole footprint + 0.15 m (route may not cross)     fence 0.4 m
//   solid07  solids <= 0.7 m   (planters, benches, 0.3-0.7 m rocks) 0.5 m          solid1m  solids > 0.7 m, lighthouse/house, palm trunks (< 0.7 m part) 1 m
//   veg      vegetation, only the part > 0.3 m over its own base, footprint + 0.15 m frond   palm parts above the trunk, 0.5 m
// Camera solids (3D, >= 0.5 m): every non-vegetation tier + vegetation parts > 0.3 m tall (>= 0.3 m tall vegetation counts as solid).
const J=require('./journey-scene.cjs');const CLS=require('../region-nodes/fixtures/island-props-classes.json');
const KEEP={lowRock:0.15,fence:0.4,solid07:0.5,solid1m:1.0,veg:0.15,frond:0.5},BAND=1.8;
const GRADE={'low-rock':'lowRock',fence:'fence','planter-bench':'solid07','rock-0.5':'solid07','solid-1m':'solid1m'};
function split(tris){const id=new Map(),par=[];const find=a=>{while(par[a]!==a)a=par[a]=par[par[a]];return a;};
 const vi=(x,y,z)=>{const k=Math.round(x*1000)+','+Math.round(y*1000)+','+Math.round(z*1000);let v=id.get(k);if(v===undefined){v=par.length;id.set(k,v);par.push(v);}return v;};
 const tv=[];for(let k=0;k<tris.length;k+=9){const a=vi(tris[k],tris[k+1],tris[k+2]),b=vi(tris[k+3],tris[k+4],tris[k+5]),c=vi(tris[k+6],tris[k+7],tris[k+8]);par[find(b)]=find(a);par[find(c)]=find(a);tv.push(a);}
 const C=new Map();tv.forEach((a,t)=>{const r=find(a);if(!C.has(r))C.set(r,[]);C.get(r).push(t);});
 return [...C.values()].map(ts=>{const t=new Float64Array(ts.length*9);ts.forEach((q,i)=>{for(let j=0;j<9;j++)t[i*9+j]=tris[q*9+j];});return {tris:t,bb:J.bbox(t)};});}
// keep only the part of a triangle at y >= y0 (Sutherland-Hodgman on one plane), fan-triangulated
function clipAbove(tri,y0){const out=[];for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],ia=a[1]>=y0,ib=b[1]>=y0;if(ia)out.push(a);if(ia!==ib){const t=(y0-a[1])/(b[1]-a[1]);out.push([a[0]+t*(b[0]-a[0]),y0,a[2]+t*(b[2]-a[2])]);}}
 const f=[];for(let i=1;i+1<out.length;i++)f.push([out[0],out[i],out[i+1]]);return f;}
// floor under (x,z) = topmost walkable floor (场景设计部 bake: env_island_main | wet sand | tide pools | lighthouse_ext), the "grid top floor" of the bake
const FLOOR=J.island.filter(o=>/env_island_main|env_beach_wet_sand|env_beach_tide_pools|env_lighthouse_ext/.test(o.name));
function floorY(x,z,below){let b=null;for(const o of FLOOR){o.bb??=J.bbox(o.tris);if(x<o.bb[0][0]||x>o.bb[1][0]||z<o.bb[0][2]||z>o.bb[1][2])continue;const t=J.rayHit([x,below+0.05,z],[0,-1,0],50,o.tris);if(t!==null&&(b===null||t<b))b=t;}return b===null?null:below+0.05-b;}
// per-0.1 m-cell floor (the bake's per-cell "top floor"), cached
const FG=new Map();function floorGrid(x,z,below){const i=Math.round(x*10),j=Math.round(z*10),k=i+','+j;if(!FG.has(k))FG.set(k,floorY(i/10,j/10,Math.max(below,5)));return FG.get(k);}
let cache=null;
function build(){if(cache)return cache;const items=[];const props=J.island.find(o=>/env_island_props_merged/.test(o.name));
 const comps=split(props.tris),lab=CLS.components;
 for(const c of comps){const cx=(c.bb[0][0]+c.bb[1][0])/2,cz=(c.bb[0][2]+c.bb[1][2])/2;let best=null,bd=1e9;
  for(const l of lab){const d=Math.hypot(l.cx-cx,l.cz-cz)+Math.abs(l.bb[0][1]-c.bb[0][1])+Math.abs(l.bb[1][1]-c.bb[1][1]);if(d<bd){bd=d;best=l;}}
  if(!best||bd>0.02)throw Error('island-clearance-tiers: props sub-object not in island-props-classes.json @'+cx.toFixed(2)+','+cz.toFixed(2));
  const tier=best.cls==='vegetation'?'veg':GRADE[best.grade];if(!tier)throw Error('unknown grade '+best.grade);
  let tris=c.tris;if(tier==='veg'){const keep=[];for(let k=0;k<tris.length;k+=9){const fy=floorGrid((tris[k]+tris[k+3]+tris[k+6])/3,(tris[k+2]+tris[k+5]+tris[k+8])/3,c.bb[1][1]),y0=(fy??c.bb[0][1])+0.3;for(const f of clipAbove([[tris[k],tris[k+1],tris[k+2]],[tris[k+3],tris[k+4],tris[k+5]],[tris[k+6],tris[k+7],tris[k+8]]],y0))keep.push(...f[0],...f[1],...f[2]);}if(!keep.length)continue;tris=Float64Array.from(keep);}
  items.push({tier,name:best.asset+'#'+best.id,tris,bb:J.bbox(tris),footprintOnly:tier==='lowRock'});}
 for(const o of J.island){const n=o.name;if(/palm/.test(n)){const bb=J.bbox(o.tris),y7=bb[0][1]+0.7,tr=[],fr=[];
   for(let k=0;k<o.tris.length;k+=9){const lo=Math.min(o.tris[k+1],o.tris[k+4],o.tris[k+7]);for(let j=0;j<9;j++)(lo<y7?tr:fr).push(o.tris[k+j]);}
   if(tr.length){const t=Float64Array.from(tr);items.push({tier:'solid1m',name:n+':trunk',tris:t,bb:J.bbox(t)});}
   if(fr.length){const t=Float64Array.from(fr);items.push({tier:'frond',name:n+':frond',tris:t,bb:J.bbox(t)});}}
  else if(/lighthouse_ext|lighthouse_door|rear_window_detail/.test(n))items.push({tier:'solid1m',name:n,tris:o.tris,bb:J.bbox(o.tris)});}
 return cache=items;}
// 2D (x,z) distance from p to triangle projection
function d2tri(px,pz,ax,az,bx,bz,cx,cz){const s=(x1,z1,x2,z2,x3,z3)=>(x1-x3)*(z2-z3)-(x2-x3)*(z1-z3);const ar=Math.abs(s(ax,az,bx,bz,cx,cz));const d1=s(px,pz,ax,az,bx,bz),d2=s(px,pz,bx,bz,cx,cz),d3=s(px,pz,cx,cz,ax,az);
if(ar>1e-10&&!((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0)))return 0;const seg=(x1,z1,x2,z2)=>{const dx=x2-x1,dz=z2-z1,l=dx*dx+dz*dz;let t=l?((px-x1)*dx+(pz-z1)*dz)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-x1-t*dx,pz-z1-t*dz);};
 return Math.min(seg(ax,az,bx,bz),seg(bx,bz,cx,cz),seg(cx,cz,ax,az));}
// her centre q=[x,y(feet),z] -> {tier:[dist,name]}; low rocks: whole footprint regardless of band
function walkClear(q,items=build(),cap=3){const out={};for(const k in KEEP)out[k]=[cap,null];
 for(const it of items){const r=out[it.tier];if(it.bb[0][0]-q[0]>r[0]||q[0]-it.bb[1][0]>r[0]||it.bb[0][2]-q[2]>r[0]||q[2]-it.bb[1][2]>r[0])continue;
  if(!it.footprintOnly&&(it.bb[1][1]<q[1]||it.bb[0][1]>q[1]+BAND))continue;const t=it.tris;
  for(let k=0;k<t.length;k+=9){if(!it.footprintOnly){const lo=Math.min(t[k+1],t[k+4],t[k+7]),hi=Math.max(t[k+1],t[k+4],t[k+7]);if(hi<q[1]||lo>q[1]+BAND)continue;}
   const d=d2tri(q[0],q[2],t[k],t[k+2],t[k+3],t[k+5],t[k+6],t[k+8]);if(d<r[0]){r[0]=d;r[1]=it.name;}}}return out;}
function cameraSolids(items=build()){return items.map(it=>({tag:it.tier,name:it.name,tris:it.tris,bb:it.bb}));}
module.exports={KEEP,BAND,build,walkClear,cameraSolids,d2tri};
