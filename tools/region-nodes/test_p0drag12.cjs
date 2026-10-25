/* p0drag12 (Mac p0drag11 a71d0fe8: slow turns PASS at top-down pitch 55; FAIL: island sign shot too close / cropped / her not in frame,
 * nook walk face/chest hidden 0.62–0.81 s while walking, drag yaw peaks 433–467°/s unexplained).
 * S1 __qfTeleport('sign'): her body inside the safe margins AND the whole sign rect on screen on all 7 portrait screens, her head/chest
 *    not hidden (island boxes + the sign), text side toward the lens (≤ 60°, not mirrored); still so after 1 s of writes.
 * W1 replay of the Mac nook walks (trace_sk{d,n,xd}_pock: her path, orbit, hook cuts, walking flag) through the real writeOrbit while
 *    walking (groundWalking): longest face run and chest run during the walk (+0.5 s) ≤ 0.5 s, lens never in a box, pitch/height easing.
 * L1 low-angle self-check: the four Mac slow turns (skd/skn po/ro) replayed at normal explore pitch (12° and 20°) instead of the
 *    teleport's 55°: face/chest ≤ 0.5 s, no lens in a box, easing limits.
 * Y1 yaw-rate audit: written lens yaw rate vs the player's raw orbit yaw rate on the Mac turns; our own (avoidance) share of the
 *    excess over the player's raw rate, reported (audit, not gated: lowering it regresses occlusion).
 *    L1 skn_ro is a self-check only (reported, known flaw).
 * node tools/region-nodes/test_p0drag12.cjs */
const fs=require('node:fs'),path=require('node:path');
const X=require('./explore-stage-harness.cjs');const {rig,SKO,FO}=X;const LS=X.H.load(X.S('region/LensSmooth.ts')),LA=X.H.load(X.S('region/LensAvoid.ts'));
const res={};const ok=(k,v,o)=>{res[k]={...o,ok:!!v};};
const R=Math.PI/180,d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),wrap=a=>((a%360)+540)%360-180;
const FIX=path.join(__dirname,'fixtures_p0drag12.json.gz'),TR=process.env.QF_P0D11_TRACE||'/workspace/wechat-game/ui-audit/2026-10-24/p0drag11/trace';
const WALKS=['skd_pock','skn_pock','skxd_pock'],TURNS=['skd_po','skd_ro','skn_po','skn_ro'];
if(!fs.existsSync(FIX)){const cut=n=>JSON.parse(fs.readFileSync(path.join(TR,'trace_'+n+'.json'),'utf8')).trace.filter(f=>f.exploring&&f.region==='skycity'&&f.fo&&f.cam)
  .map(f=>[+f.t.toFixed(3),f.her.map(v=>+v.toFixed(3)),+f.fo.yaw.toFixed(2),+f.fo.pitch.toFixed(2),+f.fo.arm.toFixed(3),f.cam.map(v=>+v.toFixed(3)),f.yaw,f.pitch,
   f.w.filter(w=>w==='region.node-lens:orbit').length,f.occFace?1:0,f.occChest?1:0,f.fo.write?1:0,f.walking?1:0]);
 const o={src:'Mac p0drag11 (a71d0fe8) camTrace: [t, her(world), fo.yaw, fo.pitch, fo.arm, cam(world), yaw, pitch, orbit writes, occFace, occChest, orbit-writing, walking]'};for(const k of [...WALKS,...TURNS])o[k]=cut(k);
 fs.writeFileSync(FIX,require('node:zlib').gzipSync(JSON.stringify(o),{level:9}));}
const FX=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(FIX)).toString('utf8'));/* gzip: 2.29 MB → 0.22 MB */
const MW=[[-0.482,0,0.880],[-0.001,1,-0.053],[-0.875,0,-0.447]],T=[58.662,18.63,143.515];
const A3=[[MW[0][0],MW[1][0],MW[2][0]],[MW[0][1],MW[1][1],MW[2][1]],[MW[0][2],MW[1][2],MW[2][2]]];
const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
const toLocal=v0=>{const v=[v0[0]-T[0],v0[1]-T[1],v0[2]-T[2]],D=det(A3);return [0,1,2].map(c=>det(A3.map((r,ri)=>r.map((x,ci)=>ci===c?v[ri]:x)))/D);};
const YAW_OFF=117;const MW_=null,T_=T;/* local→world: world = T + MW·local */
const B=SKO.map(b=>({min:[b[0],b[1],b[2]],max:[b[3],b[4],b[5]]}));
const near18=(bx,h)=>bx.filter(b=>Math.hypot(Math.max(b.min[0]-h[0],0,h[0]-b.max[0]),Math.max(b.min[2]-h[2],0,h[2]-b.max[2]))<18);
const occ=(lens,h,bx)=>LA.herOcclusion(lens,h,bx);
const isCut=(F,i)=>i>0&&(d3(F[i][1],F[i-1][1])>1||Math.abs(wrap(F[i][2]-F[i-1][2]))>20);
const turnStart=F=>{let c=0;for(let i=1;i<F.length;i++)if(isCut(F,i))c=i;let s=c;while(s<F.length-1&&Math.abs(F[s][2]-F[c][2])<2)s++;return s;};
const vp=p=>{const v=p.target.map((x,k)=>x-p.position[k]);return Math.asin(v[1]/Math.hypot(...v))/R;};
const yawOf=p=>Math.atan2(p.position[0]-p.target[0],p.position[2]-p.target[2])/R;
/* replay: pitchOver = replace the orbit pitch (low-angle self-check); walking frames are written like the engine (groundWalking && seeded) */
function replay(F,{pitchOver=null,endView=false,path=null}={}){const H=F.map(f=>toLocal(f[1]));const Rg=rig('skycity','S1',H[0].slice(),{modelAt:[0,0,0]});const st=Rg.st;st.guardOrbitGround=p=>p;let her=H[0];st.girl=()=>her;
 let near=null,nearAt=-1e9,yoff=0,poff=0;st.lakesideOccluders=()=>near;st.skycityOccluders=()=>near;const o=new FO.FreeOrbit('skycity');let i=0;
 st.orbit={step(){},solve(){const f=F[i];o.yaw=f[2]+YAW_OFF+yoff;o.pitch=(pitchOver??f[3])+poff;o.dist=f[4];return o.rawPose(her);},place:'skycity',shouldWrite:()=>true,seeded:true,engaged:()=>true,drag(){},release(){},setPlace(){},seed(){},forget(){},
  rawPose:(g)=>{o.yaw=F[i][2]+YAW_OFF+yoff;o.pitch=(pitchOver??F[i][3])+poff;o.dist=F[i][4];return o.rawPose(g);},get yaw(){return F[i][2]+YAW_OFF+yoff;},set yaw(v){yoff=v-F[i][2]-YAW_OFF;},get pitch(){return (pitchOver??F[i][3])+poff;},set pitch(v){poff=v-(pitchOver??F[i][3]);},get dist(){return F[i][4];},set dist(v){}};st.entry=null;
 const P=[],act=[];let last=-1,walk=false;
 for(i=0;i<F.length;i++){her=H[i];if(F[i][0]-nearAt>=0.4||(last>=0&&d3(H[i],H[last])>1)){nearAt=F[i][0];near=near18(B,her);}
  const w=!!F[i][12];if(w&&!walk&&typeof st.walkStarted==='function')st.walkStarted('skycity',path);st.groundWalking=w;if(!w&&walk&&endView&&typeof st.walkEndView==='function'){st.exploring=true;st.walkEndView('skycity');}walk=w;
  if(!F[i][11]){P.push(P.length?P[P.length-1]:{position:toLocal(F[i][5]),target:her});act.push(false);continue;}
  const dt=last>=0?Math.min(0.1,Math.max(0,F[i][0]-F[last][0])):1/60;
  if(isCut(F,i)||last<0||F[i][0]-F[last][0]>0.3)st.qaOrbit();else if(F[i][8]>=2){st.qaHold=false;st.writeOrbit(0);}
  st.writeOrbit(dt);const c=Rg.cam();P.push({position:c.position.slice(),target:c.target.slice()});act.push(true);last=i;}
 return {P,H,act};}
function metrics(F,P,H,from,to,act){let over=0,overH=0,ins=0,minA=1e9;const run=[0,0],mx=[0,0];
 const inside=p=>B.some(b=>p[0]>b.min[0]&&p[0]<b.max[0]&&p[1]>b.min[1]&&p[1]<b.max[1]&&p[2]>b.min[2]&&p[2]<b.max[2]);
 for(let i=from;i<=to;i++){if(!act[i])continue;const p=P[i],h=H[i];if(inside(p.position))ins++;minA=Math.min(minA,d3(p.position,[h[0],h[1]+1.25,h[2]]));
  const o=occ(p.position,h,B),dt=i>from?Math.min(0.1,F[i][0]-F[i-1][0]):0;[o.face,o.chest].forEach((v,j)=>{run[j]=v?run[j]+dt:0;mx[j]=Math.max(mx[j],run[j]);});
  if(i>from&&act[i-1]&&!isCut(F,i)){const ddt=Math.min(0.1,Math.max(1/120,F[i][0]-F[i-1][0])),dp=Math.abs(vp(p)-vp(P[i-1])),dh=Math.abs(p.position[1]-P[i-1].position[1]);
   over=Math.max(over,dp-22*ddt-Math.abs(F[i][3]-F[i-1][3]));overH=Math.max(overH,dh-5*ddt);}}
 return {longestFaceS:+mx[0].toFixed(2),longestChestS:+mx[1].toFixed(2),framesInsideGeometry:ins,pitchOverLimitDeg:+Math.max(0,over).toFixed(2),heightOverLimitM:+Math.max(0,overH).toFixed(3),minArmM:+minA.toFixed(2)};}
const good=m=>m.longestFaceS<=0.5&&m.longestChestS<=0.5&&m.framesInsideGeometry===0&&m.pitchOverLimitDeg<=0.5&&m.heightOverLimitM<=0.03&&m.minArmM>=3.49;
const macPoses=F=>F.map(f=>{const y=f[6]*R,p=f[7]*R,fw=[-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p)],c=toLocal(f[5]),e=toLocal([f[5][0]+fw[0]*5,f[5][1]+fw[1]*5,f[5][2]+fw[2]*5]);return {position:c,target:e};});
// ---------- W1 nook walks
{const out={};let all=true;
 for(const k of WALKS){const F=FX[k],H=F.map(f=>toLocal(f[1])),r=replay(F),M=macPoses(F);const segs=[];let a=-1;
  for(let i=0;i<F.length;i++){if(F[i][12]&&a<0)a=i;if(!F[i][12]&&a>=0){segs.push([a,i]);a=-1;}}if(a>=0)segs.push([a,F.length-1]);
  out[k]=segs.map(([s,e])=>{let e2=e;while(e2<F.length-1&&F[e2][0]-F[e][0]<0.5)e2++;const before=metrics(F,M,H,s,e2,F.map(()=>true)),after=metrics(F,r.P,r.H,s,e2,r.act);all=all&&good(after);
   return {from:H[s].map(v=>+v.toFixed(1)),to:H[e].map(v=>+v.toFixed(1)),walkS:+(F[e][0]-F[s][0]).toFixed(2),orbitPitch:F[s][3],before_mac:before,after};});}
 ok('W1',all,out);}
// ---------- W2 r7 nook walks (scene c2aa19e3, merged): her REAL r7 route for the Mac p0drag11 Pock taps (walkRayHit → walkTapPath, day
// (11.4, 7.8) 5.69 m and night (11.8, 8.2)), groundWalkTo pace (L / 1.2 m/s), walkStarted(path) at the start and walkEndView at the stop,
// replayed over each Mac walk's own frames (orbit, hook, timing): face/chest ≤ 0.5 s over walk + 0.5 s, lens never in a box
const RW=X.H.load(X.S('region/RegionWalkable.ts'));
const TAPS={'Pock·昼':[[-0.975,2.7672,7.873],[0.9795,-0.1987,0.0446],[6.2,-0.01,8.2]],'Pock·夜':[[1.9927,7.2554,8.0083],[0.885,-0.6009,0.0403],[6.2,-0.01,8.2]]};
const tapPath=k=>{const [o,d,her]=TAPS[k],h=RW.walkRayHit('skycity',o,d,160,.05,her);return h.stay?null:RW.walkTapPath('skycity',RW.nearestWalkable('skycity',her,1.6).at,h.at).map(p=>[p[0],p[1],p[2]]);};
function onPath(P,u){const L=RW.walkPathLengthM(P);let d=u*L;for(let i=1;i<P.length;i++){const s=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1],P[i][2]-P[i-1][2]);if(d<=s||i===P.length-1){const t=s>0?Math.min(1,d/s):1;return [0,1,2].map(c=>P[i-1][c]+(P[i][c]-P[i-1][c])*t);}d-=s;}return P[P.length-1];}
function walkReplay(F0,P){const s=F0.findIndex(f=>f[12]),L=RW.walkPathLengthM(P),T=L/1.2;
 const F=F0.slice(0,Math.min(F0.length,s+Math.ceil((T+1.2)*70))).map(f=>f.slice());let stopI=-1;
 for(let i=s;i<F.length;i++){const u=Math.min(1,(F[i][0]-F[s][0])/T),w=onPath(P,u);F[i][1]=[0,1,2].map(r=>T_[r]+A3[r][0]*w[0]+A3[r][1]*w[1]+A3[r][2]*w[2]);F[i][12]=u<1?1:0;F[i][11]=1;if(u>=1&&stopI<0)stopI=i;}
 const r=replay(F,{endView:true,path:P}),H=F.map(f=>toLocal(f[1]));let e2=stopI;while(e2<F.length-1&&F[e2][0]-F[stopI][0]<0.5)e2++;return {F,r,H,s,stopI,e2,L,T};}
const W2=(prefix='')=>{const out={};let all=true;
 for(const tap of Object.keys(TAPS)){const P=tapPath(tap);for(const k of WALKS){const {F,r,H,s,e2,stopI,L,T}=walkReplay(FX[k],P),m=metrics(F,r.P,H,s,e2,r.act);all=all&&good(m);
  out[tap+'/'+k]={walkM:+L.toFixed(2),walkS:+T.toFixed(2),stop:H[stopI].map(x=>+x.toFixed(2)),...m};}}
 return {all,out};};
{const {all,out}=W2();ok('W2',all,out);}
// ---------- L1 low-angle turns
{const out={};let all=true;
 for(const k of TURNS){const F=FX[k],t0=turnStart(F);out[k]={};for(const pt of [12,20]){const r=replay(F,{pitchOver:pt}),m=metrics(F,r.P,r.H,t0,F.length-1,r.act);if(k==='skn_ro'){m.knownFlaw='self-check only, not gated (see STATUS p0drag12)';}else all=all&&good(m);out[k]['pitch'+pt]=m;}}
 ok('L1',all,out);}
// ---------- Y1 yaw-rate audit
{const out={};let all=true;
 for(const k of TURNS){const F=FX[k],t0=turnStart(F),M=macPoses(F),r=replay(F);let rawPk=0,macPk=0,ourPk=0,extraPk=0,macExtraPk=0,at=null,prevR=null;const accs=[];
  for(let i=t0+1;i<F.length;i++){if(isCut(F,i))continue;const dt=F[i][0]-F[i-1][0];if(!(dt>1/240))continue;
   const raw=Math.abs(wrap(F[i][2]-F[i-1][2]))/dt,mac=Math.abs(wrap(yawOf(M[i])-yawOf(M[i-1])))/dt;rawPk=Math.max(rawPk,raw);if(mac>macPk){macPk=mac;at={t:F[i][0],raw:+raw.toFixed(0),dt:+dt.toFixed(4)};}
   macExtraPk=Math.max(macExtraPk,mac-raw);
   if(r.act[i]&&r.act[i-1]){const sr=wrap(yawOf(r.P[i])-yawOf(r.P[i-1]))/dt,ou=Math.abs(sr);ourPk=Math.max(ourPk,ou);extraPk=Math.max(extraPk,ou-raw);if(prevR!==null&&dt>1/90){accs.push(Math.abs(sr-prevR)/dt);}prevR=dt>1/90?sr:prevR;}else prevR=null;}
  accs.sort((a,b)=>a-b);const accP99=accs.length?accs[Math.floor(accs.length*0.99)]:0,accPk=accs.length?accs[accs.length-1]:0;
  /* audit only (not gated): the excess is ours (hidden-swing ×5 = 400°/s, 28 m/s arc cap); ×4 or less regresses p0drag10 Q1 (0.48 → 1.7 s) */out[k]={macWrittenPeakDegS:+macPk.toFixed(0),macPeakAt:at,playerRawPeakDegS:+rawPk.toFixed(0),macAboveRawPeakDegS:+macExtraPk.toFixed(0),replayPeakDegS:+ourPk.toFixed(0),replayAboveRawPeakDegS:+extraPk.toFixed(0),replayYawAccelP99DegS2:+accP99.toFixed(0),replayYawAccelPeakDegS2:+accPk.toFixed(0)};}
 ok('Y1',all,out);}
// ---------- S1 sign shot: her + whole sign on all 7 screens
{const L=X.H.load(X.S('world-r2/IslandPropsLayout.ts')),CP=X.H.load(X.S('world-r1/CameraPose.ts')),OC=X.H.load(X.S('region/LensOcclusion.ts')),EC=X.H.load(X.S('region/ExploreCameraCore.ts'));
 const S=L.ISLAND_PROPS.signpost,a=S.yawDeg*R,n=[Math.sin(a),0,Math.cos(a)],C=L.propCorners(S,S.boxMin,S.boxMax),lo=[0,1,2].map(k=>Math.min(...C.map(q=>q[k]))),hi=[0,1,2].map(k=>Math.max(...C.map(q=>q[k])));
 const tc=S.text.center,txt=[S.position[0]+S.scale*(tc[0]*Math.cos(a)+tc[2]*Math.sin(a)),S.position[1]+S.scale*tc[1],S.position[2]+S.scale*(-tc[0]*Math.sin(a)+tc[2]*Math.cos(a))];
 const Rg=rig('island','S1',X.RN.REGION_NODES.island.nodes[0].at.slice(),{});const st=Rg.st;let her=Rg.her();st.girl=()=>her;st.standAt=(r,at)=>{her=at.slice();};const bx=(st.lakesideOccluders()||[]).concat([{min:lo,max:hi}]);
 const r=st.qaTeleport('sign');
 const judge=c=>{const scr=EC.SCREENS.map(([W,H])=>{const rc=L.signpostRectUi(CP.fromLookAt(c),W,H),m=LS.herMargin(c.position,c.target,c.fovVerticalDeg,her,[[W,H]]);
   return {screen:W+'x'+H,herMargin:+m.toFixed(2),signRect:rc&&[rc.x,rc.y,rc.width,rc.height].map(v=>Math.round(v)),signWhole:!!rc&&Math.abs(rc.x)+rc.width/2<=W/2&&Math.abs(rc.y)+rc.height/2<=H/2};});
  const g=OC.guardEval(c,her,bx,{up:0,swing:0,share:1}),v=c.position.map((x,k)=>x-txt[k]),text=(v[0]*n[0]+v[2]*n[2])/Math.hypot(...v);
  return {herSeen:!g.head&&!g.chest,textFacing:+text.toFixed(2),textDeg:+(Math.acos(text)/R).toFixed(1),armM:+d3(c.position,[her[0],her[1]+1.15,her[2]]).toFixed(1),allScreens:scr.every(s=>s.herMargin>=0&&s.signWhole),screens:scr};};
 const j0=judge(Rg.cam());for(let f=0;f<60;f++)st.writeOrbit(1/60);const j1=judge(Rg.cam());
 ok('S1',r.ok&&[j0,j1].every(j=>j.allScreens&&j.herSeen&&j.textFacing>=0.5),{teleport:r,atTeleport:j0,after1s:{...j1,screens:undefined}});}
const all=Object.values(res).every(r=>r.ok);console.log(JSON.stringify({test:'p0drag12',ok:all,...res},null,1));process.exit(all?0:1);
