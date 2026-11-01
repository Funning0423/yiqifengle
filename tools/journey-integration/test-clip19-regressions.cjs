'use strict';
// 运镜bot clip19 (Grok Bot / 界面验收部 2026-10-29, 19bd812a visual acceptance FAIL): one regression row per item, each with a
// must-fail half on the 19bd812a behaviour (Mac [QF_CAM_TRACE] fixture + the 19bd812a lake placement) and a current-code half.
//  R1 P1 lift-off green (finstart 128–137): the lakeside journey copy must be placed from the ride's S6 (mooring C walk start); placed
//     from the prepare-time root (19bd812a: board checkpoint) its terrain hill covers the moored basket. Rules on the C1 board/hold,
//     pre-lift rise and lift-off lens: lens ≥0.5 m from lake meshes, not under lake terrain, her line of sight free of lake meshes,
//     her seat not under lake terrain.
//  R2 P2 T-02 #38: trace replay (19bd812a node-lens swoop) must be caught (lens ≥0.5 m from solid skycity mesh, not enclosed); current =
//     the full9c S4>S6 rail (SkyRunLens, all 7 screens) under the same rule.
//  R3 P2 flight #159: trace replay must be caught; current = the ride lens (lift-off + flight, sky-lake model, lake from S6) ≥0.5 m
//     from skycity + lake meshes.
//  R4 meadow m 407–431: trace replay must be caught (lens within 0.5 m of windmill_static_merged / meadow mesh). Current: OPEN (scene
//     note to 场景设计部, path under the windmill sail disc) → reported, not a pass.
// Usage: node tools/journey-integration/test-clip19-regressions.cjs [--json out]
const fs=require('fs'),path=require('path'),L=require('./clip3/lens-scene.cjs'),F=require('./journey-framing-lib.cjs');
const RULE={solidM:.5,lakeM:.5,meadowM:.5},SOFT=/foliage_cards|flowers|robot_gardener|cloud|cumulus/;
const FX=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/19bd812a-camtrace-clip19.json'),'utf8'));
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
const rows=[];let fails=0;const row=(r)=>{rows.push(r);if(!r.ok)fails++;console.log((r.ok?'PASS ':'FAIL ')+r.id+' '+r.what+' → '+r.got);};
// trace rows → samples, densified to ≤0.25 m (the trace is the written pose per frame; a fast move skips geometry between frames)
function dense(rs){const out=[];for(let i=0;i<rs.length;i++){const a=rs[i],b=rs[i+1];out.push({t:a[0],p:a[1]});if(!b)break;const n=Math.ceil(Math.hypot(b[1][0]-a[1][0],b[1][1]-a[1][1],b[1][2]-a[1][2])/.25);for(let k=1;k<n;k++){const u=k/n;out.push({t:a[0]+(b[0]-a[0])*u,p:a[1].map((v,j)=>v+(b[1][j]-v)*u)});}}return out;}
function worst(B,smp,minM){let w={m:9,t:null,tag:null,enc:0};for(const s of smp){const c=L.clearance(B,s.p,3);if(c.m<w.m)w={...w,m:c.m,t:s.t,tag:c.tag};if(L.enclosed(B,s.p))w.enc++;}w.bad=w.m<minM||w.enc>0;return w;}
const f2=x=>x===Infinity||x>=9?'>3':(+x).toFixed(2);
(async()=>{process.chdir(path.join(__dirname,'../..'));
 const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness(),TS=H.load('region/TransitionStaging.ts'),LC=H.load('region/LakesideCameraLayout.ts'),M5=TS.TRANSITION_STAGING.skyMooring5a;
 const LKS=require('./lakeside/lakeside-scene.cjs');
 const sky=await L.skyObjs([0,0,0]),solid=L.bvh(sky.filter(o=>!SOFT.test(o.name)));
 const lakeAt=start=>{const J=LC.lakesideJourney(start);return L.bvh(LKS.instances().map(i=>{const t=new Float64Array(i.tris.length);for(let k=0;k<t.length;k+=3){const p=J.toWorld([i.tris[k],i.tris[k+1],i.tris[k+2]]);t[k]=p[0];t[k+1]=p[1];t[k+2]=p[2];}return {tag:'lake',name:i.name,tris:t};}));};
 // ---- R1: which start does the adapter place the lake from? (source rule; at mooring C the prepare-time root is the board checkpoint)
 const src=fs.readFileSync('creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts','utf8');
 const fromS6=/L=lakesideJourney\(continuousTransitions\(\)&&M5C\.option==='C'\?\[\.\.\.M5C\.walkWorld\[0\]\] as Vec:start\)/.test(src);
 const m=await require('./clip3/sky-lake-model.cjs')(),leg=m.legs[0],S=leg.S;
 function r1(start){const lake=lakeAt(start);let w={lensM:9,under:0,los:0,seatUnder:false,first:null};
  const seat=add3(M5.seat,[0,.1,0]),up=F.cast(lake,seat,[0,1,0],40);w.seatUnder=!!up;
  for(let tau=S.walkS;tau<=S.flightAt+2.5;tau+=1/20){const p=S.cam(tau,null).position,c=L.clearance([lake],p,3);if(c.m<w.lensM)w.lensM=c.m;
   if(F.cast(lake,p,[0,1,0],40))w.under++;const h=leg.herAt(tau),face=h?h.face:add3(S.basket(tau),[0,1.3,0]),d=[0,1,2].map(i=>face[i]-p[i]),l=Math.hypot(...d);
   const hit=F.cast(lake,p,d.map(v=>v/l),l-.1);if(hit){w.los++;if(!w.first)w.first={tau:+(tau-S.flightAt).toFixed(2),mesh:hit.obj.name};}}
  w.bad=w.lensM<RULE.lakeM||w.under>0||w.los>0||w.seatUnder;return w;}
 function add3(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
 const s6=[...M5.walkWorld[0]],bad19=r1(FX.prepareStart19bd812a);
 row({id:'R1-mustfail',what:'19bd812a lake placement (prepare root '+FX.prepareStart19bd812a+') is caught',ok:bad19.bad,got:'lake lens min '+f2(bad19.lensM)+' m, lens under lake '+bad19.under+', her LOS blocked '+bad19.los+(bad19.first?' (first flight'+bad19.first.tau+' s '+bad19.first.mesh+')':'')+', seat under lake '+bad19.seatUnder});
 const cur=r1(fromS6?s6:FX.prepareStart19bd812a);
 row({id:'R1',what:'C1 hold / pre-lift rise / lift-off lens vs the lake copy (adapter places it from '+(fromS6?'ride S6':'prepare root')+')',ok:!cur.bad,got:'lake lens min '+f2(cur.lensM)+' m, under '+cur.under+', LOS blocked '+cur.los+', seat under '+cur.seatUnder});
 // ---- R2 / R3 / R4 must-fail on the Mac trace
 const t02=worst([solid],dense(FX.cases.t02_finstart38.rows),RULE.solidM);
 row({id:'R2-mustfail',what:'19bd812a T-02 node-lens (finstart #38) caught on the skycity mesh',ok:t02.bad,got:'min '+f2(t02.m)+' m @t '+(t02.t??0).toFixed(2)+' '+t02.tag+', enclosed samples '+t02.enc});
 const fl=worst([solid],dense(FX.cases.flight_finstart159.rows),RULE.solidM);
 row({id:'R3-mustfail',what:'19bd812a flight lateral move (finstart #159) caught on the skycity mesh',ok:fl.bad,got:'min '+f2(fl.m)+' m @t '+(fl.t??0).toFixed(2)+' '+fl.tag+', enclosed '+fl.enc});
 // ---- R2 current: S4>S6 rail on the real mesh, every screen
 const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]],RAIL=fs.existsSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/SkyRunLens.ts'));
 if(!RAIL)row({id:'R2',what:'T-02: full9c S4>S6 rail — this base has no final-cam rail (region/SkyRunLens.ts missing): T-02 NOT fixed here',ok:false,got:'n/a'});else{
 const RM=require('../region-nodes/sky-rail-model.cjs'),SW=H.load('region/SkyWalkShot.ts'),W=p=>SW.skyLocalToWorld(M5,p);let rm={m:9,enc:0,n:0};
 for(const sc of RM.SCREENS)for(const o of [{},{fromS6:true}]){const smp=RM.samples('S4>S6',sc,o);smp.forEach((s,i)=>{if(i%3)return;const p=W(s.p.position),c=L.clearance([solid],p,3);rm.n++;if(c.m<rm.m){rm.m=c.m;rm.tag=c.tag;}if(L.enclosed([solid],p))rm.enc++;});}
 row({id:'R2',what:'T-02: full9c S4>S6 rail (board entry → rail → stand hold, and from S6), 7 screens, skycity mesh',ok:rm.m>=RULE.solidM&&!rm.enc,got:'min '+f2(rm.m)+' m '+(rm.tag||'')+', enclosed '+rm.enc+', samples '+rm.n});}
 // ---- R3 current: lift-off + flight lens (model ride, lake per adapter rule), every screen, skycity + lake meshes
 const lakeCur=lakeAt(fromS6?s6:FX.prepareStart19bd812a);let r3={m:9,enc:0,n:0};
 for(const lg of m.legs){const SS=lg.S;for(let tau=SS.flightAt-1;tau<=SS.touchdownAt;tau+=1/20){const p=SS.cam(tau,null).position,c=L.clearance([solid,lakeCur],p,3);r3.n++;if(c.m<r3.m){r3.m=c.m;r3.tag=c.tag;r3.t=tau-SS.flightAt;}if(L.enclosed([solid,lakeCur],p))r3.enc++;}}
 row({id:'R3',what:'flight lens (lift-off → touchdown, 7 screens) vs skycity + lake meshes',ok:r3.m>=RULE.solidM&&!r3.enc&&fromS6,got:'min '+f2(r3.m)+' m '+(r3.tag||'')+', enclosed '+r3.enc+', samples '+r3.n+(fromS6?'':' (model route ≠ runtime route: lake placed from prepare root)')});
 // ---- R4: transit clouds in the meadow pre-walk. Frame = the RUNTIME meadow root TransportLeg.sailMeadowRoot() (yaw 180), not the
 // journey-scene bridge mOff (26.6 m off in z: her ACTOR -4.3,0.85,67.5 is on ground only in the sail frame; 19bd812a lens never reached the windmill).
 const LG=require('./route/route-legs.cjs'),JJ=require('./journey-scene.cjs'),Fl=JJ.H.load(JJ.S+'region/BalloonFlight.ts'),SR=JJ.H.load(JJ.S+'region/TransportLeg.ts').sailMeadowRoot();
 const craw=require('./occlusion/lib-glb.cjs').load(JJ.B+'region_transit_balloon/transit_clouds_merged.glb').filter(n=>/^clouds_(city_sea|floor)$/.test(n.name)).map(n=>({tag:'cloud',name:n.name,tris:n.tris}));
 const m6=JJ.add(JJ.rotY(180,[0.2,6.5,-25.6]),SR),origin=L.bvh(craw),placed=L.bvh(LG.rigid(craw.filter(o=>!Fl.CITY_CLOUD.includes(o.name)),'cloud',Fl.meadowFrameFromM6(m6)))/* as paint(0) places them */;
 const cm=worst([origin],dense(FX.cases.meadow_m407_431.rows),RULE.meadowM);
 row({id:'R4-mustfail',what:'19bd812a pre-walk lens (m 407–431) vs clouds_city_sea/clouds_floor left at the origin',ok:cm.bad,got:'min '+f2(cm.m)+' m @t '+(cm.t??0).toFixed(2)+' '+cm.tag+', enclosed '+cm.enc});
 const PM=require('./clip19-prewalk-model.cjs');let r4={m:9,enc:0,n:0};
 for(const sc of SCREENS)for(const s of PM.run(sc,null,SR)){const c=L.clearance([placed],s.p,3);r4.n++;if(c.m<r4.m){r4.m=c.m;r4.tag=c.tag;r4.at=s.from+' t'+s.t.toFixed(2);}if(L.enclosed([placed],s.p))r4.enc++;}
 row({id:'R4',what:'meadow pre-walk lens (every start, 7 screens, sail meadow frame) vs the clouds placed as paint(0) places them',ok:r4.m>=RULE.meadowM&&!r4.enc,got:'min '+f2(r4.m)+' m '+(r4.tag||'')+(r4.at?' @'+r4.at:'')+', enclosed '+r4.enc+', samples '+r4.n});
 if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify({rule:RULE,rows},null,1));
 console.log(JSON.stringify({status:fails?'FAIL':'PASS',fails}));process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
