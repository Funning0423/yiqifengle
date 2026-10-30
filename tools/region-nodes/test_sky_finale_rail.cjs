'use strict';
// 运镜bot full9c T-02: the finale rail (SkyFinaleShot.skyFinaleRailPose on SKY_FINALE_RAILS, both planWalk S4→S6 runs) keeps her in frame
// on all 7 screens (herMargin ≥ 0.08, model-local; the frame is rigid) from S4 and from a planSkip start 1.2 m before S6; the lens
// speed is ≤ 2.5 m/s and the view turn ≤ 120 °/s (LENS_SMOOTH walk cap) at 60 Hz; the S3>S4 end lens joins run 1 (no cut in the
// normal flow); the last run ends on SKY_FINALE_POSE_LOCAL. Mesh clearance of the same path: lens-trajectory-clearance (T-02 finale rows).
const H=require(process.cwd()+'/tools/board-ui/harness.cjs').createHarness(),F=H.load('region/SkyFinaleShot.ts'),NW=H.load('region/NodeWalker.ts'),C=H.load('region/ExploreCameraCore.ts'),LS=H.load('region/LensSmooth.ts'),FR=H.load('region/SkyFinaleRail.ts');
const segs=NW.planWalk('skycity','S4','S6').segments,SP=1.2,rows=[];let fails=0;
const yaw=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*180/Math.PI;
for(const [lab,fromS] of [['from S4',0],['planSkip from S6-1.2 m',-1]]){let min=1,at='',vmax=0,ymax=0;
 segs.forEach((sg,si)=>{if(fromS<0&&si<segs.length-1)return;const a=sg.path[0],b=sg.path.at(-1),L=Math.hypot(b[0]-a[0],b[2]-a[2]);let prev=null;
  for(let d=fromS<0?Math.max(0,L-1.2):0;d<=L+1e-9;d+=SP/60){const u=d/L,h=a.map((v,i)=>v+(b[i]-v)*u),p=F.skyFinaleRailPose(h);
   for(const s of LS.LENS_SMOOTH.screens){const m=LS.herMargin(p.position,p.target,p.fovVerticalDeg,h,[s]);if(m<min){min=m;at=`run ${si+1} s ${d.toFixed(2)} ${s.join('x')}`;}}
   if(prev){vmax=Math.max(vmax,Math.hypot(...p.position.map((v,i)=>v-prev.position[i]))*60);let dy=Math.abs(yaw(p)-yaw(prev));if(dy>180)dy=360-dy;ymax=Math.max(ymax,dy*60);}prev=p;}});
 const ok=min>=0.08&&vmax<=2.5&&ymax<=120;if(!ok)fails++;rows.push({case:lab,minMargin:+min.toFixed(3),at,maxSpeedMS:+vmax.toFixed(2),maxYawDegS:+ymax.toFixed(1),ok});}
const s34=NW.planWalk('skycity','S3','S4').segments.at(-1).path,e=s34.at(-1),f=s34.at(-2),join=(()=>{const l=C.followPose(e,Math.atan2(e[0]-f[0],e[2]-f[2]),390,844,0),p=F.skyFinaleRailPose(segs[0].path[0]).position;return Math.hypot(l.position[0]-p[0],l.position[1]-p[1],l.position[2]-p[2])<=0.6;})();if(!join)fails++;
const end=F.skyFinaleRailPose(segs.at(-1).path.at(-1)),T=F.SKY_FINALE_POSE_LOCAL,endErr=Math.max(Math.hypot(...end.position.map((v,i)=>v-T.position[i])),(()=>{const u=q=>{const d=q.target.map((v,i)=>v-q.position[i]),l=Math.hypot(...d);return d.map(v=>v/l);},a=u(end),b=u(T);return Math.hypot(...a.map((v,i)=>v-b[i]));})()/* view direction */);if(endErr>0.01)fails++;
console.table(rows);console.log(JSON.stringify({test:'sky-finale-rail',s34JoinsRun1:join,endOnStandShotErr:+endErr.toFixed(4),railRuns:FR.SKY_FINALE_RAILS.length,status:fails?'FAIL':'PASS'}));process.exit(fails?1:0);
