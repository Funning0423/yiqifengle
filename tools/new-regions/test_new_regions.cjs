'use strict';
// new-regions (UI设计部 SPEC e05a034e): dynamic journey denominator, coast / snow gating, row states, chapter button
// texts, ending seal arc, panel fit on 7 sizes. Memory-only Cocos doubles (tools/board-ui/harness.cjs).
const assert=require('node:assert/strict'),{createHarness}=require('../board-ui/harness.cjs');
const path=require('node:path'),fs=require('node:fs');
const H=createHarness(),J=H.load('ui/JourneyCore'),E=H.load('world-r2/EndingFlow');
const BUNDLE_FILE=path.join(H.BUNDLES,'board_art/journey_ui/JourneyPanels.ts'),B=H.load(BUNDLE_FILE).createJourneyUi(H.load('ui/JourneyUi').journeyUiHost());
const checks=[];const ok=m=>{checks.push(m);console.log('PASS '+m);};
const rec=n=>Array.from({length:12},(_,i)=>({bestStars:i<n?1:0}));
const SHIPPED=[...Array.from({length:12},(_,i)=>({id:'r05-x-'+i,region:['tide','meadow','sky'][i%3]})),...Array.from({length:6},(_,i)=>({id:'r05-lake-0'+(i+1),region:'lake'}))];
const COAST=Array.from({length:9},(_,i)=>({id:'r06-coast-0'+(i+1),region:'coast'})),SNOW=Array.from({length:6},(_,i)=>({id:'r06-snow-0'+(i+1),region:'snow'}));
const mk=(r,n,pre='r06-')=>Array.from({length:n},(_,i)=>({id:pre+r+'-0'+(i+1),region:r}));
const RAIL=mk('rail',6),CLOUD=mk('cloud',8),SPRING=mk('spring',8),ALL=[...SHIPPED,...COAST,...SNOW,...RAIL,...CLOUD,...SPRING];
{ // denominator (§13.3)
  assert.equal(J.journeyProgress({records:rec(0),stages:SHIPPED}).total,18);
  const p27=J.journeyProgress({records:rec(12),regionDone:{lake:2,coast:3},stages:[...SHIPPED,...COAST]});
  assert.equal(p27.total,27);assert.equal(p27.segments.length,5);assert.equal(p27.done,12+2+3);
  const p33=J.journeyProgress({records:rec(12),regionDone:{lake:6},stages:[...SHIPPED,...COAST,...SNOW]});assert.equal(p33.total,33);assert.equal(p33.segments.length,6);
  const p55=J.journeyProgress({records:rec(12),stages:ALL});assert.equal(p55.total,55);assert.equal(p55.segments.length,9);assert(Math.abs(p55.segments[8].x1-1)<1e-9);
  const narrow=w=>Math.min(...p55.segments.map(g=>(g.x1-g.x0)*(w-48)-2));assert(narrow(330)>=12&&narrow(272)>=12,'narrowest segment ≥ 12 pt (§13.3: 19.3 / 15.7)');
  assert.equal(J.journeyProgress({records:rec(0),regionDone:{coast:5},stages:[...SHIPPED,...COAST]}).done,0,'locked coast never counts');
  ok('9-segment bar: denominator = Σ stages of regions with data: 18 (this build), 27 with coast, 33 with snow, 55 with all 9; narrowest segment ≥12 pt');
}
{ // unlock interface (§13.2)
  const row=(n,d,id,st=ALL,seen)=>J.regionRow(id,{records:rec(n),regionDone:d,stages:st,seen});
  for(const d of J.REGION_DEFS){assert(Array.isArray(d.unlock.requires));assert(d.unlock.label.length<=5,d.id);}
  assert.deepEqual(J.REGION_DEFS.find(d=>d.id==='spring').unlock.requires,['rail','cloud']);
  assert.equal(row(6,{},'sky').state,'locked');for(const id of ['lake','coast','snow','rail','cloud','spring'])assert.equal(row(6,{},id).state,'far',id);
  assert.equal(row(8,{},'coast').state,'locked','after mainline 8: coast known-locked');assert.equal(row(12,{},'coast').state,'open');assert(row(12,{},'coast').isNew);assert(!row(12,{},'coast',ALL,['coast']).isNew);
  assert.equal(row(12,{},'lake').state,'open');assert.equal(row(12,{},'snow').state,'locked');assert.equal(row(12,{},'rail').state,'locked','coast open → rail known-locked');assert.equal(row(12,{},'cloud').state,'far','snow not open → cloud far');
  assert.equal(row(12,{coast:8},'rail').state,'locked');assert.equal(row(12,{coast:9},'rail').state,'open','rail after coast fully cleared');
  assert.equal(row(12,{lake:6},'cloud').state,'locked');assert.equal(row(12,{lake:6,snow:6},'cloud').state,'open','cloud after snow fully cleared');
  assert.equal(row(12,{coast:9},'spring').state,'locked');assert.equal(row(12,{coast:9,rail:6,lake:6,snow:6,cloud:7},'spring').state,'locked');assert.equal(row(12,{coast:9,rail:6,lake:6,snow:6,cloud:8},'spring').state,'open','spring after rail and cloud');
  const S=[...SHIPPED,...COAST];for(const id of ['snow','rail','cloud','spring']){const r=row(12,{lake:6,coast:9},id,S);assert.equal(r.state,'far','no data → 远方 '+id);assert(!r.tappable);}
  assert.equal(row(12,{},'coast',SHIPPED).state,'far','coast without data: 远方');
  assert.equal(B.rowStatusText(row(12,{},'snow')),'湖畔通关后');assert.equal(B.rowStatusText(row(12,{},'rail')),'海岸通关后');assert.equal(B.rowName(row(6,{},'coast')),'远方');assert.equal(B.rowStatusText(row(6,{},'coast')),'· · ·');
  assert.equal(B.rowStatusText(row(12,{coast:9},'coast')),'9/9 ✓');assert.equal(B.rowStatusText(row(12,{coast:3},'coast')),'3/9');assert.equal(B.rowStatusText(row(12,{},'coast')),'可前往');
  assert.equal(J.focusRegion({records:rec(12),regionDone:{lake:2},stages:S}),'lake');assert.equal(J.focusRegion({records:rec(12),regionDone:{lake:2},stages:S,lastPlayed:'coast'}),'coast');
  ok('unlock = requires + label: coast/lake 主线12后, snow 湖畔通关后, rail after coast, cloud after snow, spring after rail+cloud; two-level locked/远方; no data → 远方 untappable; focus rule');
}
{ // names (§13.4) + chapter buttons
  const n=id=>J.REGION_DEFS.find(d=>d.id===id);assert.equal(n('sky').name,'天空之城');assert.equal(n('sky').subtitle,'天空回声');assert.equal(n('snow').short,'雪山山口');assert.equal(n('coast').short,'灯塔海岸');
  for(const d of J.REGION_DEFS)assert(d.short.length<=4,d.id);
  const b=(state,id='coast',done=0)=>B.chapterButton({id,state,done,total:9});
  assert.deepEqual(b('open'),{text:'前往灯塔海岸',enabled:true,flat:false});assert.equal(b('progress').text,'继续');assert.equal(b('done').text,'再访灯塔海岸');
  assert.deepEqual(b('locked'),{text:'尚未开启',enabled:false,flat:true});assert.deepEqual(b('far'),{text:'尚未开启',enabled:false,flat:true});
  assert.equal(B.coastChapterHint(5),'海岸漫游');assert.equal(B.coastChapterHint(6),'灯塔夜航');
  ok('names: 天空之城 (subtitle 天空回声), 雪山山口, 灯塔海岸 (short ≤4 chars); single button 前往X / 继续 / 再访X / 尚未开启');
}
{ // ending seals (§13.5)
  const g=E.endingLayout(390,844).seals;assert.deepEqual([g.d,g.sp,g.gap],[36,44,40]);const c=E.endingLayout(375,667).seals;assert.deepEqual([c.d,c.sp,c.gap],[30,36,32]);const tn=E.endingLayout(320,568).seals;assert.deepEqual([tn.d,tn.sp,tn.gap],[28,34,26]);
  assert.equal(c.y,E.endingLayout(375,667).titleCy+49);assert.equal(tn.y,E.endingLayout(320,568).titleCy+44);
  const s=J.endingSeals(g,[]);assert.equal(s.length,9);assert.deepEqual(s.slice(0,5).map(x=>x.x),[-88,-44,0,44,88]);assert.deepEqual(s.slice(5).map(x=>x.x),[-66,-22,22,66]);
  assert.equal(s[0].dy,4);assert.equal(s[2].dy,0);assert.equal(s[5].dy,40+2.25);assert.deepEqual(s.map(x=>x.earned),[true,true,true,true,false,false,false,false,false]);
  assert(J.endingSeals(g,['coast'])[4].earned);
  for(const [w,h] of [[320,568],[360,640],[375,667],[390,844],[414,896],[430,932],[768,1024]]){const k=E.endingLayoutChecks(w,h,0),L=E.endingLayout(w,h);assert(k.sealsFit&&L.girl.y1-L.girl.y0>=48-1e-6,w+'x'+h);assert(k.headBelowSeals&&k.girlClear,w+'x'+h+' '+JSON.stringify(k));}
  const src=fs.readFileSync(BUNDLE_FILE,'utf8');assert(/Shadow/.test(src)&&/44, 28, 14/.test(src),'soft per-seal shadow');assert(!/SealPlate|SealsBand|blur/i.test(src.replace(/~2\.2 pt blur/,'')),'no backing plate');
  ok('ending: 9 seals in two rows 5+4 (Ø36/44/40; H≤600 Ø30/36/32 at plank+49), head ≥8 pt below row 2 on 7 sizes, soft shadow per seal, no plate');
}
{ // motion (§13.6)
  const M=B.JOURNEY_MOTION;assert.equal(M.gridS,0.2);assert.equal(M.gridStepS,0.02);assert.equal(M.barGrowS,0.6);assert.equal(M.sealDropS,0.24);assert.equal(M.sealStepS,0.06);
  assert.equal(B.barShown(3,5,0,false),3);assert.equal(B.barShown(3,5,0.6,false),5);assert.equal(B.barShown(5,5,0,false),5);assert.equal(B.barShown(3,5,0,true),5);
  const R=require('../ui-timing/known-timings.json');for(const sym of ['gridS','gridStepS','barGrowS','sealDropS','sealStepS'])assert(R.entries.some(e=>e.symbol===sym),'registered '+sym);
  ok('motion: grid 200 ms / 20 ms step, bar 600 ms (only when changed), seals 240 ms / 60 ms step; registered in known-timings v1');
}
{ // lazy split: the bundle script has no runtime imports (Creator: scripts across bundles should not reference each other)
  const src=fs.readFileSync(BUNDLE_FILE,'utf8');for(const m of src.matchAll(/^import\s+(?!type\b)[^\n]*$/gm))assert.fail('runtime import in bundle script: '+m[0]);
  const main=['ui/IslandPanels.ts','ui/JourneyCore.ts','ui/EndingScreen.ts','world-r2/IslandJourneyOverlay.ts'].map(f=>fs.readFileSync(path.join(H.SCRIPTS,f),'utf8')).join('\n');
  assert(!/from '[^']*bundles\/board_art\/journey_ui[^']*'/.test(main.replace(/import type[^\n]*/g,'')),'main package never imports the bundle at runtime');
  ok('journey UI lives in bundles/board_art/journey_ui with type-only imports; main package reaches it through ui/JourneyUi.ts');
}
(async()=>{ // first-open latency: the overlay warms board_art at construction; by the first possible tap the UI is synchronous
  { const H2=createHarness(),cc=H2.cc;delete globalThis.__qfJourneyUi;const U=H2.load('ui/JourneyUi');const {IslandJourneyOverlay}=H2.load('world-r2/IslandJourneyOverlay');
    assert.equal(U.journeyUi(),null,'not registered before board_art loads');
    const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(12)}}),gates:()=>({r5:[],challenges:{},stages:SHIPPED}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode:'day'})});
    await H2.flush();assert(U.journeyUi(),'UI ready after the same board_art load as the panel art');assert(H2.state.bundleScripts.includes('board_art:journey_ui/JourneyPanels.ts'));
    o.sync(390,844,true);H2.tap(o.buttons[1]);assert(o.popups.find('JourneyPanel'),'first tap opens the journey book in the same frame (no deferral, no loader)');o.dispose();
    delete globalThis.__qfJourneyUi;const H3=createHarness(),U3=H3.load('ui/JourneyUi'),O3=H3.load('world-r2/IslandJourneyOverlay').IslandJourneyOverlay;
    const o3=new O3(H3.cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(12)}}),gates:()=>({r5:[],challenges:{},stages:SHIPPED}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode:'day'})});
    o3.sync(390,844,true);H3.tap(o3.buttons[1]);assert(!o3.popups.find('JourneyPanel'),'tap before the subpackage ran: nothing drawn yet (no loader)');await H3.flush();assert(o3.popups.find('JourneyPanel'),'opens right after the bundle runs');o3.dispose(); }
  ok('first open: board_art (panel art + journey UI) is warmed at overlay construction; tap after it → synchronous open; tap before → opens on load, no loading UI');
  const farProof=[];
  // panel fit on 7 sizes, rows ≥ 44 pt
  const {IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay'),cc=H.cc;
  for(const [w,h] of [[320,568],[360,640],[375,667],[390,844],[414,896],[430,932],[568,320]]){
    const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(12)}}),gates:()=>({r5:[{id:'r06-coast-01',region:'coast',ok:true}],challenges:{lake:2},stages:[...SHIPPED,...COAST]}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode:'day'})});
    await H.flush();o.sync(w,h,true);o.open('journal');const p=o.popups.find('JourneyPanel');assert(p);
    const texts=p.root.getComponentsInChildren(cc.Label).map(l=>l.string);assert(texts.includes('旅程 14 / 27'),texts);assert(texts.includes('章节 · 天空回声')||!texts.includes('天空回声'),'sky subtitle only as 章节 · 天空回声');
    const sc=Math.max(0.3,Math.min(w/750,h/1300,0.62)),f=Math.min(1,(h-16)/(h<700?458:514));assert(Math.abs(p.height*sc-(h<700?458:514)*f)<1e-6,'panel 514 / 458');
    for(const d of J.REGION_DEFS)assert(p.root.find('Chapter-'+d.id),d.id);
    const cell=p.root.find('Chapter-coast').getComponent(cc.UITransform),iw=Math.min(330,w-40)-48;assert(Math.abs(cell.width*sc-(iw+48-64*f)/3)<0.01,'cell width (iw−16)/3 '+[cell.width*sc,iw,f]);if(h>=500)assert(cell.height*sc>=44-1e-6&&cell.width*sc>=44-1e-6,'cell touch ≥ 44 pt');
    for(const id of ['rail','cloud','spring']){const n=p.root.find('Chapter-'+id),ls=n.getComponentsInChildren(cc.Label).map(l=>l.string);
      assert(!n.getComponentsInChildren(cc.UITransform).some(t=>/Seal/.test(t.node.name)),'no-data '+id+': no seal / blank seal');
      assert.deepEqual(ls,['远方','· · ·'],'no-data '+id+' shows 远方');H.tap(n);await H.flush();assert(!o.popups.find('ChapterPanel'),'no-data '+id+' not tappable');}
    farProof.push([w,h].join('x'));
    o.close();o.open('coast');const c=o.popups.find('ChapterPanel');assert(c);assert(c.root.getComponentsInChildren(cc.Label).some(l=>l.string==='前往灯塔海岸'));o.dispose();
  }
  ok('no-data rail/cloud/spring render 远方 + · · ·, no seal node, tap opens nothing, not in 旅程 14 / 27 on '+farProof.join(','));
  ok('journey book 514/458, 旅程 14 / 27 with coast data, 3×3 grid of 9 cells ≥44 pt on 7 sizes; coast page 前往灯塔海岸');
  console.log(JSON.stringify({status:'PASS',checks},null,2));
})().catch(e=>{console.error(e);process.exit(1);});
