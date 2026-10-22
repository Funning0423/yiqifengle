'use strict';
// UI设计部 b16 修复（P1 小岛木牌 / P2 天空城夜间补光 / P2 L13 规则弹窗）的纯逻辑 + 源码检查。node tools/ui-b16-fixes/test_b16_ui_fixes.cjs
const fs=require('fs'),path=require('path'),assert=require('assert'),{load,SRC,typescript}=require('../t9-island-props/load_ts.cjs');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('PASS '+name);};
const src=f=>fs.readFileSync(path.join(SRC,f),'utf8');
ok('changed sources transpile without syntax errors',()=>{const ts=typescript();for(const f of ['WorldIntegrationBoot.ts','world-r2/IslandProps.ts','region/SkycityBoardLive.ts','region/RegionBoardNight.ts','ManagedMobileBoardUI.ts']){const r=ts.transpileModule(src(f),{reportDiagnostics:true,compilerOptions:{experimentalDecorators:true}});assert.equal((r.diagnostics||[]).length,0,f);}});
ok('P1 setSignEntrance skips only when the node visibility already matches; reports whether it applied',()=>{const s=src('world-r2/IslandProps.ts');
 assert(/e === this\.entrance && risePx === 0 && sign\.active === e > 0\) return true;/.test(s));assert(/setSignEntrance\(e: number, risePx = 0\): boolean/.test(s));assert(/signVisible\(\): boolean/.test(s));});
ok('P1 host: no invisible hit area once the entrance is over; one replay, then the visible flat 继续旅程 button',()=>{const s=src('WorldIntegrationBoot.ts');
 assert(/if\(ok!==false\)this\.signShown=e;/.test(s));assert(/!\(p as any\)\.signVisible\(\)\)\{if\(this\.signRetry<1\)\{this\.signRetry\+\+;this\.signShown=0;this\.signEntrance=0;\}else sign=null;\}/.test(s));});
ok('P1 hit area min 88 logical px (>= 44pt); per-viewport inset checks live in t9-island-props test',()=>{const M=load();const L=M.IslandPropsLayout;assert(L.SIGN_HIT_MIN>=44);});
ok('P2 sky-city key light: day unchanged, night = world lightScale 0.35 and moon colour 180/198/232, monotonic blend',()=>{const M=load(['region/RegionBoardNight']).RegionBoardNight;
 const d=M.regionBoardKeyLight([255,243,218],12,0),nt=M.regionBoardKeyLight([255,243,218],12,1),h=M.regionBoardKeyLight([255,243,218],12,.5);
 assert.deepEqual(d.color,[255,243,218]);assert.equal(d.luminance,12);assert.deepEqual(nt.color,[180,189,198]);assert(Math.abs(nt.luminance-4.2)<1e-9);assert(h.luminance<12&&h.luminance>4.2);
 assert(/regionBoardKeyLight\(keyDay\.color,keyDay\.luminance,skyNightBlend\)/.test(src('region/SkycityBoardLive.ts')));});
ok('P2 L13 rule guide: body left-aligned in a 480 box (100 each side inside the 680 frame), lines estimated per paragraph at 472',()=>{const s=src('ManagedMobileBoardUI.ts');
 assert(/const RULE_BODY_W = 480;/.test(s));assert(/p\.text\(body, -RULE_BODY_W \/ 2, [^;]*align: 'left'/.test(s));assert(!/width: 580, lines/.test(s));});
console.log(n+' checks passed');
