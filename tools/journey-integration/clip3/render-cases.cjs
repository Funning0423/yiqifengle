'use strict';
// 运镜bot clip3: before/after sheets for the three 9ec5323c cases (NOT_ENGINE flat raster of the real meshes; her = red box).
// before = the 9ec5323c Mac lens (fixtures) in the 9ec5323c placement (visible city = Cw + Δ 26.6 m); after = the current code's lens
// (f6cf3af9 + this branch) in the current placement (city at Cw), same leg-relative moment, 7 screens.  node render-cases.cjs <outdir>
const fs=require('fs'),path=require('path'),cp=require('child_process'),L=require('./lens-scene.cjs');const OUT=process.argv[2];fs.mkdirSync(OUT,{recursive:true});
const SCR=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
(async()=>{const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/9ec5323c-key-try2-sky-cam.json'),'utf8')).samples,T2=require('../fixtures/9ec5323c-t02-approach.json');
 const sky9=await L.skyObjs(L.DELTA_9EC),sky0=await L.skyObjs([0,0,0]),m=await require('./sky-lake-model.cjs')();
 const {createHarness}=require('../../board-ui/harness.cjs'),H=createHarness(),TS=H.load('region/TransitionStaging.ts'),SW=H.load('region/SkyWalkShot.ts'),F=H.load('region/SkyFinaleShot.ts'),NW=H.load('region/NodeWalker.ts'),C=H.load('region/ExploreCameraCore.ts');
 const M5=TS.TRANSITION_STAGING.skyMooring5a,W=p=>SW.skyLocalToWorld(M5,p),moored=L.balloonObjs(M5.world,M5.worldYawDeg),panels=[];
 const shot=(name,objs,pose,w,h,label)=>{const R=L.render(objs,pose,w,h,240),f=path.join(OUT,name+'.ppm');L.ppm(f,R);panels.push({f,label});return f;};
 const sheet=(file,rows,title)=>{fs.writeFileSync(file+'.json',JSON.stringify({title,rows}));cp.execFileSync('python3',['-c',`
import json,sys
from PIL import Image,ImageDraw
d=json.load(open(sys.argv[1]));rows=d['rows'];W=max(len(r['cells']) for r in rows);ims=[[Image.open(c['f']) for c in r['cells']] for r in rows]
cw=max(i.size[0] for r in ims for i in r);ch=max(i.size[1] for r in ims for i in r);LW=230
S=Image.new('RGB',(LW+W*(cw+4),30+len(rows)*(ch+34)),'white');g=ImageDraw.Draw(S);g.text((6,8),d['title'],fill='black')
for j,(r,ri) in enumerate(zip(rows,ims)):
  y=30+j*(ch+34);g.text((6,y+ch//2),r['label'],fill='black')
  for i,(c,im) in enumerate(zip(r['cells'],ri)):S.paste(im,(LW+i*(cw+4),y));g.text((LW+i*(cw+4),y+ch+2),c['label'],fill=(180,0,0) if c.get('bad') else (0,100,0))
S.save(sys.argv[2])`,file+'.json',file]);fs.unlinkSync(file+'.json');};
 const near=(leg,p)=>{let b=0,bd=1e9;for(let t=0;t<=leg.S.touchdownAt;t+=1/30){const d=Math.hypot(...leg.S.cam(t,null).position.map((v,i)=>v-p[i]));if(d<bd){bd=d;b=t;}}return b;};
 const her=(leg,tau)=>{const h=leg.herAt(tau);return h&&h.root?L.herObjs(h.root):[];};
 // case 1 + 2: before row (9ec samples, 390x844), after rows (model, 7 screens) at the same leg moments
 for(const [cid,win,title] of [['case1',[16.5,37.5],'Case 1 skycity→lakeside opening (keys 121–132): before = 9ec5323c Mac lens (prewalk 26.95 m through the city), after = current code (no prewalk: she ends the finale on S6, the ride walk lens starts there)'],['case2',[56,64.9],'Case 2 balloon lift-off (keys 187–191): before = 9ec5323c Mac lens in the 9ec5323c city placement, after = current code (same lens path, city where the balloon is)']]){
  const S9=fx.filter(s=>s.tS>=win[0]&&s.tS<=win[1]),rows=[];const pick=S9.filter((_,i)=>i%Math.max(1,Math.ceil(S9.length/6))===0).slice(0,6);
  rows.push({label:'BEFORE 9ec5323c (390x844)',cells:pick.map(s=>{const pose=L.poseFromEuler(s.pos,s.euler,s.fov),R=L.clearance([L.bvh(sky9)],s.pos,3);return {f:shot(`${cid}-before-${s.tS}`,[...sky9,...moored],pose,390,844),label:`+${s.tS.toFixed(1)}s clr ${R.m===Infinity?'>3':R.m.toFixed(2)}m`,bad:R.m<0.5};})});
  const leg0=m.legs[0],taus=cid==='case1'?pick.map((_,i)=>i*leg0.S.walkS/(pick.length-1)):pick.map(s=>near(leg0,s.pos));
  for(const leg of m.legs){rows.push({label:'AFTER '+leg.screen.join('x'),cells:taus.map(tau=>{const p=leg.S.cam(tau,null),R=L.clearance([L.bvh(sky0)],p.position,3);return {f:shot(`${cid}-after-${leg.screen.join('x')}-${tau.toFixed(2)}`,[...sky0,...L.balloonObjs(leg.S.basket(tau),leg.yawAt(tau)),...her(leg,tau)],p,leg.screen[0],leg.screen[1]),label:`ride ${tau.toFixed(1)}s ${leg.S.phase(tau)} clr ${R.m===Infinity?'>3':R.m.toFixed(2)}m`,bad:R.m<0.5};})});}
  sheet(path.join(OUT,cid+'-before-after-7screens.png'),rows,title);}
 // case 3: T-02 approach
 {const route=NW.routeKeys('skycity','S4','S6').path,feetL=route.at(-1),segs=NW.planWalk('skycity','S4','S6').segments,last=segs.at(-1).path,pa=last.at(-2),face=Math.atan2(feetL[0]-pa[0],feetL[2]-pa[2]);
  const SO=H.load('region/SkycityLensOccluders.ts'),boxes=SO.SKYCITY_LENS_OCCLUDERS.map(b=>({min:b.slice(0,3),max:b.slice(3,6)})),to={...F.SKY_FINALE_POSE_LOCAL},from=C.followPose(route[0],face,390,844,8),ap=F.skyFinaleApproach(from,to,feetL,boxes);
  const n=7,rows=[],B9=L.bvh(sky9),B0=L.bvh(sky0);const oldFeet=W([0.941,0.044,-27.059]).map((v,i)=>v+L.DELTA_9EC[i]);
  const tgt9=(s,i)=>{const nx=T2.samples[Math.min(T2.samples.length-1,i+1)],pr=T2.samples[Math.max(0,i-1)];return s;};
  // before: reconstructed 9ec approach poses (look toward her old stand, as the slerped view does at that moment ≈ toward her)
  const idx=[...Array(n)].map((_,k)=>Math.round(k*(T2.samples.length-1)/(n-1)));
  rows.push({label:'BEFORE 9ec5323c (390x844)',cells:idx.map(i=>{const s=T2.samples[i],pose={position:s.pWorld9ec,target:add3(oldFeet,[0,1.2,0]),fovVerticalDeg:46},R=L.clearance([B9],s.pWorld9ec,3);return {f:shot(`case3-before-${i}`,[...sky9,...L.herObjs(oldFeet)],pose,390,844),label:`+${(T2.approachStartTS+s.t).toFixed(2)}s clr ${R.m===Infinity?'>3':R.m.toFixed(2)}m`,bad:R.m<0.5};})});
  const feetW=W(feetL);for(const [w,h] of SCR){rows.push({label:'CURRENT '+w+'x'+h+' (from S4 follow)',cells:[...Array(n)].map((_,k)=>{const t=k/(n-1)*ap.T,p=F.skyFinaleApproachPose(from,to,feetL,t,ap.T,ap.dir),pw={position:W(p.position),target:W(p.target),fovVerticalDeg:p.fovVerticalDeg},R=L.clearance([B0],pw.position,3);return {f:shot(`case3-cur-${w}x${h}-${k}`,[...sky0,...L.herObjs(feetW)],pw,w,h),label:`t ${t.toFixed(2)}s clr ${R.m===Infinity?'>3':R.m.toFixed(2)}m`,bad:R.m<0.5};})});}
  sheet(path.join(OUT,'case3-before-current-7screens.png'),rows,'Case 3 T-02 approach (key-try2 #42): before = 9ec5323c reconstruction (matches the Mac lens at +8.81 s within 0.15 m, end within 2 mm); current = f6cf3af9 code from the same S4 follow lens — STILL PRESENT (0.39 m from env_sky_ruins)');}
 for(const p of panels)try{fs.unlinkSync(p.f);}catch{}console.log('done',OUT);})().catch(e=>{console.error(e);process.exit(1);});
function add3(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
