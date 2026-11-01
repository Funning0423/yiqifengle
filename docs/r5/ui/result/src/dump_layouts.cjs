'use strict';
const fs=require('fs');const ROOT='/workspace/yiqifengle/work/棋盘UI美术bot';
const { createHarness } = require(ROOT+'/tools/board-ui/harness.cjs');
(async()=>{
 const H=createHarness(),A=H.load('ui/BoardArt'),K=H.load('ui/PopupKit'),P=H.load('ui/BoardPanels'),BL=H.load('ui/BoardLayout');
 let IP=null; try{IP=H.load('world-r2/IslandPropsLayout');}catch(e){console.error('IP',e.message)}
 await Promise.all(['board','popup','r2'].map(d=>A.BoardArt.shared().load(d)));
 // real-device-like insets (tools/board-ui/test_board_hint_above_tray.cjs real-device capsule variants); others = boardSafeInsets fallback
 const REAL={'375x667':[20,34,[26,58]],'320x568':[20,34,[24,56]],'390x844':[47,34,[50,82]],'414x896':[48,34,[56,88]],'360x780':[36,34,[42,74]]}; // exactly the rows of tools/board-ui/test_board_hint_above_tray.cjs (bottom 34 on every row)
 const SCREENS=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
 const out={};
 for(const [w,h] of SCREENS){
  const key=w+'x'+h, fb=BL.boardSafeInsets(w,h);
  const r=REAL[key]; const real=r?{top:r[0],bottom:r[1],left:0,right:0,capsule:{top:r[2][0],bottom:r[2][1],left:w-93,right:w-6}}:null;
  const row={fallbackSafe:fb,realSafe:real};
  for(const [nm,safe] of [['fb',fb],['real',real]]){ if(!safe) continue;
   const g=BL.boardLayout(w,h,safe,2); row['board_'+nm]=g;
   for(const kind of ['win','lose']){
    const owner=new H.cc.Node('P'); H.cc._scene.addChild(owner); H.state.viewport={width:w,height:h,safeInsets:safe};
    const stack=new K.PopupStack(owner,()=>H.state.viewport);
    const m={kind,score:630,stars:kind==='win'?3:null,movesUsed:11,movesLeft:11,goalsLeft:[],chestHint:false,next:()=>{},home:()=>{},replay:()=>{},rewards:kind==='win'?[{id:'chest',label:'打开宝箱',icon:'popup/chest_closed',iconKind:'chest',state:'ready',claim:()=>{}}]:[]};
    const p=P.openResult(stack,m,null); for(let i=0;i<60;i++) stack.update(.025);
    const pick=n=>{const f=p.root.find(n); if(!f) return null; let x=0,y=0,sx=1,sy=1; const chain=[]; for(let c=f;c;c=c.parent) chain.unshift(c); for(const c of chain){x+=c.position.x*sx;y+=c.position.y*sy;sx*=c.scale.x;sy*=c.scale.y;} const ui=f.getComponent(H.cc.UITransform); return {cx:+(x+w/2).toFixed(1),cy:+(h/2-y).toFixed(1),w:ui?+(ui.width*Math.abs(sx)).toFixed(1):0,h:ui?+(ui.height*Math.abs(sy)).toFixed(1):0};};
    const lbl=[]; const v=n=>{if(!n.activeInHierarchy)return; const l=n.getComponent(H.cc.Label); if(l&&l.string) lbl.push(l.string+'@'+l.fontSize); n.children.forEach(v)}; v(p.root);
    row['result_'+kind+'_'+nm]={panel:pick('PanelFrame'),plank:pick('Plank'),next:pick('Next'),home:pick('Home'),retry:pick('Retry')||pick('Replay'),chest:pick('ResultChestTap'),labels:lbl,diag:p.resultDiagnostics?.().action};
    stack.closeAll?.();
   }
  }
  if(IP) row.props=IP.propButtonLayout(w,h);
  out[key]=row;
 }
 fs.writeFileSync('/tmp/r5ui/layouts.json',JSON.stringify(out,null,1)); console.log('ok');
})().catch(e=>{console.error(e);process.exit(1)});
