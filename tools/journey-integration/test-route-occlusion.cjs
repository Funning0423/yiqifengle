#!/usr/bin/env node
'use strict';
/* b16 route occlusion contract (运镜bot; replaces test-journey-occlusion.cjs, deleted with the rainbow bridge in f678c084).
 * Route = sail island→meadow, balloon meadow→skycity, balloon skycity→lakeside (route/route-legs.cjs: real TS cameras,
 * FULL scene geometry incl. the Draco skycity, the sailboat and the balloon at their poses). 7 portrait screens; every 1/30 s
 * of each leg's game clock; frames under a full-screen cover (alpha 1) are skipped (nothing is visible).
 *  O1 her FACE, HEAD and CHEST are never hidden by solid geometry. Each feature is a disc facing the lens (radius face 6 cm,
 *     head 9 cm, chest 12 cm; centre + 8 rim rays, Möller–Trumbore on a BVH); it is HIDDEN when ≥5 of its 9 rays are blocked.
 *     The disc replaces the old single centre ray because the b16 vehicles carry thin rigging (balloon ropes/struts, boom, sheets)
 *     that a single ray reports as a full occlusion; every single-ray hit is still listed as a graze (centreRayHits).
 *     Clouds (translucent cards) are counted separately as soft occlusion and reported, not failed.
 *  O2 lens clearance ≥ 1.1 m from all solid geometry (team camera rule), every 1/10 s.
 * Day/night share these frames (no camera function reads the mode; asserted in test-route-continuity).
 * Geometry + real TS. Not a render or device acceptance. */
const fs=require('node:fs'),R=require('./route/route-legs.cjs'),{nearest}=require('../lakeside-landing-cam/audit.cjs');
const RAD={face:.06,head:.09,chest:.12};
function disc(leg,t,eye,p,r){const f=sub(p,eye),l=Math.hypot(...f),u=f.map(x=>x/l),a=Math.abs(u[1])<.9?[0,1,0]:[1,0,0],e1=norm(cross(u,a)),e2=cross(u,e1);let skipped=0,n=0,by=null;const centre=leg.los(t,eye,p);if(centre){n++;by=centre;}
 for(let k=0;k<8;k++){const th=k*Math.PI/4,q=add(p,add(e1.map(x=>x*r*Math.cos(th)),e2.map(x=>x*r*Math.sin(th)))),b=leg.los(t,eye,q);if(b){n++;by=by||b;}}return {hidden:n>=5,by:by&&(by+' ('+n+'/9)'),centre};}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a);return a.map(x=>x/l);};
const FPS=+(process.env.QF_ROUTE_FPS||30),CLEAR=1.1,rotY=R.J.rotY,sub=R.J.sub,add=R.J.add;
const screens=process.env.QF_ROUTE_SCREENS?JSON.parse(process.env.QF_ROUTE_SCREENS):R.SCREENS;
(async()=>{const G=await R.geometry(),results=[];
 const B=require('./journey-scene.cjs').H.load(require('./journey-scene.cjs').S+'region/BalloonFlight.ts');
 for(const mk of R.legs)for(const scr of screens){const leg=mk(G,scr),key=`${leg.id} ${scr.join('x')}`,fails=[],soft=[],graze=[];let skipped=0,n=0,minClear=9,clearAt=null,clearWho=null,black=0;
  const solidFor=t=>leg.id.startsWith('sail')?[G.sail]:leg.id.includes('→skycity')?[t<B.MEADOW_OFF_T?G.meadow:null,t>=B.CITY_ON_T?G.cityB:null,t>=B.ISLETS_ON_T?G.isletsB:null].filter(Boolean):[G.lake];
  for(let i=0;i/FPS<=leg.T+1e-9;i++){const t=i/FPS;if(leg.black(t)){black++;continue;}if(leg.herValid&&!leg.herValid(t)){skipped++;continue;}n++;const c=leg.cam(t),h=leg.her(t),rec={};
   for(const k of ['face','head','chest']){const b=disc(leg,t,c.position,h[k],RAD[k]);if(b.hidden)rec[k]=b.by;if(b.centre)graze.push({t:+t.toFixed(2),k,by:b.centre});if(leg.soft){const s=leg.soft(t,c.position,h[k]);if(s)soft.push({t:+t.toFixed(2),k,by:s});}}
   if(Object.keys(rec).length)fails.push({t:+t.toFixed(2),pose:h.pose,...rec});
   if(i%(FPS/10|0||1)===0){for(const g of solidFor(t)){const r=nearest(g,c.position,3);if(r.d<minClear){minClear=r.d;clearAt=+t.toFixed(2);clearWho=r.who;}}}}
  const phaseOf=t=>(leg.phases.find(p=>t>=p.t0&&t<p.t1)||{}).id;
  // Documented sail exceptions (Grok Bot 2026-10-22, see route-hard.json "exceptions"):
  //  O1palm — env_prop_palm_lean_01 may cross her face/head/chest for ≤ 2 frames (≤ 40 ms) within 10.5–11.5 s: a quick foreground
  //           pass while the set-off arc swings on her right, the palm 2.9 m from her at the jetty. Longer or elsewhere → O1 fails.
  //  O1sgMain — sail_main over her face as she stands in S-g (23.3 s): own key, hard since the raised K6 dock lens (TransportLeg K5/K6).
  const isSail=leg.id.startsWith('sail'),byOf=f=>Object.entries(f).filter(([k])=>['face','head','chest'].includes(k)).map(([,v])=>String(v));
  const allSpans=spans(fails.map(f=>f.t)).map(([a,b])=>({t0:a,t1:b,phase:phaseOf(a),first:fails.find(f=>f.t===a),frames:fails.filter(f=>f.t>=a&&f.t<=b).length}));
  const palmEx=sp=>isSail&&sp.t0>=10.5&&sp.t1<=11.5&&sp.frames<=2&&sp.t1-sp.t0<=0.04+1e-6&&fails.filter(f=>f.t>=sp.t0&&f.t<=sp.t1).every(f=>byOf(f).every(x=>/env_prop_palm_lean_01/.test(x)));
  const sgMain=sp=>isSail&&sp.phase==='S-g'&&fails.filter(f=>f.t>=sp.t0&&f.t<=sp.t1).every(f=>byOf(f).every(x=>/sail_main/.test(x)));
  const strict=allSpans.filter(sp=>!palmEx(sp)&&!sgMain(sp));
  results.push({leg:leg.id,screen:scr.join('x'),O1:strict.length?'FAIL':'PASS',O1palmException:isSail?allSpans.filter(palmEx):undefined,O1sgMain:isSail?(allSpans.some(sgMain)?'FAIL':'PASS'):undefined,O2:minClear>=CLEAR?'PASS':'FAIL',frames:n,herNotModelledFrames:skipped,blackFrames:black,occludedFrames:fails.length,
   occludedSpans:spans(fails.map(f=>f.t)).map(([a,b])=>({t0:a,t1:b,phase:phaseOf(a),first:fails.find(f=>f.t===a)})),centreRayGrazeFrames:new Set(graze.map(g=>g.t)).size,grazeSample:graze.slice(0,4),softCloudFrames:new Set(soft.map(s=>s.t)).size,softSample:soft.slice(0,3),
   minLensClearM:+minClear.toFixed(3),clearAtS:clearAt,clearPhase:clearAt==null?null:phaseOf(clearAt),clearNearest:clearWho});
  const r=results.at(-1);console.error(key,r.O1,r.occludedFrames,'clear',r.minLensClearM,r.clearAtS,r.clearNearest);}
 function spans(ts){const o=[];for(const t of ts){const l=o.at(-1);if(l&&t-l[1]<=1.5/FPS)l[1]=t;else o.push([t,t]);}return o;}
 const status=results.every(r=>r.O1==='PASS'&&r.O2==='PASS'&&r.O1sgMain!=='FAIL')?'PASS':'FAIL';
 const report={status,timeUTC:new Date().toISOString(),fps:FPS,clearanceM:CLEAR,geometry:G.info,scope:'Geometry on real GLB triangles (full Draco skycity) + real TS cameras. Not a render or device acceptance. Her dock/shore walk positions are path-linear.',results};
 fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/route-occlusion.json',JSON.stringify(report,null,1)+'\n');
 console.log(JSON.stringify({status,rows:results.map(r=>({leg:r.leg,screen:r.screen,O1:r.O1,occ:r.occludedFrames,O2:r.O2,clear:r.minLensClearM,at:r.clearAtS}))}));require('./route/route-gate.cjs').gate('test-route-occlusion.cjs',results.flatMap(r=>['O1','O1sgMain','O2'].filter(k=>r[k]==='FAIL').map(check=>({leg:r.leg,check}))));
})().catch(e=>{console.error(e);process.exit(2);});
