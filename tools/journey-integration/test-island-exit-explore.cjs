'use strict';
// b17r12 guard (Mac r11 #6/#7): island board exit (home → island → mainline-01 → 暂停 →「离开棋盘」) must open free explore and
// ground taps must walk. The real island snapshot carries journey {region:'island',phase:'idle'} (fresh RegionJourneyController),
// which r11's exploreWanted rejected (it only accepted 'arrived' / no phase), so the lens never moved and taps did nothing.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load}=require('../region-nodes/load.cjs');
const X=load('region/LakesideExplore.ts'),RW=load('region/RegionWalkable.ts');
const {createHarness}=require('../board-ui/harness.cjs');const H=createHarness();
const {RegionJourneyController}=H.load(path.resolve(__dirname,'../../creator-build-project/assets/scripts/world-r1/RegionJourneyCore.ts'));
const c=new RegionJourneyController({prepare:async()=>{throw new Error('no leg');},readCamera:()=>({position:[0,1,0],target:[0,0,1],fovVerticalDeg:45})});
const journey={...c.snapshot()};assert.equal(journey.region,'island');assert.equal(journey.phase,'idle');
const snap=state=>({state,hidden:false,needsResume:false,characterReady:true,journey});
// poll sequence as RegionNodeStage.syncExplore sees it
let prev=null,armed=false;
for(const st of ['home','island','level','level','island']){armed=X.exploreArm('island',prev,snap(st),armed);prev=st;}
assert.equal(armed,true,'island armed after its board');
assert.equal(X.exploreWanted('island',snap('island')),true,'explore opens on the island with an idle journey');
assert.equal(X.exploreWanted('island',{...snap('island'),journey:{...journey,phase:'arrived'}}),true,'came home');
assert.equal(X.exploreWanted('island',{...snap('island'),journey:{region:'meadow',phase:'approach'}}),false,'mid travel');
assert.equal(X.exploreWanted('island',{...snap('island'),journey:{region:'island',phase:'loading',target:'meadow'}}),false,'leaving');
// home → island (no board) never arms
{let p=null,a=false;for(const st of ['home','island','island']){a=X.exploreArm('island',p,snap(st),a);p=st;}assert.equal(a,false,'no arm without a board');}
// ground tap: RegionNodeStage routes island ground taps to groundTap, and a downward ray onto the island walks
const src=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/world-r2/RegionNodeStage.ts'),'utf8');
assert.match(src,/tap\.kind==='ground'\)\{if\([^)]*this\.region==='island'\)this\.groundTap/,'island ground tap wired');
assert.doesNotMatch(src,/groundTap\(x:number,y:number\)\{\s*const region=this\.region;if\(region==='island'\)return/,'no island early return');
let hit=null;outer:for(let x=-20;x<=20;x+=1)for(let z=-20;z<=20;z+=1){const h=RW.walkRayHit('island',[x,40,z],[0,-1,0]);if(h.kind==='walk'){hit=h.at;break outer;}}
assert.ok(hit,'a ray onto the island hits walkable ground');
const from=RW.nearestWalkable('island',hit,1.6);assert.ok(from,'girl start resolves');
let to=null;for(let dx=-6;dx<=6&&!to;dx+=1)for(let dz=-6;dz<=6&&!to;dz+=1){if(!dx&&!dz)continue;const h=RW.walkRayHit('island',[hit[0]+dx,40,hit[2]+dz],[0,-1,0]);if(h.kind==='walk'&&Math.hypot(dx,dz)>=3)to=h.at;}
assert.ok(to,'second walkable point');const p=RW.walkPath('island',from.at,to);assert.ok(p&&p.length>=2,'ground tap walk path');
console.log('PASS island-exit-explore (idle journey opens explore; ground tap walks '+RW.walkPathLengthM(p).toFixed(1)+' m)');
