'use strict';
/* 运镜bot r5 lakeside-landing-cam: offline audit of the skycity → lakeside balloon shot (old vs new) against HANDOFF §4.
 * World = the journey world of tools/journey-integration/journey-scene.cjs (skycity placed by sOff/yaw; she departs at S6).
 * Lake placed by LakesideCameraLayout.lakesideJourney(S6). Geometry: lakeside instances (lakeside-scene.cjs), the FULL
 * skycity (region_skycity/env_skycity.glb, Draco: DRACO3D=<draco3d dir>), the balloon prefab GLB at the basket position.
 * Checks per frame: lens clearance ≥ 1.1 m (all geometry incl. balloon), girl not cropped (full 1.7253 m box) with ≥ 13 pt to
 * the safe area / capsule (boardSafeInsets), head + chest line of sight, balloon on screen, the SOUTH-BANK RULE (no visible
 * lake ground beyond lake-local z 42: first ray hit on lakeside geometry at z > 42, or a ray that reaches the lake ground plane
 * y 0.58 at z > 42 without hitting anything), lens |a| ≤ 3 m/s², view |α| ≤ 120°/s², start/end jumps.
 * Usage: node audit.cjs [--knobs '{"climbM":20}'] [--out file.json]   (QF_TYPESCRIPT_MODULE + DRACO3D set) */
const fs=require('fs'),path=require('path');
const Jn=require('../journey-integration/journey-scene.cjs'),LKS=require('../journey-integration/lakeside/lakeside-scene.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
const {load:loadGlb}=require('../journey-integration/occlusion/lib-glb.cjs'),{decode}=require('../camera-frame-test/glb_geometry.cjs');
const {H,S,rotY,add,sub,yaw:SKY_YAW,sOff}=Jn;
const B=H.load(S+'region/LakesideBalloon.ts'),LC=H.load(S+'region/LakesideCameraLayout.ts'),BL=H.load(S+'ui/BoardLayout.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
const KN=Object.assign({},B.LAKESIDE_BALLOON_LANDING,JSON.parse(arg('--knobs')||'{}'));
const SCREENS=[[390,844],[360,780],[768,1024]],GIRL_H=1.7253,GIRL_W=.3,UI_GAP=13,CLEAR=1.1,BANK_Z=42,LAKE_Y=.58;
const S6=add(rotY(SKY_YAW,[0.2,0.032,-27.8]),sOff),S4=add(rotY(SKY_YAW,[0.2,3.308,-5.8]),sOff);
const LJ=LC.lakesideJourney(S6),toLocal=p=>rotY(-LJ.yawDeg,sub(p,LJ.root)),bank=LJ.arrival[LJ.arrival.length-1];
// ---- geometry ----
async function geometry(){
 const lake=LKS.instances().map(i=>{const t=new Float64Array(i.tris.length);for(let k=0;k<t.length;k+=3){const w=LJ.toWorld([i.tris[k],i.tris[k+1],i.tris[k+2]]);t[k]=w[0];t[k+1]=w[1];t[k+2]=w[2];}return {tag:'lake',name:i.name,tris:t};});
 const g=await decode(Jn.ROOT+'/creator-build-project/assets/bundles/region_skycity/env_skycity.glb');if(!g)throw Error('draco3d not found: set DRACO3D');
 const sky=[];for(const name in g.meshes){if(/cloudsea|cumulus_far|cloud_small|Icosphere|_after/.test(name))continue;const tr=g.meshes[name],t=new Float64Array(tr.length*9);let o=0;
  for(const tri of tr)for(const v of tri){const w=add(rotY(SKY_YAW,v),sOff);t[o++]=w[0];t[o++]=w[1];t[o++]=w[2];}sky.push({tag:'sky',name,tris:t});}
 const bal=loadGlb(Jn.ROOT+'/creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb').filter(n=>n.tris&&n.tris.length&&!/flame/.test(n.name)).map(n=>({tag:'balloon',name:n.name,tris:Float64Array.from(n.tris)}));
 return {stat:FL.buildBvh([...lake,...sky]),bal,lakeN:lake.length,skyN:sky.length};
}
const balAt=(G,p)=>FL.buildBvh(G.bal.map(o=>{const t=new Float64Array(o.tris.length);for(let k=0;k<t.length;k+=3){t[k]=o.tris[k]+p[0];t[k+1]=o.tris[k+1]+p[1];t[k+2]=o.tris[k+2]+p[2];}return {tag:'balloon',name:o.name,tris:t};}));
// point-triangle distance (Ericson)
function ptTri(p,t){const a=[t[0],t[1],t[2]],b=[t[3],t[4],t[5]],c=[t[6],t[7],t[8]],ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];
 const d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return Math.hypot(...ap);const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return Math.hypot(...bp);
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return Math.hypot(ap[0]-v*ab[0],ap[1]-v*ab[1],ap[2]-v*ab[2]);}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return Math.hypot(...cp);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return Math.hypot(ap[0]-w*ac[0],ap[1]-w*ac[1],ap[2]-w*ac[2]);}
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6)),q=[b[0]+w*(c[0]-b[0]),b[1]+w*(c[1]-b[1]),b[2]+w*(c[2]-b[2])];return Math.hypot(...sub(p,q));}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return Math.hypot(ap[0]-ab[0]*v-ac[0]*w,ap[1]-ab[1]*v-ac[1]*w,ap[2]-ab[2]*v-ac[2]*w);}
function nearest(bvh,p,maxD=8){let best=maxD,who=null;if(!bvh.root)return {d:best,who};const st=[bvh.root];
 while(st.length){const n=st.pop();let dd=0;for(let c=0;c<3;c++){const e=Math.max(n.lo[c]-p[c],0,p[c]-n.hi[c]);dd+=e*e;}if(Math.sqrt(dd)>=best)continue;
  if(n.l){st.push(n.l,n.r);continue;}for(let k=n.s;k<n.e;k++){const i=bvh.idx[k],d=ptTri(p,bvh.tris[i]);if(d<best){best=d;who=bvh.tag[i].tag+':'+bvh.tag[i].name;}}}
 return {d:best,who};}
// ---- camera maths ----
const basis=pose=>FL.basis(pose);
function proj(pose,aspect,p){const {fw,r,up,th}=basis(pose),v=sub(p,pose.position),z=v[0]*fw[0]+v[1]*fw[1]+v[2]*fw[2];return [(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*aspect),(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th),z];}
const toPt=(n,w,h)=>[(n[0]+1)/2*w,(1-n[1])/2*h];
function uiCheck(pose,feet,[w,h]){const ins=BL.boardSafeInsets(w,h),cap=ins.capsule,a=w/h;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,behind=false;
 for(const dx of[-GIRL_W,GIRL_W])for(const dz of[-GIRL_W,GIRL_W])for(const y of[0,GIRL_H]){const n=proj(pose,a,[feet[0]+dx,feet[1]+y,feet[2]+dz]);if(n[2]<=.05)behind=true;const q=toPt(n,w,h);x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}
 const edge=Math.min(x0-ins.left,w-ins.right-x1,y0-ins.top,h-ins.bottom-y1);
 const capGap=cap?Math.max(cap.left-x1,x0-cap.right,cap.top-y1,y0-cap.bottom):1e9;
 return {edge:+edge.toFixed(1),capsule:+capGap.toFixed(1),gap:+Math.min(edge,capGap).toFixed(1),heightFrac:+((y1-y0)/h).toFixed(3),widthFrac:+((x1-x0)/w).toFixed(3),behind,box:[x0,y0,x1,y1].map(v=>+v.toFixed(1))};}
function los(G,bb,from,to){const d=sub(to,from),L=Math.hypot(...d),u=d.map(x=>x/L);const a=FL.cast(G.stat,from,u,L-.05),b=bb?FL.cast(bb,from,u,L-.05):null;const h=[a,b].filter(Boolean).sort((x,y)=>x.t-y.t)[0];return h?h.obj.tag+':'+h.obj.name:null;}
function balloonOnScreen(pose,aspect,p){const c=[p[0],p[1]+6.725,p[2]];let n=0,inn=0;for(let i=0;i<10;i++)for(let j=0;j<5;j++){const th=i/10*2*Math.PI,ph=(j/4-.5)*Math.PI,q=[c[0]+2.9*Math.cos(ph)*Math.cos(th),c[1]+3.6*Math.sin(ph),c[2]+2.9*Math.cos(ph)*Math.sin(th)],s=proj(pose,aspect,q);n++;if(s[2]>0&&Math.abs(s[0])<=1&&Math.abs(s[1])<=1)inn++;}
 const bk=proj(pose,aspect,[p[0],p[1]+.6,p[2]]);return {envelope:inn/n,basket:bk[2]>0&&Math.abs(bk[0])<=1&&Math.abs(bk[1])<=1};}
// south-bank rule: ray grid. Forbidden block (lake-local): z ∈ (42, 90], x ∈ [−36, 33], ground y < 3.
const BLOCK_Z1=90,BLOCK_X0=-36,BLOCK_X1=33;
function southBank(G,bb,pose,aspect,cols=27,rows=58){const {fw,r,up,th}=basis(pose);let bad=0,skyBlock=0,maxZ=-1e9,sideVoid=0;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=((i+.5)/cols*2-1)*th*aspect,y=((j+.5)/rows*2-1)*th,d=[fw[0]+r[0]*x+up[0]*y,fw[1]+r[1]*x+up[1]*y,fw[2]+r[2]*x+up[2]*y],l=Math.hypot(...d),u=d.map(v=>v/l);
  const a=FL.cast(G.stat,pose.position,u,800),b=bb?FL.cast(bb,pose.position,u,800):null,h=[a,b].filter(Boolean).sort((p,q)=>p.t-q.t)[0];
  if(h&&h.obj.tag==='balloon')continue;
  if(h){const p=add(pose.position,u.map(v=>v*h.t)),q=toLocal(p);if(h.obj.tag==='lake'){if(q[1]<3)maxZ=Math.max(maxZ,q[2]);if(q[2]>BANK_Z&&q[1]<3)bad++;}else if(q[2]>BANK_Z&&q[1]<3)skyBlock++;continue;}
  // no hit: where does it cross the lake ground plane?
  const o=toLocal(pose.position),dl=rotY(-LJ.yawDeg,u);if(dl[1]<-1e-6){const t=(LAKE_Y-o[1])/dl[1];if(t>0){const z=o[2]+dl[2]*t;maxZ=Math.max(maxZ,z);const x=o[0]+dl[0]*t;if(z>BANK_Z&&z<=BLOCK_Z1&&x>=BLOCK_X0&&x<=BLOCK_X1)bad++;else sideVoid++;}}}
 return {bad,skyBlock,maxZ:+maxZ.toFixed(2),sideVoid,n:cols*rows};}
// ---- shots ----
const smooth5=x=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(10+u*(-15+6*u));};
function startCamera(variant){// skycity follow (free-camera SPEC default: pitch 17°, 7.36 m, FOV 48) behind her, she faces S4→S6 (+variant°)
 const f=sub(S6,S4),h=Math.hypot(f[0],f[2]),y=Math.atan2(f[0]/h,f[2]/h)+variant*Math.PI/180,c=[S6[0],S6[1]+1.0,S6[2]],p=17*Math.PI/180,D=7.36;
 return {position:[c[0]-Math.sin(y)*Math.cos(p)*D,c[1]+Math.sin(p)*D,c[2]-Math.cos(y)*Math.cos(p)*D],target:c,fovVerticalDeg:48};}
function landingFor([w,h]){const L=LC.lakesideJourney(S6),land=LC.lakesideScreenLanding(L,LC.lakesideScreenFrame(w,h,BL.boardSafeInsets(w,h))),e=Core.arrivalPose(L.arrival,L.focus,land);return {position:e.position,target:e.target,fovVerticalDeg:land.arrivalFovDeg};}
function oldShot(){// e9dffc0 as shipped: old path + lens; the girl is NOT carried (stays at S6); after the ride the controller re-applies its stale start camera
 const K={climbM:14,descentM:12,durationS:22,easeInS:4,easeOutS:4,camBackM:8.5,camUpM:3.2,camSideM:1.4,lookUpM:1.1,fovDeg:48};
 const start=S6,dx=bank[0]-start[0],dz=bank[2]-start[2],h=Math.hypot(dx,dz)||1,ux=dx/h,uz=dz/h,descent=Math.min(K.descentM,h*.45),climbRun=Math.min(8,Math.max(2,h-descent-2));
 const climb=[start[0]+ux*climbRun,start[1]+K.climbM,start[2]+uz*climbRun],drop=[bank[0]-ux*descent,bank[1]+Math.min(2.4,K.climbM*.2),bank[2]-uz*descent],cruise=[drop[0],climb[1],drop[2]],pth=[start,climb,cruise,bank];
 const total=Core.routeLength(pth),timing=B.lakesideBalloonTiming(total,{...K});
 return {name:'old',timing,total,path:pth,vehicle:t=>Core.sampleRoute(pth,Core.journeyDistanceAt(total,timing,Math.max(0,Math.min(timing.durationS,t)))),girl:()=>S6,
  camera:(t)=>B.lakesideBalloonLens(Core.sampleRoute(pth,Core.journeyDistanceAt(total,timing,Math.max(0,Math.min(timing.durationS,t)))),bank,{...K})};}
function newShot(land){const F=B.lakesideBalloonFlight(S6,bank,land,KN);return {name:'new',F,timing:F.timing,total:F.total,path:F.path,vehicle:F.vehicle,girl:t=>F.vehicle(t),camera:(t,from)=>F.camera(t,from)};}
function dirOf(p){const f=sub(p.target,p.position),l=Math.hypot(...f);return f.map(x=>x/l);}
const ang=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])))*180/Math.PI;
function kinematics(shot,from){const T=shot.timing.durationS,dt=1/60,P=[],D=[],F=[];for(let t=0;t<=T+1e-9;t+=dt){const p=shot.camera(t,from);P.push(p.position);D.push(dirOf(p));F.push(p.fovVerticalDeg);}
 let aMax=0,aAt=0,alMax=0,alAt=0,wMax=0,fovRate=0;const W=[];for(let i=0;i+1<D.length;i++){const c=[D[i][1]*D[i+1][2]-D[i][2]*D[i+1][1],D[i][2]*D[i+1][0]-D[i][0]*D[i+1][2],D[i][0]*D[i+1][1]-D[i][1]*D[i+1][0]],s=Math.hypot(...c),th=Math.atan2(s,D[i][0]*D[i+1][0]+D[i][1]*D[i+1][1]+D[i][2]*D[i+1][2]);W.push(s>1e-12?c.map(x=>x/s*th/dt*180/Math.PI):[0,0,0]);}
 for(let i=1;i+1<P.length;i++){const a=Math.hypot(...[0,1,2].map(c=>(P[i+1][c]-2*P[i][c]+P[i-1][c])/(dt*dt)));if(a>aMax){aMax=a;aAt=i*dt;}fovRate=Math.max(fovRate,Math.abs(F[i+1]-F[i])/dt);}
 for(let i=0;i+1<W.length;i++){const al=Math.hypot(...[0,1,2].map(c=>(W[i+1][c]-W[i][c])/dt));if(al>alMax){alMax=al;alAt=i*dt;}wMax=Math.max(wMax,Math.hypot(...W[i]));}
 return {linAccMax:+aMax.toFixed(3),linAt:+aAt.toFixed(2),angAccMax:+alMax.toFixed(2),angAt:+alAt.toFixed(2),angVelMax:+wMax.toFixed(2),fovRateMax:+fovRate.toFixed(2)};}
function jump(a,b){return {posM:+Math.hypot(...sub(a.position,b.position)).toFixed(4),viewDeg:+ang(dirOf(a),dirOf(b)).toFixed(3),fovDeg:+Math.abs((a.fovVerticalDeg||48)-(b.fovVerticalDeg||48)).toFixed(3)};}
module.exports={oldShot,newShot,geometry,balAt,nearest,uiCheck,southBank,balloonOnScreen,los,kinematics,startCamera,landingFor,S6,bank,toLocal,LJ,B,KN,SCREENS};
if(require.main===module)(async()=>{
 const G=await geometry(),out={knobs:KN,S6,bankWorld:bank,bankLocal:toLocal(bank),screens:{}};const from=startCamera(0);console.log('startCam local',JSON.stringify(toLocal(from.position)),JSON.stringify(toLocal(from.target)));
 for(const scr of (process.argv.includes('--fast')?SCREENS.slice(0,1):SCREENS)){const key=scr.join('x'),land=landingFor(scr),aspect=scr[0]/scr[1],res={};
  for(const shot of [oldShot(),newShot(land)]){const T=shot.timing.durationS,rows=[];let worst={clear:1e9,gap:1e9,env:1,bad:0,skyBlock:0,maxZ:-1e9,los:0,crop:0,height:1e9};
   for(let t=0;t<=T+1e-9;t+=process.argv.includes('--fast')?1/2:1/10){const pose=shot.camera(t,from),v=shot.vehicle(t),girl=shot.girl(t),bb=balAt(G,v);
    const cl=Math.min(nearest(G.stat,pose.position).d,nearest(bb,pose.position).d),ui=uiCheck(pose,girl,scr),sb=southBank(G,bb,pose,aspect,18,39),bo=balloonOnScreen(pose,aspect,v);
    const head=los(G,shot.name==='new'?bb:null,pose.position,[girl[0],girl[1]+1.55,girl[2]]),chest=los(G,shot.name==='new'?bb:null,pose.position,[girl[0],girl[1]+1.2,girl[2]]);
    rows.push({t:+t.toFixed(2),clear:+cl.toFixed(2),gap:ui.gap,h:ui.heightFrac,env:+bo.envelope.toFixed(2),basket:bo.basket,bad:sb.bad,sky:sb.skyBlock,maxZ:sb.maxZ,head,chest,alt:+(toLocal(v)[1]-LAKE_Y).toFixed(2),zL:+toLocal(v)[2].toFixed(2)});
    worst.clear=Math.min(worst.clear,cl);worst.gap=Math.min(worst.gap,ui.gap);worst.env=Math.min(worst.env,bo.envelope);worst.bad+=sb.bad>0?1:0;worst.skyBlock+=sb.skyBlock>0?1:0;worst.maxZ=Math.max(worst.maxZ,sb.maxZ);worst.los+=(head||chest)?1:0;worst.height=Math.min(worst.height,ui.heightFrac);}
   const endPose=shot.camera(T,from);
   res[shot.name]={durationS:T,lengthM:+shot.total.toFixed(2),frames:rows.length,minClearM:+worst.clear.toFixed(3),minUiGapPt:worst.gap,minEnvelopeOnScreen:worst.env,southBankBadFrames:worst.bad,skycityDeckInBlockFrames:worst.skyBlock,maxVisibleLakeZ:+worst.maxZ.toFixed(2),
    occludedFrames:worst.los,minGirlHeightFrac:worst.height,kin:kinematics(shot,from),startJump:jump(from,shot.camera(0,from)),
    endVsLanding:jump(endPose,land),afterRide:shot.name==='old'?jump(endPose,from):jump(endPose,endPose),rows};
  }
  // standing landing pose itself (with the balloon parked on the bank)
  const bb=balAt(G,bank),ui=uiCheck(land,bank,scr),sb=southBank(G,bb,land,aspect);
  res.landing={pose:land,clearM:+Math.min(nearest(G.stat,land.position).d,nearest(bb,land.position).d).toFixed(3),ui,southBank:sb,head:los(G,bb,land.position,[bank[0],bank[1]+1.55,bank[2]]),chest:los(G,bb,land.position,[bank[0],bank[1]+1.2,bank[2]])};
  out.screens[key]=res;}
 // start-camera robustness (390×844): other skycity follow headings
 out.startVariants={};const land0=landingFor(SCREENS[0]);for(const v of [0,90,-90,180]){const fr=startCamera(v),sh=newShot(land0);out.startVariants[v]={blendInS:+B.balloonBlendInS(fr,sh.F.follow(0),sh.timing.durationS,KN).toFixed(2),kin:kinematics(sh,fr),startJump:jump(fr,sh.camera(0,fr))};}
 const o=arg('--out')||path.join(__dirname,'audit.json');fs.writeFileSync(o,JSON.stringify(out,null,1));
 for(const k in out.screens){const s=out.screens[k];for(const n of ['old','new']){const r=s[n];console.log(k,n,JSON.stringify({T:r.durationS,L:r.lengthM,clear:r.minClearM,gap:r.minUiGapPt,env:r.minEnvelopeOnScreen,bad:r.southBankBadFrames,deck:r.skycityDeckInBlockFrames,maxZ:r.maxVisibleLakeZ,occ:r.occludedFrames,h:r.minGirlHeightFrac,kin:r.kin,start:r.startJump,end:r.endVsLanding,after:r.afterRide}));}
  console.log(k,'landing',JSON.stringify({clear:s.landing.clearM,ui:s.landing.ui,sb:s.landing.southBank,head:s.landing.head,chest:s.landing.chest}));}
 console.log('startVariants',JSON.stringify(out.startVariants));
})().catch(e=>{console.error(e);process.exit(1);});
