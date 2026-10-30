'use strict';
/* coast-kit-wiring (coast-kit-int): ManagedMobileBoardUI kit branch. OFF without ?qfcoastkit=1 even on a coast board (2D tray, grid
 * cellAt). ON (test mode): cells on the projected slab centres (≤ 0.01 pt), scaled by perspective, tray + tile bases hidden,
 * cellAt = nearest projected centre (every centre and ±8 pt jitter resolve to their tile), fallback = 0, no camera writes. */
const assert=require('node:assert/strict');const {createHarness}=require('./harness.cjs'),{createBoard,snapshot}=require('./board-fixture.cjs');
async function mk(on,w,h){const H=createHarness();if(on)globalThis.location={search:'?qfcoastkit=1'};else delete globalThis.location;
 const s=snapshot('regional-r05',1);s.active.region='coast';const b=createBoard({harness:H,provider:'regional-r05',snapshot:s,width:w,height:h});await H.flush();b.render();b.u.update(0);return {H,b};}
(async()=>{
 {const {b}=await mk(false,390,844);assert.equal(b.u.boardFrame.getChildByName('Tray').active,true,'off: tray shown');assert.equal(b.u.kitGridCache,null,'off: no kit grid');}
 for(const [w,h] of [[390,844],[320,568],[390,520],[768,1024]]){const {H,b}=await mk(true,w,h),u=b.u,K=H.load('ui/BoardKit'),B=H.load('ui/BoardProjection');
  assert.ok(u.kitGridCache&&u.kitGridCache.projected,w+'x'+h+' projected');assert.equal(u.boardFrame.getChildByName('Tray').active,false,'tray hidden');
  const pb=B.projectBoard(K.COAST_KIT,w,h),g=u.geo;let bad=0;
  for(let i=0;i<49;i++){const n=u.cells[i],c=pb.centers[i];assert.ok(Math.abs(n.position.x-(c.x-g.grid.x))<0.01&&Math.abs(n.position.y-(g.grid.y-c.y))<0.01,'cell on slab');
   assert.equal(u.bases[i].node.active,false,'tile base hidden');for(let k=0;k<20;k++){const x=c.x+(Math.sin(i*7+k)*8),y=c.y+(Math.cos(i*3+k*5)*8);if(u.cellAt(x,y,true)!==i||u.cellAt(x,h-y,false)!==i)bad++;}}
  assert.equal(bad,0,w+'x'+h+' taps');assert.ok(u.cells[3].scale.x<u.cells[45].scale.x,'perspective: far smaller');
  console.log(`ok   ${w}x${h}: 49 cells on the projected slabs, far scale ${u.cells[3].scale.x.toFixed(3)} < near ${u.cells[45].scale.x.toFixed(3)}, tray/bases hidden, 1960 taps 0 wrong`);}
 delete globalThis.location;const fb=(globalThis.__qfBoardKitFallback||{count:0}).count;assert.equal(fb,0,'fallback');
 console.log('coast-kit-wiring: PASS');
})().catch(e=>{console.error('FAIL',e&&e.stack||e);process.exit(1);});
