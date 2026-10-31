'use strict';
// r5 Option A, end to end through the REAL path (no stubbed gate): isolated test save (WorldNativeComposition.preTransitionProfile
// + RegionFlowTest.seedSkyChallengeWins, both real engine/provider replays) → real islandOverview() / islandGates() → the real
// IslandJourneyOverlay → rendered region-page labels.
//  - N for 「通关第 N 关后开启」 is derived: region-campaign.js inspect().challengeUnlocked first turns true after N cleared → 4 / 8 / 12,
//    and JourneyPanels.challengeGateLevel() returns the same numbers (nothing hard-coded on either side).
//  - tide / meadow / sky: every cleared count from the region's unlock to N−1 = one grey 「通关第 N 关后开启」 (nothing above), N = 前往X;
//    sky 1/4 = 继续 1/4, 4/4 = 再访. Locked pages sky / lake from their own main:N. Journal cell + focus card agree with the button.
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
// Cases are generated from the derived gate level N and each region's own unlock (no enterable entry written by hand):
// every mainline checkpoint from the region's unlock up to N−1 = gate still locked; N = boundary where it opens; plus sky 1/4, 4/4.
const J=H.load('ui/JourneyCore'),def=id=>J.REGION_DEFS.find(d=>d.id===id),unlockAt=id=>{const q=def(id).unlock.requires.map(x=>/^main:(\d+)$/.exec(x)).filter(Boolean);return q.length?+q[0][1]:0;};
const CASES=[];
for(const id of ['tide','meadow','sky']){const N=derived[id];for(let cp=Math.max(1,unlockAt(id));cp<=N;cp++)CASES.push(cp<N?[`${id} gate locked (cleared ${cp})`,cp,0,id,`通关第 ${N} 关后开启`,false]:[`${id} gate opens (cleared ${cp})`,cp,0,id,'前往'+def(id).short,true]);}
CASES.push(['sky 1/4',derived.sky,1,'sky','继续 1/4',true],['sky cleared 4/4',derived.sky,4,'sky','再访'+def('sky').short,true]);
for(const id of ['sky','lake']){const n=unlockAt(id);CASES.push([`${id} locked page (cleared ${n-1})`,n-1,0,id,`通关第 ${n} 关后开启`,false]);}
const out=[];let agreeN=0;
for(const [W,Hh] of [[390,844],[320,568]])for(const [tag,cp,sky,region,want,en] of CASES){
  const {o,p}=await page(cp,sky,region,W,Hh),btn=p.root.find('Continue-'+region);assert(btn,tag+' button');
  const ls=btn.getComponentsInChildren(cc.Label);assert.equal(ls.length,1,tag+' one line');const L=ls[0];
  assert.equal(L.string,want,`${tag} @${W}: button`);assert.equal(btn.__disabled===true,!en,tag+' tappable='+en);
  assert(!/主线|暂不可进入/.test(p.root.getComponentsInChildren(cc.Label).map(l=>l.string).join('|')),tag+' no 主线 / 暂不可进入 on the page');
  if(!en){assert(!p.root.find('ChapterCondition'),tag+' no small text above the grey button');
    const BB=box(btn,W,Hh),above=p.root.getComponentsInChildren(cc.Label).filter(l=>!ls.includes(l)).map(l=>({s:l.string,b:box(l.node,W,Hh)})).filter(x=>x.b.y1<=BB.y0+0.01&&x.b.y0>=BB.y0-40);
    assert.deepEqual(above.map(x=>x.s),[],tag+' nothing directly above the grey button');
    const lw=L.getComponent(cc.UITransform).width;assert(!L.string.endsWith('…')&&measure(L.string,L.fontSize)<=lw+1e-6,`${tag} @${W}: fits (${measure(L.string,L.fontSize).toFixed(1)} ≤ ${lw.toFixed(1)})`);}
  // the journal row + focus card agree with the page button (same gate)
  o.close();await H.flush();o.open('journal');await H.flush();const j=o.popups.find('JourneyPanel');
  const cell=j.root.find('Chapter-'+region).getComponentsInChildren(cc.Label).find(l=>l.node.name==='Status').string,fc=j.root.find('Focus-'+region),go=fc?fc.getComponentsInChildren(cc.Label).find(l=>l.node.name==='Go').string:null;
  const ENTER=/^(前往 ›|继续 ›|再访 ›)$/;
  if(!en){assert(!['可前往'].includes(cell)&&!/^\d\/\d/.test(cell)&&!cell.endsWith('…'),`${tag} @${W}: grey button but cell says 「${cell}」`);if(go!=null)assert(!ENTER.test(go),`${tag} @${W}: grey button but focus card says 「${go}」`);}
  else{const c=want.startsWith('继续')?want.split(' ')[1]:null,expCell=c?c:want.startsWith('再访')?'4/4 ✓':'可前往',expGo=c?'继续 ›':want.startsWith('再访')?'再访 ›':'前往 ›';
    assert.equal(cell,expCell,`${tag} @${W}: cell agrees with the button`);if(go!=null)assert.equal(go,expGo,`${tag} @${W}: focus card agrees with the button`);}
  agreeN++;out.push(`${tag}@${W}: button 「${L.string}」${en?'':' grey'} · cell 「${cell}」${go!=null?' · focus 「'+go+'」':''}`);o.dispose();}
// grid cell for a locked mainline-gated region
{const {o}=await page(4,0,'sky',390,844);o.close();await H.flush();o.open('journal');await H.flush();const j=o.popups.find('JourneyPanel');
 const st=j.root.find('Chapter-sky').getComponentsInChildren(cc.Label).find(l=>l.node.name==='Status').string;assert(st==='通关第 8 关后'||(st.endsWith('…')&&'通关第 8 关后'.startsWith(st.slice(0,-1))),'sky cell '+st);out.push('sky cell (locked)=「'+st+'」');o.dispose();}
delete globalThis.location;
console.log('PASS N derived from region-campaign challengeUnlocked: '+JSON.stringify(derived));
for(const x of out)console.log('PASS '+x);
console.log('PASS live gate path: '+CASES.length+' states × 390/320 ('+agreeN+'), page button = journal cell = focus card, grey buttons alone (no text above), no truncation, no 主线 / 暂不可进入');
})().catch(e=>{console.error(e);process.exit(1);});
