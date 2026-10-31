'use strict';
/** finT: [QF_PRELOAD_STAGE] split:env_meadow ms=31920 budgetMs=1200 frameMaxMs=1536 printed ok:true (ok was only "completed").
 *  Now ok = mounted && !overBudget && !frameOverBudget. 1536 ms frame vs 1200 budget must be ok:false. Budgets pinned unchanged.
 *  Negative: the 043234c3 code (ok:true for that line) is caught. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.join(__dirname,'../..'),S='creator-build-project/assets/scripts/region/';
function fn(src){const sf=ts.createSourceFile('t.ts',src,ts.ScriptTarget.ES2020,true);let t=null;(function v(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='stageLine')t=n.getText(sf);ts.forEachChild(n,v);})(sf);
 if(!t)return null;const js=ts.transpileModule(t,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText.replace(/^export /,'');return new Function(js+';return stageLine;')();}
function check(src){const L=fn(src);assert.ok(L,'stageLine missing');
 const a=L('meadow','split:env_meadow',31920,1200,true,{frameMaxMs:1536});assert.equal(a.ok,false,'finT line must fail');assert.equal(a.mounted,true);assert.equal(a.overBudget,true);assert.equal(a.frameOverBudget,true);assert.equal(a.budgetMs,1200);
 const f=L('meadow','split:env_meadow',900,1200,true,{frameMaxMs:1536});assert.equal(f.ok,false,'1536 ms frame vs 1200 budget fails on its own');assert.equal(f.overBudget,false);
 const b=L('meadow','prefab:env_meadow',35,450,true,{frameMaxMs:17});assert.equal(b.ok,true);assert.equal(b.overBudget,false);assert.equal(b.frameOverBudget,false);
 const c=L('meadow','mount:meadow-warm-rig',0,700,false,{frameMaxMs:0,reason:'left-island'});assert.equal(c.ok,false);assert.equal(c.reason,'left-island');
 const d=L('skycity','json:balloon_flightpath',65,40,true);assert.equal(d.overBudget,true);assert.equal(d.ok,false);assert.ok(!('frameMaxMs' in d));}
check(fs.readFileSync(path.join(ROOT,S,'TransitionPreload.ts'),'utf8'));
const chain=fs.readFileSync(path.join(ROOT,S,'TransitionChain.ts'),'utf8');
assert.match(chain,/\{id:'split:env_meadow',ms:1200\}/);assert.match(chain,/export const SPLIT_BUDGET_MS=4;/);
let caught=false;try{check(cp.execFileSync('git',['show','043234c3:'+S+'TransitionPreload.ts'],{cwd:ROOT,encoding:'utf8'}));}catch{caught=true;}
assert.ok(caught,'self-test: pre-finT stage line not caught');
console.log('PASS preload-stage-line');
