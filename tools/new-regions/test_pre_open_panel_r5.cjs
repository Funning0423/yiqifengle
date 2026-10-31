'use strict';
// r5 P3 (界面验收部 journal-3277421c §钩子): every journal hook auto-run on the box ended 「chapter-panel-not-open」.
// Root cause: the hook called IslandJourneyOverlay.open() straight after leave-home/profile setup. open() is a silent no-op until the
// host has enabled the overlay for an island frame (Boot sync: state island && !busy) and the page is built only once the journey_ui
// bundle is in; the hook then polled a fixed 5 s for a panel that had never been requested. Fix: PreTransitionRunner.openPanel waits
// on the real signals — warmJourneyUi() → overlay.ready() → openPage() → overlay.shownPage() — bounded by rendered frames, not ms.
// This gate: (1) reproduces the no-op (open before enable = no panel, openPage refuses); (2) openPanel succeeds when the host enables the
// overlay late (frame 40, after the old hook would have given up its single open call); (3) never-enabled overlay reports
// journal-overlay-not-ready after the frame budget instead of hanging; (4) no wall-clock panel wait is left in PreTransitionRun.ts.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness({debug:false}),cc=H.cc;let frame=0,waiters=[];
cc.Director.EVENT_AFTER_DRAW='director_after_draw';cc.director.getTotalFrames=()=>frame;const once0=cc.director.once;
cc.director.once=(ev,cb,t)=>{if(ev==='director_after_draw'){waiters.push(()=>cb.call(t));return;}return once0.call(cc.director,ev,cb,t);};
const pump=async(n,each)=>{for(let i=0;i<n;i++){frame++;if(each)each(frame);const w=waiters;waiters=[];w.forEach(f=>f());await H.flush(2);}};
H.load(path.join(H.BUNDLES,'board_art/journey_ui/JourneyPanels.ts'));globalThis.location={search:'?qfHooks=1'};
const {IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay'),{PreTransitionRunner}=H.load('world-r2/PreTransitionRun');
const rec=n=>Array.from({length:12},(_,i)=>({bestStars:i<n?1:0}));
const mk=()=>new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(10)}}),gates:()=>({r5:[{region:'tide',ok:true},{region:'meadow',ok:true}],challenges:{},stages:null}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode:'day'})});
const runner=o=>new PreTransitionRunner({composition:{worldCommands:()=>({snapshot:()=>({state:'island'})})},board:()=>null,control:()=>undefined,call:async f=>f(),idle:()=>true,islandJourney:()=>o,glassSign:()=>null,roomExplore:()=>null,frame:()=>({width:390,height:844}),signRect:()=>null,leave(){},enterMainline(){},returnHome(){}});
process.on('exit',c=>{if(c===0&&!globalThis.__done){console.error('FAIL: a wait never settled');process.exitCode=1;}});
(async()=>{
// 1. the old failure: open before the host enabled the overlay = nothing
{const o=mk();await H.flush();o.open('sky');await H.flush();assert(!o.popups.find('ChapterPanel'),'open() before enable is a silent no-op (the old hook then polled 5 s for nothing)');
 assert.equal(o.openPage('sky'),false,'openPage refuses before ready');assert.equal(o.ready(),false);o.dispose();}
// 2. host enables late: openPanel waits on ready → open → shownPage
{const o=mk();await H.flush();const r=runner(o);let res=null;const p=r.openPanel('sky',['ChapterPanel','Continue-sky']).then(x=>res=x);
 await pump(60,f=>{if(f===40)o.sync(390,844,true);});await p;assert.deepEqual(res,{ok:true},'opened after the late enable: '+JSON.stringify(res));
 assert.equal(o.shownPage(),'sky','shownPage = sky');assert(o.popups.find('ChapterPanel'),'panel on screen');o.close();assert.equal(o.shownPage(),null,'cleared on close');
 res=null;const q=r.openPanel('journal',['JourneyPanel']).then(x=>res=x);await pump(5);await q;assert.deepEqual(res,{ok:true},'journal opened');assert.equal(o.shownPage(),'journal','journal shown');o.dispose();}
// 3. never enabled: bounded by frames, explicit reason
{const o=mk();await H.flush();let res=null;const p=runner(o).openPanel('sky',['ChapterPanel','Continue-sky']).then(x=>res=x);await pump(130);await p;
 assert(res&&!res.ok&&/journal-overlay-not-ready/.test(res.reason),'never enabled → journal-overlay-not-ready: '+JSON.stringify(res));o.dispose();}
// 4. static: no wall-clock wait for a journal panel left
{const src=fs.readFileSync(path.join(H.SCRIPTS,'world-r2/PreTransitionRun.ts'),'utf8');
 assert(!/waitFor\(\(\)=>findPath\(\['(ChapterPanel|JourneyPanel)'/.test(src),'no ms-polled journal panel wait');assert(!/islandJourney\(\);j\?\.open\?\./.test(src),'no direct private open() from the hook');
 assert((src.match(/openPanel\(/g)||[]).length>=3,'all journal hooks go through openPanel');}
delete globalThis.location;globalThis.__done=true;
console.log('PASS hook panel open waits on the real signals (bundle → overlay ready → openPage → shownPage), frame-bounded; late enable at frame 40 opens; never-enabled reports journal-overlay-not-ready; old open-before-enable no-op reproduced');
})().catch(e=>{console.error(e);process.exit(1);});
