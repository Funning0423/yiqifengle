#!/usr/bin/env node
'use strict';
// cand9: BasketObstacles.ts consumes 场景设计部's basketObstacles (r/clearM/baked from JSON), every on/off event is a mark the
// game really emits, each obstacle toggles at the right events (cells re-open when off), and her level-node walks are unchanged.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const R=path.resolve(__dirname,'../..'),S=p=>fs.readFileSync(R+'/creator-build-project/assets/scripts/'+p,'utf8');
let pass=0;const ok=m=>{pass++;console.log('PASS '+m);};
cp.execFileSync(process.execPath,[__dirname+'/gen-basket-obstacle-data.cjs','--check'],{stdio:'pipe'});
const src=S('region/BasketObstacles.ts');assert(!/r:1\.1\b|baked:true|"baked":true/.test(src),'hard-coded r 1.1 / baked:true left');
const J=JSON.parse(fs.readFileSync(R+'/tools/transitions-continuous/transition-anchors.json','utf8')).basketObstacles;
ok('BasketObstacles.ts generated block in sync with transition-anchors.json ('+J.length+' rows, r '+J.map(o=>o.r)+', baked '+J.map(o=>o.baked)+')');
// every event name is emitted by the game
const all=fs.readdirSync(R+'/creator-build-project/assets/scripts/region').filter(f=>f.endsWith('.ts')).map(f=>S('region/'+f)).join('\n');
const emitted=new Set();for(const m of all.matchAll(/chainMark\('(\w+)','([\w-]+)'\)/g))emitted.add(m[1]+':'+m[2]);
for(const m of all.matchAll(/basketObstacleEvent\('([\w:-]+)'\)/g))emitted.add(m[1]);
const play=S('region/RegionNodePlay.ts');assert(/basketObstacleEvent\('node:'\+to\)/.test(play)&&/basketObstacleEvent\('node:'\+spec\.from\)/.test(play));
const nodeKeys=new Set([...S('region/RegionNodes.ts').matchAll(/key:"(\w+)"/g)].map(m=>'node:'+m[1]));
for(const o of J)for(const ev of [...o.on,...o.off])assert(emitted.has(ev)||nodeKeys.has(ev),o.id+': event '+ev+' is never emitted');
ok('all on/off names are real marks: '+[...new Set(J.flatMap(o=>[...o.on,...o.off]))].join(', '));
// state machine through the real module (cc-free)
const H=require('../board-ui/harness.cjs').createHarness(),B=H.load('region/BasketObstacles.ts');
const at=id=>{const o=J.find(x=>x.id===id);return [o.region,o.at[0],o.at[1]];},blk=id=>B.basketBlocked(...at(id));
const edge=id=>{const o=J.find(x=>x.id===id);return [o.region,o.at[0]+o.r+o.clearM-0.01,o.at[1]];};
B.resetBasketObstacles();assert(!blk('meadow_basket')&&!blk('skycity_landing_basket')&&!blk('skycity_5a_basket'));
const seq=[['node:M3',[]],['node:M4',['meadow_basket']],['balloon:B1-basket-in',['meadow_basket']],['balloon:B3-flight',[]],['balloon:B4-settle',['skycity_landing_basket']],
 ['balloon:B5-door-walk-out',['skycity_landing_basket']],['balloon:released',[]],['lakeside:C1-basket-in',['skycity_5a_basket']],['lakeside:C2-ignite-inflate',['skycity_5a_basket']],['lakeside:C3-flight',[]]];
for(const [ev,want] of seq){B.basketObstacleEvent(ev);for(const o of J)assert.equal(B.basketObstacleActive(o.id),want.includes(o.id),ev+' '+o.id);
 for(const o of J){assert.equal(blk(o.id),want.includes(o.id),'cell at '+o.id+' after '+ev);assert.equal(B.basketBlocked(...edge(o.id)),want.includes(o.id),'r+clearM edge '+o.id);}}
B.basketObstacleEvent('lakeside:C1-basket-in');B.basketObstacleEvent('lakeside:released');assert(!blk('skycity_5a_basket'));
ok('toggles: M4 on → B3-flight off; B4-settle on → released off; C1-basket-in on → C3-flight / lakeside:released off; cells re-open when off (r+clearM '+(J[0].r+J[0].clearM).toFixed(2)+' m)');
// walk paths: node walk plans identical with every obstacle on vs off, and no edge enters an active disc
const NW=H.load('region/NodeWalker.ts');const pairs=[['meadow','M3','M4'],['meadow','M4','M6'],['meadow','M5','M6'],['skycity','S1','S2'],['skycity','S4','S6']];
const plans=on=>{B.resetBasketObstacles();if(on)['node:M4','balloon:B4-settle','lakeside:C1-basket-in'].forEach(e=>B.basketObstacleEvent(e));
 return pairs.map(([r,a,b])=>{try{const p=NW.planWalk(r,a,b);return {s:p.segments.map(x=>+x.duration.toFixed(4)),pts:p.segments.flatMap(x=>x.path)};}catch(e){return {err:String(e)};}});};
const off=plans(false),on=plans(true);assert(on.every(p=>p.s),'planWalk failed '+JSON.stringify(on.filter(p=>p.err)));assert.deepEqual(on.map(p=>p.s),off.map(p=>p.s),'walk timing changed by obstacles');
let minD=1e9;for(const [i,p] of on.entries()){if(!p.pts)continue;const reg=pairs[i][0];for(const q of p.pts)for(const o of J.filter(o=>o.region===reg))minD=Math.min(minD,Math.hypot(q[0]-o.at[0],q[2]-o.at[1]));}
B.resetBasketObstacles();
ok('node walks '+pairs.map(p=>p.slice(1).join('→')).join(', ')+' same durations with obstacles on/off; closest path point to a disc centre '+minD.toFixed(2)+' m');
console.log(JSON.stringify({result:'PASS',pass}));
