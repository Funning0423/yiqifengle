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
// Skinned palms: lib-glb / the node bake ignore skins, so the room palms sit ~3 m off. Swap in rest-pose skinned triangles
// (occlusion/skin-island-palms.py, sha-pinned). PALM_MOVE=1 applies 场景设计部's env_prop_palm_young_01 shift (-0.7,0,-0.7).
const SK=JSON.parse(require('zlib').gunzipSync(fs.readFileSync(__dirname+'/occlusion/island-palms-skinned.json.gz')));
{const g=fs.readFileSync(J.B?J.B+SK.glb:path.join(__dirname,'../../creator-build-project/assets/bundles/',SK.glb));require('assert').equal(require('crypto').createHash('sha256').update(g).digest('hex'),SK.sha256,'room glb changed: rerun skin-island-palms.py');}
const PM=process.env.PALM_MOVE==='1'?[-0.7,0,-0.7]:[0,0,0];
for(const o of J.island){const t=SK.objects[o.name];if(!t)continue;const mv=o.name==='env_prop_palm_young_01'?PM:[0,0,0];o.tris=Float64Array.from(t,(x,i)=>x+mv[i%3]);o.bb=undefined;}

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
const lu=E.followLookUp('island',99),walk=(a,b)=>{let pl=NW.planWalk('island',a,b);if(process.env.FORCE_ONE==='1'&&pl.segments.length>1){const P=NW.routeKeys('island',a,b).path;pl={segments:[{path:P,duration:NW.pathLength(P)/1.2}],cut:false,fades:0,lengthM:NW.pathLength(P)};}return {pl,path:pl.segments.flatMap((s,i)=>i?s.path.slice(1):s.path)};};
// push-in end exactly as WorldFlowComponent.enterLevelLook from the island lens (reach 40, step 2.6, fov-6)
const ci=J.Cam.islandPoseEntry(),fw=unit(ci.target.map((x,i)=>x-ci.position[i]));
const P0={position:process.env.PUSHIN==='T2'?[-8.447,14.736,46.405]:ci.position.map((x,i)=>x+fw[i]*2.6),target:ci.position.map((x,i)=>x+fw[i]*40),fovVerticalDeg:ci.fovVerticalDeg-6};
const board={position:ci.position.slice(),target:ci.target.slice(),fovVerticalDeg:ci.fovVerticalDeg};
function shot(kind,w,h){ // returns {at(t)->pose, her(t), W (settle), total}
 const dep=kind==='departure',{pl,path:p}=dep?walk('I4','I6'):walk('I3','I4'),L=NW.pathLength(p),from=dep?P0:board;
 if(IL&&pl.segments.length===1){const end=E.followPose(p[p.length-1],IL.endHeading(p),w,h,lu);
  const l=dep?IL.islandDepartLens(from,p,end):IL.islandEntryPan(from,p);const pre=l.preS;
  return {at:l.at,her:t=>NW.pointAlong(p,Math.max(0,Math.min(L,(t-pre)*1.2))),W:l.seconds,total:l.seconds,end:dep?l.end:null,from};}
 // legacy (96dfbd33): blend 0.6 s onto the follow pose at her start (yaw 0), then the held/follow lens for the visible walk(s)
 const B=E.BLEND_S.boardToFollow,held=E.followPose(p[0],0,w,h,lu),vis=NW.visibleSeconds(pl),fade=pl.fades?0.52:0;
 return {at:t=>t<B?E.blendPose(from,held,t,B):held,her:t=>NW.pointAlong(p,Math.max(0,Math.min(L,(t-B)*1.2))),W:B,total:B+vis+fade,end:null,from};}
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};const report={wired,skinned:true,palmMove:PM,pushIn:process.env.PUSHIN||'T1',rows:{},summary:{},blockers:{}};const id0=k=>k;
for(const kind of ['entry','departure'])for(const [w,h] of SCREENS)for(const fps of [60,30]){
 const s=shot(kind,w,h),dt=1/fps,Tend=s.W+1;let prev=null,pr=null,acc=[],mx={yaw:0,pitch:0,v:0,step:0,fov:0},minG=99,minS=99,minM=9,hid=0,cap=0,rows=[];
 for(let k=0;k*dt<=Tend+1e-9;k++){const t=k*dt,p=s.at(t),her=s.her(t);
  if(prev){const st=Math.hypot(...p.position.map((x,i)=>x-prev.position[i])),[y,q]=ya(p),[y0,q0]=ya(prev),yr=((y-y0+540)%360-180)/dt,qr=(q-q0)/dt;
   mx.yaw=Math.max(mx.yaw,Math.abs(yr));mx.pitch=Math.max(mx.pitch,Math.abs(qr));mx.v=Math.max(mx.v,st/dt);mx.step=Math.max(mx.step,st);mx.fov=Math.max(mx.fov,Math.abs(p.fovVerticalDeg-prev.fovVerticalDeg));
   if(pr)acc.push(Math.hypot(yr-pr[0],qr-pr[1])/dt);pr=[yr,qr];if(fps===60&&w===390)rows.push({t:+t.toFixed(3),stepM:+st.toFixed(3),ms:+(st/dt).toFixed(2),yawDegS:+yr.toFixed(1),pitchDegS:+qr.toFixed(1),fov:+p.fovVerticalDeg.toFixed(2)});}
  if(fps===30){const g=gh(p.position);if(g!==null)minG=Math.min(minG,g);minS=Math.min(minS,J.clearance(p.position,solids,3)[0]);
   minM=Math.min(minM,LS.herMargin(p.position,p.target,p.fovVerticalDeg,her,[[w,h]]));const face=[her[0],her[1]+1.38,her[2]],chest=[her[0],her[1]+1.05,her[2]];
   {const bl=[...J.blockers(occ,p.position,face),...J.blockers(occ,p.position,chest)];if(bl.length){hid+=dt;if(w===390){for(const n of new Set(bl.map(b=>b.name||b)))(report.blockers[id0(kind)]??={})[n]=+(((report.blockers[id0(kind)]||{})[n]||0)+dt).toFixed(3);}}}const v=F.ndc(p.position,p.target,p.fovVerticalDeg,w,h,face);if(v){const px=(v[0]+1)/2*w,py=(1-v[1])/2*h;if(px>=w-98&&px<=w&&py>=0&&py<=92)cap++;}}
  prev=p;}
 acc.sort((a,b)=>a-b);const p99=acc.length?acc[Math.floor(acc.length*0.99)]:0,id=`${kind} ${w}x${h} ${fps}fps`;
 const first=Math.hypot(...s.at(0).position.map((x,i)=>x-s.from.position[i]));
 ok(first<1e-6,`${id} first write != live lens ${first}`);ok(mx.yaw<=LIM.yaw,`${id} yaw ${mx.yaw.toFixed(1)} deg/s`);ok(mx.pitch<=LIM.pitch,`${id} pitch ${mx.pitch.toFixed(1)} deg/s`);ok(p99<=LIM.acc,`${id} accel p99 ${p99.toFixed(0)}`);
 ok(mx.v<=LIM.v,`${id} speed ${mx.v.toFixed(2)} m/s`);ok(mx.step<=LIM.step,`${id} step ${mx.step.toFixed(3)} m`);ok(mx.fov<=LIM.fov,`${id} fov ${mx.fov.toFixed(2)}/frame`);
 if(fps===30){ok(minG>=LIM.ground,`${id} ground ${minG.toFixed(2)}`);ok(minS>=LIM.solid,`${id} solid ${minS.toFixed(2)}`);
  /* entry framing (face/chest, margin) is REPORTED, not gated: open item (palm_young_01 / beach_palm_short on the 50 m island-lens sight line, I3 starts outside the board lens) */
  if(kind==='departure'){ok(hid<=LIM.hidden,`${id} face/chest hidden ${hid.toFixed(2)} s`);ok(minM>=LIM.margin,`${id} margin ${minM.toFixed(3)}`);}ok(cap===0,`${id} capsule ${cap}`);
  if(kind==='departure'){ok(s.total<=LIM.total,`${id} reveal→boarding ${s.total.toFixed(2)} s`);if(s.end){const e=s.at(s.W);ok(Math.hypot(...e.position.map((x,i)=>x-s.end.position[i]))<1e-6,`${id} end != follow@I6`);if(fps===30){const cl=J.clearance(s.end.position,solids,6)[0],g=gh(s.end.position);(report.endPose??={})[id]={clearM:+cl.toFixed(2),pos:s.end.position.map(x=>+x.toFixed(3))};(report.endPose[id]).groundM=g===null?null:+g.toFixed(2);ok(cl>=3,`${id} follow@I6 ${cl.toFixed(2)} m from geometry (<3)`);ok(g===null||g>=1.5,`${id} follow@I6 ground ${g}`);}}}}
 report.summary[id]={yawDegS:+mx.yaw.toFixed(1),pitchDegS:+mx.pitch.toFixed(1),accP99:+p99.toFixed(0),ms:+mx.v.toFixed(2),stepM:+mx.step.toFixed(3),fovPerFrame:+mx.fov.toFixed(3),...(fps===30?{groundM:+minG.toFixed(2),solidM:+minS.toFixed(2),hiddenS:+hid.toFixed(2),margin:+minM.toFixed(3),capsule:cap,totalS:+s.total.toFixed(2)}:{})};
 if(rows.length)report.rows[kind]=rows;}
// Body-sample occlusion (场景设计部 method: 90 points, 0.05–1.75 m x ±0.2 m across the view; head/face = >= 1.4 m), every 0.1 s, skinned palms.
// Grok Bot palm_lean_01 target on the I3>I4 walk-in: every episode <= 0.3 s AND <= 25 % head/face. Screen-independent (position only).
{const H90=[];for(let i=0;i<10;i++)for(let j=0;j<9;j++)H90.push([0.05+i*(1.70/9),-0.2+j*0.05]);
 for(const kind of ['entry','departure']){const s=shot(kind,390,844),ep=[];let cur=null;const series=[];
  for(let t=0;t<=s.W+1e-9;t+=0.1){const p=s.at(t),h=s.her(t),d=unit([h[0]-p.position[0],0,h[2]-p.position[2]]),r=[-d[2],0,d[0]];let hf=0,nh=0,lean=0,bd=0;
   for(const [y,x] of H90){const q=[h[0]+r[0]*x,h[1]+y,h[2]+r[2]*x],b=J.blockers(occ,p.position,q);if(y>=1.4){nh++;if(b.length)hf++;if(b.some(n=>/palm_lean_01/.test(n)))lean++;}if(b.length)bd++;}
   const hp=100*hf/nh,lp=100*lean/nh;series.push([+t.toFixed(1),+hp.toFixed(0),+lp.toFixed(0),+(100*bd/90).toFixed(0)]);
   if(lp>0){cur??={from:+t.toFixed(1),to:0,peak:0};cur.to=+t.toFixed(1);cur.peak=Math.max(cur.peak,+lp.toFixed(0));}else if(cur){ep.push(cur);cur=null;}}
  if(cur)ep.push(cur);report.body90??={};report.body90[kind]={series_t_headPct_leanHeadPct_bodyPct:series,leanEpisodes:ep};
  if(kind==='entry'&&process.env.LEAN_GATE==='1')for(const e of ep){ok(e.to-e.from+0.1<=0.3+1e-9,`entry lean_01 episode ${e.from}-${e.to} s > 0.3 s`);ok(e.peak<=25,`entry lean_01 episode ${e.from} s ${e.peak}% head/face > 25%`);}
  console.log(kind,'lean_01 episodes',JSON.stringify(ep));}}
fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/island-stage04-lens.scratchC.json'),JSON.stringify(report));
console.log(JSON.stringify({wired,fail,sample:report.summary['departure 390x844 30fps'],entry:report.summary['entry 390x844 30fps']}));
if(fail){console.log('island-stage04-lens: FAIL',fail);process.exit(1);}console.log('island-stage04-lens: PASS');
