'use strict';
/** perf-r1 overlay gate: flag parsing (perf=1 only), off by default, only built for devPreviewBuild (never release), no wx.login/authorize,
 *  no storage, no sync wx API in the per-frame tick. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/ui/DevPreviewMark.ts'),'utf8');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const body=src.slice(src.indexOf('export const PERF_OVERLAY_FLAG'),src.indexOf('export class PerfOverlay'));
const js=ts.transpileModule(body.replace(/export /g,''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText+';({perfOverlayOn,perfWindow,perfEnvOn})';
const debugSearch=()=>'';const q=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/world-r2/QaSkip.ts'),'utf8');
const qjs=ts.transpileModule(q.slice(q.indexOf('const envCache'),q.indexOf('function wxLaunchQuery')).replace(/export /g,''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const wxQaEnv=eval(qjs+';wxQaEnv');const M=eval(js);
assert.equal(M.perfOverlayOn(''),false,'off by default');assert.equal(M.perfOverlayOn('?perf=1'),true);assert.equal(M.perfOverlayOn('?camTrace=1&perf=1'),true);
assert.equal(M.perfOverlayOn('?perf=0'),false);assert.equal(M.perfOverlayOn('?superperf=1'),false);
const W=v=>({getAccountInfoSync:()=>({miniProgram:{envVersion:v}})});
assert.equal(M.perfEnvOn(W('trial')),true,'trial on');assert.equal(M.perfEnvOn(W('develop')),true,'develop on');
assert.equal(M.perfEnvOn(W('release')),false,'release off');assert.equal(M.perfEnvOn(undefined),false,'missing wx off');
assert.equal(M.perfEnvOn({}),false,'no getAccountInfoSync off');assert.equal(M.perfEnvOn({getAccountInfoSync:()=>{throw new Error('x')}}),false,'throw off');
assert.equal(M.perfEnvOn(W('Trial')),false,'negative: case-sensitive');assert.equal(M.perfEnvOn(W(undefined)),false,'negative: no envVersion');
assert.equal(M.perfOverlayOn('',W('trial')),true);assert.equal(M.perfOverlayOn('',W('release')),false);assert.equal(M.perfOverlayOn('?perf=1',W('release')),true,'query still works');
assert.ok(!/wx\.(login|authorize)\s*\(/.test(src),'no wx.login/authorize');
assert.deepEqual(M.perfWindow([16,16,50]),{fps:37,avg:27.3,max:50,slow:1});
const ov=src.slice(src.indexOf('export class PerfOverlay'),src.indexOf('export class DevPreviewMark'));
assert.ok(!/wx\.(login|authorize)|getStorage|localStorage|Sync\(/.test(ov),'overlay: no login/authorize/storage/sync host API');
assert.match(src,/if \(enabled\) \{ try \{ if \(perfOverlayOn\(\)\) this\.perf = new PerfOverlay\(parent\)/,'only in devPreviewBuild (release never constructs it)');
console.log('PASS perf-overlay flag=perf=1 off-by-default, dev/trial only, envVersion trial/develop auto-on, release/missing-wx off');
