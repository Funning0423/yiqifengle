#!/usr/bin/env node
'use strict';
/** 运镜bot b20 meadow-board-lens (Grok Bot acceptance, Oct 30). 场景设计部 moved M1–M3 (3fb967af); the one shared board lens on M1
 *  put her stage-06 feet off-screen on 390×844 (x ≈ −16 pt). Each meadow board 05–08 must frame its own node:
 *   A. 7 screens × 05–08: her whole box on screen, ≥ 8 pt from every edge, clear of the board UI (≥ GIRL_STAND.minGapPt) and of the
 *      WeChat capsule; node in front of the lens; line of sight to feet / face / crown clear; lens ≥ 1.5 m over ground (r 0.5 m)
 *      and ≥ 0.5 m from solids.
 *   B. 05 is the reviewed pose of 3fb967af, unchanged, on every screen ≥ 390 pt wide (narrow screens: room edge 6 → 10 pt for the 8 pt rule).
 *   C. board→follow / follow→board blends folded into the reward walk (RegionNodeStage.meadowRewardFold, no pause): per real dt (60 fps, 30 fps, jitter) on 7 screens,
 *      speed ≤ 8 m/s, step ≤ 0.5 m, yaw / pitch ≤ 90°/s, angular acc p99 ≤ 200°/s², FOV ≤ 1.5°/frame; lens path clearance as A.
 *   D. wiring: the stage reaches the lens (level entry + reward walk), the follow→board blend ends on that stage's lens.
 *  On 3fb967af (no MeadowStageLens) this FAILs at A (06 off-screen) and C. */
const fs=require('node:fs'),path=require('node:path');
const {load,ROOT}=require('../region-nodes/load.cjs');
const RB=load('region/RegionBoardLanding.ts'),BL=load('ui/BoardLayout.ts'),N=load('region/RegionNodes.ts'),EC=load('region/ExploreCameraCore.ts');
const GEO=require('./meadow-lens-geo.cjs');
let SL=null;try{SL=load('region/MeadowStageLens.ts');}catch{SL=null;}
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]],STAGES=[['mainline-05','M1'],['mainline-06','M2'],['mainline-07','M3'],['mainline-08','M4']];
const EDGE_PT=8,GROUND_M=1.5,SOLID_M=0.5,CAP={mps:8,step:.5,degS:90,degS2:200,fovFrame:1.5};
const node=k=>N.REGION_NODES.meadow.nodes.find(n=>n.key===k).at;
const fails=[],report={stages:{},blends:[]};
const setStage=s=>{if(SL)SL.setMeadowBoardStage(s);};
const lens=(w,h,s)=>{setStage(s);return RB.meadowBoardCamera(w,h);};
RB.setMeadowBoardFraming('A');
const H=1.7253,face=f=>[f[0],f[1]+1.55,f[2]];
for(const [w,h] of SCREENS){const k=w+'x'+h,safe=BL.boardSafeInsets(w,h),ui=RB.girlStandUi(w,h,safe);report.stages[k]={};
 for(const [st,n] of STAGES){const cam=lens(w,h,st),b=RB.girlBoxPt(cam,node(n),w,h),r={};report.stages[k][st]=r;
  r.position=cam.position.map(x=>+x.toFixed(3));r.target=cam.target.map(x=>+x.toFixed(3));r.fov=+cam.fovVerticalDeg.toFixed(3);
  if(!b){fails.push(`${k} ${st} ${n} behind the lens`);continue;}
  r.box=[b.l,b.t,b.r,b.b].map(x=>+x.toFixed(1));r.edgePt=+Math.min(b.l,w-b.r,b.t,h-b.b).toFixed(1);
  r.margin=+Math.min(b.l/w,(w-b.r)/w,b.t/h,(h-b.b)/h).toFixed(3);
  if(!(r.edgePt>=EDGE_PT))fails.push(`${k} ${st} ${n} ${r.edgePt} pt from the screen edge (< ${EDGE_PT})`);
  let gap=Infinity;for(const q of ui){const ox=Math.min(b.r,q.r)-Math.max(b.l,q.l),oy=Math.min(b.b,q.b)-Math.max(b.t,q.t);gap=ox>0&&oy>0?-1:Math.min(gap,Math.hypot(Math.max(q.l-b.r,b.l-q.r,0),Math.max(q.t-b.b,b.t-q.b,0)));}
  r.uiGapPt=+gap.toFixed(1);if(gap<RB.GIRL_STAND.minGapPt)fails.push(`${k} ${st} UI gap ${gap.toFixed(1)} pt`);
  const c=safe.capsule;r.capsule=!!(c&&b.r>c.left&&b.l<c.right&&b.t<c.bottom&&b.b>c.top);if(r.capsule)fails.push(`${k} ${st} WeChat capsule over her`);
  const g=GEO.groundClear(cam.position),s=GEO.solidClear(cam.position);r.groundM=+g.toFixed(2);r.solidM=+s.d.toFixed(2);
  if(!(g>=GROUND_M))fails.push(`${k} ${st} lens ${g.toFixed(2)} m over ground`);if(!(s.d>=SOLID_M))fails.push(`${k} ${st} lens ${s.d.toFixed(2)} m from ${s.name}`);
  const f=node(n);for(const [nm,p] of [['feet',[f[0],f[1]+.05,f[2]]],['face',face(f)],['crown',[f[0],f[1]+H,f[2]]]]){const o=GEO.blocked(cam.position,p);if(o)fails.push(`${k} ${st} ${nm} hidden by ${o}`);}
 }}
// B. 05 unchanged
const frozen=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/meadow_board_05_pose_3fb967af.json'),'utf8'));
for(const [w,h] of SCREENS){if(w<390)continue;const k=w+'x'+h,cam=lens(w,h,'mainline-05'),o=frozen[k];
 const d=Math.max(...cam.position.map((x,i)=>Math.abs(x-o.position[i])),...cam.target.map((x,i)=>Math.abs(x-o.target[i])),Math.abs(cam.fovVerticalDeg-o.fovVerticalDeg));if(d>1e-9)fails.push(`${k} 05 lens moved (${d})`);}
// C. blends, folded into the reward walk (Grok Bot plan 1, RegionNodeStage.meadowRewardFold): she walks from t=0 at WALK_SPEED_MPS;
//    board(s0) → LIVE follow lens (moving with her) over T0; then follow; T1 s before the node: follow snapshot → board(s1). No pause:
//    T0 + T1 ≤ the walk. Per real dt (60 fps, 30 fps, jitter), 7 screens.
const NW=load('region/NodeWalker.ts');
const edge=(a,b)=>{const e=N.REGION_NODES.meadow.edges.find(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));return e.a===a?e.path:e.path.slice().reverse();};
const head=(p,q)=>Math.atan2(q[0]-p[0],q[2]-p[2]),dir=p=>{const d=[0,1,2].map(i=>p.target[i]-p.position[i]),l=Math.hypot(...d);return d.map(x=>x/l);};
const yp=p=>{const d=dir(p);return [Math.atan2(d[0],d[2])*180/Math.PI,Math.asin(d[1])*180/Math.PI];},wrap=a=>((a+540)%360)-180;
const DT={'60fps':()=>1/60,'30fps':()=>1/30,jitter:i=>[1/60,1/60,1/30,1/60,1/20,1/60][i%6]};
const blendS=(a,b,min)=>SL&&SL.meadowBlendSeconds?SL.meadowBlendSeconds(a,b,min):min;
const herAt=(path,t)=>{const L=NW.pathLength(path),d=Math.min(L,t*NW.WALK_SPEED_MPS),p=NW.pointAlong(path,d),q=NW.pointAlong(path,Math.min(L,d+.05)),o=NW.pointAlong(path,Math.max(0,d-.05));return {p,yaw:head(o,q)};};
const followAt=(path,t,w,h)=>{const s=herAt(path,t);return EC.followPose(s.p,s.yaw,w,h,0);};
const foldAt=(path,t,w,h)=>{const s=herAt(path,t),q=NW.pointAlong(path,3);return EC.followPose(s.p,head(path[0],q),w,h,0);};/* RegionNodeStage.meadowRewardFold: one heading */
report.folds=[];report.tables={};
for(const [w,h] of SCREENS)for(const [s0,s1,a,b] of [['mainline-05','mainline-06','M1','M2'],['mainline-06','mainline-07','M2','M3'],['mainline-07','mainline-08','M3','M4'],['mainline-08','mainline-09','M4','M6']]){
 const path=edge(a,b),walkS=NW.pathLength(path)/NW.WALK_SPEED_MPS,B0=lens(w,h,s0),T0=blendS(B0,foldAt(path,0,w,h),EC.BLEND_S.boardToFollow);
 const legs=[['board>follow',0,T0,t=>EC.blendPose(B0,foldAt(path,t,w,h),t,T0)]];
 if(s1!=='mainline-09'){const B1=lens(w,h,s1),T1=blendS(followAt(path,walkS,w,h),B1,EC.BLEND_S.followToBoard),ts=Math.max(T0,walkS-T1),F=followAt(path,ts,w,h);
  legs.push(['follow>board',ts,T1,t=>EC.blendPose(F,B1,t-ts,T1)]);const pause=Math.max(0,ts+T1-walkS);report.folds.push({key:`${w}x${h} ${a}>${b}`,walkS:+walkS.toFixed(2),T0:+T0.toFixed(2),T1:+T1.toFixed(2),standS:+pause.toFixed(2)});
  if(pause>1e-6)fails.push(`${w}x${h} ${a}>${b}: lens still moving ${pause.toFixed(2)} s after she stops (T0 ${T0.toFixed(2)} + T1 ${T1.toFixed(2)} > walk ${walkS.toFixed(2)})`);}
 for(const [nm,ts,T,at] of legs)for(const [dn,dtf] of Object.entries(DT)){let t=ts,i=0,prev=at(ts),pr=null;const m={T:+T.toFixed(3),v:0,step:0,yaw:0,pitch:0,fov:0,acc:[],ground:Infinity,solid:Infinity},tab=[];
   tab.push([+(t).toFixed(4),...prev.position.map(x=>+x.toFixed(3)),...yp(prev).map(x=>+x.toFixed(2)),+prev.fovVerticalDeg.toFixed(3)]);
   while(t<ts+T-1e-9){const dt=dtf(i++);t=Math.min(ts+T,t+dt);const q=at(t),s=Math.hypot(...[0,1,2].map(j=>q.position[j]-prev.position[j]));
    const [y0,p0]=yp(prev),[y1,p1]=yp(q),yr=wrap(y1-y0)/dt,prt=(p1-p0)/dt,rate=Math.hypot(yr,prt);m.v=Math.max(m.v,s/dt);m.step=Math.max(m.step,s);m.yaw=Math.max(m.yaw,Math.abs(yr));m.pitch=Math.max(m.pitch,Math.abs(prt));
    m.fov=Math.max(m.fov,Math.abs(q.fovVerticalDeg-prev.fovVerticalDeg));if(pr!==null)m.acc.push(Math.abs(rate-pr)/dt);pr=rate;
    if(i%4===0||t>=ts+T){m.ground=Math.min(m.ground,GEO.groundClear(q.position));m.solid=Math.min(m.solid,GEO.solidClear(q.position).d);}
    tab.push([+t.toFixed(4),...q.position.map(x=>+x.toFixed(3)),y1,p1,q.fovVerticalDeg].map(x=>+(+x).toFixed(4)));prev=q;}
   m.acc.sort((x,y)=>x-y);const acc99=m.acc.length?m.acc[Math.floor(.99*(m.acc.length-1))]:0;delete m.acc;m.acc99=acc99;
   const key=`${w}x${h} ${a}>${b} ${nm} ${dn}`,row={key,...Object.fromEntries(Object.entries(m).map(([x,v])=>[x,+(+v).toFixed(3)]))};report.blends.push(row);report.tables[key]=tab;
   const bad=[];if(m.v>CAP.mps)bad.push('speed '+m.v.toFixed(1)+' m/s');if(m.step>CAP.step)bad.push('step '+m.step.toFixed(2)+' m');if(m.yaw>CAP.degS)bad.push('yaw '+m.yaw.toFixed(0)+'°/s');if(m.pitch>CAP.degS)bad.push('pitch '+m.pitch.toFixed(0)+'°/s');
   if(acc99>CAP.degS2)bad.push('acc p99 '+acc99.toFixed(0)+'°/s²');if(m.fov>CAP.fovFrame)bad.push('fov '+m.fov.toFixed(2)+'°/frame');if(m.ground<GROUND_M)bad.push('ground '+m.ground.toFixed(2)+' m');if(m.solid<SOLID_M)bad.push('solid '+m.solid.toFixed(2)+' m');
   if(bad.length)fails.push(key+': '+bad.join(', '));}}
// D. wiring
const src=f=>fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts',f),'utf8');
const rns=src('world-r2/RegionNodeStage.ts'),wnc=src('world-r2/WorldNativeComposition.ts'),rbl=src('region/RegionBoardLanding.ts');
if(!SL)fails.push('region/MeadowStageLens.ts missing (one shared lens on M1)');
if(!/meadowBoardNode\(\)/.test(rbl))fails.push('meadowBoardCamera does not frame the stage node (RegionBoardLanding)');
if(!/meadowRewardFold\(/.test(rns)||!/setMeadowBoardStage\(toStage\)/.test(rns)||!/meadowStageBoard\(\)/.test(rns)||!/meadowBlendSeconds\(board,live\(\)/.test(rns)&&/yaw0=Math\.atan2/.test(rns)||!/blend\(T1,this\.readPose\(\),\(\)=>next\)/.test(rns))fails.push('RegionNodeStage.playReward: meadow reward walk does not land on / blend to the stage lens');
if(!/setMeadowBoardStage\(selection\.stageId\)/.test(wnc))fails.push('WorldNativeComposition: level entry does not pick the stage lens');
const outDir=path.join(__dirname,'reports');fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,'meadow-stage-lens.json'),JSON.stringify(report,null,1));
for(const [k,v] of Object.entries(report.stages))console.log(k,Object.entries(v).map(([s,r])=>`${s.slice(-2)} edge ${r.edgePt}pt margin ${r.margin} ui ${r.uiGapPt}pt ground ${r.groundM}m solid ${r.solidM}m`).join(' | '));
if(fails.length){console.error('meadow-stage-lens FAIL ('+fails.length+')\n '+fails.slice(0,40).join('\n ')+(fails.length>40?'\n …':''));process.exit(1);}
console.log('meadow-stage-lens PASS ('+report.blends.length+' blend runs)');
