'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const install=require('./native-storage-isolation.cjs');
const prefix=JSON.parse(fs.readFileSync('../evidence/isolation-identity.json')).prefix;
const calls=[], map=new Map([['storage','formal-probe'],['formal-progress','formal-save']]);
function touch(op,k){calls.push({op,key:k});if(k!==undefined)assert.ok(k.startsWith(prefix),'formal key reached');}
const wx={getStorageSync:k=>{touch('get',k);return map.get(k)??'';},setStorageSync:(k,v)=>{touch('set',k);map.set(k,v);},removeStorageSync:k=>{touch('remove',k);map.delete(k);},getStorageInfoSync:()=>{touch('info');return {keys:[...map.keys()],currentSize:98765,limitSize:10240};},clearStorageSync:()=>{throw Error('native clear must never run');}};
for(const [n,s] of [['getStorage','getStorageSync'],['setStorage','setStorageSync'],['removeStorage','removeStorageSync']])wx[n]=o=>{const r={errMsg:n+':ok'},v=raw[s](o.key,o.data);if(n==='getStorage')r.data=v;o.success?.(r);o.complete?.(r);return Promise.resolve(r);};
wx.getStorageInfo=o=>o.success(raw.getStorageInfoSync());wx.clearStorage=()=>{throw Error('native clear must never run');};wx.batchSetStorage=()=>{throw Error('unknown native never runs');};const raw={...wx};
const boundary=install(wx,prefix);assert.equal(calls.length,0);assert.throws(()=>wx.batchSetStorage({}),/uncovered/);assert.throws(()=>wx.getStorageSync({}),/key/);assert.throws(()=>{wx.setStorageSync=()=>{};},TypeError);
wx.setStorageSync('formal-progress','test');assert.equal(wx.getStorageSync('formal-progress'),'test');wx.removeStorageSync('formal-progress');
const source=fs.readFileSync('../native-package/web-adapter.js','utf8'),start=source.indexOf('28:[function('),end=source.indexOf('},{}],29:',start);assert.ok(start>=0&&end>start);const moduleText=source.slice(start+'28:['.length,end+1),mod={exports:{}};vm.runInNewContext('('+moduleText+')(null,mod,mod.exports)',{wx,mod});const storage=mod.exports.default;
storage.setItem('storage','');storage.removeItem('storage');storage.setItem('adapter','value');assert.equal(storage.getItem('adapter'),'value');assert.equal(storage.length,1);assert.equal(storage.key(0),'adapter');storage.clear();assert.equal(storage.length,0);
(async()=>{
 await wx.setStorage({key:'async',data:'persist'});assert.equal((await wx.getStorage({key:'async'})).data,'persist');await wx.removeStorage({key:'async'});
 wx.setStorageSync('one',{foo:1});wx.setStorageSync('two','x');let success=0,complete=0;
 wx.getStorageInfo({success:r=>{success++;assert.deepEqual(r.keys,['one','two']);assert.notEqual(r.currentSize,98765);},complete:r=>{complete++;assert.deepEqual(r.keys,['one','two']);}});assert.equal(success,1);assert.equal(complete,1);assert.deepEqual((await wx.getStorageInfo()).keys,['one','two']);await wx.clearStorage();assert.equal(map.size,2);
 wx.setStorageSync('clear-callback',1);success=complete=0;wx.clearStorage({success:r=>{success++;assert.equal(r.errMsg,'clearStorage:ok');},complete:()=>complete++});assert.equal(success,1);assert.equal(complete,1);assert.equal(map.get('storage'),'formal-probe');assert.equal(map.get('formal-progress'),'formal-save');
 const bad={...raw};Object.defineProperty(bad,'setStorageSync',{value:raw.setStorageSync,writable:false,configurable:false});const count=calls.length;let started=false;assert.throws(()=>{install(bad,prefix);started=true;});assert.equal(started,false);assert.equal(calls.length,count);
 fs.writeFileSync('../evidence/mock-regression.json',JSON.stringify({passed:true,checks:['sync get/set/remove','async get/set/remove','sync and async filtered info','callback complete filtered','clear sync and async prefix-only','shipped adapter and engine probe','unknown API rejected','invalid key rejected','wrappers locked','initialization failure no startup','zero formal-key reads/writes/removes'],nativeCalls:calls,audit:boundary.snapshot()},null,2));console.log('PASS: '+calls.length+' mock calls; zero formal keys reached');
})().catch(e=>{console.error(e);process.exitCode=1;});
