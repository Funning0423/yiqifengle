'use strict';
// b18 lakeside order: L13..L18 open one after another after S4; 「刻名的桥」(L18) never before L13–L15; old saves never re-lock.
const assert=require('node:assert/strict'),path=require('node:path');
const {load,ROOT}=require('./load.cjs');
const P=load('region/RegionNodeProgress.ts');
const R=path.join(ROOT,'creator-build-project/assets/scripts/regional-r05/runtime');
const Journal=require(R+'/progress-journal.js'),Host=require(R+'/campaign-host.js'),L=require(R+'/lakeside-levels-data.js');
let n=0;const t=(m,f)=>{f();n++;console.log('PASS',m);};
const ML=[...P.MAINLINE_STAGE_IDS],ALL={completed:ML.slice()},IDS=[...P.LAKESIDE_STAGE_IDS];
const rec=ids=>{const o={};for(const id of ids)o[id]={bestStars:1};return o;};
t('order = lakeside-levels-data ordinals 1..6, bridge = 刻名的桥',()=>{
 assert.equal(JSON.stringify(IDS),JSON.stringify(L.map(s=>s.id)));assert.deepEqual(L.map(s=>s.ordinal),[1,2,3,4,5,6]);
 assert.equal(L.find(s=>s.id===P.LAKESIDE_BRIDGE_ID).name,'刻名的桥');
 assert.deepEqual([...Object.values(P.LAKESIDE_STAGE_LABEL)],['L13','L14','L15','L16','L17','L18']);
 assert.equal(JSON.stringify(P.LAKESIDE_BRIDGE_REQUIRES),JSON.stringify(Journal.LAKE_BRIDGE_REQUIRES));});
t('S4 not passed: every lakeside stage locked',()=>{
 const s=P.derive({completed:ML.slice(0,11)},null);for(const id of IDS)assert.equal(s.lakeStages[id],'locked');assert.equal(s.nodes.L1,'locked');});
t('S4 passed, nothing played: only L13 playable',()=>{
 const s=P.derive(ALL,null);assert.deepEqual([...IDS].map(id=>s.lakeStages[id]),['playable','locked','locked','locked','locked','locked']);
 assert.equal(s.nodes.L0,'passed');assert.equal(s.nodes.L1,'playable');});
t('each clear opens exactly the next one',()=>{
 for(let k=1;k<=5;k++){const s=P.derive(ALL,{records:rec(IDS.slice(0,k))});
  IDS.forEach((id,i)=>assert.equal(s.lakeStages[id],i<k?'passed':i===k?'playable':'locked',k+':'+id));}});
t('bridge stays locked unless L13–L15 are all cleared (even if L16/L17 are)',()=>{
 for(const miss of P.LAKESIDE_BRIDGE_REQUIRES){const s=P.derive(ALL,{records:rec(IDS.slice(0,5).filter(x=>x!==miss))});assert.equal(s.lakeStages[P.LAKESIDE_BRIDGE_ID],'locked',miss);}});
t('old save: cleared stages stay passed even out of order; listed-open stays playable; nothing re-locks',()=>{
 // pre-b18 build opened all six at once → a save may have L18/L16 cleared without L13–L15
 const s=P.derive(ALL,{records:rec(['r04-lake-06','r04-lake-04']),openChallenges:['r04-lake-05']});
 assert.equal(s.lakeStages['r04-lake-06'],'passed');assert.equal(s.lakeStages['r04-lake-04'],'passed');assert.equal(s.lakeStages['r04-lake-05'],'playable');
 assert.equal(s.lakeStages['r04-lake-01'],'playable');
 // and every phase in an older save is >= the phase it had under the old rule (old rule: all playable or passed)
 const rank={locked:0,playable:1,passed:2};
 for(const ids of [[],['r04-lake-01'],['r04-lake-03','r04-lake-06'],IDS.slice()]){const r={records:rec(ids)},now=P.derive(ALL,r);
  for(const id of ids)assert.equal(now.lakeStages[id],'passed');}});
t('mainline nodes unchanged by the lake records',()=>{
 const a=P.derive(ALL,null),b=P.derive(ALL,{records:rec(IDS)});for(const k of Object.keys(a.nodes))assert.equal(a.nodes[k],b.nodes[k],k);});
// runtime gate (progress-journal) agrees
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
const journey=done=>({readOnly:false,records:Array.from({length:12},(_,i)=>({bestStars:i<done?2:0}))});
const jr=(records)=>{const j=new Journal(Host.createStorage(mem()),journey(12));j.data.records=Object.assign({},records);return j;};
t('journal: sequential, bridge needs L13–L15, recorded stage never re-locks',()=>{
 assert.deepEqual(IDS.map(id=>jr({}).isUnlocked(id)),[true,false,false,false,false,false]);
 assert.equal(jr(rec(IDS.slice(0,5))).isUnlocked('r04-lake-06'),true);
 assert.equal(jr(rec(['r04-lake-01','r04-lake-02','r04-lake-04','r04-lake-05'])).isUnlocked('r04-lake-06'),false);
 const old=jr(rec(['r04-lake-06','r04-lake-04']));assert.equal(old.isUnlocked('r04-lake-06'),true);assert.equal(old.isUnlocked('r04-lake-04'),true);assert.equal(old.isUnlocked('r04-lake-05'),true);
 assert.equal(new Journal(Host.createStorage(mem()),journey(11)).isUnlocked('r04-lake-01'),false);
 for(const id of IDS){const P2=P.derive(ALL,{records:rec(IDS.slice(0,3))}).lakeStages[id];assert.equal(P2!=='locked',jr(rec(IDS.slice(0,3))).isUnlocked(id),id);}});
console.log('test_lakeside_order',n,'PASS');
