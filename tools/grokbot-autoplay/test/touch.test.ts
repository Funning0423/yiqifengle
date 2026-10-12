/** Unit: scenario format validation, selection, runner with a fake driver + fake clock. */
import {T1_PRESETS,selectScenarios,validateScenario,TouchScenarioRunner} from '../src/GrokbotTouchScenarios';
import type {TouchDriver} from '../src/GrokbotTouchScenarios';
let f=0;const ok=(c:boolean,m:string)=>{if(!c){f++;console.error('FAIL: '+m);}else console.error('ok - '+m);};
ok(T1_PRESETS.every(s=>validateScenario(s)===null),'all T1 presets valid');
ok(selectScenarios('t1').list.length===8&&selectScenarios('t1-multi').list.length===5,'groups');
ok(selectScenarios('t1-hold-hud,nope').errors[0]==='unknown:nope','unknown name reported');
ok(validateScenario({name:'x',expect:'stay',steps:[{at:0,finger:1,phase:'end'}]})==='finger-not-down','end before start rejected');
ok(validateScenario({name:'x',expect:'stay',steps:[{at:0,frame:1,finger:1,phase:'start',n:[.5,.5]}]})==='need-exactly-one-of-at-frame','at+frame rejected');
ok(validateScenario({name:'x',expect:'stay',steps:[{at:0,finger:1,phase:'start',target:'hud'}]})==='hud-needs-name','hud needs name');
ok(validateScenario({name:'x',expect:'stay',steps:[{frame:0,finger:1,phase:'start',n:[.5,.5]},{frame:2,finger:1,phase:'end'}]})===null,'frame-based custom ok');
ok(selectScenarios('c1',[{name:'c1',expect:'return',steps:[{at:0,finger:1,phase:'start',n:[.5,.5]},{at:50,finger:1,phase:'end'}]}]).list.length===1,'custom selectable');
// runner: fake world where a lone finger-1 tap on lighthouse returns home
const w={t:0,state:'home' as string,busy:false,down:new Set<number>(),log:[] as string[],injected:[] as string[],returnAt:-1};
const d:TouchDriver={now:()=>w.t,state:()=>w.state,idle:()=>!w.busy,has:()=>true,
 resolve:s=>s.target==='hud'&&s.name==='missing'?{error:'hud-not-found'}:{x:100,y:200},
 inject:(ph,fi)=>{w.injected.push(ph+fi);if(ph==='start')w.down.add(fi);else if(ph!=='move'){const alone=w.down.size===1;w.down.delete(fi);if(fi===1&&ph==='end'&&alone&&w.state==='island')w.returnAt=w.t;}return {ok:true};},
 leave:()=>{w.busy=true;setTimeoutLike(()=>{w.state='island';w.busy=false;},3000);return {ok:true,via:'t'};},cleanup:()=>{},modalOpen:()=>false,mark:(n,e)=>w.log.push(n+' '+(e||''))};
const pending:{at:number;fn:()=>void}[]=[];function setTimeoutLike(fn:()=>void,ms:number){pending.push({at:w.t+ms,fn});}
const r=new TouchScenarioRunner(d,[...selectScenarios('t1-single-tap-lighthouse,t1-hold-hud').list,{name:'bad',expect:'stay',steps:[{at:0,finger:1,phase:'start',target:'hud',name:'missing'},{at:10,finger:1,phase:'end'}]}]);
let guard=0;while(!r.finished()&&guard++<20000){w.t+=16;for(const p of [...pending])if(p.at<=w.t){pending.splice(pending.indexOf(p),1);p.fn();}
 if(w.returnAt>=0&&w.t>=w.returnAt+16){w.returnAt=-1;w.state='walking-home';w.busy=true;setTimeoutLike(()=>{w.state='home';w.busy=false;},5000);}r.tick();}
ok(r.finished(),'runner finishes');ok(r.results[0].verdict==='PASS'&&r.results[0].actual==='return','single tap -> return PASS');
ok(r.results[1].verdict==='PASS'&&r.results[1].actual==='stay','hold-hud -> stay PASS (returned home in between, re-left via door)');
ok(r.results[2].verdict==='ERROR'&&/resolve-hud-not-found/.test(r.results[2].note),'unresolvable target -> ERROR, fingers released');
ok(w.log.filter(l=>l.startsWith('touch:prepare-leave')).length===2,'left home twice (start + after return)');
ok(w.log.some(l=>l.startsWith('touch:suite-done pass=2 fail=0 skip=0 error=1')),'suite summary');
if(f){console.error(f+' FAILED');process.exit(1);}console.error('PASS touch unit');
