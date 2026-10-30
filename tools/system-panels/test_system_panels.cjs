'use strict';
// system-panels (SPEC ui-design/system-panels, approved d9b0cf7c/6c629efc): PopupKit timings, advisory cold/lock logic,
// publication all-or-nothing, settings persistence, UiPrefs.vibrate gating, update popup conditions + twice-per-session.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const store=new Map();const cc={sys:{localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))}}};
function load(rel,extra={}){const src=fs.readFileSync(path.join(S,rel),'utf8');const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText;
 const m={exports:{}};const req=n=>n==='cc'?cc:extra[n]?extra[n]:require(n);new Function('require','module','exports','globalThis',js)(req,m,m.exports,extra.global||globalThis);return m.exports;}
// 1) PopupKit timings
const M=load('ui/PopupMotion.ts');
assert.equal(M.OPEN_S,0.32);assert.equal(M.CLOSE_S,0.18);assert.equal(M.RELEASE_S,0.12);assert.equal(M.TOGGLE_S,0.18);
const css=(x1,y1,x2,y2,t)=>{let lo=0,hi=1,u=.5;for(let i=0;i<60;i++){u=(lo+hi)/2;const x=3*(1-u)**2*u*x1+3*(1-u)*u*u*x2+u**3;if(x<t)lo=u;else hi=u;}return 3*(1-u)**2*u*y1+3*(1-u)*u*u*y2+u**3;};
for(const t of [0.05,0.1,0.25,0.5,0.75,0.9]){assert.ok(Math.abs(M.easeEnter(t)-css(.05,.7,.1,1,t))<1e-4,'enter bezier '+t);assert.ok(Math.abs(M.easeExit(t)-css(.3,0,.8,.15,t))<1e-4,'exit bezier '+t);}
assert.equal(M.enterAt(0).scale,0.92);assert.equal(M.enterAt(0.32).scale,1);assert.equal(M.enterAt(0.19).alpha,1,'alpha 1 by 190 ms');assert.ok(M.enterAt(0.1).alpha<1);
assert.equal(M.exitAt(0).alpha,1);assert.ok(Math.abs(M.exitAt(0.18).alpha)<1e-9);assert.ok(Math.abs(M.exitAt(0.18).scale-0.96)<1e-9);
assert.equal(M.enterAt(0,true).scale,1,'reduced: no scale');assert.equal(M.exitAt(0.09,true).scale,1);
assert.equal(M.releaseScale(0),M.PRESS_SCALE,'press shows at once');assert.ok(Math.abs(M.releaseScale(0.12)-1)<1e-9);assert.ok(Math.max(...[.04,.06,.08].map(M.releaseScale))>1,'easeOutBack overshoots');
const PK=fs.readFileSync(path.join(S,'ui/PopupKit.ts'),'utf8');
assert.ok(!/OPEN_S\s*=\s*0\.22|CLOSE_S\s*=\s*0\.15/.test(PK),'old 220/150 gone');assert.ok(/enterAt\(this\.t/.test(PK)&&/exitAt\(CLOSE_S - this\.closing/.test(PK),'PopupPanel uses the shared curves');
assert.ok(/content\.setScale\(baseScale\.x \* PRESS_SCALE/.test(PK)&&/tween\(content\)\.to\(RELEASE_S/.test(PK),'press same frame / release 120 ms easeOutBack');
// 2) advisory (first-screen.js)
const FSRC=fs.readFileSync(path.join(ROOT,'tools/first-screen/src/first-screen.js'),'utf8');/* readable source for code checks */
const FRUN=fs.readFileSync(process.env.QF_FIRST_SCREEN||path.join(ROOT,'creator-build-project/build-templates/wechatgame/first-screen.js'),'utf8');/* behaviour: shipped (minified) or source */
const ctx={module:{exports:{}},console,Promise,Date,Math,JSON};ctx.exports=ctx.module.exports;ctx.GameGlobal=ctx;vm.createContext(ctx);vm.runInContext(FRUN,ctx);const F=ctx.module.exports;
assert.equal(F.ADVISORY.totalMs,3000);assert.equal(F.ADVISORY.lockMs,1500);
assert.equal(F.ADVISORY_LINES.join(''),'抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。','legal text verbatim');
assert.equal(F.advisoryTap(1499,-1),-1,'tap inside the 1.5 s lock ignored');assert.equal(F.advisoryTap(1500,-1),1500);assert.equal(F.advisoryTap(2000,1600),1600,'first accepted tap kept');
// handoff path A: engine ready early (end() at 1.0 s) → 3.0 s total, fade from 2.7 s
assert.equal(F.advisoryFrame(2999,-1,false,1000).done,false);assert.equal(F.advisoryFrame(3000,-1,false,1000).done,true,'3.0 s total');assert.ok(F.advisoryFrame(2850,-1,false,1000).alpha<1);
// handoff path B: engine not ready at 3.0 s → full advisory frame held (never blank), fade starts when end() arrives (5.0 s)
for(const t of [2700,3000,4000,4999]){const f=F.advisoryFrame(t,-1,false,-1);assert.equal(f.alpha,1,'held at '+t);assert.equal(f.done,false);assert.equal(f.hold,true);}
assert.equal(F.advisoryFrame(5000,-1,false,5000).alpha,1);assert.ok(F.advisoryFrame(5150,-1,false,5000).alpha<1);assert.equal(F.advisoryFrame(5300,-1,false,5000).done,true);
assert.equal(F.advisoryFrame(2000,1600,false,-1).alpha,1,'tap while loading keeps the frame');
assert.equal(F.advisoryFrame(1000,-1,false,500).alpha,1);assert.equal(F.advisoryFrame(1000,-1,false,500).hint,0,'no skip hint before 1.5 s');assert.equal(F.advisoryFrame(1800,-1,false,500).hint,1);
assert.equal(F.advisoryFrame(1700,1600,false,500).done,false);assert.equal(F.advisoryFrame(1900,1600,false,500).done,true,'tap → 300 ms fade, then done');
assert.equal(F.advisoryFrame(1900,1200,false,500).done,false,'a locked-period tap time never shortens it');
assert.ok(F.advisoryFrame(100,-1,false,-1).dy>0);assert.equal(F.advisoryFrame(100,-1,true,-1).dy,0,'reduced: no rise');
// end() integration: end() before 3.0 s resolves only after the advisory; engine loading is never blocked by start()
assert.ok(/advisoryDone\(\)\.then\(nextFrame\)/.test(FSRC)&&/adv\.endAt = now\(\) - adv\.t0/.test(FSRC),'end() marks engine-ready, then waits');
{const st=FSRC.slice(FSRC.indexOf('function start('),FSRC.indexOf('/* fg-update-manager'));assert.ok(!/advisoryDone/.test(st),'start() promise does not wait for the advisory (engine + subpackages load in parallel)');}
// font: explicit chain, design sizes, shrink-to-fit without wrapping
assert.equal(F.ADVISORY_FONTS,'"Noto Serif SC","Songti SC",serif,sans-serif');
{const mk=em=>({font:'',measureText(ch){const px=+/(\d+)px/.exec(this.font)[1];return {width:px*em};}});
 let c=mk(1);assert.equal(F.fitFont(c,F.ADVISORY_LINES,'',17*2,2*2,780-96),1);assert.equal(c.font,'34px "Noto Serif SC","Songti SC",serif,sans-serif','17 pt @2x when it fits');
 c=mk(1.25);const k=F.fitFont(c,F.ADVISORY_LINES,'',17,2,252);assert.ok(k<1,'wide sans fallback shrinks');let w=0;for(const l of F.ADVISORY_LINES){let x=0;for(let i=0;i<l.length;i++)x+=c.measureText(l[i]).width+(i?2*k:0);w=Math.max(w,x);}assert.ok(w<=252,'fits, no wrap: '+w);
 c=mk(1);F.fitFont(c,['健康游戏忠告'],'bold ',22,6,300);assert.equal(c.font,'bold 22px "Noto Serif SC","Songti SC",serif,sans-serif','title 22 pt bold');}
assert.ok(/40 \* k\) \* pt/.test(FSRC),'line height stays 40 pt');
assert.ok(/G\.__qfAdvisory\) return/.test(FSRC),'once per process (cold start only; warm start = onShow, file not re-run)');
assert.ok(/advisoryDone\(\)\.then\(nextFrame\)/.test(FSRC),'engine handoff waits for the advisory');
assert.ok(!/onShow/.test(FSRC.slice(FSRC.indexOf('function startAdvisory'),FSRC.indexOf('function stopAdvisory'))),'not hooked to onShow');
// 3) publication all-or-nothing (TS + first-screen mirror)
const P=load('ui/PublicationInfo.ts');assert.deepEqual(P.PUBLICATION_INFO,{},'default empty');assert.equal(P.publicationLines(),null);
assert.deepEqual(JSON.parse(JSON.stringify(F.PUBLICATION_INFO)),P.PUBLICATION_INFO,'first-screen mirror equals PublicationInfo.ts');
const full={copyright:'a',publisher:'b',approval:'c',isbn:'d'};
for(const k of Object.keys(full)){for(const bad of [undefined,'','  ']){const x={...full,[k]:bad};assert.equal(P.publicationLines(x),null,k+'='+bad);assert.equal(F.publicationLines(x),null,'fs '+k);}}
assert.deepEqual(P.publicationLines(full),['a','b','c','d']);assert.deepEqual(Array.from(F.publicationLines(full)),['a','b','c','d']);
// 4) settings persistence + 5) vibrate gating
const calls=[];const g={wx:{vibrateShort:o=>calls.push(o.type)}};const U=load('ui/UiPrefs.ts',{global:g});
assert.equal(U.VIBRATE_KEY,'qfl.ui.vibrate');assert.equal(U.vibrateEnabled(),true,'default on');assert.equal(U.vibrate(),true);assert.deepEqual(calls,['light']);
U.setVibrateEnabled(false);assert.equal(store.get('qfl.ui.vibrate'),'0');assert.equal(U.vibrate('light'),false);assert.equal(calls.length,1,'off → wx.vibrateShort never called');
U.setVibrateEnabled(true);assert.equal(store.get('qfl.ui.vibrate'),'1');U.vibrate('medium');assert.deepEqual(calls,['light','medium']);
const A={v:0.7,muted:false,getMusicVolume(){return this.v;},setMusicVolume(x){this.v=x;},setMuted(){throw Error('setMuted must not be used');}};
U.setMusicOn(A,false);assert.equal(A.v,0);assert.equal(store.get('qfl.audio.musicLast'),'0.7');assert.equal(U.musicOn(A),false);
const A2={v:0,getMusicVolume(){return this.v;},setMusicVolume(x){this.v=x;}};U.setMusicOn(A2,true);assert.equal(A2.v,0.7,'restored from qfl.audio.musicLast (survives a new session)');
store.delete('qfl.audio.musicLast');const A3={v:0,getMusicVolume(){return this.v;},setMusicVolume(x){this.v=x;}};U.setMusicOn(A3,true);assert.equal(A3.v,0.4,'no record → 0.4');
U.setReducedMotion(true);assert.equal(U.reducedMotion(),true);U.setReducedMotion(false);assert.equal(U.reducedMotion(),false);
const CP=fs.readFileSync(path.join(S,'ui/CommonPanels.ts'),'utf8'),BP=fs.readFileSync(path.join(S,'ui/BoardPanels.ts'),'utf8');
for(const n of ['MusicToggle','SfxToggle','VibrateToggle','NightToggle','ReducedMotion'])assert.ok(CP.includes("'"+n+"'"),'settings row '+n);
const settings=CP.slice(CP.indexOf('export function openSettings'),CP.indexOf('// ---------------- about'));assert.ok(!/setMuted\(/.test(settings)&&!/p\.slider\(/.test(settings),'switches only, no setMuted');
const pause=BP.slice(BP.indexOf('export function openPause'),BP.indexOf('export function openRestartConfirm'));assert.ok(/setMusicOn\(/.test(pause)&&!/Vibrate/.test(pause),'pause: shared music switch, no vibration row');
// every vibration goes through UiPrefs.vibrate()
const all=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.ts')&&!p.endsWith('UiPrefs.ts')&&/vibrate(Short|Long)/.test(fs.readFileSync(p,'utf8')))all.push(path.relative(S,p));}})(S);
assert.deepEqual(all,[],'direct wx.vibrateShort/Long outside UiPrefs: '+all.join(','));assert.ok(/vibrate\('light'\)/.test(BP),'chest tap uses UiPrefs.vibrate');
// 6) update popup gate
const UP=load('ui/UpdatePromptCore.ts');const home={islandHome:true,popupOpen:false,board:false,transition:false},sig={ready:true};
let gate=new UP.UpdatePromptGate();
assert.equal(gate.tick(1,{ready:false},home),false,'no signal');
assert.equal(gate.tick(0,sig,{...home,board:true}),false,'never on a board');assert.equal(gate.tick(0,sig,{...home,transition:true}),false,'never in a transition');
assert.equal(gate.tick(0,sig,{...home,islandHome:false}),false);assert.equal(gate.tick(0,sig,{...home,popupOpen:true}),false,'not over another popup');
assert.equal(gate.tick(0,sig,home),false);assert.equal(gate.tick(0.5,sig,home),false,'waits 600 ms on home');assert.equal(gate.tick(0.11,sig,home),true);assert.equal(gate.tick(1,sig,home),false,'once while shown');
gate.later();assert.equal(gate.tick(5,sig,home),false,'稍后: not again until the next return home');
gate.tick(0,sig,{...home,board:true});gate.tick(0,sig,home);assert.equal(gate.tick(0.7,sig,home),true,'second prompt after returning');assert.equal(gate.count(),2);
gate.later();gate.tick(0,sig,{...home,transition:true});gate.tick(0,sig,home);assert.equal(gate.tick(5,sig,home),false,'max 2 per session');
gate=new UP.UpdatePromptGate();gate.tick(0,{ready:true,applied:true},home);assert.equal(gate.tick(1,{ready:true,applied:true},home),false,'not after apply');
assert.ok(!/showModal/.test(FSRC),'single update path: no system modal in first-screen.js');
const OV=fs.readFileSync(path.join(S,'world-r2/IslandJourneyOverlay.ts'),'utf8');assert.ok(/updateGate\.tick\(dt,upd/.test(OV)&&/openUpdate\(/.test(OV),'overlay drives the popup');
console.log('PASS system-panels (timings, advisory, publication, settings, vibrate, update)');
