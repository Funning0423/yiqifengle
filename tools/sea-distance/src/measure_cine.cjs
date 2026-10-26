'use strict';
// My impostor mesh under 运镜bot's final dock lens (cine/sail-voyage 4012da49, SailVoyage.sailVoyageCamera, S-b hold), their raster.
// node measure_cine.cjs <cine-worktree> <impostor_tris.json> cx cz scale
const [W,TR,cx,cz,scS]=process.argv.slice(2);const V=require(W+'/tools/sail-voyage/voyage_lib.cjs'),leg=V.leg,L=V.L;
const SV=L.load('region/SailVoyage.ts',s=>s.includes('TransportLeg')?leg:{});
const E=V.eScene({});const k=+scS,C=[+cx,-0.91,+cz];
const T=JSON.parse(require('fs').readFileSync(TR,'utf8'));const mk=mill=>{const a=[];for(const t of T){const isM=!['terrain','tree'].includes(t.tag);if(isM!==mill)continue;for(let i=1;i<t.v.length-1;i++)for(const p of [t.v[0],t.v[i],t.v[i+1]])a.push(C[0]-k*p[0],C[1]+k*p[1],C[2]-k*p[2]);}return {t:Float64Array.from(a),mill};};
E.imp.length=0;E.imp.push(mk(false),mk(true));
const route=leg.sailRoute(),R=route.samples,tl=leg.sailBeats(route.length),sb=tl.beats.find(b=>b.id==='S-b');
const rows={};for(const s of leg.SAIL_SCREENS){let dmin=1,dmax=0,mill=null;for(let t=sb.t0;t<=sb.t1+1e-6;t+=0.25){const v=leg.sailVehicle(tl,R,t),q=V.raster(SV.sailVoyageCamera(tl,R,t,s),s,v,{E:{real:false,impostor:true}},1);dmin=Math.min(dmin,q.islandH);dmax=Math.max(dmax,q.islandH);if(Math.abs(t-(sb.t0+sb.t1)/2)<0.13)mill=q.mill;}
 rows[s.w+'x'+s.h]={dockH:[+(dmin*100).toFixed(2),+(dmax*100).toFixed(2)],mill:mill&&[mill.hPx,mill.wPx]};}
console.log(JSON.stringify({C,k,rows}));
