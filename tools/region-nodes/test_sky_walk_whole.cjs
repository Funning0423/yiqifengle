'use strict';
// 运镜bot full9c: whole-walk framing / occlusion hard gate for the played skycity walks (sky-rail-model = RegionNodeStage + SkyRunLens),
// 7 screens, entered from that screen's board lens. While she walks (rail parts) and on the stand hold: herMargin ≥ 0.08 on the screen;
// chest (1.05 m) / face (1.45 m) sight lines (the sky_run_lens_eval / sky-walk-endshots heights) blocked by the real mesh (all but clouds, foliage included) ≤ 0.5 s in a row over the WHOLE sequence
// (board joins included while the lens is within 12 m of her chest, walk-plan skip joins at ANY distance: farther out the join is the wide board/court move, she is not the subject); lens ≤ 2.5 m/s and view ≤ 120 °/s on the
// rails; no cut anywhere in the sequence (every frame step ≤ 0.6 m and turn ≤ 4°, walk-plan skips and planSkip included); beyond 12 m of
// her chest she is in frame; across a skip she is back in frame (margin ≥ 0.08) within 0.5 s; (herMargin ≥ 0) on ≥ 95% of those frames (T6); --spans <file> lists every > 12 m span; S4>S6 ends on SKY_FINALE_POSE_LOCAL. Joins: no-cut / clearance in lens-trajectory-clearance.
const M=require('./sky-rail-model.cjs'),{H,RL,F}=M,LS=H.load('region/LensSmooth.ts'),SW=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts');
const L=require('../journey-integration/clip3/lens-scene.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
const W=p=>SW.skyLocalToWorld(TS.TRANSITION_STAGING.skyMooring5a,p),SOFT=/foliage_cards|flowers|robot_gardener|cloud|cumulus/,yaw=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*180/Math.PI;
(async()=>{const objs=await L.skyObjs(),B=L.bvh(objs.filter(o=>!/cloud|cumulus/.test(o.name)))/* sight lines: every mesh but clouds (foliage hides her) */;const rows=[],spans=[],dir=p=>{const d=p.target.map((v,i)=>v-p.position[i]),l=Math.hypot(...d);return d.map(v=>v/l);};let fails=0;
 const blocked=(p,h,dy)=>{const a=W(p.position),b=W([h[0],h[1]+dy,h[2]]),d=b.map((v,i)=>v-a[i]),l=Math.hypot(...d);return !!FL.cast(B,a,d.map(v=>v/l),l-0.3);};
 const only=process.argv.includes('--one')?M.SCREENS.slice(0,1):M.SCREENS;
 for(const w of M.WALKS)for(const sc of only)for(const [lab,o] of [['board entry → exit',{}],...(w==='S4>S6'?[['from S6 (planSkip)',{fromS6:true}]]:[])]){const smp=M.samples(w,sc,o);
  let min=1,at='',run={c:0,f:0},blk={c:0,f:0},vmax=0,ymax=0,prev=null,jk=0,cutStep=0,cutTurn=0,skipOut=0,far=0,farIn=0,span=null;
  smp.forEach((s,i)=>{const far12=s.join&&Math.hypot(s.p.position[0]-s.h[0],s.p.position[1]-s.h[1]-1.3,s.p.position[2]-s.h[2])>12,early=far12&&s.join!=='skip';
   if(far12){const bc=blocked(s.p,s.h,1.05),bf=blocked(s.p,s.h,1.45);far++;if(LS.herMargin(s.p.position,s.p.target,s.p.fovVerticalDeg,s.h,[sc])>=0)farIn++;if(!span)span={walk:w,screen:sc.join('x'),case:lab,part:s.join,startS:+(i/60).toFixed(2),frames:0,chestHidFrames:0,faceHidFrames:0,outOfFrameFrames:0};span.frames++;if(bc)span.chestHidFrames++;if(bf)span.faceHidFrames++;if(LS.herMargin(s.p.position,s.p.target,s.p.fovVerticalDeg,s.h,[sc])<0)span.outOfFrameFrames++;}else if(span){spans.push({...span,durationS:+(span.frames/60).toFixed(2)});span=null;}
   if(prev){cutStep=Math.max(cutStep,Math.hypot(...s.p.position.map((v,k)=>v-prev.p.position[k])));const a=dir(prev.p),b=dir(s.p);cutTurn=Math.max(cutTurn,Math.acos(Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2]))*180/Math.PI);}
   if(s.join==='skip'&&LS.herMargin(s.p.position,s.p.target,s.p.fovVerticalDeg,s.h,[sc])<0.08)skipOut++;
   if(!s.join){const m=LS.herMargin(s.p.position,s.p.target,s.p.fovVerticalDeg,s.h,[sc]);if(m<min){min=m;at=`#${i} part ${s.part}`;}}
   const c=!early&&blocked(s.p,s.h,1.05),f=!early&&blocked(s.p,s.h,1.45);run.c=c?run.c+1:0;run.f=f?run.f+1:0;blk.c=Math.max(blk.c,run.c);blk.f=Math.max(blk.f,run.f);
   if(prev&&!s.join&&!prev.join&&prev.part===s.part){vmax=Math.max(vmax,Math.hypot(...s.p.position.map((v,k)=>v-prev.p.position[k]))*60);let d=Math.abs(yaw(s.p)-yaw(prev.p));if(d>180)d=360-d;ymax=Math.max(ymax,d*60);}prev=s;});if(span)spans.push({...span,durationS:+(span.frames/60).toFixed(2)});
  const farPct=far?farIn/far*100:100,ok=skipOut/60<=0.5&&cutStep<=0.6&&cutTurn<=4&&farPct>=95&&min>=0.08&&blk.c/60<=0.5&&blk.f/60<=0.5&&vmax<=2.5&&ymax<=120;if(!ok)fails++;
  rows.push({walk:w,screen:sc.join('x'),case:lab,frames:smp.length,minMargin:+min.toFixed(3),at,chestBlockedS:+(blk.c/60).toFixed(2),faceBlockedS:+(blk.f/60).toFixed(2),maxSpeedMS:+vmax.toFixed(2),maxYawDegS:+ymax.toFixed(1),cutStepM:+cutStep.toFixed(3),cutTurnDeg:+cutTurn.toFixed(2),skipOutS:+(skipOut/60).toFixed(2),skipFrames:smp.filter(q=>q.join==='skip').length,far12S:+(far/60).toFixed(2),far12InFramePct:+farPct.toFixed(1),ok});}
 const e=RL.skyRailPose('S4>S6',M.segsOf('S4>S6').at(-1).path.at(-1)),T=F.SKY_FINALE_POSE_LOCAL,endErr=Math.hypot(...e.position.map((v,i)=>v-T.position[i]));if(endErr>0.01)fails++;
 if(process.argv.includes('--spans'))require('fs').writeFileSync(process.argv[process.argv.indexOf('--spans')+1],JSON.stringify(spans,null,1));
 console.table(rows);console.log(JSON.stringify({test:'sky-walk-whole',rows:rows.length,endOnStandShotM:+endErr.toFixed(4),status:fails?'FAIL':'PASS'}));process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
