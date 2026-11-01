import { sys } from 'cc';
import { DEBUG } from 'cc/env';
import MainlinePort from '../mainline-r1/adapter/mainline-port.js';
import R4Port from '../r4-cloud-compat/adapter/cocos-port.js';
import { R5_KEYS } from './PersistentR5Port';
import { writeThroughStorage } from './PersistentMainlinePort';
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
 /* P0 finR (Mac dc48cb42 f1836: 7183 sync localStorage.getItem in one frame): every controller step (startStage/preview/commit/
  * finishVisualStep/snapshot) re-loaded the journey via load → localStorage.getItem → wx.getStorageSync. This fresh namespace has
  * exactly one writer (this profile's ports), so each lane is served by the same write-through cache as PersistentMainlinePort:
  * each key is read from storage once per profile, and every write re-reads that one key (dropped/failed writes read back as storage). */
 const lanes=new Map<string,any>();let defer=false;/*QF_PROBE_BEGIN*/defer=deferNext;deferNext=false;/*QF_PROBE_END*/
 const raw=(lane:string)=>({getItem:(key:string)=>sys.localStorage.getItem(namespace+lane+':'+key),setItem:(key:string,value:string)=>sys.localStorage.setItem(namespace+lane+':'+key,value)});
 const storage=(lane:string)=>{let c=lanes.get(lane);if(!c){c=/*QF_PROBE_BEGIN*/defer?deferredStorage(raw(lane)):/*QF_PROBE_END*/writeThroughStorage(raw(lane));lanes.set(lane,c);}return c;};
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
 const out:any={namespace,mainline,r4,r5,stageId:stage.stageId,seed:stage.seed,lastAction:stage.actions[stage.actions.length-1],completed};
 /*QF_PROBE_BEGIN*/if(defer){const all=()=>Array.from(lanes.values());out.pendingWrites=()=>all().reduce((n,c)=>n+c.pending(),0);
  /** writes the buffered keys, at most `perFrame` sync storage calls per step (write + verify re-read = 2 per key) */
  out.flushStep=(perFrame:number=CHECKPOINT_FLUSH_PER_FRAME)=>{let budget=Math.max(2,perFrame|0);for(const c of all()){budget=c.flushSome(budget);if(budget<2)break;}return out.pendingWrites();};
  out.endDefer=()=>{for(const c of all())c.endDefer();};pendingFlush=out;}/*QF_PROBE_END*/
 return out;
}
/*QF_PROBE_BEGIN*//** p0-meadow-ab A — TEST ONLY, stripped from release with the probes (STRIP_PROBES) (fin r6 6fb9181b: 472 sync calls under qa:pre-transition-profile in the sail set-off frame). TEST ONLY.
 *  Max sync storage calls per frame while the deferred QA profile is written out. 16 = 8 keys × (setItem + verify getItem):
 *  above the boot frame's real max (7) yet ≈ 1/30 of the old 472-call frame; at the ~0.1–0.25 ms a WeChat sync storage call
 *  costs on device this keeps the flush inside the 4 ms/frame budget Grok Bot set for set-off work. Gate: pre-transition-sync-frames. */
export const CHECKPOINT_FLUSH_PER_FRAME=16;
let deferNext=false,pendingFlush:any=null;
/** The NEXT createRegionFlowCheckpoint keeps its writes in memory (fresh random namespace = storage is known empty: no reads either),
 *  so building the profile makes zero sync storage calls; the caller then writes it out over frames with flushStep(). */
export function deferNextCheckpointWrites(on=true){deferNext=on;}
export function takeCheckpointFlush():any{const p=pendingFlush;pendingFlush=null;return p;}
/** Write-back lane for a FRESH namespace: reads/writes served from memory while deferring; flushSome writes dirty keys and re-reads
 *  each once (same verification as writeThroughStorage). After endDefer it behaves exactly like writeThroughStorage. */
export function deferredStorage(store:{getItem(k:string):any;setItem(k:string,v:string):void}){
 const cache=new Map<string,any>(),dirty=new Set<string>();let deferring=true;
 const verify=(k:string)=>{try{cache.set(k,store.getItem(k));}catch{cache.delete(k);}};
 return {
  getItem(k:string){if(cache.has(k))return cache.get(k);if(deferring)return null;const v=store.getItem(k);cache.set(k,v);return v;},
  setItem(k:string,v:string){if(deferring){cache.set(k,String(v));dirty.add(k);return;}dirty.delete(k);cache.delete(k);try{store.setItem(k,v);}finally{verify(k);}},
  flushSome(budget:number){for(const k of Array.from(dirty)){if(budget<2)break;dirty.delete(k);budget-=2;try{store.setItem(k,cache.get(k));}finally{verify(k);}}return budget;},
  pending(){return dirty.size;},
  endDefer(){if(dirty.size)throw Error('checkpoint-flush-incomplete');deferring=false;},
  invalidate(){if(!deferring)cache.clear();},
  size(){return cache.size;},
 };
}
/*QF_PROBE_END*/
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
