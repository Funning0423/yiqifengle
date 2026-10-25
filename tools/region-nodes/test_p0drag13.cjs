/* p0drag13 (Mac p0drag12 re-test ad4f4cba: sign / taps / nook PASS; FAIL: automatic swing-around peaks 379–507°/s (p95 140–240),
 * ro slow turn at 12° hidden 0.62–0.63 s). Replays of the 2026-10-25 Mac traces (pock1–3 nook walks, po / ro slow turns at 12°, d/n/xd):
 * C1 calibration: replay (this code) vs Mac occlusion flags — reported.
 * R1 our own written yaw (lens yaw about her look point minus the player's raw orbit yaw, steering included) ≤ 120°/s, |accel| ≤ YAW_ACC.
 * O1 turns: face / chest ≤ 0.5 s, lens never in a box, pitch / height easing.  K1 walks (+0.5 s after the stop): same.
 * node tools/region-nodes/test_p0drag13.cjs */
const fs=require('node:fs'),path=require('node:path');
const X=require('./explore-stage-harness.cjs');const {rig,SKO,FO}=X;const LS=X.H.load(X.S('region/LensSmooth.ts')),LA=X.H.load(X.S('region/LensAvoid.ts'));
const res={};const ok=(k,v,o)=>{res[k]={...o,ok:!!v};};
const R=Math.PI/180,d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),wrap=a=>((a%360)+540)%360-180;
const FIX=path.join(__dirname,'fixtures_p0drag13.json.gz'),TR=process.env.QF_P0D12_TRACE||'/workspace/wechat-game/ui-audit/2026-10-25/p0drag12/trace';
const SK=['skd','skn','skxd'],WALKS=SK.flatMap(s=>[1,2,3].map(n=>s+'_pock'+n)),TURNS=SK.flatMap(s=>[s+'_po',s+'_ro']);
if(!fs.existsSync(FIX)){const cut=n=>JSON.parse(fs.readFileSync(path.join(TR,'trace_'+n+'.json'),'utf8')).trace.filter(f=>f.exploring&&f.region==='skycity'&&f.fo&&f.cam)
  .map(f=>[+f.t.toFixed(3),f.her.map(v=>+v.toFixed(3)),+f.fo.yaw.toFixed(2),+f.fo.pitch.toFixed(2),+f.fo.arm.toFixed(3),f.cam.map(v=>+v.toFixed(3)),f.yaw,f.pitch,
   f.w.filter(w=>w==='region.node-lens:orbit').length,f.occFace?1:0,f.occChest?1:0,f.fo.write?1:0,f.walking?1:0]);
 const o={src:'Mac p0drag12 re-test (ggbot/p0drag12-verify ad4f4cba) camTrace: [t, her(world), fo.yaw, fo.pitch, fo.arm, cam(world), yaw, pitch, orbit writes, occFace, occChest, orbit-writing, walking]'};for(const k of [...WALKS,...TURNS])o[k]=cut(k);
 fs.writeFileSync(FIX,require('node:zlib').gzipSync(JSON.stringify(o),{level:9}));require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'fixture_coldelta.cjs'),FIX]);}
const FX0=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(FIX)).toString('utf8'));
/* fixture trimmed 571 → ~183 KB gzip (lossless): column-delta form, rebuilt here into the original rows */
const SC=[1000,1000,1000,1000,100,100,1000,1000,1000,1000,null,null,1,1,1,1,1];
const dec=c=>{const C=c.map((col,j)=>{if(SC[j]==null)return col;let p=0;return col.map(d=>(p+=d)/SC[j]);});return C[0].map((_,i)=>{const v=C.map(col=>col[i]);return [v[0],[v[1],v[2],v[3]],v[4],v[5],v[6],[v[7],v[8],v[9]],v[10],v[11],v[12],v[13],v[14],v[15],v[16]];});};
const FX=FX0.fmt?Object.fromEntries(Object.entries(FX0).map(([k,v])=>[k,Array.isArray(v)?dec(v):v])):FX0;/* gzip: 2.29 MB → 0.22 MB */
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
/* p0drag13: the game hands walkStarted the r7 walk path at the tap — the replay hands it the trace's own walk (her positions until she stops) */
const tracePath=F=>i=>{const out=[];for(let j=i;j<F.length&&F[j][12];j++){const p=toLocal(F[j][1]);if(!out.length||Math.hypot(p[0]-out[out.length-1][0],p[2]-out[out.length-1][2])>0.25)out.push(p);}return out.length>=2?out:null;};
function replay(F,{pitchOver=null,endView=false,path=null}={}){const H=F.map(f=>toLocal(f[1]));const Rg=rig('skycity','S1',H[0].slice(),{modelAt:[0,0,0]});const st=Rg.st;st.guardOrbitGround=p=>p;let her=H[0];st.girl=()=>her;
 let near=null,nearAt=-1e9,yoff=0,poff=0;st.lakesideOccluders=()=>near;st.skycityOccluders=()=>near;st.skycityAllOccluders=()=>B;const o=new FO.FreeOrbit('skycity');let i=0;
 st.orbit={step(){},solve(){const f=F[i];o.yaw=f[2]+YAW_OFF+yoff;o.pitch=(pitchOver??f[3])+poff;o.dist=f[4];return o.rawPose(her);},place:'skycity',shouldWrite:()=>true,seeded:true,engaged:()=>true,drag(){},release(){},setPlace(){},seed(){},forget(){},
  rawPose:(g)=>{o.yaw=F[i][2]+YAW_OFF+yoff;o.pitch=(pitchOver??F[i][3])+poff;o.dist=F[i][4];return o.rawPose(g);},get yaw(){return F[i][2]+YAW_OFF+yoff;},set yaw(v){yoff=v-F[i][2]-YAW_OFF;},get pitch(){return (pitchOver??F[i][3])+poff;},set pitch(v){poff=v-(pitchOver??F[i][3]);},get dist(){return F[i][4];},set dist(v){}};st.entry=null;
 const P=[],act=[],hold=[];let last=-1,walk=false;
 for(i=0;i<F.length;i++){her=H[i];if(F[i][0]-nearAt>=0.4||(last>=0&&d3(H[i],H[last])>1)){nearAt=F[i][0];near=near18(B,her);}
  const w=!!F[i][12];if(w&&!walk&&typeof st.walkStarted==='function')st.walkStarted('skycity',typeof path==='function'?path(i):path);st.groundWalking=w;if(!w&&walk&&endView&&typeof st.walkEndView==='function'){st.exploring=true;st.walkEndView('skycity');}walk=w;
  if(!F[i][11]){P.push(P.length?P[P.length-1]:{position:toLocal(F[i][5]),target:her});act.push(false);continue;}
  const dt=last>=0?Math.min(0.1,Math.max(0,F[i][0]-F[last][0])):1/60;
  if(isCut(F,i)||last<0||F[i][0]-F[last][0]>0.3)st.qaOrbit();else if(F[i][8]>=2){st.qaHold=false;st.writeOrbit(0);}
  st.writeOrbit(dt);const c=Rg.cam();P.push({position:c.position.slice(),target:c.target.slice()});act.push(true);hold[i]=!!st.qaHold;last=i;}
 return {P,H,act,hold};}
function metrics(F,P,H,from,to,act){let over=0,overH=0,ins=0,minA=1e9;const run=[0,0],mx=[0,0];
 const inside=p=>B.some(b=>p[0]>b.min[0]&&p[0]<b.max[0]&&p[1]>b.min[1]&&p[1]<b.max[1]&&p[2]>b.min[2]&&p[2]<b.max[2]);
 for(let i=from;i<=to;i++){if(!act[i])continue;const p=P[i],h=H[i];if(inside(p.position))ins++;minA=Math.min(minA,d3(p.position,[h[0],h[1]+1.25,h[2]]));
  const o=occ(p.position,h,B),dt=i>from?Math.min(0.1,F[i][0]-F[i-1][0]):0;[o.face,o.chest].forEach((v,j)=>{run[j]=v?run[j]+dt:0;mx[j]=Math.max(mx[j],run[j]);});
  if(i>from&&act[i-1]&&!isCut(F,i)){const ddt=Math.min(0.1,Math.max(1/120,F[i][0]-F[i-1][0])),dp=Math.abs(vp(p)-vp(P[i-1])),dh=Math.abs(p.position[1]-P[i-1].position[1]);
   over=Math.max(over,dp-22*ddt-Math.abs(F[i][3]-F[i-1][3]));overH=Math.max(overH,dh-5*ddt);}}
 return {longestFaceS:+mx[0].toFixed(2),longestChestS:+mx[1].toFixed(2),framesInsideGeometry:ins,pitchOverLimitDeg:+Math.max(0,over).toFixed(2),heightOverLimitM:+Math.max(0,overH).toFixed(3),minArmM:+minA.toFixed(2)};}
const good=m=>m.longestFaceS<=0.5&&m.longestChestS<=0.5&&m.framesInsideGeometry===0&&m.pitchOverLimitDeg<=0.5&&m.heightOverLimitM<=0.03&&m.minArmM>=3.49;
const macPoses=F=>F.map(f=>{const y=f[6]*R,p=f[7]*R,fw=[-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p)],c=toLocal(f[5]),e=toLocal([f[5][0]+fw[0]*5,f[5][1]+fw[1]*5,f[5][2]+fw[2]*5]);return {position:c,target:e};});

const YAW_MAX=120,YAW_ACC=Number(process.env.QF_YAW_ACC||600);
const ourYaw=(F,r,from,to)=>{const rates=[],accs=[];let pr=null;
 for(let i=Math.max(1,from);i<=to;i++){if(!r.act[i]||!r.act[i-1]||isCut(F,i)){pr=null;continue;}const dt=F[i][0]-F[i-1][0];if(!(dt>1/240)){continue;}
  const L=h=>[h[0],h[1]+1.15,h[2]],yw=(p,h)=>Math.atan2(p[0]-L(h)[0],p[2]-L(h)[2])/R;
  const w=wrap(yw(r.P[i].position,r.H[i])-yw(r.P[i-1].position,r.H[i-1])),raw=wrap(F[i][2]-F[i-1][2]),o=wrap(w-raw)/dt;rates.push(Math.abs(o));
  if(pr!==null)accs.push(Math.abs(o-pr)/Math.max(dt,1/90));pr=o;}
 const q=(a,p)=>{if(!a.length)return 0;const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(b.length*p))];};
 return {oursPeakDegS:+q(rates,1).toFixed(0),oursP99DegS:+q(rates,0.99).toFixed(0),oursP95DegS:+q(rates,0.95).toFixed(0),accPeakDegS2:+q(accs,1).toFixed(0),accP99DegS2:+q(accs,0.99).toFixed(0)};};
const macOcc=(F,from,to)=>{const run=[0,0],mx=[0,0];for(let i=from+1;i<=to;i++){const dt=Math.min(0.1,F[i][0]-F[i-1][0]);[F[i][9],F[i][10]].forEach((v,j)=>{run[j]=v?run[j]+dt:0;mx[j]=Math.max(mx[j],run[j]);});}return {macFaceS:+mx[0].toFixed(2),macChestS:+mx[1].toFixed(2)};};
const rateOk=y=>y.oursPeakDegS<=YAW_MAX+1&&y.accPeakDegS2<=YAW_ACC*1.05;
/* p0drag13 hook rule (owner decision 2026-10-25 04:58): a QA hook (__qfAimAt / __qfTeleport) parks the lens at a test-only pose and holds
 * it (p0drag10 Q2) until the player turns the orbit ≥ 2°. Real players never start there, and the standing rule never parks her hidden.
 * So: hookHiddenS (hidden while the hook held) is REPORTED only; releaseToClearS (release → first frame face+chest clear) is gated at
 * the physical minimum of the eased cap for the swing that was needed (nearest clear yaw at release, box-free arc; trapezoid V, A) + 0.15 s;
 * occlusion is gated (≤ 0.5 s) from that first clear frame on. */
const hookRule=(F,r,t0,end,V,A)=>{let cut=0;for(let i=1;i<=t0;i++)if(isCut(F,i))cut=i;let rel=t0;while(rel<end&&(!r.act[rel]||r.hold[rel]))rel++;
 const hid=i=>{const o=occ(r.P[i].position,r.H[i],B);return o.face||o.chest;},inside=p=>B.some(b=>p[0]>b.min[0]&&p[0]<b.max[0]&&p[1]>b.min[1]&&p[1]<b.max[1]&&p[2]>b.min[2]&&p[2]<b.max[2]);
 let hk=0;for(let i=Math.max(cut,1);i<rel;i++)if(r.act[i]&&hid(i))hk+=Math.min(0.1,F[i][0]-F[i-1][0]);
 let fc=rel;while(fc<end&&(!r.act[fc]||hid(fc)))fc++;
 let th=0;if(hid(rel)){const h=r.H[rel],L=[h[0],h[1]+1.15,h[2]],p0=r.P[rel].position,dx=p0[0]-L[0],dy=p0[1]-L[1],dz=p0[2]-L[2],arm=Math.hypot(dx,dy,dz),el=Math.asin(dy/arm),y0=Math.atan2(dx,dz);
  th=1e9;for(const sg of [1,-1])for(let dd=1;dd<=180;dd++){const y=y0+sg*dd*R,p=[L[0]+Math.sin(y)*Math.cos(el)*arm,L[1]+Math.sin(el)*arm,L[2]+Math.cos(y)*Math.cos(el)*arm];if(inside(p))break;const o=occ(p,h,B);if(!o.face&&!o.chest){th=Math.min(th,dd);break;}}}
 const tmin=th<=0?0:th>=1e9?Infinity:(th>V*V/A?th/V+V/A:2*Math.sqrt(th/A));
 return {rel,fc,hookHiddenS:+hk.toFixed(2),swingNeededDeg:th>=1e9?null:th,releaseToClearS:+(F[fc][0]-F[rel][0]).toFixed(2),physMinS:+tmin.toFixed(2),releaseOk:(F[fc][0]-F[rel][0])<=tmin+0.15};};
const res2={turns:{},walks:{}};let okO=true,okK=true,okR=true;
for(const k of TURNS){const F=FX[k],t0=turnStart(F),r=replay(F),hr=hookRule(F,r,t0,F.length-1,LS.LENS_SMOOTH.yawOursDegS,LS.LENS_SMOOTH.yawAccDegS2),m=metrics(F,r.P,r.H,hr.fc,F.length-1,r.act),y=ourYaw(F,r,t0,F.length-1);okO=okO&&good(m)&&hr.releaseOk;okR=okR&&rateOk(y);const {rel,fc,...hrr}=hr;res2.turns[k]={...macOcc(F,t0,F.length-1),...hrr,...m,...y};}
for(const k of WALKS){const F=FX[k],s=F.findIndex(f=>f[12]);if(s<0){res2.walks[k]={noWalk:true};continue;}let e=s;while(e<F.length-1&&F[e][12])e++;let e2=e;while(e2<F.length-1&&F[e2][0]-F[e][0]<0.5)e2++;
 const r=replay(F,{endView:true,path:tracePath(F)}),m=metrics(F,r.P,r.H,s,e2,r.act),y=ourYaw(F,r,s,e2);okK=okK&&good(m);okR=okR&&rateOk(y);res2.walks[k]={walkS:+(F[e][0]-F[s][0]).toFixed(2),...macOcc(F,s,e2),...m,...y};}
ok('O1',okO,res2.turns);ok('K1',okK,res2.walks);ok('R1',okR,{limitDegS:YAW_MAX,accLimitDegS2:YAW_ACC});
const all=Object.values(res).every(r=>r.ok);console.log(JSON.stringify({test:'p0drag13',ok:all,...res},null,1));process.exit(all?0:1);
