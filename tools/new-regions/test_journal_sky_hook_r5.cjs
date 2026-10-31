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
  if(!en){assert(!['可前往'].includes(cell)&&!/^\d\/\d/.test(cell)&&!cell.endsWith('…'),`${tag} @${W}: grey button but cell says 「${cell}」`);if(go!=null)assert(!ENTER.test(go),`${tag} @${W}: grey button but focus card says 「${go}」`);
   {const m=/(\d+) ?关后开启$/.exec(want);if(m){const n=+m[1];assert([B.gateCellText(n),B.gateCellText(n,true)].includes(cell),`${tag} @${W}: cell 「${cell}」 is UI设计部 「${n} 关后开启」`);if(go!=null)assert([B.GATE_LOCKED_LABEL(n),B.gateCellText(n)].includes(go),`${tag} @${W}: focus 「${go}」`);}}}
  else{const c=want.startsWith('继续')?want.split(' ')[1]:null,expCell=c?c:want.startsWith('再访')?'4/4 ✓':'可前往',expGo=c?'继续 ›':want.startsWith('再访')?'再访 ›':'前往 ›';
    assert.equal(cell,expCell,`${tag} @${W}: cell agrees with the button`);if(go!=null)assert.equal(go,expGo,`${tag} @${W}: focus card agrees with the button`);}
  agreeN++;out.push(`${tag}@${W}: button 「${L.string}」${en?'':' grey'} · cell 「${cell}」${go!=null?' · focus 「'+go+'」':''}`);o.dispose();}
// grid cell for a locked mainline-gated region
{const {o}=await page(4,0,'sky',390,844);o.close();await H.flush();o.open('journal');await H.flush();const j=o.popups.find('JourneyPanel');
 const st=j.root.find('Chapter-sky').getComponentsInChildren(cc.Label).find(l=>l.node.name==='Status').string;assert(st==='8 关后开启'||st==='8关后开启','sky locked cell = region unlock N=8 in the UI设计部 format: '+st);out.push('sky cell (locked)=「'+st+'」');o.dispose();}
// 4. every journal-sky hook key, state built from its OWN spec the way PreTransitionRun.setup does (profile → just-won → seed)
const HOOKS={'journal-sky-gated':['通关第 12 关后开启',false,'12 关后开启'],'journal-sky-just-unlocked':['前往天空之城',true,'可前往'],'journal-sky-open':['前往天空之城',true,'可前往'],'journal-sky-progress':['继续 1/4',true,'1/4'],'journal-sky-cleared':['再访天空之城',true,'4/4 ✓']};
const snapOf=()=>c.testProfile.mainline.createController().snapshot();let diffNote='';const journeys={};
for(const [k,[want,en,cellWant]] of Object.entries(HOOKS))for(const [W,Hh] of [[390,844],[320,568]]){const sp=K.preSpec(k);assert(sp,k);
  const prof=c.preTransitionProfile(sp.checkpoint,sp.finish);assert.equal(prof.ok,true,k+' profile');
  if(sp.justWon){const pre=snapOf();assert.equal(pre.journey.completed,11,k+': before the win only 11 registered');RF.finishPausedMainlineWin(c.testProfile,prof.lastAction,{allowQa:true});}
  if(sp.skyChallenges)RF.seedSkyChallengeWins(c.testProfile,sp.skyChallenges,{allowQa:true});
  const sn=snapOf(),insp=RC.inspect(sn.journey);journeys[k]=sn;
  assert.equal(insp.regions[2].challengeUnlocked,k!=='journal-sky-gated',k+' real sky challenge gate');assert.equal(insp.regions[2].unlocked,true,k+' sky region unlocked');
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>c.islandOverview(),gates:()=>c.islandGates(),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode:'day'})});
  await H.flush();o.sync(W,Hh,true);o.open('sky');await H.flush();const p=o.popups.find('ChapterPanel'),btn=p.root.find('Continue-sky'),L=btn.getComponentsInChildren(cc.Label)[0];
  assert.equal(L.string,want,`${k} @${W}: button`);assert.equal(btn.__disabled===true,!en,k+' tappable');if(!en)assert(!p.root.find('ChapterCondition'),k+' nothing above');
  o.close();await H.flush();o.open('journal');await H.flush();const j=o.popups.find('JourneyPanel'),cell=j.root.find('Chapter-sky').getComponentsInChildren(cc.Label).find(l=>l.node.name==='Status').string,fc=j.root.find('Focus-sky'),go=fc?fc.getComponentsInChildren(cc.Label).find(l=>l.node.name==='Go').string:null;
  assert.equal(cell,cellWant,`${k} @${W}: cell`);if(!en&&go!=null)assert(!/继续 ›|前往 ›|再访 ›/.test(go),k+' focus '+go);
  out.push(`hook ${k} @${W}: cleared ${sn.journey.completed} · sky gate ${insp.regions[2].challengeUnlocked?'open':'closed'} · button 「${L.string}」${en?'':' grey'} · cell 「${cell}」${go!=null?' · focus 「'+go+'」':''}`);o.dispose();}
{const a=journeys['journal-sky-just-unlocked'],b=journeys['journal-sky-open'];const strip=x=>JSON.stringify(x.journey.records.map(r=>[r.bestStars>0]));
 assert.equal(strip(a),strip(b),'just-unlocked and open: same cleared set (1–12)');diffNote=`just-unlocked vs open: same 12 cleared; just-unlocked state=${a.state} (12th win committed on the island from a paused attempt) vs open state=${b.state}`;out.push(diffNote);}
delete globalThis.location;
console.log('PASS N derived from region-campaign challengeUnlocked: '+JSON.stringify(derived));
for(const x of out)console.log('PASS '+x);
console.log('PASS live gate path: '+CASES.length+' states × 390/320 ('+agreeN+'), page button = journal cell = focus card, grey buttons alone (no text above), no truncation, no 主线 / 暂不可进入');
})().catch(e=>{console.error(e);process.exit(1);});
