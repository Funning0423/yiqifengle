/** T0 GROKBOT_AUTOPLAY sequencer (GGbot). Engine-independent: no 'cc', no timers, no globals.
 * Debug/test-build only. This file lives under tools/grokbot-autoplay/ and is copied into
 * assets/ ONLY by install.sh for an autoplay build; release builds never contain it. */
export type AutoplayOptions={mode:'out-and-back';startDelayMs:number;holdMs:number;panelDelayMs:number;phaseTimeoutMs:number;door:'direct'|'drag';ret:'panel'|'direct'};
export const DEFAULT_OPTIONS:AutoplayOptions={mode:'out-and-back',startDelayMs:2000,holdMs:3000,panelDelayMs:800,phaseTimeoutMs:90000,door:'direct',ret:'panel'};
export type StepResult={ok:boolean;via?:string;reason?:string};
/** Everything the sequencer may touch. The glue implements these with the game's REAL handlers. */
export interface AutoplayDriver {
 now():number;                 // monotonic ms
 wall():string;                // wall clock text
 frame():number;
 state():string|null;          // WorldFlow snapshot().state, null while world not ready
 idle():boolean;               // boot ready, not busy, no modal: what a real tap would require
 revealDoorStep():'pending'|'done'|StepResult; // door=drag only: one frame of real room-look drag
 tapDoor():StepResult;         // real door tap path (RoomExploreOverlay -> boot.invoke -> leaveHome)
 openReturnPanel():StepResult; // real dock button path (IslandJourneyOverlay.open('settings'))
 tapReturn():StepResult;       // real '回屋小憩' path (dispatch -> boot.invoke -> returnHome); ret=direct: boot.invoke(returnHome)
 emit(line:string):void;
}
type Phase='wait-ready'|'settle'|'reveal'|'tap-door'|'outbound'|'hold'|'panel'|'tap-return'|'inbound'|'done'|'failed';
const OUT_STATES=['standing','turning-out','walking-out','opening-door','crossing-out'];
const IN_STATES=['walking-home','crossing-in','closing-door','walking-to-seat','sitting'];
export class AutoplaySequencer {
 private phase:Phase='wait-ready';private phaseAt:number;private t0:number;private lastState:string|null=null;
 readonly marks:{name:string;ms:number;wall:string;state:string|null;frame:number}[]=[];
 constructor(private d:AutoplayDriver,private o:AutoplayOptions=DEFAULT_OPTIONS,t0?:number){this.t0=t0??d.now();this.phaseAt=this.t0;this.mark('autoplay-armed',`mode=${o.mode} door=${o.door} ret=${o.ret} holdMs=${o.holdMs}`);}
 get current():Phase{return this.phase;}
 finished():boolean{return this.phase==='done'||this.phase==='failed';}
 private mark(name:string,extra=''){const ms=Math.round(this.d.now()-this.t0),wall=this.d.wall(),state=this.lastState,frame=this.d.frame();this.marks.push({name,ms,wall,state,frame});this.d.emit(`GB_MARK ${name} ${ms} wall=${wall} frame=${frame} state=${state??'-'}${extra?' '+extra:''}`);}
 private go(p:Phase){this.phase=p;this.phaseAt=this.d.now();}
 private fail(reason:string){this.mark('autoplay-failed','reason='+reason.replace(/\s+/g,'_'));this.go('failed');}
 private since(){return this.d.now()-this.phaseAt;}
 tick():void{
  if(this.finished())return;
  let s:string|null=null;try{s=this.d.state();}catch{s=null;}
  if(s!==this.lastState){this.lastState=s;if(s!==null)this.mark('state:'+s);}
  if(s==='error'||s==='paused'||s==='disposed'){this.fail('world-'+s);return;}
  if(this.phase!=='hold'&&this.phase!=='settle'&&this.since()>this.o.phaseTimeoutMs){this.fail('timeout-'+this.phase);return;}
  switch(this.phase){
   case 'wait-ready':if(s==='home'&&this.d.idle()){this.mark('world-ready');this.go('settle');}return;
   case 'settle':if(this.since()>=this.o.startDelayMs){if(s!=='home'||!this.d.idle()){this.go('wait-ready');return;}this.go(this.o.door==='drag'?'reveal':'tap-door');}return;
   case 'reveal':{const r=this.d.revealDoorStep();if(r==='pending')return;if(r!=='done'&&!r.ok){this.fail('reveal-'+r.reason);return;}this.mark('door-revealed');this.go('tap-door');return;}
   case 'tap-door':{if(!this.d.idle())return;const r=this.d.tapDoor();if(!r.ok){this.fail('tap-door-'+r.reason);return;}this.mark('tap-door','via='+(r.via||'?'));this.go('outbound');return;}
   case 'outbound':if(s==='island'&&this.d.idle()){this.mark('island-arrived');this.mark('hold-start');this.go('hold');}else if(s==='home'&&this.since()>1500&&this.d.idle()){this.fail('leave-rejected');}return;
   case 'hold':if(this.since()>=this.o.holdMs){this.mark('hold-end');if(this.o.ret==='panel'){const r=this.d.openReturnPanel();if(!r.ok){this.fail('open-panel-'+r.reason);return;}this.mark('open-return-panel','via='+(r.via||'?'));this.go('panel');}else this.go('tap-return');}return;
   case 'panel':if(this.since()>=this.o.panelDelayMs)this.go('tap-return');return;
   case 'tap-return':{const r=this.d.tapReturn();if(!r.ok){this.fail('tap-return-'+r.reason);return;}this.mark('tap-return','via='+(r.via||'?'));this.go('inbound');return;}
   case 'inbound':if(s==='home'&&this.d.idle()&&this.since()>100){this.mark('home-seated');this.mark('autoplay-done','totalMs='+Math.round(this.d.now()-this.t0));this.go('done');}else if(s==='island'&&this.since()>1500&&this.d.idle()){this.fail('return-rejected');}return;
  }
 }
}
export const OUTBOUND_STATES=OUT_STATES,INBOUND_STATES=IN_STATES;
export type AutoplayMode='out-and-back'|'touch'|'observe';
export type AutoplayConfig={mode:AutoplayMode;options:AutoplayOptions;scenarios:string;variant:string;exportWx:'off'|'wx'|'only'};
/** Launch query / macro keys: autoplay=out-and-back|touch|observe|off, gbScenario=t1|t1-multi|name,name, gbVariant=l123|l12,
 * gbHold=ms, gbStart=ms, gbExport=wx|only (touch mode: also log automation_game_action commands; only = log without injecting), gbDoor=direct|drag, gbReturn=panel|direct. Macro form 'touch:t1' == autoplay=touch&gbScenario=t1.
 * Unknown/invalid values keep defaults; unknown mode disables. */
export function parseAutoplayQuery(q:Record<string,string|undefined>|null|undefined,installedDefaultOn:boolean):AutoplayConfig|null{
 let v=(q?.autoplay??'').trim(),scen=(q?.gbScenario??'').trim();
 const m=/^touch:(.+)$/.exec(v);if(m){v='touch';if(!scen)scen=m[1];}
 if(v==='off'||v==='0')return null;if(v&&v!=='out-and-back'&&v!=='touch'&&v!=='observe')return null;if(!v&&!installedDefaultOn)return null;
 const num=(k:string,d:number,min:number,max:number)=>{const n=Number(q?.[k]);return q?.[k]!==undefined&&q?.[k]!==''&&Number.isFinite(n)&&n>=min&&n<=max?n:d;};
 const options:AutoplayOptions={...DEFAULT_OPTIONS,holdMs:num('gbHold',DEFAULT_OPTIONS.holdMs,0,60000),startDelayMs:num('gbStart',DEFAULT_OPTIONS.startDelayMs,0,60000),door:q?.gbDoor==='drag'?'drag':'direct',ret:q?.gbReturn==='direct'?'direct':'panel'};
 return {mode:(v||'out-and-back') as AutoplayMode,options,scenarios:scen||'t1',variant:(q?.gbVariant??'').trim(),exportWx:q?.gbExport==='wx'?'wx':q?.gbExport==='only'?'only':'off'};
}
