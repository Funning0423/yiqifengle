/* p0drag9 (Mac p0drag8 sx2d, skycity walk-local (13,7.4), slow full turn ro0–ro15, 353–372 s):
 *  R1 replay of the trace's FreeOrbit yaw/pitch/arm (raw input) through the real writeOrbit with the real SKYCITY_LENS_OCCLUDERS:
 *     view-pitch rate ≤ 40°/s and lens height rate ≤ 4 m/s every frame (trace dt; Mac frame gaps reach 0.1 s), max pitch change between ro samples (1.17 s) ≤ 26°,
 *     her body inside the safe margins (12 %) on all 7 screens every frame (min margin ≥ 0), arm ≥ 3.5 m, view pitch ≥ −58°,
 *     her face/chest sight line blocked: not more than the Mac's run + 15 frames (she stands in a nook: no clear lens direction
 *     exists for ~150° of yaw at any arm 3.5–7.3 m / elevation ≤ 58°, see STATUS). The Mac numbers (before) are computed the same way from the trace.
 *  R2 OffsetSmoother: a 24° elevation step is eased (≤ 22°/s, no overshoot > 1°), a fresh smoother takes the first value as is.
 *  R3 frameHer: an off-axis target that puts her off the 320×568 screen is re-aimed to margin ≥ 0; a centred one is returned unchanged.
 * node tools/region-nodes/test_p0drag9.cjs */
const fs=require('node:fs'),path=require('node:path');
const X=require('./explore-stage-harness.cjs');const {rig,SKO,FO}=X;const LS=X.H.load(X.S('region/LensSmooth.ts'));
const res={};const ok=(k,v,o)=>{res[k]={...o,ok:!!v};};
const R=Math.PI/180,d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const FIX=path.join(__dirname,'fixtures_p0drag9.json'),TR=process.env.QF_P0D8_TRACE||'/workspace/wechat-game/ui-audit/2026-10-24/p0drag8/trace';
if(!fs.existsSync(FIX)){const tr=JSON.parse(fs.readFileSync(path.join(TR,'trace_sx2d.json'),'utf8')).trace.filter(f=>f.t>=353&&f.t<=372);
 fs.writeFileSync(FIX,JSON.stringify({src:'Mac p0drag8 trace_sx2d 353–372 s (engine camTrace); ro samples from log_sx2d.out',
  ro:[354.585,355.751,356.818,357.984,359.149,360.284,361.417,362.583,363.751,364.917,366.084,367.249,368.417,369.551,370.716,371.884],
  f:tr.map(f=>[+f.t.toFixed(3),f.her,f.fo.yaw,f.fo.pitch,f.fo.arm,f.cam,f.yaw,f.pitch])}));}
const FX=JSON.parse(fs.readFileSync(FIX,'utf8')),F=FX.f;
const MW=[[-0.482,0,0.880],[-0.001,1,-0.053],[-0.875,0,-0.447]],T=[58.662,18.63,143.515];
const A3=[[MW[0][0],MW[1][0],MW[2][0]],[MW[0][1],MW[1][1],MW[2][1]],[MW[0][2],MW[1][2],MW[2][2]]];
const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
const toLocal=w=>{const d=[w[0]-T[0],w[1]-T[1],w[2]-T[2]],D=det(A3);return [0,1,2].map(c=>det(A3.map((r,ri)=>r.map((v,ci)=>ci===c?d[ri]:v)))/D);};
const dirLocal=v=>{const D=det(A3);return [0,1,2].map(c=>det(A3.map((r,ri)=>r.map((x,ci)=>ci===c?v[ri]:x)))/D);};
const YAW_OFF=117;/* world orbit yaw → walk-local (fitted on idle frames, residual from the Mac's own avoidance) */
const B=SKO.map(b=>({min:[b[0],b[1],b[2]],max:[b[3],b[4],b[5]]}));
const inB=(a,b)=>a[0]>=b.min[0]&&a[0]<=b.max[0]&&a[1]>=b.min[1]&&a[1]<=b.max[1]&&a[2]>=b.min[2]&&a[2]<=b.max[2];
const segHit=(a,c)=>B.some(b=>{if(inB(a,b)||inB(c,b))return false;/* boxes holding the lens or her own point do not count */let t0=0,t1=1;
 for(let k=0;k<3;k++){const d=c[k]-a[k];if(Math.abs(d)<1e-9){if(a[k]<b.min[k]||a[k]>b.max[k])return false;continue;}let u=(b.min[k]-a[k])/d,v=(b.max[k]-a[k])/d;if(u>v){const s=u;u=v;v=s;}t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return false;}return true;});
function metrics(poses,hers,tag=""){let mp=0,mh=0,mpr=0,mhr=0,mm=1e9,ma=1e9,minP=1e9,runBl=0,maxBl=0;const vp=p=>{const v=p.target.map((x,k)=>x-p.position[k]);return Math.asin(v[1]/Math.hypot(...v))/R;};
 for(let i=0;i<poses.length;i++){const p=poses[i],h=hers[i],look=[h[0],h[1]+1.25,h[2]];minP=Math.min(minP,vp(p));ma=Math.min(ma,d3(p.position,look));
  mm=Math.min(mm,LS.herMargin(p.position,p.target,48,h));
  const bl=segHit(p.position,[h[0],h[1]+1.45,h[2]])&&segHit(p.position,[h[0],h[1]+1.05,h[2]]);runBl=bl?runBl+1:0;maxBl=Math.max(maxBl,runBl);
  if(i){const dt=Math.max(1/120,F[i][0]-F[i-1][0]),a=Math.abs(vp(p)-vp(poses[i-1])),b=Math.abs(p.position[1]-poses[i-1].position[1]);mp=Math.max(mp,a);mh=Math.max(mh,b);mpr=Math.max(mpr,a/dt);mhr=Math.max(mhr,b/dt);}}
 const ro=FX.ro.map(t=>{let j=0;while(j<F.length-1&&F[j][0]<t)j++;return j;});let mr=0,mrh=0;
 for(let i=1;i<ro.length;i++){mr=Math.max(mr,Math.abs(vp(poses[ro[i]])-vp(poses[ro[i-1]])));mrh=Math.max(mrh,poses[ro[i]].position[1]-poses[ro[i-1]].position[1]);}
 const roMargin=ro.map(j=>+LS.herMargin(poses[j].position,poses[j].target,48,hers[j]).toFixed(2));
 return {maxPitchStepDeg:+mp.toFixed(2),maxHeightStepM:+mh.toFixed(3),maxPitchRateDegS:+mpr.toFixed(1),maxHeightRateMS:+mhr.toFixed(2),maxRoPitchChangeDeg:+mr.toFixed(1),maxRoLiftM:+mrh.toFixed(2),minHerMargin:+mm.toFixed(2),roMargins:roMargin,minArmM:+ma.toFixed(2),minViewPitchDeg:+minP.toFixed(1),maxFaceChestBlockedFrames:maxBl};}
// ---------- R1
{
 const hers=F.map(f=>toLocal(f[1]));
 // before: the Mac's written poses (engine euler → forward), in walk-local
 const mac=F.map(f=>{const y=f[6]*R,p=f[7]*R,fw=[-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p)],c=toLocal(f[5]),d=dirLocal(fw);return {position:c,target:[c[0]+d[0]*5,c[1]+d[1]*5,c[2]+d[2]*5]};});
 const before=metrics(mac,hers);
 const Rg=rig('skycity','S1',hers[0].slice(),{modelAt:[0,0,0]});const st=Rg.st;st.guardOrbitGround=p=>p;let her=hers[0];st.girl=()=>her;
 let near=null;st.lakesideOccluders=()=>near;st.skycityOccluders=()=>near;
 const o=new FO.FreeOrbit('skycity');let i=0;
 st.orbit={step(){},solve(){const f=F[i];o.yaw=f[2]+YAW_OFF;o.pitch=f[3];o.dist=f[4];return o.rawPose(her);},place:'skycity',shouldWrite:()=>true,seeded:true,engaged:()=>true};
 st.entry=null;st.avoid={sw:0,e:0,tsw:0,te:0,clear:0,wait:0,py:NaN};const poses=[];const ms=[];
 for(i=0;i<F.length;i++){her=hers[i];if(i%24===0)near=B.filter(b=>Math.hypot(Math.max(b.min[0]-her[0],0,her[0]-b.max[0]),Math.max(b.min[2]-her[2],0,her[2]-b.max[2]))<18);
  const dt=i?Math.min(0.1,Math.max(1/120,F[i][0]-F[i-1][0])):1/60;const t0=process.hrtime.bigint();st.writeOrbit(dt);ms.push(Number(process.hrtime.bigint()-t0)/1e6);
  const c=Rg.cam();poses.push({position:c.position.slice(),target:c.target.slice()});}
 const after=metrics(poses,hers,"A");ms.sort((a,b)=>a-b);
 ok('R1',after.maxPitchRateDegS<=40&&after.maxHeightRateMS<=4&&after.maxRoPitchChangeDeg<=26&&after.minHerMargin>=0&&after.minArmM>=3.5&&after.minViewPitchDeg>=-58.01&&after.maxFaceChestBlockedFrames<=before.maxFaceChestBlockedFrames+15,
  {frames:F.length,her:hers[0].map(v=>+v.toFixed(2)),boxes:SKO.length,before_mac:before,after,perf:{avgMs:+(ms.reduce((a,b)=>a+b)/ms.length).toFixed(3),p99Ms:+ms[Math.floor(ms.length*.99)].toFixed(2)}});
}
// ---------- R2
{
 const s=new LS.OffsetSmoother();const first=s.step(0,0,0,1/60);let e=0,maxRate=0,over=0;
 for(let k=0;k<240;k++){const r=s.step(0,24,0,1/60);maxRate=Math.max(maxRate,(r[1]-e)*60);e=r[1];over=Math.max(over,e-24);}
 ok('R2',first[1]===0&&maxRate<=22.01&&over<=1&&Math.abs(e-24)<0.5,{maxElevRateDegS:+maxRate.toFixed(2),overshootDeg:+over.toFixed(2),endDeg:+e.toFixed(2)});
}
// ---------- R3
{
 const feet=[0,0,0],pos=[0,2,6],centred=[0,0.8,0],off=[3.5,0.8,0];
 const a=LS.frameHer(pos,centred,48,feet),b=LS.frameHer(pos,off,48,feet);
 ok('R3',a===centred&&LS.herMargin(pos,off,48,feet)<0&&LS.herMargin(pos,b,48,feet)>=-1e-3,{offMarginBefore:+LS.herMargin(pos,off,48,feet).toFixed(2),after:+LS.herMargin(pos,b,48,feet).toFixed(3)});
}
const all=Object.values(res).every(r=>r.ok);console.log(JSON.stringify({test:'p0drag9',ok:all,...res},null,1));process.exit(all?0:1);
