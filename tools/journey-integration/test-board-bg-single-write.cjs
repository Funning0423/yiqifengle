'use strict';
// full9c (Mac diag 3e2cb080: MULTI=3 at skycity.board-background / lakeside.board-background arrival, same pose 3× in one frame):
// LevelBackgroundBinding.frame() must re-pose the board-background camera only when portrait/layout change.
const assert=require('node:assert/strict');const {createHarness}=require('../board-ui/harness.cjs');
const S=process.env.BGW_SCRIPTS?process.env.BGW_SCRIPTS.replace(/\/?$/,'/'):'';
const H=createHarness(),LB=H.load(S?S+'world-r2/LevelBackground.ts':'world-r2/LevelBackground.ts');
(async()=>{let n=0;const lease={frame(){n++;},setVisible(){},setPaused(){},dispose(){},diagnostics:()=>({})};
 const token={cancelled:false,check(){},wait:p=>p};
 const b=new LB.LevelBackgroundBinding({stageId:'mainline-12'});
 const L={width:390,height:844,boardTop:300};
 b.frame(true,L);await b.load(()=>Promise.resolve(lease),{},token);const afterLoad=n;
 b.frame(true,{...L});b.frame(true,{...L});b.frame(true,L);const dup=n-afterLoad;
 b.frame(true,{...L,height:900});const changed=n-afterLoad-dup;
 b.frame(false,{...L,height:900});const flip=n-afterLoad-dup-changed;
 console.log(JSON.stringify({afterLoad,dupWrites:dup,changed,flip}));
 assert.equal(afterLoad,1,'load applies the stored frame once');assert.equal(dup,0,'same layout re-posed the board-background camera (MULTI)');
 assert.equal(changed,1);assert.equal(flip,1);console.log('board-bg-single-write: PASS');})().catch(e=>{console.error(e.message);process.exit(1);});
