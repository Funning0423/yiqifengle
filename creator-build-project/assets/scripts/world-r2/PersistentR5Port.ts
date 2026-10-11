import { sys } from 'cc';
import Port from '../r4-cloud-compat/adapter/cocos-port.js';
export const R5_TEST_NAMESPACE='dot-r5-v12-isolated-20261009:';
export const R5_KEYS=['forest-regional-r05-active','forest-regional-r05-progress','forest-regional-r05-active-v1-backup'];
/** Explicit isolated namespace; factory performs no writes. Original user keys are read nowhere here. */
export function createPersistentR5Port(existingJourneyReadOnlyView:any,namespace=R5_TEST_NAMESPACE) {
 if(!existingJourneyReadOnlyView||typeof existingJourneyReadOnlyView.readOnly!=='boolean'||!Array.isArray(existingJourneyReadOnlyView.records))throw Error('Inject real journey or an explicitly unavailable locked view');
 if(!/^dot-r5-v12-(isolated|test)-[a-zA-Z0-9:_-]+:$/.test(namespace))throw Error('Isolated R5 namespace required');
 const platform=Port.createSynchronousStorage({getItem:(key:string)=>sys.localStorage.getItem(namespace+key),setItem:(key:string,value:string)=>sys.localStorage.setItem(namespace+key,value)});
 return {platform,journey:existingJourneyReadOnlyView,namespace,inspect:()=>R5_KEYS.map(key=>[key,platform.load(key)])};
}
/** Dependency absent: no invented stars. Existing valid active records remain recoverable. */
export function unavailableJourney(){return {readOnly:false,records:[],source:'unavailable-real-mainline-reader',available:false};}
