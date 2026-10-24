/* p0drag8 (GGbot 89c33d4b Mac FAIL):
 *  P1 skycity east high platform replay (Mac trace_skd 270–300 s, her walk-local ≈ 20.84,1.65,7.13): raw orbit = the trace's FreeOrbit
 *     yaw/pitch/arm around her, real 2112-box SKYCITY_LENS_OCCLUDERS set, 18 m near filter re-taken every 24 frames (400 ms) with her
 *     jittered ±5 cm and 10 % of the set dropped/reordered (refresh churn). Written lens: arm ≥ 3.5 m, view pitch ≥ −58°, per-frame arm
 *     change ≤ 0.3 m, per-frame |elevation change| ≤ |user drag step| + 45°/s·dt + 0.5° (trace dt; mode-switch frame excluded).  Also a perf note (ms per writeOrbit).
 *  P2 lakeside walk-drag (Mac trace_lake_walkdrag 215.5–217.5 s, written pitch reached −60.5°): replaying those poses as raw orbit output,
 *     the written view pitch stays ≥ −58°.
 *  P3 island return sign: from the island explore orbit (any node, entry yaws 0–60 as in Mac isd/isn) the signpost hit rect is off screen;
 *     signRectOnScreen rejects it so the visible flat 继续旅程 button is used; facing the sign (yaw ≈ 180) the rect is accepted.
 *  P4 test-only hooks: __qfTeleport(key,yaw?,pitch?) / __qfTeleport('sign') / __qfAimAt(name) / __qfBackToBoard exist only when
 *     qaSkipTarget() !== null (normal build: no ?qfSkip, not a develop/trial host → not registered); 'sign' puts the signpost on screen.
 *  P5 skycity ground spot by the roots / house (scene 4c585322 snap point 21.8,-0.17,6.6): a full slow orbit turn at 3 pitch/dist
 *     settings: written lens inside a box ≤ 3 % of frames (merged with scene 4c585322: 0.5 %) (brief rate-limited swing past a wall right next to her; never a jump), arm ≥ 3.5, view pitch ≥ −58°, lens step ≤ 0.35 m/frame; perf p99.
 * node tools/region-nodes/test_p0drag8.cjs */
const fs=require('node:fs'),path=require('node:path');
const X=require('./explore-stage-harness.cjs');const {rig,SKO,FO}=X;
const res={};const ok=(k,v,o)=>{res[k]={...o,ok:!!v};};
const DT=1/60,d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),R=Math.PI/180;
const TR=process.env.QF_P0D7_TRACE||'/workspace/wechat-game/ui-audit/2026-10-24/p0drag7/trace';
const FIX=path.join(__dirname,'fixtures_p0drag8.json');
// fixtures are cut from the Mac traces once (small) so the suite does not depend on the audit folder
if(!fs.existsSync(FIX)){const r=n=>JSON.parse(fs.readFileSync(path.join(TR,n),'utf8')).trace;
 const sk=r('trace_skd.json').filter(f=>f.t>=270&&f.t<=300&&f.fo).map(f=>[+f.t.toFixed(3),f.her,f.fo.yaw,f.fo.pitch,f.fo.arm,f.cam]);
 const lk=r('trace_lake_walkdrag.json').filter(f=>f.t>=215.5&&f.t<=217.5).map(f=>[+f.t.toFixed(3),f.cam,f.her,f.pitch]);
 fs.writeFileSync(FIX,JSON.stringify({src:'Mac p0drag7 trace_skd / trace_lake_walkdrag (engine camTrace)',sky:sk,lake:lk}));}
const FX=JSON.parse(fs.readFileSync(FIX,'utf8'));
// ---------- P1
{
 const MW=[[-0.482,0,0.880],[-0.001,1,-0.053],[-0.875,0,-0.447]],T=[58.662,18.63,143.515];
 const A=[[MW[0][0],MW[1][0],MW[2][0]],[MW[0][1],MW[1][1],MW[2][1]],[MW[0][2],MW[1][2],MW[2][2]]];
 const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
 const toLocal=w=>{const d=[w[0]-T[0],w[1]-T[1],w[2]-T[2]],D=det(A);return [0,1,2].map(c=>det(A.map((r,ri)=>r.map((v,ci)=>ci===c?d[ri]:v)))/D);};
 const F=FX.sky,her0=toLocal(F[0][1]);
 const Rg=rig('skycity','S1',her0.slice(),{modelAt:[0,0,0]});const st=Rg.st;st.guardOrbitGround=p=>p;
 let her=her0.slice();st.girl=()=>her;
 // world yaw → walk-local yaw: local frame is rotated by the MW basis
 const yawOff=Math.atan2(MW[0][2],MW[0][0])/R;
 let near=null,seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 const refresh=()=>{const g=[her[0]+(rnd()-.5)*.1,her[1],her[2]+(rnd()-.5)*.1];
  near=SKO.map(b=>({min:[b[0],b[1],b[2]],max:[b[3],b[4],b[5]]})).filter(b=>rnd()>.1&&Math.hypot(Math.max(b.min[0]-g[0],0,g[0]-b.max[0]),Math.max(b.min[2]-g[2],0,g[2]-b.max[2]))<18);
  near.sort(()=>rnd()-.5);};
 const nativeOcc=st.lakesideOccluders.bind(st);let shape=null;try{const t=nativeOcc();shape=t&&t[0]?Object.keys(t[0]):null;}catch{}
 st.lakesideOccluders=()=>near;st.skycityOccluders=()=>near;
 const o=new FO.FreeOrbit('skycity');let i=0;
 st.orbit={step(){},solve(){const f=F[i];o.yaw=f[2]+yawOff;o.pitch=f[3];o.dist=f[4];const look=[her[0],her[1]+1.25,her[2]];const p=o.rawPose?o.rawPose(her):null;
  if(p)return p;const y=o.yaw*R,e=o.pitch*R;return {position:[look[0]+Math.sin(y)*Math.cos(e)*o.dist,look[1]+Math.sin(e)*o.dist,look[2]+Math.cos(y)*Math.cos(e)*o.dist],target:look,fovVerticalDeg:48};},
  place:'skycity',shouldWrite:()=>true,seeded:true,engaged:()=>true};
 st.entry=null;st.avoid={sw:0,e:0,tsw:0,te:0,clear:0,wait:0};
 const worst=[],msA=[];let minArm=1e9,minPitch=1e9,maxDA=0,maxDE=0,maxDEr=0,pa=null,pe=null,pr=null,ms=0,n=0,maxMs=0;
 for(i=0;i<F.length;i++){her=toLocal(F[i][1]);if(i%24===0)refresh();
  const dt=i?Math.min(0.1,Math.max(1/120,F[i][0]-F[i-1][0])):DT;const t0=process.hrtime.bigint();st.writeOrbit(dt);const dm=Number(process.hrtime.bigint()-t0)/1e6;ms+=dm;n++;msA.push(dm);maxMs=Math.max(maxMs,dm);
  const c=Rg.cam(),look=[her[0],her[1]+1.25,her[2]],a=d3(c.position,look),el=Math.asin((c.position[1]-look[1])/a)/R;
  const v=c.target.map((x,k)=>x-c.position[k]),vp=-Math.asin(v[1]/Math.hypot(...v))/R;
  minArm=Math.min(minArm,a);minPitch=Math.min(minPitch,-vp);
  const re=F[i][3];/* raw orbit elevation (user drag) */if(pa!==null&&d3(her,toLocal(F[i-1][1]))<0.05&&Math.abs(F[i][2]-F[i-1][2])<30){maxDA=Math.max(maxDA,Math.abs(a-pa));maxDE=Math.max(maxDE,Math.abs(el-pe)-Math.abs(re-pr)-45*dt);if(Math.abs(el-pe)-Math.abs(re-pr)-45*dt>0.5)worst.push([F[i][0],+pe.toFixed(1),+el.toFixed(1),pr,re]);maxDEr=Math.max(maxDEr,Math.abs(re-pr));}pa=a;pe=el;pr=re;}
 const rawMin=Math.min(...F.map(f=>{const h=f[1],c=f[5];return Math.hypot(c[0]-h[0],c[1]-h[1]-1.25,c[2]-h[2]);}));
 ok('P1',minArm>=3.5&&minPitch>=-58.01&&maxDA<=0.3&&maxDE<=0.5,{frames:F.length,her:her0.map(v=>+v.toFixed(2)),boxes:SKO.length,nearBoxes:near.length,
  macWrittenMinArmM:+rawMin.toFixed(2),minArmM:+minArm.toFixed(2),minViewPitchDeg:+minPitch.toFixed(1),maxArmStepM:+maxDA.toFixed(3),avoidElevStepOverLimitDeg:+maxDE.toFixed(2),rawDragElevStepMaxDeg:+maxDEr.toFixed(1),
  perf:{avgMsPerFrame:+(ms/n).toFixed(3),p99Ms:+msA.slice().sort((a,b)=>a-b)[Math.floor(n*.99)].toFixed(2),maxMs:+maxMs.toFixed(2)},worst:worst.slice(0,6)});
}
// ---------- P2
{
 const F=FX.lake;const Rg=rig('lakeside','S1',F[0][2].slice(),{});const st=Rg.st;let her=F[0][2].slice();st.girl=()=>her;
 st.lakesideOccluders=()=>null;st.occlude=p=>p;st.guardOrbitGround=p=>p;let i=0;
 st.orbit={step(){},solve(){const f=F[i];return {position:f[1].slice(),target:[f[2][0],f[2][1]+1.15,f[2][2]],fovVerticalDeg:48};},place:'lakeside',shouldWrite:()=>true,seeded:true,engaged:()=>true};
 st.entry=null;let minP=1e9;const macMin=Math.min(...F.map(f=>f[3]));
 for(i=0;i<F.length;i++){her=F[i][2].slice();st.writeOrbit(DT);const c=Rg.cam(),v=c.target.map((x,k)=>x-c.position[k]);minP=Math.min(minP,Math.asin(v[1]/Math.hypot(...v))/R);}
 ok('P2',minP>=-58.01&&macMin<-60,{frames:F.length,macMinPitchDeg:macMin,writtenMinPitchDeg:+minP.toFixed(2)});
}
// ---------- P3
{
 const L=X.H.load(X.S('world-r2/IslandPropsLayout.ts')),CP=X.H.load(X.S('world-r1/CameraPose.ts')),nodes=X.RN.REGION_NODES.island.nodes,W=390,Hh=844;
 const src=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/WorldIntegrationBoot.ts'),'utf8');
 const gated=/sign=p\.signRect\(f\.width,f\.height\);if\(!signRectOnScreen\(sign,f\.width,f\.height\)\)sign=null;/.test(src)&&/opacity=255;this\.placeNavigationControl\(m,worldNavigationLayout/.test(src);
 const o=new FO.FreeOrbit('island');const per={};let entryOff=0,entryN=0,facing=0;
 for(const nd of nodes){let on=[];for(let yaw=0;yaw<360;yaw+=5){let any=false;for(const [pt,dd] of [[25,12],[10,12],[40,9],[10,6],[5,4.2]]){o.yaw=yaw;o.pitch=pt;o.dist=dd;const p=CP.fromLookAt(o.rawPose(nd.at)),r=L.signpostHitUi(p,W,Hh),s=L.signRectOnScreen(r,W,Hh);
   if(s)any=true;if(yaw<=60&&dd===12&&pt===25){entryN++;if(!s)entryOff++;}}if(any)on.push(yaw);}per[nd.key]=on.join(',');if(on.length)facing++;}
 const off={x:-1440,y:1281,width:88,height:88};
 ok('P3',gated&&entryOff===entryN&&facing===nodes.length&&!L.signRectOnScreen(off,W,Hh)&&!L.signRectOnScreen(null,W,Hh),{bootGatesOffscreenSign:gated,entryYawPosesOffscreen:entryOff+'/'+entryN,onScreenYawsByNode:per});
}
// ---------- P4
{
 const QS=X.H.load(X.S('world-r2/QaSkip.ts')),L=X.H.load(X.S('world-r2/IslandPropsLayout.ts')),CP=X.H.load(X.S('world-r1/CameraPose.ts'));
 const normal=QS.qaSkipTarget(null,{location:{search:''}})===null&&QS.qaSkipTarget('?qfSkip=skycity-finale',{wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}})}})===null&&QS.qaSkipTarget('?qfSkip=skycity-finale',{})==='skycity-finale';/* no param / WeChat release → closed; web QA URL → open */
 const Rg=rig('island','S1',X.RN.REGION_NODES.island.nodes[0].at.slice(),{});const st=Rg.st,cam=st.camera;st.exploring=true;
 const keys=['__qfTeleport','__qfAimAt'];for(const k of keys)delete X.sb[k];
 X.setQa(null);st.attach(cam);const offBuild=keys.every(k=>X.sb[k]===undefined);
 X.setQa('skycity-finale');st.attach(cam);const onBuild=keys.every(k=>typeof X.sb[k]==='function');st.camera=cam;
 const r1=X.sb.__qfTeleport('I2',90,30),r2=X.sb.__qfTeleport('sign');const c=Rg.cam(),rect=L.signpostHitUi(CP.fromLookAt(c),390,844);
 X.setQa(null);for(const k of keys)delete X.sb[k];
 const boot=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/WorldIntegrationBoot.ts'),'utf8');
 const bootGated=/const skip=qaSkipTarget\(q\);[^\n]*\n\s*if\(skip!==null\)\(globalThis as any\)\.__qfBackToBoard=/.test(boot)&&(boot.match(/__qfBackToBoard=/g)||[]).length===1;
 const stageSrc=fs.readFileSync(X.S('world-r2/RegionNodeStage.ts'),'utf8');const stageGated=/if\(qaSkipTarget\(\)!==null\)\{const G=globalThis as any;G\.__qfTeleport=.*G\.__qfAimAt=/.test(stageSrc)&&(stageSrc.match(/__qfTeleport=/g)||[]).length===1;
 ok('P4',normal&&offBuild&&onBuild&&bootGated&&stageGated&&r1.ok&&Math.abs(r1.yaw-90)<1e-6&&Math.abs(r1.pitch-30)<1e-6&&r2.ok&&L.signRectOnScreen(rect,390,844),
  {qaSkipNullInNormalBuild:normal,hooksAbsentWhenGateClosed:offBuild,hooksPresentWhenOpen:onBuild,bootGated,stageGated,teleportYawPitch:r1,teleportSign:r2,signRect:rect});
}
// ---------- P5
{
 const her=[21.8,-0.17,6.6];const Rg=rig('skycity','S1',her.slice(),{modelAt:[0,0,0]});const st=Rg.st;st.guardOrbitGround=p=>p;st.girl=()=>her;
 const B=SKO.map(b=>({min:[b[0],b[1],b[2]],max:[b[3],b[4],b[5]]})),near=B.filter(b=>Math.hypot(Math.max(b.min[0]-her[0],0,her[0]-b.max[0]),Math.max(b.min[2]-her[2],0,her[2]-b.max[2]))<18);
 st.lakesideOccluders=()=>near;st.skycityOccluders=()=>near;const o=new FO.FreeOrbit('skycity');
 st.orbit={step(){},solve:()=>o.rawPose(her),place:'skycity',shouldWrite:()=>true,seeded:true,engaged:()=>true};st.entry=null;st.avoid={sw:0,e:0,tsw:0,te:0,clear:0,wait:0};
 const inside=(p,b)=>p[0]>b.min[0]&&p[0]<b.max[0]&&p[1]>b.min[1]&&p[1]<b.max[1]&&p[2]>b.min[2]&&p[2]<b.max[2];const runs=[];let good=true;
 for(const [pt,dd] of [[15,7],[30,10],[10,12]]){o.pitch=pt;o.dist=dd;let minA=1e9,minP=1e9,maxStep=0,inBox=0,rawIn=0,pa=null;const ms=[];
  for(let f=-90;f<60*24;f++){o.yaw=Math.max(0,f)*0.25;if(f<0){st.writeOrbit(DT);pa=null;continue;}/* settle on the start yaw first */const t=process.hrtime.bigint();st.writeOrbit(DT);ms.push(Number(process.hrtime.bigint()-t)/1e6);
   const c=Rg.cam(),look=[her[0],her[1]+1.25,her[2]],a=d3(c.position,look),v=c.target.map((x,k)=>x-c.position[k]),vp=Math.asin(v[1]/Math.hypot(...v))/R;
   if(near.some(b=>inside(c.position,b)))inBox++;if(near.some(b=>inside(o.rawPose(her).position,b)))rawIn++;
   minA=Math.min(minA,a);minP=Math.min(minP,vp);if(pa)maxStep=Math.max(maxStep,d3(c.position,pa));pa=c.position.slice();}
  ms.sort((a,b)=>a-b);const r={pitch:pt,dist:dd,rawLensInsideFrames:rawIn,writtenInsideFrames:inBox,minArmM:+minA.toFixed(2),minViewPitchDeg:+minP.toFixed(1),maxLensStepM:+maxStep.toFixed(3),avgMs:+(ms.reduce((a,b)=>a+b)/ms.length).toFixed(3),p99Ms:+ms[Math.floor(ms.length*.99)].toFixed(2)};
  runs.push(r);good=good&&inBox<=ms.length*0.03&&minA>=3.5&&minP>=-58.01&&maxStep<=0.35;}
 ok('P5',good,{boxes:SKO.length,nearBoxes:near.length,runs});
}
const all=Object.values(res).every(r=>r.ok);console.log(JSON.stringify({test:'p0drag8',ok:all,...res},null,1));process.exit(all?0:1);
