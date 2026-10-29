'use strict';
// 运镜bot full9c clip3: WHOLE-TRAJECTORY lens clearance gate (Grok Bot 2026-10-29, 界面验收部 9ec5323c green-flat P1/P1/P2).
// The 1.1 m collision-gate only ever judged BalloonTransit:prewalk/B1 writes against the MEADOW proxy (every other writer = UNCHECKED),
// test_lake_leg_c W4 only the transition occluder BOXES before flight (no mesh, no balloon, no ground), test_t02_sky_final F4 only
// boxes + a RELATIVE mesh rule (≥ min(1.1, start)) from ONE ideal follow pose. This gate checks every lens sample against the REAL
// meshes live at that moment: full env_skycity.glb (Draco) at the runtime placement (skyMooring5a/Cw = seam.skycityRootWorld), every
// lakeside instance, the balloon prefab at the basket pose, and her body.
// HARD rules per sample: (E) not enclosed (14 rays × 20 m); (S) ≥ 0.5 m from solid mesh; (B) ≥ 0.5 m from basket/envelope;
// (H) ≥ 0.5 m from her body (capsule r 0.3); (G) ground straight below ≥ 1.5 m on travel shots (board, lift-off, flight, prewalk, trace
// legs), ≥ 1.1 m on the standing walk/finale shots; (J) step ≤ 0.6 m per 60 Hz frame (model). SOFT (reported): foliage/flower cards,
// the walking gardener robot.
// Usage: node lens-clearance-gate.cjs [--json out] [--screens all|one]         → current code (sky→lake ride ×7 screens, T-02 approach)
//        node lens-clearance-gate.cjs --must-fail-9ec                         → the three 9ec5323c failures must be caught (exit 0 = caught)
const fs=require('fs'),path=require('path'),L=require('./clip3/lens-scene.cjs'),{RL,J}=L,{add,sub,rotY}=J;
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;},has=k=>process.argv.includes(k);
const RULE={solidM:0.5,balloonM:0.5,herM:0.5,groundTravelM:1.5,groundStandM:1.1,stepM:0.6},SOFT=/foliage_cards|flowers|robot_gardener|cloud|cumulus/;
const segDist=(p,a,b)=>{const d=sub(b,a),l2=d[0]*d[0]+d[1]*d[1]+d[2]*d[2]||1,u=Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1]+(p[2]-a[2])*d[2])/l2));return Math.hypot(p[0]-a[0]-d[0]*u,p[1]-a[1]-d[1]*u,p[2]-a[2]-d[2]*u);};
function judge(p,{solid,soft,balloon,her,travel}){const r={},v=[];
 const cs=L.clearance(solid,p,3);r.solidM=cs.m;r.solidTag=cs.tag;if(cs.m<RULE.solidM)v.push('S');
 if(soft){const c=L.clearance(soft,p,1);r.softM=c.m;r.softTag=c.tag;}
 if(L.enclosed([...solid,...(balloon?[balloon]:[])],p)){r.enclosed=true;v.push('E');}
 if(balloon){const c=L.clearance([balloon],p,3);r.balloonM=c.m;if(c.m<RULE.balloonM)v.push('B');}
 if(her){const d=segDist(p,her[0],her[1])-0.3;r.herM=d;if(d<RULE.herM)v.push('H');}
 const g=L.groundBelow([...solid,...(balloon?[balloon]:[])],p,40);r.groundM=g.m;r.groundTag=g.tag;if(g.m<(travel?RULE.groundTravelM:RULE.groundStandM))v.push('G');
 r.v=v;return r;}
async function scene(off){const objs=await L.skyObjs(off);return {solid:L.bvh(objs.filter(o=>!SOFT.test(o.name))),soft:L.bvh(objs.filter(o=>SOFT.test(o.name)))};}
const r2=x=>x===Infinity?'>3':+(+x).toFixed(2);
// ---------- T-02 approach (RegionNodeStage.playFinale: skyFinaleApproach on the lens boxes, model-local) ----------
function t02(H,from,to,feetL,label){const F=H.load('region/SkyFinaleShot.ts'),SO=H.load('region/SkycityLensOccluders.ts');
 const boxes=SO.SKYCITY_LENS_OCCLUDERS.map(b=>({min:b.slice(0,3),max:b.slice(3,6)})),ap=F.skyFinaleApproach(from,to,feetL,boxes),out=[];
 for(let k=0;k<=Math.ceil(ap.T*60);k++){const t=Math.min(ap.T,k/60);out.push({t,p:F.skyFinaleApproachPose(from,to,feetL,t,ap.T,ap.dir).position});}return {label,T:ap.T,dir:ap.dir,samples:out};}
async function runCurrent(){const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
 const SW=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),NW=H.load('region/NodeWalker.ts'),C=H.load('region/ExploreCameraCore.ts'),F=H.load('region/SkyFinaleShot.ts');
 const M5=TS.TRANSITION_STAGING.skyMooring5a,W=p=>SW.skyLocalToWorld(M5,p),sc=await scene([0,0,0]),rows=[],fails=[];
 // (1) skycity→lakeside ride, every screen
 const m=await require('./clip3/sky-lake-model.cjs')(),lake=m.G.lakeOnly;const solid=[sc.solid,lake];
 const legs=has('--screens')&&arg('--screens')==='one'?m.legs.slice(0,1):m.legs;
 for(const leg of legs){const S=leg.S,acc={};let prev=null,jump=0;
  for(let tau=0;tau<=S.touchdownAt;tau+=1/60){const p=S.cam(tau,null).position;if(prev)jump=Math.max(jump,Math.hypot(...sub(p,prev)));prev=p;
   if(Math.round(tau*60)%3)continue/* 20 Hz for the ray checks */;const ph=S.phase(tau),h=leg.herAt(tau),her=h?[h.root||sub(h.face,[0,1.5,0]),add(h.face,[0,.2,0])]:null;
   const r=judge(p,{solid,soft:[sc.soft],balloon:L.bvh(L.balloonObjs(S.basket(tau),leg.yawAt(tau))),her,travel:ph!=='C1-walk'});
   const a=acc[ph]||(acc[ph]={n:0,viol:0,first:null,solidMin:9,balloonMin:9,herMin:9,groundMin:99,softMin:9,enclosed:0,tags:new Set()});a.n++;
   a.solidMin=Math.min(a.solidMin,r.solidM);a.balloonMin=Math.min(a.balloonMin,r.balloonM);a.herMin=Math.min(a.herMin,r.herM??9);a.groundMin=Math.min(a.groundMin,r.groundM);a.softMin=Math.min(a.softMin,r.softM??9);if(r.enclosed)a.enclosed++;
   if(r.v.length){a.viol++;r.v.forEach(x=>a.tags.add(x+':'+(x==='G'?r.groundTag:r.solidTag)));if(!a.first)a.first={tau:+tau.toFixed(2),p:p.map(v=>+v.toFixed(2)),v:r.v};}}
  for(const [ph,a] of Object.entries(acc)){const row={case:'sky→lake ride',screen:leg.screen.join('x'),seg:ph,samples:a.n,violations:a.viol,enclosed:a.enclosed,solidMinM:r2(a.solidMin),balloonMinM:r2(a.balloonMin),herMinM:r2(a.herMin),groundMinM:a.groundMin===Infinity?'none':r2(a.groundMin),softMinM:r2(a.softMin),first:a.first,tags:[...a.tags].slice(0,4)};rows.push(row);if(a.viol)fails.push(row);}
  const jr={case:'sky→lake ride',screen:leg.screen.join('x'),seg:'step',maxStepM:+jump.toFixed(3),violations:jump>RULE.stepM?1:0};rows.push(jr);if(jr.violations)fails.push(jr);}
 // (2) T-02 approach from the walk lens: the ideal follow pose at S6 (test F4) and the S4 follow pose (the lens the 9ec5323c Mac run
 //     actually approached from: held at (60.91,25.01,140.01) = S4 follow + Δ for 6 s, see fixtures/9ec5323c-key-try2-sky-cam.json)
 const route=NW.routeKeys('skycity','S4','S6').path,feetL=route.at(-1),segs=NW.planWalk('skycity','S4','S6').segments,last=segs.at(-1).path,pa=last.at(-2),face=Math.atan2(feetL[0]-pa[0],feetL[2]-pa[2]);
 const to={...F.SKY_FINALE_POSE_LOCAL},feetW=W(feetL);
 for(const [lab,from] of [['follow@S6 (F4)',C.followPose(feetL,face,390,844,8)],['follow@S4 (9ec5323c runtime)',C.followPose(route[0],face,390,844,8)]]){
  const A=t02(H,from,to,feetL,lab);let a={n:0,viol:0,enclosed:0,solidMin:9,groundMin:99,first:null,tags:new Set()};
  for(const s of A.samples.filter((_,i)=>i%3===0)){const p=W(s.p),r=judge(p,{solid:[sc.solid],soft:[sc.soft],her:[feetW,add(feetW,[0,1.7,0])],travel:false});a.n++;a.solidMin=Math.min(a.solidMin,r.solidM);a.groundMin=Math.min(a.groundMin,r.groundM);if(r.enclosed)a.enclosed++;
   if(r.v.length){a.viol++;r.v.forEach(x=>a.tags.add(x+':'+(x==='G'?r.groundTag:r.solidTag)));if(!a.first)a.first={t:+s.t.toFixed(2),p:p.map(v=>+v.toFixed(2)),v:r.v};}}
  const row={case:'T-02 approach',screen:'all (pose is screen-independent)',seg:lab,approachS:+A.T.toFixed(2),samples:a.n,violations:a.viol,enclosed:a.enclosed,solidMinM:r2(a.solidMin),groundMinM:a.groundMin===Infinity?'none':r2(a.groundMin),first:a.first,tags:[...a.tags].slice(0,4)};rows.push(row);if(a.viol)fails.push(row);}
 return {rows,fails};}
// ---------- 9ec5323c must-fail fixtures ----------
async function runMustFail(){const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/9ec5323c-key-try2-sky-cam.json'),'utf8')).samples,M=require('./fixtures/9ec5323c-t02-approach.json');
 const sc9=await scene(L.DELTA_9EC),{createHarness}=require('../board-ui/harness.cjs'),H=createHarness(),TS=H.load('region/TransitionStaging.ts'),SW=H.load('region/SkyWalkShot.ts'),M5=TS.TRANSITION_STAGING.skyMooring5a;
 const bal=L.bvh(L.balloonObjs(M5.world,M5.worldYawDeg))/* moored at C, as in 9ec5323c */,out=[];
 const caseOf=t=>t>=16.5&&t<=37.5?'1 skycity→lakeside opening (prewalk, keys 121–132)':t>=57&&t<=63.5?'2 balloon lift-off (keys 187–191)':null;
 for(const s of fx){const c=caseOf(s.tS);if(!c)continue;const r=judge(s.pos,{solid:[sc9.solid],soft:[sc9.soft],balloon:bal,travel:true});out.push({case:c,tS:s.tS,pos:s.pos,v:r.v,solidM:r2(r.solidM),solidTag:r.solidTag,groundM:r.groundM===Infinity?'none ≤40 m':r2(r.groundM),enclosed:!!r.enclosed});}
 for(const s of M.samples){const r=judge(s.pWorld9ec,{solid:[sc9.solid],soft:[sc9.soft],travel:false});out.push({case:'3 T-02 last shot through the steps (key-try2 #42)',tS:+(M.approachStartTS+s.t).toFixed(2),pos:s.pWorld9ec,v:r.v,solidM:r2(r.solidM),solidTag:r.solidTag,groundM:r.groundM===Infinity?'none ≤40 m':r2(r.groundM),enclosed:!!r.enclosed});}
 const per={};for(const o of out){const p=per[o.case]||(per[o.case]={samples:0,caught:0,first:null});p.samples++;if(o.v.length){p.caught++;if(!p.first)p.first=o;}}
 return {per,out};}
(async()=>{if(has('--must-fail-9ec')){const {per,out}=await runMustFail();const ok=Object.keys(per).length===3&&Object.values(per).every(p=>p.caught>0);
  console.log(JSON.stringify({tool:'lens-clearance-gate --must-fail-9ec',rule:RULE,per},null,1));if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify({per,out},null,1));
  console.log(JSON.stringify({status:ok?'PASS (all three 9ec5323c penetrations are caught)':'FAIL (gate misses a known 9ec5323c penetration)'}));process.exit(ok?0:1);}
 const {rows,fails}=await runCurrent();console.table(rows.map(r=>({case:r.case,screen:r.screen,seg:r.seg,n:r.samples,viol:r.violations,enc:r.enclosed,solid:r.solidMinM,balloon:r.balloonMinM,her:r.herMinM,ground:r.groundMinM,soft:r.softMinM,step:r.maxStepM,T:r.approachS})));
 for(const f of fails)console.log('FAIL',JSON.stringify(f));if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify({rule:RULE,rows},null,1));
 console.log(JSON.stringify({status:fails.length?'FAIL':'PASS',violations:fails.length}));process.exit(fails.length?1:0);})().catch(e=>{console.error(e);process.exit(1);});
