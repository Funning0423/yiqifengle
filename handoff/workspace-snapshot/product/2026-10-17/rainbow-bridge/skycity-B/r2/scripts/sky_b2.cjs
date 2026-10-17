// 方案 B r2（运镜bot 偏好版）: 星庭右前沿桥头栈台 + 单向左弯缓坡彩虹桥. node sky_b2.cjs RISE DS TH H1 [search|full]
const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const RB=J.H.load(J.S+'region/RegionBoardLanding.ts'),BL=J.H.load(J.S+'ui/BoardLayout.ts'),V=J.H.load(J.S+'region/SkycityVisitPose.ts');
const {rotY,add,sub}=J;const r3=v=>v.map(x=>Math.round(x*1000)/1000),D=Math.PI/180;
const A=process.argv.slice(2);const RISE=+A[0]||11,TH=+A[2]||34,H1=+(A[3]??90),MODE=A[4]||'full';
const SPEED=J.L.speedMps,KMAX=5/SPEED,CORNER=1.0,BUILD05=42.865,LIMIT=BUILD05+6*SPEED;
const SKIP=/state_.*before/;const FULL=require('./sky_full.cjs');   // full decoded skycity (the r4 fixture is clipped at local x≈5)
const LOCT=[];for(const n of FULL)for(let i=0;i<n.tris.length;i+=9){const t=n.tris.slice(i,i+9);LOCT.push({n:n.name,t,bb:[Math.min(t[0],t[3],t[6]),Math.min(t[1],t[4],t[7]),Math.min(t[2],t[5],t[8]),Math.max(t[0],t[3],t[6]),Math.max(t[1],t[4],t[7]),Math.max(t[2],t[5],t[8])]});}
// --- stand line (local, straight, from the bridge head platform at the court's right-front corner into the court) ---
const LX0=6.4,LA=0.3,ZS=47,ZE=38,STAND_LOCAL=[];const lawnY=(x,z)=>{let best=-1e9;for(const {t,bb} of LOCT){if(x<bb[0]||x>bb[3]||z<bb[2]||z>bb[5])continue;const [ax,ay,az,bx,by,bz,cx,cy,cz]=t;const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,l3=1-l1-l2;if(l1<0||l2<0||l3<0)continue;const y=l1*ay+l2*by+l3*cy;if(y>best&&y<0.3)best=y;}return best;};
for(let z=ZS;z>=ZE-1e-9;z-=0.25){const u=ZS-z,x=LX0-LA*u,y=lawnY(x,z);STAND_LOCAL.push([+x.toFixed(4),y>-0.6?+y.toFixed(3):-0.25,z]);}STAND_LOCAL[0][1]=-0.25;
const PE=STAND_LOCAL[0],dl=[-LA,0,-1].map(v=>v/Math.hypot(LA,1)),hdLocal=Math.atan2(dl[0],dl[2])/D;
// --- ONE continuous climb from appr2[0] (运镜bot #2/#3): meadow-exit grass ramp θ0→THA, hold THA through edge2,
//     on the deck THA→TH, hold TH, TH→0 at the bridge head. dθ/du is a sum of trapezoid pulses with cosine corners (≤KMAX °/m).
const ap0=J.appr2.map(p=>[...p]);const E2=J.edge2;
const h0=Math.atan2(E2[0]-ap0[2][0],E2[2]-ap0[2][2])/D;
const apPlan=[0];for(let i=1;i<ap0.length;i++)apPlan.push(apPlan[i-1]+Math.hypot(ap0[i][0]-ap0[i-1][0],ap0[i][2]-ap0[i-1][2]));const U=apPlan.at(-1),th0=Math.atan((ap0[1][1]-ap0[0][1])/apPlan[1])/D;
const THA=A[1]==='th0'?null:+(A[1]??15);const DSarg=null;
const pulse=(u,a,area)=>{if(Math.abs(area)<1e-3)return 0;if(Math.abs(area)/KMAX<CORNER){const rr=2*CORNER,v=u-a;if(v<0||v>rr)return 0;return area*2/rr*(0.5-0.5*Math.cos(2*Math.PI*v/rr));}const r=Math.abs(area)/KMAX+CORNER;if(u<a||u>a+r)return 0;const c=CORNER,v=u-a;let w=1;if(v<c)w=0.5-0.5*Math.cos(Math.PI*v/c);else if(v>r-c)w=0.5-0.5*Math.cos(Math.PI*(r-v)/c);return Math.sign(area)*KMAX*w*(Math.abs(area)/KMAX)/(r-c);};
const THAv=THA??th0;const rB=(TH-THAv)/KMAX+CORNER,rC=TH/KMAX+CORNER;
function unified(hold){const Uend=U+rB+hold+rC,du=0.02;const k=u=>pulse(u,0,THAv-th0)+pulse(u,U,TH-THAv)+pulse(u,Uend-rC,-TH);let th=th0,y=ap0[0][1],s=0;const rows=[{u:0,y,th,s,k:k(0)}];
 for(let u=0;u<Uend-1e-9;u+=du){const k1=k(u),k2=k(u+du),t2=th+(k1+k2)/2*du;y+=Math.tan((th+t2)/2*D)*du;s+=du/Math.cos((th+t2)/2*D);th=t2;rows.push({u:u+du,y,th,s,k:k2});}return {rows,Uend};}
let lo=0,hi=60;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(unified(m).rows.at(-1).y<E2[1]+RISE)lo=m;else hi=m;}
const UN=unified((lo+hi)/2),iE=UN.rows.findIndex(r=>r.u>=U-1e-9);
const APR=UN.rows.slice(0,iE+1),DS=+(APR.at(-1).y-E2[1]).toFixed(3),THM=THAv,sE=APR.at(-1).s;
const PR={rows:UN.rows.slice(iE).map(r=>({x:r.u-U,y:r.y-APR.at(-1).y,th:r.th,s:r.s-sE,k:r.k})),P:UN.Uend-U,L:{r:rC,m:(lo+hi)/2,rB}};
const Rb=RISE-DS;
const PLAN=PR.P,ARC=PR.rows.at(-1).s;
// --- plan curve: constant curvature from approach heading h0 to H1 (left turn only: H1>=h0) ---
const KAPPA=(H1-h0)*D/PLAN,RADIUS=Math.abs(KAPPA)>1e-9?1/Math.abs(KAPPA):Infinity;
const S0=[E2[0],E2[1]+DS,E2[2]];const CL=[];{let px=S0[0],pz=S0[2],prev=0;for(const r of PR.rows){const dx=r.x-prev;const hm=(h0*D+KAPPA*(prev+dx/2));px+=Math.sin(hm)*dx;pz+=Math.cos(hm)*dx;prev=r.x;CL.push({p:[px,S0[1]+r.y,pz],h:(h0*D+KAPPA*r.x)/D,th:r.th,s:r.s,x:r.x,k:r.k});}CL[0].p=[...S0];}
const EW=CL.at(-1).p;const YAW=H1-hdLocal;const OFF=sub(EW,rotY(YAW,PE));const toW=p=>add(rotY(YAW,p),OFF),toL=p=>rotY(-YAW,sub(p,OFF));
const chk=sub(toW(add(PE,dl)),EW);const hChk=Math.atan2(chk[0],chk[2])/D;
// --- geometry ---
const JHIDE=/^env_sky_floatingrocks(_cards)?_1$/;   // journey copy only: this rock cluster lands on the meadow exit in plan B (board copy keeps it)
const city=[];for(const n of FULL){if(SKIP.test(n.name)||JHIDE.test(n.name))continue;for(let i=0;i<n.tris.length;i+=9){const t=n.tris;city.push({n:n.name,t:[...toW(t.slice(i,i+3)),...toW(t.slice(i+3,i+6)),...toW(t.slice(i+6,i+9))]});}}
const mead=J.meadow.flatMap(o=>{const r=[];for(let i=0;i<o.tris.length;i+=9)r.push({n:'meadow:'+o.name,t:o.tris.slice(i,i+9)});return r;});
const W=[...city,...mead];
for(const o of W){const t=o.t;o.bb=[Math.min(t[0],t[3],t[6]),Math.min(t[1],t[4],t[7]),Math.min(t[2],t[5],t[8]),Math.max(t[0],t[3],t[6]),Math.max(t[1],t[4],t[7]),Math.max(t[2],t[5],t[8])];}
function segTri(o,d,t){const e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]],p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],a=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(a)<1e-12)return -1;
 const f=1/a,s=[o[0]-t[0],o[1]-t[1],o[2]-t[2]],u=f*(s[0]*p[0]+s[1]*p[1]+s[2]*p[2]);if(u<0||u>1)return -1;const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=f*(d[0]*q[0]+d[1]*q[1]+d[2]*q[2]);if(v<0||u+v>1)return -1;
 const k=f*(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2]);return k>1e-4&&k<1-1e-4?k:-1;}
const segHit=(T,o,e)=>{const d=sub(e,o),lo=[Math.min(o[0],e[0]),Math.min(o[1],e[1]),Math.min(o[2],e[2])],hi=[Math.max(o[0],e[0]),Math.max(o[1],e[1]),Math.max(o[2],e[2])];
 for(const x of T){const b=x.bb;if(b[3]<lo[0]||b[0]>hi[0]||b[4]<lo[1]||b[1]>hi[1]||b[5]<lo[2]||b[2]>hi[2])continue;if(segTri(o,d,x.t)>0)return x.n;}return null;};
function topY(T,x,z,maxY=1e9){let best=-1e9,nm='';for(const {n,t,bb} of T){if(bb&&(x<bb[0]||x>bb[3]||z<bb[2]||z>bb[5]))continue;const [ax,ay,az,bx,by,bz,cx,cy,cz]=t;const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;
 const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,l3=1-l1-l2;if(l1<-1e-9||l2<-1e-9||l3<-1e-9)continue;const y=l1*ay+l2*by+l3*cy;if(y>best&&y<maxY){best=y;nm=n;}}return [best,nm];}
// city-under-meadow penetration
const SOFT=/rope_root|vine/;let pen=0,penMax=0,penSoft=0;const penBy={};for(const n of FULL){if(SKIP.test(n.name)||JHIDE.test(n.name))continue;for(let i=0;i<n.tris.length;i+=3*20){const q=toW(n.tris.slice(i,i+3));const [y,mn]=topY(mead,q[0],q[2]);if(y>q[1]+0.05){if(SOFT.test(n.name)){penSoft++;continue;}pen++;penMax=Math.max(penMax,y-q[1]);const k=n.name.replace('env_sky_','')+'<'+mn.replace('meadow:meadow_','');penBy[k]=(penBy[k]||0)+1;}}}
// same count for the Build05 placement (yaw 241.165, offset sOff), full geometry, for comparison
let penB=0,penBMax=0;const penBBy={};{const tB=p=>add(rotY(J.yaw,p),J.sOff);for(const n of FULL){if(SKIP.test(n.name)||SOFT.test(n.name))continue;for(let i=0;i<n.tris.length;i+=3*20){const q=tB(n.tris.slice(i,i+3));const [y,mn]=topY(mead,q[0],q[2]);if(y>q[1]+0.05){penB++;penBMax=Math.max(penBMax,y-q[1]);const k=n.name.replace('env_sky_','');penBBy[k]=(penBBy[k]||0)+1;}}}}
// deck clearance: underside 0.24 m, headroom 1.8 m, edges ±1.05
const stand=STAND_LOCAL.map(toW);
const hits=[];const sampleEvery=Math.max(1,Math.round(0.25/0.02));
for(let i=0;i<CL.length;i+=sampleEvery){const c=CL[i];if(c.s<0.4)continue;const f=[Math.sin(c.h*D),0,Math.cos(c.h*D)],r=[-f[2],0,f[0]];
 for(const side of [-1.05,0,1.05]){const o=[c.p[0]+r[0]*side,c.p[1]-0.25,c.p[2]+r[2]*side];const n=segHit(W,o,[o[0],o[1]+2.05,o[2]]);if(n){hits.push({s:+c.s.toFixed(2),side,n});break;}}}
const out={params:{RISE,THA,DS,TH,H1,h0:+h0.toFixed(2),KMAX_degPerM:+KMAX.toFixed(3)},planM:+PLAN.toFixed(2),arcM:+ARC.toFixed(2),radiusM:+RADIUS.toFixed(1),rampM:+PR.L.r.toFixed(2),midM:+PR.L.m.toFixed(2),hChk:+hChk.toFixed(2),
 pen,penMax:+penMax.toFixed(2),penSoft,penBy,build05Pen:{count:penB,maxM:+penBMax.toFixed(2),by:penBBy},hits:hits.length,hitList:hits.slice(0,8)};
if(MODE==='search'){console.log(JSON.stringify(out));process.exit(0);}
// --- approach (terrace) ---
const apXZ=u=>{let i=1;while(i<apPlan.length-1&&apPlan[i]<u)i++;const k=(u-apPlan[i-1])/(apPlan[i]-apPlan[i-1]);return [ap0[i-1][0]+(ap0[i][0]-ap0[i-1][0])*k,ap0[i-1][2]+(ap0[i][2]-ap0[i-1][2])*k];};
const ap=APR.filter((_,i)=>i%10===0).map(r=>{const [x,z]=apXZ(r.u);return [x,r.y,z];});ap[ap.length-1]=[...S0];
const apRamp=APR.filter((_,i)=>i%40===0).map(r=>{const [x,z]=apXZ(r.u),oy=(()=>{let i=1;while(i<apPlan.length-1&&apPlan[i]<r.u)i++;const k=(r.u-apPlan[i-1])/(apPlan[i]-apPlan[i-1]);return ap0[i-1][1]+(ap0[i][1]-ap0[i-1][1])*k;})();return {u:+r.u.toFixed(2),p:r3([x,r.y,z]),raiseM:+(r.y-oy).toFixed(3),slopeDeg:+r.th.toFixed(2)};});
const SCR=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
const spawn=J.sp('anchor_spawn_girl'),court=J.sp('anchor_starcourt_center');
const len=pts=>{let s=0;for(let i=1;i<pts.length;i++)s+=Math.hypot(...sub(pts[i],pts[i-1]));return s;};
const boards=SCR.map(([w,h])=>{const safe=BL.boardSafeInsets(w,h),cam=V.skycityVisitPose(spawn,court,w/h);
 const st0=J.standFor(w,h),e=st0.path.at(-1),j=J.meadowSrc.map.toJourney(e),apS=[j,...J.Lay.meadowExitFrom(j,J.exit02to08)];
 const apLen=J.routeLength(apS)-J.routeLength(ap0)+len(ap); // the terrace changes only the shared tail
 const budget=LIMIT-apLen-ARC;const MARGIN=0.6,st=RB.girlStandStop('skycity',STAND_LOCAL,cam,w,h,safe,p=>(ZS-p[2])*Math.hypot(1,LA)<=budget-MARGIN+1e-9);
 const total=apLen+ARC+st.distanceM,b=st.boxPt;
 return {screen:w+'x'+h,approachM:+apLen.toFixed(2),bridgeArcM:+ARC.toFixed(2),standWalkM:+st.distanceM.toFixed(2),leg0809M:+total.toFixed(2),extraVsBuild05S:+((total-BUILD05)/SPEED).toFixed(2),withinBudget:total<=LIMIT+1e-6,
  stopLocal:r3(st.local),stopWorld:r3(toW(st.local)),clear:st.clear,gapPt:+st.gapPt.toFixed(1),inFrameLimits:st.inFrameLimits,boxPt:{l:+b.l.toFixed(1),t:+b.t.toFixed(1),r:+b.r.toFixed(1),b:+b.b.toFixed(1)},heightPt:+(b.b-b.t).toFixed(1),heightFrac:+((b.b-b.t)/h).toFixed(3),
  camera:{position:r3(cam.position),target:r3(cam.target),fovVerticalDeg:cam.fovVerticalDeg}};});
// --- follow-rig corridor (JOURNEY_CAMERA back 6.6 / side 2.4 right / up 3.4) along bridge + stand line ---
const route=[...CL.filter((_,i)=>i%sampleEvery===0).map(c=>({p:c.p,h:c.h,s:c.s,where:'bridge'}))];
{let s=ARC;for(let i=1;i<stand.length;i++){const a=stand[i-1],b=stand[i];s+=Math.hypot(...sub(b,a));const v=sub(b,a);route.push({p:b,h:Math.atan2(v[0],v[2])/D,s,where:'stand'});}}
const maxStop=Math.max(...boards.map(b=>b.standWalkM));
const corridor=[],camRows=[];
for(const q of route){if(q.where==='stand'&&q.s-ARC>maxStop+0.01)break;const f=[Math.sin(q.h*D),0,Math.cos(q.h*D)],r=[-f[2],0,f[0]];
 const bad=[];for(const [a,b] of [[1.1,0],[1.1,0.55],[1.1,1.1],[0.78,0.78],[0.55,1.1],[0,1.1],[0.4,0.4]])for(const y of [0.35,1.0,1.7]){const o=[q.p[0],q.p[1]+y,q.p[2]],e=[q.p[0]+r[0]*a-f[0]*b,q.p[1]+y,q.p[2]+r[2]*a-f[2]*b];const n=segHit(W,o,e);if(n)bad.push(n.replace(/^meadow:/,'M:')+`@${a},${b},${y}`);}
 const cam=[q.p[0]-6.6*f[0]+2.4*r[0],q.p[1]+3.4,q.p[2]-6.6*f[2]+2.4*r[2]],head=[q.p[0],q.p[1]+1.5,q.p[2]];const los=segHit(W,cam,head);const [cy,cn]=topY(city,cam[0],cam[2]);
 corridor.push({s:+q.s.toFixed(2),where:q.where,clear:bad.length===0,blockers:[...new Set(bad)].slice(0,4)});camRows.push({s:+q.s.toFixed(2),cam:r3(cam),cityTopUnderCamY:cy>-1e8?+cy.toFixed(2):null,camAboveRockM:cy>-1e8?+(cam[1]-cy).toFixed(2):null,lineOfSight:los?('blocked:'+los):'clear'});}
{const far=Math.max(...boards.map(b=>b.standWalkM));const bad=[];let d=0;for(let i=0;i<STAND_LOCAL.length;i++){if(i)d+=Math.hypot(...sub(STAND_LOCAL[i],STAND_LOCAL[i-1]));if(d>far+0.01)break;const p=STAND_LOCAL[i];
 for(const [dx,dz] of [[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3],[0,0]]){const o=[p[0]+dx,p[1]+0.08,p[2]+dz];const n=segHit(LOCT,o,[o[0],o[1]+1.65,o[2]]);if(n&&!/foliage_cards|flowers/.test(n)){bad.push({d:+d.toFixed(2),n});break;}}}
 out.standBodyClear=bad.length===0;out.standBodyHits=bad.slice(0,8);}
{const bad=[];const Wc=W.filter(o=>!/meadow:meadow_(terrain|grass|flower|path)/.test(o.n));for(let i=0;i<ap.length;i++){const p=ap[i];for(const [dx,dz] of [[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]]){const o=[p[0]+dx,p[1]+0.1,p[2]+dz];const n=segHit(Wc,o,[o[0],o[1]+1.6,o[2]]);if(n){bad.push({i,n});break;}}}out.approachBodyClear=bad.length===0;out.approachBodyHits=bad.slice(0,6);
 // the same with the rock cluster shown (why it must be hidden in the journey copy)
 const R=[];for(const n of FULL){if(!JHIDE.test(n.name))continue;for(let i=0;i<n.tris.length;i+=9){const t=n.tris;const tt=[...toW(t.slice(i,i+3)),...toW(t.slice(i+3,i+6)),...toW(t.slice(i+6,i+9))];R.push({n:n.name,t:tt,bb:[Math.min(tt[0],tt[3],tt[6]),Math.min(tt[1],tt[4],tt[7]),Math.min(tt[2],tt[5],tt[8]),Math.max(tt[0],tt[3],tt[6]),Math.max(tt[1],tt[4],tt[7]),Math.max(tt[2],tt[5],tt[8])]});}}
 let rh=0;for(const p of ap)for(const [dx,dz] of [[-.3,-.3],[.3,.3]]){const o=[p[0]+dx,p[1]+0.1,p[2]+dz];if(segHit(R,o,[o[0],o[1]+1.6,o[2]])){rh++;break;}}let ru=0,rmax=0;for(const o of R)for(let k=0;k<9;k+=3){const [y]=topY(mead,o.t[k],o.t[k+2]);if(y>o.t[k+1]+0.05){ru++;rmax=Math.max(rmax,y-o.t[k+1]);}}
 out.hiddenRockCluster={nodes:'env_sky_floatingrocks_1, env_sky_floatingrocks_cards_1',approachPointsThroughIt:rh,vertsUnderMeadow:ru,maxDepthM:+rmax.toFixed(2)};}
out.approach={ramp:`meadow exit re-graded over the shared tail appr2[0]→edge2 (${U.toFixed(2)} m plan): edge2 +${DS} m, slope ${th0.toFixed(1)}°→${THAv.toFixed(1)}° held into the deck, ≤${KMAX.toFixed(2)}°/m`,lengthM:+len(ap).toFixed(3),build05TailM:+len(ap0).toFixed(3),maxSlopeDeg:+THM.toFixed(2),rampRows:apRamp,h0Deg:+h0.toFixed(2)};
out.bridge={startWorld:r3(S0),endWorld:r3(EW),endLocal:PE,startHeadingDeg:+h0.toFixed(2),endHeadingDeg:H1,turn:'left only, constant curvature',riseM:+Rb.toFixed(2)};
out.city={yawDeg:+YAW.toFixed(3),offsetWorld:r3(OFF),build05:{yawDeg:J.yaw,offsetWorld:r3(J.sOff)},courtLevelWorldY:+(OFF[1]).toFixed(3)};
out.standLineLocal=[STAND_LOCAL[0],STAND_LOCAL.at(-1)];out.standLineLocalFull=STAND_LOCAL;out.standLineWorld=[r3(stand[0]),r3(stand.at(-1))];
out.boards=boards;out.limitM=+LIMIT.toFixed(3);
out.corridorClear=corridor.every(c=>c.clear);out.corridorFails=corridor.filter(c=>!c.clear).slice(0,10);
const last5=camRows.filter(c=>c.s>=ARC-5&&c.s<=ARC);out.last5mClimbCam=last5.filter((_,i)=>i%4===0);out.lineOfSightBlocked=camRows.filter(c=>c.lineOfSight!=='clear').map(c=>c.s+':'+c.lineOfSight).slice(0,10);
out.anchorsWorld={spawn_girl:r3(toW(spawn)),starcourt_center:r3(toW(court))};
out.centerline=CL.filter((_,i)=>i%sampleEvery===0||i===CL.length-1).map(c=>({s:+c.s.toFixed(3),xPlan:+c.x.toFixed(3),p:r3(c.p),headingDeg:+c.h.toFixed(2),slopeDeg:+c.th.toFixed(2),pitchRateDegPerS:+(c.k*Math.cos(c.th*D)*SPEED).toFixed(3),t:+(c.s/SPEED).toFixed(2)}));
out.maxSlopeDeg=+Math.max(...CL.map(c=>c.th)).toFixed(2);out.maxPitchRateDegPerS=+Math.max(...CL.map(c=>Math.abs(c.k*Math.cos(c.th*D)*SPEED))).toFixed(3);
require('fs').writeFileSync(__dirname+`/../skycity-B/r2/_eval_${RISE}_${THA}_${TH}_${H1}.json`,JSON.stringify(out,null,1));
const {centerline,...brief}=out;console.log(JSON.stringify({...brief,boards:boards.map(b=>`${b.screen} walk ${b.standWalkM} extra ${b.extraVsBuild05S}s gap ${b.gapPt} ok ${b.withinBudget} h ${b.heightPt}`)},null,0));
if(MODE==='full'&&process.env.WRITE){
const R2=__dirname+'/../skycity-B/r2/',fs=require('fs');
// board-camera checks for the verify render (model-local tris; before-states hidden)
const LOC=LOCT;
const ui={};for(const b of boards){const [w,h]=b.screen.split('x').map(Number),safe=BL.boardSafeInsets(w,h),lay=BL.boardLayout(w,h,safe,4),tray=[lay.tray.x-lay.tray.width/2,lay.tray.y-lay.tray.height/2,lay.tray.x+lay.tray.width/2,lay.tray.y+lay.tray.height/2];
 ui[b.screen]={rects:RB.girlStandUi(w,h,safe).map(q=>[q.l,q.t,q.r,q.b].map(v=>+v.toFixed(1))),tray,toast:[lay.toast.x-lay.toast.maxWidth/2,lay.toast.y-lay.toast.height/2,lay.toast.x+lay.toast.maxWidth/2,lay.toast.y+lay.toast.height/2+2].map(v=>+v.toFixed(1))};
 const x=b.boxPt;b.underTrayShare=Math.max(0,Math.min(x.r,tray[2])-Math.max(x.l,tray[0]))*Math.max(0,Math.min(x.b,tray[3])-Math.max(x.t,tray[1]))/((x.r-x.l)*(x.b-x.t));
 let occ=0,n=0;for(const fx of [-.15,0,.15])for(const fy of [.1,.5,.9,1.6]){const t=[b.stopLocal[0]+fx,b.stopLocal[1]+fy,b.stopLocal[2]];n++;if(segHit(LOC,b.camera.position,t))occ++;}b.sceneOccludedRays=`${occ}/${n}`;}
// deck centerline in model-local (climb + head walkway to the court edge at z≈36.5)
const deckW=[...CL.filter((_,i)=>i%25===0).map(c=>c.p),...STAND_LOCAL.filter(p=>p[2]>=ZS-2).map(toW)];
const verify={boards,ui,bridgeLocal:deckW.map(p=>r3(toL(p))).filter(p=>Math.hypot(p[0]-PE[0],p[2]-PE[2])<45)};
fs.writeFileSync(R2+'sky_b2_verify.json',JSON.stringify(verify));
// 1) centerline (world): approach ramp tail + bridge + head walkway, each with s / heading / slope / pitch rate
const pts=[];let s0=0;{const a=ap;for(let i=0;i<a.length;i++){if(i)s0+=Math.hypot(...sub(a[i],a[i-1]));}}
const apRows=APR.filter((_,i)=>i%20===0||i===APR.length-1).map(r=>{const [x,z]=apXZ(r.u);return {seg:'meadow_ramp',p:r3([x,r.y,z]),slopeDeg:+r.th.toFixed(2)};});
const brRows=out.centerline.map(c=>({seg:'bridge_climb',sBridge:c.s,p:c.p,headingDeg:c.headingDeg,slopeDeg:c.slopeDeg,pitchRateDegPerS:c.pitchRateDegPerS}));
const wkRows=STAND_LOCAL.map(p=>({seg:'lawn_stand_line',local:p,p:r3(toW(p)),slopeDeg:0}));
fs.writeFileSync(R2+'centerline_world.json',JSON.stringify({note:'Journey world (Cocos Y-up, metres). Recommended plan B r2: RISE '+RISE+' m, meadow-exit ramp +'+DS+' m, θmax '+TH+'°, end heading '+H1+'°. speed '+SPEED+' m/s. Approach rows start at appr2[0] (shared by all screens; 390x520/320x568 have their own longer prefix before it).',
 params:out.params,bridge:out.bridge,city:out.city,approach:{lengthM:out.approach.lengthM,build05M:out.approach.build05TailM,maxSlopeDeg:out.approach.maxSlopeDeg},rows:[...apRows,...brRows,...wkRows],stopsWorld:Object.fromEntries(boards.map(b=>[b.screen,b.stopWorld]))},null,1));
// 2) slope profile over the whole followed run (approach tail + bridge + walkway up to the farthest stop), at her speed
const prof=[];let sAcc=0,prev=null,prevTh=null;const push=(seg,p,th)=>{if(prev)sAcc+=Math.hypot(...sub(p,prev));prof.push({seg,s:+sAcc.toFixed(3),t:+(sAcc/SPEED).toFixed(3),y:+p[1].toFixed(3),slopeDeg:+th.toFixed(3)});prev=p;};
for(const r of APR.filter((_,i)=>i%4===0)){const [x,z]=apXZ(r.u);push('meadow_ramp',[x,r.y,z],r.th);}
for(const c of CL.filter((_,i)=>i%5===0))if(c.s>0)push('bridge',c.p,c.th);
const far=Math.max(...boards.map(b=>b.standWalkM));for(let d=0.25;d<=far+1e-9;d+=0.25){const k=d/Math.hypot(1,LA);push('lawn',toW([PE[0]-LA*k,STAND_LOCAL[Math.min(STAND_LOCAL.length-1,Math.round(k/0.25))][1],PE[2]-k]),0);}
for(let i=0;i<prof.length;i++){const a=prof[Math.max(0,i-1)],b=prof[Math.min(prof.length-1,i+1)];prof[i].pitchRateDegPerS=b.t>a.t?+((b.slopeDeg-a.slopeDeg)/(b.t-a.t)).toFixed(3):0;}
fs.writeFileSync(R2+'slope_profile.json',JSON.stringify({note:'s from appr2[0]; slopeDeg = path pitch; pitchRateDegPerS = d(slope)/dt at '+SPEED+' m/s (central difference). The JOURNEY_CAMERA follow rig (back 6.6 / right 2.4 / up 3.4 on her current point) keeps its own pitch constant; this is the pitch a terrain-following lens would have to turn.',
 maxSlopeDeg:Math.max(...prof.map(p=>p.slopeDeg)),maxPitchRateDegPerS:Math.max(...prof.map(p=>Math.abs(p.pitchRateDegPerS))),stopsS:Object.fromEntries(boards.map(b=>[b.screen,+(out.approach.lengthM+ARC+b.standWalkM).toFixed(2)])),bridgeStartS:out.approach.lengthM,bridgeEndS:+(out.approach.lengthM+ARC).toFixed(3),rows:prof},null,0));
// 3) bounding boxes: rock strata / rim / balustrade-like pieces of the court (connected components) within 14 m of the head walkway + bridge end
const near=(p)=>{const q=toL(p);return q[0]>-8&&q[0]<14&&q[2]>30&&q[2]<60;};
const comps=[];for(const n of FULL){if(SKIP.test(n.name))continue;if(!/strata|palette|ruins|foliage|vine/.test(n.name))continue;
 const T=[];for(let i=0;i<n.tris.length;i+=9){const t=n.tris.slice(i,i+9);const c=[(t[0]+t[3]+t[6])/3,(t[1]+t[4]+t[7])/3,(t[2]+t[5]+t[8])/3];if(c[0]>-8&&c[0]<14&&c[2]>30&&c[2]<60&&c[1]>-6&&c[1]<4)T.push(t);}
 const key=(x,y,z)=>`${Math.round(x*200)},${Math.round(y*200)},${Math.round(z*200)}`;const par=T.map((_,i)=>i),f=i=>par[i]===i?i:(par[i]=f(par[i]));const vmap=new Map();
 T.forEach((t,i)=>{for(let k=0;k<9;k+=3){const kk=key(t[k],t[k+1],t[k+2]);if(vmap.has(kk)){const a=f(i),b=f(vmap.get(kk));if(a!==b)par[a]=b;}else vmap.set(kk,i);}});
 const g=new Map();T.forEach((t,i)=>{const r=f(i);if(!g.has(r))g.set(r,[]);g.get(r).push(t);});
 for(const ts of g.values()){let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(const t of ts)for(let k=0;k<9;k+=3)for(let a=0;a<3;a++){mn[a]=Math.min(mn[a],t[k+a]);mx[a]=Math.max(mx[a],t[k+a]);}
  if((mx[0]-mn[0])*(mx[2]-mn[2])<0.01&&ts.length<4)continue;
  const corners=[];for(const x of [mn[0],mx[0]])for(const y of [mn[1],mx[1]])for(const z of [mn[2],mx[2]])corners.push(toW([x,y,z]));
  const wmn=[0,1,2].map(a=>Math.min(...corners.map(c=>c[a]))),wmx=[0,1,2].map(a=>Math.max(...corners.map(c=>c[a])));
  // nearest distance (plan) from her path (bridge last 6 m + walkway to farthest stop) and side
  let best=1e9,side='';for(const q of [...CL.filter(c=>c.s>ARC-6).map(c=>c.p),...STAND_LOCAL.filter(p=>(PE[2]-p[2])*Math.hypot(1,LA)<=far+0.01).map(toW)]){const cx=Math.max(wmn[0],Math.min(q[0],wmx[0])),cz=Math.max(wmn[2],Math.min(q[2],wmx[2])),d=Math.hypot(cx-q[0],cz-q[2]);if(d<best){best=d;}}
  const cL=[(mn[0]+mx[0])/2,(mn[2]+mx[2])/2];side=cL[0]>PE[0]-LA*((PE[2]-cL[1]))?'her right (camera side)':'her left (court side)';
  const kind=/strata/.test(n.name)?'rock_strata':(mx[1]-mn[1]>0.25&&mx[1]>0.05&&(mx[0]-mn[0]<1.5||mx[2]-mn[2]<1.5))?'railing/post/rim-ornament':/palette/.test(n.name)&&mx[1]<0.1?'court floor/rim slab':n.name.replace('env_sky_','');
  comps.push({node:n.name,kind,tris:ts.length,localMin:r3(mn),localMax:r3(mx),worldMin:r3(wmn),worldMax:r3(wmx),planDistToPathM:+best.toFixed(2),side});}}
comps.sort((a,b)=>a.planDistToPathM-b.planDistToPathM);
fs.writeFileSync(R2+'obstacles_bbox.json',JSON.stringify({note:'Axis-aligned boxes of connected triangle groups of the skycity GLB (before-states hidden) near the bridge head, in model-local and journey-world (AABB of the rotated local box). The rainbow bridge itself has no railing: only 0.10 m emissive curbs. Corridor test (1.1 m right-rear, 0.35/1.0/1.7 m high) along the bridge and head walkway: '+(out.corridorClear?'clear':'BLOCKED'),
 corridorClear:out.corridorClear,corridorFails:out.corridorFails,last5mClimbCamera:out.last5mClimbCam,strataTopWorldY:+(OFF[1]+0.2).toFixed(3),boxes:comps.slice(0,60)},null,1));
console.log('WROTE',comps.length,'boxes; nearest',JSON.stringify(comps.slice(0,6).map(c=>[c.node,c.kind,c.planDistToPathM,c.side])));}
