import { sys } from 'cc';
import MainlinePort from '../mainline-r1/adapter/mainline-port.js';
export const MAINLINE_NAMESPACE='dot-mainline-r1-isolated-20261009:';
export const MAINLINE_KEYS=['forest-mainline-cocos-r1-active','forest-v33-journey','forest-v3-progress','forest-v3-completed'];
/** Isolated real Cocos storage. Never overwrites the user's formal journey keys. */
export function createPersistentMainlinePort(namespace=MAINLINE_NAMESPACE) {
 if(!/^dot-mainline-r1-(isolated|test)-[a-zA-Z0-9:_-]+:$/.test(namespace))throw Error('Isolated mainline namespace required');
 const port=MainlinePort.createPort({getItem:(k:string)=>sys.localStorage.getItem(namespace+k),setItem:(k:string,v:string)=>sys.localStorage.setItem(namespace+k,v)});
 return Object.assign(port,{namespace,inspect:()=>MAINLINE_KEYS.map(k=>[k,sys.localStorage.getItem(namespace+k)])});
}
