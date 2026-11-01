'use strict';
// b17r16c guard: lakeside board exit (journey region 'lakeside', phase 'arrived' → level → 离开棋盘) opens free explore,
// the stage routes lakeside ground taps to groundTap (ensureCharacter, not island-only), and taps walk between lakeside nodes
// (jetty / arch bridge included in the node graph). Pure: LakesideExplore + RegionWalkable + source wiring.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load}=require('../region-nodes/load.cjs');
const X=load('region/LakesideExplore.ts'),RW=load('region/RegionWalkable.ts');
const journey={region:'lakeside',phase:'arrived'};
const snap=state=>({state,hidden:false,needsResume:false,characterReady:true,journey});
let prev=null,armed=false;for(const st of ['lakeside','level','level','lakeside']){armed=X.exploreArm('lakeside',prev,snap(st),armed);prev=st;}
assert.equal(armed,true,'lakeside armed after its board');
assert.equal(X.exploreWanted('lakeside',snap('lakeside')),true,'explore opens at the lakeside');
assert.equal(X.exploreTarget(snap('lakeside'),{lakeside:true}),'lakeside','exploreTarget picks lakeside');
assert.equal(X.exploreWanted('lakeside',{...snap('lakeside'),journey:{region:'lakeside',phase:'landing'}}),false,'not mid landing');
{let p=null,a=false;for(const st of ['lakeside','lakeside']){a=X.exploreArm('lakeside',p,snap(st),a);p=st;}assert.equal(a,false,'arrival alone never arms');}
const src=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/world-r2/RegionNodeStage.ts'),'utf8');
assert.match(src,/if\(this\.region==='lakeside'\)\{this\.groundTap\(x,y\);return;\}/,'lakeside taps route to groundTap (jetty / arch bridge walkability: lakeside-walkable test)');
const gt=src.slice(src.indexOf('groundTap(x:number,y:number)'),src.indexOf('private syncExplore('));
assert.doesNotMatch(gt,/region==='lakeside'\)return/,'no lakeside early return');assert.match(gt,/this\.ensureCharacter\(\)/,'ground tap binds the girl');
const g=X.stageGraph('lakeside');assert.ok(g.nodes.length>=2,'lakeside nodes');
let walks=0,checked=0;const fails=[];
for(let i=0;i<g.nodes.length;i++)for(let k=i+1;k<g.nodes.length;k++){const a=RW.nearestWalkable('lakeside',g.nodes[i].at,2.5),b=RW.nearestWalkable('lakeside',g.nodes[k].at,2.5);checked++;
 if(!a||!b){fails.push(g.nodes[i].key+'>'+g.nodes[k].key+' (no walkable)');continue;}const p=RW.walkPath('lakeside',a.at,b.at);if(p&&p.length>=2)walks++;else fails.push(g.nodes[i].key+'>'+g.nodes[k].key);}
console.log('lakeside node pairs',checked,'walkable',walks,fails.length?'unreached: '+fails.join(', '):'');
assert.ok(walks>=g.nodes.length-1,'ground taps walk across the lakeside graph');
console.log('PASS lakeside-exit-explore (arrived journey opens explore; '+walks+'/'+checked+' node pairs walk)');
