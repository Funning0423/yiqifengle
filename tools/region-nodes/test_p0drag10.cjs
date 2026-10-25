/* p0drag10 (Mac p0drag9 579952ac FAIL): replay the REAL Mac traces trace_skxd_ro (slow full turn at (9,7.8)) and trace_skxd_pock
 * (at (8.6,8.2)) through the real writeOrbit, the way the engine drives it:
 *   - every frame the trace lists TWO orbit writes ('region.node-lens:orbit' ×2) was a drag event: aimOrbit → writeOrbit(0) BEFORE the
 *     tick's writeOrbit(dt)  ← the 936a3309 gap: LensSmooth.step(dt = 0) RESET the smoother to the raw avoidance target (jump);
 *   - dt = the trace's frame gap clamped to 0.1 s; box set = 18 m near set re-taken every 400 ms of trace time.
 * Q1 per frame: |Δ view pitch| ≤ 22°/s·dt + |Δ raw orbit pitch| + 0.5°, |Δ height| ≤ 5 m/s·dt + 0.03 m; per 0.25 s window: Δpitch ≤ 7°,
 *    Δheight ≤ 1.3 m (on top of the player's own raw change); lens never inside a proxy box; longest face+chest occlusion ≤ 0.5 s;
 *    her body inside the safe margins on all 7 screens; arm ≥ 3.5 m; view pitch ≥ −58°. Mac numbers (before) computed the same way.
 * Q2 hooks stick: after __qfTeleport(key,yaw) the camera yaw stays within 3° of yaw for 3 s although that yaw is blocked (no avoidance
 *    swing), until a manual drag; then avoidance resumes.
 * Q3 'sign' teleport looks at the signpost's FRONT (text side): the lens is on the side the sign faces (ISLAND_PROPS.signpost.yawDeg).
 * Q4 camTrace gets occFace / occChest per frame.
 * node tools/region-nodes/test_p0drag10.cjs */
const fs=require('node:fs'),path=require('node:path');
const X=require('./explore-stage-harness.cjs');const {rig,SKO,FO}=X;const LS=X.H.load(X.S('region/LensSmooth.ts'));
const res={};const ok=(k,v,o)=>{res[k]={...o,ok:!!v};};
const R=Math.PI/180,d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const FIX=path.join(__dirname,'fixtures_p0drag10.json'),TR=process.env.QF_P0D9_TRACE||'/workspace/wechat-game/ui-audit/2026-10-24/p0drag9/trace';
if(!fs.existsSync(FIX)){const cut=n=>JSON.parse(fs.readFileSync(path.join(TR,n),'utf8')).trace.filter(f=>f.exploring&&f.region==='skycity'&&f.fo)
  .map(f=>[+f.t.toFixed(3),f.her.map(v=>+v.toFixed(3)),+f.fo.yaw.toFixed(2),+f.fo.pitch.toFixed(2),+f.fo.arm.toFixed(3),f.cam.map(v=>+v.toFixed(3)),f.yaw,f.pitch,f.w.filter(w=>w==='region.node-lens:orbit').length]);
 fs.writeFileSync(FIX,JSON.stringify({src:'Mac p0drag9 trace_skxd_ro / trace_skxd_pock (engine camTrace)',ro:cut('trace_skxd_ro.json'),pock:cut('trace_skxd_pock.json')}));}
const FX=JSON.parse(fs.readFileSync(FIX,'utf8'));
const MW=[[-0.482,0,0.880],[-0.001,1,-0.053],[-0.875,0,-0.447]],T=[58.662,18.63,143.515];
const A3=[[MW[0][0],MW[1][0],MW[2][0]],[MW[0][1],MW[1][1],MW[2][1]],[MW[0][2],MW[1][2],MW[2][2]]];
const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
const solve=v=>{const D=det(A3);return [0,1,2].map(c=>det(A3.map((r,ri)=>r.map((x,ci)=>ci===c?v[ri]:x)))/D);};
const toLocal=w=>solve([w[0]-T[0],w[1]-T[1],w[2]-T[2]]);
const YAW_OFF=117;
const B=SKO.map(b=>({min:[b[0],b[1],b[2]],max:[b[3],b[4],b[5]]}));
const LA=X.H.load(X.S('region/LensAvoid.ts'));
const occ=(lens,h)=>{const f=[h[0],h[1]+1.45,h[2]],c=[h[0],h[1]+1.05,h[2]];return {face:LA.lensLevel(f,lens,B,0)>0,chest:LA.lensLevel(c,lens,B,0)>0};};/* = LensAvoid.herOcclusion (p0drag10); local so 936a3309 scores the same */
const inside=p=>B.some(b=>p[0]>b.min[0]&&p[0]<b.max[0]&&p[1]>b.min[1]&&p[1]<b.max[1]&&p[2]>b.min[2]&&p[2]<b.max[2]);
const cutAt=(F,hers,i)=>i>0&&(d3(hers[i],hers[i-1])>1||Math.abs(((F[i][2]-F[i-1][2])%360+540)%360-180)>20);/* hook cut: excluded from the step / window limits (intentional) */
function metrics(F,poses,hers,hold){const cut=F.map((_,i)=>cutAt(F,hers,i));const vp=p=>{const v=p.target.map((x,k)=>x-p.position[k]);return Math.asin(v[1]/Math.hypot(...v))/R;};
 let mp=0,mh=0,over=0,overH=0,ins=0,run=0,maxRun=0,maxHook=0,runAny=false,runHook=false,mm=1e9,ma=1e9,minP=1e9,w25p=0,w25h=0;
 for(let i=0;i<poses.length;i++){const p=poses[i],h=hers[i],look=[h[0],h[1]+1.25,h[2]];
  if(inside(p.position))ins++;const o=occ(p.position,h);if(o.face&&o.chest){if(!run&&!runAny)runHook=!!(hold&&hold[i]);runAny=true;run+=i?Math.min(0.1,F[i][0]-F[i-1][0]):0;if(runHook)maxHook=Math.max(maxHook,run);else maxRun=Math.max(maxRun,run);}else{run=0;runAny=false;}
  mm=Math.min(mm,LS.herMargin(p.position,p.target,48,h));ma=Math.min(ma,d3(p.position,look));minP=Math.min(minP,vp(p));
  if(i&&!cut[i]&&d3(h,hers[i-1])<0.02){const dt=Math.min(0.1,Math.max(1/120,F[i][0]-F[i-1][0])),dp=Math.abs(vp(p)-vp(poses[i-1])),dh=Math.abs(p.position[1]-poses[i-1].position[1]);
   mp=Math.max(mp,dp);mh=Math.max(mh,dh);over=Math.max(over,dp-22*dt-Math.abs(F[i][3]-F[i-1][3]));overH=Math.max(overH,dh-5*dt);}
  let j=i;while(j>0&&!cut[j]&&F[i][0]-F[j-1][0]<=0.25&&d3(hers[j-1],h)<0.05)j--;if(j<i){w25p=Math.max(w25p,Math.abs(vp(p)-vp(poses[j]))-Math.abs(F[i][3]-F[j][3]));w25h=Math.max(w25h,Math.abs(p.position[1]-poses[j].position[1]));}}
 return {frames:poses.length,maxPitchStepDeg:+mp.toFixed(2),maxHeightStepM:+mh.toFixed(3),pitchOverLimitDeg:+Math.max(0,over).toFixed(2),heightOverLimitM:+Math.max(0,overH).toFixed(3),
  max025sPitchDeg:+w25p.toFixed(1),max025sHeightM:+w25h.toFixed(2),framesInsideGeometry:ins,longestFaceChestOcclusionS:+maxRun.toFixed(2),longestOcclusionFromQaHookS:+maxHook.toFixed(2),minHerMargin:+mm.toFixed(2),minArmM:+ma.toFixed(2),minViewPitchDeg:+minP.toFixed(1)};}
const good=m=>m.pitchOverLimitDeg<=0.5&&m.heightOverLimitM<=0.03&&m.max025sPitchDeg<=7&&m.max025sHeightM<=1.3&&m.framesInsideGeometry===0&&m.longestFaceChestOcclusionS<=0.5&&m.minHerMargin>=0&&m.minArmM>=3.5&&m.minViewPitchDeg>=-58.01;
// ---------- Q1
{
 const out={};let all=true;
 for(const key of ['ro','pock']){const F=FX[key],hers=F.map(f=>toLocal(f[1]));
  const mac=F.map(f=>{const y=f[6]*R,p=f[7]*R,fw=[-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p)],c=toLocal(f[5]),d=solve(fw);return {position:c,target:[c[0]+d[0]*5,c[1]+d[1]*5,c[2]+d[2]*5]};});
  const before=metrics(F,mac,hers);
  const Rg=rig('skycity','S1',hers[0].slice(),{modelAt:[0,0,0]});const st=Rg.st;st.guardOrbitGround=p=>p;let her=hers[0];st.girl=()=>her;
  let near=null,nearAt=-1;st.lakesideOccluders=()=>near;st.skycityOccluders=()=>near;
  const o=new FO.FreeOrbit('skycity');let i=0;
  st.orbit={step(){},solve(){const f=F[i];o.yaw=f[2]+YAW_OFF;o.pitch=f[3];o.dist=f[4];return o.rawPose(her);},place:'skycity',shouldWrite:()=>true,seeded:true,engaged:()=>true,drag(){},release(){}};
  st.entry=null;const poses=[],ms=[],hold=[];
  for(i=0;i<F.length;i++){her=hers[i];if(F[i][0]-nearAt>=0.4){nearAt=F[i][0];near=B.filter(b=>Math.hypot(Math.max(b.min[0]-her[0],0,her[0]-b.max[0]),Math.max(b.min[2]-her[2],0,her[2]-b.max[2]))<18);}
   const dt=i?Math.min(0.1,Math.max(0,F[i][0]-F[i-1][0])):1/60;const t0=process.hrtime.bigint();
   const hook=cutAt(F,hers,i);
   if(hook)st.qaOrbit();/* a __qfTeleport / __qfAimAt cut (her or the raw orbit jumps in one frame): the hook's own qaOrbit resets */
   else if(F[i][8]>=2){st.qaHold=false;st.writeOrbit(0);}/* the drag event's own write (aimOrbit, which also ends the hook hold) */
   st.writeOrbit(dt);hold.push(!!st.qaHold);ms.push(Number(process.hrtime.bigint()-t0)/1e6);const c=Rg.cam();poses.push({position:c.position.slice(),target:c.target.slice()});}
  const after=metrics(F,poses,hers,hold);ms.sort((a,b)=>a-b);all=all&&good(after);
  out[key]={her:hers[0].map(v=>+v.toFixed(2)),before_mac:before,after,perf:{avgMs:+(ms.reduce((a,b)=>a+b)/ms.length).toFixed(3),p99Ms:+ms[Math.floor(ms.length*.99)].toFixed(2)}};}
 ok('Q1',all,{boxes:SKO.length,...out});
}
// ---------- Q2 hooks stick
const camYaw=c=>{const v=c.target.map((x,k)=>x-c.position[k]);return Math.atan2(-v[0],-v[2])/R;},wrap=a=>((a%360)+540)%360-180;
const nearOf=h=>B.filter(b=>Math.hypot(Math.max(b.min[0]-h[0],0,h[0]-b.max[0]),Math.max(b.min[2]-h[2],0,h[2]-b.max[2]))<18);
{
 const RN=X.RN.REGION_NODES.skycity.nodes;let pick=null;const o=new FO.FreeOrbit('skycity');
 for(const nd of RN){const near=nearOf(nd.at),look=[nd.at[0],nd.at[1]+1.25,nd.at[2]];for(let y=-180;y<180&&!pick;y+=15){o.yaw=y;o.pitch=12;o.dist=8;const p=o.rawPose(nd.at).position;
   const oc=LA.herOcclusion?LA.herOcclusion(p,nd.at,near):{face:LA.lensLevel(look,p,near,0)>0,chest:true};if(LA.lensLevel(look,p,near,0)===1&&oc.face&&oc.chest)pick={key:nd.key,yaw:y,at:nd.at};}if(pick)break;}
 const Rg=rig('skycity','S1',pick.at.slice(),{modelAt:[0,0,0]});const st=Rg.st;st.guardOrbitGround=p=>p;let her=pick.at.slice();st.girl=()=>her;st.standAt=(r,at)=>{her=at.slice();};
 let near=nearOf(her);st.lakesideOccluders=()=>near;st.skycityOccluders=()=>near;
 const r=st.qaTeleport(pick.key,pick.yaw,12);near=nearOf(her);let drift=0;
 for(let f=0;f<180;f++){st.writeOrbit(1/60);drift=Math.max(drift,Math.abs(wrap(camYaw(Rg.cam())-pick.yaw)));}
 // a manual drag ends the hold: avoidance swings again (the lens leaves the hooked yaw within 1.5 s)
 st.aimOrbit('drag',0,0);st.aimOrbit('release',0,0);for(let f=0;f<90;f++)st.writeOrbit(1/60);
 const after=Math.abs(wrap(camYaw(Rg.cam())-pick.yaw));
 ok('Q2',r.ok&&drift<=3&&after>3,{blockedPick:pick,teleport:r,maxYawDriftDeg3s:+drift.toFixed(2),yawOffAfterManualDrag15sDeg:+after.toFixed(1)});
}
// ---------- Q3 sign from the text side
{
 const L=X.H.load(X.S('world-r2/IslandPropsLayout.ts')),CP=X.H.load(X.S('world-r1/CameraPose.ts'));const S=L.ISLAND_PROPS.signpost,sp=S.position,ny=S.yawDeg*R,n=[Math.sin(ny),0,Math.cos(ny)];
 const Rg=rig('island','S1',X.RN.REGION_NODES.island.nodes[0].at.slice(),{});const st=Rg.st;let her=Rg.her();st.girl=()=>her;st.standAt=(r,at)=>{her=at.slice();};
 const r=st.qaTeleport('sign');const c=Rg.cam(),front=(c.position[0]-sp[0])*n[0]+(c.position[2]-sp[2])*n[2],rect=L.signpostRectUi(CP.fromLookAt(c),390,844);
 const toSign=[sp[0]-c.position[0],sp[2]-c.position[2]],fw=[c.target[0]-c.position[0],c.target[2]-c.position[2]],ahead=toSign[0]*fw[0]+toSign[1]*fw[1]>0;
 ok('Q3',r.ok&&front>0&&!!rect&&ahead,{teleport:r,lensFrontOfPanelM:+front.toFixed(2),signAheadOfLens:ahead,signRect:rect&&[rect.x,rect.y,rect.width,rect.height].map(v=>Math.round(v))});
}
// ---------- Q4 camTrace occFace / occChest
{
 const src=fs.readFileSync(X.S('world-r2/RegionNodeStage.ts'),'utf8');const wired=/\.\.\.this\.traceOcc\(/.test(src)&&/occFace:o\.face,occChest:o\.chest/.test(src);
 const her=[21.8,-0.17,6.6];const Rg=rig('skycity','S1',her.slice(),{modelAt:[0,0,0]});const st=Rg.st;st.girl=()=>her;const near=nearOf(her);st.lakesideOccluders=()=>near;st.skycityOccluders=()=>near;
 let hid=null,clear=null;const o=new FO.FreeOrbit('skycity');const look=[her[0],her[1]+1.25,her[2]];
 for(let y=-180;y<180;y+=5){o.yaw=y;o.pitch=12;o.dist=8;const p=o.rawPose(her).position,lv=LA.lensLevel(look,p,near,0);if(lv===1&&!hid)hid=p;if(lv===0&&!clear)clear=p;}
 const oh=st.traceOcc?st.traceOcc(hid):null,oc=st.traceOcc?st.traceOcc(clear):null;
 ok('Q4',wired&&!!oh&&!!oc&&(oh.occFace||oh.occChest)&&oc.occFace===false&&oc.occChest===false,{wired,hidden:oh,clear:oc});
}
module.exports={FX,toLocal,B,YAW_OFF,res};
if(require.main===module){const all=Object.values(res).every(r=>r.ok);console.log(JSON.stringify({test:'p0drag10',ok:all,...res},null,1));process.exit(all?0:1);}
