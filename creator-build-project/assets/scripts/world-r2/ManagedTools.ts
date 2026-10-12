/** One provider-derived catalog. Counts are observations, never grants. */
export type ManagedTool = {kind:string;name:string;count:number;targeted:boolean;available:boolean;reason?:string;art?:string};
export const TOOL_NAMES:Record<string,string>={bomb:'星光',windBell:'风语铃',tideBottle:'潮汐瓶',tideNet:'潮汐网',sunSeed:'日光籽',starShears:'星剪',tideAnchor:'潮汐锚',prismShift:'棱镜移位'};
export function managedTools(s:any):ManagedTool[]{
  if(!s?.active)return [];
  if(s.provider==='mainline-v33'){
    const region=Math.floor(s.active.level/4),regional=['tideNet','sunSeed','starShears'][region];
    const kinds=['bomb','windBell','tideBottle'];
    if(s.journey?.regionRewards?.some((r:any)=>r.region===region&&r.claimed))kinds.push(regional);
    return kinds.map(kind=>{
      const count=kind==='bomb'?s.active.bombs??0:s.journey?.inventory?.tools?.[kind]??0;
      return {kind,name:TOOL_NAMES[kind],count,targeted:true,available:count>0,art:kind,
        reason:kind==='bomb'?'本局星光已用完':'这件道具已用完，可从已获得的宝箱或地区礼物领取'};
    });
  }
  if(s.provider==='regional-r05'&&s.active.tool){const t=s.active.tool;return [{kind:t.kind,name:TOOL_NAMES[t.kind]||t.kind,count:t.charges??0,targeted:t.kind==='sunSeed',available:t.charges>0,art:t.kind==='sunSeed'?'sunSeed':undefined,reason:'本关道具已用完'}];}
  return [];
}
