/**
 * GGbot HUD API (T2+ integration, agreed with 运镜bot / Funning 2026-10-11).
 * The top status plate (WorldIntegrationBoot `status` LabelPlate) is HIDDEN during the outbound / return cutscenes and
 * slides back in (position only, NO opacity fade) once the camera is at rest and the girl is still.
 *
 *   hide(reason)    idempotent; hidden -> no-op. Cancels any slide in progress (plate jumps off-screen, never fades).
 *   slideIn(reason) idempotent; shown or already sliding -> no-op (never a double slide). 0.25 s ease-out from above the
 *                   top edge to the plate's base pose. The base pose is the layout pose clamped below the WeChat capsule /
 *                   safe-area top (see topInset()).
 *
 * Driver (StatusHudDriver) — call sites in WorldIntegrationBoot:
 *   outbound: state 'standing'      -> hide()
 *             state 'island' (from crossing-out) AND onCameraSettled('island') (either order) -> slideIn()
 *   return:   state 'walking-home'  -> hide()
 *             state 'home' (from sitting) -> slideIn() after onCameraSettled('home') if hooks exist
 * Fallback (camera-relative; restore()/'island' may be observed BEFORE the camera settles, so a fixed 2 s after
 * 'island' could slide the HUD in mid-crane):
 *   no T2+ hooks (no onCameraSettled API)      -> slideIn 2 s after the target state        path=timeout-nohooks
 *   hooks + onCraneStart seen (outbound)       -> min(cap 10 s, crane remaining + 2 s) after island  path=timeout-crane
 *   hooks, no crane seen (fixed mode / return) -> 2 s after the target state                path=timeout-nocrane
 *   settle arrives first                       -> path=settled
 * Interruptions: while hidden, any state that is neither a cutscene state nor the awaited target (paused, error,
 * a cancelled leave back at 'home', a cancelled return back at 'island', level/skycity...) slides in immediately
 * (path=interrupt). Absolute safety: never hidden longer than 60 s (path=timeout-max). Every slideIn logs its path.
 * Pure: no engine imports; the Boot binding applies offsetY()/visible() to the plate node every frame.
 */
export type HudPath='settled'|'timeout-crane'|'timeout-nohooks'|'timeout-nocrane'|'interrupt'|'timeout-max'|'direct';
export type HudLog=(msg:string,data:Record<string,unknown>)=>void;
export const HUD_SLIDE_SECONDS=.25, HUD_FALLBACK_SECONDS=2, HUD_CRANE_CAP_SECONDS=10, HUD_MAX_HIDDEN_SECONDS=60;
/** 运镜bot T2+ figures: crane starts ~4.93 s after crossing-out begins and lasts ~7.68 s (settle ~12.6 s). */
export const CRANE_EXPECTED_SECONDS=7.68;

export class StatusHud {
  private phase:'shown'|'hidden'|'sliding'='shown'; private t=0;
  constructor(private readonly log:HudLog=defaultLog){}
  get hidden():boolean{return this.phase==='hidden';}
  get state():'shown'|'hidden'|'sliding'{return this.phase;}
  hide(reason:string):boolean{if(this.phase==='hidden')return false;this.phase='hidden';this.t=0;this.log('hide',{reason});return true;}
  slideIn(reason:string,path:HudPath='direct'):boolean{if(this.phase!=='hidden')return false;this.phase='sliding';this.t=0;this.log('slideIn',{reason,path});return true;}
  tick(dt:number){if(this.phase!=='sliding')return;this.t+=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.1));if(this.t>=HUD_SLIDE_SECONDS)this.phase='shown';}
  /** 0 = fully in, 1 = fully off-screen (above the top edge). */
  outFraction():number{if(this.phase==='hidden')return 1;if(this.phase==='shown')return 0;const u=Math.min(1,this.t/HUD_SLIDE_SECONDS);return Math.pow(1-u,3);}
  /** Upward offset in px for a plate whose top edge sits `topGap` px below the screen top and is `height` tall. */
  offsetY(topGap:number,height:number):number{return this.outFraction()*(Math.max(0,topGap)+Math.max(0,height)+8);}
}

const CUTSCENE=new Set(['standing','turning-out','walking-out','opening-door','crossing-out','walking-home','crossing-in','closing-door','walking-to-seat','sitting']);
export type HudHooks={hasHooks:boolean};

export class StatusHudDriver {
  private target:'island'|'home'|null=null; private reached=false; private settled=false;
  private craneAt=-1; private reachedAt=-1; private deadline=-1; private deadlinePath:HudPath='timeout-nohooks';
  private now=0; private hiddenAt=-1; private prev:string|null=null;
  constructor(readonly hud:StatusHud,private hooks:HudHooks,private readonly log:HudLog=defaultLog){}
  setHooks(h:HudHooks){this.hooks=h;}
  /** Flow state as observed by the Boot (polled snapshot, each change once). */
  onState(state:string){const prev=this.prev;if(state===prev)return;this.prev=state;
    if(state==='standing'){this.begin('island','standing');return;}
    if(state==='walking-home'){this.begin('home','walking-home');return;}
    if(!this.hud.hidden||!this.target)return;
    if(state===this.target&&prev!==null&&CUTSCENE.has(prev)){this.reach();return;}
    if(CUTSCENE.has(state))return;
    this.finish('interrupt','state:'+state);
  }
  /** WorldFlowComponent.onCameraSettled(place). May arrive before or after the Boot sees the state. */
  onSettled(place:string){if(!this.hud.hidden||place!==this.target)return;this.settled=true;if(this.reached)this.finish('settled','settled:'+place);}
  /** WorldFlowComponent.onCraneStart(info). */
  onCraneStart(_info?:unknown){if(this.hud.hidden&&this.target==='island'&&this.craneAt<0)this.craneAt=this.now;}
  tick(dt:number){const d=Math.max(0,Number.isFinite(dt)?dt:0);this.now+=d;this.hud.tick(d);
    if(!this.hud.hidden)return;
    if(this.deadline>=0&&this.now>=this.deadline){this.finish(this.deadlinePath,'fallback:'+this.target);return;}
    if(this.hiddenAt>=0&&this.now-this.hiddenAt>=HUD_MAX_HIDDEN_SECONDS)this.finish('timeout-max','max-hidden');}
  private begin(target:'island'|'home',state:string){this.target=target;this.reached=false;this.settled=false;this.craneAt=-1;this.reachedAt=-1;this.deadline=-1;
    if(this.hud.hide(state))this.hiddenAt=this.now;}
  private reach(){this.reached=true;this.reachedAt=this.now;
    if(this.settled){this.finish('settled','settled-before-state:'+this.target);return;}
    if(!this.hooks.hasHooks){this.deadline=this.now+HUD_FALLBACK_SECONDS;this.deadlinePath='timeout-nohooks';}
    else if(this.target==='island'&&this.craneAt>=0){const remaining=Math.max(0,this.craneAt+CRANE_EXPECTED_SECONDS-this.now);
      this.deadline=this.now+Math.min(HUD_CRANE_CAP_SECONDS,remaining+HUD_FALLBACK_SECONDS);this.deadlinePath='timeout-crane';}
    else{this.deadline=this.now+HUD_FALLBACK_SECONDS;this.deadlinePath='timeout-nocrane';}
    this.log('await-settle',{target:this.target,hooks:this.hooks.hasHooks,crane:this.craneAt>=0,timeout:+(this.deadline-this.now).toFixed(3),path:this.deadlinePath});
  }
  private finish(path:HudPath,reason:string){const target=this.target;this.target=null;this.deadline=-1;this.hiddenAt=-1;
    if(this.hud.slideIn(reason,path)&&path!=='settled')this.log('fallback',{path,target,reason,afterTarget:this.reachedAt>=0?+(this.now-this.reachedAt).toFixed(3):null});}
}

function defaultLog(msg:string,data:Record<string,unknown>){try{console.info('[OI_HUD] '+msg+' '+JSON.stringify(data));}catch{}}

/** Top inset (px, canvas units) the plate must clear: WeChat capsule bottom + 4, or safe-area top; 0 off-WeChat. */
export function topInset(canvasHeight:number):number{const wx=(globalThis as any).wx;if(!wx)return 0;
  try{let info:any=null;try{info=wx.getWindowInfo?.();}catch{}if(!info)info=wx.getSystemInfoSync?.();const hh=Number(info?.windowHeight);if(!(hh>0))return 0;const sy=canvasHeight/hh;let top=0;
    const a=info?.safeArea;if(a&&Number.isFinite(a.top)&&a.top>=0&&a.top<hh*.35)top=Math.max(top,a.top*sy);
    try{const r=wx.getMenuButtonBoundingClientRect?.();if(r&&Number.isFinite(r.bottom)&&r.bottom>0&&r.bottom<hh*.35)top=Math.max(top,(r.bottom+4)*sy);}catch{}
    return top;}catch{return 0;}}
