/* p0drag11 (Mac p0drag10 477575f1 FAIL: face/chest hidden 1.9–9.6 s on the slow turns, grey post full screen at the nook walk end,
 * 'sign' shot looking away from the sign, teleport leaving the old walk running).
 * Q0 calibration: the Mac camTrace occFace/occChest of every recorded frame is reproduced from the trace's own cam / her with the
 *    p0drag10 engine geometry (world AABBs of the rotated proxies, 18 m near set) — ≥ 98 % agreement — and the same frames scored
 *    with model-local (exact) boxes show how much of the Mac occlusion was phantom (AABB inflation).
 * Q1 replay of the four Mac slow turns (skd_po/ro, skn_po/ro) through the real writeOrbit (drag dt = 0 writes, hook cuts as qaOrbit,
 *    18 m near set re-taken every 0.4 s, exact local boxes): longest face run and chest run ≤ 0.5 s each, lens never inside a box,
 *    view pitch ≤ 22°/s·dt (+raw) and height ≤ 5 m/s·dt per frame, ≤ 7° / 1.3 m per 0.25 s, her inside the safe margins, arm ≥ 3.5 m.
 * Q2 nook walk end (11.8, 8.2): a lens that ends on the grey post / a bush picks a clear facing within 0.5 s, eased (no cut).
 * Q3 __qfTeleport('sign'): the sign's text centre is in front of the lens inside the view frustum, its text side (+Z) faces the camera
 *    (≤ 60° off), her sight line does not cross the sign (no occlusion pull), and all of it still holds after 1 s of writes.
 * Q4 __qfTeleport cancels the walk in progress (walk target / path cleared, she stays on the node).
 * node tools/region-nodes/test_p0drag11.cjs */
const fs=require('node:fs'),path=require('node:path');
const X=require('./explore-stage-harness.cjs');const {rig,SKO,FO}=X;const LS=X.H.load(X.S('region/LensSmooth.ts')),LA=X.H.load(X.S('region/LensAvoid.ts')),LO=X.H.load(X.S('region/LensOcclusion.ts'));
const res={};const ok=(k,v,o)=>{res[k]={...o,ok:!!v};};
const R=Math.PI/180,d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),wrap=a=>((a%360)+540)%360-180;
const FIX=path.join(__dirname,'fixtures_p0drag11.json'),TR=process.env.QF_P0D10_TRACE||'/workspace/wechat-game/ui-audit/2026-10-24/p0drag10/trace';
const KEYS=['skd_po','skd_ro','skn_po','skn_ro'];
if(!fs.existsSync(FIX)){const cut=n=>JSON.parse(fs.readFileSync(path.join(TR,'trace_'+n+'.json'),'utf8')).trace.filter(f=>f.exploring&&f.region==='skycity'&&f.fo&&f.cam)
  .map(f=>[+f.t.toFixed(3),f.her.map(v=>+v.toFixed(3)),+f.fo.yaw.toFixed(2),+f.fo.pitch.toFixed(2),+f.fo.arm.toFixed(3),f.cam.map(v=>+v.toFixed(3)),f.yaw,f.pitch,
   f.w.filter(w=>w==='region.node-lens:orbit').length,f.occFace?1:0,f.occChest?1:0,f.fo.write&&!f.walking?1:0]);
 const o={src:'Mac p0drag10 (477575f1) camTrace trace_sk{d,n}_{po,ro}: [t, her(world), fo.yaw, fo.pitch, fo.arm, cam(world), yaw, pitch, orbit writes, occFace, occChest, orbit-writing]'};for(const k of KEYS)o[k]=cut(k);
 fs.writeFileSync(FIX,JSON.stringify(o));}
const FX=JSON.parse(fs.readFileSync(FIX,'utf8'));
// skycity model world matrix on the Mac (world = A·local + T; A = MWᵀ), as in test_p0drag10
const MW=[[-0.482,0,0.880],[-0.001,1,-0.053],[-0.875,0,-0.447]],T=[58.662,18.63,143.515];
const toW=l=>[0,1,2].map(i=>MW[0][i]*l[0]+MW[1][i]*l[1]+MW[2][i]*l[2]+T[i]);
const A3=[[MW[0][0],MW[1][0],MW[2][0]],[MW[0][1],MW[1][1],MW[2][1]],[MW[0][2],MW[1][2],MW[2][2]]];
const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
const toLocal=v0=>{const v=[v0[0]-T[0],v0[1]-T[1],v0[2]-T[2]],D=det(A3);return [0,1,2].map(c=>det(A3.map((r,ri)=>r.map((x,ci)=>ci===c?v[ri]:x)))/D);};
const YAW_OFF=117;
const B=SKO.map(b=>({min:[b[0],b[1],b[2]],max:[b[3],b[4],b[5]]}));
const near18=(bx,h)=>bx.filter(b=>Math.hypot(Math.max(b.min[0]-h[0],0,h[0]-b.max[0]),Math.max(b.min[2]-h[2],0,h[2]-b.max[2]))<18);
const occ=(lens,h,bx)=>LA.herOcclusion(lens,h,bx);
const isCut=(F,i)=>i>0&&(d3(F[i][1],F[i-1][1])>1||Math.abs(wrap(F[i][2]-F[i-1][2]))>20);
/* the Mac's slow-turn window (its summary numbers): from the first raw-yaw move after the last hook cut to the end of the trace */
const turnStart=F=>{let c=0;for(let i=1;i<F.length;i++)if(isCut(F,i))c=i;let s=c;while(s<F.length-1&&Math.abs(F[s][2]-F[c][2])<2)s++;return s;};
// ---------- Q0 calibration
{
 const old=require('./fixtures_p0drag11_oldsky.cjs');/* p0drag10 proxy set (before this round's regeneration), model-local rows */
 const BW=LO.proxiesToWorld(old,toW);const out={};let all=true;
 for(const k of KEYS){const F=FX[k];let agree=0,mF=0,mC=0,wF=0,wC=0,lF=0,lC=0;const run={m:[0,0],w:[0,0],l:[0,0],n:[0,0]},mx={m:[0,0],w:[0,0],l:[0,0],n:[0,0]};
  const BL=old.map(r=>({min:[r[0],r[1],r[2]],max:[r[3],r[4],r[5]]}));
  const t0=turnStart(F);for(let i=0;i<F.length;i++){const f=F[i],dt=i>t0?Math.min(0.1,f[0]-F[i-1][0]):0,hw=f[1],cw=f[5],hl=toLocal(hw),cl=toLocal(cw);
   const ow=occ(cw,hw,near18(BW,hw)),ol=occ(cl,hl,near18(BL,hl)),on=occ(cl,hl,near18(B,hl));if(+ow.face===f[9]&&+ow.chest===f[10])agree++;
   const S={m:[f[9],f[10]],w:[ow.face,ow.chest],l:[ol.face,ol.chest],n:[on.face,on.chest]};
   if(i>=t0)for(const s in S)for(let j=0;j<2;j++){run[s][j]=S[s][j]?run[s][j]+dt:0;mx[s][j]=Math.max(mx[s][j],run[s][j]);}}
  const r2=v=>v.map(x=>+x.toFixed(2));const a=agree/F.length;all=all&&a>=0.975;
  out[k]={frames:F.length,turnFrom:F[t0][0],agreeWithMacOcc:+a.toFixed(4),longestTurnFaceChestS:{macEngineField:r2(mx.m),worldAabbRecomputed:r2(mx.w),exactLocalOldSet:r2(mx.l),exactLocalNewSet:r2(mx.n)}};}
 ok('Q0',all,out);
}
// ---------- Q1 replay of the Mac slow turns
function metrics(F,P,H,t0,act){const vp=p=>{const v=p.target.map((x,k)=>x-p.position[k]);return Math.asin(v[1]/Math.hypot(...v))/R;};
 let over=0,overH=0,mp=0,mh=0,w25p=0,w25h=0,ins=0,mm=1e9,ma=1e9,minP=1e9;const run=[0,0],mx=[0,0];
 const inside=p=>B.some(b=>p[0]>b.min[0]&&p[0]<b.max[0]&&p[1]>b.min[1]&&p[1]<b.max[1]&&p[2]>b.min[2]&&p[2]<b.max[2]);
 for(let i=t0;i<F.length;i++){if(!act[i])continue;const p=P[i],h=H[i];if(inside(p.position))ins++;
  const o=occ(p.position,h,B),dt=i>t0?Math.min(0.1,F[i][0]-F[i-1][0]):0;[o.face,o.chest].forEach((v,j)=>{run[j]=v?run[j]+dt:0;mx[j]=Math.max(mx[j],run[j]);});
  mm=Math.min(mm,LS.herMargin(p.position,p.target,48,h));ma=Math.min(ma,d3(p.position,[h[0],h[1]+1.25,h[2]]));minP=Math.min(minP,vp(p));
  if(i>t0&&act[i-1]&&!isCut(F,i)){const ddt=Math.min(0.1,Math.max(1/120,F[i][0]-F[i-1][0])),dp=Math.abs(vp(p)-vp(P[i-1])),dh=Math.abs(p.position[1]-P[i-1].position[1]);
   mp=Math.max(mp,dp);mh=Math.max(mh,dh);over=Math.max(over,dp-22*ddt-Math.abs(F[i][3]-F[i-1][3]));overH=Math.max(overH,dh-5*ddt);}
  let j=i;while(j>t0&&act[j-1]&&!isCut(F,j)&&F[i][0]-F[j-1][0]<=0.25)j--;if(j<i){w25p=Math.max(w25p,Math.abs(vp(p)-vp(P[j]))-Math.abs(F[i][3]-F[j][3]));w25h=Math.max(w25h,Math.abs(p.position[1]-P[j].position[1]));}}
 return {longestFaceS:+mx[0].toFixed(2),longestChestS:+mx[1].toFixed(2),framesInsideGeometry:ins,maxPitchStepDeg:+mp.toFixed(2),maxHeightStepM:+mh.toFixed(3),pitchOverLimitDeg:+Math.max(0,over).toFixed(2),
  heightOverLimitM:+Math.max(0,overH).toFixed(3),max025sPitchDeg:+w25p.toFixed(1),max025sHeightM:+w25h.toFixed(2),minHerMargin:+mm.toFixed(2),minArmM:+ma.toFixed(2),minViewPitchDeg:+minP.toFixed(1)};}
const good=m=>m.longestFaceS<=0.5&&m.longestChestS<=0.5&&m.framesInsideGeometry===0&&m.pitchOverLimitDeg<=0.5&&m.heightOverLimitM<=0.03&&m.max025sPitchDeg<=7&&m.max025sHeightM<=1.3&&m.minHerMargin>=0&&m.minArmM>=3.49&&m.minViewPitchDeg>=-58.01;
function replay(F,cb){const H=F.map(f=>toLocal(f[1]));const Rg=rig('skycity','S1',H[0].slice(),{modelAt:[0,0,0]});const st=Rg.st;st.guardOrbitGround=p=>p;let her=H[0];st.girl=()=>her;
 let near=null,nearAt=-1e9;st.lakesideOccluders=()=>near;st.skycityOccluders=()=>near;const o=new FO.FreeOrbit('skycity');let i=0;
 st.orbit={step(){},solve(){const f=F[i];o.yaw=f[2]+YAW_OFF;o.pitch=f[3];o.dist=f[4];return o.rawPose(her);},place:'skycity',shouldWrite:()=>true,seeded:true,engaged:()=>true,drag(){},release(){},setPlace(){},seed(){},forget(){},rawPose:(g)=>o.rawPose(g)};st.entry=null;
 const P=[],act=[],ms=[];let last=-1;
 for(i=0;i<F.length;i++){her=H[i];if(F[i][0]-nearAt>=0.4||(last>=0&&d3(H[i],H[last])>1)){nearAt=F[i][0];near=near18(B,her);}
  if(!F[i][11]){P.push(P.length?P[P.length-1]:{position:toLocal(F[i][5]),target:her});act.push(false);continue;}
  const dt=last>=0?Math.min(0.1,Math.max(0,F[i][0]-F[last][0])):1/60;const t=process.hrtime.bigint();
  if(isCut(F,i)||last<0||F[i][0]-F[last][0]>0.3)st.qaOrbit();else if(F[i][8]>=2){st.qaHold=false;st.writeOrbit(0);}
  st.writeOrbit(dt);ms.push(Number(process.hrtime.bigint()-t)/1e6);const c=Rg.cam();P.push({position:c.position.slice(),target:c.target.slice()});act.push(true);last=i;if(cb)cb(i,st);}
 ms.sort((a,b)=>a-b);return {P,H,act,perf:{avgMs:+(ms.reduce((a,b)=>a+b,0)/ms.length).toFixed(3),p99Ms:+ms[Math.floor(ms.length*.99)].toFixed(2)}};}
{
 const out={};let all=true;
 for(const k of KEYS){const F=FX[k],t0=turnStart(F),H=F.map(f=>toLocal(f[1]));
  const mac=F.map(f=>{const y=f[6]*R,p=f[7]*R,fw=[-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p)],c=toLocal(f[5]),e=toLocal([f[5][0]+fw[0]*5,f[5][1]+fw[1]*5,f[5][2]+fw[2]*5]);return {position:c,target:e};});
  const before=metrics(F,mac,H,t0,F.map(()=>true));const r=replay(F),after=metrics(F,r.P,r.H,t0,r.act);all=all&&good(after);
  out[k]={her:H[t0].map(v=>+v.toFixed(2)),turnFrom:F[t0][0],before_mac_exactBoxes:before,after,perf:r.perf};}
 ok('Q1',all,{boxes:SKO.length,...out});
}
// ---------- Q2 nook walk end (11.8, 8.2): a lens on the post / bush turns to a clear facing, eased
{
 const her0=[11.8,-0.05,8.2],nearOf=h=>B.filter(b=>Math.hypot(Math.max(b.min[0]-h[0],0,h[0]-b.max[0]),Math.max(b.min[2]-h[2],0,h[2]-b.max[2]))<18);
 const near=nearOf(her0),look=[her0[0],her0[1]+1.25,her0[2]],fo=new FO.FreeOrbit('skycity');fo.pitch=12;fo.dist=7.34;
 const badAt=y=>{fo.yaw=y;const p=fo.rawPose(her0).position,o=occ(p,her0,near);return {inside:LA.lensLevel(look,p,near,0)===2,hid:o.face||o.chest};};
 let yb=null;for(let y=-180;y<180&&yb===null;y+=5){const b=badAt(y);if(b.inside)yb=y;}for(let y=-180;y<180&&yb===null;y+=5){if(badAt(y).hid)yb=y;}
 const Rg=rig('skycity','S1',her0.slice(),{modelAt:[0,0,0]});const st=Rg.st;st.guardOrbitGround=p=>p;st.lakesideOccluders=()=>near;st.skycityOccluders=()=>near;
 st.qaOrbit(yb,12);st.orbit.dist=7.34;st.writeOrbit(1/60);/* the walk ended here: one written frame with the lens on the post / bush */
 const startCam=Rg.cam().position.slice(),turn=typeof st.walkEndView==='function'?st.walkEndView('skycity'):null;
 let maxStep=0,pa=startCam,clearAt=null,inside=0;for(let f=1;f<=60;f++){st.writeOrbit(1/60);const c=Rg.cam().position;maxStep=Math.max(maxStep,d3(c,pa));pa=c.slice();
  const o=occ(c,her0,near),inn=LA.lensLevel(look,c,near,0)===2;if(inn)inside++;if(clearAt===null&&!o.face&&!o.chest&&!inn)clearAt=f/60;else if(clearAt!==null&&(o.face||o.chest))clearAt=clearAt;}
 const end=Rg.cam().position,oe=occ(end,her0,near);
 ok('Q2',yb!==null&&!!turn&&clearAt!==null&&clearAt<=0.5&&!oe.face&&!oe.chest&&inside===0&&maxStep<=0.55,{her:her0,badYaw:yb,start:badAt(yb),turn,clearAfterS:clearAt,endSeen:!oe.face&&!oe.chest,insideFrames:inside,maxLensStepM:+maxStep.toFixed(3)});
}
// ---------- Q3 __qfTeleport('sign'): sign in front of the lens, inside the frustum, text side toward the camera (world space)
{
 const L=X.H.load(X.S('world-r2/IslandPropsLayout.ts')),CP=X.H.load(X.S('world-r1/CameraPose.ts'));const S=L.ISLAND_PROPS.signpost,ny=S.yawDeg*R,n=[Math.sin(ny),0,Math.cos(ny)];
 const tc=S.text.center,sc=[S.position[0]+S.scale*(tc[0]*Math.cos(ny)+tc[2]*Math.sin(ny)),S.position[1]+S.scale*tc[1],S.position[2]+S.scale*(-tc[0]*Math.sin(ny)+tc[2]*Math.cos(ny))];/* text centre, world */
 const Rg=rig('island','S1',X.RN.REGION_NODES.island.nodes[0].at.slice(),{});const st=Rg.st;let her=Rg.her();st.girl=()=>her;st.standAt=(r,at)=>{her=at.slice();};
 const r=st.qaTeleport('sign');const shots=[];
 const judge=c=>{const fw=c.target.map((x,k)=>x-c.position[k]),fl=Math.hypot(...fw),toS=sc.map((x,k)=>x-c.position[k]),depth=(toS[0]*fw[0]+toS[1]*fw[1]+toS[2]*fw[2])/fl;
  const rect=L.signpostRectUi(CP.fromLookAt(c),390,844),q=CP.projectPoint(CP.fromLookAt(c),390/844,sc),inFr=q.depth>0&&Math.abs(q.x)<=1&&Math.abs(q.y)<=1;/* the text centre inside the view frustum */
  const v=c.position.map((x,k)=>x-sc[k]),text=(v[0]*n[0]+v[2]*n[2])/Math.hypot(...v);
  // her sight line must not cross the sign (else the sign hides her and the lens pull moves the lens in front of it — Mac p0drag10)
  const a=S.yawDeg*R,loc=p=>{const d=[p[0]-S.position[0],p[1]-S.position[1],p[2]-S.position[2]];return [(d[0]*Math.cos(a)-d[2]*Math.sin(a))/S.scale,d[1]/S.scale,(d[0]*Math.sin(a)+d[2]*Math.cos(a))/S.scale];};
  const A=loc(c.position),Bq=loc([her[0],her[1]+1.15,her[2]]);let t0=0,t1=1,hit=true;for(let k=0;k<3;k++){const d=Bq[k]-A[k];if(Math.abs(d)<1e-9){if(A[k]<S.boxMin[k]||A[k]>S.boxMax[k]){hit=false;break;}continue;}let u=(S.boxMin[k]-A[k])/d,w=(S.boxMax[k]-A[k])/d;if(u>w){const q=u;u=w;w=q;}t0=Math.max(t0,u);t1=Math.min(t1,w);if(t0>t1){hit=false;break;}}
  return {signDepthM:+depth.toFixed(2),inFrustum:inFr,textNdc:[+q.x.toFixed(2),+q.y.toFixed(2)],textDistM:+Math.hypot(...v).toFixed(2),textFacing:+text.toFixed(2),signBlocksHer:hit,rect:rect&&[rect.x,rect.y,rect.width,rect.height].map(v=>Math.round(v))};};
 shots.push(judge(Rg.cam()));for(let f=0;f<60;f++)st.writeOrbit(1/60);shots.push(judge(Rg.cam()));
 ok('Q3',r.ok&&shots.every(j=>j.signDepthM>0&&j.inFrustum&&j.textFacing>0.5&&!j.signBlocksHer),{teleport:r,atTeleport:shots[0],after1s:shots[1]});
}
// ---------- Q4 __qfTeleport ends the walk in progress
{
 const Rg=rig('skycity','S1',[6.2,-0.05,8.2],{modelAt:[0,0,0]});const st=Rg.st;let her=[6.2,-0.05,8.2];st.girl=()=>her;st.guardOrbitGround=p=>p;st.skycityOccluders=()=>null;st.lakesideOccluders=()=>null;
 let pend=null;const resets=[];st.character={perform:(a,tok)=>new Promise((res,rej)=>{pend={res,rej,tok,a};}),cancelAndReset:s=>{resets.push(s.controllerRoot.slice());her=s.controllerRoot.slice();}};st.ensureCharacter=()=>true;st.walkMatrix=()=>({m12:0,m13:0,m14:0});
 st.toWorld=(r,p)=>p.map(q=>[q[0],q[1],q[2]]);
 const RN=X.RN.REGION_NODES.skycity.nodes,far=RN.slice().sort((a,b)=>Math.hypot(b.at[0]-6.2,b.at[2]-8.2)-Math.hypot(a.at[0]-6.2,a.at[2]-8.2))[0];
 const walk=st.groundWalkTo('skycity',far.at.slice());
 (async()=>{await new Promise(r=>setTimeout(r,0));const started=!!pend,dest=pend&&pend.a.path[pend.a.path.length-1];
  const tp=st.qaTeleport('S3'),at=her.slice(),walkingAfter=st.groundWalking,cancelled=!!(pend&&pend.tok&&(pend.tok.cancelled||pend.tok.isCancelled?.()));
  if(pend)pend.rej(new Error('cancelled'));await walk.catch(()=>{});await new Promise(r=>setTimeout(r,0));
  const endAt=her.slice(),stayed=Math.hypot(endAt[0]-at[0],endAt[2]-at[2])<0.05;
  ok('Q4',started&&tp.ok&&!walkingAfter&&stayed,{walkStarted:started,walkDest:dest,teleport:tp,herAtTeleport:at,herAfterOldWalkSettled:endAt,stayedOnNode:stayed,groundWalkingAfterTeleport:walkingAfter,walkTokenCancelled:cancelled,reStands:resets});
  finish();})();
}
module.exports={replay,occ,turnStart,isCut,FX,toLocal,toW,B,YAW_OFF,res,KEYS};
function finish(){if(require.main===module){const all=Object.values(res).every(r=>r.ok);console.log(JSON.stringify({test:'p0drag11',ok:all,...res},null,1));process.exit(all?0:1);}}
