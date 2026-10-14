'use strict';
// Test-copy only. Must run before web-adapter, engine, or any game module.
module.exports = function install(wx, prefix) {
  if (!wx || !/^task20-[a-f0-9]{32}:$/.test(prefix)) throw Error('invalid isolation boundary');
  const names = ['getStorageSync','setStorageSync','removeStorageSync','getStorageInfoSync','clearStorageSync',
    'getStorage','setStorage','removeStorage','getStorageInfo','clearStorage'];
  const native = Object.create(null), wrappers = Object.create(null), audit = [], traces=[];
  const found = new Set();
  for (let p = wx; p; p = Object.getPrototypeOf(p)) {
    for (const n of Object.getOwnPropertyNames(p)) if (/storage/i.test(n)) found.add(n);
  }
  for (const n of names) {
    if (typeof wx[n] !== 'function') throw Error('missing native API: '+n);
    native[n] = wx[n].bind(wx);
  }
  const key = k => {
    if (typeof k !== 'string' || !k.length) throw Error('storage key must be nonempty string');
    return prefix+k;
  };
  const record = (op,k) => audit.push({op,key:k});
  const ownKeys = info => {
    if (!info || !Array.isArray(info.keys) || info.keys.some(k => typeof k !== 'string')) throw Error('invalid native enumeration');
    return info.keys.filter(k => k.startsWith(prefix));
  };
  const filtered = info => {
    const physical = ownKeys(info);
    // Only own values are read; native aggregate size includes formal data and is never returned.
    let bytes = 0;
    for (const k of physical) {
      record('info-size-read',k);
      const value = native.getStorageSync(k);
      bytes += encodeURIComponent(k+JSON.stringify(value)).replace(/%[A-F\d]{2}/g,'x').length;
    }
    return {keys:physical.map(k=>k.slice(prefix.length)),currentSize:Math.ceil(bytes/1024),limitSize:info.limitSize,errMsg:'getStorageInfo:ok'};
  };
  for (const n of ['getStorageSync','setStorageSync','removeStorageSync']) {
    wrappers[n] = function(k,...rest) { const mapped=key(k); record(n,mapped); const result=native[n](mapped,...rest); if(k.endsWith('forest-mainline-cocos-r1-active') || k==='__test_persistence_probe') { if(traces.length<120) traces.push({op:n,key:mapped,value:n==='setStorageSync'?rest[0]:result,stack:new Error().stack}); } return result; };
  }
  wrappers.getStorageInfoSync = () => filtered(native.getStorageInfoSync());
  wrappers.clearStorageSync = () => {
    const keys=ownKeys(native.getStorageInfoSync());
    for (const k of keys) { record('clear-remove',k); native.removeStorageSync(k); }
  };
  for (const n of ['getStorage','setStorage','removeStorage']) {
    wrappers[n] = function(options) {
      if (!options || typeof options !== 'object') throw Error('invalid storage options');
      const mapped=key(options.key); record(n,mapped);
      return native[n](Object.assign({},options,{key:mapped}));
    };
  }
  wrappers.getStorageInfo = function(options={}) {
    const hasCallbacks=['success','fail','complete'].some(k=>typeof options[k]==='function');
    if (!hasCallbacks) return new Promise((resolve,reject)=>wrappers.getStorageInfo({success:resolve,fail:reject}));
    return native.getStorageInfo({
      success(info) {
        let result;
        try { result=filtered(info); } catch (e) {
          const fail={errMsg:'getStorageInfo:fail isolation '+e.message};
          if(options.fail) options.fail(fail); if(options.complete) options.complete(fail); return;
        }
        if(options.success) options.success(result); if(options.complete) options.complete(result);
      },
      fail(e) { if(options.fail) options.fail(e); if(options.complete) options.complete(e); }
    });
  };
  wrappers.clearStorage = function(options={}) {
    const hasCallbacks=['success','fail','complete'].some(k=>typeof options[k]==='function');
    if (!hasCallbacks) return new Promise((resolve,reject)=>wrappers.clearStorage({success:resolve,fail:reject}));
    // Deliberately never invoke native clearStorage. Enumerate keys only, remove our prefix.
    return native.getStorageInfo({
      success(info) {
        let keys;
        try { keys=ownKeys(info); } catch(e) { done(false,{errMsg:'clearStorage:fail '+e.message}); return; }
        let i=0;
        function next() {
          if(i===keys.length) { done(true,{errMsg:'clearStorage:ok'}); return; }
          const k=keys[i++]; record('clear-remove-async',k);
          native.removeStorage({key:k,success:next,fail:e=>done(false,e)});
        }
        next();
      },fail:e=>done(false,e)
    });
    function done(ok,result) { if(ok && options.success) options.success(result); if(!ok && options.fail) options.fail(result); if(options.complete) options.complete(result); }
  };
  // Unknown storage entrances are rejected, including batch variants if present.
  for (const n of found) if (!names.includes(n)) wrappers[n] = () => { throw Error('uncovered storage API rejected: '+n); };
  for (const n of Object.keys(wrappers)) {
    Object.defineProperty(wx,n,{value:wrappers[n],writable:false,configurable:false,enumerable:true});
    if(wx[n]!==wrappers[n]) throw Error('storage interception failed: '+n);
  }
  // Nothing calls storage during installation. Failure throws out of game.js before initialization.
  return Object.freeze({prefix,covered:names.slice(),rejected:[...found].filter(n=>!names.includes(n)),trace:()=>traces.map(x=>({...x})),snapshot:()=>audit.map(x=>({...x}))});
};
