'use strict';
// b16 P1-3 regression: 风铃湖畔 has a free-explore walkable area (grass + boardwalk bridge, never water), ground taps walk on it,
// drag orbits the lens there, and all four regions are wired to a walkable source.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {load,ROOT,SCRIPTS}=require('../region-nodes/load.cjs');
const W=load('region/LakesideWalkable.ts'),X=load('region/LakesideExplore.ts'),I=load('world-r2/ExploreInput.ts');
const RN=load('region/RegionNodes.ts'),O=load('region/FreeOrbit.ts'),SD=load('region/LakesideSceneData.ts'),CL=load('region/LakesideCameraLayout.ts');

// 1. data is the bake of the shipped r5h3 export (no drift)
const chk=cp.spawnSync(process.execPath,[path.join(__dirname,'bake-lakeside-walkable.cjs'),'--check'],{encoding:'utf8'});
assert.equal(chk.status,0,'lakeside walkable drift: '+chk.stderr);

// 2. all four regions configured
for(const r of ['island','meadow','skycity','lakeside'])assert.ok(I.EXPLORE_WALKABLE[r],'no walkable source for '+r);
for(const r of ['island','meadow','skycity']){
 assert.equal(I.EXPLORE_WALKABLE[r],'region-nodes');
 assert.ok(fs.existsSync(path.join(ROOT,'tools/region-nodes/fixtures',r+'-walkable.json.gz')),r+' walkable fixture');
 assert.equal(RN.REGION_NODES[r].exploreBox.length,4);
 assert.equal(X.stageGraph(r),RN.REGION_NODES[r]);
}
assert.equal(I.EXPLORE_WALKABLE.lakeside,'lakeside-walkable');
assert.ok(Array.isArray(I.SCENE_PROPS.lakeside));
const g=W.lakesideWalkGrid();let cells=0;for(const h of g.h)if(!Number.isNaN(h))cells++;
assert.ok(cells>5000,'lakeside walkable cells '+cells);
assert.equal(X.stageGraph('lakeside').nodes[0].key,'L0');

// 3. water is never walkable: every board cell, the open lake, under the bridge's water approach
for(let i=0;i<49;i++){const c=SD.lakesideCellCenter(i);assert.equal(W.lakesideWalkable(c[0],c[2]),false,'board cell '+i+' walkable');}
for(const p of [[0,-20],[10,20],[-10,18],[0,5],[0,-5],[20,10]])assert.equal(W.lakesideWalkable(p[0],p[1]),false,'water '+p);
for(let k=0;k<g.h.length;k++)if(!Number.isNaN(g.h[k]))assert.ok(g.h[k]>W.LAKESIDE_WATER_Y+0.05,'cell at water level '+k);

// 4. grass (her landing stop and around) and the boardwalk bridge deck are walkable
const stop=CL.LAKESIDE_CAMERA_LAYOUT.stopLocal;
assert.ok(W.lakesideWalkable(stop[0],stop[2]),'landing stop');
for(const p of [[1.2,24.5],[1.2,30],[-6,28],[8,26]])assert.ok(W.lakesideWalkable(p[0],p[1]),'grass '+p);
const deck=W.lakesideFloorY(0,0);assert.ok(deck!==null&&deck>2.5,'bridge deck '+deck);
assert.ok(W.lakesideWalkable(-5,0)&&W.lakesideWalkable(5,0),'bridge span');

// 5. ground taps: rays from the board lens; water answers 'water', grass answers 'walk'
const cam=CL.LAKESIDE_CAMERA_LAYOUT;void cam;
const eye=[0,13.2,26.5];
const toBoard=W.lakesideRayHit(eye,[0-eye[0],0-eye[1],12-eye[2]]);assert.equal(toBoard.kind,'water');
const toGrass=W.lakesideRayHit(eye,[-6-eye[0],0.6-eye[1],28-eye[2]]);assert.equal(toGrass.kind,'walk');
assert.ok(Math.hypot(toGrass.at[0]+6,toGrass.at[2]-28)<0.5);

// 6. walk paths stay on land; the far shore / bridge cannot be reached across water
const pts=[[-6,.6,28],[8,.6,26],[1.2,.6,30],[-15,.6,32]];
for(const t of pts){const p=W.lakesidePath(stop,t);assert.ok(p&&p.length>=2,'no path to '+t);
 for(let i=1;i<p.length;i++)assert.ok(W.lakesideLineWalkable(p[i-1],p[i]),'path leg over water '+t);
 assert.ok(Math.hypot(p[p.length-1][0]-t[0],p[p.length-1][2]-t[2])<0.6);}
assert.equal(W.lakesidePath(stop,[0,deck,0]),null,'walked across the lake');
assert.equal(W.lakesidePath(stop,[0,0,12]),null,'walked onto the board water');

// 7. explore opens after a lakeside board exit (暂停 →「回到小岛」), never during the arrival shot
const arrived={state:'lakeside',hidden:false,needsResume:false,journey:{region:'lakeside',phase:'arrived'}};
assert.equal(X.lakesideExploreWanted(arrived),true);
assert.equal(X.lakesideExploreWanted({...arrived,journey:{region:'lakeside',phase:'arrival'}}),false);
assert.equal(X.lakesideExploreWanted({...arrived,state:'level'}),false);
assert.equal(X.lakesideExploreWanted({...arrived,needsResume:true}),false);
let armed=X.lakesideExploreArm(null,arrived,false);assert.equal(armed,false,'arrival must not arm');
armed=X.lakesideExploreArm('lakeside',{state:'level',journey:{region:'lakeside',phase:'arrived'}},armed);assert.equal(armed,true);
armed=X.lakesideExploreArm('level',arrived,armed);assert.equal(armed,true,'board exit keeps armed');
assert.equal(X.lakesideExploreArm('lakeside',{state:'island'},armed),false);

// 8. drag: a 10 pt move in explore is a drag, and the lakeside orbit turns under it
assert.equal(I.classifyPointers({uiHit:false,pointers:1,movedPt:40,heldS:.3,boardOpen:false,blending:false,explore:true}),'drag');
assert.equal(I.classifyPointers({uiHit:false,pointers:1,movedPt:2,heldS:.1,boardOpen:false,blending:false,explore:true}),'tap');
const orbit=new O.FreeOrbit('lakeside');const feet=[stop[0],stop[1],stop[2]];
orbit.seed({position:[0,13.2,26.5+12],target:[stop[0],stop[1]+1,stop[2]],fovVerticalDeg:48},feet);
const y0=orbit.yaw;orbit.drag(0.2,0);assert.ok(Math.abs(orbit.yaw-y0)>1e-3,'drag did not turn the lakeside orbit');

// 9. stage wiring (source): lakeside region, ground tap, auto-open, no world-xz clamp on the local box
const src=fs.readFileSync(path.join(SCRIPTS,'world-r2/RegionNodeStage.ts'),'utf8');
assert.match(src,/if\(this\.region==='lakeside'\)\{this\.lakesideTap\(x,y\);return;\}/);
assert.match(src,/update\(dt:number\)\{\n  this\.syncLakeside\(dt\);/);
assert.match(src,/this\.openExplore\('lakeside'\)/);
assert.match(src,/region==='lakeside'\?undefined:stageGraph/);
assert.match(src,/LakesideJourneyScene/);
console.log('lakeside-walkable ok cells',cells);
