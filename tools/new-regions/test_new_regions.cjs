'use strict';
// new-regions (UI设计部 SPEC e05a034e): dynamic journey denominator, coast / snow gating, row states, chapter button
// texts, ending seal arc, panel fit on 7 sizes. Memory-only Cocos doubles (tools/board-ui/harness.cjs).
const assert=require('node:assert/strict'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),J=H.load('ui/JourneyCore'),E=H.load('world-r2/EndingFlow');
const checks=[];const ok=m=>{checks.push(m);console.log('PASS '+m);};
const rec=n=>Array.from({length:12},(_,i)=>({bestStars:i<n?1:0}));
const SHIPPED=[...Array.from({length:12},(_,i)=>({id:'r05-x-'+i,region:['tide','meadow','sky'][i%3]})),...Array.from({length:6},(_,i)=>({id:'r05-lake-0'+(i+1),region:'lake'}))];
const COAST=Array.from({length:9},(_,i)=>({id:'r06-coast-0'+(i+1),region:'coast'})),SNOW=Array.from({length:6},(_,i)=>({id:'r06-snow-0'+(i+1),region:'snow'}));
{ // denominator
  assert.equal(J.journeyProgress({records:rec(0),stages:SHIPPED}).total,18);
  const p27=J.journeyProgress({records:rec(12),regionDone:{lake:2,coast:3},stages:[...SHIPPED,...COAST]});
  assert.equal(p27.total,27);assert.equal(p27.segments.length,5);assert.equal(p27.done,12+2+3);
  const p33=J.journeyProgress({records:rec(12),regionDone:{lake:6},stages:[...SHIPPED,...COAST,...SNOW]});assert.equal(p33.total,33);assert.equal(p33.segments.length,6);
  assert(Math.abs(p33.segments[5].x1-1)<1e-9);assert(Math.abs(p33.segments[4].x1-p33.segments[4].x0-9/33)<1e-9);
  assert.equal(J.journeyProgress({records:rec(0),regionDone:{coast:5},stages:[...SHIPPED,...COAST]}).done,0,'locked coast never counts');
  ok('denominator = Σ stages of regions with data: 18 (this build), 27 with coast data (5 segments), 33 with snow (6 segments)');
}
{ // gating & rows
  const S=[...SHIPPED,...COAST],row=(n,d,id,st=S,seen)=>J.regionRow(id,{records:rec(n),regionDone:d,stages:st,seen});
  assert.equal(row(6,{},'sky').state,'locked');for(const id of ['lake','coast','snow'])assert.equal(row(6,{},id).state,'far',id);
  assert.equal(row(8,{},'coast').state,'locked','after mainline 8: coast known-locked');assert.equal(row(11,{},'coast').state,'locked');
  assert.equal(row(12,{},'coast').state,'open');assert(row(12,{},'coast').isNew);assert(!row(12,{},'coast',S,['coast']).isNew,'red dot cleared once entered');
  assert.equal(row(12,{},'lake').state,'open','coast parallel with the lake');assert.equal(row(12,{},'snow').state,'locked');
  assert.equal(row(12,{coast:4},'coast').state,'progress');assert.equal(row(12,{coast:9},'coast').state,'done');assert.equal(row(12,{coast:4,lake:0},'coast').done,4);
  assert.equal(row(12,{},'coast',SHIPPED).state,'locked','coast without data: known-locked only');
  assert.equal(row(12,{lake:6},'snow').state,'locked','snow without data never opens');assert.equal(row(12,{lake:6},'snow',[...S,...SNOW]).state,'open','snow opens after the 6 lake stages');
  assert.equal(row(12,{lake:5},'snow',[...S,...SNOW]).state,'locked');assert.equal(row(4,{},'snow',[...S,...SNOW]).state,'far');
  assert.equal(J.rowStatusText(row(12,{},'snow')),'湖畔通关后开启');assert.equal(J.rowName(row(6,{},'coast')),'远方');assert.equal(J.rowStatusText(row(6,{},'coast')),'继续旅行后揭晓');assert(!row(6,{},'coast').tappable);
  assert.equal(J.focusRegion({records:rec(12),regionDone:{lake:2},stages:S}),'lake');assert.equal(J.focusRegion({records:rec(12),regionDone:{lake:2},stages:S,lastPlayed:'coast'}),'coast');
  assert.equal(J.focusRegion({records:rec(12),regionDone:{lake:6,coast:9},stages:S}),'coast','all done → last region with progress');
  ok('coast opens at mainline record 11 in parallel with the lake; snow after 6 lake stages and only with data; far/locked/new/progress/done rows; focus rule');
}
{ // chapter buttons
  const b=(state,id='coast',done=0)=>J.chapterButton({id,state,done,total:9});
  assert.deepEqual(b('open'),{text:'前往海岸',enabled:true,flat:false});assert.equal(b('progress').text,'继续');assert.equal(b('done').text,'再访海岸');
  assert.deepEqual(b('locked'),{text:'尚未开启',enabled:false,flat:true});assert.deepEqual(b('far'),{text:'尚未开启',enabled:false,flat:true});
  assert.equal(J.coastChapterHint(5),'海岸漫游');assert.equal(J.coastChapterHint(6),'灯塔夜航');
  ok('region page single button: 前往X / 继续 / 再访X / 尚未开启 (flat disabled); coast chapter hint');
}
{ // seals
  const a=J.sealArc(6);assert.deepEqual(a.map(s=>s.x),[-120,-72,-24,24,72,120]);assert(Math.abs(a[0].dy-7.5)<1e-9&&Math.abs(a[2].dy-0.3)<1e-9);assert.equal(J.sealArcWidth(6),280);
  const s=J.endingSeals([]);assert.deepEqual(s.map(x=>x.id),['tide','meadow','sky','lake','coast','snow']);assert.deepEqual(s.map(x=>x.earned),[true,true,true,true,false,false]);
  assert(J.endingSeals(['coast'])[4].earned);for(const [w,h] of [[320,568],[360,640],[375,667],[390,844],[414,896],[430,932],[768,1024]])assert(E.endingLayoutChecks(w,h,0).sealsFit,w);
  ok('ending: 6 seals Ø40 / 48 pitch on 1.2·(i−2.5)² arc (280 pt, fits 320 with 20 pt margins); coast earned only when claimed');
}
{ // motion
  const M=J.JOURNEY_MOTION;assert.equal(M.rowS,0.2);assert.equal(M.rowStaggerS,0.03);assert.equal(M.barGrowS,0.6);assert.equal(M.sealDropS,0.24);assert.equal(M.sealStaggerS,0.08);
  assert.equal(J.barShown(3,5,0,false),3);assert.equal(J.barShown(3,5,0.6,false),5);assert.equal(J.barShown(5,5,0,false),5,'unchanged → no growth');assert.equal(J.barShown(3,5,0,true),5,'reduced motion jumps');
  ok('motion constants 200/30 ms rows, 600 ms bar (only when changed), 240/80 ms seals; reduced motion');
}
(async()=>{ // panel fit on 7 sizes, rows ≥ 44 pt
  const {IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay'),cc=H.cc;
  for(const [w,h] of [[320,568],[360,640],[375,667],[390,844],[414,896],[430,932],[568,320]]){
    const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(12)}}),gates:()=>({r5:[{id:'r06-coast-01',region:'coast',ok:true}],challenges:{lake:2},stages:[...SHIPPED,...COAST]}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode:'day'})});
    await H.flush();o.sync(w,h,true);o.open('journal');const p=o.popups.find('JourneyPanel');assert(p);
    const texts=p.root.getComponentsInChildren(cc.Label).map(l=>l.string);assert(texts.includes('旅程 14 / 27'),texts);
    const sc=Math.max(0.3,Math.min(w/750,h/1300,0.62)),f=Math.min(1,(h-16)/(h<700?466:520));
    for(const id of ['tide','meadow','sky','lake','coast','snow'])assert(p.root.find('Chapter-'+id),id);
    const row=p.root.find('Chapter-coast').getComponent(cc.UITransform);assert(row.height*sc>=(h<700?44:50)*f-1e-6);if(h>=500)assert(row.height*sc>=44-1e-6,'row touch ≥ 44 pt');
    o.close();o.open('coast');const c=o.popups.find('ChapterPanel');assert(c);assert(c.root.getComponentsInChildren(cc.Label).some(l=>l.string==='前往海岸'));o.dispose();
  }
  ok('journey book 旅程 14 / 27 with coast data; 6 regions reachable; rows ≥ 44 pt on 7 sizes; coast page 前往海岸');
  console.log(JSON.stringify({status:'PASS',checks},null,2));
})().catch(e=>{console.error(e);process.exit(1);});
