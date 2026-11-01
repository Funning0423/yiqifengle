'use strict';
// Lakeside (风铃湖畔) gameplay data + chime rule in regional-session (lake region). Pure JS, no Cocos.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=path.resolve(__dirname,'../../creator-build-project/assets/scripts/regional-r05/runtime');
const S=require(R+'/regional-session.js'),L=require(R+'/lakeside-levels-data.js'),guide=require(R+'/rule-guide.js'),catalog=require(R+'/catalog-data.js');
const W=JSON.parse(fs.readFileSync(__dirname+'/calibration-report.json','utf8'));let n=0;const t=(m,f)=>{f();n++;console.log('PASS',m);};
t('6 levels, region lake, rules.chimes, tool null, no period fields',()=>{assert.equal(L.length,6);for(const l of L){assert.equal(l.region,'lake');assert(l.rules.chimes.length>0);assert.equal(l.tool,null);assert(!l.rules.phaseCycle&&!l.rules.windCycle&&!l.rules.polarityCycle);for(const c of l.rules.chimes)assert(Number.isInteger(c.index)&&c.index>=0&&c.index<49&&c.hits>0);}});
t('shipped catalog unchanged: lakeside is not in regional-r05 catalog',()=>{assert(!catalog.some(x=>x.region==='lake'));});
t('phase() falls back to calm without a period; guide renders lake text',()=>{const s=new S(L[0],L[0].seedBank[0]);assert.equal(s.phase(),'calm');const g=guide(s);assert.equal(g.goalName,'风铃');assert.equal(g.tool.kind,null);assert.equal(g.targets.length,2);assert.equal(s.snapshot().scene.phase,'calm');});
t('tool actions are rejected when the stage has no tool',()=>{const s=new S(L[0],L[0].seedBank[0]);assert.equal(s._valid(['tool',null,0]),false);assert.equal(s.act(['tool','tideAnchor',0]),false);});
t('chime rings once per wave from its cell or a 4-neighbour, completes at hits, goal counts open chimes',()=>{const s=new S(L[0],L[0].seedBank[0]),p=s.pieces[0];
 let r=s._regional({removed:[{index:p.index+1,type:0},{index:p.index-7,type:1}]});assert.equal(p.progress,1,'two neighbours in one wave = one ring');assert.equal(r.events[0].kind,'chime-rang');
 s._regional({removed:[{index:p.index+2,type:0}]});assert.equal(p.progress,1,'two cells away does not ring');
 s._regional({removed:[{index:p.index,type:0}]});s._regional({removed:[{index:p.index+7,type:0}]});/* b18: L13 chimes need 6 hits */for(let k=3;k<p.hits;k++){assert.equal(p.done,false);s._regional({removed:[{index:p.index+(k%2?1:7),type:0}]});}assert.equal(p.done,true);assert.equal(s.engine.goals.chimes,1);});
t('shipped seeds replay their greedy witnesses to a win within the draft moves',()=>{for(const l of L){const w=W.find(x=>x.id===l.id);assert.deepEqual(l.seedBank,w.seedBank);for(const x of w.witness){const s=new S(l,x.seed);for(const a of x.actions)assert(s.act(a),l.id+' '+JSON.stringify(a));assert.equal(s.engine.status,'won',l.id+' seed '+x.seed);assert(x.used<=l.config.moves);}}});
t('unshipped seed needs authoring mode',()=>{assert.throws(()=>new S(L[0],999999),/witness/);});
console.log(JSON.stringify({status:'PASS',cases:n}));
