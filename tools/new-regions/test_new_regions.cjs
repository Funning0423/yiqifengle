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
  const narrow=w=>Math.min(...p55.segments.map(g=>(g.x1-g.x0)*(w-64)-2));assert(narrow(330)>=12&&narrow(272)>=12,'narrowest segment ≥ 12 pt (§13.3: 19.3 / 15.7)');
  assert.equal(J.journeyProgress({records:rec(0),regionDone:{coast:5},stages:[...SHIPPED,...COAST]}).done,0,'locked coast never counts');
  ok('9-segment bar: denominator = Σ stages of regions with data: 18 (this build), 27 with coast, 33 with snow, 55 with all 9; narrowest segment ≥12 pt');
}
{ // unlock interface (§13.2)
  const row=(n,d,id,st=ALL,seen)=>J.regionRow(id,{records:rec(n),regionDone:d,stages:st,seen});
  for(const d of J.REGION_DEFS){assert(Array.isArray(d.unlock.requires));assert(d.unlock.label.length<=5,d.id);}
  assert.deepEqual(J.REGION_DEFS.find(d=>d.id==='spring').unlock.requires,['rail','cloud']);
  assert.equal(row(6,{},'sky').state,'locked');for(const id of ['lake','coast','snow','rail','cloud','spring'])assert.equal(row(6,{},id).state,'locked',id+' (P3 r4: data + locked → locked, never 远方)');
  assert.equal(row(8,{},'coast').state,'locked','after mainline 8: coast known-locked');assert.equal(row(12,{},'coast').state,'open');assert(row(12,{},'coast').isNew);assert(!row(12,{},'coast',ALL,['coast']).isNew);
  assert.equal(row(12,{},'lake').state,'open');assert.equal(row(12,{},'snow').state,'locked');assert.equal(row(12,{},'rail').state,'locked','coast open → rail known-locked');assert.equal(row(12,{},'cloud').state,'locked','snow not open → cloud still locked (has data)');
  assert.equal(row(12,{coast:8},'rail').state,'locked');assert.equal(row(12,{coast:9},'rail').state,'open','rail after coast fully cleared');
  assert.equal(row(12,{lake:6},'cloud').state,'locked');assert.equal(row(12,{lake:6,snow:6},'cloud').state,'open','cloud after snow fully cleared');
  assert.equal(row(12,{coast:9},'spring').state,'locked');assert.equal(row(12,{coast:9,rail:6,lake:6,snow:6,cloud:7},'spring').state,'locked');assert.equal(row(12,{coast:9,rail:6,lake:6,snow:6,cloud:8},'spring').state,'open','spring after rail and cloud');
  const S=[...SHIPPED,...COAST];for(const id of ['snow','rail','cloud','spring']){const r=row(12,{lake:6,coast:9},id,S);assert.equal(r.state,'far','no data → 远方 '+id);assert(!r.tappable);}
  assert.equal(row(12,{},'coast',SHIPPED).state,'far','coast without data: 远方');
  assert.equal(B.rowStatusText(row(12,{},'snow')),'湖畔通关后');assert.equal(B.rowStatusText(row(12,{},'rail')),'海岸通关后');assert.equal(B.rowName(row(6,{},'coast',SHIPPED)),'远方');assert.equal(B.rowStatusText(row(6,{},'coast',SHIPPED)),'· · ·');assert.equal(B.rowName(row(6,{},'coast')),'灯塔海岸');assert.equal(B.rowStatusText(row(6,{},'coast')),'主线12后');
  assert.equal(B.rowStatusText(row(12,{coast:9},'coast')),'9/9 ✓');assert.equal(B.rowStatusText(row(12,{coast:3},'coast')),'3/9');assert.equal(B.rowStatusText(row(12,{},'coast')),'可前往');
  assert.equal(J.focusRegion({records:rec(12),regionDone:{lake:2},stages:S}),'lake');assert.equal(J.focusRegion({records:rec(12),regionDone:{lake:2},stages:S,lastPlayed:'coast'}),'coast');
  ok('unlock = requires + label: coast/lake 主线12后, snow 湖畔通关后, rail after coast, cloud after snow, spring after rail+cloud; locked whenever data exists (P3 r4), 远方 only without data; no data → 远方 untappable; focus rule');
}
{ // names (§13.4) + chapter buttons
  const n=id=>J.REGION_DEFS.find(d=>d.id===id);assert.equal(n('sky').name,'天空之城');assert.equal(n('sky').subtitle,'天空回声');assert.equal(n('snow').short,'雪山山口');assert.equal(n('coast').short,'灯塔海岸');
  for(const d of J.REGION_DEFS)assert(d.short.length<=4,d.id);
  const b=(state,id='coast',done=0)=>B.chapterButton({id,state,done,total:9});
  assert.deepEqual(b('open'),{text:'前往灯塔海岸',enabled:true,flat:false});assert.equal(b('progress').text,'继续');assert.equal(b('done').text,'再访灯塔海岸');
  assert.deepEqual(b('locked'),{text:'主线12后开启',enabled:false,flat:true});assert.deepEqual(b('far'),{text:'尚未开启',enabled:false,flat:true});
  assert.equal(B.coastChapterHint(5),'海岸漫游');assert.equal(B.coastChapterHint(6),'灯塔夜航');
  ok('names: 天空之城 (subtitle 天空回声), 雪山山口, 灯塔海岸 (short ≤4 chars); single button 前往X / 继续 / 再访X / <label>开启 (locked) / 尚未开启 (远方)');
}
{ // ending seals (§13.5)
  const g={d:36,sp:44,gap:40};
  const s=J.endingSeals(g,[]);assert.equal(s.length,9);assert.deepEqual(s.slice(0,5).map(x=>x.x),[-88,-44,0,44,88]);assert.deepEqual(s.slice(5).map(x=>x.x),[-66,-22,22,66]);
  assert.equal(s[0].dy,4);assert.equal(s[2].dy,0);assert.equal(s[5].dy,40+2.25);assert.deepEqual(s.map(x=>x.earned),[true,true,true,true,false,false,false,false,false]);
  assert(J.endingSeals(g,['coast'])[4].earned);
  for(const [w,h] of [[320,568],[360,640],[375,667],[390,844],[414,896],[430,932],[768,1024]]){const k=E.endingLayoutChecks(w,h,0),L=E.endingLayout(w,h);assert(k.sealsFit&&L.girl.y1-L.girl.y0>=48-1e-6,w+'x'+h);assert(k.headBelowSeals&&k.girlClear,w+'x'+h+' '+JSON.stringify(k));}
  const src=fs.readFileSync(BUNDLE_FILE,'utf8');assert(/Shadow/.test(src)&&/44, 28, 14/.test(src),'soft per-seal shadow');assert(!/SealPlate|SealsBand|blur/i.test(src.replace(/~2\.2 pt blur/,'')),'no backing plate');
  ok('ending: 9 seals, two rows 5+4 at Ø36/44/40 base geometry, soft shadow per seal, no plate');
  // UI设计部 r3 cascade (c+b): ① margin 8 ② gap 6 ③ 2 rows Ø32/30/28 ④ 1 row (gap .25d, d=min(28,floor((W−40)/11))) ⑤ H<700 clearance 10 ⑥ shrink (≥48)
  const ORDER=['none','margin','gap','d32','d30','d28','row1','clear10','shrink'],S=E.ENDING_SEALS;
  assert.equal(S.headGap,6,'head gap 6 pt is the r3 spec value');assert.equal(S.minGirl,48,'48 pt minimum unchanged');
  assert.equal(E.endingSingleRowD(320),25);assert.equal(E.endingSingleRowD(360),28);assert.equal(E.endingSingleRowD(430),28);
  const SIZES=[[320,568],[360,780],[375,667],[390,844],[393,852],[414,896],[430,932]],table=[];
  for(const [w,h] of SIZES){const L=E.endingLayout(w,h),k=E.endingLayoutChecks(w,h,0),G=L.seals,gh=L.girl.y1-L.girl.y0,st=L.cascade;
    assert(ORDER.includes(st),st);if(st==='clear10')assert(h<700,'clearance 10 only when H<700');assert.equal(G.clear,h<700&&ORDER.indexOf(st)>=7?10:15,w+'x'+h+' clearance');
    // cascade order: every earlier step must NOT fit the girl at full size (stop at the first that does)
    {const tr=L.cascadeTried,exp=ORDER.filter(x=>x!=='shrink'&&(x!=='clear10'||h<700));assert.deepEqual(tr,st==='shrink'?exp:exp.slice(0,exp.indexOf(st)+1),w+'x'+h+' tried in order ①→⑤ and stopped at the first fit');}
    if(st==='shrink')assert(gh<L.girlNative-1e-6);else assert(Math.abs(gh-L.girlNative)<1e-6,w+'x'+h+' full size once a step fits');
    if(G.rows===1){const d=E.endingSingleRowD(w);assert.equal(G.d,d);assert(Math.abs(G.sp-1.25*d)<1e-9);assert(8*G.sp+d<=w-40+1e-6,'20 pt side margins');
      const ss=J.endingSeals(G,[]);assert.deepEqual(ss.map(x=>x.dy),Array(9).fill(0));assert(Math.abs(ss[0].x+ss[8].x)<1e-9,'centred');for(let i=1;i<9;i++)assert(ss[i].x>ss[i-1].x,'left→right');}
    else{assert([36,32,30,28].includes(G.d));assert(Math.abs(G.sp-44*G.d/36)<1e-9&&Math.abs(G.gap-40*G.d/36)<1e-9);}
    assert(L.girl.y0-G.bottom>=6-1e-6,w+'x'+h+' girl never overlaps a seal (head gap ≥ 6)');assert(gh>=48-1e-6,w+'x'+h+' girl ≥ 48 pt');
    for(const [kk,v] of Object.entries(k))assert(v,w+'x'+h+' '+kk);
    table.push([w+'x'+h,gh.toFixed(1),L.girlNative.toFixed(1),(100*gh/L.girlNative).toFixed(1)+'%','Ø'+G.d,G.rows+'-row',st,G.clear,(L.girl.y0-G.bottom).toFixed(1)]);}
  const miss=table.filter(r=>{const [w,h]=r[0].split('x').map(Number),pct=parseFloat(r[3]);return h>=780&&pct<100||h<700&&pct<60;});
  console.log('ENDING_CASCADE '+JSON.stringify(table));console.log('ENDING_TARGETS_MISSED '+JSON.stringify(miss.map(r=>r[0])));
  ok('ending cascade on 7 sizes: order ①→⑥, 2-row Ø32/30/28 pitch 44·d/36, 1-row d=min(28,⌊(W−40)/11⌋) gap .25d centred left→right, clearance 10 only H<700, head gap ≥6, girl ≥48 (targets reported, not asserted)');
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
    const cell=p.root.find('Chapter-coast').getComponent(cc.UITransform),pw=Math.min(330,Math.max(240,w-40));assert(Math.abs(cell.width*sc-(pw-80*f)/3)<0.01,'cell width (inner−2·8−16)/3 (r4 P2) '+[cell.width*sc,pw,f]);if(h>=500)assert(cell.height*sc>=44-1e-6&&cell.width*sc>=44-1e-6,'cell touch ≥ 44 pt');
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
