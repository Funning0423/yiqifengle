// 方案 B 验证：彩虹桥接到星庭前沿（运镜bot r4 harness，真实 GLB 三角面）。node sky_b.cjs > ../qa/sky_b.json
const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const RB=J.H.load(J.S+'region/RegionBoardLanding.ts'),BL=J.H.load(J.S+'ui/BoardLayout.ts'),V=J.H.load(J.S+'region/SkycityVisitPose.ts'),RC=J.H.load(J.S+'world-r1/RegionCameraData.ts');
const {rotY,add,sub}=J;const r3=v=>v.map(x=>Math.round(x*1000)/1000);
const SKIP=/state_.*before/;           // broken-bridge "before" states are not drawn in plan B (see IMPLEMENTATION §8)
const trisOf=objs=>{const T=[];for(const n of objs){if(SKIP.test(n.name))continue;const t=n.tris;for(let i=0;i<t.length;i+=9)T.push({n:n.name,t:t.slice(i,i+9)});}return T;};
const LOC=trisOf(J.local.skycity);
const ARGS=process.argv.slice(2).map(Number);const HEAD=isNaN(ARGS[0])?90:ARGS[0],PLAN=ARGS[1]||18,RISE=Number(process.argv[5]||12),EASE=4,SEARCH=process.argv[4]==='search';
const YAW=HEAD+180;                             // local -Z (court front -> centre) = bridge heading HEAD (deg, 0=+Z, 90=+X)
const TIP_LOCAL=[0,-0.20,46.9];                 // walk end of the bridge, 1.5 m inside the front rim (rim edge z≈48.4, y -0.25); mesh tongue runs on to z 45.8
const LANDING_WORLD=add(J.edge2,[Math.sin(HEAD*Math.PI/180)*PLAN,RISE,Math.cos(HEAD*Math.PI/180)*PLAN]);
const OFF=sub(LANDING_WORLD,rotY(YAW,TIP_LOCAL));
const toW=p=>add(rotY(YAW,p),OFF),toL=p=>rotY(-YAW,sub(p,OFF));
const STAND_LOCAL=[TIP_LOCAL,[0,-0.2,46.75],[-0.25,-0.2,46.5],[-0.875,-0.19,43.75],[-1.5,-0.12,40.5]];
const spawn=J.sp('anchor_spawn_girl'),court=J.sp('anchor_starcourt_center');
function topY(T,x,z,maxY=1e9){let best=-1e9,nm='';for(const {n,t} of T){const [ax,ay,az,bx,by,bz,cx,cy,cz]=t;const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;
 const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,l3=1-l1-l2;if(l1<-1e-9||l2<-1e-9||l3<-1e-9)continue;const y=l1*ay+l2*by+l3*cy;if(y>best&&y<maxY){best=y;nm=n;}}return [best,nm];}
function segTri(o,d,t){const e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]],p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],a=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(a)<1e-12)return -1;
 const f=1/a,s=[o[0]-t[0],o[1]-t[1],o[2]-t[2]],u=f*(s[0]*p[0]+s[1]*p[1]+s[2]*p[2]);if(u<0||u>1)return -1;const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=f*(d[0]*q[0]+d[1]*q[1]+d[2]*q[2]);if(v<0||u+v>1)return -1;
 const k=f*(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2]);return k>1e-4&&k<1-1e-4?k:-1;}
// 1) bridge (sin^2, same endpoints) clearance vs the placed city (+ meadow/island), deck box ±1.05 m and her 1.8 m above the deck
const arch=J.L.skyBridgeArchM,A=J.edge2,B=LANDING_WORLD,W=[...trisOf(J.local.skycity).map(o=>({n:o.n,t:[...toW(o.t.slice(0,3)),...toW(o.t.slice(3,6)),...toW(o.t.slice(6,9))]})),
 ...J.meadow.flatMap(o=>{const r=[];for(let i=0;i<o.tris.length;i+=9)r.push({n:'meadow:'+o.name,t:o.tris.slice(i,i+9)});return r;})];
const e=Math.min(0.45,EASE/(PLAN-2.5)),m=1/(1-e);const g=t=>{if(t<e)return m*t*t/(2*e);if(t>1-e){const u=1-t;return 1-m*u*u/(2*e);}return m*(t-e/2);};
const FLAT=2.5/PLAN;   // sky leg: last 2.5 m flat at the court level (it lands on a rim, not on open ground)
const pt=(t,f)=>{const q=Math.min(1,t/(1-FLAT));return [A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*g(q)+f(q)*arch,A[2]+(B[2]-A[2])*t];};
const sin2=t=>Math.sin(Math.PI*t)**2;
const MT0=W.filter(o=>o.n.startsWith('meadow:'));let pen0=0;for(const o of J.local.skycity){if(SKIP.test(o.name))continue;for(let i=0;i<o.tris.length;i+=3*30){const q=toW(o.tris.slice(i,i+3));const [y]=topY(MT0,q[0],q[2]);if(y>q[1]+0.05)pen0++;}}
if(SEARCH&&pen0>0){console.log(JSON.stringify({HEAD,PLAN,pen:pen0}));process.exit(0);}
let hits=[];const plan=Math.hypot(B[0]-A[0],B[2]-A[2]);
for(let i=0;i<=120;i++){const t=i/120,p=pt(t,sin2),d=Math.min(t,1-t)*plan;if(d<0.4)continue;
 for(const side of [-1.05,0,1.05]){const o=[p[0],p[1]-0.25,p[2]+side],dir=[0,2.05,0]; // deck underside 0.24 m -> her head 1.8 m
  for(const {n,t:tri} of W){if(segTri(o,dir,tri)>0){hits.push({t:+t.toFixed(3),dEndM:+d.toFixed(2),side,n});break;}}}}
// 2) city vs meadow: city vertices under the meadow's top surface (penetration)
const MT=W.filter(o=>o.n.startsWith('meadow:'));let pen=0,penMax=0;
for(const o of J.local.skycity){if(SKIP.test(o.name))continue;for(let i=0;i<o.tris.length;i+=3*30){const q=toW(o.tris.slice(i,i+3));const [y]=topY(MT,q[0],q[2]);if(y>q[1]+0.05){pen++;penMax=Math.max(penMax,y-q[1]);}}}
// 3) board camera (board copy = model local) per screen: her box, UI/tray overlap, scene occlusion along camera rays
const SCR=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024],[1024,768]];
const C=RC.REGION_CAMERA.islandCharacter;
const boards=SCR.map(([w,h])=>{const safe=BL.boardSafeInsets(w,h),cam=V.skycityVisitPose(spawn,court,w/h),ui=RB.girlStandUi(w,h,safe),lay=BL.boardLayout(w,h,safe,4);
 const st=RB.girlStandStop('skycity',STAND_LOCAL,cam,w,h,safe);
 const b=RB.girlBoxPt(cam,st.local,w,h),tray={l:lay.tray.x-lay.tray.width/2,r:lay.tray.x+lay.tray.width/2,t:lay.tray.y-lay.tray.height/2,b:lay.tray.y+lay.tray.height/2};
 let occl=0,n=0;if(b)for(const fx of [-.15,0,.15])for(const fy of [.1,.5,.9,1.6]){const tgt=[st.local[0]+fx,st.local[1]+fy,st.local[2]],o=cam.position,d=sub(tgt,o);n++;if(LOC.some(({t})=>segTri(o,d,t)>0))occl++;}
 const ov=b?Math.max(0,Math.min(b.r,tray.r)-Math.max(b.l,tray.l))*Math.max(0,Math.min(b.b,tray.b)-Math.max(b.t,tray.t))/((b.r-b.l)*(b.b-b.t)):null;
 return {screen:w+'x'+h,camera:{position:r3(cam.position),target:r3(cam.target),fovVerticalDeg:cam.fovVerticalDeg},stopLocal:r3(st.local),stopWorld:r3(toW(st.local)),walkFromTipM:+st.distanceM.toFixed(2),yawDeg:+st.yawDeg.toFixed(1),
  clearOfUi:st.clear,gapPt:+st.gapPt.toFixed(1),inFrameLimits:st.inFrameLimits,boxPt:b&&{l:+b.l.toFixed(1),r:+b.r.toFixed(1),t:+b.t.toFixed(1),b:+b.b.toFixed(1)},heightPt:b&&+(b.b-b.t).toFixed(1),heightFrac:b&&+((b.b-b.t)/h).toFixed(3),
  trayPt:r3([tray.l,tray.t,tray.r,tray.b]),underTrayShare:ov,sceneOccludedRays:`${occl}/${n}`};});
let maxSlope=0;for(let i=0;i<200;i++){const a=pt(i/200,sin2),b=pt((i+1)/200,sin2);maxSlope=Math.max(maxSlope,Math.abs(b[1]-a[1])/Math.hypot(b[0]-a[0],b[2]-a[2]));}
let arc=0;for(let i=0;i<400;i++){const a=pt(i/400,sin2),b=pt((i+1)/400,sin2);arc+=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);}
if(SEARCH){console.log(JSON.stringify({HEAD,PLAN,pen:pen0,hits:hits.length,hitsFar:hits.filter(h=>h.dEndM>0.6).map(h=>h.n+'@'+h.dEndM).slice(0,4),maxSlopeDeg:+(Math.atan(maxSlope)*180/Math.PI).toFixed(1)}));process.exit(0);}
const out={headingDeg:HEAD,arcM:+arc.toFixed(2),maxSlopeDeg:+(Math.atan(maxSlope)*180/Math.PI).toFixed(1),yawDeg:YAW,offsetWorld:r3(OFF),bridge:{startWorld:r3(A),tipWorld:r3(B),tipLocal:TIP_LOCAL,archM:arch,profile:'rise eased 4 m both ends + arch*sin^2',planM:+plan.toFixed(2),riseM:+(B[1]-A[1]).toFixed(2)},
 standLineLocal:STAND_LOCAL,standLineWorld:STAND_LOCAL.map(p=>r3(toW(p))),bridgeHits:hits.slice(0,20),bridgeHitCount:hits.length,cityUnderMeadowSamples:pen,cityUnderMeadowMaxM:+penMax.toFixed(2),
 anchorsWorld:{spawn_girl:r3(toW(spawn)),starcourt_center:r3(toW(court)),cloudbridge_end:r3(toW(J.sp('anchor_cloudbridge_end'))),cloudbridge_start:r3(toW(J.sp('anchor_cloudbridge_start')))},
 floorAtTip:topY(LOC,TIP_LOCAL[0],TIP_LOCAL[2],3),boards,
 today:{yawDeg:J.yaw,offsetWorld:r3(J.sOff),landingWorld:r3(J.deck.rim)}};
out.bridgeLocal=[];for(let i=0;i<=60;i++)out.bridgeLocal.push(r3(toL(pt(i/60,sin2))));
out.ui={};for(const [w,h] of SCR){const safe=BL.boardSafeInsets(w,h),lay=BL.boardLayout(w,h,safe,4);out.ui[w+'x'+h]={rects:RB.girlStandUi(w,h,safe).map(q=>[q.l,q.t,q.r,q.b].map(v=>+v.toFixed(1))),tray:[lay.tray.x-lay.tray.width/2,lay.tray.y-lay.tray.height/2,lay.tray.x+lay.tray.width/2,lay.tray.y+lay.tray.height/2]};}
console.log(JSON.stringify(out,null,1));
