'use strict';
// UI设计部 b16 修复（P1 小岛木牌 / P2 天空城夜间补光 / P2 L13 规则弹窗）的纯逻辑 + 源码检查。node tools/ui-b16-fixes/test_b16_ui_fixes.cjs
const fs=require('fs'),path=require('path'),assert=require('assert'),{load,SRC,typescript}=require('../t9-island-props/load_ts.cjs');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('PASS '+name);};
const src=f=>fs.readFileSync(path.join(SRC,f),'utf8');
ok('changed sources transpile without syntax errors',()=>{const ts=typescript();for(const f of ['WorldIntegrationBoot.ts','world-r2/IslandProps.ts','region/SkycityBoardLive.ts','region/RegionBoardNight.ts','ManagedMobileBoardUI.ts']){const r=ts.transpileModule(src(f),{reportDiagnostics:true,compilerOptions:{experimentalDecorators:true}});assert.equal((r.diagnostics||[]).length,0,f);}});
ok('P1 setSignEntrance skips only when the node visibility already matches; reports whether it applied',()=>{const s=src('world-r2/IslandProps.ts');
 assert(/e === this\.entrance && risePx === 0 && sign\.active === e > 0\) return true;/.test(s));assert(/setSignEntrance\(e: number, risePx = 0\): boolean/.test(s));assert(/signVisible\(\): boolean/.test(s));});
ok('P1 host: no invisible hit area once the entrance is over; one replay, then the visible flat 继续旅程 button while the 3D sign keeps retrying (1 s)',()=>{const s=src('WorldIntegrationBoot.ts');
 assert(/if\(ok!==false\)this\.signShown=e;/.test(s));assert(/if\(this\.signRetry<1\)\{this\.signRetry\+\+;this\.signShown=0;this\.signEntrance=0;\}/.test(s));
 assert(/now-this\.signRetryAt>=1000\)\{this\.signRetryAt=now;this\.signRetry\+\+;this\.setSign\(1,0\);\}if\(!\(p as any\)\.signVisible\(\)\)sign=null;/.test(s),'fallback keeps retrying the 3D sign every 1 s');
 assert(/else\{this\.signShown=0;this\.signEntrance=0;this\.signFadeS=\.2;/.test(s)&&/this\.signFadeS>0\?Math\.max\(0,Math\.min\(dt,\.1\)\)\/this\.signFadeS:step/.test(s),'retry success: flat button -> 3D sign with a 0.2 s fade-in');
 assert(/if\(s\.state!=='island'\)this\.signRetry=0;/.test(s),'retry budget resets off the island');});
ok('P1 hit area min 88 logical px (>= 44pt); per-viewport inset checks live in t9-island-props test',()=>{const M=load();const L=M.IslandPropsLayout;assert(L.SIGN_HIT_MIN>=44);});
ok('P2 sky-city key light: day unchanged, night = world lightScale 0.35 and moon colour 180/198/232, monotonic blend',()=>{const M=load(['region/RegionBoardNight']).RegionBoardNight;
 const d=M.regionBoardKeyLight([255,243,218],12,0),nt=M.regionBoardKeyLight([255,243,218],12,1),h=M.regionBoardKeyLight([255,243,218],12,.5);
 assert.deepEqual(d.color,[255,243,218]);assert.equal(d.luminance,12);assert.deepEqual(nt.color,[180,189,198]);assert(Math.abs(nt.luminance-4.2)<1e-9);assert(h.luminance<12&&h.luminance>4.2);
 assert(/regionBoardKeyLight\(keyDay\.color,keyDay\.luminance,skyNightBlend\)/.test(src('region/SkycityBoardLive.ts')));});
ok('P2 L13 rule guide: body left-aligned in a 480 box (100 each side inside the 680 frame), lines estimated per paragraph at 472',()=>{const s=src('ManagedMobileBoardUI.ts');
 assert(/const RULE_BODY_W = 480;/.test(s));assert(/p\.text\(body, -RULE_BODY_W \/ 2, [^;]*align: 'left'/.test(s));assert(!/width: 580, lines/.test(s));});
ok('L13 rule guide clears the HUD plate (+12 pt, title plank included) and the bottom safe area on 320×568 / 375×667 / 390×844, 1–9 lines',()=>{const B=load(['ui/BoardLayout']).BoardLayout;
 for(const [w,h] of [[320,568],[360,780],[375,667],[390,844]]){const safe=B.boardSafeInsets(w,h),g=B.boardLayout(w,h,safe,2),pb=g.plate.y+g.plate.height/2,k=Math.max(0.3,Math.min(w/750,h/1300,0.62));
  for(let lines=1;lines<=B.RULE_GUIDE_MAX_LINES;lines++){const ph=104+48+40+lines*40+48+104+72,dy=B.ruleGuideDy(w,h,ph,pb,safe.bottom,k)*k,top=h/2-ph*k/2-52.5*k+dy,bot=h/2+ph*k/2+dy;
   assert(top>=pb+12-1e-6,`top ${top.toFixed(1)} vs plate ${pb} @${w}x${h} lines ${lines}`);assert(bot<=h-safe.bottom-12+1e-6,`bottom ${bot.toFixed(1)} @${w}x${h} lines ${lines}`);}}
 assert(/dy: ruleGuideDy\(vw, vh, ph, plateBottom, [^)]*, popupScale\(vw, vh\)\)/.test(src('ManagedMobileBoardUI.ts')),'uses PopupKit.popupScale');assert(B.RULE_GUIDE_MAX_LINES===8);
 assert(!/Math\.min\(width \/ 750/.test(src('ui/BoardLayout.ts').slice(src('ui/BoardLayout.ts').indexOf('export function ruleGuideDy'))),'no copied popupScale formula');
 // every rule-guide text (rule + tool) fits in 8 lines at the 472 px estimate (PopupKit.measure: CJK = font size)
 const g=src('regional-r05/runtime/rule-guide.js'),meas=t=>[...t].reduce((w,c)=>w+(c.charCodeAt(0)>0x2e80?28:c===' '?28*.3:28*.56),0);
 const re=/(\w+):\{title:'[^']*',goal:'[^']*',rule:'([^']*)',tool:'([^']*)'\}/g;let m,cnt=0;while((m=re.exec(g))){cnt++;const lines=[m[2],m[3]].reduce((n,t)=>n+Math.max(1,Math.ceil(meas(t)/472)),0);assert(lines<=8,m[1]+' rule needs '+lines+' lines');}
 assert(cnt>=4,'rule texts found '+cnt);});
ok('r6 lakeside previews pass measure_visible.py gates (day L13/L16, night L13/L16; exit 0)',()=>{const cp=require('child_process'),ROOT=path.resolve(__dirname,'..','..'),d=path.join(ROOT,'docs/r6/ui');
 const r=cp.spawnSync('python3',[path.join(d,'tools/measure_visible.py'),...['board_L13_390x844.png','board_L16_390x844.png','board_L13_night_390x844.png','board_L16_night_390x844.png'].map(f=>path.join(d,f))],{encoding:'utf8'});
 if(r.error&&r.error.code==='ENOENT'){console.log('  (python3 missing: skipped)');return;}assert.equal(r.status,0,r.stdout+r.stderr);});
console.log(n+' checks passed');
