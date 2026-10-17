#!/usr/bin/env node
'use strict';
/* 运镜bot (r5, cine/skycity-bridge-r2-cam): 08→09 lens for 场景设计部's sky-city plan B r2 (rainbow-bridge/IMPLEMENTATION.md §8),
 * on the production code (SkycityBridgeCamera.skyB2RouteCamera + RegionJourneyCore.journeyCamera crane end) and real geometry:
 * the FULL sky-city GLB (skycity-b2/fixture-skycity-full.*, not the clipped occlusion fixture), the meadow GLB, the bridge deck
 * (±1.05 m, −0.25…+0.10 m) and the meadow-exit ramp (±2 m) as proxies. Routes per portrait screen exactly as plan B builds them:
 * her r4.1 meadow stop → the raised meadow-exit ramp → the bridge centreline → the lawn stand line to that screen's stop
 * (skycity-b2/r2-layout.json = the designer's r2 data). Walk simulated at 60 Hz, 1.2 m/s. Plans A (30°, recommended) and B (28°).
 *  C1 route valid (validateJourneyRoute: no focus, landing = anchorSmoothM only, board with crane).
 *  C2 lens clearance ≥ 1.1 m from all geometry (every 5th frame + every frame of the last 2 m).
 *  C3 her head (1.62 m), face (1.5 m) and chest (1.2 m) never occluded (every 3rd frame).
 *  C4 her feet, chest and head top inside the frame on the whole leg (screen aspect).
 *  C5 F7b: lens right of directly behind her facing until the last 10 m.
 *  C6 no whip / kick: view turn ≤ 20°/s, lens acceleration ≤ 2 m/s², FOV rate ≤ 2°/s.
 *  C7 swap: pose at her stop = the board camera (skycityVisitPose of the board copy, mapped) — ≤ 0.1°, ≤ 1 cm, FOV ≤ 0.1°;
 *     the lens comes to rest there (last-frame speed ≤ 0.05 m/s).
 *  C8 the crane starts on the bridge, inside its 30° (A) / 28° (B) section, and before the last 10 m.
 *  C9 before the crane she is at most 80% across the frame (F9 rule); her x at the stop is reported (board-UI dictated).
 *  C10 O5 (plan B budget, Grok Bot): 08→09 ≤ Build05 + 6 s; extra vs Build05 and vs the r4 route reported.
 *  C11 UI gap at the stop (board camera = last frame): her box (RegionBoardLanding.girlBoxPt) overlaps none of girlStandUi (tray, plate,
 *      3-tool row, r4.1 hint banner above the tray — GGbot 260ea02 footprint, pause, capsule, safe bands) and keeps ≥ GIRL_STAND.minGapPt.
 * Geometry on triangles + real TS; not a render or device acceptance. */
const fs=require('fs'),zlib=require('zlib'),crypto=require('crypto');
const Jn=require('./journey-scene.cjs'),F=require('./journey-framing-lib.cjs');
const {H,S,add,sub,rotY,sampleRoute,routeLength}=Jn;
const RBL=H.load(S+'region/RegionBoardLanding.ts'),BLy=H.load(S+'ui/BoardLayout.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts'),Cam=H.load(S+'region/SkycityBridgeCamera.ts'),Visit=H.load(S+'region/SkycityVisitPose.ts');
const D=Math.PI/180,STEP=.02,DT=STEP/1.2,BUILD05=42.865,SCREENS=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
const lay=JSON.parse(fs.readFileSync(__dirname+'/skycity-b2/r2-layout.json','utf8')),meta=JSON.parse(fs.readFileSync(__dirname+'/skycity-b2/fixture-skycity-full.json','utf8'));
const bin=zlib.gunzipSync(fs.readFileSync(__dirname+'/skycity-b2/fixture-skycity-full.bin.gz'));
if(crypto.createHash('sha256').update(bin).digest('hex')!==meta.binSha256)throw Error('skycity-b2 fixture corrupt');
const f32=new Float32Array(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength));
// journey copy: state_*_before hidden (§8.4), env_sky_floatingrocks(_cards)_1 hidden (§8.5.3); far clouds / birds are not obstacles
const SKIP=/^state_.*before|^env_sky_floatingrocks(_cards)?_1$|cloudsea|cumulus_far|islets_far|env_sky_birds/;
const results=[];const check=(id,fn)=>{try{results.push({id,status:'PASS',evidence:fn()});}catch(e){results.push({id,status:'FAIL',error:String(e&&e.message||e)});}};
const ok=(c,m)=>{if(!c)throw Error(m);};
function ribbon(path,half,y0,y1,tag){const t=[];for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1,n=[dz/l,0,-dx/l],c=(p,s,y)=>[p[0]+n[0]*s,p[1]+y,p[2]+n[2]*s];
 for(const y of [y0,y1]){const q=[c(a,-half,y),c(a,half,y),c(b,half,y),c(b,-half,y)];t.push(...q[0],...q[1],...q[2],...q[0],...q[2],...q[3]);}
 for(const s of [-half,half]){const q=[c(a,s,y0),c(a,s,y1),c(b,s,y1),c(b,s,y0)];t.push(...q[0],...q[1],...q[2],...q[0],...q[2],...q[3]);}}return {tag,name:tag,tris:Float64Array.from(t)};}
function ptTri(p,t){const a=[t[0],t[1],t[2]],b=[t[3],t[4],t[5]],c=[t[6],t[7],t[8]],ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2],L=v=>Math.hypot(...v);
 const d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return L(ap);const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return L(bp);const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return L(sub(p,add(a,ab.map(x=>x*v))));}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return L(cp);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return L(sub(p,add(a,ac.map(x=>x*w))));}
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return L(sub(p,add(b,sub(c,b).map(x=>x*w))));}const dn=1/(va+vb+vc);return L(sub(p,add(a,add(ab.map(x=>x*vb*dn),ac.map(x=>x*vc*dn)))));}
function nearest(bvh,p,cap=4){let best=cap,who=null;const st=[bvh.root];while(st.length){const n=st.pop();let dd=0;for(let c=0;c<3;c++){const v=Math.max(n.lo[c]-p[c],0,p[c]-n.hi[c]);dd+=v*v;}if(Math.sqrt(dd)>=best)continue;
 if(n.l){st.push(n.l,n.r);continue;}for(let k=n.s;k<n.e;k++){const i=bvh.idx[k],d=ptTri(p,bvh.tris[i]);if(d<best){best=d;who=bvh.tag[i];}}}return {d:best,who:who&&who.tag+':'+who.name};}
const blocked=(bvh,o,e)=>{const d=sub(e,o),l=Math.hypot(...d),h=F.cast(bvh,o,d.map(x=>x/l),l-.02);return h?h.obj.tag+':'+h.obj.name:null;};
const ndc=(pose,p,asp)=>{const b=F.basis(pose),v=sub(p,pose.position),z=v[0]*b.fw[0]+v[1]*b.fw[1]+v[2]*b.fw[2];return [(v[0]*b.r[0]+v[1]*b.r[1]+v[2]*b.r[2])/(z*b.th*asp),(v[0]*b.up[0]+v[1]*b.up[1]+v[2]*b.up[2])/(z*b.th),z];};
const angle=(a,b)=>F.angle(F.dir(a),F.dir(b));
const meadowStop=(w,h)=>Jn.meadowSrc.map.toJourney(Jn.standFor(w,h).path.at(-1));
function r4Length(w,h){const m=meadowStop(w,h),appr=[m,...Jn.Lay.meadowExitFrom(m,Jn.exit02to08)];return routeLength(appr)-routeLength(Jn.appr2)+routeLength(Jn.leg2);}
const report={scope:'plan B r2 sky-city 08→09 lens on the full GLB (geometry, not a render)',fixture:{source:meta.source,binSha256:meta.binSha256,triangles:meta.triangles},layoutSources:lay.sources,camera:Cam.SKY_B2_CAMERA,plans:{}};
for(const plan of ['A','B']){const P=lay.plans[plan],toW=q=>{const r=rotY(P.city.yawDeg,q);return add(r,P.city.offsetWorld);};
 const city=[];for(const o of meta.objects){if(SKIP.test(o.name))continue;const t=new Float64Array(o.count*9);for(let k=0;k<t.length;k+=3){const q=toW([f32[o.offset/4+k],f32[o.offset/4+k+1],f32[o.offset/4+k+2]]);t[k]=q[0];t[k+1]=q[1];t[k+2]=q[2];}city.push({tag:'skycity',name:o.name,tris:t});}
 const standW=P.standLineLocal.map(toW),ramp=lay.approachRampWorld,bridge=P.bridgeWorld;
 const bvh=F.buildBvh([...city,...Jn.meadow,ribbon([...bridge,...standW.slice(1,9)],1.05,-.25,.10,'deck'),ribbon(ramp,2,-.3,0,'ramp')]);
 // 30° (A) / 28° (B) section on the bridge (s from the bridge start, arc metres)
 const held=P.bridgeS.filter((s,i)=>P.bridgeSlopeDeg[i]>=P.params.TH-.05),sec=[Math.min(...held),Math.max(...held)];
 const rows=report.plans[plan]={heldSectionBridgeM:sec.map(v=>+v.toFixed(2)),screens:{}};
 for(const [w,h] of SCREENS){const key=w+'x'+h,b=P.boards.find(x=>x.screen===key),m=meadowStop(w,h),asp=w/h;
  const approach=[...(Math.hypot(m[0]-ramp[0][0],m[2]-ramp[0][2])>1e-3?[m]:[]),...ramp],path=[...approach,...bridge.slice(1)],aM=routeLength(approach),bE=routeLength(path);
  let left=b.standWalkM;for(let i=1;i<standW.length&&left>1e-9;i++){const sg=Math.hypot(...sub(standW[i],standW[i-1]));if(sg<=left+1e-9){path.push(standW[i]);left-=sg;}else{path.push(add(standW[i-1],sub(standW[i],standW[i-1]).map(x=>x*left/sg)));left=0;}}
  const T=routeLength(path),stop=path.at(-1),camL=Visit.skycityVisitPose(Jn.sp('anchor_spawn_girl'),Jn.sp('anchor_starcourt_center'),asp);
  const boardPose={position:toW(camL.position),target:toW(camL.target),fovVerticalDeg:camL.fovVerticalDeg};
  const rc=Cam.skyB2RouteCamera(aM,T,{...boardPose,blendM:22});const route={from:'meadow',to:'skycity',path,bridgeStart:aM,bridgeEnd:bE,speed:1.2,startBlendM:0,lens:rc.lens,landing:rc.landing,board:rc.board};
  const start={position:[0,5,0],target:[0,5,8],fovVerticalDeg:48},cam=d=>Core.journeyCamera(path,d,start,undefined,rc.lens,0,rc.landing,rc.board);
  const r={T:+T.toFixed(3),approachM:+aM.toFixed(3),stopVsDesignerCm:+(Math.hypot(...sub(stop,b.stopWorld))*100).toFixed(2)};let routeErr=null;try{Core.validateJourneyRoute(route,path[0]);}catch(e){routeErr=String(e.message||e);}r.routeError=routeErr;
  const blendStart=T-rc.board.blendM;r.craneStartBridgeM=+(blendStart-aM).toFixed(2);r.craneM=rc.board.blendM;
  let minC={d:9},los=[],out=[],F7b=-999,F7bAt=0,angV=0,amax=0,amaxAt=0,fovR=0,maxXFollow=0,pv=null,pd=null,pvel=null,pf=null,lastSpeed=0;
  for(let i=0;;i++){const d=Math.min(T,i*STEP),c=cam(d),her=sampleRoute(path,d),dv=F.dir(c);
   if(i%5===0||T-d<2){const n=nearest(bvh,c.position);if(n.d<minC.d)minC={d:n.d,at:d,who:n.who};}
   if(i%3===0)for(const [k,y] of [['head',1.62],['face',1.5],['chest',1.2]]){const hb=blocked(bvh,c.position,[her[0],her[1]+y,her[2]]);if(hb)los.push({d:+d.toFixed(2),k,hb});}
   const nd=[.05,1.2,1.7253].map(y=>ndc(c,[her[0],her[1]+y,her[2]],asp));nd.forEach((q,k)=>{if(!(q[2]>0&&Math.abs(q[0])<=1&&Math.abs(q[1])<=1))out.push({d:+d.toFixed(2),k:['feet','chest','head'][k],ndc:q.map(v=>+v.toFixed(2))});});
   const xf=(Math.max(...nd.map(q=>q[0]))+1)/2;if(d<blendStart)maxXFollow=Math.max(maxXFollow,xf);
   if(d<T-10){const a=sampleRoute(path,d),q=sampleRoute(path,d+.08);let x=q[0]-a[0],z=q[2]-a[2];const l=Math.hypot(x,z)||1;x/=l;z/=l;const vx=c.position[0]-her[0],vz=c.position[2]-her[2],back=-(vx*x+vz*z),right=vx*(-z)+vz*x,ang=Math.atan2(-right,back)/D;if(ang>F7b){F7b=ang;F7bAt=d;}}
   if(pv){angV=Math.max(angV,F.angle(pv,dv)/DT);}if(pd){const v=sub(c.position,pd).map(x=>x/DT);lastSpeed=Math.hypot(...v);if(pvel){const a=Math.hypot(...sub(v,pvel))/DT;if(a>amax){amax=a;amaxAt=d;}}pvel=v;}if(pf!==null)fovR=Math.max(fovR,Math.abs(c.fovVerticalDeg-pf)/DT);
   pv=dv;pd=c.position;pf=c.fovVerticalDeg;if(d>=T)break;}
  {const ui=RBL.girlStandUi(w,h,BLy.boardSafeInsets(w,h)),box=RBL.girlBoxPt(camL,rotY(-P.city.yawDeg,sub(stop,P.city.offsetWorld)),w,h);let gap=Infinity,over=0;
   for(const q of ui){const ox=Math.min(box.r,q.r)-Math.max(box.l,q.l),oy=Math.min(box.b,q.b)-Math.max(box.t,q.t);if(ox>0&&oy>0)over+=ox*oy;gap=Math.min(gap,Math.hypot(Math.max(q.l-box.r,box.l-q.r,0),Math.max(q.t-box.b,box.t-q.b,0)));}
   gap=Math.min(gap,box.l,box.t,w-box.r,h-box.b);r.uiGap={gapPt:+gap.toFixed(1),overlapPt2:+over.toFixed(1),boxPt:Object.fromEntries(Object.entries(box).map(([k,v])=>[k,+v.toFixed(1)]))};}
  const end=cam(T),stopNd=[.05,1.2,1.7253].map(y=>ndc(end,[stop[0],stop[1]+y,stop[2]],asp));
  Object.assign(r,{minClearanceM:+minC.d.toFixed(3),minClearanceAtM:+(minC.at||0).toFixed(2),minClearanceWho:minC.who,occludedSamples:los.length,occluded:los.slice(0,4),outOfFrameSamples:out.length,outOfFrame:out.slice(0,4),
   F7bWorstLeftOfBehindDeg:+F7b.toFixed(2),F7bAtM:+F7bAt.toFixed(2),maxTurnDegS:+angV.toFixed(2),maxAccelMps2:+amax.toFixed(3),maxAccelAtM:+amaxAt.toFixed(2),maxFovRateDegS:+fovR.toFixed(3),lastFrameSpeedMps:+lastSpeed.toFixed(4),
   swap:{deg:+angle(end,boardPose).toFixed(5),cm:+(Math.hypot(...sub(end.position,boardPose.position))*100).toFixed(5),fovDeg:+Math.abs(end.fovVerticalDeg-boardPose.fovVerticalDeg).toFixed(5)},
   herMaxXFollowPct:+(maxXFollow*100).toFixed(1),herXAtStopPct:+((Math.max(...stopNd.map(q=>q[0]))+1)/2*100).toFixed(1),
   O5:{totalM:+T.toFixed(2),vsBuild05S:+((T-BUILD05)/1.2).toFixed(2),r4M:+r4Length(w,h).toFixed(2),vsR4S:+((T-r4Length(w,h))/1.2).toFixed(2)}});
  rows.screens[key]=r;}
 const all=Object.values(rows.screens),tag=plan+': ';
 check(tag+'C1 route valid (no focus, landing anchorSmoothM only, crane board end)',()=>{const bad=all.filter(r=>r.routeError);ok(!bad.length,JSON.stringify(bad.map(r=>r.routeError)));ok(all.every(r=>r.stopVsDesignerCm<1),'stop differs from the designer data');return {screens:all.length};});
 check(tag+'C2 lens clearance ≥ 1.1 m (full GLB + meadow + deck/ramp proxies)',()=>{const m=all.reduce((a,r)=>r.minClearanceM<a.minClearanceM?r:a);ok(m.minClearanceM>=1.1,`min ${m.minClearanceM} m at ${m.minClearanceAtM} (${m.minClearanceWho})`);return {minM:m.minClearanceM,who:m.minClearanceWho};});
 check(tag+'C3 head/face/chest never occluded',()=>{const n=all.reduce((a,r)=>a+r.occludedSamples,0);ok(!n,JSON.stringify(all.flatMap(r=>r.occluded).slice(0,4)));return {samples:0};});
 check(tag+'C4 feet/chest/head in frame on the whole leg',()=>{const n=all.reduce((a,r)=>a+r.outOfFrameSamples,0);ok(!n,JSON.stringify(all.flatMap(r=>r.outOfFrame).slice(0,4)));return {outOfFrame:0};});
 check(tag+'C5 F7b lens right of behind until the last 10 m',()=>{const m=Math.max(...all.map(r=>r.F7bWorstLeftOfBehindDeg));ok(m<=0,'worst '+m+'°');return {worstDeg:m};});
 check(tag+'C6 turn ≤ 20°/s, accel ≤ 2 m/s², FOV ≤ 2°/s',()=>{const t=Math.max(...all.map(r=>r.maxTurnDegS)),a=Math.max(...all.map(r=>r.maxAccelMps2)),f=Math.max(...all.map(r=>r.maxFovRateDegS));ok(t<=20&&a<=2&&f<=2,`turn ${t} accel ${a} fov ${f}`);return {turnDegS:t,accelMps2:a,fovDegS:f};});
 check(tag+'C7 swap = board camera (≤0.1°, ≤1 cm, FOV ≤0.1°), at rest',()=>{for(const r of all){ok(r.swap.deg<=.1&&r.swap.cm<=1&&r.swap.fovDeg<=.1,JSON.stringify(r.swap));ok(r.lastFrameSpeedMps<=.05,'moving '+r.lastFrameSpeedMps);}return {maxDeg:Math.max(...all.map(r=>r.swap.deg)),maxCm:Math.max(...all.map(r=>r.swap.cm))};});
 check(tag+'C8 crane starts inside the held section and before the last 10 m',()=>{for(const [k,r] of Object.entries(rows.screens)){ok(r.craneStartBridgeM>=sec[0]-1e-6&&r.craneStartBridgeM<=sec[1]+1e-6,`${k} crane at bridge ${r.craneStartBridgeM} m, section ${sec}`);ok(r.craneM>10,k);}return {section:rows.heldSectionBridgeM,starts:Object.fromEntries(Object.entries(rows.screens).map(([k,r])=>[k,r.craneStartBridgeM]))};});
 check(tag+'C9 her x ≤ 80% of the width before the crane',()=>{const m=Math.max(...all.map(r=>r.herMaxXFollowPct));ok(m<=80,'max '+m+'%');return {maxPct:m,atStopPct:Object.fromEntries(Object.entries(rows.screens).map(([k,r])=>[k,r.herXAtStopPct])),note:'at the stop she is where the board UI leaves room (right of the tool row), not a lens choice'};});
 check(tag+'C11 UI gap at the stop (260ea02 board UI) ≥ minGapPt, no overlap',()=>{for(const [k,r] of Object.entries(rows.screens))ok(r.uiGap.overlapPt2===0&&r.uiGap.gapPt>=RBL.GIRL_STAND.minGapPt,k+' '+JSON.stringify(r.uiGap));return Object.fromEntries(Object.entries(rows.screens).map(([k,r])=>[k,r.uiGap.gapPt]));});
 check(tag+'C10 O5 08→09 ≤ Build05 + 6 s',()=>{const m=Math.max(...all.map(r=>r.O5.vsBuild05S));ok(m<=6,'+'+m+' s');return Object.fromEntries(Object.entries(rows.screens).map(([k,r])=>[k,r.O5]));});
}
report.status=results.every(r=>r.status==='PASS')?'PASS':'FAIL';report.timeUTC=new Date().toISOString();report.checks=results;
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/skycity-bridge-b2-camera.json',JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({status:report.status,checks:results.map(r=>({id:r.id,status:r.status,evidence:r.evidence,error:r.error}))},null,1));if(report.status!=='PASS')process.exitCode=1;
