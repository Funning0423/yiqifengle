/** T0 combo mode (GGbot): verify the cheer chain (GameAudio cascade -> onCheer -> cheer voice + T6 CheerText) without manual play.
 * Engine-independent: no 'cc', no timers, no globals. Debug/test-build only; copied into assets/ ONLY by install.sh.
 *
 * Path used: FEED (not swipe). After entering a level through the real UI path (door -> island -> '继续旅程' mainline button),
 * the runner feeds GameAudio.instance.onBoardFrame with one {kind:'action'} frame then N {kind:'clear'} frames gapMs apart,
 * shaped like the mainline session's real clear frame (wave.removed = [{index,id,type,special}] on the 7x7 board), so the
 * REAL GameAudio decides cascade/tier, plays the REAL cheer clip and fires the REAL onCheer -> CheerTextHost.show.
 * Why not swipes: a guaranteed 2..5-wave cascade needs a search over the seeded engine incl. refills; not worth it for T0.
 * Frames are tagged gbSynthetic=1 / token 'gb-combo:<i>' so logs can never be mistaken for player clears. */
import type {StepResult} from './GrokbotAutoplaySequencer';
export const CHEER_CLIPS=['sfx_cheer_1_great','sfx_cheer_2_excellent','sfx_cheer_3_amazing','sfx_cheer_4_unbelievable'] as const;
export const CHEER_WORDS=['Great!','Excellent!','Amazing!','Unbelievable!'] as const;
/** Mirrors GameAudio.onBoardFrame (A2 b200456): clear #n -> sfx; n>=2 -> cheer level min(n-2,3). Used only for EXPECTATIONS in logs. */
export const cascadeSfx=(n:number)=>n<=1?'sfx_match_normal':n===2?'sfx_combo_1':n===3?'sfx_combo_2':'sfx_combo_3';
export const cascadeTier=(n:number)=>n>=2?Math.min(n-2,3):-1;
export type ComboOptions={enter:'level'|'none';gapMs:number;clears:number;startDelayMs:number;settleMs:number;tailMs:number;boardTimeoutMs:number;enterRetryMs:number;phaseTimeoutMs:number};
export const DEFAULT_COMBO:ComboOptions={enter:'level',gapMs:400,clears:5,startDelayMs:2000,settleMs:1000,tailMs:1200,boardTimeoutMs:30000,enterRetryMs:2000,phaseTimeoutMs:90000};
export type Tile={id:unknown;type:unknown;special:unknown};
/** 3 horizontally adjacent cells, one row per wave (rows 1..5, cols 2..4 of the 7x7 board): distinct, on-board, centroid at column 3. */
export const comboCells=(wave:number)=>{const row=1+(wave%5);return [row*7+2,row*7+3,row*7+4];};
/** frames[0] = action; frames[k] (k>=1) = clear wave k. */
export function buildComboFrames(clears:number,tileAt:(i:number)=>Tile|null):any[]{
 const out:any[]=[{kind:'action',action:['swap',comboCells(0)[1],comboCells(0)[1]+7],token:'gb-combo:0',gbSynthetic:1}];
 for(let w=0;w<clears;w++){const cells=comboCells(w);
  const removed=cells.map(i=>{let t:Tile|null=null;try{t=tileAt(i);}catch{t=null;}return {index:i,id:t?.id??`gb-combo-${w}-${i}`,type:t?.type??0,special:t?.special??null};});
  out.push({kind:'clear',token:'gb-combo:'+(w+1),gbSynthetic:1,wave:{kind:'match',indexes:cells.slice(),removed,created:[],effects:[],specialTriggered:[],obstacleHits:[],goalsBefore:null,goalsAfter:null,goalsDelta:null,scoreDelta:0},goalsAfter:null});}
 return out;}
export type ComboObservation={cheers:number[];sfx:{name:string;accepted:boolean}[];text:{tier:number;decision:string;source:string}[];muted:boolean;suspended:boolean;textHost:boolean;audio:boolean};
/** Expected distinct tiers for N clears: [0..min(N-2,3)]. Each must fire once via onCheer, show once as text (show|replace), and,
 * unless GameAudio is muted/suspended (it then drops cheer voices by design, text still shows), start its clip once, in order. */
export function evaluateCombo(o:ComboObservation,clears:number){
 const exp:number[]=[];for(let n=2;n<=clears;n++){const t=cascadeTier(n);if(exp.indexOf(t)<0)exp.push(t);}
 const eq=(a:number[],b:number[])=>a.length===b.length&&a.every((x,i)=>x===b[i]);
 const cheerSfx=o.sfx.filter(s=>(CHEER_CLIPS as readonly string[]).indexOf(s.name)>=0);
 const accepted=cheerSfx.filter(s=>s.accepted).map(s=>(CHEER_CLIPS as readonly string[]).indexOf(s.name));
 const shown=o.text.filter(t=>t.decision==='show'||t.decision==='replace');
 const silent=o.muted||o.suspended;
 const tiersOk=o.audio&&eq(o.cheers,exp);
 const sfxOk=o.audio&&(silent?accepted.length===0:eq(accepted,exp));
 const textOk=o.textHost&&eq(shown.map(t=>t.tier),exp);
 const pass=tiersOk&&sfxOk&&textOk;
 const sfxTxt=!o.audio?'no-GameAudio':silent?`skipped-by-GameAudio(${o.muted?'muted':'suspended'})`+(accepted.length?':'+accepted.map(i=>CHEER_CLIPS[i]).join(','):''):(accepted.map(i=>CHEER_CLIPS[i]).join(',')||'none');
 const textTxt=!o.textHost?'absent(no-CheerTextHost)':(o.text.map(t=>t.decision==='show'||t.decision==='replace'?String(t.tier):`${t.tier}:${t.decision}`).join(',')||'none');
 const line=`expect=${exp.join(',')} tiers=${o.cheers.join(',')||'none'} sfx=${sfxTxt} text=${textTxt} textSource=${shown.map(t=>t.source).join(',')||'-'} `+
  `muted=${o.muted?1:0} suspended=${o.suspended?1:0} tiersOk=${tiersOk?1:0} sfxOk=${sfxOk?1:0} textOk=${textOk?1:0} ${pass?'PASS':'FAIL'}`;
 return {pass,expected:exp,line};}

export type BoardStatus={present:boolean;ready:boolean;modal:boolean;state:string};
export interface ComboDriver {
 now():number; state():string|null; idle():boolean;
 tapDoor():StepResult;
 enterLevel(how:'button'|'invoke'):StepResult; // button = real '继续旅程' WarmButton via injected touch; invoke = same action through boot.invoke
 board():BoardStatus;
 audio():{present:boolean;muted:boolean;suspended:boolean};
 textHost():boolean;
 tile(i:number):Tile|null;
 subscribeCheer(f:(level:number,visual:any)=>void):(()=>void)|null; // GameAudio.onCheer (read-only listener)
 feed(frame:any):StepResult;   // GameAudio.instance.onBoardFrame(frame)
 mark(name:string,extra?:string):void;
}
type Phase='wait-ready'|'settle'|'tap-door'|'outbound'|'island-settle'|'enter'|'entering'|'wait-board'|'pre-feed'|'feed'|'tail'|'done'|'failed';
export class ComboRunner {
 phase:Phase='wait-ready';private at=0;private frames:any[]=[];private next=0;private feedAt=0;private off:(()=>void)|null=null;private triedInvoke=false;
 private obs:ComboObservation={cheers:[],sfx:[],text:[],muted:false,suspended:false,textHost:false,audio:false};
 result:{pass:boolean;line:string}|null=null;get current(){return this.phase;}
 constructor(private d:ComboDriver,private o:ComboOptions,private t0:number){this.at=d.now();d.mark('combo:armed',`enter=${o.enter} clears=${o.clears} gapMs=${o.gapMs} path=feed`);}
 finished(){return this.phase==='done'||this.phase==='failed';}
 private go(p:Phase){this.phase=p;this.at=this.d.now();}
 private since(){return this.d.now()-this.at;}
 private fail(r:string){this.off?.();this.off=null;const why=r.replace(/\s+/g,'_');this.d.mark('combo:done',`aborted=1 phase=${this.phase} reason=${why}`);this.d.mark('combo:result',`FAIL reason=${why}`);this.go('failed');}
 /** Observer feeds (wired by the glue from its own audio:sfx / ui:cheer-text marks); only counted while feeding. */
 onSfx(name:string,accepted:boolean){if(this.phase==='feed'||this.phase==='tail')this.obs.sfx.push({name,accepted});}
 onText(tier:number,decision:string,source:string){if(this.phase==='feed'||this.phase==='tail')this.obs.text.push({tier,decision,source});}
 tick(){
  if(this.finished())return;const s=this.d.state();
  if(s==='error'||s==='disposed'){this.fail('world-'+s);return;}
  const timed=this.phase!=='settle'&&this.phase!=='feed'&&this.phase!=='tail'&&this.phase!=='wait-board'&&this.phase!=='pre-feed'&&this.phase!=='island-settle';
  if(timed&&this.since()>this.o.phaseTimeoutMs){this.fail('timeout-'+this.phase);return;}
  switch(this.phase){
   case 'wait-ready':{if(s===null||!this.d.idle())return;
    if(this.o.enter==='none'||s==='level'){this.d.mark('world-ready');this.d.mark('combo:skip-walk',`state=${s} enter=${this.o.enter}`);this.go(s==='level'?'wait-board':'pre-feed');return;}
    if(s==='home'){this.d.mark('world-ready');this.go('settle');return;}
    if(s==='island'){this.d.mark('world-ready');this.go('island-settle');return;}return;}
   case 'settle':if(this.since()>=this.o.startDelayMs){if(s!=='home'||!this.d.idle()){this.go('wait-ready');return;}this.go('tap-door');}return;
   case 'tap-door':{const r=this.d.tapDoor();if(!r.ok){this.fail('tap-door-'+r.reason);return;}this.d.mark('tap-door','via='+(r.via||'?'));this.go('outbound');return;}
   case 'outbound':if(s==='island'&&this.d.idle()){this.d.mark('island-arrived');this.go('island-settle');}else if(s==='home'&&this.since()>1500&&this.d.idle())this.fail('leave-rejected');return;
   case 'island-settle':if(this.since()>=this.o.settleMs&&s==='island'&&this.d.idle())this.go('enter');return;
   case 'enter':{const r=this.d.enterLevel('button');if(!r.ok){this.triedInvoke=true;const r2=this.d.enterLevel('invoke');if(!r2.ok){this.fail('enter-level-'+r.reason+'/'+r2.reason);return;}this.d.mark('combo:enter-level','via='+(r2.via||'?')+' buttonFailed='+r.reason);}
    else this.d.mark('combo:enter-level','via='+(r.via||'?'));this.go('entering');return;}
   case 'entering':{if(s==='level'||this.d.board().present){this.go('wait-board');return;}
    if(s==='island'&&this.d.idle()&&this.since()>=this.o.enterRetryMs){if(this.triedInvoke){this.fail('enter-level-rejected');return;}this.triedInvoke=true;const r=this.d.enterLevel('invoke');if(!r.ok){this.fail('enter-level-invoke-'+r.reason);return;}this.d.mark('combo:enter-level','via='+(r.via||'?')+' retry=button-tap-had-no-effect');this.at=this.d.now();}return;}
   case 'wait-board':{const b=this.d.board();if(b.present&&b.ready&&!b.modal&&this.d.idle()){this.d.mark('combo:board-ready',`boardState=${b.state}`);this.go('pre-feed');return;}
    if(this.since()>=this.o.boardTimeoutMs){this.d.mark('combo:board-timeout',`present=${b.present?1:0} ready=${b.ready?1:0} modal=${b.modal?1:0} boardState=${b.state} (feeding anyway)`);this.go('pre-feed');}return;}
   case 'pre-feed':{if(this.since()<this.o.settleMs)return;const a=this.d.audio(),b=this.d.board();this.obs.audio=a.present;this.obs.muted=a.muted;this.obs.suspended=a.suspended;this.obs.textHost=this.d.textHost();
    if(!a.present){this.d.mark('combo:start','audio=missing');this.fail('no-GameAudio');return;}
    this.off=this.d.subscribeCheer((level,v)=>{if(this.phase!=='feed'&&this.phase!=='tail')return;this.obs.cheers.push(level);const cells=(v?.wave?.removed||[]).map((c:any)=>c?.index).join(',');this.d.mark('combo:cheer',`level=${level} word=${CHEER_WORDS[level]??'?'} expectClip=${CHEER_CLIPS[level]??'-'} token=${v?.token??'-'} cells=${cells||'-'}`);});
    this.frames=buildComboFrames(this.o.clears,i=>this.d.tile(i));this.next=0;
    this.d.mark('combo:start',`path=feed frames=${this.frames.length} clears=${this.o.clears} gapMs=${this.o.gapMs} board=${b.present?(b.ready?'ready':'present'):'none'} boardState=${b.state} muted=${a.muted?1:0} suspended=${a.suspended?1:0} cheerText=${this.obs.textHost?1:0} onCheer=${this.off?1:0}`);
    this.go('feed');this.feedAt=this.d.now();this.tick();return;} // frame 0 in this same frame
   case 'feed':{while(this.next<this.frames.length&&this.d.now()-this.feedAt>=this.next*this.o.gapMs){const f=this.frames[this.next],i=this.next;
     const extra=f.kind==='action'?'kind=action resets=cascade':`kind=clear cascade=${i} cells=${f.wave.indexes.join(',')} expectSfx=${cascadeSfx(i)} expectTier=${cascadeTier(i)}${cascadeTier(i)>=0?' expectClip='+CHEER_CLIPS[cascadeTier(i)]:''}`;
     this.d.mark('combo:frame',`i=${i}/${this.frames.length-1} token=${f.token} ${extra}`);const r=this.d.feed(f);this.next++;if(!r.ok){this.fail('feed-'+r.reason);return;}}
    if(this.next>=this.frames.length)this.go('tail');return;}
   case 'tail':{if(this.since()<this.o.tailMs)return;this.off?.();this.off=null;const res=evaluateCombo(this.obs,this.o.clears);this.result=res;
    this.d.mark('combo:done',`frames=${this.frames.length} cheers=${this.obs.cheers.length} cheerSfx=${this.obs.sfx.filter(x=>x.name.indexOf('sfx_cheer_')===0).length} texts=${this.obs.text.length} totalMs=${Math.round(this.d.now()-this.t0)}`);
    this.d.mark('combo:result',res.line);this.go('done');return;}
  }
 }
}
