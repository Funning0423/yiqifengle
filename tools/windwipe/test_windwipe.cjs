'use strict';
// WindWipe (post-island SPEC §1) + L16 → ending (TR9). Pure logic on a simulated clock; NOT a render. Mac must still confirm frames.
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness();
const W=H.load('world-r2/WindWipeCore'),SC=H.load('world-r1/ScreenCover'),E=H.load('world-r2/EndingFlow'),HT=H.load('world-r2/HomeTransition'),RJ=H.load('world-r1/RegionJourneyCore');
const S='creator-build-project/assets/scripts/';const src=f=>fs.readFileSync(S+f,'utf8');
let pass=0;const ok=(m)=>{pass++;console.log('PASS',m);};
// sim clock: wait(s) advances time; frame() = 1/60 s; cover ramps resolve after their seconds
function clock(){let t=0;const log=[];const self={log,now:()=>t,wait:async s=>{t+=Math.max(0,s);},frame:async()=>{t+=1/60;},
  cover:async(a,s)=>{log.push(['cover',a,+s.toFixed(3),+t.toFixed(3)]);t+=s;},audioOut:s=>{log.push(['audioOut',s,+t.toFixed(3)]);},audioIn:s=>{log.push(['audioIn',s,+t.toFixed(3)]);},
  content:c=>log.push(['content',c&&c.vehicle,c&&c.sign])};return self;}
(async()=>{
 // 1 timing constants (SPEC)
 assert.equal(W.WINDWIPE.outS,.45);assert.equal(W.WINDWIPE.holdS,1.10);assert.equal(W.WINDWIPE.inS,.55);assert.equal(W.WINDWIPE.tiltDeg,12);assert.equal(W.WINDWIPE.lobes,26);
 assert.equal(RJ.SETOFF_FADE.outS,.45);assert.equal(RJ.SETOFF_FADE.holdS,1.10);assert.equal(RJ.SETOFF_FADE.inS,.55);
 assert.equal(HT.HOME_FADE.outS,.45);assert.equal(HT.HOME_FADE.inS,.55);assert.equal(HT.HOME_FADE.holdS,.5);ok('timing 0.45 / ≥1.10 / 0.55 (home hold 0.5) on every path');
 // 2 fast load: total = out + 1.10 + in, audio out with cover, audio in at reveal, content set then cleared
 {const c=clock();const r=await W.runWindWipe(c,{content:W.wipeContentFor('meadow'),work:async()=>({ok:true}),ready:()=>true});
  assert.equal(r.ok,true);assert(Math.abs(r.outS-.45)<1e-9);assert(r.holdS>=1.10-1e-9&&r.holdS<1.10+1/60+1e-9,'hold '+r.holdS);assert(Math.abs(r.inS-.55)<1e-9);
  const ao=c.log.find(x=>x[0]==='audioOut'),ai=c.log.find(x=>x[0]==='audioIn');assert.equal(ao[1],.45);assert.equal(ao[2],0);assert(ai[2]>=.45+1.10-1e-6);
  assert.deepEqual(c.log.find(x=>x[0]==='content').slice(1),['sailboat','花粉草甸']);ok('fast load: out 0.45 + hold '+r.holdS.toFixed(3)+' + in 0.55; music out with cover, in at reveal');}
 // 3 slow load (3.2 s): hold extends, cover never lifts before load + ready
 {const c=clock();let loaded=false;const r=await W.runWindWipe(c,{work:async()=>{await c.wait(3.2);loaded=true;return {ok:true};},ready:()=>loaded});
  assert.equal(r.slowLoad,true);assert(r.holdS>=3.2);const lift=c.log.find(x=>x[0]==='cover'&&x[1]===0);assert(lift[3]>=.45+3.2-1e-6,'lifted at '+lift[3]);assert.equal(r.readyAtReveal,true);
  ok('slow load: held '+r.holdS.toFixed(2)+' s, cover lifts only after load');}
 // 4 not ready (character / camera not placed) after load → keeps holding until ready
 {const c=clock();let placedAt=2.5;const r=await W.runWindWipe(c,{work:async()=>({ok:true}),ready:()=>c.now()>=placedAt});
  assert(c.log.find(x=>x[0]==='cover'&&x[1]===0)[3]>=placedAt-1e-9);assert.equal(r.readyAtReveal,true);ok('reveal waits for character/camera ready');}
 // 5 lifecycle hooks: covered → beforeReveal (awaited) → revealed
 {const c=clock(),ev=[];let release;const offs=[SC.onWipeCovered(e=>ev.push(['covered',e.kind,+c.now().toFixed(2)])),
   SC.addWipeBeforeReveal(e=>{ev.push(['before',e.kind]);return new Promise(r=>{release=r;});}),SC.onWipeRevealed(e=>ev.push(['revealed',e.kind,+c.now().toFixed(2)]))];
  const p=W.runWindWipe(c,{kind:'ride',work:async()=>{await c.wait(.1);return {ok:true};},ready:()=>{if(release&&c.now()>2){release();}return true;}});const r=await p;offs.forEach(f=>f());
  assert.deepEqual(ev.map(x=>x[0]),['covered','before','revealed']);assert.equal(ev[0][2],.45);assert(ev[2][2]<3,'revealed at '+ev[2][2]);assert.equal(r.ok,true);ok('hooks: '+JSON.stringify(ev));}
 // 6 no-black-frame guard: band colours are never black, opaque at full, shapes monotone
 {const lum=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];for(const k of ['day','night']){const C=W.WINDWIPE_COLORS[k];assert(lum(C.top)>30&&lum(C.bottom)>30,k+' too dark');}
  assert.equal(W.wipeShape('full',1).opaque,true);assert.equal(W.wipeShape('out',1).opaque,true);assert.equal(W.wipeShape('in',0).opaque,true);
  let prev=-1;for(let i=0;i<=20;i++){const s=W.wipeShape('out',i/20);assert(s.lead>=prev);prev=s.lead;}prev=-1;for(let i=0;i<=20;i++){const s=W.wipeShape('in',i/20);assert(s.trail>=prev);prev=s.trail;}
  assert(W.wipeShape('out',1).lead>=1+W.LOBE-1e-9&&W.wipeShape('in',1).trail>=1+W.LOBE-1e-9,'edges clear the screen');
  const boot=src('WorldIntegrationBoot.ts'),view=src('ui/WindWipe.ts');assert(!/new Color\(0,\s*0,\s*0,\s*a\)/.test(boot),'black cover fill still in Boot');assert(!/fillColor\s*=\s*new Color\(0,\s*0,\s*0/.test(view));assert(/BlockInputEvents/.test(view));
  ok('no black: day/night band luminance >30, OUT/IN monotone, reveal continues upper-right, touches swallowed');}
 // 7 state mapping of legacy cover(alpha,s): rising = out, falling = in (continues forward, never backs off)
 {const st=new W.WindWipeState();st.set(1,.45,0);st.tick(.2);assert.equal(st.mode,'out');st.tick(.45);assert.equal(st.mode,'full');st.set(0,.55,1.6);st.tick(1.8);assert.equal(st.mode,'in');assert(st.shape().trail>-W.LOBE);st.tick(2.2);assert.equal(st.mode,'clear');
  assert(W.contentAlpha({mode:'full',fullFor:.2,inFor:0})===0);assert(W.contentAlpha({mode:'full',fullFor:.7,inFor:0})>.99);assert(W.contentAlpha({mode:'in',fullFor:0,inFor:.2})<1e-6);
  const d=W.holdDrift(1);assert(Math.abs(d.dx-22)<1e-9);assert.equal(W.holdDrift(2.9).dots,false);assert.equal(W.holdDrift(3).dots,true);ok('legacy alpha ramps map onto OUT/FULL/IN; content in after 0.3 s; drift 22 pt/s; dots after 3 s');}
 // 8 home (TR8) hold ≥0.5 s and ready gate
 {const c=clock();let placed=false;const r=await HT.runHomeTransition({now:c.now,wait:s=>s>=5?new Promise(()=>{}):c.wait(s),cover:c.cover,audioOut:()=>{},audioIn:()=>{},audioRestore:()=>{},act:async()=>{setTimeout(()=>{},0);placed=false;return {ok:true};},state:()=>'home',ready:()=>{const t=c.now();if(t>=1.4)placed=true;return placed;}},HT.HOME_FADE);
  assert.equal(r.ok,true);const lift=c.log.find(x=>x[0]==='cover'&&x[1]===0);assert(lift[3]>=1.4-1e-9,'home lifted at '+lift[3]);ok('home: hold ≥0.5 s and until home lens ready ('+lift[3].toFixed(2)+' s)');}
 // 9 hold content per transition
 assert.deepEqual(W.wipeContentFor('meadow'),{vehicle:'sailboat',sign:'花粉草甸'});assert.deepEqual(W.wipeContentFor('skycity'),{vehicle:'balloon',sign:'天空之城'});
 assert.deepEqual(W.wipeContentFor('lakeside'),{vehicle:'balloon',sign:'风铃湖畔'});assert.equal(W.wipeContentFor('ending').vehicle,'chime');ok('hold content: one vehicle + one sign per destination');
 // 10 every cover path routes through the WindWipe renderer + ScreenCover (no second black cover in scripts)
 {const scripts=require('node:child_process').execSync("git grep -nI 'new Color(0, *0, *0, *a)\\|g.fillColor=new Color(0,0,0' -- "+S+" || true").toString().trim();
  assert.equal(scripts,'','black full-screen fills left: '+scripts);const rj=src('world-r1/RegionJourneyCore.ts');assert(/holdCover\(world,token\)/.test(rj)&&/coverAudioOut\(SETOFF_FADE\.outS\)/.test(rj)&&/coverAudioIn\(SETOFF_FADE\.inS\)/.test(rj));
  assert(/coverContent\(wipeContentFor\('lakeside',true\)\)/.test(src('region/RegionJourneyAdapter.ts')));ok('set-off, ride, lakeside boarding, home, ending all use the shared WindWipe cover');}
 // 11 ending gate + flows
 {const b={provider:'regional-r05',state:'result.saved',result:{completionRecorded:true},nextStageId:null,active:{region:'lake'},progress:{records:{'r04-lake-01':1,'r04-lake-02':1,'r04-lake-03':1,'r04-lake-04':1}}};
  assert.equal(E.endingAvailable({state:'level'},b),true);assert.equal(E.endingAvailable({state:'level'},{...b,nextStageId:'x'}),false);assert.equal(E.endingAvailable({state:'level'},{...b,active:{region:'sky'}}),false);
  assert.equal(E.endingAvailable({state:'level'},{...b,state:'result.unsaved'}),false);assert.equal(E.endingAvailable({state:'level',needsResume:true},b),false);
  let state='level',shown=false,marks=0;const calls=[];const host={wipe:async o=>{calls.push(o.kind);const r=await o.work();assert.equal(o.ready(),true,'ready at reveal for '+o.kind);return r;},
   showEnding:()=>{shown=true;},hideEnding:()=>{shown=false;},endingShown:()=>shown,exitLevel:()=>{state='lakeside';return {ok:true};},toIsland:()=>{state='island';return {ok:true};},state:()=>state,islandMusic:()=>{},markComplete:()=>marks++};
  assert.equal((await E.playEnding(host)).ok,true);assert.equal(shown,true);assert.equal(marks,1);
  assert.equal((await E.endingToIsland(host)).ok,true);assert.equal(state,'island');assert.equal(shown,false);assert.deepEqual(calls,['ending','ending-home']);
  const L=E.endingLayout(320,568,0);assert.equal(L.buttonW,240);assert(L.edgeInset>=24);assert.equal(E.endingLayout(260,568,0).buttonW,212);
  const boot=src('WorldIntegrationBoot.ts');assert(/'ending'\]/.test(boot)&&/k==='ending'\?endingAvailable\(s,b\)/.test(boot));assert(/nextLabel: ending \? '继续'/.test(src('ManagedMobileBoardUI.ts')));
  const es=src('ui/EndingScreen.ts');assert(/'旅程完成'/.test(es)&&/'回小岛'/.test(es)&&(es.match(/artButton\(/g)||[]).length===1);
  ok('L16 → 继续 → WindWipe → ending (旅程完成, one 回小岛) → WindWipe → island; gate only on saved last-lake win');}
 // 12 ending v2 (UI设计部 SPEC §3 v2.1): 7 sizes pass the design's layout checks; layered day/night art present with .meta
 {const fs=require('fs'),path=require('path');
  for(const [w,h] of [[320,568],[360,780],[375,667],[390,844],[393,852],[414,896],[430,932]]){const c=E.endingLayoutChecks(w,h,0);for(const k of Object.keys(c))assert(c[k],w+'x'+h+' '+k);}
  const L=E.endingLayout(320,568,0);assert(L.girl.y1-L.girl.y0>=48-1e-6&&L.girl.y0-(L.sealsCy+22)>=12-1e-6);
  assert.equal(E.endingSwayDeg(0),0);assert(Math.abs(E.endingSwayDeg(0.8)-4)<1e-9);assert(Math.abs(E.endingSwayDeg(2.4)+4)<1e-9);
  const dir=path.join(__dirname,'../../creator-build-project/assets/resources/ending');
  for(const m of ['day','night'])for(const f of ['end_bg_'+m+'.jpg','end_chime_'+m+'.png','end_girl_'+m+'.png']){assert(fs.existsSync(path.join(dir,f))&&fs.existsSync(path.join(dir,f+'.meta')),f);}
  const es=src('ui/EndingScreen.ts');assert(/end_bg_'\s*\+\s*mode/.test(es)&&/ChimeSway/.test(es)&&/pending\s*<=\s*0/.test(es));
  ok('ending v2: 7 sizes pass layout checks (320×568 girl 48 pt, head ≥12 pt under seals); chime sways ±4°/3.2 s; day+night art with .meta; reveal waits for art');}
 console.log('windwipe-ending: '+pass+' checks PASS');
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
