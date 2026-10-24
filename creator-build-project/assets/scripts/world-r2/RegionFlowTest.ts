import { sys } from 'cc';
import { DEBUG } from 'cc/env';
import MainlinePort from '../mainline-r1/adapter/mainline-port.js';
import R4Port from '../r4-cloud-compat/adapter/cocos-port.js';
import { R5_KEYS } from './PersistentR5Port';
import { REGION_FLOW_WITNESSES } from './RegionFlowWitnesses';
let serial=0;
/** Test build only. All progress is derived by original engine/controller operations in a fresh root. */
export function createRegionFlowCheckpoint(completed: number, opts?:{allowQa?:boolean;finish?:boolean}) {
 if(!DEBUG && !opts?.allowQa)throw Error('test-build-only');
 if(![4,8,12].includes(completed))throw Error('unsupported-checkpoint');
 const namespace='dot-region-flow-test-'+Date.now().toString(36)+'-'+(++serial)+'-'+Math.random().toString(36).slice(2)+':';
 const storage=(lane:string)=>({getItem:(key:string)=>sys.localStorage.getItem(namespace+lane+':'+key),setItem:(key:string,value:string)=>sys.localStorage.setItem(namespace+lane+':'+key,value)});
 const mainStorage=storage('mainline'),mainline=Object.assign(MainlinePort.createPort(mainStorage),{namespace:namespace+'mainline:',inspect:()=>['forest-mainline-cocos-r1-active','forest-v33-journey','forest-v3-progress','forest-v3-completed'].map(k=>[k,mainStorage.getItem(k)])});
 const controller=mainline.createController();
 const requireOK=(reply:any)=>{if(!reply?.ok)throw Error('checkpoint-save-or-replay-failed: '+(reply?.reason||'unknown'));};
 for(let level=0;level<completed;level++){
  const witness=REGION_FLOW_WITNESSES[level];requireOK(controller.startStage(witness.stageId,{seed:witness.seed}));
  const actions=level===completed-1&&!opts?.finish?witness.actions.slice(0,-1):witness.actions;
  for(const action of actions){const p=controller.previewAction(action);requireOK(p);requireOK(controller.commitAction(p.token));let v=controller.snapshot().visual;while(v){requireOK(controller.finishVisualStep(v.token));v=controller.snapshot().visual;}}
  const s=controller.snapshot();if((level<completed-1||opts?.finish)&&(!s.result?.completionRecorded||s.state!=='result.saved'))throw Error('unregistered-replay');
 }
 // b17r10 qfSkip: finish=true registers the last win too (all `completed` stages cleared, nothing paused).
 if(!opts?.finish){const before=controller.snapshot();if(before.active.status!=='playing'||before.journey.completed!==completed-1)throw Error('checkpoint-not-before-legal-win');
 requireOK(controller.pause());}
 const stage=REGION_FLOW_WITNESSES[completed-1];
 const r4={platform:R4Port.createSynchronousStorage(storage('r4')),journey:mainline.journey};
 const r5Platform=R4Port.createSynchronousStorage(storage('r5'));
 const r5={platform:r5Platform,journey:mainline.journey,namespace:namespace+'r5:',inspect:()=>R5_KEYS.map(key=>[key,r5Platform.load(key)])};
 return {namespace,mainline,r4,r5,stageId:stage.stageId,seed:stage.seed,lastAction:stage.actions[stage.actions.length-1],completed};
}
