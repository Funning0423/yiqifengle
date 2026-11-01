'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,ROOT}=require('./load.cjs');
const P=load('region/RegionNodeProgress.ts');
const main=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/world-r2/PersistentMainlinePort.ts'),'utf8');
const r5=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/world-r2/PersistentR5Port.ts'),'utf8');
const keys=src=>JSON.parse(src.match(/_KEYS=(\[[^\]]+\])/)[1].replace(/'/g,'"'));
assert.equal(JSON.stringify(P.PROGRESS_KEYS),JSON.stringify(keys(main)));
assert.equal(JSON.stringify(P.R5_PROGRESS_KEYS),JSON.stringify(keys(r5)));
assert.equal(P.REGION_NODES_KEY,'forest-r5-region-nodes-v1');
assert.ok(!P.forbiddenProgressKeys().includes(P.REGION_NODES_KEY));
const samples=[
 ['empty',{completed:[]},null],
 ['island-mid',{completed:['mainline-01','mainline-02']},null],
 ['just-04',{completed:['mainline-01','mainline-02','mainline-03','mainline-04']},null],
 ['meadow-mid',{completed:['mainline-01','mainline-02','mainline-03','mainline-04','mainline-05','mainline-06']},null],
 ['just-08',{completed:['mainline-01','mainline-02','mainline-03','mainline-04','mainline-05','mainline-06','mainline-07','mainline-08']},null],
 ['all-12',{completed:P.MAINLINE_STAGE_IDS.slice()},null],
 ['only-05',{completed:['mainline-01','mainline-02','mainline-03','mainline-04','mainline-05']},{records:{'r05-meadow-01':{stars:1}}}],
 ['sky-10',{completed:P.MAINLINE_STAGE_IDS.slice(0,10)},null],
 ['island-01',{completed:['mainline-01']},null],
 ['corrupt-view',{completed:null},null],
 ['extra-id',{completed:['mainline-01','not-a-stage']},null],
 ['meadow-open',{completed:['mainline-01','mainline-02','mainline-03','mainline-04']},{openChallenges:['challenge-meadow']}],
 ['sky-open',{completed:P.MAINLINE_STAGE_IDS.slice(0,8)},{records:{'r05-sky-01':{}}}],
 ['nulls',null,null],
];
assert.ok(samples.length>=12);
for(const [name,mainline,r5view] of samples){
 const s=P.derive(mainline,r5view);
 assert.equal(typeof s.explore.island,'boolean',name);
 const written=[];
 const raw=name==='corrupt-view'?'{not json':name==='empty'?null:JSON.stringify({v:1,lastNode:{island:'I2'},exploreHintSeen:[true,false,false]});
 const pres=P.readPresentation(name==='island-mid'?JSON.stringify({v:9}):raw,s);
 P.savePresentation(pres,(k,v)=>{assert.equal(P.presentationTouchesProgress(k),false);written.push(k);assert.equal(k,P.REGION_NODES_KEY);});
 assert.deepEqual(written,[P.REGION_NODES_KEY]);
}
const mid=P.derive({completed:['mainline-01','mainline-02']},null);
assert.equal(mid.nodes.I2,'passed');assert.equal(mid.nodes.I3,'playable');assert.equal(mid.nodes.I4,'locked');
assert.equal(mid.explore.island,false);
const done4=P.derive({completed:['mainline-01','mainline-02','mainline-03','mainline-04']},null);
assert.equal(done4.explore.island,true);assert.equal(done4.nodes.M1,'playable');assert.equal(done4.nodes.I6,'playable');
assert.equal(done4.lastPassed.island,'I4');
const all=P.derive({completed:P.MAINLINE_STAGE_IDS.slice()},null);
assert.equal(all.explore.skycity,true);assert.equal(all.nodes.S4,'passed');assert.equal(all.nodes.S6,'playable');
const corrupt=P.readPresentation('{"v":1,"nope":1}',mid);
assert.equal(corrupt.lastNode.island,'I2');
const pair=P.walkPair('mainline-04','mainline-05');
assert.equal(pair.to,'I6');assert.equal(pair.departure,true);
assert.equal(JSON.stringify(Array.from(P.MAINLINE_STAGE_IDS)),JSON.stringify(['mainline-01','mainline-02','mainline-03','mainline-04','mainline-05','mainline-06','mainline-07','mainline-08','mainline-09','mainline-10','mainline-11','mainline-12']));
console.log('region-nodes-progress PASS',samples.length);
