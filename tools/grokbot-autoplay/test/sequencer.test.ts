/** Unit harness: fake driver + fake clock for the pure sequencer. */
import {AutoplaySequencer,parseAutoplayQuery,DEFAULT_OPTIONS} from '../src/GrokbotAutoplaySequencer';
import type {AutoplayDriver,StepResult} from '../src/GrokbotAutoplaySequencer';
let failures=0;const ok=(c:boolean,m:string)=>{if(!c){failures++;console.error('FAIL: '+m);}else console.error('ok - '+m);};
function world(opts:{rejectLeave?:boolean;pauseAt?:string;neverReady?:boolean;hideDoorUntil?:number}={}){
 const w={t:0,frame:0,state:null as string|null,busy:false,modal:false,lines:[] as string[],queue:[] as {at:number;s:string}[],revealSteps:0};
 const run=(seq:string[],step=700)=>{let at=w.t;w.busy=true;for(const s of seq){w.queue.push({at,s});at+=step;}w.queue.push({at,s:'__idle'});};
 const d:AutoplayDriver={now:()=>w.t,wall:()=>'2026-10-11T18:00:00.000+08:00 epoch=0',frame:()=>w.frame,state:()=>w.state,idle:()=>w.state!==null&&!w.busy&&!w.modal,
  revealDoorStep:()=>{w.revealSteps++;return w.revealSteps>=(opts.hideDoorUntil??0)?'done':'pending';},
  tapDoor:():StepResult=>{if(opts.rejectLeave)return {ok:true,via:'test'};run(['standing','turning-out','walking-out','opening-door','crossing-out','island']);return {ok:true,via:'test'};},
  openReturnPanel:()=>{w.modal=true;return {ok:true};},
  tapReturn:()=>{w.modal=false;run(['walking-home','crossing-in','walking-to-seat','sitting','home']);return {ok:true,via:'test'};},
  emit:l=>w.lines.push(l)};
 const step=(ms:number)=>{w.t+=ms;w.frame++;if(!opts.neverReady&&w.state===null&&w.t>9000)w.state='home';
  while(w.queue.length&&w.queue[0].at<=w.t){const q=w.queue.shift()!;if(q.s==='__idle')w.busy=false;else w.state=q.s;if(opts.pauseAt&&q.s===opts.pauseAt)w.state='paused';}};
 return {w,d,step};
}
const drive=(seq:AutoplaySequencer,step:(ms:number)=>void,maxMs=300000)=>{let t=0;while(!seq.finished()&&t<maxMs){step(16);seq.tick();t+=16;}};
{const {w,d,step}=world();const s=new AutoplaySequencer(d,DEFAULT_OPTIONS);drive(s,step);
 ok(s.current==='done','happy path reaches done');const n=s.marks.map(m=>m.name);
 ok(n[0]==='autoplay-armed'&&n.includes('world-ready')&&n.indexOf('tap-door')<n.indexOf('state:standing'),'tap-door precedes standing');
 const h=(x:string)=>s.marks.find(m=>m.name===x)!.ms;ok(h('hold-end')-h('hold-start')>=3000&&h('hold-end')-h('hold-start')<3040,'island hold ~3000 ms ('+(h('hold-end')-h('hold-start'))+')');
 ok(h('tap-door')-h('world-ready')>=2000,'start delay respected');
 ok(n.indexOf('open-return-panel')<n.indexOf('tap-return')&&h('tap-return')-h('open-return-panel')>=800,'panel shown >=800ms before tap-return');
 ok(n[n.length-1]==='autoplay-done'&&n.includes('home-seated'),'ends with home-seated, autoplay-done');
 ok(w.lines.every(l=>/^GB_MARK \S+ \d+ wall=/.test(l)),'line format');
 ok(s.marks.every((m,i)=>!i||m.ms>=s.marks[i-1].ms),'monotonic ms');}
{const {d,step}=world({rejectLeave:true});const s=new AutoplaySequencer(d,DEFAULT_OPTIONS);drive(s,step);ok(s.current==='failed'&&s.marks.some(m=>m.name==='autoplay-failed'),'leave that never starts -> failed (no silent hang)');}
{const {d,step}=world({pauseAt:'crossing-out'});const s=new AutoplaySequencer(d,DEFAULT_OPTIONS);drive(s,step);ok(s.current==='failed'&&s.marks.some(m=>m.name==='state:paused'),'pause/hide mid-flow -> failed, marked');}
{const {d,step}=world({neverReady:true});const s=new AutoplaySequencer(d,{...DEFAULT_OPTIONS,phaseTimeoutMs:5000});drive(s,step,20000);ok(s.current==='failed'&&s.marks.at(-1)!.name==='autoplay-failed','never-ready -> timeout failed');}
{const {w,d,step}=world({hideDoorUntil:30});const s=new AutoplaySequencer(d,{...DEFAULT_OPTIONS,door:'drag',ret:'direct'});drive(s,step);ok(s.current==='done'&&w.revealSteps>=30&&s.marks.some(m=>m.name==='door-revealed')&&!s.marks.some(m=>m.name==='open-return-panel'),'door=drag + ret=direct');}
ok(parseAutoplayQuery({},true)?.mode==='out-and-back','installed default on');
ok(parseAutoplayQuery({},false)===null,'not installed default off');
ok(parseAutoplayQuery({autoplay:'off'},true)===null,'autoplay=off disables');
ok(parseAutoplayQuery({autoplay:'weird'},true)===null,'unknown mode disables');
const p=parseAutoplayQuery({autoplay:'out-and-back',gbHold:'5000',gbDoor:'drag',gbReturn:'direct',gbStart:'abc'},true)!.options;ok(p.holdMs===5000&&p.door==='drag'&&p.ret==='direct'&&p.startDelayMs===2000,'query options parsed, invalid ignored');
{const c=parseAutoplayQuery({autoplay:'touch:t1-multi'},true)!;ok(c.mode==='touch'&&c.scenarios==='t1-multi','macro form touch:<spec>');}
{const c=parseAutoplayQuery({autoplay:'touch',gbScenario:'t1-hold-hud,t1-tap-sea',gbVariant:'l12'},true)!;ok(c.mode==='touch'&&c.scenarios==='t1-hold-hud,t1-tap-sea'&&c.variant==='l12','query touch + scenario + variant');}
ok(parseAutoplayQuery({autoplay:'observe'},true)?.mode==='observe','observe mode');
ok(parseAutoplayQuery({autoplay:'touch'},true)?.scenarios==='t1','touch defaults to t1 group');
if(failures){console.error(failures+' FAILED');process.exit(1);}console.error('PASS sequencer unit');
