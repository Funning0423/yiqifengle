'use strict';
// dev-wording selftest: fixture trees under /workspace/wt/.dw-selftest-* (never /tmp); each case must PASS or FAIL as stated.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),G=require('./dev-wording.cjs');
const BASE=fs.mkdtempSync(path.join(path.resolve(__dirname,'../../..'),'.dw-selftest-'));let n=0;const res=[];
const CFG={excludeFiles:{'creator-build-project/assets/scripts/QaOnly.ts':'test pack'},excludeStrings:[{file:'creator-build-project/assets/scripts/Boot.ts',string:'退出测试',why:'DEBUG only'}]};
function tree(files){const r=path.join(BASE,'c'+(++n));for(const [f,s] of Object.entries(files)){const p=path.join(r,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);}
  fs.writeFileSync(path.join(r,'cfg.json'),JSON.stringify(CFG));return r;}
const S='creator-build-project/assets/scripts/';
function t(name,files,expectHits){const r=tree(files),out=G.run(r,path.join(r,'cfg.json'));
  assert.equal(out.hits.length,expectHits,name+' '+JSON.stringify(out.hits));res.push(name);console.log('ok - '+name);}
try{
  t('COUNTEREXAMPLE: player hint with 3D 场景入口 -> FAIL',{[S+'Ui.ts']:"const h = { unlockHint: '天空挑战已开放；天空城另有 3D 场景入口' };"},1);
  t('fixed hint 天空挑战已开放 -> PASS',{[S+'Ui.ts']:"const h = { unlockHint: '天空挑战已开放' };"},0);
  t('English label via makeLabel "Debug" and .string = "TODO" -> FAIL x2',{[S+'Ui.ts']:"makeLabel(n,'Debug view',0,0,12); lab.string = 'TODO later';"},2);
  t('template literal part with 测试 -> FAIL',{[S+'Ui.ts']:"lab.string = `关卡 ${n} 测试`;"},1);
  t('comments, console.*, Error(), probe block are not player-visible -> PASS',{[S+'Ui.ts']:"// 3D 场景 debug TODO\n/* 测试 placeholder */\nconsole.warn('[X] 3D 场景 test');\nthrow new Error('占位 debug');\n/*QF_PROBE_BEGIN*/ lab.string='测试 3D'; /*QF_PROBE_END*/\n"},0);
  t('word boundaries: latest / contest / ResultChest3D / c3d ids -> PASS',{[S+'Ui.ts']:"makeLabel(n,'latest contest',0,0,1); import { ResultChest3D } from './ResultChest3D'; const k={title:'c3d_node'};"},0);
  t('non-display English strings (asset paths, keys) are not scanned -> PASS',{[S+'Ui.ts']:"load('bundles/test/debug.png'); const m={ 'test': 1 };"},0);
  t('reviewed exclusions: excluded file and exact (file,string) pair -> PASS',{[S+'QaOnly.ts']:"lab.string='测试 3D';",[S+'Boot.ts']:"this.button('x','退出测试',f);"},0);
  t('exclusion is exact: same string in another file, or another string in the same file -> FAIL x2',{[S+'Other.ts']:"this.button('x','退出测试',f);",[S+'Boot.ts']:"this.button('y','调试面板',f);"},2);
  t('json text reaching the screen: CJK value and English "text" key -> FAIL x2; numbers/ids PASS',{'creator-build-project/assets/resources/d.json':JSON.stringify({lines:[{speaker:'阿芳',text:'这是占位台词'},{text:'placeholder line'}],id:'test_01'})},2);
  t('build-templates wechatgame js is scanned -> FAIL',{'creator-build-project/build-templates/wechatgame/first-screen.js':"var t='健康游戏忠告（测试）';"},1);
  console.log('PASS dev-wording selftest '+res.length+' cases');
}finally{fs.rmSync(BASE,{recursive:true,force:true});}
