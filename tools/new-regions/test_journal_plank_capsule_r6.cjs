'use strict';
// r6c: + 375×667 / 414×736 (no-notch: safe top 20, capsule 24–56); fallback logs one [QF_SAFE] warning.
// journal r6 P3 (界面验收部 a5cf58fa device, ui-audit/2026-10-31/journal-a5cf58fa-device annot/S320_capsule_journal_day.png): at
// 320×568 the JourneyPanel title plank top was 33 pt, the capsule bottom 42 pt (9 pt overlap). The journey book now uses the region
// page's clearance (max(safe top, capsule bottom) + 8 pt) via JourneyPanels.journalFit: the book only MOVES down (no shrink — its
// text is at the 11 pt floor of journey-layout-r4), clamped to its own 8 pt bottom margin.
//  - 320/375/390/414 with device-like wx window/safe/capsule info, day + night: plank top ≥ max(safe top, capsule bottom) + 8,
//    panel bottom ≤ H − 8; 320 plank top ≥ 50 pt; every JourneyPanel node = old box + dy (pure vertical move, same size).
//  - sizes whose old (centred) plank already cleared: dy = 0, every node box identical (pixel-identical).
//  - negative: the a5cf58fa geometry (no clearance) puts the 320 plank into the capsule band.
const assert=require('node:assert/strict'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),cc=H.cc,{IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay'),{resetUiNightWeight}=H.load('ui/NightTint'),{boardSafeInsets}=H.load('ui/BoardLayout');
// device-like WeChat info (320: measured on DevTools iPhone 5 by 全流程测试部 chainS: capsule top 10 / bottom 42)
const DEV={320:{H:568,safe:{top:20,bottom:568,left:0,right:320},cap:{top:10,bottom:42,left:222,right:310}},
 375:{H:812,safe:{top:44,bottom:778,left:0,right:375},cap:{top:48,bottom:80,left:281,right:368}},
 390:{H:844,safe:{top:47,bottom:810,left:0,right:390},cap:{top:51,bottom:83,left:297,right:384}},
 375667:{W:375,H:667,safe:{top:20,bottom:667,left:0,right:375},cap:{top:24,bottom:56,left:281,right:368}},
 414736:{W:414,H:736,safe:{top:20,bottom:736,left:0,right:414},cap:{top:24,bottom:56,left:320,right:407}},
 414:{H:896,safe:{top:48,bottom:862,left:0,right:414},cap:{top:52,bottom:84,left:320,right:407}}};
const box=(n,W,Hh)=>{const t=n.getComponent(cc.UITransform),p=n.worldPosition,s=n.worldScale,w=t.width*Math.abs(s.x),h=t.height*Math.abs(s.y);const cx=p.x+W/2;return {x0:cx-w*t.anchorX,x1:cx+w*(1-t.anchorX),y0:Hh/2-p.y-h*(1-t.anchorY),y1:Hh/2-p.y+h*t.anchorY};};
const all=(root,W,Hh)=>{const out=[];const walk=(n,path)=>{const t=n.getComponent(cc.UITransform);if(t&&n.activeInHierarchy&&path.includes('/PopupPanel'))out.push([path,box(n,W,Hh)]);/* full-screen root + shade are not part of the book */n.children.forEach((c,i)=>walk(c,path+'/'+c.name+'#'+i));};walk(root,root.name);return out;};
async function open(W,Hh,mode,clear){globalThis.__worldDayNight={snapshot:()=>({mode})};resetUiNightWeight();
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:Array.from({length:12},(_,i)=>({bestStars:i<3?1:0}))}}),gates:()=>({r5:[],challenges:{},stages:[],r4:[{unlocked:true}]}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode})});
  await H.flush();o.sync(W,Hh,true);if(!clear)o.safe=null;/* a5cf58fa: journey book ignored the insets */o.open('journal');await H.flush();const p=o.popups.find('JourneyPanel');assert(p);for(let i=0;i<4;i++)p.update(1);return {o,p};}
(async()=>{const rows=[];
for(const mode of ['day','night'])for(const key of [320,375,390,414,375667,414736]){const d=DEV[key],W=d.W||key,Hh=d.H;
  globalThis.wx={getWindowInfo:()=>({windowWidth:W,windowHeight:Hh,safeArea:d.safe}),getMenuButtonBoundingClientRect:()=>d.cap};
  const si=boardSafeInsets(W,Hh),need=Math.max(si.top,si.capsule.bottom)+8,botLim=Hh-8;
  const A=await open(W,Hh,mode,true),Ta=box(A.p.root.find('TitlePlank'),W,Hh),Fa=box(A.p.root.find('PanelFrame'),W,Hh),la=all(A.p.root,W,Hh);A.o.dispose();
  const B=await open(W,Hh,mode,false),Tb=box(B.p.root.find('TitlePlank'),W,Hh),lb=all(B.p.root,W,Hh),Fb=box(B.p.root.find('PanelFrame'),W,Hh);B.o.dispose();
  const tag=`${mode} ${W}x${Hh}`;
  assert(Ta.y0>=need-0.01,`${tag}: plank top ${Ta.y0.toFixed(2)} < ${need}`);assert(Fa.y1<=botLim+0.01,`${tag}: panel bottom ${Fa.y1.toFixed(2)} > ${botLim}`);
  assert.equal(la.length,lb.length,tag+' same nodes');
  const dy=Ta.y0-Tb.y0;let maxd=0;
  for(let i=0;i<la.length;i++){const [pa,a]=la[i],[pb,b]=lb[i];assert.equal(pa,pb);const e=Math.max(Math.abs(a.x0-b.x0),Math.abs(a.x1-b.x1),Math.abs(a.y0-dy-b.y0),Math.abs(a.y1-dy-b.y1));maxd=Math.max(maxd,e);}
  const cleared=Tb.y0>=need-0.01;
  assert(maxd<1e-6,`${tag}: layout changed beyond a vertical move (max ${maxd})`);
  if(cleared)assert(Math.abs(dy)<1e-9,`${tag}: old plank already cleared, must stay put (moved ${dy})`);
  rows.push(`${tag}: capsule bottom ${si.capsule.bottom} (clear ≥ ${need}); plank top before ${Tb.y0.toFixed(2)} → after ${Ta.y0.toFixed(2)} (${cleared?'unchanged: '+la.length+' nodes identical':'moved down '+dy.toFixed(2)+' pt, no shrink, '+la.length+' nodes translated only'}); panel bottom ${Fb.y1.toFixed(2)} → ${Fa.y1.toFixed(2)} ≤ ${botLim}`);}
// r6b: the offset follows the RUNTIME capsule rect (wx.getMenuButtonBoundingClientRect via boardSafeInsets), not a constant.
//  capsule bottom 42 and 60 at 320×568 → plank top = bottom + 8; no/invalid capsule → boardSafeInsets fallback (safe top 47 →
//  capsule 51–83). Move only, never shrink: where the 8 pt bottom margin stops the move, the clamp is asserted and reported.
for(const [label,cap] of [['capsule 42',{top:10,bottom:42,left:222,right:310}],['capsule 60',{top:28,bottom:60,left:222,right:310}],['fallback (no menu rect)',null],['fallback (invalid rect)',{top:10,bottom:400,left:222,right:310}]]){
 globalThis.wx={getWindowInfo:()=>({windowWidth:320,windowHeight:568,safeArea:DEV[320].safe}),getMenuButtonBoundingClientRect:()=>cap};
 const si=boardSafeInsets(320,568),need=Math.max(si.top,si.capsule.bottom)+8,A=await open(320,568,'day',true),T=box(A.p.root.find('TitlePlank'),320,568),F=box(A.p.root.find('PanelFrame'),320,568),la=all(A.p.root,320,568);A.o.dispose();
 const B=await open(320,568,'day',false),Tb=box(B.p.root.find('TitlePlank'),320,568),Fb=box(B.p.root.find('PanelFrame'),320,568);B.o.dispose();
 assert(Math.abs((F.y1-F.y0)-(Fb.y1-Fb.y0))<1e-6&&Math.abs((F.x1-F.x0)-(Fb.x1-Fb.x0))<1e-6,label+': never shrinks');assert(F.y1<=568-8+1e-6,label+': bottom margin');
 if(cap&&cap.bottom<100)assert.equal(si.capsule.bottom,cap.bottom,label+': runtime rect used');else assert.equal(si.capsule.bottom,83,label+': fallback capsule');
 const clamped=T.y0<need-0.01;if(clamped)assert(Math.abs(F.y1-560)<1e-6,label+': short of the clearance only when the 8 pt bottom margin stops the move');
 rows.push(`320x568 ${label}: capsule bottom ${si.capsule.bottom} → need ${need}; plank top ${Tb.y0.toFixed(2)} → ${T.y0.toFixed(2)}; panel bottom ${Fb.y1.toFixed(2)} → ${F.y1.toFixed(2)} (limit 560)${clamped?` — CLAMPED by the bottom margin, plank ${(need-T.y0).toFixed(2)} pt short, no shrink`:''}`);}
// r6c (5): the fallback path logs ONE warning line per session ([QF_SAFE] …), the device path none
{const BL=H.load('ui/BoardLayout'),w0=console.warn;let warns=[];console.warn=(...a)=>{warns.push(a.join(' '));};
 try{BL.resetCapsuleFallbackWarning();globalThis.wx={getWindowInfo:()=>({windowWidth:320,windowHeight:568,safeArea:DEV[320].safe}),getMenuButtonBoundingClientRect:()=>DEV[320].cap};BL.boardSafeInsets(320,568);
  assert.equal(warns.filter(x=>x.includes('[QF_SAFE]')).length,0,'device capsule: no warning');
  globalThis.wx={getWindowInfo:()=>({windowWidth:320,windowHeight:568,safeArea:DEV[320].safe}),getMenuButtonBoundingClientRect:()=>null};for(let i=0;i<5;i++)BL.boardSafeInsets(320,568);
  const q=warns.filter(x=>x.includes('[QF_SAFE]'));assert.equal(q.length,1,'fallback: exactly one warning line, got '+q.length);rows.push('fallback warning (once): '+q[0]);}finally{console.warn=w0;}}
// 320 explicit + negative
{globalThis.wx={getWindowInfo:()=>({windowWidth:320,windowHeight:568,safeArea:DEV[320].safe}),getMenuButtonBoundingClientRect:()=>DEV[320].cap};
 const A=await open(320,568,'day',true),Ta=box(A.p.root.find('TitlePlank'),320,568);A.o.dispose();assert(Ta.y0>=50,'320 plank top ≥ 50 pt: '+Ta.y0);
 const B=await open(320,568,'day',false),Tb=box(B.p.root.find('TitlePlank'),320,568);B.o.dispose();assert(Tb.y0<42,'negative: a5cf58fa geometry must overlap the 320 capsule (plank '+Tb.y0.toFixed(2)+' < 42)');
 rows.push(`negative a5cf58fa 320x568: plank top ${Tb.y0.toFixed(2)} < capsule bottom 42 → overlap ${(42-Tb.y0).toFixed(2)} pt (FAILS the clearance)`);}
delete globalThis.wx;delete globalThis.__worldDayNight;
console.log(rows.join('\n'));console.log('PASS journal-plank-capsule-r6');process.exit(0);
})().catch(e=>{console.error('FAIL',e&&e.stack||e);process.exit(1);});
