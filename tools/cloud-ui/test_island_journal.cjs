'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const H=require('./harness.cjs')(),{Node,UITransform,Label,Graphics,cc,warm}=H;
const skin=H.evaluate(path.join(H.root,'ui/JourneyNavigationSkin.ts'),['applyJourneyNavigationSkin'],{warmButtonGraphics:warm.warmButtonGraphics});
// T9: overlay now imports the prop layout + IslandPropTaps (engine-free); evaluate the real sources and inject them.
const camPose=H.evaluate(path.join(H.root,'world-r1/CameraPose.ts'),['projectPoint','rotate']);
const propLayout=H.evaluate(path.join(H.root,'world-r2/IslandPropsLayout.ts'),['ISLAND_PROPS','propButtonLayout','propNightWeight','tagColorsAt','setPropNightWeight'],camPose);
const propTaps=H.evaluate(path.join(H.root,'world-r2/IslandPropTaps.ts'),['emitPropTap','onPropTap']);
class UIOpacity{constructor(){this.opacity=255;}}
const {IslandJourneyOverlay:Overlay}=H.evaluate(path.join(H.root,'world-r2/IslandJourneyOverlay.ts'),['IslandJourneyOverlay'],{warmButton:warm.warmButton,...skin,...propLayout,emitPropTap:propTaps.emitPropTap,UIOpacity});
const checks=[];let cases=0;
function setup(w=390,h=844){H.setup('mainline-v33',0,w,h);const parent=new Node('Canvas'),calls=[],data={journey:{inventory:{tools:{windBell:2,tideBottle:0,tideNet:1,sunSeed:3,starShears:1}}}},gates={r5:['tide','meadow','sky'].map(region=>({region,ok:region==='tide'})),r4:[{unlocked:true}]};const opts={invoke:fn=>{calls.push('invoke');return fn()},mainlineStatus:()=>data,gates:()=>gates,enterRegion:id=>calls.push('region:'+id),enterR4:()=>calls.push('r4'),enterSkycity:()=>calls.push('skycity'),returnHome:()=>calls.push('home'),toggleDayNight:()=>calls.push('dayNight'),dayNight:()=>({mode:'day'})};const o=new Overlay(parent,opts);o.sync(w,h,true);return{o,parent,calls,data,gates};}
{const parent=new Node('disabled-parent'),o=new Overlay(parent,{});o.sync(390,844,false);o.sync(390,844,true);assert.equal(o.buttons[0].position.x,-100);o.sync(320,568,false);o.sync(320,568,true);assert(o.buttons[0].position.x<0);o.dispose();checks.push('initial disabled and resized-while-disabled overlays lay out correctly on enabling');}
const tap=n=>H.tapNode(n),button=(o,name)=>o.panel.getChildByName(name);
for(const [w,h] of [[320,568],[390,844],[402,874],[568,320],[844,390]]){
 const {o,calls,data}=setup(w,h);assert.equal(o.isOpen(),false);assert.deepEqual(o.dock.children.map(n=>n.name),['Island-bag','Island-journal','Island-settings']);assert.equal(o.modal.active,false);assert.equal(o.panel.children.length,0);
 for(const b of o.buttons){const t=b.getComponent(UITransform);assert.equal(t.width,64);assert.equal(t.height,64);const y=b.position.y;assert(y-32>=-h/2+(w<h?34:20));}
 tap(o.buttons[1]);assert(o.isOpen());assert.equal(o.dock.active,false);assert(button(o,'Chapter-tide'));assert(!button(o,'Continue-tide'),'no gameplay action on chapter list');
 for(const page of ['journal','bag','settings','tide','meadow','sky']){o.open(page);const t=o.panel.getComponent(UITransform),cy=o.panel.position.y;assert(t.width/2<=w/2-16);assert(cy-t.height/2>=-h/2+20);assert(cy+t.height/2<=h/2-12);
  for(const n of o.panel.children){const r=n.getComponent(UITransform),x=n.position.x,y=n.position.y;assert(x-r.width/2>=-t.width/2&&x+r.width/2<=t.width/2,'child x '+n.name);assert(y-r.height/2>=-t.height/2&&y+r.height/2<=t.height/2,'child y '+page+'/'+n.name);}
  cases++;
 }
 const before=JSON.stringify(data);o.open('bag');assert(o.panel.getComponentsInChildren(Label).some(l=>l.string==='风语铃    × 2'));assert(o.panel.getComponentsInChildren(Label).some(l=>l.string==='潮汐瓶    × 0'));assert.equal(JSON.stringify(data),before);assert.equal(calls.length,0);o.dispose();o.dispose();
}
checks.push(cases+' modal layouts plus 5 compact docks fit supported portrait/landscape bounds; bag reads actual counts without writes');
{
 const {o,calls,gates}=setup();tap(o.buttons[1]);tap(button(o,'Chapter-tide'));assert.equal(o.page,'tide');tap(button(o,'Continue-tide'));assert.deepEqual(calls,['invoke','region:tide']);assert(!o.isOpen());
 tap(o.buttons[1]);tap(button(o,'Chapter-meadow'));tap(button(o,'Continue-meadow'));assert(o.isOpen());assert.equal(calls.length,2);gates.r5.find(g=>g.region==='meadow').ok=true;tap(button(o,'Continue-meadow'));assert.deepEqual(calls.slice(-2),['invoke','region:meadow']);
 o.open('sky');tap(button(o,'VisitSkycity'));assert.deepEqual(calls.slice(-2),['invoke','skycity']);o.open('tide');tap(button(o,'LegacyTide'));assert.deepEqual(calls.slice(-2),['invoke','r4']);
 o.open('settings');tap(button(o,'DayNight'));assert.deepEqual(calls.slice(-2),['invoke','dayNight']);assert(!button(o,'ReturnHome'),'T1 l123: settings no longer offers a return-home button (tap the lighthouse)');o.dispose();
 checks.push('chapter detail, regional gate recheck, skycity, legacy tide, day/night and home route only via supplied invoke; each command closes modal first');
}
{
 const {o,calls}=setup();o.open('journal');const stale=button(o,'Chapter-sky');o.open('bag');tap(stale);assert.equal(o.page,'bag');assert.equal(calls.length,0);const outside=H.event({x:8,y:8},7);o.shade.emit('start',outside);o.shade.emit('end',H.event({x:8,y:8},8));assert(o.isOpen());o.shade.emit('end',outside);assert(!o.isOpen());
 o.open('journal');o.shade.emit('start',outside);o.shade.emit('move',H.event({x:80,y:8},7));o.shade.emit('end',outside);assert(o.isOpen(),'drag-back cannot dismiss');o.sync(390,844,false);assert(!o.isOpen());o.shade.emit('end',outside);tap(o.buttons[1]);assert(!o.isOpen());o.sync(390,844,true);tap(o.buttons[1]);assert(o.isOpen());o.dispose();tap(stale);assert.equal(calls.length,0);
 checks.push('stale destroyed controls, captured different pointer, drag-back, disable/late end and repeated disposal cannot dispatch or reopen');
}
const report={status:'PASS',cases,checks,scope:'Actual IslandJourneyOverlay and WarmButton methods with memory-only Cocos event/layout doubles; engine propagation and native touch need Mac Sol. No storage writes or reward paths.'};fs.writeFileSync(path.resolve(__dirname,'../../evidence/cloud-ui/island-journal-tests.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
