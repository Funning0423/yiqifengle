'use strict';
// 运镜bot: meadow (04→05) and skycity (08→09) landing → board, end to end on the pure code and the real GLB scene
// b16: the rainbow-bridge walking legs are gone, so the per-screen SWAP / LANDING / walk-end / meadow-stand groups (all
// computed on those legs) were removed; the hook failure paths and the wiring still hold for the sail / balloon arrivals.
// (journey-scene.cjs: region placement as the live game.)
//  * SWAP, per screen (390x844, 414x896, 360x780, 375x667, 390x520): the route ends on route.board = regionBoardEnd(map, aspect)
//    (what the adapter gives the route); the walk is simulated at 60 Hz (1.2 m/s, the in-game controller walk); the LAST world
//    camera write, mapped into the board copy's coordinates, must equal the camera that renders after the swap, computed
//    independently the way the board background writes it (MeadowBoardBackground: meadowScenePose(layout.width/layout.height);
//    SkycityBoardBackground: skycityVisitPose(anchor_spawn_girl, anchor_starcourt_center, aspect) from the board copy's own
//    anchors = the GLB): angle ≤ 0.1°, FOV ≤ 0.1°, position ≤ 1 cm. The hook then finds the camera ON the pose (one exact write,
//    hold the push-in).
//  * Landing: lens clearance ≥ 1.1 m from all GLB geometry over the blend (every 0.05 m); before the blend the lens is
//    byte-for-byte the old journey lens; FOV and view angle to the board pose never grow over the whole blend (monotonic, no overshoot; the view slerps from its blend-start
//    direction); position may drift away from the board ≤ 1 m (C1 hand-off: meadow's follow lens is heading away from the board pose when
//    the blend starts and is turned smoothly, never backing up: velocity 0.5 s apart never reverses); turn-rate jump at the blend start ≤ 2°/s; turn ≤ 20°/s;
//    at rest where she stops.
//  * Hook (fakes): exact → 1 write + ok; viewport changed (390x844 → 375x667, skycity 4.8 m dolly) → 1.2 s blend (first = landing pose, last = board pose); far / no pose /
//    no camera / rejected / throwing deps → ok:false, never rejects (call site keeps the old push-in path).
//  * Wiring: adapter puts route.board from regionBoardEnd and registers/drops its map; composition holds only on ok and only when
//    the meadow / skycity background renders; the backgrounds still write meadowScenePose / skycityVisitPose(aspect).
const fs=require('fs'),path=require('path');
const Jn=require('./journey-scene.cjs');
const {routeLength,rotY,add,sub,mOff,sOff,yaw,sA,sp,mp,H,S,clearance,sampleRoute}=Jn;
const Core=H.load(S+'world-r1/RegionJourneyCore.ts'),RB=H.load(S+'region/RegionBoardLanding.ts'),MS=H.load(S+'region/MeadowSceneData.ts'),Visit=H.load(S+'region/SkycityVisitPose.ts');
const results=[];let fail=0;const T=async(id,f)=>{try{const r=await f();results.push({id,status:'PASS',...(r||{})});console.log('PASS',id);}catch(e){fail++;results.push({id,status:'FAIL',error:String(e.stack||e)});console.log('FAIL',id,'\n',e.stack||e);}};
const ok=(c,m)=>{if(!c)throw Error(m);};
const dir=p=>{const d=sub(p.target,p.position),l=Math.hypot(...d);return d.map(x=>x/l);};
const ang=(a,b)=>{const u=dir(a),v=dir(b),c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return Math.atan2(Math.hypot(...c),u[0]*v[0]+u[1]*v[1]+u[2]*v[2])*180/Math.PI;};
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]],GIRL_SCREENS=SCREENS;
// journey copy placement exactly as journey-scene / the adapter: meadow yaw 180 + mOff, skycity yaw + sOff (prefab root identity)
const SRC={meadow:{region:'meadow',map:{toJourney:p=>add(rotY(180,p),mOff),toBoard:p=>rotY(-180,sub(p,mOff))}},
 skycity:{region:'skycity',map:{toJourney:p=>add(rotY(yaw,p),sOff),toBoard:p=>rotY(-yaw,sub(p,sOff))},anchors:{spawn:sA('anchor_spawn_girl'),court:sA('anchor_starcourt_center')}}};
const boardCamera=(region,aspect)=>region==='meadow'?MS.meadowScenePose(aspect):Visit.skycityVisitPose(sp('anchor_spawn_girl'),sp('anchor_starcourt_center'),aspect);
const report={limits:{angleDeg:.1,fovDeg:.1,positionCm:1,clearanceM:1.1,turnDps:20},blendM:RB.REGION_BOARD_LANDING.blendM,swapTable:[],landing:[]};
const toBoardPose=(region,p)=>({position:SRC[region].map.toBoard(p.position),target:SRC[region].map.toBoard(p.target),fovVerticalDeg:p.fovVerticalDeg});
(async()=>{
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
 await T('wiring',async()=>{const src=f=>fs.readFileSync(S+f,'utf8').replace(/\s+/g,' ');
 const ad=src('region/RegionJourneyAdapter.ts'),co=src('world-r2/WorldNativeComposition.ts'),mb=src('region/MeadowBoardBackground.ts'),sb=src('region/SkycityBoardBackground.ts'),core=src('world-r1/RegionJourneyCore.ts');
 ok(/model=mountRegion\(def,prefab,rig\);[^;]*boardLocal=new Mat4\(\);Mat4\.fromRTS\(boardLocal,model\.rotation,model\.position,model\.scale\);/.test(ad),'adapter: board copy transform captured right after mountRegion');
 ok(/board=regionBoardEnd\(boardSrc,v\.width\/v\.height(,v)?\)/.test(ad)&&/lakesideViewport\(view\.getFrameSize\(\)\)/.test(ad),'adapter: route.board from the board UI viewport');
 ok(/\.\.\.\(board\?\{board\}:\{\}\)\};/.test(ad),'adapter: route carries board');
 ok(/if\(boardSrc&&route\.board\)setRegionBoardSource\(to as BoardLandingRegion,boardSrc\);/.test(ad)&&/if\(boardSrc&&regionBoardSource\(to as BoardLandingRegion\)===boardSrc\)setRegionBoardSource\(to as BoardLandingRegion,null\);/.test(ad),'adapter: map registered / dropped with the lease');
 ok(/else if\(region==='meadow'\|\|region==='skycity'\)\{const deps=this\.regionLandingDeps\(region\);if\(deps&&\(region==='meadow'\?requiresMeadowScene\(selection\):requiresSkycityScene\(selection\)\)\)\{const landed=await regionLandingToBoard\(\{region,stageId:selection\.stageId,deps\}\);if\(landed\.ok\)\{held=true;this\.world\?\.holdEnterLevel\?\.\(true\);\}\}\}/.test(co),'composition: hold only on ok, only with that background (no world camera → today\'s path)');
 ok(/finally\{if\(held\)this\.world\?\.holdEnterLevel\?\.\(false\);\}/.test(co),'composition: hold cleared');
 ok(/const pose=meadowBoardCamera\(layout\.width,layout\.height\);if\(!applyCameraPose\(camera!,fromLookAt\(pose\)/.test(mb),'meadow background writes meadowBoardCamera (= meadowScenePose(aspect) unless the sail arrival set framing A; tools/meadow/test_meadow_board_framing.cjs)');
 ok(/pose=skycityVisitPose\(\[av\.x,av\.y,av\.z\],\[bv\.x,bv\.y,bv\.z\],layout\.width\/layout\.height\);if\(!applyCameraPose\(camera!,fromLookAt\(pose\)/.test(sb)&&/find\(model,'anchor_spawn_girl'\),b=find\(model,'anchor_starcourt_center'\)/.test(sb),'skycity background still writes skycityVisitPose(spawn, court, aspect)');
 ok((core.match(/this\.lease\.route\.board\)/g)||[]).length===3,'controller passes route.board on every journeyCamera write');});
const out={status:fail?'FAIL':'PASS',passed:results.length-fail,total:results.length,...report,results};
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/region-landing-hook.json',JSON.stringify(out,null,1)+'\n');
console.log(JSON.stringify({status:out.status,passed:out.passed,total:out.total}));process.exit(fail?1:0);
})();
