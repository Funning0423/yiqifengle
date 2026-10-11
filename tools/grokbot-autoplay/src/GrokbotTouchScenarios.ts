/** T0 touch-injection scenarios (GGbot). Engine-independent: no 'cc', no timers, no globals.
 * Debug/test-build only; copied into assets/ ONLY by install.sh.
 *
 * Scenario format (JSON-compatible):
 *  { name:'t1-hold-hud', desc:'...', needs:['lighthouse'], expect:'stay'|'return', expectAlt?:{variant:'l12',expect:'return'},
 *    observeMs?:2000, settleMs?:600,
 *    steps:[ {at:0, finger:1, phase:'start', target:'lighthouse'},
 *            {at:200, finger:2, phase:'start', target:'hud', name:'Island-bag'},
 *            {frame:3, finger:2, phase:'move', n:[0.5,0.4]},        // 'frame' = frames after scenario start (alternative to 'at' ms)
 *            {at:600, finger:1, phase:'end'} ] }                    // no target on move/end/cancel = that finger's last point (+ optional dx/dy px)
 *  target: 'lighthouse' (real hitLighthouse ray test, needs T1) | 'sea' (scene point that is NOT lighthouse) | 'hud' (+name: UI node name) | omitted with n:[x,y]
 *  n: screen-normalised [0..1] from TOP-LEFT. dx/dy: extra CSS px offset. Steps with equal time fire in the SAME frame, in list order.
 *  expect: 'return' = WorldFlow entered 'walking-home' exactly once during the scenario window; 'stay' = never entered it. */
export type TargetName='lighthouse'|'sea'|'hud';
export type TouchStep={at?:number;frame?:number;finger:number;phase:'start'|'move'|'end'|'cancel';target?:TargetName;name?:string;n?:[number,number];dx?:number;dy?:number};
export type TouchScenario={name:string;desc?:string;needs?:('lighthouse')[];expect:'stay'|'return';expectAlt?:{variant:string;expect:'stay'|'return'};observeMs?:number;settleMs?:number;steps:TouchStep[]};
export type Point={x:number;y:number};
export interface TouchDriver {
 now():number; state():string|null; idle():boolean;
 has(cap:'lighthouse'|'backend'):boolean;
 resolve(step:TouchStep):Point|{error:string};          // client px, top-left origin
 inject(phase:TouchStep['phase'],finger:number,p:Point):{ok:boolean;reason?:string;info?:string};
 leave():{ok:boolean;via?:string;reason?:string};        // real door path, to get back to the island
 cleanup():void;                                          // close any modal the scenario opened
 modalOpen():boolean;
 mark(name:string,extra?:string):void;
}
const LH:('lighthouse')[]=['lighthouse'];
/** T1 presets: GGbot T1 README checklist B (multi-finger) + C (single-finger). Finger 1 always starts on the lighthouse. */
export const T1_PRESETS:TouchScenario[]=[
 {name:'t1-hold-hud',desc:'1指按灯塔，2指按住HUD按钮，1指先抬：不回屋',needs:LH,expect:'stay',steps:[{at:0,finger:1,phase:'start',target:'lighthouse'},{at:200,finger:2,phase:'start',target:'hud',name:'Island-bag'},{at:600,finger:1,phase:'end'},{at:900,finger:2,phase:'end'}]},
 {name:'t1-quick-tap-hud',desc:'1指按灯塔，2指在HUD按钮上快点，1指再抬：不回屋',needs:LH,expect:'stay',steps:[{at:0,finger:1,phase:'start',target:'lighthouse'},{at:200,finger:2,phase:'start',target:'hud',name:'Island-bag'},{at:260,finger:2,phase:'end'},{at:600,finger:1,phase:'end'}]},
 {name:'t1-same-frame-tap-hud',desc:'2指在HUD按钮上同一帧内按下又抬起，1指再抬：不回屋（Island-bag 点开行囊弹层会先禁用灯塔，见报告）',needs:LH,expect:'stay',steps:[{at:0,finger:1,phase:'start',target:'lighthouse'},{at:200,finger:2,phase:'start',target:'hud',name:'Island-bag'},{at:200,finger:2,phase:'end'},{at:600,finger:1,phase:'end'}]},
 {name:'t1-hold-sea',desc:'1指按灯塔，2指按海面，1指先抬：不回屋',needs:LH,expect:'stay',steps:[{at:0,finger:1,phase:'start',target:'lighthouse'},{at:200,finger:2,phase:'start',target:'sea'},{at:600,finger:1,phase:'end'},{at:900,finger:2,phase:'end'}]},
 {name:'t1-tap-sea',desc:'单指点海面：不回屋',expect:'stay',steps:[{at:0,finger:1,phase:'start',target:'sea'},{at:120,finger:1,phase:'end'}]},
 {name:'t1-drag-lighthouse',desc:'灯塔上拖动超过8px：不回屋',needs:LH,expect:'stay',steps:[{at:0,finger:1,phase:'start',target:'lighthouse'},{at:80,finger:1,phase:'move',dx:6},{at:160,finger:1,phase:'move',dx:14},{at:240,finger:1,phase:'end',dx:14}]},
 {name:'t1-single-tap-lighthouse',desc:'双指测试之后单指点灯塔：回屋一次',needs:LH,expect:'return',steps:[{at:0,finger:1,phase:'start',target:'lighthouse'},{at:120,finger:1,phase:'end'}]},
 {name:'t1-double-tap-lighthouse',desc:'连点灯塔两次：只回屋一次',needs:LH,expect:'return',observeMs:2500,steps:[{at:0,finger:1,phase:'start',target:'lighthouse'},{at:100,finger:1,phase:'end'},{at:220,finger:1,phase:'start',target:'lighthouse'},{at:320,finger:1,phase:'end'}]},
];
export const PRESET_GROUPS:Record<string,string[]>={t1:T1_PRESETS.map(s=>s.name),'t1-multi':['t1-hold-hud','t1-quick-tap-hud','t1-same-frame-tap-hud','t1-hold-sea','t1-single-tap-lighthouse']};
export function validateScenario(s:any):string|null{
 if(!s||typeof s.name!=='string'||!/^[\w.-]{1,64}$/.test(s.name))return 'bad-name';if(s.expect!=='stay'&&s.expect!=='return')return 'bad-expect';
 if(!Array.isArray(s.steps)||!s.steps.length||s.steps.length>64)return 'bad-steps';
 const down=new Set<number>();
 for(const st of s.steps){if(!Number.isInteger(st.finger)||st.finger<1||st.finger>10)return 'bad-finger';if(!['start','move','end','cancel'].includes(st.phase))return 'bad-phase';
  if((st.at===undefined)===(st.frame===undefined))return 'need-exactly-one-of-at-frame';const t=st.at??st.frame;if(!Number.isFinite(t)||t<0||t>60000)return 'bad-time';
  if(st.phase==='start'){if(down.has(st.finger))return 'finger-already-down';if(!st.target&&!st.n)return 'start-needs-target-or-n';down.add(st.finger);}
  else{if(!down.has(st.finger))return 'finger-not-down';if(st.phase!=='move')down.delete(st.finger);}
  if(st.target&&!['lighthouse','sea','hud'].includes(st.target))return 'bad-target';if(st.target==='hud'&&!st.name)return 'hud-needs-name';
  if(st.n&&!(Array.isArray(st.n)&&st.n.length===2&&st.n.every((v:number)=>Number.isFinite(v)&&v>=0&&v<=1)))return 'bad-n';}
 return null;
}
/** 'a,b' names, group names (t1, t1-multi), plus optional custom JSON list. Unknown names -> error entries. */
export function selectScenarios(spec:string,custom:TouchScenario[]=[]):{list:TouchScenario[];errors:string[]}{
 const all=new Map<string,TouchScenario>();for(const s of [...T1_PRESETS,...custom])all.set(s.name,s);const list:TouchScenario[]=[],errors:string[]=[];
 for(const raw of spec.split(',').map(x=>x.trim()).filter(Boolean)){const names=PRESET_GROUPS[raw]??[raw];for(const n of names){const s=all.get(n);if(!s){errors.push('unknown:'+n);continue;}const bad=validateScenario(s);if(bad){errors.push(n+':'+bad);continue;}list.push(s);}}
 return {list,errors};
}
/** Equivalent command sequence for the lead's official-DevTools path (repo-tools-mac/wx_game_input.sh -> automation_game_action,
 * image space imgW x imgH). automation_game_action has no finger id, so scenarios with >1 finger down at once are flagged unsupported. */
export function toWxGameInput(s:TouchScenario,points:(Point|null)[],client:{w:number;h:number},img={w:586,h:1266}):{supported:boolean;lines:string[]}{
 const sx=img.w/client.w,sy=img.h/client.h,lines:string[]=[`# ${s.name} expect=${s.expect} (image ${img.w}x${img.h}; ga = automation_game_action wrapper from wx_game_input.sh)`];
 let down=0,maxDown=0,prev=0;const act={start:'touchstart',move:'touchmove',end:'touchend',cancel:'touchcancel'} as const;
 s.steps.forEach((st,i)=>{const p=points[i];const t=st.at??Math.round((st.frame??0)*1000/60);if(t>prev){lines.push(`sleep ${((t-prev)/1000).toFixed(3)}`);prev=t;}
  if(st.phase==='start'){down++;maxDown=Math.max(maxDown,down);}else if(st.phase!=='move')down--;
  lines.push(p?`ga --action ${act[st.phase]} --x ${Math.round(p.x*sx)} --y ${Math.round(p.y*sy)}  # f${st.finger}${st.target?' '+st.target+(st.name?':'+st.name:''):''}`:`# step ${i}: unresolved target`);});
 const supported=maxDown<=1&&points.every(Boolean);if(!supported)lines.splice(1,0,maxDown>1?'# UNSUPPORTED: multi-finger overlap; automation_game_action has no finger id - use autoplay=touch (in-game injection) for this one':'# UNSUPPORTED: unresolved target');
 return {supported,lines};
}
type RPhase='prepare'|'settle'|'steps'|'observe'|'go-home'|'next'|'done';
export class TouchScenarioRunner {
 private i=-1;private phase:RPhase='next';private at=0;private startFrame=0;private frames=0;private stepIdx=0;private returns=0;private prevState:string|null=null;private left=false;
 private down=new Map<number,Point>();private failNote='';
 readonly results:{name:string;expected:string;actual:string;verdict:'PASS'|'FAIL'|'SKIP'|'ERROR';note:string}[]=[];
 constructor(private d:TouchDriver,private list:TouchScenario[],private variant='',private timeoutMs=90000,private exportWx:'off'|'wx'|'only'='off',private client:()=>{w:number;h:number}=()=>({w:390,h:844})){}
 finished(){return this.phase==='done';}
 private go(p:RPhase){this.phase=p;this.at=this.d.now();}
 private since(){return this.d.now()-this.at;}
 private cur(){return this.list[this.i];}
 private finish(verdict:'PASS'|'FAIL'|'SKIP'|'ERROR',actual:string,note:string){const s=this.cur();const exp=this.expected(s);this.results.push({name:s.name,expected:exp,actual,verdict,note});
  this.d.mark('touch:scenario-result',`name=${s.name} expected=${exp} actual=${actual} verdict=${verdict}${note?' note='+note.replace(/\s+/g,'_'):''}`);}
 private expected(s:TouchScenario){return s.expectAlt&&this.variant&&s.expectAlt.variant===this.variant?s.expectAlt.expect:s.expect;}
 /** Resolve every step exactly as the live run would and log the automation_game_action sequence. true = scenario consumed (only). */
 private exportScript():boolean{const s=this.cur(),last=new Map<number,Point>();const pts=s.steps.map(st=>{let p:Point|{error:string};if(st.phase==='start'||st.target||st.n)p=this.d.resolve(st);else p=last.get(st.finger)??{error:'x'};if('error' in p)return null;const q={x:p.x+(st.dx??0),y:p.y+(st.dy??0)};last.set(st.finger,q);return q;});
  const r=toWxGameInput(s,pts,this.client());this.d.mark('touch:wx-script',`name=${s.name} supported=${r.supported?1:0} cmds=${JSON.stringify(r.lines.join('\n'))}`);
  if(this.exportWx==='only'){this.finish('SKIP','-','exported-only');this.go('next');return true;}return false;}
 private releaseAll(){for(const [f,p] of [...this.down]){this.d.inject('cancel',f,p);this.d.mark('touch:cancel',`f=${f} x=${Math.round(p.x)} y=${Math.round(p.y)} cleanup=1`);}this.down.clear();}
 tick():void{
  if(this.phase==='done')return;this.frames++;const s0=this.d.state();
  if(s0!==this.prevState){if(s0==='walking-home'&&(this.phase==='steps'||this.phase==='observe'))this.returns++;this.prevState=s0;}
  if(s0==='error'||s0==='disposed'){if(this.i>=0&&this.i<this.list.length&&this.phase!=='next'){this.releaseAll();this.finish('ERROR','-','world-'+s0);}this.d.mark('touch:suite-aborted','reason=world-'+s0);this.go('done');return;}
  switch(this.phase){
   case 'next':{this.i++;if(this.i>=this.list.length){const c=(v:string)=>this.results.filter(r=>r.verdict===v).length;this.d.mark('touch:suite-done',`pass=${c('PASS')} fail=${c('FAIL')} skip=${c('SKIP')} error=${c('ERROR')}`);this.go('done');return;}
    const s=this.cur();this.d.mark('touch:scenario-start',`name=${s.name} expect=${this.expected(s)} steps=${s.steps.length}`);
    if(!this.d.has('backend')){this.finish('SKIP','-','no-touch-backend');this.go('next');return;}
    if(s.needs?.includes('lighthouse')&&!this.d.has('lighthouse')){this.finish('SKIP','-','no-hitLighthouse(T1-not-installed)');this.go('next');return;}
    this.left=false;this.go('prepare');return;}
   case 'prepare':{if(this.since()>this.timeoutMs){this.finish('ERROR','-','prepare-timeout');this.go('next');return;}
    if(this.d.modalOpen()){this.d.cleanup();return;}
    if(s0==='island'&&this.d.idle()){this.go('settle');return;}
    if(s0==='home'&&this.d.idle()&&!this.left){const r=this.d.leave();this.left=true;this.d.mark('touch:prepare-leave','via='+(r.via||r.reason||'?'));if(!r.ok){this.finish('ERROR','-','leave-'+r.reason);this.go('next');}}
    return;}
   case 'settle':if(s0!=='island'||!this.d.idle()){this.go('prepare');return;}if(this.since()>=(this.cur().settleMs??600)){if(this.exportWx!=='off'&&this.exportScript())return;this.returns=0;this.stepIdx=0;this.startFrame=this.frames;this.failNote='';this.go('steps');}return;
   case 'steps':{const s=this.cur(),el=this.since(),fr=this.frames-this.startFrame;
    while(this.stepIdx<s.steps.length){const st=s.steps[this.stepIdx];const due=st.at!==undefined?el>=st.at:fr>=st.frame!;if(!due)break;this.stepIdx++;
     let p:Point|{error:string};if(st.phase==='start'||st.target||st.n)p=this.d.resolve(st);else{const last=this.down.get(st.finger);p=last?{x:last.x,y:last.y}:{error:'finger-not-down'};}
     if('error' in p){this.failNote='resolve-'+p.error;this.d.mark('touch:step-error',`f=${st.finger} phase=${st.phase} reason=${p.error}`);this.releaseAll();this.finish('ERROR','-',this.failNote);this.d.cleanup();this.go('go-home');return;}
     const q={x:p.x+(st.dx??0),y:p.y+(st.dy??0)};const r=this.d.inject(st.phase,st.finger,q);
     this.d.mark('touch:'+st.phase,`f=${st.finger} x=${Math.round(q.x)} y=${Math.round(q.y)}${st.target?' target='+st.target+(st.name?':'+st.name:''):''}${r.info?' '+r.info:''}${r.ok?'':' inject-failed='+r.reason}`);
     if(st.phase==='start'||st.phase==='move')this.down.set(st.finger,q);else this.down.delete(st.finger);}
    if(this.stepIdx>=s.steps.length)this.go('observe');return;}
   case 'observe':if(this.since()>=(this.cur().observeMs??2000)){this.releaseAll();const actual=this.returns===0?'stay':this.returns===1?'return':'return-x'+this.returns;const modal=this.d.modalOpen();
     this.finish(actual===this.expected(this.cur())?'PASS':'FAIL',actual,modal?'modal-opened':'');this.d.cleanup();this.go('go-home');}return;
   case 'go-home':if(s0==='island'||s0==='home'){if(this.d.idle()||this.since()>this.timeoutMs)this.go('next');}else if(this.since()>this.timeoutMs)this.go('next');return;
  }
 }
}
