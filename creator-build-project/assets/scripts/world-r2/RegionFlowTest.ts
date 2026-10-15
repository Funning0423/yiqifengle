import { sys } from 'cc';
import { DEBUG } from 'cc/env';
import MainlinePort from '../mainline-r1/adapter/mainline-port.js';
import R4Port from '../r4-cloud-compat/adapter/cocos-port.js';
import { R5_KEYS } from './PersistentR5Port';
import { REGION_FLOW_WITNESSES } from './RegionFlowWitnesses';
let serial=0;
const MAINLINE_KEYS=['forest-mainline-cocos-r1-active','forest-v33-journey','forest-v3-progress','forest-v3-completed'];
const R4_KEYS=['forest-challenges-c01','forest-challenges-c01-active'];
/** Debug `?testNamespace=task21-…` only; maps to its own dot-region-flow-test root, never a user or default key. */
export function task21TestRoot(param:string|null|undefined):string|null{
 if(!DEBUG||!param)return null;
 if(!/^task21[-_][A-Za-z0-9_-]{1,64}$/.test(param))throw Error('invalid-task21-test-namespace');
 return 'dot-region-flow-test-'+param+':';
}
export function readTask21TestNamespace():string|null{
 if(!DEBUG)return null;
 try{const search=(globalThis as any).location?.search;if(!search)return null;return new URLSearchParams(search).get('testNamespace');}catch{return null;}
}
/** Mainline/R4/R5 lanes of one test root. Factory performs no writes. */
export function openRegionFlowRoot(namespace:string){
 if(!DEBUG)throw Error('test-build-only');
 if(!/^dot-region-flow-test-[A-Za-z0-9_-]+:$/.test(namespace))throw Error('invalid-region-flow-root');
 const storage=(lane:string)=>({getItem:(key:string)=>sys.localStorage.getItem(namespace+lane+':'+key),setItem:(key:string,value:string)=>sys.localStorage.setItem(namespace+lane+':'+key,value)});
 const mainStorage=storage('mainline'),mainline=Object.assign(MainlinePort.createPort(mainStorage),{namespace:namespace+'mainline:',inspect:()=>MAINLINE_KEYS.map(k=>[k,mainStorage.getItem(k)])});
 const r4Storage=storage('r4'),r4={platform:R4Port.createSynchronousStorage(r4Storage),journey:mainline.journey};
 const r5Platform=R4Port.createSynchronousStorage(storage('r5'));
 const r5={platform:r5Platform,journey:mainline.journey,namespace:namespace+'r5:',inspect:()=>R5_KEYS.map(key=>[key,r5Platform.load(key)])};
 const empty=()=>MAINLINE_KEYS.every(k=>mainStorage.getItem(k)===null)&&R4_KEYS.every(k=>r4Storage.getItem(k)===null)&&R5_KEYS.every(k=>r5Platform.load(k)===null);
 return {namespace,mainline,r4,r5,empty};
}
/** Test build only. All progress is derived by original engine/controller operations in a fresh root. */
export function createRegionFlowCheckpoint(completed: number,pinnedRoot?:string) {
 if(!DEBUG)throw Error('test-build-only');
 if(![4,8,12].includes(completed))throw Error('unsupported-checkpoint');
 const namespace=pinnedRoot||'dot-region-flow-test-'+Date.now().toString(36)+'-'+(++serial)+'-'+Math.random().toString(36).slice(2)+':';
 const root=openRegionFlowRoot(namespace);if(!root.empty())throw Error('test-root-not-empty');
 const {mainline,r4,r5}=root;
 const controller=mainline.createController();
 const requireOK=(reply:any)=>{if(!reply?.ok)throw Error('checkpoint-save-or-replay-failed: '+(reply?.reason||'unknown'));};
 for(let level=0;level<completed;level++){
  const witness=REGION_FLOW_WITNESSES[level];requireOK(controller.startStage(witness.stageId,{seed:witness.seed}));
  const actions=level===completed-1?witness.actions.slice(0,-1):witness.actions;
  for(const action of actions){const p=controller.previewAction(action);requireOK(p);requireOK(controller.commitAction(p.token));let v=controller.snapshot().visual;while(v){requireOK(controller.finishVisualStep(v.token));v=controller.snapshot().visual;}}
  const s=controller.snapshot();if(level<completed-1&&(!s.result?.completionRecorded||s.state!=='result.saved'))throw Error('unregistered-replay');
 }
 const before=controller.snapshot();if(before.active.status!=='playing'||before.journey.completed!==completed-1)throw Error('checkpoint-not-before-legal-win');
 requireOK(controller.pause());
 const stage=REGION_FLOW_WITNESSES[completed-1];
 return {namespace,mainline,r4,r5,stageId:stage.stageId,seed:stage.seed,lastAction:stage.actions[stage.actions.length-1],completed,pinned:!!pinnedRoot};
}
