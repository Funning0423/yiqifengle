/** b17r10: test-only level skip for 全流程测试部. Engine-independent (no 'cc'), unit-tested in Node.
 *  URL `?qfSkip=<target>` on the web/QA build, or a WeChat develop/trial build. Off by default: no param -> null;
 *  WeChat release (envVersion 'release', no location) -> null. No on-screen banner or button — it only swaps in an
 *  isolated, engine-replayed test profile (real saves untouched) and enters the target. */
export type QaSkipTarget='island-finale'|'meadow-finale'|'skycity-finale'|'lakeside';
export const QA_SKIP_TARGETS:readonly QaSkipTarget[]=['island-finale','meadow-finale','skycity-finale','lakeside'];
/** island/meadow/skycity: paused one move before that region's last mainline stage (04/08/12). lakeside: all 12 cleared, enter 风铃湖畔. */
export const QA_SKIP_CHECKPOINT:Record<QaSkipTarget,{completed:number;finish:boolean}>={
 'island-finale':{completed:4,finish:false},'meadow-finale':{completed:8,finish:false},'skycity-finale':{completed:12,finish:false},lakeside:{completed:12,finish:true},
};
/** P0 finR (Mac dc48cb42 sync-probe STEADY f1836: preTransitionEnabled → qaSkipAllowed → wx.getAccountInfoSync): the mini-program
 *  envVersion and the launch/enter query are fixed for the process, so each is read from the host ONCE per wx object (first call =
 *  boot) and served from memory afterwards. Every env/query gate (QaSkip, PreTransitionKeys, DebugQuery, JourneyTransport,
 *  DevPreviewMark) goes through these two functions; no gameplay call reaches a sync host API. A throwing read is cached as ''/null. */
const envCache=new WeakMap<object,string|null>(),wxQueryCache=new WeakMap<object,Record<string,string>>();
export function wxEnvVersion(wx:any):string|null{
 if(!wx||(typeof wx!=='object'&&typeof wx!=='function'))return null;const hit=envCache.get(wx);if(hit!==undefined)return hit;
 let env:string|null=null;try{const v=wx.getAccountInfoSync?.()?.miniProgram?.envVersion;env=typeof v==='string'?v:null;}catch{env=null;}
 envCache.set(wx,env);return env;
}
export function wxQaEnv(wx:any):boolean{const env=wxEnvVersion(wx);return env==='develop'||env==='trial';}
function wxLaunchQuery(wx:any):Record<string,string>{
 if(!wx||typeof wx!=='object')return {};const hit=wxQueryCache.get(wx);if(hit)return hit;const out:Record<string,string>={};
 const addObj=(q:any)=>{if(!q||typeof q!=='object')return;for(const k of Object.keys(q))out[k]=String(q[k]);};
 try{addObj(wx.getEnterOptionsSync?.()?.query);}catch{}
 try{addObj(wx.getLaunchOptionsSync?.()?.query);}catch{}
 wxQueryCache.set(wx,out);return out;
}
export function qaSkipAllowed(host:any=globalThis):boolean{
 try{const wx=host?.wx;if(!wx)return true;return wxQaEnv(wx);}catch{return false;}
}
/** Test query from ALL sources: location.search (web; in WeChat DevTools the worker has a read-only non-empty one like
 *  '?contextName=game&id=2'), then wx.getEnterOptionsSync().query, then wx.getLaunchOptionsSync().query (DevTools 编译模式
 *  启动参数) — launch keys win. Returned as a '?k=v&…' string. Never throws. The release gate is separate (qaSkipAllowed). */
export function qaQuery(host:any=globalThis):string{
 const out=new Map<string,string>();
 const addSearch=(s:any)=>{if(typeof s!=='string'||!s)return;for(const part of s.replace(/^\?/,'').split('&')){if(!part)continue;const i=part.indexOf('=');out.set(i<0?part:part.slice(0,i),i<0?'':part.slice(i+1));}};
 const addObj=(q:any)=>{if(!q||typeof q!=='object')return;for(const k of Object.keys(q))out.set(k,String(q[k]));};
 try{addSearch(host?.location?.search);}catch{}
 try{addObj(wxLaunchQuery(host?.wx));}catch{}/* enter then launch, read once per wx object */
 if(!out.size)return '';const parts:string[]=[];out.forEach((v,k)=>{parts.push(k+'='+v);});return '?'+parts.join('&');
}
/** Harness enable without launch params (DevTools `cli open` ignores 编译模式 启动参数): the autoplay tool sets
 *  globalThis.__qfHooksEnable=true or calls __qfPreTransition('enable'). Still behind qaSkipAllowed (WeChat release never). */
export function qaHarnessEnabled(host:any=globalThis):boolean{try{return host?.__qfHooksEnable===true;}catch{return false;}}
export function qaSkipTarget(search?:string|null,host:any=globalThis):QaSkipTarget|null{
 let q=search;
 if(q==null)q=qaQuery(host);
 const m=/(?:^|[?&])qfSkip=([a-z-]+)(?:&|$)/.exec(q||'');
 if(!m||!(QA_SKIP_TARGETS as readonly string[]).includes(m[1])||!qaSkipAllowed(host))return null;
 return m[1] as QaSkipTarget;
}
/** p0drag9: test hooks (__qfTeleport / __qfAimAt / __qfBackToBoard) without a level skip: `?qfHooks=1` (or any valid ?qfSkip).
 *  Same host gate as qfSkip — WeChat release (envVersion 'release') never; web/QA build and WeChat develop/trial only. */
export function qaHooksEnabled(search?:string|null,host:any=globalThis):boolean{
 let q=search;if(q==null)q=qaQuery(host);
 if(!qaSkipAllowed(host))return false;
 if(qaHarnessEnabled(host))return true;
 return qaSkipTarget(q,host)!==null||/(?:^|[?&])qfHooks=1(?:&|$)/.test(q||'');
}
/** FreeOrbit / camTrace yaw (degrees, world): the lens sits at her look point + d·(sin yaw·cos p, sin p, cos yaw·cos p), i.e. the camera
 *  looks along −(sin yaw, ·, cos yaw); camTrace `yaw` (Main Camera euler Y) is the same number, camTrace `pitch` = −orbit pitch.
 *  To look from her TOWARD point p: yaw = atan2(g.x − p.x, g.z − p.z) (lens on the far side of her from p). */
export function qaYawFacing(g:readonly number[],p:readonly number[]):number{return Math.atan2(g[0]-p[0],g[2]-p[2])*180/Math.PI;}
