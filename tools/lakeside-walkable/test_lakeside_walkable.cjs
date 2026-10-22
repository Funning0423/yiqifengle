'use strict';
// b16 P1-3 regression (+ b16 decision 2026-10-22): free explore has a walkable area in 风铃湖畔, 草原 and 天空城 (and the island),
// ground taps walk on it, drag orbits the lens there, it only opens after a board exit (never during landing / cutscene shots),
// the lakeside boardwalk joins the near shore to the far shore and the bridge, and nearestWalkable() answers for 运镜bot.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {load,ROOT,SCRIPTS}=require('../region-nodes/load.cjs');
const RW=load('region/RegionWalkable.ts'),W=load('region/LakesideWalkable.ts'),X=load('region/LakesideExplore.ts'),I=load('world-r2/ExploreInput.ts');
const RN=load('region/RegionNodes.ts'),O=load('region/FreeOrbit.ts'),SD=load('region/LakesideSceneData.ts'),CL=load('region/LakesideCameraLayout.ts');

// 1. data is the bake of the shipped GLBs / r5h3 transforms (no drift)
const chk=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/region-walkable/bake-region-walkable.cjs'),'--check'],{encoding:'utf8'});
assert.equal(chk.status,0,'region walkable drift: '+chk.stderr+chk.stdout);

// 2. all four regions configured, one source
const cells={};
for(const r of ['island','meadow','skycity','lakeside']){
 assert.equal(I.EXPLORE_WALKABLE[r],'region-walkable',r);
 const g=RW.walkGrid(r);let n=0;for(const h of g.h)if(!Number.isNaN(h))n++;cells[r]=n;
}
assert.ok(cells.island>2000&&cells.meadow>15000&&cells.skycity>15000&&cells.lakeside>8000,JSON.stringify(cells));
for(const r of ['island','meadow','skycity']){assert.equal(RN.REGION_NODES[r].exploreBox.length,4);assert.equal(X.stageGraph(r),RN.REGION_NODES[r]);}
assert.ok(Array.isArray(I.SCENE_PROPS.lakeside));
assert.equal(X.stageGraph('lakeside').nodes[0].key,'L0');

// 3. meadow / skycity: every story node stands on (or within 1.2 m of) the walkable area, paths between nodes exist and stay on it,
//    outside the explore box is never walkable
for(const r of ['meadow','skycity']){
 const G=RN.REGION_NODES[r],nodes=G.nodes,box=G.exploreBox;
 for(const n of nodes){const h=RW.nearestWalkable(r,n.at,1.2);assert.ok(h,r+' node '+n.key+' off the walkable area');}
 for(let i=1;i<nodes.length;i++){
  const a=RW.nearestWalkable(r,nodes[0].at,1.2).at,b=RW.nearestWalkable(r,nodes[i].at,1.2).at,p=RW.walkPath(r,a,b);
  assert.ok(p&&p.length>=2,r+' no path '+nodes[0].key+'→'+nodes[i].key);
  for(let k=1;k<p.length;k++)assert.ok(RW.lineWalkable(r,p[k-1],p[k]),r+' path leg off the area '+nodes[i].key);
 }
 const cx=(box[0]+box[2])/2,cz=(box[1]+box[3])/2;
 assert.equal(RW.isWalkable(r,box[0]-3,cz),false,r+' west of box');assert.equal(RW.isWalkable(r,box[2]+3,cz),false,r+' east of box');
 assert.equal(RW.isWalkable(r,cx,box[1]-3),false,r+' north of box');assert.equal(RW.isWalkable(r,cx,box[3]+3),false,r+' south of box');
 // a tap straight down onto a node lands on walkable ground
 const n0=nodes[0].at,hit=RW.walkRayHit(r,[n0[0],n0[1]+12,n0[2]+6],[0,-12,-6]);
 assert.equal(hit.kind,'walk',r+' ground tap');
}
// meadow: not every cell is walkable (house / rocks / trees cut out); skycity: no floor under the void
assert.ok(cells.meadow<RW.walkGrid('meadow').W*RW.walkGrid('meadow').H);
assert.equal(RW.walkRayHit('skycity',[0,-10,0],[0,-1,0]).kind,'none');

// 4. lakeside: water is never walkable (every board cell, the open lake)
const g=W.lakesideWalkGrid();
for(let i=0;i<49;i++){const c=SD.lakesideCellCenter(i);assert.equal(W.lakesideWalkable(c[0],c[2]),false,'board cell '+i+' walkable');}
for(const p of [[0,-20],[10,20],[-10,18],[0,5],[0,-5],[20,10]])assert.equal(W.lakesideWalkable(p[0],p[1]),false,'water '+p);
for(let k=0;k<g.h.length;k++)if(!Number.isNaN(g.h[k]))assert.ok(g.h[k]>W.LAKESIDE_WATER_Y+0.05,'cell at water level '+k);

// 5. lakeside: grass, bridge deck and the b16 boardwalk (x=-13, z 2.5..24.5, deck ≈0.585) are walkable
const stop=CL.LAKESIDE_CAMERA_LAYOUT.stopLocal;
assert.ok(W.lakesideWalkable(stop[0],stop[2]),'landing stop');
for(const p of [[1.2,24.5],[1.2,30],[-6,28],[8,26]])assert.ok(W.lakesideWalkable(p[0],p[1]),'grass '+p);
const deck=W.lakesideFloorY(0,0);assert.ok(deck!==null&&deck>2.5,'bridge deck '+deck);
assert.ok(W.lakesideWalkable(-5,0)&&W.lakesideWalkable(5,0),'bridge span');
let bw=0;for(let z=4;z<=22;z+=.5){const y=W.lakesideFloorY(-13,z);if(y!==null){bw++;assert.ok(Math.abs(y-.585)<.1,'boardwalk deck y '+y+' @'+z);}}
assert.ok(bw>=28,'boardwalk walkable samples '+bw);
const tr=JSON.parse(fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_lakeside/scene_r5h_slim_transforms.json'),'utf8'));
const insts=(tr.instances||tr.objects||[]).filter(o=>/^LK_boardwalk_b16_/.test(o.name||''));
assert.equal(insts.length,11,'boardwalk instances');
for(const o of insts){const x=o.pos[0],z=o.pos[2];assert.ok(Math.abs(x)>9||Math.abs(z-12)>6,'boardwalk in the board area '+o.name);}

// 6. ground taps from the board lens; water answers 'water', grass answers 'walk'
const eye=[0,13.2,26.5];
assert.equal(W.lakesideRayHit(eye,[0-eye[0],0-eye[1],12-eye[2]]).kind,'water');
const toGrass=W.lakesideRayHit(eye,[-6-eye[0],0.6-eye[1],28-eye[2]]);assert.equal(toGrass.kind,'walk');
assert.ok(Math.hypot(toGrass.at[0]+6,toGrass.at[2]-28)<0.5);

// 7. walk paths stay on land/deck; the far shore and the bridge are reachable over the boardwalk; the board water never
for(const t of [[-6,.6,28],[8,.6,26],[1.2,.6,30],[-15,.6,32],[0,deck,0]]){const p=W.lakesidePath(stop,t);assert.ok(p&&p.length>=2,'no path to '+t);
 for(let i=1;i<p.length;i++)assert.ok(W.lakesideLineWalkable(p[i-1],p[i]),'path leg over water '+t);
 assert.ok(Math.hypot(p[p.length-1][0]-t[0],p[p.length-1][2]-t[2])<0.6);}
const far=W.lakesidePath(stop,[0,deck,0]);assert.ok(far.some((q,i)=>i>0&&Math.abs(q[0]+13)<1.5&&Math.abs(far[i-1][0]+13)<1.5&&Math.abs(q[2]-far[i-1][2])>12),'far shore not reached via the boardwalk');
assert.equal(W.lakesidePath(stop,[0,0,12]),null,'walked onto the board water');

// 8. nearestWalkable (运镜bot snap): water → nearest shore/deck, exact hits report exact, nothing within radius → null
const s0=RW.nearestWalkable('lakeside',[stop[0],stop[1],stop[2]]);assert.ok(s0&&s0.exact&&s0.distanceM<.3);
const s1=RW.nearestWalkable('lakeside',[-13.6,0,12],2);assert.ok(s1&&!s1.exact&&RW.isWalkable('lakeside',s1.at[0],s1.at[2]),'snap off water onto the boardwalk');
assert.equal(RW.nearestWalkable('lakeside',[0,0,12],1),null,'board centre has no floor within 1 m');
const s2=RW.nearestWalkable('lakeside',[0,0,12],12);assert.ok(s2&&s2.distanceM<=12);

// 9. explore opens after a board exit (暂停 →「离开棋盘」) in meadow / skycity / lakeside, never during the arrival shot
assert.deepEqual([...X.EXIT_EXPLORE_REGIONS].sort(),['lakeside','meadow','skycity']);
for(const r of ['meadow','skycity','lakeside']){
 const arrived={state:r,hidden:false,needsResume:false,journey:{region:r,phase:'arrived'}};
 assert.equal(X.exploreWanted(r,arrived),true,r);
 assert.equal(X.exploreWanted(r,{...arrived,journey:{region:r,phase:'arrival'}}),false,r+' landing shot');
 assert.equal(X.exploreWanted(r,{...arrived,state:'level'}),false,r+' on the board');
 assert.equal(X.exploreWanted(r,{...arrived,needsResume:true}),false,r);
 assert.equal(X.exploreWanted(r,{...arrived,hidden:true}),false,r+' hidden (cutscene)');
 let armed=X.exploreArm(r,null,arrived,false);assert.equal(armed,false,r+' arrival must not arm');
 armed=X.exploreArm(r,r,{state:'level',journey:{region:r,phase:'arrived'}},armed);assert.equal(armed,true,r);
 armed=X.exploreArm(r,'level',arrived,armed);assert.equal(armed,true,r+' board exit keeps armed');
 assert.equal(X.exploreArm(r,r,{state:'island'},armed),false,r);
}
assert.equal(X.lakesideExploreWanted({state:'lakeside',hidden:false,needsResume:false,journey:{region:'lakeside',phase:'arrived'}}),true);

// 10. drag: a 10 pt move in explore is a drag, and the orbit turns under it
assert.equal(I.classifyPointers({uiHit:false,pointers:1,movedPt:40,heldS:.3,boardOpen:false,blending:false,explore:true}),'drag');
assert.equal(I.classifyPointers({uiHit:false,pointers:1,movedPt:2,heldS:.1,boardOpen:false,blending:false,explore:true}),'tap');
const orbit=new O.FreeOrbit('lakeside');
orbit.seed({position:[0,13.2,26.5+12],target:[stop[0],stop[1]+1,stop[2]],fovVerticalDeg:48},[stop[0],stop[1],stop[2]]);
const y0=orbit.yaw;orbit.drag(0.2,0);assert.ok(Math.abs(orbit.yaw-y0)>1e-3,'drag did not turn the lakeside orbit');

// 11. stage wiring (source)
const src=fs.readFileSync(path.join(SCRIPTS,'world-r2/RegionNodeStage.ts'),'utf8');
assert.match(src,/if\(this\.region==='lakeside'\)\{this\.groundTap\(x,y\);return;\}/);
assert.match(src,/if\(this\.region==='meadow'\|\|this\.region==='skycity'\)this\.groundTap\(x,y\)/);
assert.match(src,/update\(dt:number\)\{\n  this\.syncExplore\(dt\);/);
assert.match(src,/this\.openExplore\(r,true\)/);
assert.match(src,/region==='lakeside'\?undefined:stageGraph/);
assert.match(src,/LakesideJourneyScene/);
// pause label (b16 decision): 「离开棋盘」, same Home action
const bp=fs.readFileSync(path.join(SCRIPTS,'ui/BoardPanels.ts'),'utf8');
assert.match(bp,/p\.button\('secondary', '离开棋盘', 0, 700, 480, 96, \(\) => a\.home\(\)/);
assert.doesNotMatch(bp,/'回到小岛'/);
console.log('region-walkable ok cells',JSON.stringify(cells));
