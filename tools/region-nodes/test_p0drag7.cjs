'use strict';
/* p0drag7 — Mac p0drag6 (42d0982f) FAIL items, reproduced through the real RegionNodeStage / FreeOrbit / LensGuard code with the
 * real engine trace data (ui-audit/2026-10-24/p0drag6). NOT ENGINE (stubbed scene; walk-local = world here).
 *  K1 skycity entry after the node snap (her (-18,1,57)-ish → nearest node; board shot ~29 m off, looking past her): within 0.1 s the
 *     writer is orbit+entry; after the glide (≤ 2.5 s) the arm is in [3.5, 12.5] m and she is on screen (≤ 20° off the view axis).
 *  K2 lakeside arm under a STANDING replay of trace_lake_walkdrag 203.3–208.3 s (the raw orbit poses the engine wrote, with the
 *     9.1 ↔ 5.7 m single-frame flips): the written arm never changes by more than 0.25 m in a frame (≤ 15 m/s at 60 fps; was 3.3 m).
 *  K3 skycity east (walk-local 13.22,1.17,9.16; Mac o0 yaw −78 / o1 yaw 5 / o5 yaw −25 lens positions): the written lens is outside
 *     every house proxy, the arm stays ≥ 3.5 m and the elevation ≤ 58° (climb / swing; a crossed sight line is reported, accepted).
 *  K4 camTrace records every frame in explore (update → traceFrame), ≥ 1 row per update.
 * node tools/region-nodes/test_p0drag7.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const X=require('./explore-stage-harness.cjs');const {rig,CT,SKO,setScene}=X;
const res={};const ok=(k,v,o)=>{res[k]={...o,ok:!!v};};
const DT=1/60,d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
// ---------- K1
{
 const REG=X.H.load(X.S('region/RegionNodes.ts')).REGION_NODES.skycity.nodes;
 const off=[-19.42,1.02,57.59];/* Mac skn snapIn: world (17.63,19.65,100.63) at 17 ms → walk-local; snapped to (4.3,-0.11,44.44) */
 const R=rig('skycity','S1',off,{modelAt:[0,0,0],seed:h=>({position:[h[0]+4,h[1]+16,h[2]+26],target:[h[0]+6,h[1]+14,h[2]-10],fovVerticalDeg:48})});
 const st=R.st;let her=R.her();
 st.character={cancelAndReset:o=>{her[0]=o.controllerRoot[0];her[1]=o.controllerRoot[1];her[2]=o.controllerRoot[2];}};st.girl=()=>her;
 Object.assign(st,{exploreCheck:1,exploreArmed:{skycity:true},explorePrev:'level',syncOpened:null,syncCams:[],cover:null,ensureCharacter:()=>true,camera:{enabled:true}});
 setScene({getComponentsInChildren:()=>[],find:()=>null});
 const WM={m12:0,m13:0,m14:0,clone(){return {...WM};}};const skyModel={worldMatrix:WM,activeInHierarchy:true,getComponentsInChildren:()=>[]};st.model=r=>r==='skycity'?skyModel:null;
 st.flow=()=>({commands:()=>({snapshot:()=>({state:'skycity',hidden:false,needsResume:false,journey:{region:'skycity',phase:'arrived'}})})});
 st.exploring=false;st.lens='Board';st.orbit.forget();
 const subs=[];const prev=globalThis.__qfCamTraceSub;globalThis.__qfCamTraceSub=s=>subs.push(s);
 st.syncExplore(0.3);const snapped=d3(her,off)>1;
 const early=[];for(let i=0;i<6;i++){subs.length=0;st.tickLens(DT);early.push(subs.slice());}
 for(let i=0;i<200;i++)st.tickLens(DT);
 globalThis.__qfCamTraceSub=prev;
 const cam=R.cam(),look=[her[0],her[1]+1.25,her[2]],arm=d3(cam.position,look);
 const f=cam.target.map((v,i)=>v-cam.position[i]),h=look.map((v,i)=>v-cam.position[i]);
 const off2=Math.acos(Math.max(-1,Math.min(1,(f[0]*h[0]+f[1]*h[1]+f[2]*h[2])/(Math.hypot(...f)*Math.hypot(...h)))))*180/Math.PI;
 ok('K1',snapped&&early.every(s=>s.some(x=>/^orbit(\+entry)?$/.test(x)))&&arm>=3.5&&arm<=12.5&&off2<=20,{snapped,her:her.map(v=>+v.toFixed(2)),earlyWriters:[...new Set(early.flat())],armM:+arm.toFixed(2),herOffAxisDeg:+off2.toFixed(1),nodes:REG.length});
}
// ---------- K2
{
 const F=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures_lake_walkdrag_203.json'),'utf8')).frames;
 const R=rig('lakeside','S1',F[0][2].slice(),{});const st=R.st;let her=F[0][2].slice();st.girl=()=>her;
 st.lakesideOccluders=()=>null;st.occlude=p=>p;st.guardOrbitGround=p=>p;/* replay the engine's written poses as the raw orbit output */
 let i=0;st.orbit={step(){},solve(){const fr=F[i];return {position:fr[1].slice(),target:[fr[2][0],fr[2][1]+1.15,fr[2][2]],fovVerticalDeg:48};},place:'lakeside',shouldWrite:()=>true,seeded:true,engaged:()=>true};
 st.entry=null;let prevArm=null,maxJump=0,rawMax=0,prevRaw=null;
 for(i=0;i<F.length;i++){her=F[i][2].slice();st.writeOrbit(DT);const look=[her[0],her[1]+1.15,her[2]],a=d3(R.cam().position,look),ra=d3(F[i][1],look);
  if(prevArm!==null){maxJump=Math.max(maxJump,Math.abs(a-prevArm));rawMax=Math.max(rawMax,Math.abs(ra-prevRaw));}prevArm=a;prevRaw=ra;}
 ok('K2',maxJump<=0.25&&rawMax>3,{frames:F.length,rawMaxArmJumpM:+rawMax.toFixed(2),writtenMaxArmJumpM:+maxJump.toFixed(3)});
}
// ---------- K3
{
 const MW=[[-0.482,0,0.880],[-0.001,1,-0.053],[-0.875,0,-0.447]],T=[58.662,18.63,143.515];/* walk-local → world, fitted to the Mac E0–E3 table (residual 0.00) */
 const toLocal=w=>{const d=[w[0]-T[0],w[1]-T[1],w[2]-T[2]];// solve R^T x = d with R rows MW
  const A=[[MW[0][0],MW[1][0],MW[2][0]],[MW[0][1],MW[1][1],MW[2][1]],[MW[0][2],MW[1][2],MW[2][2]]];
  const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const D=det(A);return [0,1,2].map(c=>det(A.map((r,ri)=>r.map((v,ci)=>ci===c?d[ri]:v)))/D);};
 const herL=[13.22,1.17,9.16],shots={o0:[37.42,23.2,152.5],o1:[44.88,24.24,157.99],o5:[41.33,23.29,157.36]};
 const R=rig('skycity','S1',herL.slice(),{modelAt:[0,0,0]});const st=R.st;st.guardOrbitGround=p=>p;st.occBoxes=null;
 const out={};let all=true;const inside=(p,b)=>p[0]>b[0]&&p[0]<b[3]&&p[1]>b[1]&&p[1]<b[4]&&p[2]>b[2]&&p[2]<b[5];
 const crosses=(a,c,b)=>{let t0=0,t1=1;for(let k=0;k<3;k++){const d=c[k]-a[k];if(Math.abs(d)<1e-9){if(a[k]<b[k]||a[k]>b[k+3])return false;continue;}let u=(b[k]-a[k])/d,v=(b[k+3]-a[k])/d;if(u>v){const s=u;u=v;v=s;}t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return false;}return true;};
 for(const [k,w] of Object.entries(shots)){const p=toLocal(w),look=[herL[0],herL[1]+1.25,herL[2]];
  st.orbit={step(){},solve:()=>({position:p.slice(),target:look.slice(),fovVerticalDeg:48}),place:'skycity',shouldWrite:()=>true,seeded:true,engaged:()=>true};
  st.armSmooth=new X.AS.ArmSmoother();st.avoid={sw:0,e:0,tsw:0,te:0,clear:0};st.entry=null;for(let f=0;f<150;f++)st.writeOrbit(DT);/* p0drag8: avoidance is rate-limited: settle 2.5 s */const q=R.cam().position;
  const rawIn=SKO.filter(b=>inside(p,b)).length,inBox=SKO.filter(b=>inside(q,b)).length,cross=SKO.filter(b=>!inside(look,b)&&crosses(look,q,b)).length;
  out[k]={rawLocal:p.map(v=>+v.toFixed(2)),rawInsideProxies:rawIn,lens:q.map(v=>+v.toFixed(2)),insideProxies:inBox,segmentCrosses:cross,armM:+d3(q,look).toFixed(2)};
  const el=Math.asin((q[1]-look[1])/d3(q,look))*180/Math.PI;out[k].elevDeg=+el.toFixed(1);
  all=all&&inBox===0&&out[k].armM>=3.5&&el<=58.01;/* p0drag8: a crossed sight line is the accepted last resort (dense 2112-box set) */}
 ok('K3',all&&SKO.length>0,{proxies:SKO.length,...out});
}
// ---------- K4
{
 const R=rig('lakeside','S1',null,{});const st=R.st;CT.camTraceInit('?camTrace=1');
 Object.assign(st,{ensureCharacter:()=>true,exploreCheck:0,exploreArmed:{},explorePrev:null,flow:()=>null,hideTree:false,markerClock:0,holdPulse:0,pulses:[],markerWait:0,cover:null,syncOpened:null,
  camera:{node:{isValid:true,worldPosition:{x:0,y:5,z:5},forward:{x:0,y:-0.5,z:-0.8}}},character:{diagnostics:()=>({motion:{yawDeg:10,state:'idle'}})}});
 const n0=CT.camTrace.frames.length;let ran=0;try{for(let i=0;i<30;i++){st.update(DT);ran++;}}catch(e){res.K4err=String(e.message||e);}
 const rows=CT.camTrace.frames.length-n0;CT.camTraceInit('');
 ok('K4',ran===30&&rows>=30,{updates:ran,rows});
}
const fails=Object.keys(res).filter(k=>res[k]&&res[k].ok===false);
fs.mkdirSync(path.join(__dirname,'../journey-integration/reports'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../journey-integration/reports/p0drag7.json'),JSON.stringify({status:fails.length?'FAIL':'PASS',scope:'NOT ENGINE: real stage code, real Mac trace data',res},null,1));
console.log(JSON.stringify(res));assert.equal(fails.length,0,'p0drag7 failing: '+fails.join(','));console.log('p0drag7: ok');
