import { sys } from 'cc';
import { DEBUG } from 'cc/env';
import MainlinePort from '../mainline-r1/adapter/mainline-port.js';
import R4Port from '../r4-cloud-compat/adapter/cocos-port.js';
import { R5_KEYS } from './PersistentR5Port';
import { REGION_FLOW_WITNESSES } from './RegionFlowWitnesses';
import { LAKE_WIN_WITNESSES } from './LakeWinWitnesses';
import RegionalAPI from '../regional-r05/runtime/index.js';
import R5Provider from '../regional-r05/runtime/board-session-provider.js';
let serial=0;
/** Test build only. All progress is derived by original engine/controller operations in a fresh root. */
export function createRegionFlowCheckpoint(completed: number, opts?:{allowQa?:boolean;finish?:boolean;anyCheckpoint?:boolean}) {
 if(!DEBUG && !opts?.allowQa)throw Error('test-build-only');
 if(![4,8,12].includes(completed)&&!(opts?.allowQa&&opts?.anyCheckpoint&&Number.isInteger(completed)&&completed>=1&&completed<=12))throw Error('unsupported-checkpoint');/* pre-transition: any 1..12 (QA gate only) */
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
/** Test build only (__qfPreTransition lake-* keys). On a finish=true checkpoint-12 profile, clear every lakeside stage before
 *  `stageId` in order (sequential unlock; L18 bridge therefore also has L13–L15) by replaying 场景设计部's verified wins through
 *  the real R5 provider (preview/commit/finishVisualStep), then start `stageId` and stop ONE move short: mode 'win' = recorded
 *  winning replay minus its last swap; 'lose' = deterministic non-winning swaps until 1 move is left and a losing swap exists.
 *  The active record is paused, so the real lakeside entry (regionSelection) restores exactly this board. */
export function seedLakeCheckpoint(profile:any,stageId:string,mode:'win'|'lose',opts?:{allowQa?:boolean}){
 if(!DEBUG && !opts?.allowQa)throw Error('test-build-only');
 const API:any=RegionalAPI,target=API.getStage(stageId);if(!target||target.region!=='lake')throw Error('not-lake-stage');
 const P:any=new (R5Provider as any)({platform:profile.r5.platform,journey:profile.r5.journey});
 const ok=(r:any,what:string)=>{if(!r?.ok)throw Error('lake-seed-failed: '+what+' '+(r?.reason||''));};
 const play=(actions:readonly any[])=>{for(const a of actions){const p=P.previewAction(a);ok(p,'preview');ok(P.commitAction(p.token),'commit');let v=P.snapshot().visual;while(v){ok(P.finishVisualStep(v.token),'visual');v=P.snapshot().visual;}}};
 const start=(id:string,seed:number)=>{ok(P.startStage(id,{seed}),'start '+id);P.resume();};
 for(const w of LAKE_WIN_WITNESSES){const st=API.getStage(w.stageId);if(!st||st.ordinal>=target.ordinal)continue;
  start(w.stageId,w.seed);play(w.actions);const s=P.snapshot();if(s.state!=='result.saved'||!s.result?.completionRecorded)throw Error('lake-unregistered-replay '+w.stageId);}
 let seed:number,actions:any[],last:any;
 if(mode==='win'){const w=LAKE_WIN_WITNESSES.find(x=>x.stageId===stageId);if(!w)throw Error('no-lake-witness');seed=w.seed;actions=w.actions.slice(0,-1) as any[];last=w.actions[w.actions.length-1];}
 else{seed=target.seedBank[0];const s=API.createSession(stageId,seed);actions=[];last=null;
  for(let g=0;g<80&&!last;g++){const legal=s.legalActions({tools:false}).filter((a:any)=>a[0]==='swap'),after=(a:any)=>{const t=API.restore(s.checkpoint());t.act(a);return t.snapshot().status;};
   if(s.snapshot().moves===1){last=legal.find((a:any)=>after(a)==='lost')||null;if(!last)throw Error('no-losing-move');break;}
   const a=legal.find((x:any)=>after(x)==='playing');if(!a)throw Error('no-safe-move');s.act(a);actions.push(a);}
  if(!last)throw Error('lose-plan-overflow');}
 start(stageId,seed);play(actions);ok(P.pause(),'pause');
 const s=P.snapshot();if(s.active?.status!=='playing'||s.active.stageId!==stageId)throw Error('lake-not-one-move-short');
 return {stageId,seed,lastAction:last,cleared:LAKE_WIN_WITNESSES.filter(w=>API.getStage(w.stageId).ordinal<target.ordinal).map(w=>w.stageId)};
}
