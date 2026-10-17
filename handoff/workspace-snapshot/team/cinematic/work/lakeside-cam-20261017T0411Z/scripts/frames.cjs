'use strict';
// Per-frame plan for the Blender previews (b0c21d2+): her route distance s(t) = journeyDistanceAt(T, timing, t) — exactly the
// distance curve RegionJourneyController.walk hands the walk action (17 s S-curve) — her root/yaw, and the lens for
//   new:      Landing A lakeside journey lens, then lakesideLandingBlend (1 s) into the board camera, then the board camera
//   fallback: the default follow lens (no focus/landing) on the same walk, held after the stop (no board camera of its own)
// all from the committed TypeScript. usage: frames.cjs route_dump.json plan.json [fps=24] [hold=1.5] [size=360x780]
const fs=require('fs'),W=process.env.WT||'/workspace/wechat-game/work/wt-lk';
const {createHarness}=require(W+'/tools/board-ui/harness.cjs'),H=createHarness(),S=W+'/creator-build-project/assets/scripts/';
const Core=H.load(S+'world-r1/RegionJourneyCore.ts'),LK=H.load(S+'region/LakesideCameraLayout.ts'),BL=H.load(S+'ui/BoardLayout.ts'),SD=H.load(S+'region/LakesideSceneData.ts');
const dump=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),P=dump.path,T=Core.routeLength(P),fps=+(process.argv[4]||24),hold=+(process.argv[5]||1.5),vsize=process.argv[6]||'360x780';
const C=LK.LAKESIDE_CAMERA_LAYOUT,TM=C.timing,D=TM.durationS,BS=C.landingBlend.seconds,journey={yawDeg:dump.yawDeg,root:dump.root};
const frameFor=(w,h)=>{const g=BL.boardLayout(w,h,{top:0,bottom:0,left:0,right:0,capsule:null},2);return {g,frame:{width:w,height:h,boardTop:g.tray.y-g.tray.height/2,board:{x:g.grid.x,y:g.grid.y,size:g.grid.size}}};};
const nw=d=>Core.journeyCamera(P,d,dump.start1,dump.focus,undefined,0,dump.landing),fb=d=>Core.journeyCamera(P,d,dump.start1,undefined,undefined,0);
const [vw,vh]=vsize.split('x').map(Number),blend=LK.lakesideLandingBlend(nw(T),frameFor(vw,vh).frame,journey);
const frames=[];
for(let i=0;i*1/fps<=D+BS+hold+1e-9;i++){const t=i/fps,s=t>=D?T:Math.min(T,Core.journeyDistanceAt(T,TM,t)),p=Core.sampleRoute(P,s),q=Core.sampleRoute(P,Math.max(0,s-.08)),q2=Core.sampleRoute(P,Math.min(T,s+.08));
 const a=s>=T?q:p,b=s>=T?p:q2,yaw=Math.atan2(b[0]-a[0],b[2]-a[2]),c={new:t<=D?nw(s):blend.at(t-D),fallback:fb(s)},cams={};
 for(const [k,v] of Object.entries(c))cams[k]={p:v.position,t:v.target,fov:v.fovVerticalDeg??48};
 frames.push({i,t:+t.toFixed(4),s:+s.toFixed(4),root:p,yaw,walking:t<D-1e-9&&s<T-1e-6,phase:t<=D?'journey':t<=D+BS+1e-9?'blend':'board',cams});}
const board={};
for(const [w,h] of [[360,780],[390,520]]){const {g,frame}=frameFor(w,h),vb=SD.lakesideBoardPose(w/h),bl=LK.lakesideLandingBlend(nw(T),frame,journey);
 board[w+'x'+h]={new:LK.lakesideAlignedLookAt(frame),landing:{position:nw(T).position,target:nw(T).target,fovVerticalDeg:48},fallbackEnd:{position:fb(T).position,target:fb(T).target,fovVerticalDeg:fb(T).fovVerticalDeg??48},
  handoff:{position:vb.position,forward:[...SD.LAKESIDE_BOARD_CAMERA.forward],fovVerticalDeg:vb.fovVerticalDeg},boardWorld:bl.boardWorld,tray:g.tray,grid:g.grid,pitch:g.pitch};}
fs.writeFileSync(process.argv[3],JSON.stringify({fps,T,D,blendS:BS,hold,videoSize:vsize,root:dump.root,yawDeg:dump.yawDeg,path:P,bridgeStart:dump.route.bridgeStart,bridgeEnd:dump.route.bridgeEnd,frames,board,focus:dump.focus}));
console.log('frames',frames.length,'T',T.toFixed(3),'D',D,'blend',BS,'stop frame',frames.findIndex(f=>f.t>=D-1e-9));
