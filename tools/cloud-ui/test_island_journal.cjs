'use strict';
// Island overlay on board-ui lite popups (PopupStack): dock, journey book → chapter page, bag, full settings, cabin rest.
// Real IslandJourneyOverlay / IslandPanels / CommonPanels / PopupKit / WarmButton sources on Cocos memory doubles.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const H=require('./harness.cjs')(),{Node,UITransform,Label,cc}=H;
const {IslandJourneyOverlay:Overlay,CHAPTERS}=H.evaluate('world-r2/IslandJourneyOverlay.ts',['IslandJourneyOverlay','CHAPTERS']);
const checks=[];let cases=0;
function setup(w=390,h=844){H.H.setViewport(w,h);const parent=new Node('Canvas'),calls=[],data={journey:{unlocked:12,records:Array.from({length:12},(_,i)=>({bestStars:i<4?3:1})),inventory:{tools:{windBell:2,tideBottle:0,tideNet:1,sunSeed:3,starShears:1}}}},gates={r5:['tide','meadow','sky'].map(region=>({region,ok:region==='tide'})),r4:[{unlocked:true}],challenges:{tide:2,meadow:0,sky:4}};let o;const opts={invoke:fn=>{calls.push(o.isOpen()?'invoke-while-open':'invoke');return fn()},mainlineStatus:()=>data,gates:()=>gates,enterRegion:id=>calls.push('region:'+id),enterR4:()=>calls.push('r4'),enterSkycity:()=>calls.push('skycity'),returnHome:()=>calls.push('home'),toggleDayNight:()=>calls.push('dayNight'),dayNight:()=>({mode:'day'})};o=new Overlay(parent,opts);o.sync(w,h,true);return{o,parent,calls,data,gates};}
const tap=n=>H.tapNode(n),settle=(o,s=.5)=>{for(let t=0;t<s;t+=1/30)o.popups.update(1/30);};
const top=o=>{const n=o.popups.names();return n[n.length-1]||null;},node=(o,panel,name)=>o.popups.find(panel)?.root.find(name)||null;
function bounds(n,w,h){const p=n.worldPosition,t=n.getComponent(UITransform),s=n.worldScale;return{left:w/2+p.x-t.width*s.x/2,right:w/2+p.x+t.width*s.x/2,top:h/2-p.y-t.height*s.y/2,bottom:h/2-p.y+t.height*s.y/2};}
(async()=>{
 {const parent=new Node('disabled-parent'),o=new Overlay(parent,{});o.sync(390,844,false);o.sync(390,844,true);assert.equal(o.buttons[0].position.x,-100);o.sync(320,568,false);o.sync(320,568,true);assert(o.buttons[0].position.x<0);o.dispose();checks.push('initial disabled and resized-while-disabled overlays lay out correctly on enabling');}
 await H.flush(10);
 for(const [w,h] of [[320,568],[390,844],[402,874],[568,320],[844,390]]){
  const {o,calls,data}=setup(w,h);assert.equal(o.isOpen(),false);assert.deepEqual(o.dock.children.map(n=>n.name),['Island-bag','Island-journal','Island-settings']);assert.deepEqual(o.popups.names(),[]);
  for(const b of o.buttons){const t=b.getComponent(UITransform);assert.equal(t.width,64);assert.equal(t.height,64);assert(b.position.y-32>=-h/2+(w<h?34:20));}
  tap(o.buttons[1]);assert(o.isOpen());assert.equal(o.dock.active,false);assert.equal(top(o),'JourneyPanel');for(const c of CHAPTERS)assert(node(o,'JourneyPanel','Chapter-'+c.id),'chapter sign '+c.id);assert(!node(o,'JourneyPanel','Continue-tide'),'no gameplay action on the chapter list');o.close();
  for(const page of ['journal','bag','settings','tide','meadow','sky','rest']){
   if(page==='rest')assert(o.openRest());else o.open(page);const p=o.popups.top();assert(p,'page '+page);settle(o);const b=bounds(p.body,w,h);
   assert(b.left>=8-1e-6&&b.right<=w-8+1e-6,'panel x '+page+' '+JSON.stringify([w,h,b]));assert(b.top>=-1e-6&&b.bottom<=h+1e-6,'panel y '+page+' '+JSON.stringify([w,h,b]));{const pw=['journal','tide','meadow','sky'].includes(page)?Math.min(330,Math.max(240,w-40))/Math.max(0.3,Math.min(w/750,h/1300,0.62)):680;assert(Math.abs(p.width-pw)<1e-6,'panel width '+page+' '+p.width+' (new-regions: journey/chapter min(330,W−40) pt; others 680)');}
   for(const n of p.body.children){if(n.name==='TitlePlank'||n.name==='Close'||n.name==='PanelFrame')continue;const lab=n.getComponent(Label);if(lab&&lab.overflow===Label.Overflow.NONE)continue;const r=n.getComponent(UITransform),x=n.position.x;assert(x-r.width*r.anchorX>=-p.width/2-1e-6&&x+r.width*(1-r.anchorX)<=p.width/2+1e-6,'child x '+page+'/'+n.name);}
   assert(p.root.getComponent(cc.BlockInputEvents),'popup blocks the island below');o.close();cases++;
  }
  const before=JSON.stringify(data);await H.flush(8);o.open('bag');const texts=o.popups.top().root.getComponentsInChildren(Label).map(l=>l.string);for(const t of ['风语铃','潮汐瓶','潮汐网','×2','×0','×3'])assert(texts.includes(t),'bag text '+t);assert(!texts.some(t=>/珍珠/.test(t)),'no pearl in the bag');
  if(w===390&&h===844){for(const n of ['tool_tidenet','tool_sunseed','tool_starshears'])assert(node(o,'BagPanel',n),'island bag '+n);assert(node(o,'BagPanel','ToolArt-windBell'),'island mainline stays on the atlas');assert(node(o,'BagPanel','ToolArt-tideBottle'));assert(!node(o,'BagPanel','tool_windbell'));}
  assert.equal(JSON.stringify(data),before);assert.equal(calls.length,0);o.dispose();o.dispose();
 }
 checks.push(cases+' lite popup pages fit 5 portrait/landscape viewports (width 680 design px; journey/chapter min(330,W−40) pt, BlockInputEvents); bag reads actual counts without writes, no pearl');
 {
  const {o,calls,gates}=setup();tap(o.buttons[1]);tap(node(o,'JourneyPanel','Chapter-tide'));assert.equal(top(o),'ChapterPanel');tap(node(o,'ChapterPanel','Continue-tide'));assert.deepEqual(calls,['invoke','region:tide']);assert(!o.isOpen());assert.deepEqual(o.popups.names(),[]);
  tap(o.buttons[1]);tap(node(o,'JourneyPanel','Chapter-meadow'));tap(node(o,'ChapterPanel','Continue-meadow'));assert(o.isOpen());assert.equal(calls.length,2,'closed gate: no dispatch');
  tap(node(o,'ChapterPanel','BackToChapters'));settle(o);assert.equal(top(o),'JourneyPanel','back returns to the chapter list');
  gates.r5.find(g=>g.region==='meadow').ok=true;tap(node(o,'JourneyPanel','Chapter-meadow'));tap(node(o,'ChapterPanel','Continue-meadow'));assert.deepEqual(calls.slice(-2),['invoke','region:meadow']);
  o.open('sky');tap(node(o,'ChapterPanel','VisitSkycity'));assert.deepEqual(calls.slice(-2),['invoke','skycity']);o.open('tide');tap(node(o,'ChapterPanel','LegacyTide'));assert.deepEqual(calls.slice(-2),['invoke','r4']);
  gates.r4=[{unlocked:false}];o.open('tide');tap(node(o,'ChapterPanel','LegacyTide'));assert.equal(calls.length,8,'legacy tide locked');o.close();
  assert(o.openRest());assert.equal(top(o),'RestPanel');assert(!o.openRest(),'one page at a time');tap(node(o,'RestPanel','DayNight'));settle(o);assert.deepEqual(calls.slice(-2),['invoke','dayNight']);assert(!o.isOpen());
  o.open('settings');assert.equal(top(o),'SettingsPanel');for(const n of ['MusicToggle','SfxToggle','VibrateToggle','NightToggle','ReducedMotion','AboutRow'])assert(node(o,'SettingsPanel',n),'full settings row '+n);assert(!node(o,'SettingsPanel','ReturnHome'),'settings no longer returns home (tap the lighthouse)');assert(!node(o,'SettingsPanel','DayNight'),'island rest moved to the cabin');o.dispose();
  assert(!calls.includes('invoke-while-open'),'every command closes the page before it runs');
  checks.push('journey book → chapter page → enter / gate recheck / back; skycity, legacy tide (locked when r4 closed), cabin rest day/night and full settings; each command closes the popup first');
 }
 {
  const {o,calls}=setup();o.open('journal');settle(o);const p=o.popups.top(),text=p.root.getComponentsInChildren(Label).map(l=>l.string);assert(text.some(t=>/^旅程 \d+ \/ 18$/.test(t)),'journey total = Σ stages of regions with data (12+6, no coast data in this build) '+text);assert(text.includes('4/4 ✓'),'tide cell stage count '+text);
  o.close();o.open('tide');{const tt=o.popups.top().root.getComponentsInChildren(Label).map(l=>l.string);assert(tt.includes('★ 12/12 · 挑战 2/4'),'region page keeps mainline stars x/12 and challenge marks x/4 '+tt);}o.close();
  assert.equal(CHAPTERS.find(c=>c.id==='tide').description,'听潮声，捡起海浪送来的贝壳。');o.open('tide');assert(o.popups.top().root.getComponentsInChildren(Label).some(l=>l.string==='听潮声，捡起海浪送来的贝壳。'));o.dispose();
  checks.push('journey book counts stages (Σ regions with data); region page keeps stars x/12 and challenge marks x/4; new tide-path description');
 }
 {
  const {o,calls}=setup();o.open('journal');const stale=node(o,'JourneyPanel','Chapter-sky');o.close();o.open('bag');tap(stale);assert.equal(top(o),'BagPanel');assert.equal(calls.length,0);
  const shade=o.popups.top().root.getChildByName('PopupShade');tap(shade);assert(o.isOpen(),'shade tap does not dismiss');tap(node(o,'BagPanel','Close'));settle(o);o.sync(390,844,true);assert(!o.isOpen(),'close button dismisses');assert(o.dockVisible()||o.dock.active);
  o.open('journal');o.sync(390,844,false);assert(!o.isOpen());tap(o.buttons[1]);assert(!o.isOpen(),'disabled overlay ignores the dock');o.sync(390,844,true);tap(o.buttons[1]);assert(o.isOpen());o.dispose();tap(stale);assert.equal(calls.length,0);
  checks.push('stale destroyed controls, shade taps, disable and repeated disposal cannot dispatch or reopen');
 }
 const report={status:'PASS',cases,checks,scope:'Actual IslandJourneyOverlay + board-ui IslandPanels/CommonPanels/PopupKit + WarmButton on memory-only Cocos doubles (tools/board-ui/harness.cjs). Native touch propagation and rendering are not covered. No storage writes or reward paths.'};
 const dir=path.resolve(__dirname,'../../evidence/cloud-ui');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'island-journal-tests.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
