'use strict';
/* compact-hud-render (coast-kit-int): ManagedMobileBoardUI draws the compact HUD exactly at CompactHud.compactHudLayout, only with the
 * coast kit on (?qfcoastkit=1, coast board) AND portrait logical h ≤ 600. Checked on 320×568 / 390×520 (day + night):
 *  goal bar 95–131 (±0.5), title row hidden, level pill in the capsule row x ≥ 70, 13 pt, truncated name (320: 「灯塔下的潮汐小路」→「05 · 灯塔下的潮汐…」),
 *  hint pill 36 high at y 49–85, 12 pt, real copy on 2 lines (320) / 1 line (390), label faded out under it; tools tap 52, step 64, centre y h−max(safe.bottom,12)−34,
 *  hit top = h − 94 limit; nothing of the HUD inside the board band [131, h−94] except nothing; night moves [0,22,26], hourglass opaque.
 * Kit on at 390×844 (h > 600): no compact HUD. Kit off: covered by board-kit-default-path (0 differences). */
const assert=require('node:assert/strict');const {createHarness}=require('./harness.cjs'),{createBoard,snapshot}=require('./board-fixture.cjs');
async function mk(w,h,name){const H=createHarness();globalThis.location={search:'?qfcoastkit=1'};const s=snapshot('regional-r05',1);s.active.region='coast';s.active.level=4;s.active.name=name;
 const b=createBoard({harness:H,provider:'regional-r05',snapshot:s,width:w,height:h});await H.flush();b.render();b.u.update(0);return {H,b};}
const near=(a,b,t=0.51)=>Math.abs(a-b)<=t;
(async()=>{
 for(const [w,h] of [[320,568],[390,520]]){const {H,b}=await mk(w,h,'灯塔下的潮汐小路'),u=b.u,CH=H.load('ui/CompactHud'),c=u.compactHud;assert.ok(c,w+'x'+h+' compact on');
  const L=CH.compactHudLayout(w,h,H.load('ui/BoardLayout').boardSafeInsets(w,h));assert.deepEqual(JSON.parse(JSON.stringify({...c,goalBar:0})),JSON.parse(JSON.stringify({...L,goalBar:0})),'layout = CompactHud');
  const yTop=n=>h/2-n.worldPosition.y,ps=u.plate.scale.y,pt=u.plateSprite.node.getComponent(H.cc.UITransform),pc=yTop(u.plate);
  assert.ok(near(pc-pt.height*ps/2,95)&&near(pc+pt.height*ps/2,131),`goal bar ${pc-pt.height*ps/2}–${pc+pt.height*ps/2}`);assert.equal(u.titleLabel.node.active,false,'title row hidden');
  const lab=u.compactLabel,lt=lab.getComponent(H.cc.UITransform),txt=lab.getChildByName('Text').getComponent(H.cc.Label);
  assert.equal(txt.string,w===320?'05 · 灯塔下的潮汐…':'05 · 灯塔下的潮汐小路');assert.equal(txt.fontSize,13);const lx=lab.worldPosition.x+w/2-lt.width/2;assert.ok(near(lx,70),'label x '+lx);assert.ok(near(yTop(lab),c.rowY),'label in capsule row');assert.ok(lt.width<=c.label.maxWidth+1e-9);
  u.say('拖动相邻两颗，三颗一样就消除');u.update(0.2);const tt=u.toast.getComponent(H.cc.UITransform),ty=yTop(u.toast);assert.ok(near(ty-tt.height/2,49)&&near(ty+tt.height/2,85),'hint 49–85');assert.equal(tt.height,36);
  assert.equal(u.toastLabel.fontSize,12);assert.equal(u.toastLabel.string.split('\n').length,w===320?2:1);assert.equal(tt.width,w===320?104:188);assert.ok(lab.getComponent(H.cc.UIOpacity).opacity<=10,'label faded under the hint');
  const act=u.tools.filter(n=>n.active);assert.ok(act.length>=1);act.forEach((n,i)=>{const t=n.getComponent(H.cc.UITransform);assert.equal(t.width,52);assert.ok(near(yTop(n),c.tools.y));assert.ok(near(yTop(n)-26,h-94),'tool tap top = h−94');if(i)assert.ok(near(n.worldPosition.x-act[i-1].worldPosition.x,64),'step 64');
   const art=n.getChildByName('Face').getChildByName('OriginalToolArt').getComponent(H.cc.UITransform);assert.ok(near(Math.max(art.width,art.height),48),'icon 48');});
  for(const n of [u.plate,lab,u.toast])assert.ok(yTop(n)<131,'HUD element in the board band');
  u.tint.update=()=>{};u.tint.night=1;u.update(0);assert.deepEqual([u.moves.color.r,u.moves.color.g,u.moves.color.b],[0,22,26],'night moves cyan');assert.equal(u.movesIcon.color.a,255,'hourglass opaque');
  console.log(`ok   ${w}x${h}: goal bar 95–131, pill 「${txt.string}」 13 pt at x 70, hint ${u.toastLabel.string.replace('\n','/')} ${tt.width}×36 at 49–85, ${act.length} tools 52/64 at y ${c.tools.y}, night moves [0,22,26]`);}
 {const {b}=await mk(390,844,'灯塔');assert.equal(b.u.compactHud,null,'390x844 keeps the normal HUD');assert.equal(b.u.titleLabel.node.active,true);}
 delete globalThis.location;assert.equal((globalThis.__qfBoardKitFallback||{count:0}).count,0);
 console.log('compact-hud-render: PASS');
})().catch(e=>{console.error('FAIL',e&&e.stack||e);process.exit(1);});
