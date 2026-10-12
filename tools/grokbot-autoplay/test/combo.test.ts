/** Unit: pure combo pieces (frames, expectations, evaluation, runner phases with a fake driver, query parsing). */
import {buildComboFrames,evaluateCombo,comboCells,cascadeSfx,cascadeTier,ComboRunner,DEFAULT_COMBO,CHEER_CLIPS} from '../src/GrokbotCombo';
import type {ComboDriver} from '../src/GrokbotCombo';
import {parseAutoplayQuery} from '../src/GrokbotAutoplaySequencer';
let failures=0;const ok=(c:boolean,m:string)=>{if(!c){failures++;console.error('FAIL: '+m);}else console.error('ok - '+m);};
// frames
const F=buildComboFrames(5,i=>i===9?{id:'t9',type:3,special:null}:null);
ok(F.length===6&&F[0].kind==='action'&&F.slice(1).every(f=>f.kind==='clear'&&f.gbSynthetic===1),'1 action + 5 clear frames, tagged synthetic');
ok(F[1].wave.removed.length===3&&F[1].wave.removed.every((c:any,k:number)=>c.index===comboCells(0)[k]&&'id' in c&&'type' in c&&'special' in c),'wave.removed = [{index,id,type,special}] like engine snapshot()');
ok(F[1].wave.removed[0].id==='t9'&&F[1].wave.removed[0].type===3,'live tile id/type used when the board exposes it');
const all=F.slice(1).flatMap(f=>f.wave.indexes);ok(new Set(all).size===15&&all.every((i:number)=>i>=0&&i<49),'15 distinct on-board cells');
ok([1,2,3,4,5].map(cascadeSfx).join()==='sfx_match_normal,sfx_combo_1,sfx_combo_2,sfx_combo_3,sfx_combo_3'&&[1,2,3,4,5].map(cascadeTier).join()==='-1,0,1,2,3','expectations mirror GameAudio.onBoardFrame');
// evaluation
const good={cheers:[0,1,2,3],sfx:CHEER_CLIPS.map(n=>({name:n,accepted:true})).concat([{name:'sfx_combo_3',accepted:false}]),text:[0,1,2,3].map(t=>({tier:t,decision:t?'replace':'show',source:'clear'})),muted:false,suspended:false,textHost:true,audio:true};
{const r=evaluateCombo(good,5);ok(r.pass&&/^expect=0,1,2,3 tiers=0,1,2,3 sfx=sfx_cheer_1_great,sfx_cheer_2_excellent,sfx_cheer_3_amazing,sfx_cheer_4_unbelievable text=0,1,2,3 textSource=clear,clear,clear,clear muted=0 suspended=0 tiersOk=1 sfxOk=1 textOk=1 PASS$/.test(r.line),'PASS line: '+r.line);}
{const r=evaluateCombo({...good,sfx:good.sfx.map(s=>s.name==='sfx_cheer_3_amazing'?{...s,accepted:false}:s)},5);ok(!r.pass&&/sfxOk=0 .*FAIL$/.test(r.line),'dropped cheer clip -> FAIL');}
{const r=evaluateCombo({...good,muted:true,sfx:[]},5);ok(r.pass&&/sfx=skipped-by-GameAudio\(muted\) .*PASS$/.test(r.line),'muted: no cheer clips but text -> PASS');}
{const r=evaluateCombo({...good,text:[{tier:0,decision:'no-board',source:'-'}]},5);ok(!r.pass&&/text=0:no-board .*textOk=0/.test(r.line),'no-board -> FAIL');}
{const r=evaluateCombo({...good,textHost:false,text:[]},5);ok(!r.pass&&/text=absent/.test(r.line),'no CheerTextHost -> FAIL');}
{const r=evaluateCombo({...good,cheers:[0],sfx:[{name:CHEER_CLIPS[0],accepted:true}],text:[{tier:0,decision:'show',source:'center'}]},2);ok(r.pass&&r.line.startsWith('expect=0 '),'clears=2 -> only Great');}
// parsing
{const c=parseAutoplayQuery({autoplay:'combo'},true)!;ok(c.mode==='combo'&&c.combo.enter==='level'&&c.combo.clears===5&&c.combo.gapMs===400,'autoplay=combo defaults');}
{const c=parseAutoplayQuery({autoplay:'combo:here'},true)!;ok(c.mode==='combo'&&c.combo.enter==='none','macro combo:here');}
{const c=parseAutoplayQuery({autoplay:'combo',gbComboClears:'3',gbComboGap:'250',gbComboEnter:'none'},true)!;ok(c.combo.clears===3&&c.combo.gapMs===250&&c.combo.enter==='none','combo params');}
{const c=parseAutoplayQuery({autoplay:'combo',gbComboClears:'9',gbComboGap:'5'},true)!;ok(c.combo.clears===5&&c.combo.gapMs===400,'out-of-range params keep defaults');}
ok(parseAutoplayQuery({autoplay:'combo:bogus'},true)===null,'unknown combo macro disables');
// runner with a fake world: home -> island -> level (button tap ignored once -> invoke retry) -> board modal -> ready -> feed
{let t=0,state:string|null='home',busy=false,boardPresent=false,boardReady=false,modal=false,fed:any[]=[];const lines:string[]=[];let tapped=0;const listeners:any[]=[];
 const later=(ms:number,f:()=>void)=>{const at=t+ms;timers.push({at,f});};const timers:{at:number;f:()=>void}[]=[];
 const d:ComboDriver={now:()=>t,state:()=>state,idle:()=>!busy&&!modal,
  tapDoor:()=>{busy=true;later(3000,()=>{state='island';busy=false;});return {ok:true,via:'test-door'};},
  enterLevel:(how)=>{tapped++;if(how==='button')return {ok:true,via:'button(no effect)'};busy=true;later(500,()=>{state='level';busy=false;boardPresent=true;modal=true;later(1500,()=>{modal=false;boardReady=true;});});return {ok:true,via:'invoke'};},
  board:()=>({present:boardPresent,ready:boardReady,modal,state:boardReady?'run.ready':'run.intro'}),audio:()=>({present:true,muted:false,suspended:false}),textHost:()=>true,tile:()=>null,
  subscribeCheer:(f)=>{listeners.push(f);return ()=>{listeners.splice(listeners.indexOf(f),1);};},
  feed:(fr)=>{fed.push({t,fr});if(fr.kind==='clear'){const n=fed.filter(x=>x.fr.kind==='clear').length;if(n>=2){const L=Math.min(n-2,3);listeners.forEach(l=>l(L,fr));r.onSfx(CHEER_CLIPS[L],true);r.onText(L,L?'replace':'show','clear');}}return {ok:true};},
  mark:(n,e)=>lines.push(n+' '+(e||''))};
 const r=new ComboRunner(d,{...DEFAULT_COMBO,startDelayMs:100,settleMs:200,enterRetryMs:1000},0);
 while(!r.finished()&&t<60000){t+=16;for(const x of timers.slice())if(x.at<=t){timers.splice(timers.indexOf(x),1);x.f();}r.tick();}
 const N=lines.map(l=>l.split(' ')[0]);
 ok(r.phase==='done'&&r.result?.pass===true,'runner done PASS '+(r.result?.line||lines.slice(-2).join(' | ')));
 ok(tapped===2&&lines.some(l=>/combo:enter-level via=invoke retry=button-tap-had-no-effect/.test(l)),'button tap without effect -> single invoke retry');
 ok(N.indexOf('combo:board-ready')>N.lastIndexOf('combo:enter-level')&&N.indexOf('combo:start')>N.indexOf('combo:board-ready'),'waits for board ready (modal) before feeding');
 const gaps=fed.slice(1).map((x,i)=>x.t-fed[i].t);ok(fed.length===6&&gaps.every(g=>g>=400&&g<420),'6 frames ~400 ms apart: '+gaps.join(','));
 ok(lines.filter(l=>l.startsWith('combo:frame')).length===6&&lines.filter(l=>l.startsWith('combo:cheer')).length===4&&listeners.length===0,'per-frame + per-cheer marks; onCheer unsubscribed');
 ok(/combo:frame i=5\/5 token=gb-combo:5 kind=clear cascade=5 cells=\d+,\d+,\d+ expectSfx=sfx_combo_3 expectTier=3 expectClip=sfx_cheer_4_unbelievable/.test(lines.find(l=>l.includes('i=5/5'))||''),'frame mark detail');}
if(failures){console.error(failures+' FAILED');process.exit(1);}console.error('PASS combo unit');
