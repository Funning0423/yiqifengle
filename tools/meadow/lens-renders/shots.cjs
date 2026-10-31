#!/usr/bin/env node
'use strict';
/** 运镜bot: before/after board shots (05–08 × 7 screens) + fold walk frames (390x844) for Blender (render.py). Out: $OUT/shots.json + overlay.json.
 *  Before = fixtures pose of the base (arg --before <fixture json>, default the 05 fixture = shared lens), after = current code.
 *  Run with the GGbot diffs applied. Images go OUTSIDE the repo (product/…/meadow-board-lens). */
const fs=require('node:fs'),path=require('node:path');const {load}=require('../../region-nodes/load.cjs');
const RB=load('region/RegionBoardLanding.ts'),BL=load('ui/BoardLayout.ts'),N=load('region/RegionNodes.ts'),SL=load('region/MeadowStageLens.ts'),EC=load('region/ExploreCameraCore.ts'),NW=load('region/NodeWalker.ts');
const OUT=process.env.OUT||'/workspace/wechat-game/product/2026-10-30/meadow-board-lens/work';fs.mkdirSync(OUT,{recursive:true});
const bi=process.argv.indexOf('--before'),fx=JSON.parse(fs.readFileSync(bi>0?process.argv[bi+1]:path.join(__dirname,'../fixtures/meadow_board_05_pose_3fb967af.json'),'utf8')),before=fx.poses||fx;
const node=k=>N.REGION_NODES.meadow.nodes.find(n=>n.key===k).at;RB.setMeadowBoardFraming('A');const J={},O={};
const S=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
for(const [w,h] of S){const ui=RB.girlStandUi(w,h,BL.boardSafeInsets(w,h));for(const [st,n] of [['05','M1'],['06','M2'],['07','M3'],['08','M4']]){SL.setMeadowBoardStage('mainline-'+st);
 for(const [tag,c] of [['before',before[w+'x'+h]],['after',RB.meadowBoardCamera(w,h)]]){const k=st+'_'+tag+'_'+w+'x'+h,x=RB.girlBoxPt(c,node(n),w,h);J[k]={position:c.position,target:c.target,fov:c.fovVerticalDeg,her:node(n),yaw:0,w,h};O[k]={ui,box:x,edge:x?Math.min(x.l,w-x.r,x.t,h-x.b):null};}}}
const head=(p,q)=>Math.atan2(q[0]-p[0],q[2]-p[2]);
for(const [s0,a,b] of [['mainline-06','M2','M3']]){const e=N.REGION_NODES.meadow.edges.find(x=>x.a===a&&x.b===b).path,L=NW.pathLength(e),T=L/NW.WALK_SPEED_MPS,[w,h]=[390,844];SL.setMeadowBoardStage(s0);
 const plan=SL.meadowFoldPlan(RB.meadowBoardCamera(w,h),EC.followPose(e[0],head(e[0],NW.pointAlong(e,3)),w,h,0),e[0],T,w/h);
 for(let i=0;i<=6;i++){const t=T*i/6,p=NW.pointAlong(e,t*NW.WALK_SPEED_MPS),q=NW.pointAlong(e,Math.min(L,t*NW.WALK_SPEED_MPS+.1)),o=NW.pointAlong(e,Math.max(0,t*NW.WALK_SPEED_MPS-.1)),c=SL.meadowFoldPose(plan,p,t),k=`fold_${a}${b}_${i}`,x=RB.girlBoxPt(c,p,w,h);
  J[k]={position:c.position,target:c.target,fov:c.fovVerticalDeg,her:p,yaw:head(o,q)*180/Math.PI,w,h,t};O[k]={ui:[],box:x,edge:x?Math.min(x.l,w-x.r,x.t,h-x.b):null,t};}}
fs.writeFileSync(path.join(OUT,'shots.json'),JSON.stringify(J));fs.writeFileSync(path.join(OUT,'overlay.json'),JSON.stringify(O));console.log(Object.keys(J).length,'shots →',OUT);
