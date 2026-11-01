'use strict';
// fg-update-manager: update prompt lives in build-templates/wechatgame/first-screen.js (no Creator asset, no .meta).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const F=process.env.QF_FIRST_SCREEN||path.resolve(__dirname,'../../creator-build-project/build-templates/wechatgame/first-screen.js');
const src=fs.readFileSync(F,'utf8');
function load(wx){const m={exports:{}};const g={module:m,exports:m.exports,console,Promise,Date,Math,JSON};if(wx!==undefined)g.wx=wx;g.GameGlobal=g;vm.createContext(g);vm.runInContext(src,g);return {g,m:m.exports};}
function fakeWx(answer){const h={},calls=[];const um={onCheckForUpdate:f=>h.check=f,onUpdateReady:f=>h.ready=f,onUpdateFailed:f=>h.fail=f,applyUpdate:()=>calls.push('apply')};
  return {h,calls,wx:{getUpdateManager:()=>{calls.push('get');return um;},showModal:o=>{calls.push(['modal',o.title,o.content,o.confirmText,o.cancelText]);o.success&&o.success({confirm:answer,cancel:!answer});}}};}
// outside WeChat: nothing happens, no throw
{const {g,m}=load();assert.equal(typeof m.installUpdatePrompt,'function','installUpdatePrompt exported (fails on old first-screen.js)');assert.equal(g.__qfUpdate,undefined);assert.equal(m.installUpdatePrompt(null),false);}
{const {g}=load({});assert.equal(g.__qfUpdate,undefined,'wx without getUpdateManager (old base lib) -> no-op');}
{const {g}=load({getUpdateManager:()=>{throw Error('devtools');}});assert.equal(g.__qfUpdate,undefined,'throwing manager is harmless');}
// WeChat (system-panels SPEC §3): onUpdateReady only raises the signal (no system modal); the in-game popup calls st.apply() once
{const f=fakeWx(true);const {g,m}=load(f.wx);assert.equal(f.calls[0],'get');f.h.check({hasUpdate:true});assert.equal(g.__qfUpdate.hasUpdate,true);
 assert.equal(g.__qfUpdate.apply(),false,'no apply before ready');f.h.ready();assert.equal(g.__qfUpdate.ready,true);
 assert.equal(f.calls.filter(Array.isArray).length,0,'no system modal');assert.equal(g.__qfUpdate.apply(),true);assert.equal(g.__qfUpdate.apply(),false,'apply once');
 assert.equal(f.calls.filter(c=>c==='apply').length,1);assert.equal(m.installUpdatePrompt(f.wx),false,'installs once');}
// failure: flagged silently, nothing applied
{const f=fakeWx(false);const {g}=load(f.wx);f.h.fail();assert.equal(g.__qfUpdate.failed,true);assert.equal(g.__qfUpdate.ready,false);assert.equal(f.calls.includes('apply'),false);}
// first-screen contract unchanged
{const {m}=load();for(const k of ['start','end','setProgress','coverTransform','coverVertices'])assert.equal(typeof m[k],'function',k);}
console.log('PASS update-prompt');
