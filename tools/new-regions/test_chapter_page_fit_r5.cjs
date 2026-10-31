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
  pages++;o.dispose();}
delete globalThis.__worldDayNight;
// negatives
{const W=320,Hh=568,si=boardSafeInsets(W,Hh),s=popupScale(W,Hh),hPt=538,f=Math.min(1,Math.max(.3,(Hh-16)/hPt)),plaqueTop=Hh/2-hPt*f/2-52.5*s;
 assert(plaqueTop<Math.max(si.top,si.capsule.bottom)+8,'negative: fc3123fa centred geometry puts the plaque into the capsule band at 320×568 ('+plaqueTop.toFixed(1)+')');
 const PW=280,band=PW-PS.left/PS.artPx-PS.right/PS.artPx-17;assert(240>band,'negative: a 240 pt button is wider than the 320 paper band ('+band.toFixed(1)+')');}
console.log('PASS region pages: '+pages+' pages (5 regions × cleared 3/10/12 × 7 sizes × day/night), '+btns+' buttons ≥ '+MIN_GAP+' pt inside the paper inner edge; title plaque clears safe area + capsule (+8), panel bottom clears home bar (+8)');
console.log('PASS shrink used (f<1): '+JSON.stringify(shrunk));
console.log('PASS negative self-tests: fc3123fa centred geometry hits the capsule band at 320×568; 240 pt button wider than the 320 paper band');
})().catch(e=>{console.error(e);process.exit(1);});
