#!/usr/bin/env node
'use strict';
/* Lakeside (r5h3) camera contract: island → lakeside journey, Landing A arrival, board framing. Builds the leg exactly as
 * LakesideCameraLayout.lakesideJourney() places it (real TS through the board-ui harness) against the real geometry: the
 * Build05 island fixture + palms (journey-scene.cjs, as 04→05) and every instance of region_lakeside
 * scene_r5h_slim_transforms.json (lakeside/lakeside-scene.cjs), plus the rainbow bridge strip itself. Samples every 0.05 m.
 *  K1 route: continuity passes validateJourneyRoute (island→lakeside order accepted since Voice Bot's wiring); landing overrides need a focus and known keys; 04→05/08→09 unchanged.
 *  K2 her face (1.5 m), head (1.6) and chest (0.9) never hidden, at most one low graze; lens clearance ≥ 1.1 m everywhere.
 *     Reported, not hidden: the 04→05 set-off exemption (d < 1 m, only her legs behind the island prop strip).
 *  K3 lens on her RIGHT for the whole leg (never left of behind).
 *  K4 final landing frame at 360×780 (0.46) and 390×520 (0.75): whole body in frame, feet ≥ 5% above the bottom edge,
 *     her centre 20–80% of the width, height 0.12–0.26 of the screen (0.26: close fallback-like end pose), board centre in frame.
 *  K5 view turn ≤ 20°/s on the timed walk (route.timing, 17 s); no crane-up: lens height above her never rises over the arrival (monotone).
 *  K7 time domain on route.timing (RegionJourneyCore.journeyDistanceAt, the distance curve the controller hands the walk action
 *     as distanceAt; NOTE the frozen FlowReferenceStandin does not follow it until its reviewed patch lands), 60 Hz:
 *     16–18 s; her peak ≤ 4.5 m/s, |a| ≤ 3 m/s²; lens |a| ≤ 3 m/s², |jerk| ≤ 8 m/s³ after the 0.6 s set-off fade; at rest
 *     at the stop. Reported for comparison: the same lens at 1.2 m/s (c375304) and the default follow lens at 1.2 m/s.
 *  K8 landing→board blend (lakesideLandingBlend, 1 s, 60 Hz frames): landing END = board camera at the 360×780 reference
 *     (gap ≤ 1e-6 m / 0.01° / 0.01° FOV; residual per portrait layout reported); starts on the landing pose (lens at rest), ends exactly on
 *     the board camera; one smootherstep for position/view (slerp)/FOV: monotonic, no overshoot, single-peak rates ≈ 0 at both ends;
 *     lens ≥ 1.1 m on every 60 Hz frame, her face/head/chest never hidden, lens on her right while it is behind her; per-frame
 *     displacement / speed / turn rate / FOV rate written to the report (perFrame) for the blend plots.
 *  K6 board framing (lakesideAlignedBoardPose, the pose the lease's frame() writes) on 8 real BoardLayout layouts (0.43…0.75
 *     portrait, notch/capsule, tablet, landscape): the 3D lake grid (16 LK_wb_line) lies under the 2D board — 3D board centre
 *     on the 2D grid centre and centre-row width = 2D grid width (≤ 0.5 px); landscape: every grid vertex inside the opaque tray by
 *     ≥ 0.05 cell; portrait (close, fallback-like lens; reviewer round 2): grid-vs-tray margin reported only;
 *     residual perspective (corner / cell-centre error) reported; portrait top edge reaches past the north shore
 *     (scene above the tray); lens clearance ≥ 1.1 m. Scene = exactly the live lease's instances.
 * Geometric evidence only; native visual acceptance is separate. */
const J=require('./journey-scene.cjs'),{fs,assert,H,S,Core,Lay,sampleRoute,routeLength,journeyCamera,start,start1,island,add,sub,bbox,blockers,clearance,rayHit}=J;
const LKS=require('./lakeside/lakeside-scene.cjs'),LK=H.load(S+'region/LakesideCameraLayout.ts'),C=LK.LAKESIDE_CAMERA_LAYOUT;
// Same set-off exemption as 04→05 (identical island approach): only her LEGS behind the island prop strip in the first metre.
const EXEMPT_M=1,STEP=+(process.env.QF_OCCLUSION_STEP||.05),HEIGHTS=[.15,.5,.9,1.25,1.6],CLEAR=1.1;
const results=[];const check=(id,fn)=>{try{results.push({id,status:'PASS',...fn()});}catch(e){results.push({id,status:'FAIL',error:String(e.stack||e)});}};
const j=LK.lakesideJourney(start),path=[...j.approach,...j.bridge.slice(1),...j.arrival],T=routeLength(path);
const route={from:'island',to:'lakeside',path,bridgeStart:routeLength(j.approach),bridgeEnd:routeLength([...j.approach,...j.bridge.slice(1)]),speed:j.speed,startBlendM:0,focus:j.focus,landing:j.landing,timing:j.timing};
const TM=j.timing,sAt=t=>Core.journeyDistanceAt(T,TM,t),DUR=TM.durationS;
const lakeLocal=LKS.instances(),lake=lakeLocal.map(o=>{const t=new Float64Array(o.tris.length);for(let k=0;k<t.length;k+=3){const w=j.toWorld([o.tris[k],o.tris[k+1],o.tris[k+2]]);t[k]=w[0];t[k+1]=w[1];t[k+2]=w[2];}return {tag:'lakeside',name:o.name,group:o.group,tris:t};});
// rainbow bridge strip exactly as RegionJourneyAdapter.rainbowBridge (full width, one ribbon)
const strip=(()=>{const w=Lay.REGION_JOURNEY_LAYOUT.bridgeWidthM,P=j.bridge,t=[];for(let i=1;i<P.length;i++){const q=[P[i-1],P[i]].map((p,k)=>{const a=P[Math.max(0,i-1+k-1)],b=P[Math.min(P.length-1,i+k)],dx=b[0]-a[0],dz=b[2]-a[2],L=Math.hypot(dx,dz)||1;return [-.5,.5].map(s=>[p[0]+dz/L*s*w,p[1]-.015,p[2]-dx/L*s*w]);});t.push(...q[0][0],...q[1][0],...q[0][1],...q[0][1],...q[1][0],...q[1][1]);}return {tag:'bridge',name:'RainbowBridgeStrip',tris:Float64Array.from(t)};})();
const objs=[...island,...lake,strip];
const cam=d=>journeyCamera(path,d,start1,j.focus,undefined,0,j.landing);
const heading=d=>Core.journeyHeading(path,d);
function ndc(c,p,aspect){const f=sub(c.target,c.position),fl=Math.hypot(...f),fw=f.map(x=>x/fl),rl=Math.hypot(fw[2],fw[0]),r=[-fw[2]/rl,0,fw[0]/rl],up=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]],th=Math.tan(c.fovVerticalDeg*Math.PI/360),v=sub(p,c.position),z=v[0]*fw[0]+v[1]*fw[1]+v[2]*fw[2];
 return [(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*aspect),(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th),z];}
check('K1 lakeside route continuity valid; landing needs focus + known keys; routes without landing unchanged',()=>{
 // Region order + 'lakeside' JourneyRegion/Place/State are Voice Bot's wiring (README); the continuity and landing checks run on
 // the same route with the order label of the Build05 island leg.
 const asIsland={...route,to:'meadow'};Core.validateJourneyRoute(asIsland,start);Core.validateJourneyRoute(route,start); // island→lakeside wired (Voice Bot)
 assert.throws(()=>Core.validateJourneyRoute({...asIsland,focus:undefined},start),/journey-invalid-landing/);
 assert.throws(()=>Core.validateJourneyRoute({...asIsland,landing:{arrivalSideM:NaN}},start),/journey-invalid-landing/);
 assert.throws(()=>Core.validateJourneyRoute({...asIsland,landing:{fovDeg:30}},start),/journey-invalid-landing/);
 assert.throws(()=>Core.validateJourneyRoute({...route,from:'meadow'},start),/journey-region-order/);
 assert.throws(()=>Core.validateJourneyRoute({...asIsland,timing:{durationS:9,easeInS:2,easeOutS:2}},start),/journey-invalid-timing/,'peak > 4.5 m/s rejected');
 assert.throws(()=>Core.validateJourneyRoute({...asIsland,timing:{durationS:17,easeInS:.5,easeOutS:4}},start),/journey-invalid-timing/,'|a| > 3 m/s² rejected');
 assert.throws(()=>Core.validateJourneyRoute({...asIsland,timing:{durationS:5,easeInS:3,easeOutS:4}},start),/journey-invalid-timing/,'ramps longer than the leg rejected');
 for(const leg of J.legs)for(let d=0;d<=routeLength(leg.path);d+=.5)assert.deepEqual(journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,leg.startBlendM,undefined),journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,leg.startBlendM));
 const foot=[];for(let d=route.bridgeEnd;d<=T+1e-9;d+=.25){const p=sampleRoute(path,d),hit=rayHit([p[0],p[1]+3,p[2]],[0,-1,0],10,lake.find(o=>o.name==='LK_terrain_i').tris);assert(hit!==null,'no bank under her at d='+d.toFixed(2));foot.push(+(p[1]+3-hit-p[1]).toFixed(3));}
 assert(foot.every(h=>Math.abs(h)<=.03),'feet off the bank: '+foot);
 return {totalM:+T.toFixed(3),durationS:DUR,timing:TM,peaks:Core.journeyTimingPeaks(T,TM),bridgeStart:+route.bridgeStart.toFixed(3),bridgeEnd:+route.bridgeEnd.toFixed(3),walkOnBankM:+(T-route.bridgeEnd).toFixed(3),footVsBankM:[Math.min(...foot),Math.max(...foot)],root:j.root.map(v=>+v.toFixed(3)),yawDeg:j.yawDeg};});
const rows=[];let worst={lens:9};const fails=[],grazes=[],exempted=[];
for(let i=0;i*STEP<=T+1e-9;i++){const d=Math.min(T,i*STEP),p=sampleRoute(path,d),c=cam(d),hit=HEIGHTS.map(h=>blockers(objs,c.position,[p[0],p[1]+h,p[2]])),face=blockers(objs,c.position,[p[0],p[1]+1.5,p[2]]),[lens,lensObj]=clearance(c.position,objs);
 const [hx,hz]=heading(d),o=sub(c.position,p),side=o[0]*-hz+o[2]*hx,behind=-(o[0]*hx+o[2]*hz),up=o[1];
 const rec={d:+d.toFixed(2),lens:+lens.toFixed(3),lensObj,side:+side.toFixed(3),behind:+behind.toFixed(3),up:+up.toFixed(3),cam:c.position.map(v=>+v.toFixed(3)),target:c.target.map(v=>+v.toFixed(3)),fov:c.fovVerticalDeg,root:p.map(v=>+v.toFixed(3))};rows.push(rec);
 if(lens<worst.lens)worst=rec;const hidden=hit.filter(h=>h.length).length;
 const legsOnly=!face.length&&!hit[2].length&&!hit[3].length&&!hit[4].length;
 if((hit[2].length||hit[4].length||face.length||hidden>1)&&!(d<EXEMPT_M&&legsOnly))fails.push({...rec,hidden:Object.fromEntries(HEIGHTS.map((h,k)=>[h,hit[k]]).filter(x=>x[1].length)),face});else if(hidden)(d<EXEMPT_M&&hidden>1?exempted:grazes).push({d:rec.d,hidden:Object.fromEntries(HEIGHTS.map((h,k)=>[h,hit[k]]).filter(x=>x[1].length))});}
check(`K2 face/head/chest visible + lens ≥ ${CLEAR} m every ${STEP} m (island + lakeside + bridge strip)`,()=>{assert.deepEqual(fails,[],JSON.stringify(fails.slice(0,5)));assert(worst.lens>=CLEAR,`lens ${worst.lens} m from ${worst.lensObj} at d=${worst.d}`);
 return {samples:rows.length,minLensM:worst.lens,minLensAt:worst.d,minLensObj:worst.lensObj,setOffLegsOnlyExempted:exempted,partialGrazes:grazes};});
check('K3 lens on her right for the whole leg',()=>{const m=rows.reduce((a,r)=>r.side<a.side?r:a);assert(m.side>.3,`lens ${m.side} m right of her at d=${m.d}`);return {minRightM:m.side,at:m.d,finalRightM:rows.at(-1).side};});
const finals={};
for(const [W,Hh] of [[360,780],[390,520]])check(`K4 final landing frame ${W}x${Hh}: whole body, feet ≥5% above bottom, her x 20–80%, readable height, board centre in frame`,()=>{
 const a=W/Hh,c=cam(T),p=path.at(-1),feet=ndc(c,[p[0],p[1]+.05,p[2]],a),head=ndc(c,[p[0],p[1]+1.65,p[2]],a),chest=ndc(c,[p[0],p[1]+.9,p[2]],a),fc=ndc(c,j.focus,a);
 const x=(chest[0]+1)/2,feetUp=(feet[1]+1)/2,headDown=(1-head[1])/2,h=(head[1]-feet[1])/2;
 assert(feet[2]>0&&head[2]>0,'behind lens');assert(feetUp>=.05,'feet '+feetUp);assert(headDown>=.05,'head '+headDown);assert(x>=.2&&x<=.8,'her x '+x);assert(h>=.12&&h<=.26,'height '+h);assert(Math.abs(fc[0])<=.9&&Math.abs(fc[1])<=.9&&fc[2]>0,'board centre '+fc);
 return finals[W+'x'+Hh]={herX:+x.toFixed(3),feetAboveBottom:+feetUp.toFixed(3),headBelowTop:+headDown.toFixed(3),herHeight:+h.toFixed(3),boardCentre:[+((fc[0]+1)/2).toFixed(3),+((1-fc[1])/2).toFixed(3)],cam:c.position.map(v=>+v.toFixed(3)),target:c.target.map(v=>+v.toFixed(3)),fov:c.fovVerticalDeg};});
check('K5 view turn ≤ 20°/s on the 17 s profile; no crane-up over the arrival (lens height above her never rises)',()=>{let maxAng=0,at=0;
 for(let t=0;t<DUR;t+=1/60){const a=cam(sAt(t)),b=cam(sAt(Math.min(DUR,t+1/60))),fa=sub(a.target,a.position),fb=sub(b.target,b.position),la=Math.hypot(...fa),lb=Math.hypot(...fb),cos=Math.min(1,(fa[0]*fb[0]+fa[1]*fb[1]+fa[2]*fb[2])/(la*lb)),deg=Math.acos(cos)*180/Math.PI*60;if(deg>maxAng){maxAng=deg;at=t;}}
 assert(maxAng<=20,`turn ${maxAng.toFixed(2)}°/s at d=${at.toFixed(2)}`);
 // No crane-up: over the arrival the lens never climbs in the world, and its height above her only falls (≤ 5 cm total of
 // up-steps allowed: the S-curve lens rounds the bridge→bank corner where her own descent stops dead).
 const s=T-Core.JOURNEY_CAMERA.arrivalBlendM;let worldRise=0,wa=0,relUp=0,ra=0;for(let i=1;i<rows.length;i++)if(rows[i].d>=s){const dw=rows[i].cam[1]-rows[i-1].cam[1],du=rows[i].up-rows[i-1].up;if(dw>worldRise){worldRise=dw;wa=rows[i].d;}if(du>0){relUp+=du;ra=rows[i].d;}}
 assert(worldRise<=.001,`lens climbs ${worldRise} m per ${STEP} m at d=${wa}`);assert(relUp<=.05,`lens rises ${relUp} m above her (last at d=${ra})`);
 const arr=rows.filter(r=>r.d>=s),maxUp=Math.max(...rows.map(r=>r.up));
 return {maxTurnDegS:+maxAng.toFixed(2),atS:+at.toFixed(2),arrivalWorldMaxClimbPerStepM:+worldRise.toFixed(4),arrivalRelativeUpStepsSumM:+relUp.toFixed(4),arrivalLensAboveHerM:[+arr[0].up.toFixed(3),+arr.at(-1).up.toFixed(3)],arrivalLensWorldY:[arr[0].cam[1],arr.at(-1).cam[1]],maxLensAboveHerM:+maxUp.toFixed(3)};});
check(`K7 timing ${DUR} s (16–18): her peak ≤ 4.5 m/s, |a| ≤ 3 m/s²; lens |a| ≤ 3 m/s², |jerk| ≤ 8 m/s³ after the set-off fade, at rest when she stops`,()=>{
 assert(DUR>=16&&DUR<=18,'duration '+DUR);
 const kin=(fn,sOf,D)=>{const dt=1/60,P=[],S=[];for(let t=0;t<=D+1+1e-9;t+=dt){const s=sOf(Math.min(D,t));S.push([s,0,0]);P.push(fn(s).position);}const der=a=>a.slice(1).map((v,i)=>v.map((x,k)=>(x-a[i][k])/dt)),n=x=>Math.hypot(...x),v=der(P),a=der(v),jk=der(a),hv=der(S),ha=der(hv),hj=der(ha);
  const from=Math.round(.6/dt),end=Math.round(D/dt),pk=(arr,o,f0=from)=>arr.reduce((m,x,i)=>i+o>=f0&&n(x)>m.v?{v:n(x),t:(i+o)*dt}:m,{v:0,t:0});
  return {durationS:D,her:{peakSpeed:pk(hv,1,0),peakAccel:pk(ha,1,0),peakJerk:pk(hj,2,0)},peakSpeed:pk(v,1),peakAccel:pk(a,1),peakJerk:pk(jk,2),last05sMaxSpeed:Math.max(...v.slice(end-30,end).map(n)),speedAfterStop:n(v[end+1])};};
 const nw=kin(cam,sAt,DUR),fb=kin(d=>journeyCamera(path,d,start1,undefined,undefined,0),t=>Math.min(T,t*route.speed),T/route.speed),prev=kin(cam,t=>Math.min(T,t*route.speed),T/route.speed);
 assert(nw.her.peakSpeed.v<=4.5+1e-6,'her speed '+JSON.stringify(nw.her.peakSpeed));assert(nw.her.peakAccel.v<=3+1e-6,'her accel '+JSON.stringify(nw.her.peakAccel));
 assert(nw.peakAccel.v<=3,'lens accel '+JSON.stringify(nw.peakAccel));assert(nw.peakJerk.v<=8,'lens jerk '+JSON.stringify(nw.peakJerk));assert(nw.last05sMaxSpeed<=.2&&nw.speedAfterStop<1e-9,'not at rest '+nw.last05sMaxSpeed);
 const r=o=>JSON.parse(JSON.stringify(o,(k,v)=>typeof v==='number'?+v.toFixed(4):v));return {new:r(nw),previousC375304At1_2:r(prev),fallbackDefaultAt1_2:r(fb)};});
// K6 board framing: 3D lake grid laid under the 2D board (BoardLayout) on real phone layouts
const BL=H.load(S+'ui/BoardLayout.ts'),CP=H.load(S+'world-r1/CameraPose.ts'),SD=H.load(S+'region/LakesideSceneData.ts');
const K6_LAYOUTS=[['360x780 (0.46)',360,780,{top:0,bottom:0,left:0,right:0,capsule:null}],
 ['390x844 notch+capsule',390,844,{top:47,bottom:34,left:0,right:0,capsule:{left:281,top:51,right:368,bottom:83}}],
 ['375x667 (0.56)',375,667,{top:20,bottom:0,left:0,right:0,capsule:{left:278,top:26,right:365,bottom:58}}],
 ['414x896',414,896,{top:44,bottom:34,left:0,right:0,capsule:{left:305,top:48,right:392,bottom:80}}],
 ['330x770 (0.43)',330,770,{top:0,bottom:0,left:0,right:0,capsule:null}],
 ['390x520 (0.75)',390,520,{top:0,bottom:0,left:0,right:0,capsule:null}],
 ['768x1024 tablet (0.75)',768,1024,{top:20,bottom:0,left:0,right:0,capsule:null}],
 ['844x390 landscape',844,390,{top:0,bottom:21,left:47,right:47,capsule:null}]];
check('K6 board framing: 3D lake grid under the 2D board (centre + scale exact; tray inset asserted on landscape, reported on portrait), scene above the tray, lens clear',()=>{const out={};
 const kept=lakeLocal.length;assert.equal(kept,SD.lakesideSceneInstances(LKS.transforms.instances).length,'scene = live lease instances');
 const grid=lakeLocal.filter(o=>o.glb==='LK_wb_line.glb'),decor=lakeLocal.filter(o=>/LK_(lilypad|rope_float|buoy_lantern|chime_raft)\.glb/.test(o.glb));assert.equal(grid.length,16);
 const all=lakeLocal.map(o=>({tag:'lakeside',name:o.name,tris:o.tris}));
 for(const [name,W,Hh,safe] of K6_LAYOUTS){const g=BL.boardLayout(W,Hh,safe,2),frame={width:W,height:Hh,boardTop:g.tray.y-g.tray.height/2,board:{x:g.grid.x,y:g.grid.y,size:g.grid.size}};
  const pose=LK.lakesideAlignedBoardPose(frame),look=LK.lakesideAlignedLookAt(frame),a=W/Hh;assert.equal(CP.validateCameraPose(pose),null,name);
  const scr=p=>{const q=CP.projectPoint(pose,a,p);return [(q.x+1)/2*W,(1-q.y)/2*Hh,q.depth];};
  const c=scr([0,0,12]),l=scr([-3.85,0,12]),r=scr([3.85,0,12]);
  const centrePx=Math.hypot(c[0]-g.grid.x,c[1]-g.grid.y),widthPx=Math.abs((r[0]-l[0])-g.grid.size);assert(centrePx<=.5,`${name} centre off ${centrePx}px`);assert(widthPx<=.5,`${name} width off ${widthPx}px`);
  const P=g.pitch,inset=.05*P;let worst=1e9,corner=0;
  for(const o of grid)for(let k=0;k<o.tris.length;k+=3){const q=scr([o.tris[k],o.tris[k+1],o.tris[k+2]]);worst=Math.min(worst,g.tray.width/2-Math.abs(q[0]-g.tray.x),g.tray.height/2-Math.abs(q[1]-g.tray.y));}
  // portrait (close fallback-like board lens, reviewer round 2): the foreshortened 3D grid is reported, not asserted inside the tray
  if(W>Hh)assert(worst>=inset,`${name} 3D grid within ${worst.toFixed(1)}px of the tray edge (need ${inset.toFixed(1)})`);
  for(const [x,z,cx,cy] of [[-3.85,8.15,-3.5,-3.5],[3.85,8.15,3.5,-3.5],[-3.85,15.85,-3.5,3.5],[3.85,15.85,3.5,3.5]]){const q=scr([x,0,z]);corner=Math.max(corner,Math.hypot(q[0]-(g.grid.x+cx*P),q[1]-(g.grid.y+cy*P))/P);}
  let cellErr=0;for(let i=0;i<49;i++){const p=SD.lakesideCellCenter(i),q=scr(p),u=BL.cellCenter(g,i);cellErr=Math.max(cellErr,Math.hypot(q[0]-u.x,q[1]-u.y)/P);}
  let decorOut=0;for(const o of decor){const cx=(o.box[0][0]+o.box[1][0])/2,cz=(o.box[0][2]+o.box[1][2])/2,q=scr([cx,0,cz]);if(Math.abs(q[0]-g.tray.x)>g.tray.width/2||Math.abs(q[1]-g.tray.y)>g.tray.height/2)if(q[0]>0&&q[0]<W&&q[1]>0&&q[1]<Hh)decorOut++;}
  // scene above the tray: the top-centre ray must land beyond the lake's north shore (z<0) or in the sky
  const top=(()=>{const f=[look.target[0]-look.position[0],look.target[1]-look.position[1],look.target[2]-look.position[2]],fl=Math.hypot(...f);const ang=look.fovVerticalDeg*Math.PI/360-Math.asin(-f[1]/fl);return ang>=0?-Infinity:look.position[2]-look.position[1]/Math.tan(-ang);})();
  if(W<Hh)assert(top<0,`${name} top edge only reaches lake water (z ${top})`);
  const [lens,who]=clearance(look.position,all);assert(lens>=CLEAR,`${name} lens ${lens} from ${who}`);
  out[name]={pose:look,grid2d:{x:+g.grid.x.toFixed(1),y:+g.grid.y.toFixed(1),size:+g.grid.size.toFixed(1),pitch:+P.toFixed(2)},trayTopFrac:+(frame.boardTop/Hh).toFixed(3),centreErrPx:+centrePx.toFixed(3),widthErrPx:+widthPx.toFixed(3),
   gridInsideTrayMinPx:+worst.toFixed(1),cornerErrCells:+corner.toFixed(3),cellCentreErrCells:+cellErr.toFixed(3),decorVisibleOutsideTray:decorOut,topEdgeGroundZ:Number.isFinite(top)?+top.toFixed(1):'sky',lensClearM:+lens.toFixed(2)};
  // fallback without frame.board (older callers): portrait estimate within 1 px of BoardLayout when the pitch is width-limited (no side insets); reported otherwise
  if(W<Hh&&!safe.left&&!safe.right){const e=LK.lakesideBoardRect({width:W,height:Hh,boardTop:frame.boardTop});out[name].fallbackRectErrPx=+Math.max(Math.abs(e.x-g.grid.x),Math.abs(e.y-g.grid.y),Math.abs(e.size-g.grid.size)).toFixed(3);
   if(Math.abs(g.pitch-(W-18)/(681/82))<1e-6||Math.abs(g.pitch-42.6*Math.min(1.3,Math.max(1,W/390)))<1e-6)assert(out[name].fallbackRectErrPx<=1,name+' fallback rect');}}
 return {layouts:out};});
// K8 landing → board blend (lakesideLandingBlend): exact ends, one S-curve for position / view (slerp) / FOV, 60 Hz frames
check(`K8 landing→board blend ${C.landingBlend.seconds} s @60 Hz: exact ends, landing lens at rest, zero velocity at both ends, monotonic (no overshoot) distance/view/FOV, single-peak speed and turn rate (no spikes), lens ≥ ${CLEAR} m, her face/head/chest never hidden, lens on her right while behind her`,()=>{const out={};
 const BL8=H.load(S+'ui/BoardLayout.ts'),p=path.at(-1),[hx,hz]=heading(T),ang=(a,b)=>{const u=sub(a.target,a.position),v=sub(b.target,b.position),c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return Math.atan2(Math.hypot(...c),u[0]*v[0]+u[1]*v[1]+u[2]*v[2]);};
 // the landing lens itself is at rest when the blend starts (her last 1/60 s)
 const cl=cam(sAt(DUR-1/60)),cT=cam(T),landV=Math.hypot(...sub(cT.position,cl.position))*60,landW=ang(cl,cT)*180/Math.PI*60;assert(landV<.01&&landW<.1,`landing lens moving at the stop: ${landV} m/s, ${landW}°/s`);
 for(const [W,Hh] of [[360,780],[390,520]]){const g=BL8.boardLayout(W,Hh,{top:0,bottom:0,left:0,right:0,capsule:null},2),frame={width:W,height:Hh,boardTop:g.tray.y-g.tray.height/2,board:{x:g.grid.x,y:g.grid.y,size:g.grid.size}};
  const from=cT,b=LK.lakesideLandingBlend(from,frame,j),n=Math.round(b.seconds*60),F=[];let minLens=9,minObj=null,minSide=9,hiddenAt=[],ahead=null;
  const e0=b.at(0),e1=b.at(b.seconds),loc=LK.lakesideAlignedLookAt(frame),bw=[loc.position,loc.target].map(j.toWorld);
  const close=(x,y,eps=1e-9)=>x.every((v,k)=>Math.abs(v-y[k])<=eps);assert(close(e0.position,from.position)&&Math.abs(e0.fovVerticalDeg-from.fovVerticalDeg)<1e-9,'start != landing pose');assert(ang(e0,from)<1e-7,'start view != landing view');
  assert(close(e1.position,bw[0],1e-6)&&close(e1.target,bw[1],1e-6)&&e1.fovVerticalDeg===loc.fovVerticalDeg,'end != board camera');
  const totA=ang(from,e1),totD=Math.hypot(...sub(e1.position,from.position)),totF=e1.fovVerticalDeg-from.fovVerticalDeg;
  for(let i=0;i<=n;i++){const t=b.seconds*i/n,c=b.at(t);const [lens,who]=clearance(c.position,objs);if(lens<minLens){minLens=lens;minObj=who;}
   for(const h of [.9,1.5,1.6])if(blockers(objs,c.position,[p[0],p[1]+h,p[2]]).length)hiddenAt.push([+t.toFixed(3),h]);
   const o=sub(c.position,p),side=o[0]*-hz+o[2]*hx,behind=-(o[0]*hx+o[2]*hz);if(behind>0)minSide=Math.min(minSide,side);else if(ahead===null)ahead=+t.toFixed(3);
   const pr=F.at(-1),pc=pr?b.at(b.seconds*(i-1)/n):null;
   F.push({t:+t.toFixed(4),dispM:Math.hypot(...sub(c.position,from.position)),angFromStartDeg:ang(from,c)*180/Math.PI,angToEndDeg:ang(c,e1)*180/Math.PI,fov:c.fovVerticalDeg,
    speedMps:pc?Math.hypot(...sub(c.position,pc.position))*60:0,angVelDegS:pc?ang(pc,c)*180/Math.PI*60:0,fovRateDegS:pc?(c.fovVerticalDeg-pc.fovVerticalDeg)*60:0});}
  assert(minLens>=CLEAR,`blend lens ${minLens} from ${minObj}`);assert.deepEqual(hiddenAt,[],'her hidden '+JSON.stringify(hiddenAt.slice(0,5)));assert(minSide>0,'lens left of her while behind: '+minSide);
  // tolerances: acos/float noise (the gap can be a few hundredths of a degree when the landing ends on the board pose)
  const eps=1e-6,mono=(k,s=1)=>F.every((f,i)=>!i||s*(f[k]-F[i-1][k])>=-eps);
  assert(mono('dispM')&&mono('angFromStartDeg')&&mono('angToEndDeg',-1)&&mono('fov',Math.sign(totF)||1),'blend not monotonic (overshoot)');
  assert(F.every(f=>f.dispM<=totD+1e-9&&f.angFromStartDeg<=totA*180/Math.PI+1e-6&&(f.fov-from.fovVerticalDeg)*(Math.sign(totF)||1)<=Math.abs(totF)+1e-9),'blend overshoots its end');
  // single peak: rate rises to its maximum then falls (no second hump / spike), ends ≈ 0
  const peak=(k)=>{const r=F.slice(1).map(f=>Math.abs(f[k])),m=Math.max(...r),im=r.indexOf(m),tol=Math.max(1e-6,1e-3*m);return {m,im,ok:r.every((x,i)=>i===0||(i<=im?x>=r[i-1]-tol:x<=r[i-1]+tol)),first:r[0],last:r.at(-1)};};
  const pv=peak('speedMps'),pw=peak('angVelDegS'),pf=peak('fovRateDegS');
  for(const [nm,q] of [['speed',pv],['turn',pw],['fov',pf]]){assert(q.ok,`${nm} rate not single-peaked`);if(q.m>1e-4)assert(q.first<=.02*q.m&&q.last<=.02*q.m,`${nm} rate not ≈ 0 at the ends (${q.first}, ${q.last} of peak ${q.m})`);}
  const acc=F.slice(2).map((f,i)=>Math.abs(f.angVelDegS-F[i+1].angVelDegS)*60),r3=x=>+x.toFixed(3);
  out[W+'x'+Hh]={seconds:b.seconds,frames:n+1,from:{position:from.position.map(r3),fov:r3(from.fovVerticalDeg)},to:{position:bw[0].map(r3),fov:r3(loc.fovVerticalDeg)},moveM:r3(totD),turnDeg:r3(totA*180/Math.PI),fovChangeDeg:r3(totF),
   minLensM:r3(minLens),minLensObj:minObj,minRightWhileBehindM:r3(minSide),passesHerAtS:ahead,peakSpeedMps:r3(pv.m),peakTurnDegS:r3(pw.m),peakTurnAtS:r3((pw.im+1)/60),peakTurnAccelDegS2:r3(Math.max(...acc)),peakFovRateDegS:r3(pf.m),
   endRates:{firstFrameTurnDegS:r3(pw.first),lastFrameTurnDegS:r3(pw.last),firstFrameFovDegS:r3(pf.first),lastFrameFovDegS:r3(pf.last)},perFrame:F.map(f=>Object.fromEntries(Object.entries(f).map(([k,v])=>[k,+v.toFixed(5)])))};}
 // landing END = board camera (reviewer): no gap at the 360×780 reference, residual reported on every portrait layout
 const gaps={};for(const [name,W,Hh,safe] of K6_LAYOUTS){if(W>Hh)continue;const g=BL8.boardLayout(W,Hh,safe,2),b=LK.lakesideLandingBlend(cT,{width:W,height:Hh,boardTop:g.tray.y-g.tray.height/2,board:{x:g.grid.x,y:g.grid.y,size:g.grid.size}},j);
  assert(b.done(b.seconds)&&!b.done(b.seconds-1e-3)&&b.at(b.seconds)===b.boardWorld,'done()/at() swap frame');gaps[name]={positionM:+b.gap.positionM.toExponential(2),viewDeg:+b.gap.viewDeg.toFixed(4),fovDeg:+b.gap.fovDeg.toFixed(4)};}
 const ref=gaps['360x780 (0.46)'];assert(ref.positionM<=1e-6&&ref.viewDeg<=.01&&Math.abs(ref.fovDeg)<=.01,'landing end != board camera at 360x780: '+JSON.stringify(ref));
 return {landingLensAtStop:{speedMps:+landV.toFixed(5),turnDegS:+landW.toFixed(5)},landingToBoardGap:gaps,blends:out};});
const report={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',route:{totalM:+T.toFixed(3),bridgeStart:route.bridgeStart,bridgeEnd:route.bridgeEnd,landing:j.landing,focus:j.focus},finals,results,profile:rows.filter((r,i)=>i%10===0||i===rows.length-1)};
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/lakeside-camera.json',JSON.stringify(report,null,1)+'\n');
if(process.env.QF_LAKESIDE_DUMP)fs.writeFileSync(process.env.QF_LAKESIDE_DUMP,JSON.stringify({path,focus:j.focus,root:j.root,yawDeg:j.yawDeg,landing:j.landing,start1,rows,route:{bridgeStart:route.bridgeStart,bridgeEnd:route.bridgeEnd,speed:route.speed}}));
console.log(JSON.stringify({status:report.status,checks:results.map(r=>({id:r.id,status:r.status,error:r.error&&r.error.split('\n')[0].slice(0,400)}))},null,1));if(report.status!=='PASS')process.exitCode=1;
