'use strict';
const assert=require('assert');
const install=require('../../native-storage-isolation.cjs');
const prefix='task21-'+'a'.repeat(32)+':';
function mock(){const calls=[],values=new Map([['formal-key','DO NOT READ'],[prefix+'own','own-value']]);const wx={};
for(const n of ['getStorageSync','setStorageSync','removeStorageSync','getStorageInfoSync','clearStorageSync','getStorage','setStorage','removeStorage','getStorageInfo','clearStorage'])wx[n]=function(...args){calls.push([n,...args]);if(n==='getStorageInfoSync')return {keys:[...values.keys()],limitSize:10240};if(n==='getStorageSync')return values.get(args[0]);if(n==='setStorageSync')values.set(args[0],args[1]);if(n==='removeStorageSync')values.delete(args[0]);};return {wx,calls,values};}
for(const p of ['', 'task21-short:', 'task22-'+'a'.repeat(32)+':','task21-'+'a'.repeat(32)]){const m=mock();assert.throws(()=>install(m.wx,p),/invalid isolation/);assert.equal(m.calls.length,0);}
const m=mock(),boundary=install(m.wx,prefix);assert.equal(m.calls.length,0);assert.equal(boundary.prefix,prefix);m.wx.getStorageSync('own');m.wx.setStorageSync('test','v');m.wx.getStorage({key:'async'});m.wx.setStorage({key:'async',data:'v'});m.wx.removeStorage({key:'async'});m.wx.removeStorageSync('test');
for(const [n,a] of m.calls){const k=typeof a==='string'?a:a.key;assert(k.startsWith(prefix),[n,k]);}
m.calls.length=0;m.wx.clearStorageSync();assert(!m.calls.some(x=>x[0]==='clearStorageSync'));assert(!m.calls.some(x=>x[0]==='getStorageSync'&&x[1]==='formal-key'));assert.equal(m.values.get('formal-key'),'DO NOT READ');assert(m.calls.filter(x=>x[0]==='removeStorageSync').every(x=>x[1].startsWith(prefix)));console.log(JSON.stringify({task21PrefixAccepted:true,invalidPrefixesRejectedBeforeAnyNativeCall:true,allRepresentativeSyncAsyncCallsPrefixed:true,formalValueNeverReadOrRemoved:true,nativeClearNeverCalled:true}));
