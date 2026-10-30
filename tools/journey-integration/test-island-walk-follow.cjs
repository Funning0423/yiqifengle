'use strict';
// 运镜bot b20 i5-recheck: island node-walk FOLLOW lens face/chest blocking (I4>I5, I5>I6) on the baked routes (planWalk = edge.path,
// nodes from REGION_NODES). Lens per frame = the runtime FollowWalk writer: ExploreCameraCore.followPose(her, heading) through
// LensGuard.apply (ISLAND_LENS_OCCLUDERS, nudge off) after the 0.6 s board->held blend (held = LensGuard.solveStatic). Her walk 1.2 m/s,
// heading smoothed over +-0.3 m. Blocked = face (1.38 m) / chest (1.05 m) sight line hits the skinned island mesh (journey-scene).
// Gate (Grok Bot): face blocked <= 0.5 s per walk (walk + 0.5 s), 7 screens, 30 fps. Report: reports/island-walk-follow.json.
const fs=require('fs'),path=require('path');const J=require('./journey-scene.cjs');const {H,S}=J;
const E=H.load(S+'region/ExploreCameraCore.ts'),NW=H.load(S+'region/NodeWalker.ts'),OC=H.load(S+'region/LensOcclusion.ts'),IX=H.load(S+'region/IslandLensOccluders.ts');
const boxes=IX.ISLAND_LENS_OCCLUDERS.map(r=>({min:[r[0],r[1],r[2]],max:[r[3],r[4],r[5]]}));
const occ=J.island.filter(o=>!/seagull|smoke|beam|glow|glass/.test(o.name));
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]],LIM={face:0.5};
const WALKS=(process.env.WALKS||'I4>I5,I5>I6').split(',');
const report={walks:{}};let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};
for(const wk of WALKS){const [a,b]=wk.split('>'),pl=NW.planWalk('island',a,b),p=pl.segments.flatMap((s,i)=>i?s.path.slice(1):s.path),L=NW.pathLength(p),T=L/1.2;
 const hd=d=>{const q=NW.pointAlong(p,Math.max(0,d-0.3)),r=NW.pointAlong(p,Math.min(L,d+0.3));return Math.atan2(r[0]-q[0],r[2]-q[2]);};
 report.walks[wk]={lengthM:+L.toFixed(3),segments:pl.segments.length,screens:{}};
 for(const [w,h] of SCREENS){const g=new OC.LensGuard(),dt=1/30,B=0.6,her0=NW.pointAlong(p,0),held=g.solveStatic(E.followPose(her0,hd(0),w,h,0),her0,boxes);g.reset();
  let face=0,chest=0,run=0,maxRun=0,blk={},rows=[];
  for(let k=0;k*dt<=B+T+0.5;k++){const t=k*dt,d=Math.max(0,Math.min(L,(t-B)*1.2)),her=NW.pointAlong(p,d);
   const pose=t<B?held:g.apply(E.followPose(her,hd(d),w,h,0),her,boxes,dt,undefined,undefined,false,0,false);
   if(t<B)continue;/* the blend frames start at the board lens (reported by the stage gates) */
   const fb=J.blockers(occ,pose.position,[her[0],her[1]+1.38,her[2]]),cb=J.blockers(occ,pose.position,[her[0],her[1]+1.05,her[2]]);
   if(fb.length){face+=dt;run+=dt;maxRun=Math.max(maxRun,run);for(const n of fb)blk[n.name||n]=+((blk[n.name||n]||0)+dt).toFixed(3);}else run=0;if(cb.length)chest+=dt;
   if(w===390)rows.push([+t.toFixed(3),...pose.position.map(x=>+x.toFixed(3)),...pose.target.map(x=>+x.toFixed(3)),...her.map(x=>+x.toFixed(3)),fb.length?1:0,cb.length?1:0]);}
  report.walks[wk].screens[w+'x'+h]={faceS:+face.toFixed(2),longestFaceRunS:+maxRun.toFixed(2),chestS:+chest.toFixed(2),blockers:blk};if(w===390)report.walks[wk].rows390=rows;
  ok(face<=LIM.face+1e-9,`${wk} ${w}x${h} face blocked ${face.toFixed(2)} s`);}}
fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/island-walk-follow.json'),JSON.stringify(report));
for(const wk in report.walks)console.log(wk,report.walks[wk].lengthM,report.walks[wk].segments,JSON.stringify(Object.fromEntries(Object.entries(report.walks[wk].screens).map(([k,v])=>[k,[v.faceS,v.chestS,v.blockers]]))));
if(fail){console.log('island-walk-follow: FAIL',fail);process.exit(1);}console.log('island-walk-follow: PASS');
