#!/usr/bin/env node
'use strict';
/** Self-test for sha-pin-coverage.cjs on synthetic git repos (scratch: $QF_SELFTEST_TMP or os.tmpdir()). */
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert');
const G=require('./sha-pin-coverage.cjs');
const SCR=process.env.QF_SELFTEST_TMP||(fs.existsSync('/workspace/wt')?'/workspace/wt/scratch':os.tmpdir());fs.mkdirSync(SCR,{recursive:true});
const tmp=fs.mkdtempSync(path.join(SCR,'qf-shapin-'));
const H1='a'.repeat(64),H2='b'.repeat(64);let n=0;const out=[];
const w=(r,f,t)=>{fs.mkdirSync(path.dirname(path.join(r,f)),{recursive:true});fs.writeFileSync(path.join(r,f),t);};
function repo(reg,extra={}){const r=path.join(tmp,'r'+(++n));fs.mkdirSync(r);cp.execFileSync('git',['init','-q'],{cwd:r});
  w(r,'creator-build-project/assets/scripts/A.ts',`export const A={ "glbSHA256": "${H1}" };`);
  w(r,'tools/journey-integration/run-suite.cjs',"const S=[['a-check','tools/a/test_a.cjs']];");
  w(r,'tools/a/test_a.cjs',"// reads creator-build-project/assets/scripts/A.ts");
  w(r,'tools/journey-integration/frozen-production-inputs.json',JSON.stringify({files:[],embeddedPins:[]}));
  for(const [f,t] of Object.entries(extra))w(r,f,t);cp.execFileSync('git',['add','-A'],{cwd:r});
  const rf=path.join(r,'reg.json');fs.writeFileSync(rf,JSON.stringify({pins:reg}));return {root:r,registry:rf};}
const V={file:'creator-build-project/assets/scripts/A.ts',key:'glbSHA256',count:1,kind:'verified',checkedBy:'a-check'};
const t=(name,fn)=>{fn();out.push(name);};
try{
 t('registered + verified -> PASS',()=>{const x=G.run(repo([V]));assert.equal(x.fail.length,0,JSON.stringify(x));});
 t('unregistered pin -> FAIL',()=>{const x=G.run(repo([V],{'tools/b/data.json':`{"sourceSha256":"${H2}"}`}));assert.match(x.fail.join('\n'),/UNREGISTERED tools\/b\/data\.json sourceSha256/);});
 t('unregistered pin in a .py constant -> FAIL',()=>{const x=G.run(repo([V],{'tools/c.py':`ORIGINAL_SHA256 = '${H2}'`}));assert.match(x.fail.join('\n'),/UNREGISTERED tools\/c\.py ORIGINAL_SHA256/);});
 t('pin in a reports dir is ignored',()=>{const x=G.run(repo([V],{'tools/x/reports/r.json':`{"sha256":"${H2}"}`}));assert.equal(x.fail.length,0);});
 t('verified but check not in suite -> FAIL',()=>{const x=G.run(repo([{...V,checkedBy:'nope'}]));assert.match(x.fail.join('\n'),/NOT_IN_SUITE/);});
 t('verified but check never reads the file -> FAIL',()=>{const x=G.run(repo([V],{'tools/a/test_a.cjs':'// nothing'}));assert.match(x.fail.join('\n'),/CHECK_DOES_NOT_READ/);});
 t('second pin of same key (count) -> FAIL',()=>{const x=G.run(repo([V],{'creator-build-project/assets/scripts/A.ts':`"glbSHA256": "${H1}", "glbSHA256": "${H2}"`}));assert.match(x.fail.join('\n'),/COUNT/);});
 t('embedded not in frozen embeddedPins -> FAIL',()=>{const x=G.run(repo([{...V,kind:'embedded'}]));assert.match(x.fail.join('\n'),/EMBEDDED_NOT_PINNED/);});
 t('unchecked debt: frozen values PASS (listed), changed -> FAIL, --strict semantics via debt list',()=>{const d={...V,kind:'unchecked',valuesSha256:G.vhash([H1])};let x=G.run(repo([d]));assert.equal(x.fail.length,0);assert.equal(x.debt.length,1);
   x=G.run(repo([{...d,valuesSha256:G.vhash([H2])}]));assert.match(x.fail.join('\n'),/DEBT_PIN_CHANGED/);});
 t('stale registry entry -> FAIL',()=>{const x=G.run(repo([V,{...V,file:'tools/gone.json'}]));assert.match(x.fail.join('\n'),/STALE_REGISTRY/);});
 t('record without reason -> FAIL',()=>{const x=G.run(repo([{...V,kind:'record'}]));assert.match(x.fail.join('\n'),/RECORD_NO_REASON/);});
 t('real repo registry -> no fails',()=>{const x=G.run({});assert.equal(x.fail.length,0,x.fail.join('\n'));});
 console.log(out.map(x=>'ok - '+x).join('\n'));console.log(`PASS sha-pin-coverage selftest ${out.length} cases`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
