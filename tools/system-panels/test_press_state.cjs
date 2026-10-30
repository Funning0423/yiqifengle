'use strict';
// U3 press state (UI设计部 0d7b1729 review): pressed look on the SAME frame as touch-start (0 updates, ≤100 ms); release
// fires the action at once; an action that closes the popup does not wait for the 120 ms spring (close starts this frame,
// face back at rest). Also checks the update popup pinwheel uses the SPEC sizes/colours. Real PopupKit/CommonPanels on doubles.
const assert=require('node:assert/strict');
const X=require('../cloud-ui/harness.cjs')(),{H,cc,Node}=X;
const {PopupStack}=X.evaluate('ui/PopupKit.ts',['PopupStack']),{openUpdate,PINWHEEL}=X.evaluate('ui/CommonPanels.ts',['openUpdate','PINWHEEL']);
const M=X.evaluate('ui/PopupMotion.ts',['PRESS_SCALE','PRESS_SINK','RELEASE_S']);
(async()=>{
  H.setViewport(390,844);await X.flush(6);
  const parent=new Node('Canvas'),stack=new PopupStack(parent,()=>({width:390,height:844}));let applied=0,later=0;
  const p=openUpdate(stack,()=>applied++,()=>later++);for(let i=0;i<20;i++)stack.update(1/30);
  const btn=p.root.find('ApplyUpdate'),face=btn.getChildByName('Face'),y0=face.position.y,s0=face.scale.x;
  const e=X.event(X.point(btn),3);btn.emit(cc.Node.EventType.TOUCH_START,e);
  assert.ok(Math.abs(face.scale.x-s0*M.PRESS_SCALE)<1e-9,'pressed scale on the touch-start frame (no update ran)');
  assert.ok(Math.abs(face.position.y-(y0-M.PRESS_SINK))<1e-9,'pressed sink on the touch-start frame');
  btn.emit(cc.Node.EventType.TOUCH_END,e);
  assert.equal(p.isClosing,true,'close starts on release, not after the spring');
  assert.equal(face.scale.x,s0,'closing popup: face settles at rest immediately');assert.equal(face.position.y,y0);
  assert.ok(!H.cc._tweens.some(t=>t.target===face),'no spring tween left running on the closing popup');
  for(let i=0;i<6;i++)stack.update(1/30);assert.equal(applied,1,'applyUpdate after the 180 ms exit only');
  // a press that does not close (stays open): spring-back tween over RELEASE_S
  const p2=openUpdate(stack,()=>{},()=>{});for(let i=0;i<20;i++)stack.update(1/30);
  const b2=p2.root.find('ApplyUpdate'),f2=b2.getChildByName('Face'),e2=X.event(X.point(b2),4);
  b2.emit(cc.Node.EventType.TOUCH_START,e2);b2.emit(cc.Node.EventType.TOUCH_MOVE,X.event({x:-9999,y:-9999},4));
  assert.ok(H.cc._tweens.some(t=>t.target===f2),'leaving the button springs back with a tween');
  // pinwheel SPEC §3
  assert.deepEqual({...PINWHEEL},{r:54,glowR:88,glowBlur:23,hubR:7.7,revPerS:0.5});
  console.log('PASS press-state (same-frame press, close does not wait for spring) + pinwheel spec');
})().catch(e=>{console.error(e);process.exit(1);});
