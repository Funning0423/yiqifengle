'use strict';
// 运镜bot full9c: whole-walk framing / occlusion hard gate for the played skycity walks (sky-rail-model = RegionNodeStage + SkyRunLens),
// 7 screens, entered from that screen's board lens. While she walks (rail parts) and on the stand hold: herMargin ≥ 0.08 on the screen;
// chest (1.2 m) / face (1.55 m) sight lines blocked by the real mesh (lens-scene solid set) ≤ 0.5 s in a row over the WHOLE sequence
// (joins included, once the join is past its first 40 %: the board shot is a wide court view); lens ≤ 2.5 m/s and view ≤ 120 °/s on the
// rails; S4>S6 ends on SKY_FINALE_POSE_LOCAL. Joins: no-cut / clearance in lens-trajectory-clearance.
const M=require('./sky-rail-model.cjs'),{H,RL,F}=M,LS=H.load('region/LensSmooth.ts'),SW=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts');
const L=require('../journey-integration/clip3/lens-scene.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
const W=p=>SW.skyLocalToWorld(TS.TRANSITION_STAGING.skyMooring5a,p),SOFT=/foliage_cards|flowers|robot_gardener|cloud|cumulus/,yaw=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*180/Math.PI;
(async()=>{const objs=await L.skyObjs(),B=L.bvh(objs.filter(o=>!SOFT.test(o.name)));const rows=[];let fails=0;
 const blocked=(p,h,dy)=>{const a=W(p.position),b=W([h[0],h[1]+dy,h[2]]),d=b.map((v,i)=>v-a[i]),l=Math.hypot(...d);return !!FL.cast(B,a,d.map(v=>v/l),l-0.3);};
 const only=process.argv.includes('--one')?M.SCREENS.slice(0,1):M.SCREENS;
 for(const w of M.WALKS)for(const sc of only)for(const [lab,o] of [['board entry → exit',{}],...(w==='S4>S6'?[['from S6 (planSkip)',{fromS6:true}]]:[])]){const smp=M.samples(w,sc,o);
  let min=1,at='',run={c:0,f:0},blk={c:0,f:0},vmax=0,ymax=0,prev=null,jk=0;
  smp.forEach((s,i)=>{if(s.join){jk=prev&&prev.join===s.join?jk+1:0;}const jn=s.join?smp.filter(x=>x.join===s.join).length:0,early=s.join&&(s.join==='in'?jk<0.4*jn:jk>0.6*jn);
   if(!s.join){const m=LS.herMargin(s.p.position,s.p.target,s.p.fovVerticalDeg,s.h,[sc]);if(m<min){min=m;at=`#${i} part ${s.part}`;}}
   const c=!early&&blocked(s.p,s.h,1.2),f=!early&&blocked(s.p,s.h,1.55);run.c=c?run.c+1:0;run.f=f?run.f+1:0;blk.c=Math.max(blk.c,run.c);blk.f=Math.max(blk.f,run.f);
   if(prev&&!s.join&&!prev.join&&prev.part===s.part){vmax=Math.max(vmax,Math.hypot(...s.p.position.map((v,k)=>v-prev.p.position[k]))*60);let d=Math.abs(yaw(s.p)-yaw(prev.p));if(d>180)d=360-d;ymax=Math.max(ymax,d*60);}prev=s;});
  const ok=min>=0.08&&blk.c/60<=0.5&&blk.f/60<=0.5&&vmax<=2.5&&ymax<=120;if(!ok)fails++;
  rows.push({walk:w,screen:sc.join('x'),case:lab,frames:smp.length,minMargin:+min.toFixed(3),at,chestBlockedS:+(blk.c/60).toFixed(2),faceBlockedS:+(blk.f/60).toFixed(2),maxSpeedMS:+vmax.toFixed(2),maxYawDegS:+ymax.toFixed(1),ok});}
 const e=RL.skyRailPose('S4>S6',M.segsOf('S4>S6').at(-1).path.at(-1)),T=F.SKY_FINALE_POSE_LOCAL,endErr=Math.hypot(...e.position.map((v,i)=>v-T.position[i]));if(endErr>0.01)fails++;
 console.table(rows);console.log(JSON.stringify({test:'sky-walk-whole',rows:rows.length,endOnStandShotM:+endErr.toFixed(4),status:fails?'FAIL':'PASS'}));process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
