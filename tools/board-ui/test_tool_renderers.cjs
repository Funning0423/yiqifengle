'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createHarness}=require('./harness.cjs'),{createBoard}=require('./board-fixture.cjs');
const source=process.env.QF_BOARD_UI_SOURCE||path.resolve(__dirname,'../../creator-build-project/assets/scripts/ManagedMobileBoardUI.ts');
const checks=[];
function harness(){
 const H=createHarness(),warnings=[],registered=new WeakMap(),add=H.cc.Node.prototype.addComponent;
 const renderable=c=>c instanceof H.cc.Sprite||c instanceof H.cc.Graphics||c instanceof H.cc.Label;
 // Shipped Creator 3.8.8 NodeUIProperties.uiComp warns and retains the first renderer.
 // The second component still exists/getComponent succeeds, but Batcher2D never visits it.
 H.cc.Node.prototype.addComponent=function(Type){const c=add.call(this,Type);if(renderable(c)){if(registered.has(this))warnings.push({node:this.name,first:registered.get(this).constructor.name,rejected:c.constructor.name});else registered.set(this,c);}return c;};
 if(process.env.QF_BOARD_UI_SOURCE){
  const load=H.load;let ui;
  H.load=file=>{if(file!=='ManagedMobileBoardUI')return load(file);if(ui)return ui;
   const out=H.ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:H.ts.ModuleKind.CommonJS,target:H.ts.ScriptTarget.ES2019,experimentalDecorators:true,esModuleInterop:true}}).outputText;
   const m={exports:{}};const req=spec=>spec==='cc'?H.cc:spec.endsWith('.js')?require(path.resolve(H.SCRIPTS,spec)):load(spec.replace(/^\.\//,''));
   new Function('exports','require','module',out)(m.exports,req,m);return ui=m.exports;};
 }
 H.cc.sys.localStorage.setItem('qfl.ui.seenTools',JSON.stringify(['starlight','windbell','tidebottle']));
 function assertTree(root){assert.deepEqual(warnings,[],'Creator would reject duplicate renderers');root.walk(n=>{const rs=n.components.filter(renderable);assert(rs.length<=1,'Multiple renderers: '+n.name);if(rs.length)assert.equal(registered.get(n),rs[0]);});}
 function drawn(graphics){return graphics.node.activeInHierarchy&&graphics.enabled&&registered.get(graphics.node)===graphics&&graphics.ops.some(op=>op[0]==='fill'||op[0]==='stroke');}
 return Object.assign(H,{warnings,registered,assertTree,drawn});
}
async function board(options={}){const H=harness(),b=createBoard({harness:H,...options});await H.flush();b.render();b.u.update(0);return b;}
function art(b){const node=b.u.tools[0].find('OriginalToolArt');return {node,sprite:node.getComponent(b.H.cc.Sprite),fallback:node.find('ToolFallback')?.getComponent(b.H.cc.Graphics)};}
function startDrag(b,id=31){const H=b.H,n=b.u.tools[0],start=H.point(n),end=H.point(b.u.cells[24]),E=H.cc.Node.EventType;n.emit(E.TOUCH_START,H.event(start,id));n.emit(E.TOUCH_MOVE,H.event(end,id));b.u.update(1/60);return {n,end,id,E};}
async function test(name,run){await run();checks.push(name);}
(async()=>{
 await test('renderer boundary retains Sprite and rejects same-node Graphics despite getComponent returning both',async()=>{
  const H=harness(),n=new H.cc.Node('boundary-probe'),sprite=n.addComponent(H.cc.Sprite),graphics=n.addComponent(H.cc.Graphics);graphics.circle(0,0,5);graphics.fill();
  assert.equal(H.registered.get(n),sprite);assert.equal(n.getComponent(H.cc.Graphics),graphics);assert.equal(H.drawn(graphics),false);assert.equal(H.warnings.length,1);n.destroy();
 });
 await test('normal atlas tools keep their Sprite and disable the separate fallback; drag remains textured',async()=>{
  const b=await board();try{
   b.H.assertTree(b.u.root);const a=art(b);assert(a.sprite.spriteFrame);assert.equal(a.fallback.node.parent,a.node);assert.equal(a.fallback.node.active,false);assert.equal(a.fallback.ops.length,0);
   const drag=startDrag(b),ghost=b.u.root.find('ToolDragGhost');assert(ghost.activeInHierarchy);assert.equal(ghost.getComponent(b.H.cc.Sprite).spriteFrame,a.sprite.spriteFrame);assert.equal(ghost.find('ToolFallback').active,false);
   drag.n.emit(drag.E.TOUCH_CANCEL,b.H.event(drag.end,drag.id,'cancel'));assert.equal(ghost.active,false);assert.equal(b.log.tools.length,0);b.H.assertTree(b.u.root);
  }finally{b.u.onDestroy();}
 });
 for(const [region,kind]of [[0,'tideAnchor'],[2,'prismShift']]){
  await test(kind+': no-frame tray and drag ghost each submit their own vector renderer; cancel and drop keep ownership',async()=>{
   const b=await board({provider:'regional-r05',region});try{
    b.H.assertTree(b.u.root);const a=art(b);assert.equal(a.sprite.spriteFrame,null);assert(a.fallback,'A separate fallback exists');assert(b.H.drawn(a.fallback));
    assert.equal(a.fallback.node.parent,a.node);assert.equal(a.fallback.node.position.x,0);assert.equal(a.fallback.node.position.y,0);
    const bounds=a.node.getComponent(b.H.cc.UITransform),fallbackBounds=a.fallback.node.getComponent(b.H.cc.UITransform);assert.equal(bounds.width,fallbackBounds.width);assert.equal(bounds.height,fallbackBounds.height);
    assert.equal(b.u.tools[0].find('Quantity').getComponent(b.H.cc.Label).string,'1');
    const drag=startDrag(b),ghost=b.u.root.find('ToolDragGhost'),fallback=ghost.find('ToolFallback').getComponent(b.H.cc.Graphics);
    assert(b.H.drawn(b.u.tools[0].find('ToolSelection').getComponent(b.H.cc.Graphics)));
    assert.equal(ghost.getComponent(b.H.cc.Sprite).spriteFrame,null);assert(b.H.drawn(fallback));assert.equal(fallback.node.parent,ghost);
    const pointer=b.H.point(ghost);assert(Math.abs(pointer.x-drag.end.x)<1e-6);assert(Math.abs(pointer.y-drag.end.y)<1e-6);
    const pos={...ghost.worldPosition};drag.n.emit(drag.E.TOUCH_MOVE,b.H.event({x:1,y:1},drag.id+1));assert.deepEqual({...ghost.worldPosition},pos);
    drag.n.emit(drag.E.TOUCH_CANCEL,b.H.event(drag.end,drag.id,'cancel'));assert.equal(ghost.active,false);assert.equal(b.log.tools.length,0);assert.equal(b.s.active.tool.charges,1);
    const retry=startDrag(b,32);assert.equal(b.u.root.find('ToolDragGhost'),ghost,'Reuse the owned ghost');retry.n.emit(retry.E.TOUCH_END,b.H.event(retry.end,retry.id));
    assert.deepEqual(b.log.tools,[[kind,24]]);assert.equal(b.s.active.tool.charges,0);assert.equal(ghost.active,false);b.H.assertTree(b.u.root);
   }finally{b.u.onDestroy();}
  });
  await test(kind+': unavailable fallback stays visible and muted without accepting a touch',async()=>{
   const b=await board({provider:'regional-r05',region});try{
    b.s.active.tool.charges=0;b.render();const a=art(b);assert(b.H.drawn(a.fallback));assert.equal(a.node.getComponent(b.H.cc.UIOpacity).opacity,140);assert.equal(a.sprite.grayscale,true);
    assert.equal(b.u.tools[0].find('Quantity').getComponent(b.H.cc.Label).string,'+');b.H.tap(b.u.tools[0]);assert.equal(b.u.armedTool,null);assert.equal(b.log.tools.length,0);
    b.H.assertTree(b.u.root);
   }finally{b.u.onDestroy();}
  });
 }
 console.log(JSON.stringify({status:'PASS',checks:checks.length,results:checks,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),scope:'Actual ManagedMobileBoardUI and bundled art dimensions; Cocos single-renderer registration and input boundaries modeled in memory. No browser, GPU visibility, official storage, or device acceptance.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
