'use strict';
// 运镜bot b20 r2: island stage BOARD lens = the enter-level push-in end (WorldFlowComponent.enterLevelLook from the live island lens,
// kept under the board; the next reward walk reads it back as frame 0). With islandBoardAim the end pose turns its aim so she (standing
// on the stage node, read from REGION_NODES, so a node move re-checks) is >= 0.08 inside on all 7 screens. Also gates the push-in
// itself (createPathSampler, easeIn 0.14 / easeOut 0.4 over ENTER_LEVEL_SHOT_S) per real dt at 60 and 30 fps.
// Wiring: WorldFlowComponent source, else the outbox diff applied to a temp copy (wired:"outbox-diff"); unwired = today's push-in (FAIL on I3).
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');const J=require('./journey-scene.cjs');const {H,S}=J;
const LS=H.load(S+'region/LensSmooth.ts'),F=H.load(S+'region/SkyFinaleShot.ts'),CP=H.load(S+'world-r1/CameraPose.ts'),WC=H.load(S+'world-r1/WorldFlowCore.ts'),RN=H.load(S+'region/RegionNodes.ts');
const DIFF=path.join(__dirname,'../../team/cinematic/outbox/20261030-l04-lens-r2/WFC-island-board-aim.diff'),REL='creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts';
const re=t=>/islandBoardAim\(end,\[w\.x,w\.y,w\.z\],vs\.width,vs\.height\)/.test(t)&&/s\?\.stable==='island'/.test(t);
let src=fs.readFileSync(S+'world-r1/WorldFlowComponent.ts','utf8'),wired=re(src)?true:false;
if(!wired&&fs.existsSync(DIFF)){const d=fs.mkdtempSync(path.join(os.tmpdir(),'wfc-'));try{fs.mkdirSync(path.join(d,path.dirname(REL)),{recursive:true});fs.writeFileSync(path.join(d,REL),src);
 cp.execFileSync('git',['apply',DIFF],{cwd:d,stdio:'pipe'});if(re(fs.readFileSync(path.join(d,REL),'utf8')))wired='outbox-diff';}catch(e){console.log('WFC diff does not apply',String(e.stderr||e).slice(0,200));}finally{fs.rmSync(d,{recursive:true,force:true});}}
const IL=wired?H.load(S+'region/IslandStageLens.ts'):null;
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const LIM={yaw:90,pitch:90,acc:200,v:8,step:0.5,fov:1.5,ground:1.5,solid:0.5,margin:0.08};
const occ=J.island.filter(o=>!/seagull|smoke|beam|glow|glass/.test(o.name)),ground=J.island.filter(o=>/env_island_main/.test(o.name)),
 solids=J.island.filter(o=>!/env_island_main|seagull|smoke|beam|glow|glass|wet_sand|tide|shells|crab|turtle|cat/.test(o.name));
const gh=p=>{let b=null;for(const o of ground){o.bb??=J.bbox(o.tris);if(p[0]<o.bb[0][0]||p[0]>o.bb[1][0]||p[2]<o.bb[0][2]||p[2]>o.bb[1][2])continue;const t=J.rayHit(p,[0,-1,0],200,o.tris);if(t!==null&&(b===null||t<b))b=t;}return b;};
// enterLevelLook, verbatim maths (reach 40, step 2.6, fov -6 clamped) from the live island lens
const ci=J.Cam.islandPoseEntry(),u=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},fw=u(ci.target.map((x,i)=>x-ci.position[i])),clamp=f=>Math.min(CP.CAMERA_FIXED.maxFov,Math.max(CP.CAMERA_FIXED.minFov,f));
const live={position:ci.position.slice(),target:ci.position.map((x,i)=>x+fw[i]*40),fovVerticalDeg:clamp(ci.fovVerticalDeg)},end0={position:ci.position.map((x,i)=>x+fw[i]*2.6),target:live.target.slice(),fovVerticalDeg:clamp(ci.fovVerticalDeg-6)};
const boardLens=(her,w,h)=>IL?IL.islandBoardAim(end0,her,w,h):end0;
const nodes=RN.REGION_NODES.island.nodes.filter(n=>n.role==='mainline');
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};const report={wired,live,end0,nodes:{},push:{}};
const fwd=q=>CP.rotate(q,[0,0,-1]),ya=q=>{const d=fwd(q);return [Math.atan2(d[0],-d[2])*180/Math.PI,Math.asin(Math.max(-1,Math.min(1,d[1])))*180/Math.PI];};
for(const n of nodes){const her=n.at,face=[her[0],her[1]+1.38,her[2]],chest=[her[0],her[1]+1.05,her[2]];report.nodes[n.key]={at:her,screens:{}};
 for(const [w,h] of SCREENS){const b=boardLens(her,w,h),m=LS.herMargin(b.position,b.target,b.fovVerticalDeg,her,[[w,h]]),m0=LS.herMargin(end0.position,end0.target,end0.fovVerticalDeg,her,[[w,h]]);
  const turn=Math.acos(Math.max(-1,Math.min(1,u(b.target.map((x,i)=>x-b.position[i])).reduce((s,x,i)=>s+x*fw[i],0))))*180/Math.PI;
  const v=F.ndc(b.position,b.target,b.fovVerticalDeg,w,h,face);let cap=false;if(v){const px=(v[0]+1)/2*w,py=(1-v[1])/2*h;cap=px>=w-98&&px<=w&&py>=0&&py<=92;}
  const hidden=J.blockers(occ,b.position,face).length>0;
  report.nodes[n.key].screens[w+'x'+h]={marginBefore:+m0.toFixed(3),marginAfter:+m.toFixed(3),aimTurnDeg:+turn.toFixed(2),target:b.target.map(x=>+x.toFixed(3)),capsule:cap,faceHidden:hidden};
  ok(m>=LIM.margin,`${n.key} ${w}x${h} board margin ${m.toFixed(3)} < ${LIM.margin}`);ok(!cap,`${n.key} ${w}x${h} menu button over her face`);
  if(m0>=0.10)ok(turn<1e-6,`${n.key} ${w}x${h} board lens changed although she was framed (${turn.toFixed(3)} deg)`);
  // push-in (live -> board) through the real sampler
  const smp=CP.createPathSampler([live,b],[undefined,undefined],{easeIn:0.14,easeOut:0.4});
  for(const fps of [60,30]){const dt=1/fps,N=Math.ceil(WC.ENTER_LEVEL_SHOT_S*fps);let prev=null,pr=null,acc=[],mx={yaw:0,pitch:0,v:0,step:0,fov:0},minG=99,minS=99;
   for(let k=0;k<=N;k++){const p=smp(Math.min(1,k/N),live.fovVerticalDeg);
    if(prev){const st=Math.hypot(...p.position.map((x,i)=>x-prev.position[i])),[y,q]=ya(p.rotation),[y0,q0]=ya(prev.rotation),yr=((y-y0+540)%360-180)/dt,qr=(q-q0)/dt;
     mx.yaw=Math.max(mx.yaw,Math.abs(yr));mx.pitch=Math.max(mx.pitch,Math.abs(qr));mx.v=Math.max(mx.v,st/dt);mx.step=Math.max(mx.step,st);mx.fov=Math.max(mx.fov,Math.abs(p.fovVerticalDeg-prev.fovVerticalDeg));if(pr)acc.push(Math.hypot(yr-pr[0],qr-pr[1])/dt);pr=[yr,qr];}
    const g=gh(p.position);if(g!==null)minG=Math.min(minG,g);minS=Math.min(minS,J.clearance(p.position,solids,3)[0]);prev=p;}
   acc.sort((a,b)=>a-b);const p99=acc.length?acc[Math.floor(acc.length*0.99)]:0,id=`${n.key} ${w}x${h} ${fps}fps`;
   ok(mx.yaw<=LIM.yaw&&mx.pitch<=LIM.pitch,`${id} yaw/pitch ${mx.yaw.toFixed(1)}/${mx.pitch.toFixed(1)}`);ok(p99<=LIM.acc,`${id} accel p99 ${p99.toFixed(0)}`);ok(mx.v<=LIM.v,`${id} speed ${mx.v.toFixed(2)}`);
   ok(mx.step<=LIM.step,`${id} step ${mx.step.toFixed(3)}`);ok(mx.fov<=LIM.fov,`${id} fov ${mx.fov.toFixed(2)}/frame`);ok(minG>=LIM.ground,`${id} ground ${minG}`);ok(minS>=LIM.solid,`${id} solid ${minS}`);
   report.push[id]={yawDegS:+mx.yaw.toFixed(1),pitchDegS:+mx.pitch.toFixed(1),accP99:+p99.toFixed(0),ms:+mx.v.toFixed(2),stepM:+mx.step.toFixed(3),fovPerFrame:+mx.fov.toFixed(3),groundM:+minG.toFixed(2),solidM:+minS.toFixed(2)};}}}
fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/island-board-lens.json'),JSON.stringify(report,null,1));
console.log(JSON.stringify({wired,fail,I3:report.nodes.I3&&Object.fromEntries(Object.entries(report.nodes.I3.screens).map(([k,v])=>[k,[v.marginBefore,v.marginAfter,v.aimTurnDeg]]))}));
if(fail){console.log('island-board-lens: FAIL',fail);process.exit(1);}console.log('island-board-lens: PASS');
