'use strict';
// r5 test hook (界面验收部 new-regions r4 §2 item 3): __qfPreTransition('journal-sky-open' | 'journal-sky-progress') stands on the
// island with 天空之城 unlocked and 0/4 or 1/4 done, so the 前往 / 继续 button states can be captured.
//  - keys exist, place=island, checkpoints 8 / 9 registered (finish=true); same gate as every other pre-transition key:
//    off by default, never in WeChat release (incl. launch query).
//  - the isolated profile the runner swaps in (createRegionFlowCheckpoint, real engine replay) yields sky = open 0/4 → page button
//    「前往天空之城」, focus card 「前往 ›」; and sky = progress 1/4 → 「继续」/「继续 ›」. The cleared state (12) still says 再访.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{createHarness}=require('../board-ui/harness.cjs');
(async()=>{
const H=createHarness({debug:false}),cc=H.cc,K=H.load('world-r2/PreTransitionKeys'),RF=H.load('world-r2/RegionFlowTest');
const {IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay');
const wx=(env,query)=>({wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:env}}),getLaunchOptionsSync:()=>({query:query||{}})}});
const WANT={'journal-sky-open':{cp:8,state:'open',done:0,btn:'前往天空之城',go:'前往 ›'},'journal-sky-progress':{cp:9,state:'progress',done:1,btn:'继续',go:'继续 ›'}};
for(const [key,w] of Object.entries(WANT)){const s=K.preSpec(key);assert(s,key);assert.equal(s.place,'island');assert.equal(s.checkpoint,w.cp);assert.equal(s.finish,true);
  assert.deepEqual(s.taps[0],{kind:'node',path:['ChapterPanel','Continue-sky']});
  assert.equal(K.preTransitionEnabled('',{}),false,'off by default');assert.equal(K.preTransitionKey('?qfPre='+key,{}),key);
  assert.equal(K.preTransitionKey('?qfPre='+key,wx('release')),null,key+' never in release');assert.equal(K.preTransitionEnabled(null,wx('release',{qfPre:key,qfHooks:'1'})),false,key+' release ignores launch query');}
const run=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/world-r2/PreTransitionRun.ts'),'utf8');
assert.ok(/spec\.key==='journal-sky-open'\|\|spec\.key==='journal-sky-progress'\)\{const j=this\.d\.islandJourney\(\);j\?\.open\?\.\('sky'\);/.test(run),'runner opens the sky page on the island');
const STAGES=Array.from({length:12},(_,i)=>({id:'mainline-'+String(i+1).padStart(2,'0'),region:i<4?'tide':i<8?'meadow':'sky'}));
for(const [key,w] of Object.entries({...WANT,'(cleared 12, existing skycity-visit)':{cp:12,state:'done',done:4,btn:'再访天空之城',go:'再访 ›'}})){
  const prof=RF.createRegionFlowCheckpoint(w.cp,{allowQa:true,finish:true,anyCheckpoint:true}),snap=prof.mainline.createController().snapshot();
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:snap.journey}),gates:()=>({r5:[{region:'sky',ok:true}],challenges:{},stages:STAGES}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode:'day'})});
  await H.flush();o.sync(390,844,true);o.open('sky');await H.flush();const c=o.popups.find('ChapterPanel');assert(c,key+' sky page');
  const btn=c.root.find('Continue-sky');assert(btn,key+' button');assert.equal(btn.getComponentsInChildren(cc.Label)[0].string,w.btn,key+' button text');assert.notEqual(btn.__disabled,true,key+' enabled');
  o.close();await H.flush();o.open('journal');await H.flush();const j=o.popups.find('JourneyPanel'),card=j.root.find('Focus-sky');
  if(w.state!=='done'){assert(card,key+' focus card is sky');assert.equal(card.getComponentsInChildren(cc.Label).find(l=>l.node.name==='Go').string,w.go,key+' focus card');}
  const cell=j.root.find('Chapter-sky').getComponentsInChildren(cc.Label).find(l=>l.node.name==='Status').string;
  console.log('PASS '+key+': sky '+w.state+' → page 「'+w.btn+'」, cell 「'+cell+'」'+(card?', focus 「'+w.go+'」':''));o.dispose();}
})().catch(e=>{console.error(e);process.exit(1);});
