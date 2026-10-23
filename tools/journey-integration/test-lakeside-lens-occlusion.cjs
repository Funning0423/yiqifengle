#!/usr/bin/env node
'use strict';
/* b17r7 lakeside free-walk lens occlusion (运镜bot). Report: reports/lakeside-lens-occlusion.json. Geometry + real TS, not a render.
 * Walk: 48 seeded walkPath() routes on the lakeside walkable grid (RegionWalkable 'lakeside', lakeside-local metres), her feet
 * sampled at 30 fps at 1.4 m/s. Lenses: followPose (ExploreCameraCore, FollowWalk) on each of the 7 screens, and the lakeside
 * FreeOrbit (rawPose = what solve() gives on the static-merged scene, whose renderer boxes are all > 14 m and skipped) at
 * yaw = behind/left/right/front of her heading × pitch 2/15/35° × arm 5/9/14 m.
 *  L1 (hard) her head AND chest are visible from the lens (disc rule as route O1: ≥5 of 9 rays blocked = hidden) by REAL occluder triangles (tree trunk/crown,
 *     bush, post, house, pavilion, rock, bridge, boat, porch, barrel, clothesline: the kinds LakesideLensOccluders proxies).
 *     A lens inside a closed occluder fails here too (the segment from her crosses its surface).
 *  L1 is gated on the FollowWalk lens (followPose, every screen): occluded frames ≤ 0.2 % (residual = she hugs a house wall /
 *  the clothesline, the occluder inside the 1.6 m arm floor; the lens then holds its eased arm instead of jumping, listed). L2 (hard) no snap on it: lens step ≤ 1.0 m/frame beyond the raw
 *  lens's own step (the fast ease-in is capped at 9 m/s = 0.3 m/frame). L3 (hard) orbit grid: occluded frames ≤ 10 % of before
 *  (the 36 orbit poses include low/side/front arms a player rarely holds; listed per occluder, report-only per frame).
 *  Report: clearance from proxies (≥1.1 m share), frames at the 1.6 m arm floor, terrain-only hits (not an occluder kind).
 * BEFORE = raw lens (76a04336..1c5adec5). AFTER = LensPullIn on LAKESIDE_LENS_OCCLUDERS. QF_LKO_MODE=before prints the before run
 * as the gate (fails), default gates AFTER. */
const fs=require('node:fs'),J=require('./journey-scene.cjs'),LKS=require('./lakeside/lakeside-scene.cjs');
const W=J.H.load(J.S+'region/RegionWalkable.ts'),E=J.H.load(J.S+'region/ExploreCameraCore.ts'),FO=J.H.load(J.S+'region/FreeOrbit.ts'),
 OC=J.H.load(J.S+'region/LensOcclusion.ts'),PX=J.H.load(J.S+'region/LakesideLensOccluders.ts');
const OCC=/^LK_(tree_|band_tree|shore_bush|house_|pavilion|chime_post|bridge_i$|shore_rock|rock_i|lantern_boat|clothesline|porch_steps|barrel)/,TERR=/^LK_terrain/;
const inst=LKS.instances();
function bvh(objs){const T=[];for(const o of objs)for(let k=0;k<o.tris.length;k+=9)T.push({o:o.name,t:o.tris.subarray(k,k+9)});return T;}
const occ=bvh(inst.filter(i=>OCC.test(i.name.replace(/\.\d+$/,'')))),terr=bvh(inst.filter(i=>TERR.test(i.name)));
// uniform grid in xz for speed
function grid(T,c=2){const g=new Map();for(let i=0;i<T.length;i++){const t=T[i].t;let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let k=0;k<9;k+=3){x0=Math.min(x0,t[k]);x1=Math.max(x1,t[k]);z0=Math.min(z0,t[k+2]);z1=Math.max(z1,t[k+2]);}
 for(let gx=Math.floor(x0/c);gx<=Math.floor(x1/c);gx++)for(let gz=Math.floor(z0/c);gz<=Math.floor(z1/c);gz++){const k=gx+','+gz;if(!g.has(k))g.set(k,[]);g.get(k).push(i);}}return {g,c,T};}
const G=grid(occ),GT=grid(terr);
function mt(o,d,t){const e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]],p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-12)return -1;const inv=1/det,s=[o[0]-t[0],o[1]-t[1],o[2]-t[2]],u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])*inv;if(u<0||u>1)return -1;const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*inv;if(v<0||u+v>1)return -1;return (e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;}
function segHit(GR,a,b){const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=Math.hypot(...d);if(L<1e-6)return null;const u=d.map(x=>x/L),seen=new Set(),n=Math.ceil(L/(GR.c/2))+1;
 for(let s=0;s<=n;s++){const x=a[0]+d[0]*s/n,z=a[2]+d[2]*s/n;for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){const k=(Math.floor(x/GR.c)+ox)+','+(Math.floor(z/GR.c)+oz),l=GR.g.get(k);if(!l)continue;for(const i of l){if(seen.has(i))continue;seen.add(i);const t=mt(a,u,GR.T[i].t);if(t>1e-4&&t<L-1e-4)return GR.T[i].o;}}}return null;}
/* Same feature rule as test-route-occlusion O1: a disc facing the lens (head r 9 cm, chest r 12 cm), centre + 8 rim rays; HIDDEN when
 * ≥5 of 9 rays cross a real occluder triangle (thin rails / ropes that one ray reports are grazes, not occlusion). */
function discHit(eye,p,r){const f=[p[0]-eye[0],p[1]-eye[1],p[2]-eye[2]],l=Math.hypot(...f),u=f.map(x=>x/l),a=Math.abs(u[1])<.9?[0,1,0]:[1,0,0];
 const cr=(x,y)=>[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],nz=v=>{const L=Math.hypot(...v);return v.map(x=>x/L);},e1=nz(cr(u,a)),e2=cr(u,e1);
 let n=0,by=null;const c=segHit(G,eye,p);if(c){n++;by=c;}if(!c&&false)return null;
 for(let k=0;k<8;k++){const th=k*Math.PI/4,q=[0,1,2].map(i=>p[i]+e1[i]*r*Math.cos(th)+e2[i]*r*Math.sin(th)),b=segHit(G,eye,q);if(b){n++;by=by||b;}if(n+(7-k)<5)return null;}
 return n>=5?by:null;}
const boxes=PX.LAKESIDE_LENS_OCCLUDERS.map(r=>({min:[r[0],r[1],r[2]],max:[r[3],r[4],r[5]]}));
const gap=(p)=>{let g=1e9;for(const b of boxes){let d=0,ins=true;for(let k=0;k<3;k++){const v=p[k]<b.min[k]?b.min[k]-p[k]:p[k]>b.max[k]?p[k]-b.max[k]:0;if(v>0)ins=false;d+=v*v;}g=Math.min(g,ins?0:Math.sqrt(d));}return g;};
// seeded routes
let seed=17;const rnd=()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;const g=W.walkGrid('lakeside');const cells=[];for(let i=0;i<g.h.length;i++)if(!Number.isNaN(g.h[i]))cells.push(i);
const cellAt=i=>[g.x0+(i%g.W+.5)*g.c,g.h[i],g.z0+(((i/g.W)|0)+.5)*g.c];
let snapped=0;const NR=+(process.env.QF_LKO_ROUTES||12);const routes=[];for(let tries=0;routes.length<NR&&tries<400;tries++){const a=cellAt(cells[(rnd()*cells.length)|0]),b=cellAt(cells[(rnd()*cells.length)|0]);if(Math.hypot(a[0]-b[0],a[2]-b[2])<8)continue;const p=W.walkPath('lakeside',a,b);if(p&&p.length>2)routes.push(p);}
/* Her feet: the walk grid floor (RegionWalkable) is the TERRAIN under the bridge deck (deck top ~1.1 m higher, she walks on it in
 * game), so the feet snap up to the highest real surface (occluder or terrain) within 1.4 m above the grid floor. */
function surfaceY(f){const o=[f[0],f[1]+1.4,f[2]];let best=f[1];for(const GR of [G,GT]){const k=Math.floor(f[0]/GR.c)+','+Math.floor(f[2]/GR.c),l=GR.g.get(k);if(!l)continue;for(const i of l){const t=mt(o,[0,-1,0],GR.T[i].t);if(t>0&&t<1.4+1e-6){const y=o[1]-t;if(y>best)best=y;}}}return best;}
function resample(p,step){const out=[];let acc=0;out.push(p[0]);for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],L=Math.hypot(b[0]-a[0],b[2]-a[2]);let t=step-acc;while(t<=L){const u=t/L;out.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]);t+=step;}acc=(acc+L)%step;}return out;}
const SPEED=1.4,DT=1/30;
const lensSets=[];for(const s of E.SCREENS)lensSets.push({id:'follow '+s.join('x'),screen:s,mk:(f,h)=>E.followPose(f,h,s[0],s[1],0)});
for(const yo of [180,90,-90,0])for(const pi of [2,15,35])for(const d of [5,9,14])lensSets.push({id:`orbit yaw${yo>=0?'+':''}${yo} p${pi} d${d}`,mk:(f,h)=>{const o=new FO.FreeOrbit('lakeside');o.yaw=h*180/Math.PI+yo;o.pitch=pi;o.dist=d;o.seeded=true;return o.rawPose(f);}});
if(process.env.QF_LKO_FAMILY)lensSets.splice(0,lensSets.length,...lensSets.filter(l=>l.id.startsWith(process.env.QF_LKO_FAMILY)));
const res={};for(const mode of ['before','after']){const fs_={};let worst=null,frames=0,bad=0,badHead=0,clear11=0,atMin=0,terrHits=0,maxStep=0,maxTurn=0;const badSpans=[],byOcc={};
 for(const L of lensSets){for(let r=0;r<routes.length;r++){const P=resample(routes[r],SPEED*DT);P.forEach((q,k)=>{const fl=W.walkFloorY('lakeside',q[0],q[2]),y0=fl===null?q[1]:fl,y=surfaceY([q[0],y0,q[2]]);if(y>y0+0.05&&L===lensSets[0])snapped++;P[k]=[q[0],y,q[2]];});const pull=new OC.LensPullIn();let prev=null,prevRaw=null;
  for(let i=0;i<P.length;i++){const f=P[i],n=P[Math.min(P.length-1,i+3)],q=P[Math.max(0,i-3)],h=Math.atan2(n[0]-q[0],n[2]-q[2]);const raw=L.mk(f,h);
   const pose=mode==='before'?raw:pull.apply(raw,f,boxes,i?DT:0);frames++;
   const head=[f[0],f[1]+1.5,f[2]],chest=[f[0],f[1]+1.1,f[2]],ph=discHit(pose.position,head,.09),pc=discHit(pose.position,chest,.12);
   const fam=L.id.split(' ')[0];fs_[fam]=fs_[fam]||{frames:0,occ:0,maxStep:0};fs_[fam].frames++;if(ph||pc)fs_[fam].occ++;
   if(ph||pc){bad++;if(ph)badHead++;const k=String(ph||pc).replace(/\.\d+$/,'');byOcc[k]=(byOcc[k]||0)+1;if(badSpans.length<12&&(!badSpans.length||badSpans.at(-1).lens!==L.id||badSpans.at(-1).route!==r))badSpans.push({lens:L.id,route:r,i,by:ph||pc,feet:f.map(x=>+x.toFixed(2)),lens:pose.position.map(x=>+x.toFixed(2)),raw:raw.position.map(x=>+x.toFixed(2)),crane:pose.craneDeg,arm:pose.occ&&+pose.occ.arm.toFixed(2),full:pose.occ&&+pose.occ.full.toFixed(2),head:!!ph,chest:!!pc,lensId:L.id});}
   if(segHit(GT,pose.position,chest))terrHits++;
   if(gap(pose.position)>=1.1-1e-6)clear11++;if(pose.occ&&pose.occ.blockedAtMin)atMin++;
   if(prev){const s=Math.hypot(...pose.position.map((x,k)=>x-prev.position[k]))-Math.hypot(...raw.position.map((x,k)=>x-prevRaw.position[k]));{const F=fs_[L.id.split(' ')[0]];F.maxStep=Math.max(F.maxStep,s);if(s>1.0){F.snaps=(F.snaps||0)+1;if(!F.snapSample||F.snapSample.length<5)(F.snapSample=F.snapSample||[]).push({lens:L.id,r,i,s:+s.toFixed(2),crane:pose.craneDeg,swing:pose.swingDeg,arm:pose.occ&&+pose.occ.arm.toFixed(2),hard:pose.occ&&+pose.occ.hardArm.toFixed(2)});}}if(s>maxStep){maxStep=s;worst={lens:L.id,route:r,i,s:+s.toFixed(2),feet:f.map(x=>+x.toFixed(2)),from:prev.position.map(x=>+x.toFixed(2)),to:pose.position.map(x=>+x.toFixed(2)),crane:pose.craneDeg,arm:pose.occ&&+pose.occ.arm.toFixed(2),hard:pose.occ&&+pose.occ.hardArm.toFixed(2),full:pose.occ&&+pose.occ.full.toFixed(2)};}
    const dv=v=>{const d=v.target.map((x,k)=>x-v.position[k]),l=Math.hypot(...d);return d.map(x=>x/l);},a=dv(pose),b=dv(raw);const pa=dv(prev),pb=dv(prevRaw),ang=x=>Math.acos(Math.min(1,x[0][0]*x[1][0]+x[0][1]*x[1][1]+x[0][2]*x[1][2]))*180/Math.PI;maxTurn=Math.max(maxTurn,(ang([a,pa])-ang([b,pb]))/DT);}
   prev=pose;prevRaw=raw;}}}
 res[mode]={frames,occludedFrames:bad,headOccludedFrames:badHead,occludedShare:+(bad/frames).toFixed(4),byOccluder:byOcc,clear11Share:+(clear11/frames).toFixed(4),armFloorFrames:atMin,terrainChestHits:terrHits,maxExtraStepM:+maxStep.toFixed(3),maxExtraTurnDegS:+maxTurn.toFixed(1),sample:badSpans,worstStep:worst,byLensFamily:fs_};
 const fo=fs_.follow||{occ:0,snaps:0},ob=fs_.orbit||{occ:0,snaps:0};
 res[mode].L1=fo.occ<=0.002*fo.frames?'PASS':'FAIL';res[mode].followOccShare=+(fo.occ/Math.max(1,fo.frames)).toFixed(5);res[mode].L2=!(fo.snaps>0)?'PASS':'FAIL';
 res[mode].L3orbit=mode==='after'?(ob.occ<=0.1*(res.before.byLensFamily.orbit||{occ:0}).occ&&(ob.maxStep||0)<=1.5?'PASS':'FAIL'):'n/a';/* orbit: ≤10% of before AND no teleport (extra step ≤1.5 m/frame; drag lens, crane at 70°/s on a 14 m arm) */console.error(mode,JSON.stringify({...res[mode],sample:undefined}));}
const STAGE=require('fs').readFileSync(require('path').join(__dirname,'../../creator-build-project/assets/scripts/world-r2/RegionNodeStage.ts'),'utf8');
const wiring={orbit:/this\.occlude\(this\.guardOrbitGround\(this\.orbit\.solve/.test(STAGE),follow:/this\.occlude\(followPose\(/.test(STAGE),proxies:/LAKESIDE_LENS_OCCLUDERS/.test(STAGE),reset:/this\.lensPull\.reset\(\)/.test(STAGE)};
const L4=Object.values(wiring).every(Boolean)?'PASS':'FAIL';
const gateMode=process.env.QF_LKO_MODE==='before'?'before':'after',r=res[gateMode],status=r.L1==='PASS'&&r.L2==='PASS'&&r.L3orbit!=='FAIL'&&(gateMode==='before'||L4==='PASS')?'PASS':'FAIL';res.L4wiring={...wiring,status:L4};
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/lakeside-lens-occlusion.json',JSON.stringify({status,gate:gateMode,routes:routes.length,feetSnappedToDeck:snapped,lensSets:lensSets.length,screens:E.SCREENS,proxies:boxes.length,scope:'Geometry (real lakeside GLB triangles, lakeside-local) + real TS lens functions. Not a render or device acceptance.',...res},null,1)+'\n');
console.log(JSON.stringify({status,gate:gateMode,before:{L1:res.before.L1,occ:res.before.occludedFrames,frames:res.before.frames},after:{L1:res.after.L1,L2:res.after.L2,occ:res.after.occludedFrames,clear11:res.after.clear11Share,armFloor:res.after.armFloorFrames,step:res.after.maxExtraStepM}}));
process.exitCode=status==='PASS'?0:1;
