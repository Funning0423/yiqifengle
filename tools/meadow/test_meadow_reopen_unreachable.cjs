#!/usr/bin/env node
'use strict';
/** b20 (Grok Bot 2026-10-30): reopen after L04 sails again this round; the r3 reopen-at-05 shot (MeadowStageLens.setMeadowReopenAtM0 /
 *  RegionNodeStage.playMeadowReopen) must be unreachable from production: off by default, and no production code under
 *  creator-build-project/assets/scripts may call setMeadowReopenAtM0(true) or playMeadowReopen(...). Only its gate
 *  (meadow-stage-lens, tools/) drives it. Wiring is next version: remove this check together with the wiring.
 *  Self-check: synthetic sources that call either must be flagged; the real definitions / the reset to false must not. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const ROOT=path.join(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts');
const strip=t=>t.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"])\/\/.*$/gm,'$1');
function offenders(files){const out=[];for(const [f,t0] of files){const t=strip(t0);
  for(const m of t.matchAll(/setMeadowReopenAtM0\s*\(\s*([^)]*)\)/g)){if(/^on\s*:\s*boolean$/.test(m[1].trim()))continue;/* the definition */if(m[1].trim()!=='false')out.push(f+': setMeadowReopenAtM0('+m[1].trim()+')');}
  for(const m of t.matchAll(/(\basync\s+)?\bplayMeadowReopen\b/g)){if(m[1])continue;/* the method definition */out.push(f+': playMeadowReopen reference');}/* any reference: call, ?.(), callback */}
 return out;}
function walk(d,a=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,a);else if(/\.(ts|js)$/.test(e.name))a.push([path.relative(ROOT,p),fs.readFileSync(p,'utf8')]);}return a;}
// self-check
assert.deepEqual(offenders([['def.ts','let reopen=false;\nexport function setMeadowReopenAtM0(on:boolean):void{reopen=!!on;}\n async playMeadowReopen(c){setMeadowReopenAtM0(false);}\n/* setMeadowReopenAtM0(true) in a comment */']]),[],'self-check: definitions flagged');
assert.equal(offenders([['a.ts','if(r.node==="M0")setMeadowReopenAtM0(true);']]).length,1,'self-check: setMeadowReopenAtM0(true) not flagged');
assert.equal(offenders([['b.ts','await this.stage.playMeadowReopen(ch);']]).length,1,'self-check: playMeadowReopen call not flagged');
assert.equal(offenders([['d.ts','s?.playMeadowReopen?.(c);run(this.playMeadowReopen)']]).length,2,'self-check: optional call / callback not flagged');
assert.equal(offenders([['c.ts','setMeadowReopenAtM0(flag)']]).length,1,'self-check: non-literal arg not flagged');
// real tree
const lens=fs.readFileSync(path.join(S,'region/MeadowStageLens.ts'),'utf8');
assert.match(lens,/\blet reopen=false;/,'reopen-at-05 must be off by default');
const bad=offenders(walk(S));
assert.deepEqual(bad,[],'production reaches the reopen-at-05 shot (next version only): '+bad.join('; '));
console.log(JSON.stringify({status:'PASS',checked:walk(S).length,selfCheck:5}));console.log('meadow-reopen-unreachable: PASS');
