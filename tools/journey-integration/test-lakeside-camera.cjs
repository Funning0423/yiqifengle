#!/usr/bin/env node
'use strict';
/* Lakeside (r5h3) camera contract: island → lakeside journey, Landing A arrival, board framing. Builds the leg exactly as
 * LakesideCameraLayout.lakesideJourney() places it (real TS through the board-ui harness) against the real geometry: the
 * Build05 island fixture + palms (journey-scene.cjs, as 04→05) and every instance of region_lakeside
 * scene_r5h_slim_transforms.json (lakeside/lakeside-scene.cjs), plus the rainbow bridge strip itself. Samples every 0.05 m.
 *  K1 route: continuity passes validateJourneyRoute (region order is Voice Bot's wiring, still rejected here); landing overrides need a focus and known keys; 04→05/08→09 unchanged.
 *  K2 her face (1.5 m), head (1.6) and chest (0.9) never hidden, at most one low graze; lens clearance ≥ 1.1 m everywhere.
 *     Reported, not hidden: the 04→05 set-off exemption (d < 1 m, only her legs behind the island prop strip).
 *  K3 lens on her RIGHT for the whole leg (never left of behind).
 *  K4 final landing frame at 360×780 (0.46) and 390×520 (0.75): whole body in frame, feet ≥ 5% above the bottom edge,
 *     her centre 20–80% of the width, height 0.12–0.22 of the screen, board centre in frame.
 *  K5 view turn ≤ 20°/s at walk speed; no crane-up: lens height above her never rises over the arrival (monotone).
 *  K7 time domain at the controller's walk (route length / 1.2 m/s, as RegionJourneyController.walk; the real walk driver
 *     reports this distance linearly), 60 Hz, after the 0.6 s set-off fade: lens |a| ≤ 1.2 m/s², |jerk| ≤ 5 m/s³, and it
 *     comes to rest with her (≤ 0.2 m/s over the last 0.5 s, 0 at the stop). The fallback lens is reported for comparison.
 *  K6 board framing (lakesideScenePose) for 0.42…1.0: every board-group vertex of the rope ring and inside it (decor outside the
 *     ring — chime rafts, buoy lanterns, outer lily pads — is reported) inside ±0.90 NDC across and with ≥ 6% bottom
 *     margin, far edge at 30–38% from the top (scene in the top third), 49 cell centres unoccluded, lens clearance ≥ 1.1 m.
 * Geometric evidence only; native visual acceptance is separate. */
const J=require('./journey-scene.cjs'),{fs,assert,H,S,Core,Lay,sampleRoute,routeLength,journeyCamera,start,start1,island,add,sub,bbox,blockers,clearance,rayHit}=J;
const LKS=require('./lakeside/lakeside-scene.cjs'),LK=H.load(S+'region/LakesideCameraLayout.ts'),C=LK.LAKESIDE_CAMERA_LAYOUT;
// Same set-off exemption as 04→05 (identical island approach): only her LEGS behind the island prop strip in the first metre.
const EXEMPT_M=1,STEP=+(process.env.QF_OCCLUSION_STEP||.05),HEIGHTS=[.15,.5,.9,1.25,1.6],CLEAR=1.1;
const results=[];const check=(id,fn)=>{try{results.push({id,status:'PASS',...fn()});}catch(e){results.push({id,status:'FAIL',error:String(e.stack||e)});}};
const j=LK.lakesideJourney(start),path=[...j.approach,...j.bridge.slice(1),...j.arrival],T=routeLength(path);
const route={from:'island',to:'lakeside',path,bridgeStart:routeLength(j.approach),bridgeEnd:routeLength([...j.approach,...j.bridge.slice(1)]),speed:j.speed,startBlendM:0,focus:j.focus,landing:j.landing};
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
 const asIsland={...route,to:'meadow'};Core.validateJourneyRoute(asIsland,start);assert.throws(()=>Core.validateJourneyRoute(route,start),/journey-region-order/);
 assert.throws(()=>Core.validateJourneyRoute({...asIsland,focus:undefined},start),/journey-invalid-landing/);
 assert.throws(()=>Core.validateJourneyRoute({...asIsland,landing:{arrivalSideM:NaN}},start),/journey-invalid-landing/);
 assert.throws(()=>Core.validateJourneyRoute({...asIsland,landing:{fovDeg:30}},start),/journey-invalid-landing/);
 assert.throws(()=>Core.validateJourneyRoute({...route,from:'meadow'},start),/journey-region-order/);
 for(const leg of J.legs)for(let d=0;d<=routeLength(leg.path);d+=.5)assert.deepEqual(journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,leg.startBlendM,undefined),journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,leg.startBlendM));
 const foot=[];for(let d=route.bridgeEnd;d<=T+1e-9;d+=.25){const p=sampleRoute(path,d),hit=rayHit([p[0],p[1]+3,p[2]],[0,-1,0],10,lake.find(o=>o.name==='LK_terrain_i').tris);assert(hit!==null,'no bank under her at d='+d.toFixed(2));foot.push(+(p[1]+3-hit-p[1]).toFixed(3));}
 assert(foot.every(h=>Math.abs(h)<=.03),'feet off the bank: '+foot);
 return {totalM:+T.toFixed(3),durationS:+(T/route.speed).toFixed(2),bridgeStart:+route.bridgeStart.toFixed(3),bridgeEnd:+route.bridgeEnd.toFixed(3),walkOnBankM:+(T-route.bridgeEnd).toFixed(3),footVsBankM:[Math.min(...foot),Math.max(...foot)],root:j.root.map(v=>+v.toFixed(3)),yawDeg:j.yawDeg};});
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
 assert(feet[2]>0&&head[2]>0,'behind lens');assert(feetUp>=.05,'feet '+feetUp);assert(headDown>=.05,'head '+headDown);assert(x>=.2&&x<=.8,'her x '+x);assert(h>=.12&&h<=.22,'height '+h);assert(Math.abs(fc[0])<=.9&&Math.abs(fc[1])<=.9&&fc[2]>0,'board centre '+fc);
 return finals[W+'x'+Hh]={herX:+x.toFixed(3),feetAboveBottom:+feetUp.toFixed(3),headBelowTop:+headDown.toFixed(3),herHeight:+h.toFixed(3),boardCentre:[+((fc[0]+1)/2).toFixed(3),+((1-fc[1])/2).toFixed(3)],cam:c.position.map(v=>+v.toFixed(3)),target:c.target.map(v=>+v.toFixed(3)),fov:c.fovVerticalDeg};});
check('K5 view turn ≤ 20°/s at 1.2 m/s; no crane-up over the arrival (lens height above her never rises)',()=>{let maxAng=0,at=0;
 for(let d=0;d<T;d+=.05){const a=cam(d),b=cam(Math.min(T,d+.05)),u=J.Core?null:null,fa=sub(a.target,a.position),fb=sub(b.target,b.position),la=Math.hypot(...fa),lb=Math.hypot(...fb),cos=Math.min(1,(fa[0]*fb[0]+fa[1]*fb[1]+fa[2]*fb[2])/(la*lb)),deg=Math.acos(cos)*180/Math.PI/(.05/route.speed);if(deg>maxAng){maxAng=deg;at=d;}}
 assert(maxAng<=20,`turn ${maxAng.toFixed(2)}°/s at d=${at.toFixed(2)}`);
 // No crane-up: over the arrival the lens never climbs in the world, and its height above her only falls (≤ 2 cm total of
 // up-steps allowed: the smoothed anchor rounds the bridge→bank corner by a few mm).
 const s=T-Core.JOURNEY_CAMERA.arrivalBlendM;let worldRise=0,wa=0,relUp=0,ra=0;for(let i=1;i<rows.length;i++)if(rows[i].d>=s){const dw=rows[i].cam[1]-rows[i-1].cam[1],du=rows[i].up-rows[i-1].up;if(dw>worldRise){worldRise=dw;wa=rows[i].d;}if(du>0){relUp+=du;ra=rows[i].d;}}
 assert(worldRise<=.001,`lens climbs ${worldRise} m per ${STEP} m at d=${wa}`);assert(relUp<=.02,`lens rises ${relUp} m above her (last at d=${ra})`);
 const arr=rows.filter(r=>r.d>=s),maxUp=Math.max(...rows.map(r=>r.up));
 return {maxTurnDegS:+maxAng.toFixed(2),at:+at.toFixed(2),arrivalWorldMaxClimbPerStepM:+worldRise.toFixed(4),arrivalRelativeUpStepsSumM:+relUp.toFixed(4),arrivalLensAboveHerM:[+arr[0].up.toFixed(3),+arr.at(-1).up.toFixed(3)],arrivalLensWorldY:[arr[0].cam[1],arr.at(-1).cam[1]],maxLensAboveHerM:+maxUp.toFixed(3)};});
check('K7 lens kinematics: S-curve settle, |a| ≤ 1.2 m/s², |jerk| ≤ 5 m/s³ after the set-off fade, at rest when she stops',()=>{
 const kin=fn=>{const dt=1/60,D=T/route.speed,P=[];for(let t=0;t<=D+1+1e-9;t+=dt)P.push(fn(Math.min(T,t*route.speed)).position);const der=a=>a.slice(1).map((v,i)=>v.map((x,k)=>(x-a[i][k])/dt)),n=x=>Math.hypot(...x),v=der(P),a=der(v),jk=der(a);
  const from=Math.round(.6/dt),end=Math.round(D/dt),pk=(arr,o)=>arr.reduce((m,x,i)=>i+o>=from&&n(x)>m.v?{v:n(x),t:(i+o)*dt}:m,{v:0,t:0});
  return {peakSpeed:pk(v,1),peakAccel:pk(a,1),peakJerk:pk(jk,2),last05sMaxSpeed:Math.max(...v.slice(end-30,end).map(n)),speedAfterStop:n(v[end+1])};};
 const nw=kin(cam),fb=kin(d=>journeyCamera(path,d,start1,undefined,undefined,0));
 assert(nw.peakAccel.v<=1.2,'accel '+JSON.stringify(nw.peakAccel));assert(nw.peakJerk.v<=5,'jerk '+JSON.stringify(nw.peakJerk));assert(nw.last05sMaxSpeed<=.2&&nw.speedAfterStop<1e-9,'not at rest '+nw.last05sMaxSpeed);
 const r=o=>JSON.parse(JSON.stringify(o,(k,v)=>typeof v==='number'?+v.toFixed(4):v));return {new:r(nw),fallback:r(fb)};});
// K6 board framing
const boardV=lakeLocal.filter(o=>o.group==='board');
check('K6 board framing 0.42…1.0: whole board inside with margins, scene top third, cells unoccluded, lens clearance',()=>{const out={};
 const bg=lakeLocal.filter(o=>o.group==='bg').map(o=>({tag:'lakeside',name:o.name,tris:o.tris}));
 for(const a of [.42,.45,360/780,.5,.5625,.62,.7,.75,390/520+.0001,.8,1]){const pose=LK.lakesideScenePose(a),c={position:pose.position,target:pose.target,fovVerticalDeg:pose.fovVerticalDeg};
  let maxX=0,minY=9,maxY=-9,decor=0;for(const o of boardV){const cx=(o.box[0][0]+o.box[1][0])/2,cz=(o.box[0][2]+o.box[1][2])/2,isDecor=Math.abs(cx)>C.board.extent.x+.05||cz<C.board.extent.zFar-.05||cz>C.board.extent.zNear+.05;for(let k=0;k<o.tris.length;k+=3){const q=ndc(c,[o.tris[k],o.tris[k+1],o.tris[k+2]],a);if(isDecor){decor=Math.max(decor,Math.abs(q[0]));continue;}maxX=Math.max(maxX,Math.abs(q[0]));minY=Math.min(minY,q[1]);maxY=Math.max(maxY,q[1]);}}
  const top=(1-maxY)/2,bottom=(1-minY)/2,lim=a<=C.board.maxAspect+1e-9?.9:.9;assert(maxX<=lim,`a=${a} board x ${maxX}`);assert(bottom<=.94,`a=${a} bottom ${bottom}`);assert(top>=.30&&top<=.38,`a=${a} top ${top}`);
  const blocked=[];for(let r=0;r<7;r++)for(let k=0;k<7;k++){const cell=[-3.3+1.1*k,.3,8.7+1.1*r];if(blockers(bg,c.position,cell).length)blocked.push([r,k]);}assert.deepEqual(blocked,[],'cells hidden '+JSON.stringify(blocked));
  const [lens,who]=clearance(c.position,lakeLocal.map(o=>({tag:'lakeside',name:o.name,tris:o.tris})));assert(lens>=CLEAR,`lens ${lens} from ${who}`);
  out[a.toFixed(4)]={pose,boardMaxAbsX:+maxX.toFixed(3),boardTopFrac:+top.toFixed(3),boardBottomFrac:+bottom.toFixed(3),decorMaxAbsX:+decor.toFixed(3),lensClearM:+lens.toFixed(2)};}
 return {aspects:out};});
const report={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',route:{totalM:+T.toFixed(3),bridgeStart:route.bridgeStart,bridgeEnd:route.bridgeEnd,landing:j.landing,focus:j.focus},finals,results,profile:rows.filter((r,i)=>i%10===0||i===rows.length-1)};
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/lakeside-camera.json',JSON.stringify(report,null,1)+'\n');
if(process.env.QF_LAKESIDE_DUMP)fs.writeFileSync(process.env.QF_LAKESIDE_DUMP,JSON.stringify({path,focus:j.focus,root:j.root,yawDeg:j.yawDeg,landing:j.landing,start1,rows,route:{bridgeStart:route.bridgeStart,bridgeEnd:route.bridgeEnd,speed:route.speed}}));
console.log(JSON.stringify({status:report.status,checks:results.map(r=>({id:r.id,status:r.status,error:r.error&&r.error.split('\n')[0].slice(0,400)}))},null,1));if(report.status!=='PASS')process.exitCode=1;
