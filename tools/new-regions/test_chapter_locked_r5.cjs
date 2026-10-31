'use strict';
// r5 P3 gate for LOCKED region pages (界面验收部 ui-audit/2026-10-31/journal-3277421c §已有问题 + item 2):
//  1. one condition: a locked page carries exactly ONE 「通关第 N 关后…」 text — the grey button. The small ChapterCount line that repeated
//     it is gone (JourneyPanels LOCKED_PAGE_COUNT_LINE=false; UI设计部 can ask for it back, then this gate expects 2).
//  2. paper inner edge: every label (description wrapped/fitted, never …) and the grey button sit ≥ 8 pt inside the paper inner edge
//     (PAPER_INNER_SRC, same model as test_journey_paper_r5) on every locked page (meadow / sky / lake / coast … every main:N region),
//     7 screens × day/night; button font ≥ 11 pt, button label fits its pill.
//  3. negative self-tests: the fc3123fa layout (centred, description width PW−48 on one line, 240 pt button) leaves the paper at 320
//     on the lake page; and the restored count line would make 2 condition texts.
const assert=require('node:assert/strict'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),cc=H.cc,J=H.load('ui/JourneyCore'),B=H.load(path.join(H.BUNDLES,'board_art/journey_ui/JourneyPanels.ts')).createJourneyUi(H.load('ui/JourneyUi').journeyUiHost());
const {IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay'),{resetUiNightWeight}=H.load('ui/NightTint'),{measure}=H.load('ui/PopupKit');
const SIZES=[[320,568],[360,780],[375,667],[390,844],[393,852],[414,896],[430,932]],PS=B.PAPER_INNER_SRC,MIN_GAP=8;
const SHIPPED=[...Array.from({length:12},(_,i)=>({id:'r05-x-'+i,region:['tide','meadow','sky'][i%3]})),...Array.from({length:6},(_,i)=>({id:'r05-lake-0'+(i+1),region:'lake'})),...Array.from({length:9},(_,i)=>({id:'r06-coast-0'+(i+1),region:'coast'}))];
const rec=n=>Array.from({length:12},(_,i)=>({bestStars:i<n?1:0}));
const unlockN=id=>{const m=/^main:(\d+)$/.exec(J.REGION_DEFS.find(d=>d.id===id).unlock.requires.join(','));return m?+m[1]:null;};
const LOCKED=J.REGION_DEFS.map(d=>d.id).filter(id=>unlockN(id)!=null&&B.unlockText(id)&&J.CHAPTERS?true:true).filter(id=>unlockN(id)!=null);
const COND=/通关第 ?\d+ ?关后|^\d+ ?关后开启$|第 ?\d+ ?关后开启/;
const box=(n,W)=>{const t=n.getComponent(cc.UITransform),p=n.worldPosition,s=n.worldScale,w=t.width*Math.abs(s.x);const cx=p.x+W/2;return {x0:cx-w*t.anchorX,x1:cx+w*(1-t.anchorX)};};
(async()=>{let pages=0,checked=0;const at320={};
assert(B.LOCKED_PAGE_COUNT_LINE===false,'locked pages without the count line (flip LOCKED_PAGE_COUNT_LINE to restore it)');
for(const mode of ['day','night'])for(const [W,Hh] of SIZES)for(const id of LOCKED){const N=unlockN(id),cl=N-1;
  globalThis.__worldDayNight={snapshot:()=>({mode})};resetUiNightWeight();
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(cl)}}),gates:()=>({r5:[],challenges:{},stages:SHIPPED}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode})});
  await H.flush();o.sync(W,Hh,true);o.open(id);await H.flush();const p=o.popups.find('ChapterPanel'),tag=`${mode} ${W}x${Hh} ${id} (cleared ${cl})`;assert(p,tag+' page');
  const F=box(p.root.find('PanelFrame'),W),fu=(F.x1-F.x0)/p.width,ptPer=(F.x1-F.x0)/Math.min(330,Math.max(240,W-40)),IN={x0:F.x0+PS.left/PS.artPx*fu,x1:F.x1-PS.right/PS.artPx*fu};
  const btn=p.root.find('Continue-'+id);assert(btn&&btn.__disabled===true,tag+' grey button');
  const labels=p.root.getComponentsInChildren(cc.Label),conds=labels.filter(l=>COND.test(l.string));
  assert.equal(conds.length,1,`${tag}: exactly one condition text, got ${JSON.stringify(conds.map(l=>l.node.name+':'+l.string))}`);
  assert(btn.getComponentsInChildren(cc.Label).includes(conds[0]),tag+' the one condition is the grey button');assert(!p.root.find('ChapterCount'),tag+' no ChapterCount line');
  const inside=(b,what)=>{const gl=(b.x0-IN.x0)/ptPer,gr=(IN.x1-b.x1)/ptPer;assert(gl>=MIN_GAP-0.01&&gr>=MIN_GAP-0.01,`${tag}: ${what} gaps ${gl.toFixed(2)} / ${gr.toFixed(2)} pt (< ${MIN_GAP} inside the paper)`);checked++;return [+gl.toFixed(2),+gr.toFixed(2)];};
  const bb=inside(box(btn,W),'grey button');
  for(const l of labels){const anc=[];for(let q=l.node;q;q=q.parent)anc.push(q.name);if(!l.string||anc.some(x=>/^(BackToChapters|Close|PanelTitle|Title)$/.test(x)))continue;
    if(!l.node.activeInHierarchy)continue;assert(!l.string.includes('…'),tag+' no … in '+l.string);
    const nb=box(l.node,W),wrapped=l.enableWrapText,tw=wrapped?Math.min((nb.x1-nb.x0),measure(l.string,l.fontSize)*Math.abs(l.node.worldScale.x)):measure(l.string,l.fontSize)*Math.abs(l.node.worldScale.x);
    if(!wrapped)assert(measure(l.string,l.fontSize)<=l.getComponent(cc.UITransform).width+1e-6,`${tag}: ${l.node.name} 「${l.string}」 wider than its box`);
    else{const lines=Math.round(l.getComponent(cc.UITransform).height/l.lineHeight);assert(measure(l.string,l.fontSize)<=lines*l.getComponent(cc.UITransform).width,`${tag}: ${l.node.name} needs more than ${lines} lines`);}
    const ax=l.getComponent(cc.UITransform).anchorX,c=nb.x0+(nb.x1-nb.x0)*ax,t=ax===0?{x0:nb.x0,x1:nb.x0+tw}:{x0:c-tw/2,x1:c+tw/2};const g=inside(t,l.node.name+' 「'+l.string+'」');
    if(W===320&&mode==='day'&&l.node.name==='ChapterDescription')at320[id]={desc:g,lines:wrapped?2:1,button:bb};}
  const bl=btn.getComponentsInChildren(cc.Label)[0];assert(bl.fontSize/Math.abs(1)>=11*(bl.fontSize>0?1:0),tag+' button font');assert(measure(bl.string,bl.fontSize)<=bl.getComponent(cc.UITransform).width+1e-6&&!bl.string.includes('…'),tag+' button label fits');
  pages++;o.dispose();}
delete globalThis.__worldDayNight;
// negative self-tests
{const W=320,Hh=568,o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(11)}}),gates:()=>({r5:[],challenges:{},stages:SHIPPED}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode:'day'})});
 await H.flush();o.sync(W,Hh,true);o.open('lake');await H.flush();const p=o.popups.find('ChapterPanel'),F=box(p.root.find('PanelFrame'),W),fu=(F.x1-F.x0)/p.width,ptPer=(F.x1-F.x0)/280,IN={x0:F.x0+PS.left/PS.artPx*fu,x1:F.x1-PS.right/PS.artPx*fu};
 const desc=p.root.find('ChapterDescription').getComponent(cc.Label),cx=(F.x0+F.x1)/2,old=measure(desc.string,15)*ptPer/2,oldB=120*ptPer;
 const fails=b=>(b.x0-IN.x0)/ptPer<MIN_GAP-0.01||(IN.x1-b.x1)/ptPer<MIN_GAP-0.01;
 assert(fails({x0:cx-old,x1:cx+old}),'negative: fc3123fa one-line centred description must leave the paper at 320');assert(fails({x0:cx-oldB,x1:cx+oldB}),'negative: fc3123fa 240 pt button must leave the paper at 320');
 assert(COND.test(B.unlockText('lake')),'negative: the restored count line 「'+B.unlockText('lake')+'」 is a second condition text');o.dispose();}
console.log('PASS locked pages: '+pages+' pages ('+LOCKED.join('/')+' × 7 sizes × day/night), exactly one condition text (the grey button), '+checked+' boxes ≥ '+MIN_GAP+' pt inside the paper inner edge, no …');
console.log('PASS @320 day: '+JSON.stringify(at320));
console.log('PASS negative self-tests: fc3123fa description + 240 pt button leave the paper at 320 (lake); restored count line = 2 condition texts');
})().catch(e=>{console.error(e);process.exit(1);});
