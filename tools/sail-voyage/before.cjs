'use strict';
// Before numbers: CURRENT sailCamera, above-water meadow height share per 0.5 s per screen.
const V=require('./voyage_lib.cjs'),leg=V.leg;const route=leg.sailRoute(),tl=leg.sailBeats(route.length),sc=tl.beats.find(b=>b.id==='S-c');
const rows={};for(const s of leg.SAIL_SCREENS){const ser=[];for(let t=tl.beats[1].t0;t<=tl.build05S+1e-6;t+=0.5){const v=leg.sailVehicle(tl,route.samples,t);ser.push([+t.toFixed(1),+V.raster(leg.sailCamera(tl,route.samples,t,s),s,v).islandH.toFixed(3)]);}
 let run=0,best=0;for(const [,h] of ser){run=h===0?run+0.5:0;best=Math.max(best,run);}rows[s.w+'x'+s.h]={departH:ser.find(r=>r[0]>=sc.t0)[1],minH:Math.min(...ser.map(r=>r[1])),endH:ser.at(-1)[1],openSeaS:best,series:ser};}
require('fs').writeFileSync(__dirname+'/before.json',JSON.stringify({beats:tl.beats,routeM:route.length,speed:tl.speed,rows},null,1));
for(const [k,r] of Object.entries(rows))console.log(k,JSON.stringify({departH:r.departH,minH:r.minH,endH:r.endH,openSeaS:r.openSeaS}));
