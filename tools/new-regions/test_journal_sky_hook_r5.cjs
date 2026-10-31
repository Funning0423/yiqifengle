'use strict';
// r5 Option A, end to end through the REAL path (no stubbed gate): isolated test save (WorldNativeComposition.preTransitionProfile
// + RegionFlowTest.seedSkyChallengeWins, both real engine/provider replays) → real islandOverview() / islandGates() → the real
// IslandJourneyOverlay → rendered region-page labels.
//  - N for 「通关第 N 关后开启」 is derived: region-campaign.js inspect().challengeUnlocked first turns true after N cleared → 4 / 8 / 12,
//    and JourneyPanels.challengeGateLevel() returns the same numbers (nothing hard-coded on either side).
//  - sky: before-gate (mainline 9) one grey 「通关第 12 关后开启」, nothing above it; open 0/4 前往天空之城; 1/4 继续 1/4; 4/4 再访天空之城.
//  - tide / meadow: before-gate 「通关第 4 / 8 关后开启」 and open 前往X. Locked pages: sky 「通关第 8 关后开启」, lake 「通关第 12 关后开启」.
//  - every grey button: no ChapterCondition / no text between the content and the button; 320×568 fits without truncation.
//  - hooks journal-sky-open/-progress/-cleared = checkpoint 12 + 0 / 1 / 4 sky challenge wins.
const assert=require('node:assert/strict'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
(async()=>{
const H=createHarness({debug:false}),cc=H.cc,K=H.load('world-r2/PreTransitionKeys'),RF=H.load('world-r2/RegionFlowTest');
const B=H.load(path.join(H.BUNDLES,'board_art/journey_ui/JourneyPanels.ts')).createJourneyUi(H.load('ui/JourneyUi').journeyUiHost());
const RC=require('../../creator-build-project/assets/scripts/mainline-r1/runtime/region-campaign.js'),{measure}=H.load('ui/PopupKit'),{IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay');
const C=H.load('world-r2/WorldNativeComposition').WorldNativeComposition,c=new C();c.world={commands:()=>({snapshot:()=>({state:'island'})})};globalThis.location={search:'?qfHooks=1'};
// 1. N from region-campaign.js
const base=RF.createRegionFlowCheckpoint(12,{allowQa:true,finish:true,anyCheckpoint:true}).mainline.createController().snapshot().journey;
const derived={};
for(const [rid,i] of [['tide',0],['meadow',1],['sky',2]]){let n=null;
  for(let k=0;k<=12&&n==null;k++){const j=JSON.parse(JSON.stringify(base));j.records.forEach((r,x)=>{if(x>=k){r.bestStars=0;r.clears=0;}});const v=RC.inspect(j);assert(v.ok,'journey valid '+v.reason);if(v.regions[i].challengeUnlocked)n=k;}
  derived[rid]=n;assert.equal(B.challengeGateLevel(rid),n,rid+' JourneyPanels N = region-campaign N');}
assert.deepEqual(derived,{tide:4,meadow:8,sky:12},'challenge gates after levels 4 / 8 / 12');
// 2. hooks
for(const [k,n] of [['journal-sky-open',0],['journal-sky-progress',1],['journal-sky-cleared',4]]){const s=K.preSpec(k);assert(s,k);assert.equal(s.checkpoint,12);assert.equal(s.finish,true);assert.equal(s.place,'island');assert.equal(s.skyChallenges,n,k);}
// 3. live pages
const box=(n,W,Hh)=>{const t=n.getComponent(cc.UITransform),p=n.worldPosition,s=n.worldScale,h=t.height*Math.abs(s.y),w=t.width*Math.abs(s.x);return {x0:p.x-w*t.anchorX,y0:Hh/2-p.y-h*(1-t.anchorY),y1:Hh/2-p.y+h*t.anchorY};};
async function page(cp,sky,region,W,Hh){assert.equal(c.preTransitionProfile(cp,true).ok,true,'profile '+cp);if(sky)RF.seedSkyChallengeWins(c.testProfile,sky,{allowQa:true});
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>c.islandOverview(),gates:()=>c.islandGates(),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode:'day'})});
  await H.flush();o.sync(W,Hh,true);o.open(region);await H.flush();const p=o.popups.find('ChapterPanel');assert(p,region+' page');return {o,p};}
const CASES=[ // [label, checkpoint, sky wins, region, button, enabled]
  ['sky before-gate (mainline 9)',9,0,'sky','通关第 12 关后开启',false],['sky open 0/4',12,0,'sky','前往天空之城',true],['sky 1/4',12,1,'sky','继续 1/4',true],['sky cleared 4/4',12,4,'sky','再访天空之城',true],
  ['tide before-gate (mainline 2)',2,0,'tide','通关第 4 关后开启',false],['tide open 0/4',4,0,'tide','前往潮汐小径',true],
  ['meadow before-gate (mainline 5)',5,0,'meadow','通关第 8 关后开启',false],['meadow open 0/4',8,0,'meadow','前往花粉草甸',true],
  ['sky locked page (mainline 4)',4,0,'sky','通关第 8 关后开启',false],['lake locked page (mainline 9)',9,0,'lake','通关第 12 关后开启',false]];
const out=[];
for(const [W,Hh] of [[390,844],[320,568]])for(const [tag,cp,sky,region,want,en] of CASES){
  const {o,p}=await page(cp,sky,region,W,Hh),btn=p.root.find('Continue-'+region);assert(btn,tag+' button');
  const ls=btn.getComponentsInChildren(cc.Label);assert.equal(ls.length,1,tag+' one line');const L=ls[0];
  assert.equal(L.string,want,`${tag} @${W}: button`);assert.equal(btn.__disabled===true,!en,tag+' tappable='+en);
  assert(!/主线|暂不可进入/.test(p.root.getComponentsInChildren(cc.Label).map(l=>l.string).join('|')),tag+' no 主线 / 暂不可进入 on the page');
  if(!en){assert(!p.root.find('ChapterCondition'),tag+' no small text above the grey button');
    const BB=box(btn,W,Hh),above=p.root.getComponentsInChildren(cc.Label).filter(l=>!ls.includes(l)).map(l=>({s:l.string,b:box(l.node,W,Hh)})).filter(x=>x.b.y1<=BB.y0+0.01&&x.b.y0>=BB.y0-40);
    assert.deepEqual(above.map(x=>x.s),[],tag+' nothing directly above the grey button');
    const lw=L.getComponent(cc.UITransform).width;assert(!L.string.endsWith('…')&&measure(L.string,L.fontSize)<=lw+1e-6,`${tag} @${W}: fits (${measure(L.string,L.fontSize).toFixed(1)} ≤ ${lw.toFixed(1)})`);}
  out.push(`${tag}@${W}=「${L.string}」${en?'':' grey'}`);o.dispose();}
// grid cell for a locked mainline-gated region
{const {o}=await page(4,0,'sky',390,844);o.close();await H.flush();o.open('journal');await H.flush();const j=o.popups.find('JourneyPanel');
 const st=j.root.find('Chapter-sky').getComponentsInChildren(cc.Label).find(l=>l.node.name==='Status').string;assert(st==='通关第 8 关后'||(st.endsWith('…')&&'通关第 8 关后'.startsWith(st.slice(0,-1))),'sky cell '+st);out.push('sky cell (locked)=「'+st+'」');o.dispose();}
delete globalThis.location;
console.log('PASS N derived from region-campaign challengeUnlocked: '+JSON.stringify(derived));
for(const x of out)console.log('PASS '+x);
console.log('PASS live gate path: '+CASES.length+' states × 390/320, grey buttons alone (no text above), no truncation, no 主线 / 暂不可进入');
})().catch(e=>{console.error(e);process.exit(1);});
