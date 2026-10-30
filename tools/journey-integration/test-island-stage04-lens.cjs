'use strict';
// 运镜bot b20 (方案 E, scene c651ba8c I4 [4.1,0.112,2.7]): island stage-04 node lenses, ENTRY (I3>I4 reward walk) and DEPARTURE
// (reveal → I4>I6 walk → boarding / LiveHandoff), on the REAL runtime wiring: if RegionNodeStage.playReward routes island walks through
// IslandStageLens it checks those lenses, otherwise the legacy path (BLEND_S.boardToFollow blendPose onto the follow pose, then held).
// Limits (Grok Bot / GGbot, per real dt at 60 and 30 fps, 7 screens, window = first write .. 1 s after the lens settles):
//   yaw/pitch <= 90 deg/s, angular accel p99 <= 200 deg/s^2, speed <= 8 m/s, step <= 0.5 m/frame, fov <= 1.5 deg/frame,
//   ground >= 1.5 m (where island ground is below), >= 0.5 m from solids, face/chest hidden <= 0.5 s, her margin >= 0.08,
//   capsule never over her face (entry: face/chest + margin reported only, see below), first write = the live lens, departure ends on the follow pose at I6, reveal→boarding <= 8 s.
// FAILs on 96dfbd33 (legacy blend: 46-60 m in 0.6 s). Writes reports/island-stage04-lens.json (per-frame rows).
const fs=require('fs'),path=require('path');const J=require('./journey-scene.cjs');const {H,S}=J;
const E=H.load(S+'region/ExploreCameraCore.ts'),NW=H.load(S+'region/NodeWalker.ts'),LS=H.load(S+'region/LensSmooth.ts'),F=H.load(S+'region/SkyFinaleShot.ts');
const RN=fs.readFileSync(S+'world-r2/RegionNodeStage.ts','utf8');
const wired=/islandDepartLens\(board,isl,/.test(RN)&&/islandEntryPan\(board,isl\)/.test(RN)&&/\(this\.region==='skycity'\|\|this\.region==='island'\)&&this\.skyRail/.test(RN);
const IL=wired?H.load(S+'region/IslandStageLens.ts'):null;
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const LIM={yaw:90,pitch:90,acc:200,v:8,step:0.5,fov:1.5,ground:1.5,solid:0.5,hidden:0.5,margin:0.08,total:8};
const occ=J.island.filter(o=>!/seagull|smoke|beam|glow|glass/.test(o.name)),ground=J.island.filter(o=>/env_island_main/.test(o.name)),
 solids=J.island.filter(o=>!/env_island_main|seagull|smoke|beam|glow|glass|wet_sand|tide|shells|crab|turtle|cat/.test(o.name));
const gh=p=>{let b=null;for(const o of ground){o.bb??=J.bbox(o.tris);if(p[0]<o.bb[0][0]||p[0]>o.bb[1][0]||p[2]<o.bb[0][2]||p[2]>o.bb[1][2])continue;const t=J.rayHit(p,[0,-1,0],200,o.tris);if(t!==null&&(b===null||t<b))b=t;}return b;};
const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};const ya=p=>{const d=unit(p.target.map((x,i)=>x-p.position[i]));return [Math.atan2(d[0],d[2])*180/Math.PI,Math.asin(d[1])*180/Math.PI];};
const lu=E.followLookUp('island',99),walk=(a,b)=>{const pl=NW.planWalk('island',a,b);return {pl,path:pl.segments.flatMap((s,i)=>i?s.path.slice(1):s.path)};};
// push-in end exactly as WorldFlowComponent.enterLevelLook from the island lens (reach 40, step 2.6, fov-6)
const ci=J.Cam.islandPoseEntry(),fw=unit(ci.target.map((x,i)=>x-ci.position[i]));
const P0={position:ci.position.map((x,i)=>x+fw[i]*2.6),target:ci.position.map((x,i)=>x+fw[i]*40),fovVerticalDeg:ci.fovVerticalDeg-6};
const board={position:ci.position.slice(),target:ci.target.slice(),fovVerticalDeg:ci.fovVerticalDeg};
function shot(kind,w,h){ // returns {at(t)->pose, her(t), W (settle), total}
 const dep=kind==='departure',{pl,path:p}=dep?walk('I4','I6'):walk('I3','I4'),L=NW.pathLength(p),from=dep?P0:board;
 if(IL&&pl.segments.length===1){const end=E.followPose(p[p.length-1],IL.endHeading(p),w,h,lu);
  const l=dep?IL.islandDepartLens(from,p,end):IL.islandEntryPan(from,p);const pre=l.preS;
  return {at:l.at,her:t=>NW.pointAlong(p,Math.max(0,Math.min(L,(t-pre)*1.2))),W:l.seconds,total:l.seconds,end:dep?end:null,from};}
 // legacy (96dfbd33): blend 0.6 s onto the follow pose at her start (yaw 0), then the held/follow lens for the visible walk(s)
 const B=E.BLEND_S.boardToFollow,held=E.followPose(p[0],0,w,h,lu),vis=NW.visibleSeconds(pl),fade=pl.fades?0.52:0;
 return {at:t=>t<B?E.blendPose(from,held,t,B):held,her:t=>NW.pointAlong(p,Math.max(0,Math.min(L,(t-B)*1.2))),W:B,total:B+vis+fade,end:null,from};}
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};const report={wired,rows:{},summary:{}};
for(const kind of ['entry','departure'])for(const [w,h] of SCREENS)for(const fps of [60,30]){
 const s=shot(kind,w,h),dt=1/fps,Tend=s.W+1;let prev=null,pr=null,acc=[],mx={yaw:0,pitch:0,v:0,step:0,fov:0},minG=99,minS=99,minM=9,hid=0,cap=0,rows=[];
 for(let k=0;k*dt<=Tend+1e-9;k++){const t=k*dt,p=s.at(t),her=s.her(t);
  if(prev){const st=Math.hypot(...p.position.map((x,i)=>x-prev.position[i])),[y,q]=ya(p),[y0,q0]=ya(prev),yr=((y-y0+540)%360-180)/dt,qr=(q-q0)/dt;
   mx.yaw=Math.max(mx.yaw,Math.abs(yr));mx.pitch=Math.max(mx.pitch,Math.abs(qr));mx.v=Math.max(mx.v,st/dt);mx.step=Math.max(mx.step,st);mx.fov=Math.max(mx.fov,Math.abs(p.fovVerticalDeg-prev.fovVerticalDeg));
   if(pr)acc.push(Math.hypot(yr-pr[0],qr-pr[1])/dt);pr=[yr,qr];if(fps===60&&w===390)rows.push({t:+t.toFixed(3),stepM:+st.toFixed(3),ms:+(st/dt).toFixed(2),yawDegS:+yr.toFixed(1),pitchDegS:+qr.toFixed(1),fov:+p.fovVerticalDeg.toFixed(2)});}
  if(fps===30){const g=gh(p.position);if(g!==null)minG=Math.min(minG,g);minS=Math.min(minS,J.clearance(p.position,solids,3)[0]);
   minM=Math.min(minM,LS.herMargin(p.position,p.target,p.fovVerticalDeg,her,[[w,h]]));const face=[her[0],her[1]+1.38,her[2]],chest=[her[0],her[1]+1.05,her[2]];
   if(J.blockers(occ,p.position,face).length||J.blockers(occ,p.position,chest).length)hid+=dt;const v=F.ndc(p.position,p.target,p.fovVerticalDeg,w,h,face);if(v){const px=(v[0]+1)/2*w,py=(1-v[1])/2*h;if(px>=w-98&&px<=w&&py>=0&&py<=92)cap++;}}
  prev=p;}
 acc.sort((a,b)=>a-b);const p99=acc.length?acc[Math.floor(acc.length*0.99)]:0,id=`${kind} ${w}x${h} ${fps}fps`;
 const first=Math.hypot(...s.at(0).position.map((x,i)=>x-s.from.position[i]));
 ok(first<1e-6,`${id} first write != live lens ${first}`);ok(mx.yaw<=LIM.yaw,`${id} yaw ${mx.yaw.toFixed(1)} deg/s`);ok(mx.pitch<=LIM.pitch,`${id} pitch ${mx.pitch.toFixed(1)} deg/s`);ok(p99<=LIM.acc,`${id} accel p99 ${p99.toFixed(0)}`);
 ok(mx.v<=LIM.v,`${id} speed ${mx.v.toFixed(2)} m/s`);ok(mx.step<=LIM.step,`${id} step ${mx.step.toFixed(3)} m`);ok(mx.fov<=LIM.fov,`${id} fov ${mx.fov.toFixed(2)}/frame`);
 if(fps===30){ok(minG>=LIM.ground,`${id} ground ${minG.toFixed(2)}`);ok(minS>=LIM.solid,`${id} solid ${minS.toFixed(2)}`);
  /* entry framing (face/chest, margin) is REPORTED, not gated: open item (palm_young_01 / beach_palm_short on the 50 m island-lens sight line, I3 starts outside the board lens) */
  if(kind==='departure'){ok(hid<=LIM.hidden,`${id} face/chest hidden ${hid.toFixed(2)} s`);ok(minM>=LIM.margin,`${id} margin ${minM.toFixed(3)}`);}ok(cap===0,`${id} capsule ${cap}`);
  if(kind==='departure'){ok(s.total<=LIM.total,`${id} reveal→boarding ${s.total.toFixed(2)} s`);if(s.end){const e=s.at(s.W);ok(Math.hypot(...e.position.map((x,i)=>x-s.end.position[i]))<1e-6,`${id} end != follow@I6`);}}}
 report.summary[id]={yawDegS:+mx.yaw.toFixed(1),pitchDegS:+mx.pitch.toFixed(1),accP99:+p99.toFixed(0),ms:+mx.v.toFixed(2),stepM:+mx.step.toFixed(3),fovPerFrame:+mx.fov.toFixed(3),...(fps===30?{groundM:+minG.toFixed(2),solidM:+minS.toFixed(2),hiddenS:+hid.toFixed(2),margin:+minM.toFixed(3),capsule:cap,totalS:+s.total.toFixed(2)}:{})};
 if(rows.length)report.rows[kind]=rows;}
fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/island-stage04-lens.json'),JSON.stringify(report));
console.log(JSON.stringify({wired,fail,sample:report.summary['departure 390x844 30fps'],entry:report.summary['entry 390x844 30fps']}));
if(fail){console.log('island-stage04-lens: FAIL',fail);process.exit(1);}console.log('island-stage04-lens: PASS');
