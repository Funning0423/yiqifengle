'use strict';
// Runs real integrated UI + WarmButton + AudioBridge methods, with the same Cocos doubles as UI tests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const {setup,tapNode,drag,event,point,root,cc,Node,warm,UI}=require('./test_tool_switch_ui.cjs');
Node.prototype.targetOff=function(target){for(const[k,a]of this.events)this.events.set(k,a.filter(([,t])=>t!==target));};
let scene=null,buttons=0,toolTaps=0;
const GameAudio={instance:{onButton(){buttons++;},onToolTap(){toolTaps++;}}};
const source=fs.readFileSync(path.join(root,'audio/AudioBridge.ts'),'utf8').split('// Mount once')[0].replace(/^import .*;\n/gm,'').replace(/^@ccclass.*\n/gm,'').replace(/export /g,'');
const vars={...cc,...warm,GameAudio,ManagedMobileBoardUI:UI,director:{getScene:()=>scene}};
const Bridge=new Function(...Object.keys(vars),stripTypeScriptTypes(source,{mode:'transform'})+';return AudioBridge;')(...Object.values(vars));
function connect(u){scene=u.node;const b=new Bridge;b.board=u;b.scanButtons();b.scanButtons();return b;}
const checks=[];
{
 const {u,s,ready}=setup();const b=connect(u);const before=buttons;
 tapNode(u.tools[1]);tapNode(u.tools[2]);tapNode(u.tools[2]);assert.equal(buttons-before,3,'select, switch, cancel each sound once');assert.equal(toolTaps,0,'slot-N uses validated onButton without a second state gate');
 tapNode(u.tools[3]);s.journey.inventory.tools.windBell=0;u.render(s);tapNode(u.tools[1]);assert.equal(buttons-before,3,'unavailable pearl and depleted tool stay silent');
 u.bagOpen=true;tapNode(u.tools[2]);u.bagOpen=false;s.readOnly=true;u.render(s);tapNode(u.tools[2]);assert.equal(buttons-before,3,'modal and read-only stay silent');b.onDestroy();
 checks.push('local UI + WarmButton ACTIVATED + actual AudioBridge: valid selection/switch/cancel once; pearl/empty/modal/read-only silent');
}
{
 for(const region of [0,2]){const {u}=setup('regional-r05',region);const b=connect(u),before=buttons;tapNode(u.tools[0]);assert.equal(u.calls.length,1);assert.equal(u.hostPresentation().state,'run.resolving');assert.equal(buttons-before,1,'targetless action accepted before render-state change must still sound once');tapNode(u.tools[0]);assert.equal(buttons-before,1);b.onDestroy();}
 checks.push('R5 targetless tideAnchor/prismShift each dispatch and sound once after transition to resolving; repeat input rejected');
}
{
 const {u,ready}=setup();const b=connect(u),before=buttons;drag(u,1,24);assert.equal(u.calls.length,1);assert.equal(buttons,before,'drag is gameplay use, not a button click');ready();
 drag(u,2,{x:-100,y:-100});drag(u,2,24,{cancel:true});assert.equal(u.calls.length,1);assert.equal(buttons,before);
 const n=u.tools[1],start=point(n),target=point(u.cells[24]);n.emit('start',event(start,77));n.emit('move',event(target,77));u.host.hide();u.host.show();n.emit('end',event(target,77));assert.equal(u.calls.length,1);assert.equal(buttons,before);b.onDestroy();
 checks.push('successful drag, outside/cancel and hide/show stale release never emit click audio or duplicate dispatch');
}
{
 const {u}=setup();const b=connect(u),before=buttons;b.onDestroy();tapNode(u.tools[1]);assert.equal(buttons,before,'destroy removes all tagged listeners');const newer=connect(u);tapNode(u.tools[2]);assert.equal(buttons-before,1,'new bridge can retag without duplicate audio');newer.onDestroy();
 checks.push('AudioBridge disposal removes tags/listeners; fresh bridge retags local tools exactly once');
}
console.log(JSON.stringify({status:'PASS',checks:checks.length,results:checks,scope:'Real integrated methods with Cocos event doubles; no audible/device acceptance'},null,2));
