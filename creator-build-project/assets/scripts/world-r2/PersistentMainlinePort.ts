import { sys } from 'cc';
import MainlinePort from '../mainline-r1/adapter/mainline-port.js';
export const MAINLINE_NAMESPACE='dot-mainline-r1-isolated-20261009:';
export const MAINLINE_KEYS=['forest-mainline-cocos-r1-active','forest-v33-journey','forest-v3-progress','forest-v3-completed'];
/** Isolated real Cocos storage. Never overwrites the user's formal journey keys. */
export function createPersistentMainlinePort(namespace=MAINLINE_NAMESPACE) {
 if(!/^dot-mainline-r1-(isolated|test)-[a-zA-Z0-9:_-]+:$/.test(namespace))throw Error('Isolated mainline namespace required');
 const ls=writeThroughStorage({getItem:(k:string)=>sys.localStorage.getItem(namespace+k),setItem:(k:string,v:string)=>sys.localStorage.setItem(namespace+k,v)});
 const port=MainlinePort.createPort(ls);
 // Boot window, not the first setCamera frame: later createController reads hit memory (steady getItem stays 0).
 const warmKeys=()=>{for(let i=0;i<MAINLINE_KEYS.length;i++)ls.getItem(MAINLINE_KEYS[i]);};
 try{const later=(globalThis as any).setTimeout;if(typeof later==='function')later(warmKeys,0);else warmKeys();}catch{warmKeys();}
 return Object.assign(port,{namespace,storageCache:ls,inspect:()=>MAINLINE_KEYS.map(k=>[k,ls.getItem(k)])});
}
/** P0 freeze (Mac chainL b9fe8f39, CDP stack): ManagedMobileBoardUI render → paintToolTray → barTools → toolCatalog → tools →
 *  R5 provider snapshot → progress-journal isUnlocked → mainline journey readOnlyView getter (readOnly / records) → JourneyBridge
 *  snapshot → inspect → platform.load → localStorage.getItem → wx.getStorageSync: a sync host IPC per getter, per stage, per redraw.
 *  Every read of this isolated namespace now comes from memory; the namespace has exactly one writer (this port), so the cache is
 *  write-through: setItem writes storage, then re-reads that ONE key once so a failed or silently dropped write reads back exactly as
 *  storage does (durable-store verification semantics unchanged). A failed read is not cached (it is retried like before). */
export function writeThroughStorage(store:{getItem(k:string):any;setItem(k:string,v:string):void}){
 const cache=new Map<string,any>();
 return {
  getItem(k:string){if(cache.has(k))return cache.get(k);const v=store.getItem(k);cache.set(k,v);return v;},
  setItem(k:string,v:string){cache.delete(k);try{store.setItem(k,v);}finally{try{cache.set(k,store.getItem(k));}catch{cache.delete(k);}}},
  invalidate(){cache.clear();},
  size(){return cache.size;},
 };
}
