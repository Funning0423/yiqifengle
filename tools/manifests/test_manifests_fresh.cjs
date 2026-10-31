#!/usr/bin/env node
'use strict';
/** Staleness gate for assets-/text-MANIFEST-SHA256.json (read by tools/build-guard/manifest-files-exist.cjs; refreshed ONLY by
 *  `node tools/test_manifests.cjs --write`). Fails when any covered file changed without a regenerated manifest.
 *  Negative self-test: a scratch git repo whose manifest is regenerated, then a covered file is edited → must FAIL; regenerate → PASS. */
const cp=require('child_process'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const TOOL=path.join(__dirname,'../test_manifests.cjs'),ROOT=path.resolve(__dirname,'../..');
const run=(root,...a)=>cp.spawnSync(process.execPath,[TOOL,'--root',root,...a],{encoding:'utf8'});
const real=run(ROOT);assert.equal(real.status,0,'manifests stale — run `node tools/test_manifests.cjs --write`:\n'+(real.stdout+real.stderr).slice(-1500));
const d=fs.mkdtempSync(path.join(os.tmpdir(),'qf-manifest-selftest-'));
try{const g=(...a)=>cp.execFileSync('git',a,{cwd:d,stdio:'pipe'});g('init','-q');
 fs.mkdirSync(path.join(d,'creator-build-project/assets'),{recursive:true});fs.writeFileSync(path.join(d,'creator-build-project/assets/a.ts'),'export const a=1;\n');
 fs.writeFileSync(path.join(d,'assets-MANIFEST-SHA256.json'),'[]\n');fs.writeFileSync(path.join(d,'text-MANIFEST-SHA256.json'),'[]');g('add','-A');
 assert.notEqual(run(d).status,0,'self-test: unlisted covered file must FAIL');
 assert.equal(run(d,'--write').status,0);assert.equal(run(d).status,0,'self-test: regenerated manifest must PASS');
 fs.writeFileSync(path.join(d,'creator-build-project/assets/a.ts'),'export const a=2;\n');
 assert.notEqual(run(d).status,0,'self-test: edited covered file with stale manifest must FAIL');
}finally{fs.rmSync(d,{recursive:true,force:true});}
console.log('PASS manifests-fresh (self-tests: unlisted + stale caught)');
