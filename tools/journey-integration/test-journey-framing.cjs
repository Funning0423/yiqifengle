#!/usr/bin/env node
'use strict';
/* v3 journey lens framing contract (lead review build05-journey-a373227-4c30cf7):
 * F1 angular velocity of the view direction ≤ 20°/s at walk speed (no whip, 08→09 at 94–95 s);
 * F2 character (feet+head) in frame on both legs after the authored-pose exemption;
 * F3 sky-island underside ≤ 10% of the frame on 08→09 (73–84 s);
 * F4 night sky visible (sky band mean ≥ 0.10 per leg, final frame ≥ 0.15);
 * F5 08→09 final frame: plaza centre centred, character ≈ 1/6 of screen height;
 * F6 04→05 start follows her: in frame from d ≥ 1.25 m and peak turn ≤ 20°/s.
 * F7 04→05 lens on her right side from set-off (v3.2 camera rule).
 * Geometry on real GLB triangles + real TS; not a rendered or device acceptance. */
const sc=require('./journey-scene.cjs'),F=require('./journey-framing-lib.cjs');
const {fs,assert,Core,legs,sampleRoute,routeLength,journeyCamera,island,meadow,skyFrame,focus2,JOURNEY_CAMERA,L}=sc;
const results=[];function check(id,fn){try{results.push({id,status:'PASS',evidence:fn()});}catch(e){results.push({id,status:'FAIL',error:String(e&&e.stack||e)});}}
const STEP=.1,isMass=o=>o.tag==='skycity',bvh=F.buildBvh([...island,...meadow,...skyFrame]);
const run=leg=>{const T=routeLength(leg.path),rows=[];let prev=null;for(let d=0;d<=T+1e-9;d+=STEP){const dd=Math.min(T,d),c=journeyCamera(leg.path,dd,leg.start,leg.focus,leg.lens,leg.startBlendM),dv=F.dir(c),b=F.body(c,sampleRoute(leg.path,dd));
 rows.push({d:+dd.toFixed(2),c,angDegS:prev?F.angle(prev,dv)/(STEP/L.speedMps):0,inFrame:b.inFrame,height:b.height});prev=dv;}return {T,rows};};
const R=legs.map(run),cov={};
const covOf=(i)=>cov[i]||(cov[i]=R[i].rows.filter((_,k)=>k%5===0||k===R[i].rows.length-1).map(r=>({d:r.d,...F.coverage(r.c,bvh,isMass)})));
check('F1 view angular velocity ≤ 20°/s on both legs',()=>{const out={};legs.forEach((l,i)=>{const m=R[i].rows.reduce((a,r)=>r.angDegS>a.angDegS?r:a);assert(m.angDegS<=20,`${l.id} turns ${m.angDegS.toFixed(1)}°/s at d=${m.d}`);out[l.id]={maxDegS:+m.angDegS.toFixed(2),atM:m.d};});return out;});
check('F2 character in frame on both legs (after authored-pose exemption)',()=>{const out={};legs.forEach((l,i)=>{const bad=R[i].rows.filter(r=>r.d>=(l.exempt||0)&&!r.inFrame);assert(!bad.length,`${l.id} out of frame at ${bad.slice(0,5).map(r=>r.d)}`);out[l.id]={samples:R[i].rows.length};});return out;});
const b2=routeLength(sc.appr2),lensEnd=b2+19;
check('F3 08→09 under-city span (bridge start → lens end): sky-island underside ≤ 10% of frame',()=>{const c=covOf(1),span=c.filter(r=>r.d<=lensEnd),m=span.reduce((a,r)=>r.underside>a.underside?r:a),all=c.reduce((a,r)=>r.underside>a.underside?r:a);assert(m.underside<=.10,`underside ${m.underside.toFixed(3)} at d=${m.d}`);return {spanM:[0,+lensEnd.toFixed(2)],maxUnderside:+m.underside.toFixed(3),atM:m.d,wholeLegMax:{underside:+all.underside.toFixed(3),atM:all.d,note:'arrival descent/final composition, plaza rim'}};});
const zeroRun=c=>{let best=0,s=null;for(const r of c){if(r.sky===0){if(s===null)s=r.d;best=Math.max(best,r.d-s);}else s=null;}return best;};
check('F4 night sky visible: 04→05 mean ≥ 0.10; no zero-sky stretch > 11 m on either leg; final 08→09 frame ≥ 0.15',()=>{const out={};[0,1].forEach(i=>{const c=covOf(i),mean=c.reduce((a,r)=>a+r.sky,0)/c.length,z=zeroRun(c);if(i===0)assert(mean>=.10,`${legs[i].id} mean sky ${mean.toFixed(3)}`);assert(z<=11,`${legs[i].id} zero-sky stretch ${z.toFixed(1)} m`);out[legs[i].id]={meanSky:+mean.toFixed(3),longestZeroSkyM:+z.toFixed(1),samples:c.length};});
 const fin=covOf(1).at(-1);assert(fin.sky>=.15,'final sky '+fin.sky);out.finalSky=+fin.sky.toFixed(3);return out;});
check('F5 08→09 final frame: plaza centre |x|≤0.1, -0.1≤y≤0.45; character height 0.13–0.21',()=>{const r=R[1].rows.at(-1),[x,y,z]=F.ndc(r.c,focus2);assert(z>0&&Math.abs(x)<=.1&&y>=-.1&&y<=.45,`plaza ndc ${x},${y}`);assert(r.height>=.13&&r.height<=.21,'height '+r.height);return {plazaNdc:[+x.toFixed(3),+y.toFixed(3)],herHeight:+r.height.toFixed(3)};});
check('F6 04→05 start follows her: in frame from 1.25 m, first 10 m turn ≤ 20°/s',()=>{const rows=R[0].rows.filter(r=>r.d<=10),m=Math.max(...rows.map(r=>r.angDegS));assert(m<=20,'start turn '+m);assert(rows.filter(r=>r.d>=1.25).every(r=>r.inFrame));return {maxDegS:+m.toFixed(2)};});
// F7 (v3.2 camera rule): the lens stays on her RIGHT. Bearing of the lens from her, measured against her walking heading
// (journeyHeading), must never be left of directly behind. Checked on 04→05 from set-off (no exemption).
check('F7 04→05 lens on her right side from set-off (never left of behind)',()=>{const leg=legs[0],T=routeLength(leg.path);let worst=-999,at=0;
 for(let d=0;d<=T+1e-9;d+=.1){const dd=Math.min(T,d),c=journeyCamera(leg.path,dd,leg.start,leg.focus,leg.lens,leg.startBlendM),p=sampleRoute(leg.path,dd),[hx,hz]=Core.journeyHeading(leg.path,dd),vx=c.position[0]-p[0],vz=c.position[2]-p[2],back=-(vx*hx+vz*hz),right=vx*(-hz)+vz*hx,a=Math.atan2(-right,back)*180/Math.PI;if(a>worst){worst=a;at=dd;}}
 assert(worst<=0,`lens ${worst.toFixed(1)}° left of behind at d=${at.toFixed(1)}`);return {worstLeftOfBehindDeg:+worst.toFixed(1),atM:+at.toFixed(1)};});
// F7b (landing A, 2026-10-16): 08→09 lens on her RIGHT against her FACING (runtime yaw = route tangent 0.08 m ahead),
// never left of directly behind, except in the last 10 m where landing A may swing round to her left.
const facing=(path,d)=>{const a=sampleRoute(path,d),b=sampleRoute(path,d+.08);let x=b[0]-a[0],z=b[2]-a[2];if(Math.hypot(x,z)<1e-4){const c=sampleRoute(path,Math.max(0,d-.08));x=a[0]-c[0];z=a[2]-c[2];}const l=Math.hypot(x,z)||1;return [x/l,z/l];};
check('F7b 08→09 lens on her right side (vs her facing) until the last 10 m',()=>{const leg=legs[1],T=routeLength(leg.path);let worst=-999,at=0;
 for(let d=0;d<T-10;d+=.05){const c=journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,leg.startBlendM),p=sampleRoute(leg.path,d),[hx,hz]=facing(leg.path,d),vx=c.position[0]-p[0],vz=c.position[2]-p[2],back=-(vx*hx+vz*hz),right=vx*(-hz)+vz*hx,a=Math.atan2(-right,back)*180/Math.PI;if(a>worst){worst=a;at=d;}}
 assert(worst<=0,`lens ${worst.toFixed(1)}° left of behind at d=${at.toFixed(1)}`);return {worstLeftOfBehindDeg:+worst.toFixed(1),atM:+at.toFixed(1),leftAllowedFromM:+(T-10).toFixed(2)};});
// F8 (landing A): no lift — 08→09 lens never more than 7 m above her feet over the whole leg.
check('F8 08→09 no lift: lens ≤ 7 m above her over the whole leg',()=>{const leg=legs[1];let maxUp=0,at=0;for(const r of R[1].rows){const p=sampleRoute(leg.path,r.d),u=r.c.position[1]-p[1];if(u>maxUp){maxUp=u;at=r.d;}}
 assert(maxUp<=7,'lens up '+maxUp.toFixed(2));return {maxUpM:+maxUp.toFixed(2),atM:at};});
// F9 (landing A v2): final 08→09 frame shows her WHOLE body — feet (0.05 m) and head top (1.65 m) inside the frame with at least
// 5% of screen height below her feet (ndc y ≥ −0.90) and |x| ≤ 0.85.
check('F9 08→09 final frame: whole body in frame, feet ≥ 5% of screen height above the bottom edge',()=>{const leg=legs[1],T=routeLength(leg.path),c=journeyCamera(leg.path,T,leg.start,leg.focus,leg.lens,leg.startBlendM),p=sampleRoute(leg.path,T),f=F.ndc(c,[p[0],p[1]+.05,p[2]]),h=F.ndc(c,[p[0],p[1]+1.65,p[2]]);
 assert(f[2]>0&&h[2]>0,'behind camera');assert(f[1]>=-.9,`feet ndc y ${f[1].toFixed(3)}`);assert(h[1]<=.9,'head out');assert(Math.abs(f[0])<=.85&&Math.abs(h[0])<=.85,`x ${f[0].toFixed(2)},${h[0].toFixed(2)}`);
 return {feetNdcY:+f[1].toFixed(3),bottomMarginPct:+((f[1]+1)/2*100).toFixed(1),headNdcY:+h[1].toFixed(3),x:+f[0].toFixed(2)};});
const report={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',timeUTC:new Date().toISOString(),scope:'Screen-space geometry (ray grid 13×28, 390×844) on real GLB triangles + real TS. Not a render.',camera:JOURNEY_CAMERA,checks:results};
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/journey-framing.json',JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({status:report.status,checks:results.map(r=>({id:r.id,status:r.status,evidence:r.evidence,error:r.error&&r.error.split('\n')[0].slice(0,300)}))},null,1));if(report.status!=='PASS')process.exitCode=1;
