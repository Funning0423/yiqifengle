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
// b17r12b (Mac r12 #6/#7): fresh save leaves the board before any reward walk, so bindCharacter was never called (hasChar=false)
// and syncExplore / ground tap returned on !this.character. The stage must pull the composition's calibrated girl.
{const comp=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/world-r2/WorldNativeComposition.ts'),'utf8');
 assert.match(src,/characterSource:\(\(\)=>CharacterAdapter\|null\)\|null/,'stage has a character source');
 assert.match(src,/ensureCharacter\(\):CharacterAdapter\|null\{if\(!this\.character&&this\.characterSource\)/,'ensureCharacter pulls the girl');
 const sync=src.slice(src.indexOf('private syncExplore('),src.indexOf('private skipWalk('));
 assert.doesNotMatch(sync,/!this\.character\b/,'syncExplore must not bail on an unbound character');assert.match(sync,/!this\.ensureCharacter\(\)/,'syncExplore binds then proceeds');
 const gt=src.slice(src.indexOf('groundTap(x:number,y:number)'),src.indexOf('private syncExplore('));
 assert.doesNotMatch(gt,/!this\.character\)|!this\.character\|\|/,'ground tap must not bail on an unbound character');
 assert.match(comp,/stage\.attach\(this\.worldCamera\);\s*stage\.characterSource=\(\)=>this\.boundCharacter;/,'composition wires the source at stage creation');
 assert.match(comp,/attachCalibratedCharacter\(adapter:CharacterAdapter\)\{[^\n]*this\.boundCharacter=adapter;[^\n]*ensureCharacter\(\)/,'calibration binds the stage');
 // behavioural: emulate syncExplore guard with a fresh-save stage (character never bound)
 const girl={id:'girl'};const stage={character:null,characterSource:()=>girl,ensureCharacter(){if(!this.character&&this.characterSource)this.character=this.characterSource()||null;return this.character;}};
 assert.equal(stage.ensureCharacter(),girl,'character bound on leave-board');assert.equal(stage.character,girl,'hasChar=true');}
let hit=null;outer:for(let x=-20;x<=20;x+=1)for(let z=-20;z<=20;z+=1){const h=RW.walkRayHit('island',[x,40,z],[0,-1,0]);if(h.kind==='walk'){hit=h.at;break outer;}}
assert.ok(hit,'a ray onto the island hits walkable ground');
const from=RW.nearestWalkable('island',hit,1.6);assert.ok(from,'girl start resolves');
let to=null;for(let dx=-6;dx<=6&&!to;dx+=1)for(let dz=-6;dz<=6&&!to;dz+=1){if(!dx&&!dz)continue;const h=RW.walkRayHit('island',[hit[0]+dx,40,hit[2]+dz],[0,-1,0]);if(h.kind==='walk'&&Math.hypot(dx,dz)>=3)to=h.at;}
assert.ok(to,'second walkable point');const p=RW.walkPath('island',from.at,to);assert.ok(p&&p.length>=2,'ground tap walk path');
console.log('PASS island-exit-explore (idle journey opens explore; ground tap walks '+RW.walkPathLengthM(p).toFixed(1)+' m)');
