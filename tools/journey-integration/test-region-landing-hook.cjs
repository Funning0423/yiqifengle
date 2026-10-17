'use strict';
// 运镜bot: meadow (04→05) and skycity (08→09) landing → board, end to end on the pure code and the real GLB scene
// (journey-scene.cjs: both legs rebuilt exactly as RegionJourneyAdapter.prepare does).
//  * SWAP, per screen (390x844, 414x896, 360x780, 375x667, 390x520): the route ends on route.board = regionBoardEnd(map, aspect)
//    (what the adapter gives the route); the walk is simulated at 60 Hz (1.2 m/s, the in-game controller walk); the LAST world
//    camera write, mapped into the board copy's coordinates, must equal the camera that renders after the swap, computed
//    independently the way the board background writes it (MeadowBoardBackground: meadowScenePose(layout.width/layout.height);
//    SkycityBoardBackground: skycityVisitPose(anchor_spawn_girl, anchor_starcourt_center, aspect) from the board copy's own
//    anchors = the GLB): angle ≤ 0.1°, FOV ≤ 0.1°, position ≤ 1 cm. The hook then finds the camera ON the pose (one exact write,
//    hold the push-in).
//  * Landing: lens clearance ≥ 1.1 m from all GLB geometry over the blend (every 0.05 m); before the blend the lens is
//    byte-for-byte the old journey lens; FOV and view angle to the board pose never grow (monotonic, no overshoot); turn ≤ 20°/s;
//    at rest where she stops.
//  * Hook (fakes): exact → 1 write + ok; viewport changed (390x844 → 375x667, skycity 4.8 m dolly) → 1.2 s blend (first = landing pose, last = board pose); far / no pose /
//    no camera / rejected / throwing deps → ok:false, never rejects (call site keeps the old push-in path).
//  * Wiring: adapter puts route.board from regionBoardEnd and registers/drops its map; composition holds only on ok and only when
//    the meadow / skycity background renders; the backgrounds still write meadowScenePose / skycityVisitPose(aspect).
const fs=require('fs'),path=require('path');
const Jn=require('./journey-scene.cjs');
const {legs,routeLength,rotY,add,sub,mOff,sOff,yaw,sA,sp,mp,H,S,clearance,sampleRoute}=Jn;
const Core=H.load(S+'world-r1/RegionJourneyCore.ts'),RB=H.load(S+'region/RegionBoardLanding.ts'),MS=H.load(S+'region/MeadowSceneData.ts'),Visit=H.load(S+'region/SkycityVisitPose.ts');
const results=[];let fail=0;const T=async(id,f)=>{try{const r=await f();results.push({id,status:'PASS',...(r||{})});console.log('PASS',id);}catch(e){fail++;results.push({id,status:'FAIL',error:String(e.stack||e)});console.log('FAIL',id,'\n',e.stack||e);}};
const ok=(c,m)=>{if(!c)throw Error(m);};
const dir=p=>{const d=sub(p.target,p.position),l=Math.hypot(...d);return d.map(x=>x/l);};
const ang=(a,b)=>{const u=dir(a),v=dir(b),c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return Math.atan2(Math.hypot(...c),u[0]*v[0]+u[1]*v[1]+u[2]*v[2])*180/Math.PI;};
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[390,520]];
// journey copy placement exactly as journey-scene / the adapter: meadow yaw 180 + mOff, skycity yaw + sOff (prefab root identity)
const SRC={meadow:{region:'meadow',map:{toJourney:p=>add(rotY(180,p),mOff),toBoard:p=>rotY(-180,sub(p,mOff))}},
 skycity:{region:'skycity',map:{toJourney:p=>add(rotY(yaw,p),sOff),toBoard:p=>rotY(-yaw,sub(p,sOff))},anchors:{spawn:sA('anchor_spawn_girl'),court:sA('anchor_starcourt_center')}}};
const boardCamera=(region,aspect)=>region==='meadow'?MS.meadowScenePose(aspect):Visit.skycityVisitPose(sp('anchor_spawn_girl'),sp('anchor_starcourt_center'),aspect);
const LEG={meadow:legs.find(l=>l.id==='04-05'),skycity:legs.find(l=>l.id==='08-09')};
const report={limits:{angleDeg:.1,fovDeg:.1,positionCm:1,clearanceM:1.1,turnDps:20},blendM:RB.REGION_BOARD_LANDING.blendM,swapTable:[],landing:[]};
const toBoardPose=(region,p)=>({position:SRC[region].map.toBoard(p.position),target:SRC[region].map.toBoard(p.target),fovVerticalDeg:p.fovVerticalDeg});
(async()=>{
for(const region of ['meadow','skycity']){const leg=LEG[region],L=routeLength(leg.path);
 for(const [w,h] of SCREENS){const key=`${region} ${w}x${h}`;
  await T('swap '+key,async()=>{
   const board=RB.regionBoardEnd(SRC[region],w/h),route={from:region==='meadow'?'island':'meadow',to:region,path:leg.path,bridgeStart:1,bridgeEnd:2,speed:1.2,...(leg.focus?{focus:leg.focus,lens:leg.lens}:{}),board};
   Core.validateJourneyRoute(route,leg.path[0]);
   const cam=d=>Core.journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,leg.startBlendM,undefined,board);
   // 60 Hz walk at 1.2 m/s, final observe at the stop (controller.walk writes journeyCamera(T) last)
   let d=0;const step=1.2/60;while(d+step<L)d+=step;const lastWalk=cam(d),last=cam(L);
   const before=toBoardPose(region,last),after=boardCamera(region,w/h);
   const dA=ang(before,after),dF=Math.abs(before.fovVerticalDeg-after.fovVerticalDeg),dP=Math.hypot(...sub(before.position,after.position))*100;
   ok(dA<=.1,'swap angle '+dA);ok(dF<=.1,'swap fov '+dF);ok(dP<=1,'swap position cm '+dP);
   // the hook sees the camera ON the board pose → one exact write, hold
   const writes=[];const r=await RB.regionLandingToBoard({region,stageId:'x',deps:{readCamera:()=>last,setCamera:p=>{writes.push(p);return true;},nextFrame:async()=>1/60,viewport:()=>({width:w,height:h}),boardPose:v=>RB.regionBoardPose(SRC[region],v.width/v.height)}});
   ok(r.ok&&r.result==='on-board-pose'&&writes.length===1,'hook '+JSON.stringify(r)+' writes '+writes.length);
   const hb=toBoardPose(region,writes[0]),hA=ang(hb,after),hF=Math.abs(hb.fovVerticalDeg-after.fovVerticalDeg),hP=Math.hypot(...sub(hb.position,after.position))*100;
   ok(hA<=.1&&hF<=.1&&hP<=1,'hook write vs board '+[hA,hF,hP]);
   const row={region,screen:`${w}x${h}`,boardCamera:{position:after.position,target:after.target,fovVerticalDeg:after.fovVerticalDeg},swapDelta:{angleDeg:Math.max(dA,hA),fovDeg:Math.max(dF,hF),positionCm:Math.max(dP,hP)},lastWalkStepToStop:{angleDeg:ang(lastWalk,last),positionCm:Math.hypot(...sub(lastWalk.position,last.position))*100}};
   report.swapTable.push(row);return row;});
  await T('landing '+key,async()=>{
   const board=RB.regionBoardEnd(SRC[region],w/h),B=board.blendM,cam=d=>Core.journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,leg.startBlendM,undefined,board),base=d=>Core.journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,leg.startBlendM);
   for(let d=0;d<=L-B;d+=.25){const a=cam(d),b=base(d);ok(JSON.stringify(a)===JSON.stringify(b),'lens changed before the blend at d '+d);}
   let minC=9,minWho=null,prev=null,prevG=null,maxTurn=0,maxFovRate=0,maxPosGrow=0,maxAngGrow=0,maxFovGrow=0,inFrame=0,n=0;const dt=1/60,v=1.2;
   for(let i=0;;i++){const d=Math.min(L,L-B+i*v*dt),c=cam(d);
    const g={p:Math.hypot(...sub(c.position,board.position)),a:ang(c,board),f:Math.abs(c.fovVerticalDeg-board.fovVerticalDeg)};
    if(prevG){maxPosGrow=Math.max(maxPosGrow,g.p-prevG.p);maxAngGrow=Math.max(maxAngGrow,g.a-prevG.a);maxFovGrow=Math.max(maxFovGrow,g.f-prevG.f);}
    if(prev){maxTurn=Math.max(maxTurn,ang(prev,c)/dt);maxFovRate=Math.max(maxFovRate,Math.abs(c.fovVerticalDeg-prev.fovVerticalDeg)/dt);}
    if(i%3===0){const [cl,who]=clearance(c.position,leg.objs,3);if(cl<minC){minC=cl;minWho=who+' at '+(L-d).toFixed(2)+' m before the stop';}}
    // her chest (0.9 m) inside the view frustum (reported)
    const her=sampleRoute(leg.path,d),f=dir(c),q=sub([her[0],her[1]+.9,her[2]],c.position),z=q[0]*f[0]+q[1]*f[1]+q[2]*f[2];if(z>0){const r=[f[2],0,-f[0]],rl=Math.hypot(...r)||1,u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];const x=(q[0]*r[0]+q[2]*r[2])/rl,y=-(q[0]*u[0]+q[1]*u[1]+q[2]*u[2])/rl,t=Math.tan(c.fovVerticalDeg*Math.PI/360);if(Math.abs(y/z)<=t&&Math.abs(x/z)<=t*w/h)inFrame++;}
    n++;prev=c;prevG=g;if(d>=L)break;}
   const end=cam(L),endStep=ang(cam(L-.002),end)/(.002/1.2);
   ok(minC>=1.1,'clearance '+minC+' '+minWho);ok(maxFovGrow<=1e-9,'FOV not monotonic '+maxFovGrow);ok(maxAngGrow<=.15,'view not monotonic '+maxAngGrow);ok(maxTurn<=20,'turn '+maxTurn);ok(endStep<.05,'not at rest at the stop: '+endStep+' deg/s');
   const row={region,screen:`${w}x${h}`,blendM:B,blendS:+(B/1.2).toFixed(2),gapAtBlendStart:{positionM:Math.hypot(...sub(cam(L-B).position,board.position)),viewDeg:ang(cam(L-B),board),fovDeg:board.fovVerticalDeg-cam(L-B).fovVerticalDeg},minClearanceM:+minC.toFixed(3),minClearanceAt:minWho,maxTurnDps:+maxTurn.toFixed(2),maxFovRateDps:+maxFovRate.toFixed(3),
    monotonic:{fovGrowDeg:maxFovGrow,viewGrowDeg:+maxAngGrow.toFixed(4),positionGrowM:+maxPosGrow.toFixed(4)},turnRateAtStopDps:+endStep.toFixed(5),herChestInFrameShare:+(inFrame/n).toFixed(3)};
   report.landing.push(row);return row;});
 }}
await T('hook residual / failure paths',async()=>{const src=SRC.skycity,a=RB.regionBoardPose(src,390/844),b=RB.regionBoardPose(src,375/667),out={};
 {const writes=[];const r=await RB.regionLandingToBoard({region:'skycity',stageId:'x',deps:{readCamera:()=>a,setCamera:p=>{writes.push(p);return true;},nextFrame:async()=>1/60,viewport:()=>({width:375,height:667}),boardPose:v=>RB.regionBoardPose(src,v.width/v.height)}});
  const g0=RB.poseGap(a,b);ok(r.ok&&r.result==='blended','residual '+JSON.stringify(r));const sec=Math.min(4,Math.max(1,g0.positionM/4));ok(Math.abs(writes.length-(Math.ceil(sec*60)+1))<=1,sec+' s at 60 Hz '+writes.length);
  const f=RB.poseGap(writes[0],a),l=RB.poseGap(writes.at(-1),b);ok(f.positionM<1e-9&&f.viewDeg<1e-6,'first write = landing pose');ok(l.positionM<1e-9&&l.viewDeg<1e-6&&Math.abs(l.fovDeg)<1e-9,'last write = board pose');
  let prev=9e9;for(const w of writes){const g=RB.poseGap(w,b).positionM;ok(g<=prev+1e-9,'residual not monotonic');prev=g;}out.residual={gap:g0,seconds:sec,writes:writes.length,result:r};}
 const far={position:[0,0,0],target:[0,0,-1],fovVerticalDeg:48};
 const cases={far:{readCamera:()=>far},noPose:{readCamera:()=>a,boardPose:()=>null},noCamera:{readCamera:()=>null},rejected:{readCamera:()=>a,setCamera:()=>false},throws:{readCamera:()=>{throw Error('boom');}},viewportThrows:{readCamera:()=>a,viewport:()=>{throw Error('vp');}}};
 for(const [k,c] of Object.entries(cases)){const writes=[];const deps={readCamera:()=>a,setCamera:p=>{writes.push(p);return true;},nextFrame:async()=>1/60,viewport:()=>({width:390,height:844}),boardPose:v=>RB.regionBoardPose(src,v.width/v.height),...c};
  if(k==='rejected')deps.setCamera=()=>false;
  let r;try{r=await RB.regionLandingToBoard({region:'skycity',stageId:'x',deps});}catch(e){throw Error(k+' rejected: '+e);}ok(r&&r.ok===false,k+' must not hold: '+JSON.stringify(r));if(k!=='rejected')ok(writes.length===0,k+' wrote the camera');out[k]=r.result;}
 const r0=await RB.regionLandingToBoard({region:'meadow',stageId:'x'});ok(r0.ok===false&&r0.result==='no-deps','no deps');out.noDeps=r0.result;return out;});
await T('routes without board unchanged; invalid board rejected',async()=>{const leg=LEG.skycity,L=routeLength(leg.path);
 for(let d=0;d<=L;d+=.5)ok(JSON.stringify(Core.journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,0))===JSON.stringify(Core.journeyCamera(leg.path,d,leg.start,leg.focus,leg.lens,0,undefined,undefined)),'no-board lens changed');
 const base={from:'meadow',to:'skycity',path:leg.path,bridgeStart:1,bridgeEnd:2,speed:1.2,focus:leg.focus};const good=RB.regionBoardEnd(SRC.skycity,390/844);
 Core.validateJourneyRoute({...base,board:good},leg.path[0]);
 for(const bad of [{...good,blendM:0},{...good,blendM:L+1},{...good,fovVerticalDeg:NaN},{...good,target:good.position}]){let threw=false;try{Core.validateJourneyRoute({...base,board:bad},leg.path[0]);}catch{threw=true;}ok(threw,'invalid board accepted '+JSON.stringify(bad).slice(0,80));}});
await T('wiring',async()=>{const src=f=>fs.readFileSync(S+f,'utf8').replace(/\s+/g,' ');
 const ad=src('region/RegionJourneyAdapter.ts'),co=src('world-r2/WorldNativeComposition.ts'),mb=src('region/MeadowBoardBackground.ts'),sb=src('region/SkycityBoardBackground.ts'),core=src('world-r1/RegionJourneyCore.ts');
 ok(/model=mountRegion\(def,prefab,rig\);[^;]*boardLocal=new Mat4\(\);Mat4\.fromRTS\(boardLocal,model\.rotation,model\.position,model\.scale\);/.test(ad),'adapter: board copy transform captured right after mountRegion');
 ok(/board=regionBoardEnd\(boardSrc,v\.width\/v\.height\)/.test(ad)&&/lakesideViewport\(view\.getFrameSize\(\)\)/.test(ad),'adapter: route.board from the board UI viewport');
 ok(/\.\.\.\(board\?\{board\}:\{\}\)\};/.test(ad),'adapter: route carries board');
 ok(/if\(boardSrc&&route\.board\)setRegionBoardSource\(to as BoardLandingRegion,boardSrc\);/.test(ad)&&/if\(boardSrc&&regionBoardSource\(to as BoardLandingRegion\)===boardSrc\)setRegionBoardSource\(to as BoardLandingRegion,null\);/.test(ad),'adapter: map registered / dropped with the lease');
 ok(/else if\(\(region==='meadow'&&requiresMeadowScene\(selection\)\)\|\|\(region==='skycity'&&requiresSkycityScene\(selection\)\)\)\{const landed=await regionLandingToBoard\(\{region,stageId:selection\.stageId,deps:this\.regionLandingDeps\(region\)\}\);if\(landed\.ok\)\{held=true;this\.world\?\.holdEnterLevel\?\.\(true\);\}\}/.test(co),'composition: hold only on ok, only with that background');
 ok(/finally\{if\(held\)this\.world\?\.holdEnterLevel\?\.\(false\);\}/.test(co),'composition: hold cleared');
 ok(/const pose=meadowScenePose\(layout\.width\/layout\.height\);if\(!applyCameraPose\(camera!,fromLookAt\(pose\)/.test(mb),'meadow background still writes meadowScenePose(aspect)');
 ok(/pose=skycityVisitPose\(\[av\.x,av\.y,av\.z\],\[bv\.x,bv\.y,bv\.z\],layout\.width\/layout\.height\);if\(!applyCameraPose\(camera!,fromLookAt\(pose\)/.test(sb)&&/find\(model,'anchor_spawn_girl'\),b=find\(model,'anchor_starcourt_center'\)/.test(sb),'skycity background still writes skycityVisitPose(spawn, court, aspect)');
 ok((core.match(/this\.lease\.route\.board\)/g)||[]).length===3,'controller passes route.board on every journeyCamera write');});
const out={status:fail?'FAIL':'PASS',passed:results.length-fail,total:results.length,...report,results};
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/region-landing-hook.json',JSON.stringify(out,null,1)+'\n');
console.log(JSON.stringify({status:out.status,passed:out.passed,total:out.total}));process.exit(fail?1:0);
})();
