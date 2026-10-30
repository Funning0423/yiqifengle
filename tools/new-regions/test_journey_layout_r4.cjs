'use strict';
// r4 journey-book gates (界面验收部 P2 on d4f25246 + UI设计部 P3 decision), 7 screens × day/night × 2 data states:
//  P2: 3×3 grid and focus card keep ≥ 8 pt to the panel's 9-slice inner frame (frame inset 24 pt) on the left and right, centred.
//  P3: 远方 only for regions with no data and never has a seal node; a region with data that is still locked never says 远方,
//      always has a (faint) seal and a one-line 11 pt condition label (no wrap, ellipsis when it does not fit).
// QF_R4_LAYOUT_OUT=<dir> also writes journey_<mode>_<state>_<W>x<H>.layout.json (screen pt, top-left origin).
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),cc=H.cc,J=H.load('ui/JourneyCore'),B=H.load(path.join(H.BUNDLES,'board_art/journey_ui/JourneyPanels.ts')).createJourneyUi(H.load('ui/JourneyUi').journeyUiHost());
const {IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay'),{resetUiNightWeight}=H.load('ui/NightTint');
const DEV=/3D|3d|场景/,MIN_GAP=8,FRAME_IN=24,OUT=process.env.QF_R4_LAYOUT_OUT||'';
const rec=n=>Array.from({length:12},(_,i)=>({bestStars:i<n?1:0}));
const SHIPPED=[...Array.from({length:12},(_,i)=>({id:'r05-x-'+i,region:['tide','meadow','sky'][i%3]})),...Array.from({length:6},(_,i)=>({id:'r05-lake-0'+(i+1),region:'lake'}))];
const COAST=Array.from({length:9},(_,i)=>({id:'r06-coast-0'+(i+1),region:'coast'}));
const STATES={ // early: sky / lake / meadow have data but are locked (the audit's case); late: coast open, snow…spring no data
  early:{records:rec(0),stages:SHIPPED,r5:[],challenges:{}},
  late:{records:rec(6),stages:[...SHIPPED,...COAST],r5:[],challenges:{}}};
const SIZES=[[320,568],[360,780],[375,667],[390,844],[393,852],[414,896],[430,932]];
const box=(n,W,Hh)=>{const t=n.getComponent(cc.UITransform),p=n.worldPosition,s=n.worldScale,w=t.width*Math.abs(s.x),h=t.height*Math.abs(s.y);
  const cx=p.x+W/2,cy=Hh/2-p.y;return {x0:+(cx-w*t.anchorX).toFixed(2),x1:+(cx+w*(1-t.anchorX)).toFixed(2),y0:+(cy-h*(1-t.anchorY)).toFixed(2),y1:+(cy+h*t.anchorY).toFixed(2)};};
(async()=>{const table=[],checks=[];let combos=0,farN=0,lockN=0,btnN=0,devN=0,pagesN=0;
for(const mode of ['day','night'])for(const [sk,S] of Object.entries(STATES))for(const [W,Hh] of SIZES){
  const entered=[];globalThis.__worldDayNight={snapshot:()=>({mode})};resetUiNightWeight();
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:S.records}}),gates:()=>({r5:S.r5,challenges:S.challenges,stages:S.stages}),enterRegion:v=>entered.push(v),enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode})});
  await H.flush();o.sync(W,Hh,true);o.open('journal');const p=o.popups.find('JourneyPanel');assert(p,'journey panel '+W+'x'+Hh);
  for(let i=0;i<60;i++)o.update?.(1/30);
  const tag=mode+'_'+sk+'_'+W+'x'+Hh,frame=p.root.find('PanelFrame');assert(frame,tag+' PanelFrame');const F=box(frame,W,Hh);
  const ptPer=(F.x1-F.x0)/Math.min(330,Math.max(240,W-40)); // pt per layout pt (fitPt shrink on short screens)
  const IN={x0:F.x0+FRAME_IN*ptPer,x1:F.x1-FRAME_IN*ptPer};
  const rows=J.journeyRows({records:S.records,stages:S.stages,regionDone:S.challenges});
  const els=[...p.root.getComponentsInChildren(cc.UITransform).map(t=>t.node).filter(n=>/^(Focus-|Chapter-)/.test(n.name))];
  const cells=els.filter(n=>n.name.startsWith('Chapter-')),card=els.find(n=>n.name.startsWith('Focus-'));assert.equal(cells.length,9,tag);assert(card,tag+' focus card');
  const gb=cells.map(n=>box(n,W,Hh)),G={x0:Math.min(...gb.map(b=>b.x0)),x1:Math.max(...gb.map(b=>b.x1))},C=box(card,W,Hh);
  const q=v=>+(v/ptPer).toFixed(2); // layout pt (harness units / ptPer)
  const gap={gridL:q(G.x0-IN.x0),gridR:q(IN.x1-G.x1),cardL:q(C.x0-IN.x0),cardR:q(IN.x1-C.x1)};
  const BR=box(p.root.find('JourneyBar'),W,Hh);gap.barL=q(BR.x0-IN.x0);gap.barR=q(IN.x1-BR.x1);
  assert(Math.abs(BR.x0-C.x0)<0.05&&Math.abs(BR.x1-C.x1)<0.05&&Math.abs(BR.x0-G.x0)<0.05&&Math.abs(BR.x1-G.x1)<0.05,tag+' bar aligned with card and grid '+JSON.stringify([BR,C,G]));
  for(const [k,v] of Object.entries(gap))assert(v>=MIN_GAP-0.01,`${tag} ${k} gap ${v} pt < ${MIN_GAP} pt to the inner frame`);
  assert(Math.abs(gap.gridL-gap.gridR)<0.05&&Math.abs(gap.cardL-gap.cardR)<0.05,tag+' centred '+JSON.stringify(gap));
  const cellsOut=[];
  for(const r of rows){const n=p.root.find('Chapter-'+r.id),ls=n.getComponentsInChildren(cc.Label),names=ls.map(l=>l.string);
    const seals=n.getComponentsInChildren(cc.UITransform).filter(t=>/Seal/.test(t.node.name)).map(t=>t.node);
    const st=ls.find(l=>l.node.name==='Status');
    if(r.state==='far'){farN++;assert(!r.hasData,tag+' '+r.id+' 远方 only without data');assert.equal(seals.length,0,tag+' '+r.id+' 远方 never has a seal');assert.equal(names[0],'远方');}
    else assert(!names.includes('远方'),tag+' '+r.id+' has data → never 远方');
    if(r.state==='locked'){lockN++;assert(r.hasData);assert(seals.length>=1,tag+' '+r.id+' locked with data has a seal');
      const sp=seals[0].getComponent(cc.Sprite);assert(sp&&sp.grayscale&&sp.color.a<255,tag+' '+r.id+' seal is faint (grey, alpha<255)');
      const lab=J.REGION_DEFS.find(d=>d.id===r.id).unlock.label;assert(st.string===lab||(st.string.endsWith('…')&&lab.startsWith(st.string.slice(0,-1))),tag+' '+r.id+' label '+st.string);
      const fpt=st.fontSize*Math.abs(st.node.worldScale.y)/ptPer;assert(Math.abs(fpt-11)<0.01,tag+' '+r.id+' label 11 pt, got '+fpt);
      assert(!st.enableWrapText&&st.overflow===cc.Label.Overflow.NONE,tag+' '+r.id+' one line, no wrap');
      const lw=st.getComponent(cc.UITransform).width;assert(H.load('ui/PopupKit').measure(st.string,st.fontSize)<=lw+1e-6,tag+' '+r.id+' label fits its line (ellipsis)');}
    cellsOut.push({id:r.id,state:r.state,hasData:r.hasData,...box(n,W,Hh),seal:seals.length?{...box(seals[0],W,Hh),faint:!!seals[0].getComponent(cc.Sprite)?.grayscale}:null,
      labels:ls.map(l=>({n:l.node.name,s:l.string,pt:+(l.fontSize*Math.abs(l.node.worldScale.y)/ptPer).toFixed(2),...box(l.node,W,Hh),rgb:[l.color.r,l.color.g,l.color.b]}))});}
  // region page for every locked-with-data region: button text = cell label + 开启, disabled, tap enters nothing
  let chapterDump=null;
  for(const r of rows.filter(x=>x.state==='locked')){const jp=o.popups.find('JourneyPanel');assert(jp,tag+' journal open');const cellLabel=jp.root.find('Chapter-'+r.id).getComponentsInChildren(cc.Label).find(l=>l.node.name==='Status').string;
    H.tap(jp.root.find('Chapter-'+r.id));await H.flush();const c=o.popups.find('ChapterPanel');assert(c,tag+' '+r.id+' locked-with-data opens its region page');
    const btn=c.root.find('Continue-'+r.id);assert(btn,tag+' '+r.id+' button');const bl=btn.getComponentsInChildren(cc.Label)[0].string;
    assert.equal(bl,J.REGION_DEFS.find(d=>d.id===r.id).unlock.label+'开启',tag+' '+r.id+' button = §13.2 label + 开启');assert.equal(bl,cellLabel+'开启',tag+' '+r.id+' button = cell label + 开启');
    assert(btn.__disabled===true,tag+' '+r.id+' button disabled');const before=entered.length;H.tap(btn);await H.flush();assert.equal(entered.length,before,tag+' '+r.id+' disabled button enters nothing');
    { const BB=box(btn,W,Hh),CNT=c.root.find('ChapterCount');const top=CNT?box(CNT,W,Hh).y1:-1e9;
      assert(!c.root.find('VisitSkycity')&&!c.root.find('ChapterCondition'),tag+' '+r.id+' locked page: no extra line / condition text above the button');
      const above=c.root.getComponentsInChildren(cc.Label).filter(l=>!btn.getComponentsInChildren(cc.Label).includes(l)).map(l=>({s:l.string,b:box(l.node,W,Hh)})).filter(x=>x.b.y0>=top-0.01&&x.b.y1<=BB.y0+0.01);
      assert.deepEqual(above.map(x=>x.s),[],tag+' '+r.id+' locked page: no text node between the content and the grey button'); }
    btnN++;if(!chapterDump&&r.id==='sky'){const CF=c.root.find('PanelFrame');chapterDump={region:r.id,frame:box(CF,W,Hh),ptPerLayoutPt:+((box(CF,W,Hh).x1-box(CF,W,Hh).x0)/(c.width*Math.abs(CF.parent.worldScale.x))*c.width/c.width).toFixed(4),
      nodes:c.root.getComponentsInChildren(cc.UITransform).map(t=>t.node).filter(n=>n!==CF&&n.activeInHierarchy!==false).map(n=>{const l=n.getComponent(cc.Label),sp=n.getComponent(cc.Sprite);return {n:n.name,...box(n,W,Hh),label:l?l.string:undefined,pt:l?+(l.fontSize*Math.abs(n.worldScale.y)/ptPer).toFixed(2):undefined,rgb:l?[l.color.r,l.color.g,l.color.b]:undefined,sprite:sp?1:undefined,disabled:n.__disabled||undefined};})};}
    o.close();await H.flush();o.open('journal');await H.flush();}
  if(OUT&&chapterDump)fs.writeFileSync(path.join(OUT,'chapter_sky_'+tag+'.layout.json'),JSON.stringify({tag,W,H:Hh,mode,state:sk,ptPer,...chapterDump},null,1));
  // dev wording: journal + every tappable region page (locked and unlocked)
  {const scan=(root,where)=>{for(const l of root.getComponentsInChildren(cc.Label)){devN++;assert(!DEV.test(l.string),tag+' '+where+' dev wording: '+l.string);}};
   const jp=o.popups.find('JourneyPanel');scan(jp.root,'journal');
   for(const r of rows.filter(x=>x.tappable)){const j2=o.popups.find('JourneyPanel');H.tap(j2.root.find('Chapter-'+r.id));await H.flush();const c=o.popups.find('ChapterPanel');assert(c,tag+' '+r.id+' page');scan(c.root,r.id+' page');pagesN++;o.close();await H.flush();o.open('journal');await H.flush();}}
  combos++;table.push([tag,gap.gridL,gap.gridR,gap.cardL,gap.cardR,gap.barL,gap.barR]);
  if(OUT){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'journey_'+tag+'.layout.json'),JSON.stringify({tag,W,H:Hh,mode,state:sk,ptPerLayoutPt:+ptPer.toFixed(4),frame:F,innerFrame:IN,gaps:gap,
    card:{...C,labels:card.getComponentsInChildren(cc.Label).map(l=>({n:l.node.name,s:l.string,pt:+(l.fontSize*Math.abs(l.node.worldScale.y)/ptPer).toFixed(2),...box(l.node,W,Hh)}))},bar:p.root.find('JourneyBar')?box(p.root.find('JourneyBar'),W,Hh):null,cells:cellsOut},null,1));}
  o.dispose();}
// unlocked 天空之城 page: the visit line reads exactly 前往天空城 (mainline 8 cleared); dumped for the outbox
for(const mode of ['day','night']){const [W,Hh]=[390,844];globalThis.__worldDayNight={snapshot:()=>({mode})};resetUiNightWeight();
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(9)}}),gates:()=>({r5:[],challenges:{},stages:SHIPPED}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode})});
  await H.flush();o.sync(W,Hh,true);o.open('sky');await H.flush();const c=o.popups.find('ChapterPanel');assert(c,'unlocked sky page');
  const v=c.root.find('VisitSkycity');assert(v,'unlocked sky keeps the visit line');assert.equal(v.getComponentsInChildren(cc.Label)[0].string,'前往天空城');
  for(const l of c.root.getComponentsInChildren(cc.Label))assert(!DEV.test(l.string),'unlocked sky dev wording '+l.string);
  if(OUT){const CF=c.root.find('PanelFrame'),F=box(CF,W,Hh),pp=(F.x1-F.x0)/Math.min(330,Math.max(240,W-40));
    fs.writeFileSync(path.join(OUT,'chapter_sky_'+mode+'_unlocked_'+W+'x'+Hh+'.layout.json'),JSON.stringify({tag:mode+'_unlocked_'+W+'x'+Hh,W,H:Hh,mode,state:'unlocked',ptPer:pp,region:'sky',frame:F,
      nodes:c.root.getComponentsInChildren(cc.UITransform).map(t=>t.node).filter(n=>n!==CF).map(n=>{const l=n.getComponent(cc.Label),sp=n.getComponent(cc.Sprite);return {n:n.name,...box(n,W,Hh),label:l?l.string:undefined,pt:l?+(l.fontSize*Math.abs(n.worldScale.y)/pp).toFixed(2):undefined,rgb:l?[l.color.r,l.color.g,l.color.b]:undefined,sprite:sp?1:undefined,disabled:n.__disabled||undefined};})},null,1));}
  o.dispose();}
delete globalThis.__worldDayNight;
// ellipsis unit check: a label wider than its cell is cut with … and stays on one line
{const m=H.load('ui/PopupKit').measure,t=B.ellipsize('一二三四五六七八九十',11,40);assert(t.endsWith('…')&&m(t,11)<=40,t);assert.equal(B.ellipsize('主线08后',11,200),'主线08后');}
console.log('JOURNEY_GAPS '+JSON.stringify(table));
checks.push(`no player-visible 3D/场景 dev wording: ${devN} labels on the journal + ${pagesN} region pages over 28 combos, plus unlocked 天空之城 page (visit line = 前往天空城)`);
checks.push(`locked pages have no text between the content and the grey button; region page of every locked-with-data region: disabled button = cell §13.2 label + 开启, tap enters nothing (${btnN} pages)`);
checks.push(`progress bar + grid + focus card ≥${MIN_GAP} pt to the inner frame (inset ${FRAME_IN}) aligned, centred on ${combos} combos (7 screens × day/night × early/late)`);
checks.push(`远方 only without data, never a seal (${farN} cells); locked-with-data: faint seal + one-line 11 pt §13.2 label, no wrap, ellipsis (${lockN} cells)`);
for(const c of checks)console.log('PASS '+c);console.log(JSON.stringify({status:'PASS',checks},null,2));
})().catch(e=>{console.error(e);process.exit(1);});
