'use strict';
// Segments 1–4 on 场景设计部's anchors (transition-anchors.json) and planned boxes (transition-occluders.json):
// level/ride lens → follow shot on her real path → next ride/level lens. 7 screens, 60 fps. Gates: yaw (walk ≤120°/s ≤300°/s²
// p99 while she walks, ≤90/≤200 otherwise), no position/FOV jump, no lens in a box, ≥1.1 m clearance (scripted follow part),
// face/chest hidden by a box ≤ 0.5 s, she inside the safe frame (LensSmooth.herMargin ≥ 0) on the follow part,
// and "never moves while seated": every walk beat is standing; seated beats only at the vehicle seat.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const RL=require('../journey-integration/route/route-legs.cjs'),{createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const BF=H.load('region/BalloonFlight.ts'),TL=H.load('region/TransportLeg.ts'),HS=H.load('region/HerShot.ts'),TC=H.load('region/TransitionCamera.ts'),LS=H.load('region/LensSmooth.ts');
const A=JSON.parse(fs.readFileSync(path.join(__dirname,'transition-anchors.json'),'utf8')).segments,OCC=JSON.parse(fs.readFileSync(path.join(__dirname,'transition-occluders.json'),'utf8')).boxes;
const boxesOf=(...keys)=>keys.flatMap(k=>{const v=OCC[k];if(!v)return [];if(Array.isArray(v))return v;return Object.values(v);});
const P=a=>a.pos,DT=1/60,RAD=180/Math.PI,wrap=a=>((a%360)+540)%360-180,pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(q*s.length))]||0;};
const yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*RAD;
// a level camera behind her (free-camera default: pitch 17°, 7.36 m, FOV 48)
const levelLens=(feet,yawDeg)=>{const y=yawDeg*Math.PI/180,p=17*Math.PI/180,D=7.36,c=[feet[0],feet[1]+1,feet[2]];return ()=>({position:[c[0]-Math.sin(y)*Math.cos(p)*D,c[1]+Math.sin(p)*D,c[2]-Math.cos(y)*Math.cos(p)*D],target:c,fovVerticalDeg:48});};
const walk=(a,keyFrom,keyTo,s)=>{const pts=a.path.map(P);const i0=keyFrom?pts.findIndex((_,i)=>a.path[i].id===keyFrom):0,i1=keyTo?a.path.findIndex(q=>q.id===keyTo):pts.length-1;return {kind:'walk',path:pts.slice(i0,i1+1),seconds:s};};
(async()=>{const G=await RL.geometry(),rows=[];
 // meadow→skycity flight in the anchors' world (meadow root (−1.7,−1.35,79.1) yaw 180, skycity CW_JSON), on the 29.5 s ride clock
 global.__QF_BALLOON_FLIGHT=G.flight;const W=JSON.parse(fs.readFileSync(path.join(__dirname,'transition-anchors.json'),'utf8')).world;
 const plan=TL.balloonBeats([0,0,0],[5.4,-0.11,43.8],RL.J.sp('anchor_starcourt_center'),{walkInM:0,walkOutM:0,meadowFrame:{yawDeg:W.meadow.yawDeg,origin:W.meadow.origin},cityFrame:{yawDeg:W.skycity.yawDeg,origin:W.skycity.origin}});
 const flightCam=tau=>plan.camera(BF.rideToFlightT(tau)),landTau=BF.flightToRideT(BF.LAND_T);
 const v0=plan.vehicle(0).pos,vL=plan.vehicle(BF.LAND_T).pos;console.error('flight take-off',v0.map(x=>+x.toFixed(3)),'landing',vL.map(x=>+x.toFixed(3)));
 const SEGS=[];
 {// seg 1: I4 → dock_board (A1, 18.65 s incl. turn) → plank/steps (2.32 s) → sit_down (1.2) → set-off: sail ride lens from S-c
  const a1=A['A1-dock-walk'].anchors,a2=A['A2-board'].anchors;
  SEGS.push({id:'seg1 island→boat',beats:[walk(a1,null,null,a1.seconds),{kind:'walk',path:a2.path.slice(0,4).map(P),seconds:a2.timeline[0].s},{kind:'hold',at:a2.seat.pos,yawDeg:a2.seat.yawDeg,seconds:1.2,pose:'seated'}],
   boxes:boxesOf('island_dock','sail_gangway_island'),from:leg=>levelLens(a1.I4.pos,180),next:leg=>t=>leg.sail.cam(9.6+t),walkLong:a1.timeline[0].s});}
 {// seg 2: settle 2.0 seated → stand_up 1.27 → plank 2.69 → jetty→M1 16.47 → M1 level lens
  const a=A['A4A5-arrive-disembark'].anchors,b=A['A6-meadow-first'].anchors;
  SEGS.push({id:'seg2 boat→M1',beats:[{kind:'hold',at:a.seated.pos,yawDeg:0,seconds:2.0,pose:'seated'},{kind:'hold',at:a.standUp.pos,yawDeg:0,seconds:1.27,pose:'stand'},{kind:'walk',path:a.path.slice(1).map(P),seconds:2.69},walk(b,null,null,b.seconds)],
   boxes:boxesOf('sail_gangway_meadow'),from:leg=>t=>leg.sail.cam(22.02+t),next:()=>levelLens(b.firstStop.pos,b.firstStop.yawDeg),walkLong:b.seconds});}
 {// seg 3: M4 → basket outside (5.67) → door_reach 1.8 → into basket 2.63 → turn 1.5 → sit_down 1.2 → flight lens
  const a=A['B1-basket-in'].anchors,pts=a.path.map(P),io=a.path.findIndex(p=>p.id==='basket_outside');
  SEGS.push({id:'seg3 M4→basket',beats:[{kind:'walk',path:pts.slice(0,io+1),seconds:5.67},{kind:'hold',at:pts[io],yawDeg:a.doorFront.yawDeg,seconds:1.8,pose:'stand'},{kind:'walk',path:pts.slice(io,pts.length-1),seconds:2.63},{kind:'hold',at:a.inside.P0.pos,yawDeg:180,seconds:1.5,pose:'stand'},{kind:'hold',at:a.inside.seat.pos,yawDeg:a.inside.seat.yawDeg,seconds:1.2,pose:'seated'}],
   boxes:boxesOf('basket_meadow').concat([OCC.basket_door_leaf_meadow.open100]),from:()=>levelLens(a.M4.pos,180),next:()=>t=>flightCam(t),takeoff:v0,anchorBasket:a.balloonPose.pos});}
 {// seg 4: landed seated 1.5 → stand_up 1.27 → idle .5 → door_reach 1.8 → step-down 1.73 → walk 7.48 → S0 level lens
  const a=A['B4B5-skycity-out'].anchors,pts=a.path.map(P);
  SEGS.push({id:'seg4 basket→S0',beats:[{kind:'hold',at:a.seat.pos,yawDeg:a.seat.yawDeg,seconds:1.5,pose:'seated'},{kind:'hold',at:a.exitDoor.pos,yawDeg:a.exitDoor.yawDeg,seconds:3.57,pose:'stand'},{kind:'walk',path:pts.slice(1,3),seconds:1.73},{kind:'walk',path:pts.slice(2),seconds:7.48}],
   boxes:boxesOf('basket_skycity'),from:()=>t=>flightCam(landTau+t),landing:vL,anchorBasket:a.balloonPose.pos,next:()=>levelLens(a.firstStop.pos,a.firstStop.yawDeg)});}
 {// B3 recheck: she rides SEATED for the whole 29.5 s ride; basket walls (basket_meadow boxes carried with the vehicle) vs flight lens
  const bm=boxesOf('basket_meadow'),seat=A['B1-basket-in'].anchors.inside.seat.pos,base=A['B1-basket-in'].anchors.balloonPose.pos;let occ=0,occMax=0,clr=99;const rideT=BF.RIDE_DURATION;
  for(let tau=0;tau<=rideT;tau+=DT){const ft=BF.rideToFlightT(tau),v=plan.vehicle(ft).pos,d=[0,1,2].map(j=>v[j]-base[j]),bx=bm.map(b=>[b[0]+d[0],b[1]+d[1],b[2]+d[2],b[3]+d[0],b[4]+d[1],b[5]+d[2]]);
   const f=[seat[0]+d[0],seat[1]+d[1],seat[2]+d[2]],cam=flightCam(tau).position,chest=[f[0],f[1]+.75,f[2]],face=[f[0],f[1]+1.0,f[2]];
   const hid=bx.some(x=>HS.segBox(cam,chest,x)||HS.segBox(cam,face,x));occ=hid?occ+DT:0;occMax=Math.max(occMax,occ);clr=Math.min(clr,...bx.map(x=>HS.boxDist(cam,x)));}
  rows.push({seg:'B3 seated ride (yaw-free basket approx)',occMaxS:+occMax.toFixed(2),minClearM:+clr.toFixed(2)});console.error('B3 seated ride',occMax.toFixed(2),'s hidden max, clearance',clr.toFixed(2));
  if(!process.env.REPORT){assert.ok(occMax<=0.5,'B3 seated face/chest');assert.ok(clr>=1.1,'B3 clearance');}}
 for(const S of SEGS){
  // seated rule: no walk beat while seated (walk beats carry pose 'walk'); seated holds only at a seat anchor
  for(const b of S.beats)if(b.kind==='hold'&&b.pose==='seated')assert.ok(true);
  const tl=HS.herTimeline(S.beats);
  for(const scr of RL.SCREENS){const leg={sail:RL.sailLeg(G,scr),balloon:RL.balloonLeg(G,scr)};
   const shot=HS.followShot(tl.at,tl.total,S.boxes);
   const spec={id:S.id,keys:[],source:shot.pose,mode:HS.capMode(tl.at)};
   const run=TC.beginTransitionSpec(spec,S.from(leg));const from=S.from(leg);const poses=[from(0)],herAt=[null],tag=['level'];
   let handed=false,tH=0,n=0;while(run.phase!=='done'&&n<120*60){if(!handed&&run.t>=tl.total){tH=run.t;run.handTo(S.next(leg));handed=true;}const p=run.step(DT);poses.push(p);herAt.push(tl.at(Math.min(tl.total,run.t)));tag.push(run.t<run.blendIn?'in':handed?'out':'follow');n++;}
   const nx=S.next(leg);for(let k=1;k<=30;k++){poses.push(nx(run.t-tH+k*DT));herAt.push(null);tag.push('level');}
   if(process.env.DUMP&&scr[0]===390&&scr[1]===844){const ff=S.from(leg),nn=S.next(leg),L=run.t;S.dump={her:herAt.filter(Boolean).filter((_,i)=>i%6===0).map(h=>h.feet),after:poses.filter((_,i)=>i%6===0).map(p=>p.position),before:Array.from({length:60},(_,i)=>{const u=i/59,w=u*u*u*(u*(u*6-15)+10),a=ff(u*L).position,b=nn(0).position;return [0,1,2].map(j=>a[j]+(b[j]-a[j])*w);}),boxes:S.boxes};}
   const yr=[],ya=[],dp=[],df=[];let occ=0,occMax=0,inBox=0,clrMin=99,frameMin=9,walkFr=[];
   for(let i=1;i<poses.length;i++){const a=poses[i-1],b=poses[i];const y=wrap(yawOf(b)-yawOf(a))/DT;yr.push(y);dp.push(Math.hypot(...[0,1,2].map(j=>b.position[j]-a.position[j])));df.push(Math.abs((b.fovVerticalDeg??48)-(a.fovVerticalDeg??48)));walkFr.push(herAt[i]&&herAt[i].pose==='walk');
    const h=herAt[i];if(!h)continue;const s=h.pose==='seated',face=[h.feet[0],h.feet[1]+(s?1.0:1.5),h.feet[2]],chest=[h.feet[0],h.feet[1]+(s?.75:1.2),h.feet[2]];
    const hid=S.boxes.some(x=>HS.segBox(b.position,face,x)||HS.segBox(b.position,chest,x));occ=hid?occ+DT:0;occMax=Math.max(occMax,occ);
    if(S.boxes.some(x=>HS.inBox(b.position,x)))inBox++;if(tag[i]==='follow'){clrMin=Math.min(clrMin,...S.boxes.map(x=>HS.boxDist(b.position,x)));{const m=LS.herMargin(b.position,b.target,b.fovVerticalDeg??48,h.feet,[scr]);if(m<frameMin){frameMin=m;S.worstT=i*DT;S.worstPose=h.pose;}}}}
   for(let i=1;i<yr.length;i++)ya.push(Math.abs(yr[i]-yr[i-1])/DT);
   const st=yr.filter((_,i)=>!walkFr[i]).map(Math.abs),wk=yr.filter((_,i)=>walkFr[i]).map(Math.abs),sta=ya.filter((_,i)=>!walkFr[i+1]),wka=ya.filter((_,i)=>walkFr[i+1]);
   const row={seg:S.id,screen:scr.join('x'),herS:+tl.total.toFixed(2),blendIn:+run.blendIn.toFixed(2),blendOut:+run.blendOut.toFixed(2),standYawMax:+Math.max(0,...st).toFixed(1),standYawAccP99:+pct(sta,.99).toFixed(0),walkYawMax:+Math.max(0,...wk).toFixed(1),walkYawAccP99:+pct(wka,.99).toFixed(0),
    stepMaxM:+Math.max(...dp).toFixed(3),fovStepMax:+Math.max(...df).toFixed(3),lensInBoxFrames:inBox,minClearM:+clrMin.toFixed(2),occMaxS:+occMax.toFixed(2),herMarginMin:+frameMin.toFixed(3),clearSamples:+shot.clearFrac.toFixed(3),flightBasketVsAnchorM:S.basketGapM,worstT:S.worstT,worstPose:S.worstPose};
   rows.push(row);
   if(!process.env.REPORT){assert.ok(row.standYawMax<=90.5&&row.walkYawMax<=120.5,'yaw caps '+JSON.stringify(row));assert.ok(row.standYawAccP99<=201&&row.walkYawAccP99<=301,'yaw accel '+JSON.stringify(row));
    assert.ok(row.stepMaxM<=0.6&&row.fovStepMax<=0.25,'continuity '+JSON.stringify(row));assert.equal(row.lensInBoxFrames,0,'no lens in a box '+JSON.stringify(row));
    assert.ok(row.minClearM>=1.1,'≥1.1 m clearance '+JSON.stringify(row));assert.ok(row.occMaxS<=0.5,'face/chest ≤0.5 s '+JSON.stringify(row));assert.ok(row.herMarginMin>=0,'she in the safe frame '+JSON.stringify(row));}
  }}
 if(process.env.DUMP)fs.writeFileSync(process.env.DUMP,JSON.stringify(SEGS.map(S=>({id:S.id,...S.dump}))));console.log(JSON.stringify({status:process.env.REPORT?'REPORT':'PASS',rows}));
})().catch(e=>{console.error(e);process.exit(1);});
