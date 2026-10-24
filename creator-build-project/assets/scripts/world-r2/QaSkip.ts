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
export function qaSkipAllowed(host:any=globalThis):boolean{
 try{const wx=host?.wx;if(!wx)return true;const env=wx.getAccountInfoSync?.()?.miniProgram?.envVersion;return env==='develop'||env==='trial';}catch{return false;}
}
export function qaSkipTarget(search?:string|null,host:any=globalThis):QaSkipTarget|null{
 let q=search;
 if(q==null){try{q=String(host?.location?.search||'');}catch{q='';}}
 const m=/(?:^|[?&])qfSkip=([a-z-]+)(?:&|$)/.exec(q||'');
 if(!m||!(QA_SKIP_TARGETS as readonly string[]).includes(m[1])||!qaSkipAllowed(host))return null;
 return m[1] as QaSkipTarget;
}
/** p0drag9: test hooks (__qfTeleport / __qfAimAt / __qfBackToBoard) without a level skip: `?qfHooks=1` (or any valid ?qfSkip).
 *  Same host gate as qfSkip — WeChat release (envVersion 'release') never; web/QA build and WeChat develop/trial only. */
export function qaHooksEnabled(search?:string|null,host:any=globalThis):boolean{
 let q=search;if(q==null){try{q=String(host?.location?.search||'');}catch{q='';}}
 if(!qaSkipAllowed(host))return false;
 return qaSkipTarget(q,host)!==null||/(?:^|[?&])qfHooks=1(?:&|$)/.test(q||'');
}
/** FreeOrbit / camTrace yaw (degrees, world): the lens sits at her look point + d·(sin yaw·cos p, sin p, cos yaw·cos p), i.e. the camera
 *  looks along −(sin yaw, ·, cos yaw); camTrace `yaw` (Main Camera euler Y) is the same number, camTrace `pitch` = −orbit pitch.
 *  To look from her TOWARD point p: yaw = atan2(g.x − p.x, g.z − p.z) (lens on the far side of her from p). */
export function qaYawFacing(g:readonly number[],p:readonly number[]):number{return Math.atan2(g[0]-p[0],g[2]-p[2])*180/Math.PI;}
