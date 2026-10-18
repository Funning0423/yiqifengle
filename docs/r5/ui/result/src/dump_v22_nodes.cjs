'use strict';
const path=require('path'),fs=require('fs');
const ROOT='/workspace/yiqifengle/work/棋盘UI美术bot';
const { createHarness } = require(ROOT+'/tools/board-ui/harness.cjs');
(async()=>{
  const H=createHarness(),A=H.load('ui/BoardArt'),K=H.load('ui/PopupKit'),P=H.load('ui/BoardPanels');
  await Promise.all(['board','popup','r2'].map(d=>A.BoardArt.shared().load(d)));
  const out={};
  const HOST=w=>({top:47,bottom:34,left:0,right:0,capsule:{top:51,bottom:87,left:w-93,right:w-6}});
  const HOST_SE=w=>({top:20,bottom:34,left:0,right:0,capsule:{top:26,bottom:58,left:w-93,right:w-6}}); // 375x667 row of tools/board-ui/test_board_hint_above_tray.cjs
  for (const [w,h,host] of [[390,844,HOST],[375,667,HOST_SE]]) for (const state of ['ready','claimed']) for (const kind of ['win','lose']) {
    if (kind==='lose'&&state==='claimed') continue;
    const owner=new H.cc.Node('Probe'); H.cc._scene.addChild(owner);
    H.state.viewport={width:w,height:h,safeInsets:host(w)};
    const stack=new K.PopupStack(owner,()=>H.state.viewport);
    const model={kind,score:kind==='win'?630:0,stars:kind==='win'?3:null,movesUsed:11,movesLeft:kind==='win'?11:0,goalsLeft:kind==='lose'?[{art:'board/piece_strawberry',count:3}]:[],chestHint:false,unlockHint:kind==='win'?'主线 05 · 潮汐挑战已开放':undefined,
      next:()=>{},home:()=>{},replay:kind==='lose'?()=>{}:null,
      rewards:kind==='win'?[{id:'chest',label:'打开宝箱',icon:'popup/chest_closed',iconKind:'chest',state,claim:state==='ready'?()=>{}:undefined},{id:'regionReward',label:'潮汐网',icon:'',tool:'tideNet',iconKind:'tool',state,claim:state==='ready'?()=>{}:undefined}]:[]};
    const p=P.openResult(stack,model,null); for(let i=0;i<80;i++) stack.update(.025);
    const nodes=[];
    const walk=(n,x,y,sx,sy,op,depth)=>{ if(!n.active) return; x+=n.position.x*sx; y+=n.position.y*sy; sx*=n.scale.x; sy*=n.scale.y;
      const o=n.getComponent(H.cc.UIOpacity); if(o) op*=o.opacity/255;
      const ui=n.getComponent(H.cc.UITransform), sp=n.getComponent(H.cc.Sprite), lb=n.getComponent(H.cc.Label), g=n.getComponent(H.cc.Graphics);
      const rec={name:n.name,depth,x:+(x+w/2).toFixed(1),y:+(h/2-y).toFixed(1),w:ui?+(ui.width*Math.abs(sx)).toFixed(1):0,h:ui?+(ui.height*Math.abs(sy)).toFixed(1):0,ax:ui?ui.anchorX:.5,ay:ui?ui.anchorY:.5,op:+op.toFixed(3)};
      if(sp&&sp.spriteFrame){const t=sp.spriteFrame.texture; rec.sprite=t&&t.image?t.image.path:null; rec.type=sp.type; rec.inset=[sp.spriteFrame.insetLeft,sp.spriteFrame.insetTop]; rec.color=sp.color.toHEX('#rrggbbaa'); rec.gray=sp.grayscale; rec.sxy=[sx,sy];}
      if(lb&&lb.string){rec.text=lb.string;rec.fs=+(lb.fontSize*Math.abs(sy)).toFixed(1);rec.color=lb.color.toHEX('#rrggbbaa');rec.bold=lb.isBold;}
      if(g){rec.gfx=(g.ops||g._ops||[]).length||true;}
      if(rec.sprite||rec.text||rec.gfx) nodes.push(rec);
      n.children.forEach(c=>walk(c,x,y,sx,sy,op,depth+1)); };
    walk(H.cc._scene,0,0,1,1,1,0);
    out[`${w}x${h}-${kind}-${state}`]={nodes,diag:p.resultDiagnostics?p.resultDiagnostics():null};
    stack.closeAll?.(); owner.destroy?.(); H.cc._scene.removeChild?.(owner);
  }
  fs.writeFileSync('/tmp/r5ui/dump.json',JSON.stringify(out,null,1));
  for(const k in out) console.log(k,out[k].nodes.length);
})().catch(e=>{console.error(e);process.exit(1)});
