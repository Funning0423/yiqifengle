'use strict';
const assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const C=load('region/ExploreCameraCore.ts');
const N=load('region/RegionNodes.ts');
const events=[['Board','reward','BoardToFollow'],['BoardToFollow','blend-done','FollowWalk'],['FollowWalk','arrive-mainline','FollowToBoard'],['FollowToBoard','blend-done','Board'],['FollowWalk','arrive-departure','Transition'],['Transition','arrive-landing','FollowWalk'],['Board','open-map','MapExplore'],['FollowWalk','idle-explore','MapExplore'],['MapExplore','tap-ground','FollowWalk'],['MapExplore','tap-mainline','BoardToFollow'],['FollowWalk','cut','FollowWalk']];
for(const [s,e,n] of events)assert.equal(C.transition(s,e,true),n,s+e);
assert.equal(C.transition('Board','open-map',false),'Board');
assert.equal(C.transition('FollowWalk','idle-explore',false),'FollowWalk');
const girl=[-1.4,3.19,1.2];
for(const [w,h] of C.SCREENS){
 const follow=C.followPose(girl,0.4,w,h,0);
 const frame=C.bodyFrame(follow,girl,w,h);
 assert.ok(frame.inside,'inside '+w+'x'+h);
 assert.ok(frame.fraction>=C.MIN_BODY_SCREEN,'frac '+frame.fraction+' '+w);
 assert.ok(frame.uiGap,'ui '+w+'x'+h+' '+JSON.stringify(frame));
 for(const zoom of [C.screenProfile(w,h).zoomMin,C.screenProfile(w,h).zoomMax]){
  const map=C.mapPose(girl,zoom,w,h);
  const mf=C.bodyFrame(map,girl,w,h);
  assert.ok(mf.inside&&mf.fraction>=C.MIN_BODY_SCREEN&&mf.uiGap,'map '+w+'x'+h+' z'+zoom+' '+JSON.stringify(mf));
 }
 const board={position:[9,19,42],target:[0.3,5.5,-15.8],fovVerticalDeg:49.4};
 const end=C.blendPose(board,follow,0,C.BLEND_S.boardToFollow);
 const start=C.blendPose(board,follow,C.BLEND_S.boardToFollow,C.BLEND_S.boardToFollow);
 assert.ok(C.poseDelta(end,board).positionM<=0.01&&C.poseDelta(end,board).dirDeg<=0.5);
 assert.ok(C.poseDelta(start,follow).positionM<=0.01&&C.poseDelta(start,follow).dirDeg<=0.5);
}
assert.equal(C.followLookUp('skycity',4.2),8);
assert.equal(C.followLookUp('skycity',5),0);
assert.equal(C.followLookUp('meadow',1),0);
const box=N.REGION_NODES.meadow.exploreBox;
const outside=[box[2]+4,3,box[3]+4];
const clamped=C.clampFocus('meadow',outside);
assert.equal(clamped[0],box[2]);assert.equal(clamped[2],box[3]);
const back=C.rebound(outside,clamped,0.25,0.25);
assert.ok(Math.hypot(back[0]-clamped[0],back[2]-clamped[2])<1e-6);
assert.ok(Math.abs(C.dampSpeed(10,1)-9)<1e-9);
assert.ok(C.dampSpeed(10,0)===10);
console.log('explore-camera PASS');
