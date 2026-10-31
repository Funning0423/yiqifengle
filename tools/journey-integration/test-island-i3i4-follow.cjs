'use strict';
// 运镜bot b21: island I3>I4 FOLLOW lens on the rerouted walk (场景设计部 dc69e994, last via (2.7,4.9)). Lens per frame = the runtime
// FollowWalk writer (RegionNodeStage.tick: occlude(followPose(girl,yaw,w,h,0),dt) = LensGuard.apply(..., ISLAND_LENS_OCCLUDERS, nudge off))
// after the 0.6 s board->held blend (held = LensGuard.solveStatic). Her walk = planWalk at WALK_SPEED_MPS, heading = (a) path heading
// smoothed +-0.3 m, (b) the same rate-limited to 360 deg/s (turn clip lag). Frames: 60 fps, 30 fps, uneven LCG dt [1/90,1/45]; window =
// walk + 0.5 s after. 7 screens. Gates (Grok Bot, never relaxed): face (1.38 m) blocked <= 0.5 s total by any occluder (skinned palms,
// lighthouse, props/vegetation); body margin >= 0.08 (LensSmooth.herMargin); face never under the WeChat menu (boardSafeInsets capsule);
// body not under HUD bands; lens >= 1.5 m over ground, >= 0.5 m from solids; walk path >= 1 m from solids >= 0.3 m tall (report: route
// owner); speed <= 8 m/s, step <= 0.5 m, yaw/pitch <= 90 deg/s, turn accel p99 <= 200 deg/s^2, fov <= 1.5 deg/frame, no cut; one writer.
// SELFTEST=1 reruns with LENS_OVERRIDE (env JSON of FOLLOW overrides) to prove the gate can fail. Report: reports/island-i3i4-follow.json.
const fs=require('fs'),path=require('path');const J=require('./journey-scene.cjs');const {H,S}=J;
const E=H.load(S+'region/ExploreCameraCore.ts'),NW=H.load(S+'region/NodeWalker.ts'),OC=H.load(S+'region/LensOcclusion.ts'),IX=H.load(S+'region/IslandLensOccluders.ts'),
 LS=H.load(S+'region/LensSmooth.ts'),F=H.load(S+'region/SkyFinaleShot.ts'),BL=H.load(S+'ui/BoardLayout.ts');
const boxes=IX.ISLAND_LENS_OCCLUDERS.map(r=>({min:[r[0],r[1],r[2]],max:[r[3],r[4],r[5]]}));
const occ=J.island.filter(o=>!/seagull|smoke|beam|glow|glass/.test(o.name)),ground=J.island.filter(o=>/env_island_main/.test(o.name)),
 solids=J.island.filter(o=>!/env_island_main|seagull|smoke|beam|glow|glass|wet_sand|tide|shells|crab|turtle|cat/.test(o.name));
for(const o of solids)o.bb??=J.bbox(o.tris);const tall=solids.filter(o=>o.bb[1][1]-o.bb[0][1]>=0.3);
const gh=p=>{let b=null;for(const o of ground){o.bb??=J.bbox(o.tris);if(p[0]<o.bb[0][0]||p[0]>o.bb[1][0]||p[2]<o.bb[0][2]||p[2]>o.bb[1][2])continue;const t=J.rayHit(p,[0,-1,0],200,o.tris);if(t!==null&&(b===null||t<b))b=t;}return b;};
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]].filter(([w,h])=>!process.env.SCREENS||process.env.SCREENS.split(',').includes(w+'x'+h));
const FHO=process.env.FH_OVERRIDE?JSON.parse(process.env.FH_OVERRIDE):undefined;
const LIM={face:0.5,margin:0.08,ground:1.5,solid:0.5,walk:1.0,v:8,step:0.5,yaw:90,pitch:90,acc:200,fov:1.5};
const WALK=process.env.WALK||'I3>I4',OUT=process.env.OUT||'reports/island-i3i4-follow.json';
const RNS=fs.readFileSync(S+'world-r2/RegionNodeStage.ts','utf8'),wired=!!E.FollowHeading&&/this\.region==='island'&&this\.followHeading\?this\.followHeading\.step\(this\.yaw\(\),dt\)/.test(RNS)&&/this\.lens='FollowWalk';this\.followHeading\?\.seed\(this\.yaw\(\)\)/.test(RNS);
const useFH=wired&&process.env.FOLLOW_HEADING!=='raw';
const ov=process.env.LENS_OVERRIDE?JSON.parse(process.env.LENS_OVERRIDE):null;if(ov)Object.assign(E.FOLLOW,ov);
const [A,B]=WALK.split('>'),pl=NW.planWalk('island',A,B),P=pl.segments.flatMap((s,i)=>i?s.path.slice(1):s.path),L=NW.pathLength(P),V=NW.WALK_SPEED_MPS,T=L/V;
const hd=d=>{const q=NW.pointAlong(P,Math.max(0,d-0.3)),r=NW.pointAlong(P,Math.min(L,d+0.3));return Math.atan2(r[0]-q[0],r[2]-q[2]);};
const wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
const dts=mode=>{const out=[];let t=0,x=12345;while(t<=0.6+T+0.5){const dt=mode===60?1/60:mode===30?1/30:(x=(Math.imul(1664525,x)+1013904223)>>>0,1/90+(1/45-1/90)*(x/4294967296));out.push(dt);t+=dt;}return out;};
const ang=p=>{const f=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(...f);return [Math.atan2(f[0],f[2])*180/Math.PI,Math.asin(f[1]/l)*180/Math.PI];};
// walk-path clearance (route property, scene owner)
let walkMin=9,walkWho=null;for(let d=0;d<=L;d+=0.05){const q=NW.pointAlong(P,d);for(const y of [0.15,0.6,1.2]){const [c,w]=J.clearance([q[0],q[1]+y,q[2]],tall,3);if(c<walkMin){walkMin=c;walkWho=w&&(w.name||w);}}}
const report={wired,followHeading:useFH,walk:WALK,lengthM:+L.toFixed(3),walkS:+T.toFixed(3),override:ov,walkClearM:+walkMin.toFixed(3),walkClearWho:walkWho,screens:{}};let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};
const keyT=[5.4,6.1,7.4];
for(const [w,h] of SCREENS){const safe=BL.boardSafeInsets(w,h),cap=safe.capsule,hudTop=cap?cap.bottom+8:safe.top+44,hudBot=h-(safe.bottom+80);const sc={};report.screens[w+'x'+h]=sc;
 for(const mode of (process.env.MODES?process.env.MODES.split(',').map(x=>x==='lcg'?x:+x):[60,30,'lcg']))for(const hm of ['path','rate']){const id=`${w}x${h} ${mode} ${hm}`;const g=new OC.LensGuard(),her0=NW.pointAlong(P,0);let yawS=hd(0);const fh=useFH?new E.FollowHeading():null;if(fh)fh.seed(yawS);let herYaw=yawS;
  const held=g.solveStatic(E.followPose(her0,yawS,w,h,0),her0,boxes);g.reset();
  let t=0,prev=null,pr=null,acc=[],mx={v:0,step:0,yaw:0,pitch:0,fov:0},face=0,run=0,maxRun=0,blk={},minM=9,minMt=0,menu=0,hud=0,minG=99,minS=99,writers=0,rows=[],shots={};
  for(const dt of dts(mode)){t+=dt;const d=Math.max(0,Math.min(L,(t-0.6)*V)),her=NW.pointAlong(P,d);
   const tgt=hd(d);herYaw=hm==='path'?tgt:herYaw+Math.max(-2*Math.PI*dt,Math.min(2*Math.PI*dt,wrap(tgt-herYaw)));yawS=t<0.6?herYaw:fh?fh.step(herYaw,dt,FHO?{...E.FOLLOW_HEADING,...FHO}:undefined):herYaw;
   let pose;writers=1;if(t<0.6)pose=held;else pose=g.apply(E.followPose(her,yawS,w,h,0),her,boxes,dt,undefined,undefined,false,0,false);
   if(prev){const st=Math.hypot(...pose.position.map((x,i)=>x-prev.position[i])),[y,q]=ang(pose),[y0,q0]=ang(prev),yr=((y-y0+540)%360-180)/dt,qr=(q-q0)/dt;
    mx.step=Math.max(mx.step,st);mx.v=Math.max(mx.v,st/dt);mx.yaw=Math.max(mx.yaw,Math.abs(yr));mx.pitch=Math.max(mx.pitch,Math.abs(qr));mx.fov=Math.max(mx.fov,Math.abs(pose.fovVerticalDeg-prev.fovVerticalDeg));
    if(pr)acc.push(Math.hypot(yr-pr[0],qr-pr[1])/dt);pr=[yr,qr];}
   prev={position:pose.position.slice(),target:pose.target.slice(),fovVerticalDeg:pose.fovVerticalDeg};
   if(t<0.6)continue;const tw=t-0.6;
   const fc=[her[0],her[1]+1.38,her[2]],fb=J.blockers(occ,pose.position,fc);
   if(fb.length){face+=dt;run+=dt;maxRun=Math.max(maxRun,run);for(const n of fb)blk[n]=+((blk[n]||0)+dt).toFixed(3);}else run=0;
   const m=LS.herMargin(pose.position,pose.target,pose.fovVerticalDeg,her,[[w,h]]);if(m<minM){minM=m;minMt=tw;}
   const px=v=>v?[(v[0]+1)/2*w,(1-v[1])/2*h]:null,pf=px(F.ndc(pose.position,pose.target,pose.fovVerticalDeg,w,h,fc)),ph=px(F.ndc(pose.position,pose.target,pose.fovVerticalDeg,w,h,[her[0],her[1]+1.65,her[2]])),pt=px(F.ndc(pose.position,pose.target,pose.fovVerticalDeg,w,h,[her[0],her[1]+0.05,her[2]]));
   if(cap&&pf&&pf[0]>=cap.left-6&&pf[0]<=cap.right+6&&pf[1]>=cap.top-6&&pf[1]<=cap.bottom+6)menu+=dt;
   if(ph&&pt&&(ph[1]<hudTop||pt[1]>hudBot))hud+=dt;
   const gg=gh(pose.position);if(gg!==null)minG=Math.min(minG,gg);minS=Math.min(minS,J.clearance(pose.position,solids,3)[0]);
   if(mode===30&&w===390&&h===844)rows.push([+tw.toFixed(3),...pose.position.map(x=>+x.toFixed(3)),...pose.target.map(x=>+x.toFixed(3)),+pose.fovVerticalDeg.toFixed(2),...her.map(x=>+x.toFixed(3)),yawS,fb.length?1:0]);
   if(mode===30&&hm==='path')for(const k of [1,3,keyT[0],keyT[1],keyT[2]])if(!shots[k]&&tw>=k-1e-6)shots[k]={t:+tw.toFixed(3),position:pose.position,target:pose.target,fov:pose.fovVerticalDeg,her,blk:fb};}
  acc.sort((a,b)=>a-b);const p99=acc.length?acc[Math.floor(acc.length*0.99)]:0;
  const r={faceS:+face.toFixed(3),faceRunS:+maxRun.toFixed(3),blockers:blk,minMargin:+minM.toFixed(3),minMarginAt:+minMt.toFixed(2),menuS:+menu.toFixed(3),hudS:+hud.toFixed(3),groundM:+minG.toFixed(2),solidM:+minS.toFixed(2),
   speed:+mx.v.toFixed(2),step:+mx.step.toFixed(3),yaw:+mx.yaw.toFixed(1),pitch:+mx.pitch.toFixed(1),accP99:+p99.toFixed(0),fov:+mx.fov.toFixed(3),writers};if(Object.keys(shots).length)r.shots=shots;if(rows.length)r.rows=rows;sc[mode+' '+hm]=r;
  ok(face<=LIM.face+1e-9,`${id} face blocked ${face.toFixed(2)} s ${JSON.stringify(blk)}`);ok(minM>=LIM.margin,`${id} margin ${minM.toFixed(3)} @${minMt.toFixed(2)}`);ok(menu===0,`${id} face under menu ${menu.toFixed(2)} s`);
  ok(hud===0,`${id} body under HUD ${hud.toFixed(2)} s`);ok(minG>=LIM.ground,`${id} ground ${minG.toFixed(2)}`);ok(minS>=LIM.solid,`${id} solid ${minS.toFixed(2)}`);
  ok(mx.v<=LIM.v,`${id} speed ${mx.v.toFixed(2)}`);ok(mx.step<=LIM.step,`${id} step ${mx.step.toFixed(3)}`);ok(mx.yaw<=LIM.yaw&&mx.pitch<=LIM.pitch,`${id} yaw/pitch ${mx.yaw.toFixed(1)}/${mx.pitch.toFixed(1)}`);
  ok(p99<=LIM.acc,`${id} accel p99 ${p99.toFixed(0)}`);ok(mx.fov<=LIM.fov,`${id} fov ${mx.fov.toFixed(2)}`);ok(writers===1,`${id} writers ${writers}`);}}
if(!(walkMin>=LIM.walk))console.log(`NOTE walk path clearance ${walkMin.toFixed(3)} m < 1 m (${walkWho}) — route (场景设计部), not a camera gate`);
fs.mkdirSync(path.dirname(path.join(__dirname,OUT)),{recursive:true});fs.writeFileSync(path.join(__dirname,OUT),JSON.stringify(report));
for(const [k,s] of Object.entries(report.screens)){const v=Object.values(s);const M=f=>Math.max(...v.map(f)),N=f=>Math.min(...v.map(f));
 console.log(k,JSON.stringify({face:M(x=>x.faceS),margin:N(x=>x.minMargin),menu:M(x=>x.menuS),hud:M(x=>x.hudS),ground:N(x=>x.groundM),solid:N(x=>x.solidM),v:M(x=>x.speed),step:M(x=>x.step),yaw:M(x=>x.yaw),pitch:M(x=>x.pitch),acc:M(x=>x.accP99),fov:M(x=>x.fov)}));}
console.log('walk',WALK,report.lengthM,'m',report.walkS,'s walkClear',report.walkClearM,walkWho);
if(fail){console.log('island-i3i4-follow: FAIL',fail);process.exit(1);}console.log('island-i3i4-follow: PASS');
