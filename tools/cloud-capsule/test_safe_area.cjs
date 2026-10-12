'use strict';
// Board-UI board vs the WeChat capsule / safe area: header (pause + info plate) never touches the capsule, the tool bar
// and pause stay on screen, the result popup stays centred and inside the screen. Real ManagedMobileBoardUI source.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto');const H=require('../cloud-ui/harness.cjs')();
const sizes=[[390,844],[320,568],[402,874],[568,320],[844,390]],results=[];
function bounds(n,w,h){const p=n.worldPosition,t=n.getComponent(H.UITransform),s=n.worldScale;return{left:w/2+p.x-t.width*s.x*t.anchorX,right:w/2+p.x+t.width*s.x*(1-t.anchorX),top:h/2-p.y-t.height*s.y*(1-t.anchorY),bottom:h/2-p.y+t.height*s.y*t.anchorY};}
function overlaps(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}
const old=globalThis.wx;
(async()=>{try{
 H.H.cc.sys.localStorage.setItem('qfl.ui.seenTools',JSON.stringify(['bomb','windBell','tideBottle','tideNet','sunSeed','starShears']));
 for(const [w,h] of sizes)for(const scale of [1,1.5,2])for(const goals of [1,2,3,4]){
  const ww=w/scale,hh=h/scale,rect={left:ww-96,top:35/scale,right:ww-8,bottom:79/scale},safe={left:0,right:ww,top:32/scale,bottom:hh-24/scale};globalThis.wx={getWindowInfo:()=>({windowWidth:ww,windowHeight:hh,safeArea:safe}),getMenuButtonBoundingClientRect:()=>rect};
  const {u,s}=H.setup('mainline-v33',0,w,h);await H.flush();s.journey.regionRewards=[];s.active.goalOrder=Array.from({length:goals},(_,i)=>'type'+i);s.active.goals=Object.fromEntries(s.active.goalOrder.map(x=>[x,15]));u.render(s);u.update(0);
  const d=u.hostLayout(),cap=d.safe.capsule;assert(cap);assert(d.safe.portrait?d.safe.top>=cap.bottom-1e-9||d.geometry.plate.y-d.geometry.plate.height/2>=cap.bottom:true);
  const header=[u.pause,u.plateSprite.node,...u.goalNodes.filter(n=>n.active),u.targets.moves];for(const n of header)assert(!overlaps(bounds(n,w,h),cap),n.name+' touches WeChat capsule '+JSON.stringify([w,h,scale,goals]));
  assert.equal(u.cells.length,49);const cell=u.cells[0].getComponent(H.UITransform);assert(cell.width>0&&cell.height>0);assert(d.board>=98,'board '+d.board);
  for(const n of [u.pause,...u.tools.filter(n=>n.active)]){const b=bounds(n,w,h);assert(b.top>=-.001&&b.bottom<=h+.001&&b.left>=-.001&&b.right<=w+.001,'control outside '+n.name+' '+JSON.stringify([w,h,scale,b]));}
  const gb=bounds(u.grid,w,h);for(const n of [u.pause,u.plateSprite.node])assert(!overlaps(bounds(n,w,h),gb),n.name+' overlaps the board');
  if(goals===1){for(const state of ['result.saved','result.unsaved','run.unsaved','error.readonly']){s.state=state;s.active.status='won';s.result={stars:3,completionRecorded:state==='result.saved'};s.journey.chests=[];u.render(s);for(let i=0;i<12;i++)u.update(1/30);const panel=u.popups.find('ResultPanel');assert(panel,'result panel '+state);const body=panel.body,b=bounds(body,w,h);assert(Math.abs(body.worldPosition.x)<.001,'result must stay centred');assert(b.left>=-.001&&b.right<=w+.001&&b.top>=-.001&&b.bottom<=h+.001,'result panel outside '+state+' '+JSON.stringify(b));}}
  results.push({w,h,scale,goals,top:d.safe.top,capsule:cap,board:d.board,headerNonOverlap:true,controlsInside:true});u.onDestroy();
 }
 globalThis.wx={getWindowInfo:()=>{throw Error('old SDK')},getSystemInfoSync:()=>({windowWidth:390,windowHeight:844}),getMenuButtonBoundingClientRect:()=>({left:294,right:382,top:42,bottom:80})};let f=H.setup();assert.equal(f.u.hostLayout().safe.capsule.bottom,80);assert.equal(f.u.hostLayout().safe.top,47);f.u.onDestroy();
 for(const api of [{},{getWindowInfo:()=>{throw Error('unavailable')},getSystemInfoSync:()=>{throw Error('unavailable')},getMenuButtonBoundingClientRect:()=>{throw Error('unavailable')}},{getWindowInfo:()=>({windowWidth:390,windowHeight:844}),getMenuButtonBoundingClientRect:()=>({left:0,right:100,top:0,bottom:Infinity})}]){globalThis.wx=api;f=H.setup();const c=f.u.hostLayout().safe.capsule;assert.equal(f.u.hostLayout().safe.top,47);assert.deepEqual(c,{top:51,bottom:83,left:297,right:384},'fallback capsule');f.u.onDestroy();}
 const source=path.resolve(__dirname,'../../creator-build-project/assets/scripts/ManagedMobileBoardUI.ts'),out={status:'PASS',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),scope:'Actual board-ui BoardUI + BoardLayout + PopupKit on Cocos memory doubles; no native capture or real saves',cases:results.length,results,fallbacks:4,sideEffectScope:'Read-only getWindowInfo/getSystemInfoSync/getMenuButtonBoundingClientRect; no storage, rewards or input changes'};const dir=path.resolve(__dirname,'../../evidence/cloud-capsule');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({status:out.status,cases:out.cases}));
}finally{if(old===undefined)delete globalThis.wx;else globalThis.wx=old;}})().catch(e=>{console.error(e);process.exit(1);});
