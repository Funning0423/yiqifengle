'use strict';
// 运镜bot b21: island I3>I4 approach on GGbot's E-waypoint route (Grok Bot item 4, plan B): IslandApproachLens vs the live FollowWalk
// lens (followPose through LensGuard, ISLAND_LENS_OCCLUDERS). 7 screens, per real dt at 60 and 30 fps, window = walk start .. walk end + 0.5 s.
// Gates: face (1.38 m point) blocked <= 0.2 s; <= 8 m/s, <= 0.5 m/frame, yaw/pitch <= 90 deg/s, angular accel p99 <= 200 deg/s^2,
// fov <= 1.5 deg/frame, ground >= 1.5 m, solids >= 0.5 m, her margin >= 0.08, menu button never over her face, first write = the live
// lens; HANDOVER (track -> takeover): position / direction / fov continuous, per-frame deltas at the handover inside the limits,
// velocity jump across it <= 20 m/s^2 x dt, angular accel at the handover <= 200 deg/s^2. 'before' (today's follow) is reported only.
const fs=require('fs'),path=require('path');const J=require('./journey-scene.cjs');const {H,S}=J;
const E=H.load(S+'region/ExploreCameraCore.ts'),NW=H.load(S+'region/NodeWalker.ts'),OC=H.load(S+'region/LensOcclusion.ts'),IX=H.load(S+'region/IslandLensOccluders.ts'),
 LS=H.load(S+'region/LensSmooth.ts'),F=H.load(S+'region/SkyFinaleShot.ts'),AL=H.load(S+'region/IslandApproachLens.ts');
const VIA=JSON.parse(fs.readFileSync(path.join(__dirname,'occlusion/island-i3-i4-via-E-ggbot.json'),'utf8'));
const pl=NW.planWalk('island','I3','I4',{via:VIA.via});const walk=pl.segments[0].path,L=NW.pathLength(walk),T=L/1.2;
const boxes=IX.ISLAND_LENS_OCCLUDERS.map(r=>({min:[r[0],r[1],r[2]],max:[r[3],r[4],r[5]]}));
const occ=J.island.filter(o=>!/seagull|smoke|beam|glow|glass/.test(o.name)),ground=J.island.filter(o=>/env_island_main/.test(o.name)),
 solids=J.island.filter(o=>!/env_island_main|seagull|smoke|beam|glow|glass|wet_sand|tide|shells|crab|turtle|cat/.test(o.name));
const gh=p=>{let b=null;for(const o of ground){o.bb??=J.bbox(o.tris);if(p[0]<o.bb[0][0]||p[0]>o.bb[1][0]||p[2]<o.bb[0][2]||p[2]>o.bb[1][2])continue;const t=J.rayHit(p,[0,-1,0],200,o.tris);if(t!==null&&(b===null||t<b))b=t;}return b;};
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const LIM={yaw:90,pitch:90,acc:200,v:8,step:0.5,fov:1.5,ground:1.5,solid:0.5,margin:0.08,face:0.2,linAcc:20};
const hd=d=>{const a=NW.pointAlong(walk,Math.max(0,d-0.3)),b=NW.pointAlong(walk,Math.min(L,d+0.3));return Math.atan2(b[0]-a[0],b[2]-a[2]);};
const ya=q=>{const d=q.target.map((x,i)=>x-q.position[i]),n=Math.hypot(...d);return [Math.atan2(d[0],d[2])*180/Math.PI,Math.asin(d[1]/n)*180/Math.PI];};
function liveFollow(w,h,dt){const g=new OC.LensGuard(),out=[];for(let k=0;k*dt<=T+0.5+1e-9;k++){const t=k*dt,d=Math.min(L,t*1.2),her=NW.pointAlong(walk,d);out.push(g.apply(E.followPose(her,hd(d),w,h,0),her,boxes,dt,undefined,undefined,false,0,false));}return out;}
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};const report={walk:{lengthM:+L.toFixed(3),seconds:+T.toFixed(3),segments:pl.segments.length},before:{},after:{},handover:{},rows:{}};
function measure(poses,dt,w,h,id,gate,rowsKey){let prev=null,pr=null,acc=[],mx={yaw:0,pitch:0,v:0,step:0,fov:0},minG=99,minS=99,minM=9,face=0,run=0,maxRun=0,cap=0,rows=[];
 for(let k=0;k<poses.length;k++){const t=k*dt,p=poses[k],her=NW.pointAlong(walk,Math.min(L,t*1.2)),fp=[her[0],her[1]+1.38,her[2]];
  if(prev){const st=Math.hypot(...p.position.map((x,i)=>x-prev.position[i])),[y,q]=ya(p),[y0,q0]=ya(prev),yr=((y-y0+540)%360-180)/dt,qr=(q-q0)/dt;
   mx.yaw=Math.max(mx.yaw,Math.abs(yr));mx.pitch=Math.max(mx.pitch,Math.abs(qr));mx.v=Math.max(mx.v,st/dt);mx.step=Math.max(mx.step,st);mx.fov=Math.max(mx.fov,Math.abs(p.fovVerticalDeg-prev.fovVerticalDeg));if(pr)acc.push(Math.hypot(yr-pr[0],qr-pr[1])/dt);pr=[yr,qr];}
  if(dt>1/45){const g=gh(p.position);if(g!==null)minG=Math.min(minG,g);minS=Math.min(minS,J.clearance(p.position,solids,3)[0]);minM=Math.min(minM,LS.herMargin(p.position,p.target,p.fovVerticalDeg,her,[[w,h]]));
   const fb=J.blockers(occ,p.position,fp);if(fb.length){face+=dt;run+=dt;maxRun=Math.max(maxRun,run);}else run=0;
   const v=F.ndc(p.position,p.target,p.fovVerticalDeg,w,h,fp);if(v){const px=(v[0]+1)/2*w,py=(1-v[1])/2*h;if(px>=w-98&&px<=w&&py>=0&&py<=92)cap++;}
   if(rowsKey)rows.push([+t.toFixed(3),...p.position.map(x=>+x.toFixed(3)),...p.target.map(x=>+x.toFixed(3)),+p.fovVerticalDeg.toFixed(2),...her.map(x=>+x.toFixed(3)),fb.length?1:0]);}
  prev=p;}
 acc.sort((a,b)=>a-b);const p99=acc.length?acc[Math.floor(acc.length*0.99)]:0;
 const s={yawDegS:+mx.yaw.toFixed(1),pitchDegS:+mx.pitch.toFixed(1),accP99:+p99.toFixed(0),ms:+mx.v.toFixed(2),stepM:+mx.step.toFixed(3),fovPerFrame:+mx.fov.toFixed(3)};
 if(dt>1/45)Object.assign(s,{faceS:+face.toFixed(2),faceRunS:+maxRun.toFixed(2),groundM:+minG.toFixed(2),solidM:+minS.toFixed(2),margin:+minM.toFixed(3),capsule:cap});
 if(gate){ok(s.yawDegS<=LIM.yaw&&s.pitchDegS<=LIM.pitch,`${id} yaw/pitch ${s.yawDegS}/${s.pitchDegS}`);ok(p99<=LIM.acc,`${id} accel p99 ${s.accP99}`);ok(s.ms<=LIM.v,`${id} speed ${s.ms}`);ok(s.stepM<=LIM.step,`${id} step ${s.stepM}`);ok(s.fovPerFrame<=LIM.fov,`${id} fov ${s.fovPerFrame}`);
  if(dt>1/45){ok(face<=LIM.face+1e-9,`${id} face blocked ${face.toFixed(2)} s`);ok(minG>=LIM.ground,`${id} ground ${minG}`);ok(minS>=LIM.solid,`${id} solid ${minS}`);ok(minM>=LIM.margin,`${id} margin ${minM.toFixed(3)}`);ok(cap===0,`${id} capsule ${cap}`);}}
 if(rowsKey)report.rows[rowsKey]=rows;return s;}
for(const [w,h] of SCREENS)for(const fps of [60,30]){const dt=1/fps,id=`${w}x${h} ${fps}fps`,base=liveFollow(w,h,dt),live=base[0];
 report.before[id]=measure(base,dt,w,h,id,false,fps===30&&w===390?'before390':null);
 const lens=AL.islandApproachLens(live,walk,w,h,boxes),poses=[];for(let k=0;k*dt<=T+0.5+1e-9;k++)poses.push(lens.at(k*dt));
 ok(Math.hypot(...poses[0].position.map((x,i)=>x-live.position[i]))<1e-6,`${id} first write != live lens`);
 report.after[id]=measure(poses,dt,w,h,id,true,fps===30&&w===390?'after390':null);
 const th=lens.handoverS,e=1e-4,a=lens.at(th-e),c=lens.at(th+e),dv=(p,q)=>Math.hypot(...p.position.map((x,i)=>x-q.position[i])),dd=(p,q)=>{const u=ya(p),v=ya(q);return Math.hypot(((u[0]-v[0]+540)%360-180),u[1]-v[1]);};
 const k0=Math.round(th/dt),f=[lens.at((k0-1)*dt),lens.at(k0*dt),lens.at((k0+1)*dt),lens.at((k0+2)*dt)];
 const vel=(p,q)=>p.position.map((x,i)=>(x-q.position[i])/dt),va=vel(f[2],f[1]),vb=vel(f[1],f[0]),jump=Math.hypot(...va.map((x,i)=>x-vb[i]));
 const r=f.map(ya),wr=[1,2,3].map(i=>[((r[i][0]-r[i-1][0]+540)%360-180)/dt,(r[i][1]-r[i-1][1])/dt]),angAcc=Math.max(Math.hypot(wr[1][0]-wr[0][0],wr[1][1]-wr[0][1]),Math.hypot(wr[2][0]-wr[1][0],wr[2][1]-wr[1][1]))/dt;
 const H0={handoverS:+th.toFixed(3),posGapM:+dv(c,a).toFixed(6),dirGapDeg:+dd(c,a).toFixed(5),fovGap:+Math.abs(c.fovVerticalDeg-a.fovVerticalDeg).toFixed(5),
  stepM:[1,2,3].map(i=>+dv(f[i],f[i-1]).toFixed(4)),speedMs:[1,2,3].map(i=>+(dv(f[i],f[i-1])/dt).toFixed(3)),velJumpMs:+jump.toFixed(4),linAccMs2:+(jump/dt).toFixed(3),angRateDegS:wr.map(x=>x.map(y=>+y.toFixed(2))),angAccDegS2:+angAcc.toFixed(1)};
 report.handover[id]=H0;ok(H0.posGapM<1e-3&&H0.dirGapDeg<0.05&&H0.fovGap<1e-3,`${id} handover jump`);ok(H0.stepM.every(x=>x<=LIM.step)&&H0.speedMs.every(x=>x<=LIM.v),`${id} handover frame deltas`);
 ok(H0.linAccMs2<=LIM.linAcc,`${id} handover velocity jump ${H0.linAccMs2} m/s^2`);ok(H0.angAccDegS2<=LIM.acc,`${id} handover angular accel ${H0.angAccDegS2}`);}
fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/island-i4-approach.json'),JSON.stringify(report));
const sum=k=>{const v=Object.values(report[k]),mx=f=>Math.max(...v.map(x=>x[f]??-1)),mn=f=>Math.min(...v.filter(x=>x[f]!==undefined).map(x=>x[f]));return {face:mx('faceS'),ms:mx('ms'),step:mx('stepM'),yaw:mx('yawDegS'),pitch:mx('pitchDegS'),acc:mx('accP99'),fov:mx('fovPerFrame'),ground:mn('groundM'),solid:mn('solidM'),margin:mn('margin'),capsule:mx('capsule')};};
console.log(JSON.stringify({walk:report.walk,before:sum('before'),after:sum('after'),handover390:report.handover['390x844 60fps']}));
if(fail){console.log('island-i4-approach: FAIL',fail);process.exit(1);}console.log('island-i4-approach: PASS');
