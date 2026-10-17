/** build05-next journey-merge (side branch, lead: apply if the Mac journey peak DC > 60): the island→lakeside journey mounts the
 *  same 431 r5h3 instances as the board, but without batching they draw one by one. This gives the journey model the board's
 *  treatment: shared USE_INSTANCING material copies, then (unless ?lakemerge=off) the static merge, water kept out of the merge.
 *  Pure (no cc import): the adapter passes the real enableLakesideInstancing / mergeLakesideStatic. release() destroys what was
 *  created exactly once (merged meshes + instanced material copies); merged nodes live under the model and go with the rig. */
export interface Destroyable{destroy():unknown}
export interface JourneyMergeOut<M extends Destroyable>{meshes:M[];stats:{chunks:number;pieces:number;vertices:number;ms:number;skipped?:string}}
export interface JourneyBatchingDeps<N,Mat extends Destroyable,M extends Destroyable>{
 instancing(model:N):Mat[];
 merge(model:N,skip:(n:N)=>boolean):JourneyMergeOut<M>;
 mergeEnabled():boolean;
 isWater(n:N):boolean;
}
export interface JourneyBatching{instancedMaterials:number;merged:JourneyMergeOut<Destroyable>['stats']|null;release():void}
export function applyLakesideJourneyBatching<N,Mat extends Destroyable,M extends Destroyable>(model:N,deps:JourneyBatchingDeps<N,Mat,M>):JourneyBatching{
 const owned:Destroyable[]=[];let released=false;
 const release=()=>{if(released)return;released=true;for(const a of owned.splice(0)){try{a.destroy();}catch{}}};
 try{
  const mats=deps.instancing(model);for(const m of mats)owned.push(m);
  let merged:JourneyMergeOut<M>|null=null;
  if(deps.mergeEnabled()){merged=deps.merge(model,n=>deps.isWater(n));for(const m of merged.meshes)owned.push(m);}
  try{if((globalThis as any).__worldFlowLog)console.info('[QF_LAKESIDE] '+JSON.stringify({event:'journey-batching',instancedMaterials:mats.length,merge:merged?merged.stats:'off'}));}catch{}
  return {instancedMaterials:mats.length,merged:merged?merged.stats:null,release};
 }catch(error){release();throw error;}
}
