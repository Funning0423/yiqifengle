'use strict';
/* compact-hud (P1, Grok Bot 10/30 option (i); UI设计部 SPEC 46649fd4 §3/§5/§8, 8.x, 8.y authoritative). Coast config only.
 * - trigger: portrait and logical h ≤ 600 → exactly 320×568 and 390×520 of the 7 screens (+ the SPEC's 393×852/430×932 stay normal).
 * - kit data = layout: compact no-go [131, h − 94] (474 / 426), ruleGuidePlateBottom 131; COAST_KIT selects compact, default kit has no HUD data.
 * - every element inside the screen (≥ 0) and out of the board band [131, h−94]: pause, label, hint pill (y 49–85), goal bar (95–131),
 *   tools; pause hit 44, tool hit 52 (≥ 44), tool step 64 (12 pt between tool hit areas), label clear of pause hit (+10) and capsule (−10).
 * - truncation: 320 ≤ 7 name chars else 6 + '…', 390 ≤ 12; '05 · ' always kept (longname 「灯塔下的潮汐小路」→「05 · 灯塔下的潮汐…」).
 * - hint: real copy wraps after '，' on 320 (pill 104), one line on 390 (188); ≤ 2 lines; holdS = clamp(0.45+n/4, 2.5, 4.5) visible only (3.70 s).
 * - night: moves cyan [0,22,26], text TEXT_NIGHT.brown, sprites × K_UI, hourglass + divider alpha 1, divider margin 6.
 * Self-checks: a tool row moved into the band, and a 9-char name not cut on 320, must each be detected. */
const assert=require('node:assert/strict');const {createHarness}=require('./harness.cjs');const H=createHarness();
const CH=H.load('ui/CompactHud'),K=H.load('ui/BoardKit'),B=H.load('ui/BoardProjection'),L=H.load('ui/BoardLayout'),NT=H.load('ui/NightTint'),R=require('../ui-timing/known-timings.json');
const ALL=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024],[393,852],[430,932]];
assert.deepEqual(ALL.filter(([w,h])=>CH.compactHudApplies(w,h)).map(s=>s.join('x')),['320x568','390x520'],'trigger');
assert.equal(K.DEFAULT_KIT.hud,undefined,'default kit has no HUD variant data');assert.equal(K.COAST_KIT.hud.select,'compact');
function elements(c,w,h,goals){return [['pause',{l:c.pause.x-22,r:c.pause.x+22,t:c.pause.y-22,b:c.pause.y+22}],['label',{l:c.label.x,r:c.label.x+c.label.maxWidth,t:c.label.y-14,b:c.label.y+14}],
 ['hint',{l:c.toast.x,r:c.toast.x+c.toast.maxWidth,t:c.toast.top,b:c.toast.bottom}],['goalBar',{l:w/2-c.goalBar.width(goals)/2,r:w/2+c.goalBar.width(goals)/2,t:c.goalBar.top,b:c.goalBar.bottom}],
 ...[1,2,3].map(n=>['tools'+n,{l:w/2-((n-1)*c.tools.step)/2-c.tools.hit/2,r:w/2+((n-1)*c.tools.step)/2+c.tools.hit/2,t:c.tools.hitTop,b:c.tools.hitTop+c.tools.hit}])];}
function check(c,w,h,safe){const bad=[];for(const g of [1,2,3])for(const [n,r] of elements(c,w,h,g)){if(r.l<0||r.r>w||r.t<0||r.b>h)bad.push(n+' off screen');
 if(r.b>c.limits[0]+1e-9&&r.t<c.limits[1]-1e-9)bad.push(n+' inside the board band');}
 if(c.tools.hitTop+c.tools.hit>h-Math.max(safe.bottom,0)-8+1e-9)bad.push('tools within 8 pt of the safe bottom');return [...new Set(bad)];}
for(const [w,h] of [[320,568],[390,520]]){const safe=L.boardSafeInsets(w,h),c=CH.compactHudLayout(w,h,safe),k=w+'x'+h,v=K.COAST_KIT.hud.variants.compact;
 assert.deepEqual([...c.limits],[131,h-94],k+' limits');assert.deepEqual([...v.screens[k]],[...c.limits],k+' kit data = layout');assert.equal(v.ruleGuidePlateBottom,131);
 const hl=B.kitHudLimits(K.COAST_KIT,w,h);assert.equal(hl.variant,'compact');assert.deepEqual([hl.top,hl.bottom],[131,h-94]);
 assert.equal(c.pause.hit,44);assert.equal(c.tools.hit,52);assert.ok(c.tools.hit>=44);assert.equal(c.tools.size,48);assert.equal(c.tools.step-c.tools.hit,12);
 assert.equal(c.goalBar.top,95);assert.equal(c.goalBar.bottom,131);assert.equal(c.toast.top,49);assert.equal(c.toast.bottom,85);assert.equal(c.label.x,70);
 assert.equal(c.label.maxWidth,w===320?147:217,k+' slot width');assert.ok(c.label.x>=c.pause.x+22+10&&c.label.x+c.label.maxWidth<=safe.capsule.left-10+1e-9);
 const bad=check(c,w,h,safe);assert.deepEqual(bad,[],k+': '+bad.join('; '));
 const moved={...c,tools:{...c.tools,hitTop:c.limits[1]-20}};assert.ok(check(moved,w,h,safe).some(x=>/band/.test(x)),'self-check: tools in the band not detected');
 const t=CH.compactToastLines('拖动相邻两颗，三颗一样就消除',c.toast.maxWidth);assert.ok(t.lines.length<=2&&t.width<=c.toast.maxWidth);
 if(w===320){assert.deepEqual(t.lines,['拖动相邻两颗，','三颗一样就消除']);assert.equal(t.width,104);}else{assert.equal(t.lines.length,1);assert.equal(t.width,188);}
 console.log(`ok   ${k}: band [${c.limits}], pill y ${c.toast.top}–${c.toast.bottom}, goal bar ${c.goalBar.top}–${c.goalBar.bottom}, tools hit ${c.tools.hitTop}–${c.tools.hitTop+c.tools.hit} (52, step 64), hint ${t.lines.join('/')} w ${t.width}; all elements on screen and out of the band`);}
assert.equal(CH.compactLevelLabel(5,'灯塔下的潮汐小路',320),'05 · 灯塔下的潮汐…');assert.equal(CH.compactLevelLabel(5,'灯塔下的潮汐小',320),'05 · 灯塔下的潮汐小');
assert.equal(CH.compactLevelLabel(5,'一二三四五六七八九十十一十二',390),'05 · 一二三四五六七八九十十…');assert.equal(CH.compactLevelLabel(5,'一二三四五六七八九十十一',390),'05 · 一二三四五六七八九十十一');
assert.equal(CH.compactLevelLabel(12,'潮',320),'12 · 潮');assert.ok(CH.compactLevelLabel(5,'一二三四五六七八九',320)!=='05 · 一二三四五六七八九','self-check: 9 chars not cut');
assert.equal(CH.compactToastHoldS('拖动相邻两颗，三颗一样就消除'),3.7);assert.equal(CH.compactToastHoldS('好'),2.5);assert.equal(CH.compactToastHoldS('一'.repeat(40)),4.5);
assert.equal(+(CH.COMPACT_TOAST_IN_S+3.7+CH.COMPACT_TOAST_OUT_S).toFixed(2),3.97);assert.equal(CH.COMPACT_TOAST_FIRST_PULSE_S,0.12);
for(const sym of ['board.compactToast.holdS','board.compactToast.firstPulseS'])assert.ok(R.entries.some(e=>e.symbol===sym),'registered '+sym);
assert.equal(R.entries.find(e=>e.symbol==='board.compactToast.holdS').class,'hold-duration');
const N=CH.COMPACT_COLORS;assert.deepEqual([...N.night.moves],[0,22,26]);assert.deepEqual([...N.night.text],[...NT.TEXT_NIGHT.brown]);assert.deepEqual([...N.night.tint],[...NT.K_UI]);
assert.equal(N.night.hourglassAlpha,1);assert.equal(N.night.dividerAlpha,1);assert.equal(N.divider.marginPt,6);assert.deepEqual([...N.day.moves],[...NT.TEXT_DAY.teal]);
console.log('ok   truncation (longname 「灯塔下的潮汐小路」→「05 · 灯塔下的潮汐…」), hint 3.70 s visible / 3.97 s total, first pulse 0.12 s registered, night colours; self-checks detected');
console.log('compact-hud: PASS');
