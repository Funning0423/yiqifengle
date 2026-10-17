'use strict';
// Real walk driver (FlowReferenceStandin + CharacterMotion, repo character GLB) walking the lakeside route at its declared
// timing, exactly as RegionJourneyController.walk now calls it: {kind:'walk',path,duration:timing.durationS,distanceAt}
// (QF_WALK_LINEAR=1: the old length / 1.2 m/s). Output: per-frame t, walkProgress distance, root.
const path=require('path'),fs=require('fs'),W='/workspace/wechat-game/work/wt-lk';
process.chdir(W);
const {load}=require(W+'/tools/camera-frame-test/load_ts.cjs');
const M=load(['CameraPose','WorldFlowCore','FirstsliceRoutes','FirstsliceFacts','CharacterReference','RegionCameraData','TransitionCurves','IslandRail']);
const R=require(W+'/tools/camera-frame-test/real_walk.cjs').create(M,M.WorldFlowCore);
const dump=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),P=dump.path;
const L=P.slice(1).reduce((n,b,i)=>n+Math.hypot(b[0]-P[i][0],b[1]-P[i][1],b[2]-P[i][2]),0);
const {createHarness}=require(W+'/tools/board-ui/harness.cjs'),HH=createHarness(),SS=W+'/creator-build-project/assets/scripts/';
const Core=HH.load(SS+'world-r1/RegionJourneyCore.ts'),LK=HH.load(SS+'region/LakesideCameraLayout.ts'),TM=LK.LAKESIDE_CAMERA_LAYOUT.timing,LIN=process.env.QF_WALK_LINEAR==='1';
const D=LIN?L/dump.route.speed:TM.durationS,action=process.env.QF_WALK_CURVE==='1'?{kind:'walk',path:P,duration:D,distanceAt:t=>Core.journeyDistanceAt(L,TM,t)}:{kind:'walk',path:P,duration:D};
const st=R.standin,tok={cancelled:false,check(){},wait:p=>p,onCancel(){return ()=>{}}};
st.cancelAndReset({kind:'standing',controllerRoot:P[0],yawRad:Math.atan2(P[1][0]-P[0][0],P[1][2]-P[0][2])});
let done=false;st.perform(action,tok).then(()=>{done=true;},e=>{console.error('walk err',e);done=true;});
const fps=+(process.argv[4]||60),out=[];let t=0;
for(let i=0;i<fps*(D+5)&&!done;i++){const f=st.walkProgress();out.push({t:+t.toFixed(5),s:f==null?(out.length&&out.at(-1).s>0?L:0):f*L,root:[R.node.worldPosition.x,R.node.worldPosition.y,R.node.worldPosition.z],yaw:R.node.yaw});st.advance(1/fps);t+=1/fps;}
out.push({t:+t.toFixed(5),s:L,root:P.at(-1),yaw:out.at(-1).yaw});
fs.writeFileSync(process.argv[3],JSON.stringify({L,D,fps,glb:R.glb,frames:out}));console.log('L',L.toFixed(3),'D',D.toFixed(3),'frames',out.length,'end t',t.toFixed(2),'glb',R.glb);
