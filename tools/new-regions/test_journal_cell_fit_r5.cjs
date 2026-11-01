'use strict';
// r5 UI设计部 final wording gate for the journal grid cells (2026-10-31): every 'main:N' cell (challenge gate not open: tide / meadow /
// sky; or region locked by main:N: meadow / sky / lake / coast) reads B.gateCellText(N) = 「N 关后开启」 at every width (no width
// switching), 11 pt, same colour as the other locked status text, ONE line, no '…', and the fit-ladder step is the same for all such
// cells of a grid. 7 screens × day/night × cleared 0..11. Prints the measured / available width of 「12 关后开启」 at 320 and 390.
// Negative self-tests: the old r5 「通关第 12 关后」 does not fit at 320 (the reason for the change), and a cell 1 pt narrower than
// the widest text is reported as a fit failure (ladder works on measurement).
const assert=require('node:assert/strict'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),cc=H.cc,J=H.load('ui/JourneyCore'),B=H.load(path.join(H.BUNDLES,'board_art/journey_ui/JourneyPanels.ts')).createJourneyUi(H.load('ui/JourneyUi').journeyUiHost());
const {IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay'),{resetUiNightWeight}=H.load('ui/NightTint'),{measure}=H.load('ui/PopupKit');
const rec=n=>Array.from({length:12},(_,i)=>({bestStars:i<n?1:0}));
const SHIPPED=[...Array.from({length:12},(_,i)=>({id:'r05-x-'+i,region:['tide','meadow','sky'][i%3]})),...Array.from({length:6},(_,i)=>({id:'r05-lake-0'+(i+1),region:'lake'})),...Array.from({length:9},(_,i)=>({id:'r06-coast-0'+(i+1),region:'coast'}))];
const SIZES=[[320,568],[360,780],[375,667],[390,844],[393,852],[414,896],[430,932]];
const CGATE={tide:4,meadow:8,sky:12};
const unlockN=id=>{const m=/^main:(\d+)$/.exec(J.REGION_DEFS.find(d=>d.id===id).unlock.requires.join(','));return m?+m[1]:null;};
(async()=>{let n=0;const widths={},steps=new Set();
for(const mode of ['day','night'])for(let cl=0;cl<=11;cl++)for(const [W,Hh] of SIZES){
  globalThis.__worldDayNight={snapshot:()=>({mode})};resetUiNightWeight();
  const r5=Object.entries(CGATE).map(([region,N])=>({region,ok:cl>=N,reason:cl>=N?undefined:'stage-locked'})).filter(g=>g.ok);
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(cl)}}),gates:()=>({r5,challenges:{},stages:SHIPPED}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode})});
  await H.flush();o.sync(W,Hh,true);o.open('journal');const p=o.popups.find('JourneyPanel');assert(p);
  const tag=`${mode} cleared${cl} ${W}x${Hh}`,fit=B.cellFit();assert(fit,tag+' fit recorded');steps.add(W+':'+fit.step);
  assert(fit.step<=2,`${tag}: fit ladder exhausted (c): widest ${fit.widestPt.toFixed(2)} pt > avail ${fit.availPt.toFixed(2)} pt`);
  const rows=J.journeyRows({records:rec(cl),stages:SHIPPED,regionDone:{}});let colour=null;
  for(const r of rows){const st=p.root.find('Chapter-'+r.id).getComponentsInChildren(cc.Label).find(l=>l.node.name==='Status');
    const N=r.state==='locked'?unlockN(r.id):(CGATE[r.id]&&cl<CGATE[r.id]&&r.state!=='far'?CGATE[r.id]:null);if(N==null)continue;
    assert.equal(st.string,B.gateCellText(N,fit.tight),`${tag} ${r.id}: cell text (N=${N}, ${r.state==='locked'?'region unlock':'challenge gate'})`);
    assert(!st.string.includes('…')&&!st.enableWrapText&&st.overflow===cc.Label.Overflow.NONE,tag+' '+r.id+' one line, no …');
    const lw=st.getComponent(cc.UITransform).width;assert(measure(st.string,st.fontSize)<=lw+1e-6,`${tag} ${r.id}: 「${st.string}」 ${measure(st.string,st.fontSize)} > ${lw}`);
    const ptPer=Math.abs(st.node.worldScale.y)*(st.fontSize/B.STATUS_PT);assert(st.fontSize>0);
    const c=[st.color.r,st.color.g,st.color.b].join();if(colour)assert.equal(c,colour,tag+' same colour on every gated cell');colour=c;n++;
    if(N===12&&mode==='day'&&cl===10){const k=String(W);widths[k]={text:st.string,measuredPt:+(measure(st.string,st.fontSize)/(st.fontSize/B.STATUS_PT)).toFixed(2),availPt:+(lw/(st.fontSize/B.STATUS_PT)).toFixed(2),step:fit.step};}}
  o.dispose?.();}
// negative self-tests on the measuring function itself
{const f=B.cellFitStep([12],11,measure('12 关后开启',11)-1,2,x=>x);assert(f.step>=1,'1 pt short must leave step 0');
 assert.equal(B.cellFitStep([12],11,measure('12 关后开启',11)+0.01,2,x=>x).step,0,'fits → step 0');
 assert(B.cellFitStep([12],11,measure('12关后开启',11)-5,2,x=>x).step===3,'5 pt short of the tight text → (c) reported');}
assert(widths['320']&&widths['390'],'measured 320 / 390');
const old320=measure('通关第 12 关后',11);
console.log('PASS journal cell fit: '+n+' gated cells (7 sizes × day/night × cleared 0..11) = 「N 关后开启」, one line, no …, same colour, one ladder step per grid; steps '+[...steps].sort().join(' '));
for(const [w,x] of Object.entries(widths))console.log(`PASS @${w}: 「${x.text}」 measured ${x.measuredPt} pt / available ${x.availPt} pt (ladder step ${x.step})`);
console.log('PASS negative self-tests: measured fit failure moves the ladder; exhausted ladder is reported, never wraps (old 「通关第 12 关后」 = '+old320.toFixed(2)+' pt @11 pt)');
})().catch(e=>{console.error(e);process.exit(1);});
