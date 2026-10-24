'use strict';
// b17r14 guard (Mac r13b #6/#7): on the island, free explore is open (hasChar/hasCam/exploring, lens=MapExplore) but real
// taps on the grass never reached RegionNodeStage.onGesture. IslandLighthouseTouch is a full-screen (390x844) node-level
// TOUCH_* listener: Cocos hands the touch to it and swallows it, so the global `input` listeners in ExploreInput never fire.
// Fix: while explore is active, presses that miss the lighthouse/cabin are forwarded to ExploreInput (feedStart/Move/End);
// lighthouse/cabin presses still return home / open the cabin; the global path never double-fires a forwarded press.
const assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('../board-ui/harness.cjs');const H=createHarness();
const S=p=>path.join(H.SCRIPTS,p);
const {IslandHomeInteraction}=H.load(S('world-r2/IslandHomeInteraction.ts'));
const EI=H.load(S('world-r2/ExploreInput.ts'));
const Gate=H.load(S('region/ExploreGate.ts'));
const canvas=new H.cc.Node('WorldNavigationCanvas');
const owner=new H.cc.Node('IsolatedWorldComposition');const ex=owner.addComponent(EI.ExploreInput);ex.onEnable?.();
const got=[];ex.sink=(g,x,y)=>got.push([g,Math.round(x),Math.round(y)]);
let home=0;const lighthouse={x:200,y:600};
const ih=new IslandHomeInteraction(canvas,{canUse:()=>true,hit:(x,y)=>Math.hypot(x-lighthouse.x,y-lighthouse.y)<30,returnHome:()=>{home++;},
 explore:()=>typeof ex.active==='function'?ex:null});
ih.sync(390,844,true);
const root=canvas.getChildByName('IslandLighthouseTouch');assert.ok(root&&root.active,'lighthouse surface is up on the island');
let all=[];
const ev=(id,x,y)=>({getID:()=>id,getUILocation:o=>{const p={x,y};if(o){o.x=x;o.y=y;return o;}return p;},getLocation:o=>{if(o){o.x=x;o.y=y;return o;}return {x,y};},getAllTouches:()=>all.map(i=>({getID:()=>i})),getTouches:()=>all.map(i=>({getID:()=>i}))});
// Cocos order: node (UI) dispatcher first; the full-screen node claims the touch, so the global `input` never emits it.
const press=(x,y)=>{all=[1];root.emit('touch-start',ev(1,x,y));all=[];root.emit('touch-end',ev(1,x,y));};
Gate.setExploreEnabled(true);
press(300,369);
assert.deepEqual(got,[['tap',300,369]],'a grass tap on the island reaches the explore sink (onGesture → groundTap)');
assert.equal(home,0,'grass tap does not return home');
// the lighthouse still owns its own taps
got.length=0;press(lighthouse.x,lighthouse.y);
return Promise.resolve().then(()=>{
 assert.equal(home,1,'lighthouse tap still returns home');assert.deepEqual(got,[],'lighthouse tap is not also a ground tap');
 // no double fire if the global input does see a forwarded press (e.g. preventSwallow on some platform)
 got.length=0;all=[1];const s=ev(1,120,300);root.emit('touch-start',s);H.cc.input.emit('touch-start',s);all=[];root.emit('touch-end',ev(1,120,300));ex.onEnd?.call?ex['onEnd']():0;
 assert.equal(got.length,1,'forwarded press fires once');
 // board open: explore off → nothing forwarded, lighthouse surface keeps its old behaviour
 got.length=0;Gate.setExploreEnabled(false);press(300,369);assert.deepEqual(got,[],'no world gesture while the board owns input');
 const boot=require('node:fs').readFileSync(S('WorldIntegrationBoot.ts'),'utf8');assert.match(boot,/new IslandHomeInteraction\([^;]*explore:\(\)=>this\.composition\?\.exploreFeed/,'Boot wires the explore feed');
 ih.dispose();console.log('island-explore-touch: ok');
}).catch(e=>{console.error(e);process.exit(1);});
