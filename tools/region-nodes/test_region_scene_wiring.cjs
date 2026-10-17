'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,ROOT}=require('./load.cjs');
const P=load('region/RegionNodePlay.ts');
const C=load('region/ExploreCameraCore.ts');
const G=load('region/ExploreGate.ts');
const I=load('world-r2/ExploreInput.ts');
const M=load('ui/NodeMarkers.ts');
const W=load('region/NodeWalker.ts');

(async()=>{
const hung={perform(){return new Promise(()=>{});},cancelAndReset(pose){hung.pose=pose;}};
const timed=await P.performBounded(hung,{kind:'walk',path:[[0,0,0],[1,0,2]],duration:4},[1,0,2],0.4,30);
assert.equal(timed,'timeout');
assert.equal(hung.pose.kind,'standing');
assert.equal(Array.from(hung.pose.controllerRoot).join(','),'1,0,2');
const done=await P.performBounded({perform(){return Promise.resolve();},cancelAndReset(){throw Error('should-not-reset');}},{kind:'walk',path:[[0,0,0],[1,0,0]],duration:1},[1,0,0],0,30);
assert.equal(done,'done');

const girl=[0.2,0.03,-27.8];
const board={position:[girl[0],girl[1]+8,girl[2]+6],target:[girl[0],girl[1]+1,girl[2]],fovVerticalDeg:60};
const follow=C.followPose(girl,0,390,844,0);
const mid=C.blendPose(board,follow,0.3,C.BLEND_S.boardToFollow);
assert.ok(Math.hypot(mid.position[0]-board.position[0],mid.position[1]-board.position[1],mid.position[2]-board.position[2])>0.2);
assert.ok(Math.hypot(mid.position[0]-follow.position[0],mid.position[1]-follow.position[1],mid.position[2]-follow.position[2])>0.2);
const back=C.blendPose(follow,board,C.BLEND_S.followToBoard,C.BLEND_S.followToBoard);
assert.ok(Math.hypot(back.position[0]-board.position[0],back.position[1]-board.position[1],back.position[2]-board.position[2])<1e-6);
assert.equal(C.BLEND_S.boardToFollow,0.6);
assert.equal(C.BLEND_S.followToBoard,0.8);
const up=C.finalePose(girl,0,390,844);
assert.ok(up.target[1]>follow.target[1]+1, 'S6 looks up at the star ring');
assert.ok(C.FINALE_LOOK_DEG>8);
const s46=W.planWalk('skycity','S4','S6');
assert.ok(s46.segments.length>=1);
assert.ok(W.visibleSeconds(s46)<=W.VISIBLE_MAX_S||!s46.cut);

assert.equal(G.qaUnlocked(''),false);
assert.equal(G.qaUnlocked('?qa=0'),false);
assert.equal(G.qaUnlocked('?qa=1'),true);
assert.equal(G.qaUnlocked('?x=2&qa=1'),true);

for(const region of ['island','meadow','skycity']){
 assert.ok(I.SCENE_PROPS[region].length>=4&&I.SCENE_PROPS[region].length<=6);
 for(const id of I.SCENE_PROPS[region])assert.equal(typeof I.PROP_NODES[id],'string');
}
assert.equal(I.PROP_NODES.windchime,'env_sky_windchime_01');
assert.equal(I.PROP_NODES['star-ring'],'env_sky_starring');
assert.equal(I.PROP_NODES.robot,'chr_robot_gardener_mesh');
const fb=I.propFeedback('windchime');
assert.ok(fb.seconds>=0.3&&fb.seconds<=0.6);

assert.equal(M.ROUTE_HINT_DC,1);
assert.equal(M.markerDraw('passed',0).fill,'#e2b657');
assert.equal(M.markerDraw('playable',0).label,'playable');
assert.equal(M.markerDraw('playable',0).fill,'#f0d7a2');
assert.notEqual(M.markerDraw('playable',0).fill.toLowerCase(),'#ffffff');
assert.notEqual(M.markerDraw('playable',0).fill.toLowerCase(),'#fffaf2');
assert.equal(M.markerDraw('locked',0).fill,'#9aa0a6');
assert.ok(M.MARKER_GEM_H<=C.BODY_M/3+1e-9&&M.MARKER_GEM_H>=C.BODY_M/4-1e-9);
const beside=M.markerAnchor([2,0,4],[2.05,0,4.05]);
assert.ok(Math.hypot(beside[0]-2.05,beside[2]-4.05)>=0.6,'gem steps aside when she stands on the node');

const comp=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/world-r2/WorldNativeComposition.ts'),'utf8');
const stage=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/world-r2/RegionNodeStage.ts'),'utf8');
assert.ok(comp.includes('playReward'));
assert.ok(comp.includes('claimRegionAndWalk'));
assert.ok(comp.includes("qaUnlocked(search)"));
assert.ok(stage.includes('applyCameraPose'));
assert.ok(stage.includes('presentNodeWalkWorld'));
assert.ok(stage.includes('builtin-unlit'));
assert.ok(stage.includes('finaleLook'));
assert.ok(stage.includes('guardLens'));
assert.ok(stage.includes('MINIGAME'));
assert.equal(stage.split('addComponent(MeshRenderer)').length,2);

console.log('region-nodes-scene-wiring PASS');
})().catch(e=>{console.error(e);process.exit(1);});
