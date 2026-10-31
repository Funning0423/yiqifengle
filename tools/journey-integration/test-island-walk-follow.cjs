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
/* b21: model the runtime writer exactly: walks with an ISLAND_WALK_RAILS entry ride IslandStageLens.islandWalkRail from the held lens when
 * RegionNodeStage wires it (RAIL=off = the 05702f02 follow lens, the 'before'); others = FollowWalk follow (raw path heading, as before). */
const RNS=fs.readFileSync(S+'world-r2/RegionNodeStage.ts','utf8'),ISL=H.load(S+'region/IslandStageLens.ts'),railWired=/walkRail=islandWalkRail\(held,isl,wk\)/.test(RNS)&&/walkRail\?stageLensClock\(walkRail\)/.test(RNS);
const report={walks:{}};let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};
for(const wk of WALKS){const [a,b]=wk.split('>'),pl=NW.planWalk('island',a,b),p=pl.segments.flatMap((s,i)=>i?s.path.slice(1):s.path),L=NW.pathLength(p),T=L/1.2;
 const hd=d=>{const q=NW.pointAlong(p,Math.max(0,d-0.3)),r=NW.pointAlong(p,Math.min(L,d+0.3));return Math.atan2(r[0]-q[0],r[2]-q[2]);};
 report.walks[wk]={lengthM:+L.toFixed(3),segments:pl.segments.length,rail:!!(railWired&&process.env.RAIL!=='off'&&ISL.ISLAND_WALK_RAILS?.[wk]),screens:{}};
 for(const [w,h] of SCREENS){const g=new OC.LensGuard(),dt=1/30,B=0.6,her0=NW.pointAlong(p,0),held=g.solveStatic(E.followPose(her0,hd(0),w,h,0),her0,boxes);g.reset();const rl=railWired&&process.env.RAIL!=='off'&&ISL.ISLAND_WALK_RAILS?.[wk]?ISL.islandWalkRail(held,p,wk):null;
  let head90=0,head90Peak=0,face=0,chest=0,run=0,maxRun=0,blk={},rows=[];
  for(let k=0;k*dt<=B+T+0.5;k++){const t=k*dt,d=Math.max(0,Math.min(L,(t-B)*1.2)),her=NW.pointAlong(p,d);
   const pose=t<B?held:rl?rl.at(t-B):g.apply(E.followPose(her,hd(d),w,h,0),her,boxes,dt,undefined,undefined,false,0,false);
   if(t<B)continue;/* the blend frames start at the board lens (reported by the stage gates) */
   {/* 场景设计部 cross-check (report only): their 90-ray body grid, head/face = points >= 1.4 m (18 rays), % blocked */
    const dv=[her[0]-pose.position[0],0,her[2]-pose.position[2]],dn=Math.hypot(dv[0],dv[2])||1,rt=[-dv[2]/dn,0,dv[0]/dn];let hb=0,hn=0;
    for(let i=0;i<10;i++){const y=0.05+i*(1.70/9);if(y<1.4)continue;for(let j=0;j<9;j++){const x=-0.2+j*0.05;hn++;if(J.blockers(occ,pose.position,[her[0]+rt[0]*x,her[1]+y,her[2]+rt[2]*x]).length)hb++;}}
    const hp=Math.round(100*hb/hn);if(hp>0){head90+=dt;head90Peak=Math.max(head90Peak,hp);}}
   const fb=J.blockers(occ,pose.position,[her[0],her[1]+1.38,her[2]]),cb=J.blockers(occ,pose.position,[her[0],her[1]+1.05,her[2]]);
   if(fb.length){face+=dt;run+=dt;maxRun=Math.max(maxRun,run);for(const n of fb)blk[n.name||n]=+((blk[n.name||n]||0)+dt).toFixed(3);}else run=0;if(cb.length)chest+=dt;
   if(w===390)rows.push([+t.toFixed(3),...pose.position.map(x=>+x.toFixed(3)),...pose.target.map(x=>+x.toFixed(3)),...her.map(x=>+x.toFixed(3)),fb.length?1:0,cb.length?1:0]);}
  report.walks[wk].screens[w+'x'+h]={faceS:+face.toFixed(2),longestFaceRunS:+maxRun.toFixed(2),chestS:+chest.toFixed(2),head90AnyS:+head90.toFixed(2),head90PeakPct:head90Peak,blockers:blk};if(w===390)report.walks[wk].rows390=rows;
  ok(face<=LIM.face+1e-9,`${wk} ${w}x${h} face blocked ${face.toFixed(2)} s`);}}
fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/island-walk-follow.json'),JSON.stringify(report));
for(const wk in report.walks)console.log(wk,report.walks[wk].lengthM,report.walks[wk].segments,JSON.stringify(Object.fromEntries(Object.entries(report.walks[wk].screens).map(([k,v])=>[k,[v.faceS,v.chestS,v.head90AnyS,v.head90PeakPct,v.blockers]]))));
if(fail){console.log('island-walk-follow: FAIL',fail);process.exit(1);}console.log('island-walk-follow: PASS');
