'use strict';
// Cocos 3.8.8 child-first destruction and CCObject field clearing, modeled on
// cocos/scene-graph/node.ts _onPreDestroyBase and core/data/object.ts _destruct.
// Actual UI TS; this is a regression model, not an engine/device run.
const assert=require('node:assert/strict');
const {createHarness}=require('./harness.cjs'),{createBoard}=require('./board-fixture.cjs');
(async()=>{const checks=[];
for(const mode of ['idle','piece-drag','tool-drag','pause-pressed','home-pressed','settings-slider']){
 const H=createHarness();H.cc.sys.localStorage.setItem('qfl.ui.seenTools','["starlight","windbell","tidebottle"]');const b=createBoard({harness:H});await H.flush();b.render();b.u.update(0);
 const start=n=>n.emit('touch-start',H.event(H.point(n),7));
 if(mode==='piece-drag'){start(b.u.cells[23]);b.u.cells[23].emit('touch-move',H.event(H.point(b.u.cells[24]),7));}
 if(mode==='tool-drag'){start(b.u.tools[0]);b.u.tools[0].emit('touch-move',H.event(H.point(b.u.cells[0]),7));}
 if(mode==='pause-pressed')start(b.u.pause);
 if(mode==='home-pressed'){H.tap(b.u.pause);start(b.u.popups.find('PausePanel').root.find('Home'));}
 if(mode==='settings-slider'){H.tap(b.u.pause);H.tap(b.u.popups.find('PausePanel').root.find('Tile-设置'));}
 const owner=b.u.node,old=H.cc.Node.prototype.destroy;
 H.cc.Node.prototype.destroy=function(){if(!this.isValid)return;this.active=false;for(const n of [...this.children])n.destroy();for(const c of [...this.components]){c.onDestroy?.();for(const k of Object.keys(c)){if(typeof c[k]==='object'||typeof c[k]==='function')c[k]=null;}}this.isValid=false;this.children=null;this.components=null;this.position=null;this._ev=null;};
 try{assert.doesNotThrow(()=>owner.destroy());assert.equal(H.cc.game.listeners('hide'),0);assert.equal(H.cc.game.listeners('show'),0);assert.doesNotThrow(()=>H.cc.game.emit('hide'));assert.doesNotThrow(()=>owner.destroy());checks.push({mode,hideListeners:0,lateHideSafe:true});}finally{H.cc.Node.prototype.destroy=old;}
}
console.log(JSON.stringify({status:'PASS',scope:'Actual UI TS with child-first/null-field lifecycle double, no Cocos engine',checks},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
