'use strict';
// r5 P3 (界面验收部 device, journal-3277421c-device annot/compare; both already on fc3123fa):
//  1. every region-page button (Continue-*, 「前往天空城」 VisitSkycity, 「旧日潮汐」 LegacyTide) is min(240, paper inner − 2·8.5) wide and
//     sits ≥ 8 pt inside the paper inner edge (one shared rule) — 7 sizes × day/night, every region, locked / gated / open states;
//  2. the title plaque (TitlePlank, 52.5 design px above the panel) clears max(safe top, capsule bottom) + 8 pt and the panel bottom
//     clears the home bar + 8 pt (insets from the host's cached safe info, boardSafeInsets defaults on the box: top 47, capsule 51–83,
//     bottom 34). Reports the scale f used where the panel had to shrink.
//  Negative: the fc3123fa geometry (centred, f = fitPt only) puts the plaque above the capsule at 320×568; a 240 pt button leaves the
//  paper at 320.
const assert=require('node:assert/strict'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),cc=H.cc,J=H.load('ui/JourneyCore'),B=H.load(path.join(H.BUNDLES,'board_art/journey_ui/JourneyPanels.ts')).createJourneyUi(H.load('ui/JourneyUi').journeyUiHost());
const {IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay'),{resetUiNightWeight}=H.load('ui/NightTint'),{popupScale}=H.load('ui/PopupKit'),{boardSafeInsets}=H.load('ui/BoardLayout');
const SIZES=[[320,568],[360,780],[375,667],[390,844],[393,852],[414,896],[430,932]],PS=B.PAPER_INNER_SRC,MIN_GAP=8;
const SHIPPED=[...Array.from({length:12},(_,i)=>({id:'r05-x-'+i,region:['tide','meadow','sky'][i%3]})),...Array.from({length:6},(_,i)=>({id:'r05-lake-0'+(i+1),region:'lake'})),...Array.from({length:9},(_,i)=>({id:'r06-coast-0'+(i+1),region:'coast'}))];
const rec=n=>Array.from({length:12},(_,i)=>({bestStars:i<n?1:0}));
const box=(n,W,Hh)=>{const t=n.getComponent(cc.UITransform),p=n.worldPosition,s=n.worldScale,w=t.width*Math.abs(s.x),h=t.height*Math.abs(s.y);const cx=p.x+W/2;return {x0:cx-w*t.anchorX,x1:cx+w*(1-t.anchorX),y0:Hh/2-p.y-h*(1-t.anchorY),y1:Hh/2-p.y+h*t.anchorY};};
const CG={tide:4,meadow:8,sky:12};
// r5 P2-1 orphan check (界面验收部 e06c8240): every journal text Label (description, cells, focus card, buttons) — the lines the Label
// will draw: explicit \n lines, or Cocos' greedy CJK char wrap when wrap is on and the text is wider than the box. A multi-line text must
// keep ≥ JOURNAL_MIN_LAST chars on the last line, never split a known word, never start a line with closing punctuation, and every
// explicit line must fit (so Cocos never re-wraps it).
const {measure}=H.load('ui/PopupKit');
const greedy=(t,w,fs)=>{const out=[];let l='';for(const c of Array.from(t)){if(l&&measure(l+c,fs)>w){let carry='';if('。，、；：！？」）'.includes(c)&&l.length>1){carry=l.slice(-1);l=l.slice(0,-1);}out.push(l);l=carry;}l+=c;}out.push(l);return out;};// Cocos char wrap: CJK anywhere, closing punctuation pulls the previous char down
const drawn=l=>{const w=l.node.getComponent(cc.UITransform).width,fs=l.fontSize,s=String(l.string||'');if(s.includes('\n'))return {lines:s.split('\n'),explicit:true,w,fs};return {lines:l.enableWrapText&&measure(s,fs)>w?greedy(s,w,fs):[s],explicit:false,w,fs};};
const orphan=(d)=>{const L=d.lines;if(L.length<2)return null;const last=Array.from(L[L.length-1]);if(last.length<B.JOURNAL_MIN_LAST)return 'last line 「'+L[L.length-1]+'」 has '+last.length+' chars';
  for(let i=1;i<L.length;i++){if(B.splitsWord(L[i-1],L[i]))return 'word split 「'+L[i-1]+' / '+L[i]+'」';if('。，、；：！？」）'.includes(L[i][0]))return 'line starts with 「'+L[i][0]+'」';}
  if(d.explicit)for(const x of L)if(measure(x,d.fs)>d.w+1e-6)return 'explicit line 「'+x+'」 wider than its box';return null;};
let orphanLabels=0;const checkTexts=(root,tag)=>{for(const l of root.getComponentsInChildren(cc.Label)){if(!l.node.activeInHierarchy||!l.string)continue;const why=orphan(drawn(l));assert(!why,`${tag}: ${l.node.name} 「${l.string}」: ${why}`);orphanLabels++;}};
// r5 P2-2: exactly one visible title plaque and one visible × while the region page is open over the journey book.
const visible=n=>{for(let x=n;x;x=x.parent){if(!x.active)return false;const op=x.getComponent&&x.getComponent(cc.UIOpacity);if(op&&op.opacity===0&&x!==n)return false;}return true;};
const countTop=(o)=>{let plaques=0,closes=0;for(const n of [...o.popups.parent.children]){const walk=m=>{if(m.name==='TitlePlank'&&visible(m))plaques++;if(m.name==='Close'&&visible(m))closes++;for(const c of m.children)walk(c);};walk(n);}return {plaques,closes};};
let stacked=0;
(async()=>{let pages=0,btns=0;const shrunk={};
for(const mode of ['day','night'])for(const [W,Hh] of SIZES)for(const cl of [3,10,12])for(const id of ['tide','meadow','sky','lake','coast']){
  globalThis.__worldDayNight={snapshot:()=>({mode})};resetUiNightWeight();
  const r5=Object.entries(CG).map(([region,N])=>({region,ok:cl>=N,reason:cl>=N?undefined:'stage-locked'}));
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(cl)}}),gates:()=>({r5,challenges:{},stages:SHIPPED,r4:[{unlocked:true}]}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode})});
  await H.flush();o.sync(W,Hh,true);o.open(id);await H.flush();const p=o.popups.find('ChapterPanel'),tag=`${mode} ${W}x${Hh} ${id} cleared${cl}`;assert(p,tag);for(let i=0;i<4;i++)p.update(1);
  const F=box(p.root.find('PanelFrame'),W,Hh),fu=(F.x1-F.x0)/p.width,IN={x0:F.x0+PS.left/PS.artPx*fu,x1:F.x1-PS.right/PS.artPx*fu},ptPer=fu*(p.width/(F.x1-F.x0))*(F.x1-F.x0)/p.width;
  const pt=1;// screen pt
  for(const name of ['Continue-'+id,'VisitSkycity','LegacyTide']){const n=p.root.find(name);if(!n)continue;const b=box(n,W,Hh),gl=b.x0-IN.x0,gr=IN.x1-b.x1;
    assert(gl>=MIN_GAP-0.01&&gr>=MIN_GAP-0.01,`${tag}: ${name} gaps ${gl.toFixed(2)} / ${gr.toFixed(2)} pt to the paper inner edge`);btns++;}
  const si=boardSafeInsets(W,Hh),top=Math.max(si.top,si.capsule?.bottom||0)+8,bot=si.bottom+8,T=box(p.root.find('TitlePlank'),W,Hh);
  assert(T.y0>=top-0.01,`${tag}: title plaque top ${T.y0.toFixed(2)} < safe/capsule clear ${top}`);assert(F.y1<=Hh-bot+0.01,`${tag}: panel bottom ${F.y1.toFixed(2)} > ${Hh-bot}`);
  const hPt=430+(id==='tide'||id==='sky'?52:0)+56,fit=B.chapterFit({width:W,height:Hh,safeInsets:si},hPt);if(fit.f<1)shrunk[W+'x'+Hh+' '+id]=+fit.f.toFixed(3);
  checkTexts(p.root,tag);pages++;o.dispose();}
for(const mode of ['day','night'])for(const [W,Hh] of SIZES)for(const cl of [3,12])for(const id of ['tide','meadow','sky','lake','coast']){
  globalThis.__worldDayNight={snapshot:()=>({mode})};resetUiNightWeight();
  const r5=Object.entries(CG).map(([region,N])=>({region,ok:cl>=N,reason:cl>=N?undefined:'stage-locked'}));
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(cl)}}),gates:()=>({r5,challenges:{},stages:SHIPPED,r4:[{unlocked:true}]}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode})});
  await H.flush();o.sync(W,Hh,true);o.open('journal');await H.flush();const jp=o.popups.find('JourneyPanel'),tag=`${mode} ${W}x${Hh} journal→${id} cleared${cl}`;assert(jp,tag);for(let i=0;i<4;i++)jp.update(1);
  checkTexts(jp.root,tag+' (journey book)');o.chapter(id);await H.flush();const p=o.popups.find('ChapterPanel');assert(p,tag);for(let i=0;i<4;i++){p.update(1);jp.update(1);}
  const c=countTop(o);assert.equal(c.plaques,1,`${tag}: ${c.plaques} visible title plaques`);assert.equal(c.closes,1,`${tag}: ${c.closes} visible ×`);
  if(mode==='day'&&W===320&&id==='lake'&&cl===3){jp.body.active=true;const e=countTop(o);assert(e.plaques===2&&e.closes===2,'negative: e06c8240 layout (book left visible under the page) must show 2 plaques / 2 × at 320×568, got '+JSON.stringify(e));jp.body.active=false;}
  p.close();for(let i=0;i<4;i++){p.update(1);jp.update(1);}assert(jp.alive&&jp.body.active,`${tag}: journey book shown again after the page closes`);
  stacked++;o.dispose();}
delete globalThis.__worldDayNight;
// negatives
{const W=320,Hh=568,si=boardSafeInsets(W,Hh),s=popupScale(W,Hh),hPt=538,f=Math.min(1,Math.max(.3,(Hh-16)/hPt)),plaqueTop=Hh/2-hPt*f/2-52.5*s;
 assert(plaqueTop<Math.max(si.top,si.capsule.bottom)+8,'negative: fc3123fa centred geometry puts the plaque into the capsule band at 320×568 ('+plaqueTop.toFixed(1)+')');
 const PW=280,band=PW-PS.left/PS.artPx-PS.right/PS.artPx-17;assert(240>band,'negative: a 240 pt button is wider than the 320 paper band ('+band.toFixed(1)+')');}
console.log('PASS region pages: '+pages+' pages (5 regions × cleared 3/10/12 × 7 sizes × day/night), '+btns+' buttons ≥ '+MIN_GAP+' pt inside the paper inner edge; title plaque clears safe area + capsule (+8), panel bottom clears home bar (+8)');
console.log('PASS shrink used (f<1): '+JSON.stringify(shrunk));
{const d={lines:greedy('夕阳下的湖面，敲响漂在水上的风铃。',247.5,15),explicit:false,w:247.5,fs:15};assert.deepEqual(d.lines.slice(-1),['铃。'],'negative: greedy wrap reproduces 风/铃。 '+JSON.stringify(d.lines));assert(orphan(d),'negative: orphan check catches 「风/铃。」');
 assert.deepEqual(B.journalLines('夕阳下的湖面，敲响漂在水上的风铃。',247.5,15),['夕阳下的湖面，','敲响漂在水上的风铃。'],'breaks after the comma');
 assert(orphan({lines:['夕阳下的湖面敲响漂在水上的风','铃'],explicit:true,w:999,fs:15}),'negative: explicit orphan caught');}
console.log('PASS orphan check: '+orphanLabels+' visible journal labels (region pages + journey book, 7 sizes × day/night): last line ≥ '+B.JOURNAL_MIN_LAST+' chars, no split word, no leading closing punctuation, explicit lines fit');
console.log('PASS one plaque / one ×: '+stacked+' journey book → region page stacks (7 sizes × day/night × 5 regions × cleared 3/12); book shown again on close');
console.log('PASS negative self-tests: fc3123fa centred geometry hits the capsule band at 320×568; 240 pt button wider than the 320 paper band; greedy 「风/铃。」 caught; e06c8240 stack shows 2 plaques / 2 ×');
})().catch(e=>{console.error(e);process.exit(1);});
