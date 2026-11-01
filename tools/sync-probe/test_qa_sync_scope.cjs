#!/usr/bin/env node
'use strict';
/** B23 (b20 3689d151, B414): [QF_SYNC] 1014 localStorage get/set (368 in frame 3705) on the ISOLATED test profile key
 *  dot-region-flow-test-…:mainline:forest-mainline-cocos-r1-active. Source: __qfPreTransition('journal-sky-*') → PreTransitionRun
 *  finishPausedMainlineWin / seedSkyChallengeWins, called OUTSIDE the qa allow scope that preTransitionProfile has.
 *  Gate: every QA seeder call that writes the test profile in PreTransitionRun runs inside a qa scope (preTransitionProfile via the
 *  inline __qfSyncAllow block, the seeders via qaSyncScope); qaSyncScope sets a reason for the call only and restores it (also on
 *  throw), so a later steady call is still counted. Negative: the unwrapped 3689d151 source fails; a scope that leaks fails. */
const fs=require('fs'),path=require('path'),assert=require('assert');
const SRC=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/world-r2/PreTransitionRun.ts'),'utf8');
const SEEDERS=['finishPausedMainlineWin','seedSkyChallengeWins','seedLakeCheckpoint'];
function unscoped(src){const bad=[];for(const n of SEEDERS){const re=new RegExp('(^|[^\\w.])'+n+'\\(','g');let m;while((m=re.exec(src))){const i=m.index+m[1].length;
  const before=src.slice(Math.max(0,i-80),i);if(/export function\s*$/.test(before)||/import[^;]*$/.test(before))continue;
  if(/qaSyncScope\('[\w-]+',\(\)=>\s*$/.test(before))continue;
  const blk=src.lastIndexOf("__qfSyncAllow='",i),fin=src.indexOf('__qfSyncAllow=prev',blk);if(blk>=0&&fin>i&&i-blk<600)continue;
  bad.push(n+'@'+i);}}return bad;}
assert.deepStrictEqual(unscoped(SRC),[],'QA seeder outside a [QF_SYNC] qa scope');
// negative: 3689d151 form (unwrapped) must fail
const neg=SRC.replace(/qaSyncScope\('[\w-]+',\(\)=>(finishPausedMainlineWin|seedSkyChallengeWins)/g,'$1');
assert.ok(unscoped(neg).length>=2,'negative: unwrapped seeders not detected');
// runtime: extract qaSyncScope and check set/restore semantics
const m=/function qaSyncScope<T>\(reason:string,f:\(\)=>T\):T\{([\s\S]*?)\}\n/.exec(SRC);assert.ok(m,'qaSyncScope present');
const body='{'+m[1].replace(/:any/g,'')+'}';const qa=new Function('reason','f',body);
assert.ok(/\/\*QF_PROBE_BEGIN\*\/[^]*function qaSyncScope[^]*?\/\*QF_PROBE_END\*\//.test(SRC),'qaSyncScope is probe-stripped');
globalThis.__qfSyncAllow=undefined;let seen=null;qa('x',()=>{seen=globalThis.__qfSyncAllow;});
assert.strictEqual(seen,'x');assert.strictEqual(globalThis.__qfSyncAllow,undefined,'restored');
assert.throws(()=>qa('y',()=>{throw Error('boom');}));assert.strictEqual(globalThis.__qfSyncAllow,undefined,'restored after throw');
globalThis.__qfSyncAllow='outer';qa('inner',()=>{});assert.strictEqual(globalThis.__qfSyncAllow,'outer','nested restore');
// negative: a leaking scope (no finally restore) is caught by the same checks
const leak=new Function('reason','f','globalThis.__qfSyncAllow=reason;return f();');globalThis.__qfSyncAllow=undefined;leak('z',()=>{});
assert.notStrictEqual(globalThis.__qfSyncAllow,undefined,'negative: leak detectable');delete globalThis.__qfSyncAllow;
console.log('qa-sync-scope PASS');
