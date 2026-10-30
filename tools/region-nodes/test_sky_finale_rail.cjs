'use strict';
// 运镜bot full9c T-02: the S4>S6 rail (SkyRunLens.skyRailPose on SKY_RAILS['S4>S6'], every planWalk run) keeps her in frame on all 7
// screens (herMargin ≥ 0.08) from S4 and from a planSkip start 1.2 m before S6; lens ≤ 2.5 m/s and view ≤ 120 °/s (LENS_SMOOTH walk cap)
// at 60 Hz inside a run; the last run ends ON SKY_FINALE_POSE_LOCAL. Whole walks incl. the board joins: sky-walk-whole and
// lens-trajectory-clearance (skycity walk rows).
const H=require(process.cwd()+'/tools/board-ui/harness.cjs').createHarness(),RL=H.load('region/SkyRunLens.ts'),F=H.load('region/SkyFinaleShot.ts'),NW=H.load('region/NodeWalker.ts'),LS=H.load('region/LensSmooth.ts');
const segs=NW.planWalk('skycity','S4','S6').segments,SP=1.2,rows=[];let fails=0;
const yaw=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*180/Math.PI;
for(const [lab,skip] of [['from S4',false],['planSkip from S6-1.2 m',true]]){let min=1,at='',vmax=0,ymax=0;
 segs.forEach((sg,si)=>{if(skip&&si<segs.length-1)return;const L=NW.pathLength(sg.path);let prev=null;
  for(let d=skip?Math.max(0,L-1.2):0;d<=L+1e-9;d+=SP/60){const h=NW.pointAlong(sg.path,d),p=RL.skyRailPose('S4>S6',h);
   for(const s of LS.LENS_SMOOTH.screens){const m=LS.herMargin(p.position,p.target,p.fovVerticalDeg,h,[s]);if(m<min){min=m;at=`run ${si+1} s ${d.toFixed(2)} ${s.join('x')}`;}}
   if(prev){vmax=Math.max(vmax,Math.hypot(...p.position.map((v,i)=>v-prev.position[i]))*60);let dy=Math.abs(yaw(p)-yaw(prev));if(dy>180)dy=360-dy;ymax=Math.max(ymax,dy*60);}prev=p;}});
 const ok=min>=0.08&&vmax<=2.5&&ymax<=120;if(!ok)fails++;rows.push({case:lab,minMargin:+min.toFixed(3),at,maxSpeedMS:+vmax.toFixed(2),maxYawDegS:+ymax.toFixed(1),ok});}
const end=RL.skyRailPose('S4>S6',segs.at(-1).path.at(-1)),T=F.SKY_FINALE_POSE_LOCAL,endErr=Math.hypot(...end.position.map((v,i)=>v-T.position[i]));if(endErr>0.01)fails++;
console.table(rows);console.log(JSON.stringify({test:'sky-finale-rail',endOnStandShotM:+endErr.toFixed(4),runs:segs.length,status:fails?'FAIL':'PASS'}));process.exit(fails?1:0);
