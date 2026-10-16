'use strict';
// UI-01: reward panel + duplicate-grant guard. Mainline chest / region tool and R5 tide memento, all through real result-page
// buttons; same-frame touch bursts; reward popup close (收下 and ×); hide/show; warm reload; cold browser restart.
const path=require('node:path'),assert=require('node:assert/strict'),H=require('./harness.cjs'),F=require('./flows.cjs');
const tools=j=>({...(j?.inventory?.tools||{})});
const diff=(a,b)=>Object.fromEntries(Object.keys({...a,...b}).map(k=>[k,(b[k]||0)-(a[k]||0)]).filter(([,v])=>v));
(async()=>{const id=H.runId(),ns='task21-web-ui01-'+id,root=F.root(ns),query='?testNamespace='+ns,profile=path.join(H.OUT,'profile-ui01-'+id),errors=[],logs=[],checks=[],shots={};const startedAt=new Date().toISOString();let context,page;
 const check=(name,data)=>{checks.push({name,pass:true,...data});console.log('PASS',name);};
 const ledgerRows=async()=>H.storageRows(page,root);
 const rewardBurst=async(claimName,taps=6)=>{const n=(await H.nodes(page,{popup:'ResultPanel',name:claimName})).pop();assert(n,claimName+' visible');await F.burstTap(page,n.cx,n.cy,taps);
  await page.waitForFunction(()=>__worldIntegration.board().popups.includes('RewardPanel'),{},{timeout:30000});await page.waitForTimeout(1500);return n;};
 try{
  ({context,page}=await H.launch(profile,{query,errors,logs}));
  assert.equal((await page.evaluate(()=>__worldIntegration.regionFlowTest())).namespace,root);
  await F.enterCheckpoint(page,4);const win=await F.finalSwap(page);await page.waitForTimeout(1500);
  const J0=await F.journey(page);const chest0=J0.chests.find(c=>c.level===3),region0=J0.regionRewards[0];
  assert(chest0?.earned&&!chest0.opened,'mainline-04 chest earned, unopened');assert(region0.unlocked&&!region0.claimed,'tide region tool unlocked, unclaimed');
  shots.resultReady=await H.shot(page,'ui-01-a-result-claims-ready.png');
  check('first-win-result-shows-ready-chest-and-region-tool',{result:win.result,chest:chest0,region:region0,tools:tools(J0)});
  // One 全部领取 burst grants the chest and the region tool together, one 获得 panel.
  const claimBtn=await rewardBurst('ClaimAll');const J1=await F.journey(page);const host1=await page.evaluate(()=>__worldIntegration.hostResult());
  const rewardPopups=(await H.board(page)).popups.filter(p=>p==='RewardPanel').length;
  assert.equal(J1.chests.find(c=>c.level===3).opened,true);assert.equal(J1.regionRewards[0].claimed,true);assert.equal(rewardPopups,1);const chestGain=diff(tools(J0),tools(J1));
  assert.equal(chestGain.tideNet,1,'chest and region tool arrive in the same grant');
  const gainList=(await H.nodes(page,{popup:'RewardPanel',name:'GainList'})).pop()?.label;
  shots.chestReward=await H.shot(page,'ui-01-b-chest-reward-panel.png');
  await F.burstTap(page,claimBtn.cx,claimBtn.cy,4);await page.waitForTimeout(600);assert.deepEqual(await F.journey(page),J1,'taps behind the reward popup are blocked');
  assert.equal((await H.nodes(page,{popup:'RewardPanel',name:'Close'})).length,0,'reward popup is not closable; 收下 is its only dismissal');
  await page.evaluate(()=>__worldIntegration.hide());await page.waitForTimeout(300);await page.evaluate(()=>__worldIntegration.show());await page.waitForTimeout(1000);
  const duringHide=await F.boardState(page);assert(duringHide.popups.includes('RewardPanel'),'reward popup survives background/foreground');assert.deepEqual(await F.journey(page),J1);
  await H.tapNode(page,{popup:'RewardPanel',name:'Accept'});await page.waitForFunction(()=>!__worldIntegration.board().popups.includes('RewardPanel'),{},{timeout:15000});await page.waitForTimeout(800);
  assert.equal((await H.nodes(page,{popup:'ResultPanel',name:'ClaimAll'})).length,0,'claim-all button gone after both rewards');
  assert((await H.nodes(page,{popup:'ResultPanel',text:'宝箱已打开'})).length,'claimed stamp text');
  const J2=J1;
  check('claim-all-six-same-frame-taps-open-once-single-popup-blocked-behind-popup',{hostReply:host1,chestGain,gainList,rewardPopups,afterAccept:'ClaimAll removed; 宝箱已打开 shown'});
  shots.regionReward=await H.shot(page,'ui-01-c-region-tool-reward-panel.png');
  await F.burstTap(page,claimBtn.cx,claimBtn.cy,6);await page.waitForTimeout(800);assert.deepEqual(await F.journey(page),J2,'tapping where the claim button was grants nothing');
  await page.evaluate(()=>__worldIntegration.hide());await page.waitForTimeout(300);await page.evaluate(()=>__worldIntegration.show());await page.waitForTimeout(1200);
  const afterShow=await F.boardState(page);assert.equal(afterShow.state,'result.saved');assert(afterShow.popups.includes('ResultPanel'));
  assert.equal((await H.nodes(page,{popup:'ResultPanel',name:'Claim-*'})).length,0,'no claim buttons after reopen');assert.deepEqual(await F.journey(page),J2);
  shots.reopened=await H.shot(page,'ui-01-d-result-reopened-claimed.png');
  check('claim-all-popup-survives-hide-show-accept-reopen-no-claim-buttons',{chestGain,popupsDuringBackground:duringHide.popups,hostReply:await page.evaluate(()=>__worldIntegration.hostResult()),afterShow:{state:afterShow.state,popups:afterShow.popups}});
  const mainRowsBefore=await ledgerRows();
  // R5 tide memento: real result-page Next/claim buttons across r05-tide-01..04.
  await H.tapNode(page,{popup:'ResultPanel',name:'Home'});await H.waitState(page,'island');
  await F.openRegionViaJournal(page,'tide');const stages=[];
  for(let o=1;o<=4;o++){const id='r05-tide-0'+o;const won=await F.playR5Stage(page,id);stages.push({stageId:id,score:won.score,stars:won.stars,attemptId:won.attemptId,actions:won.witnessActions});if(o<4)await H.tapNode(page,{popup:'ResultPanel',name:'Next'});}
  const L0=await F.r5Ledger(page,root);assert.equal(L0.attempts,4);assert.deepEqual(L0.claimedRegions,[]);
  const mementoBtn=await rewardBurst('ClaimAll',8);const L1=await F.r5Ledger(page,root);const hostM=await page.evaluate(()=>__worldIntegration.hostResult());
  assert.deepEqual(L1.claimedRegions,['tide']);assert.equal(L1.attempts,4);assert.deepEqual(L1.records,L0.records);assert.equal(L1.revision,L0.revision+1,'exactly one journal write for the claim');
  assert.equal(hostM.ok,true);assert.equal(hostM.newlyGranted.length,1);
  shots.memento=await H.shot(page,'ui-01-e-tide-memento-reward-panel.png');
  await H.tapNode(page,{popup:'RewardPanel',name:'Accept'});await page.waitForFunction(()=>!__worldIntegration.board().popups.includes('RewardPanel'),{},{timeout:15000});await page.waitForTimeout(800);
  await F.burstTap(page,mementoBtn.cx,mementoBtn.cy,6);await page.waitForTimeout(800);assert.deepEqual(await F.r5Ledger(page,root),L1);
  assert((await H.nodes(page,{popup:'ResultPanel',text:'地区印记已领取'})).length,'memento claimed stamp');
  check('tide-memento-eight-same-frame-taps-one-grant-one-journal-revision',{stages,ledgerBefore:L0,ledgerAfter:L1,hostReply:hostM});
  const rowsBeforeRestore=await ledgerRows();
  // Warm restore (reload), back to the tide-04 result, no claim button, nothing changes.
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>{try{return __worldIntegration.snapshot().state==='home'}catch{return false}},{},{timeout:180000});
  assert.deepEqual(await ledgerRows(),rowsBeforeRestore,'reload performs no writes');
  await F.leaveHome(page);await F.openRegionViaJournal(page,'tide');await F.waitBoard(page,b=>b.snapshot.active?.stageId==='r05-tide-04'&&b.snapshot.state==='result.saved'&&b.popups.includes('ResultPanel'),null,180000);await page.waitForTimeout(1200);
  assert.equal((await H.nodes(page,{popup:'ResultPanel',name:'Claim-claim'})).length,0);assert.deepEqual(await F.r5Ledger(page,root),L1);
  check('warm-reload-reenters-tide-04-result-claimed-no-button-ledger-unchanged',{ledger:L1});
  await H.tapNode(page,{popup:'ResultPanel',name:'Home'});await H.waitState(page,'island');
  // Cold restore: new browser process, same profile + namespace.
  await context.close();context=null;({context,page}=await H.launch(profile,{query,errors,logs}));
  assert.deepEqual(await ledgerRows(),rowsBeforeRestore,'cold start performs no writes');
  const ml=await F.mainline(page);assert.equal(ml.inventory.tools.tideNet,tools(J2).tideNet);assert.equal(ml.regionRewards[0].claimed,true);assert(ml.chests.find(c=>c.level===3).opened);
  await F.leaveHome(page);await F.openRegionViaJournal(page,'tide');await F.waitBoard(page,b=>b.snapshot.active?.stageId==='r05-tide-04'&&b.snapshot.state==='result.saved'&&b.popups.includes('ResultPanel'),null,180000);await page.waitForTimeout(1200);
  const mb=(await H.nodes(page,{popup:'ResultPanel',text:'地区印记已领取'}));assert(mb.length);assert.equal((await H.nodes(page,{popup:'ResultPanel',name:'Claim-*'})).length,0);
  await F.burstTap(page,mementoBtn.cx,mementoBtn.cy,6);await page.waitForTimeout(800);
  const L2=await F.r5Ledger(page,root);assert.deepEqual(L2,L1);assert.deepEqual(await ledgerRows(),rowsBeforeRestore);
  shots.cold=await H.shot(page,'ui-01-reward-dedup.png');
  check('cold-restart-ledger-and-ui-reward-state-identical-no-regrant',{mainline:{tools:ml.inventory.tools,regionRewards:ml.regionRewards,chests:ml.chests},ledger:L2,physicalRowsUnchanged:true});
  assert.deepEqual(Object.keys(mainRowsBefore).filter(k=>!k.startsWith(root)),[]);assert.deepEqual(errors,[]);
  const out=H.write('ui-01-reward-dedup.json',{id:'UI-01',status:'PASS',layer:'网页集成 (Mac headless Chrome for Testing 149 + Metal, Cocos web-desktop debug build)',runId:id,startedAt,finishedAt:new Date().toISOString(),build:H.buildIdentity(),namespace:root,profile:path.relative(H.ROOT,profile),
   route:'地区流程测试 04 → win → 打开宝箱 ×6 same-frame → 收下 → 领取地区道具 ×6 → hide/show with popup open → 收下 → re-tap ×6 → hide/show → 回小岛 → 旅程册 潮汐 继续 → r05-tide-01..04 via 下一关 → 领取地区印记 ×8 → 收下 → re-tap → reload → re-enter tide-04 result → close browser → relaunch → re-enter → re-tap',
   checks,screenshots:shots,errors,logs:logs.slice(-20),finalPhysicalRows:Object.keys(rowsBeforeRestore),limitations:['Mac headless Chrome only; not phone/WeChat','Programmatic same-frame duplicates are CDP touch bursts on the real button; no new test-only claim API was added']});
  console.log('UI-01 PASS',out);
 }catch(e){errors.push(String(e.stack||e));try{if(page)shots.failure=await H.shot(page,'ui-01-failure.png');}catch{}H.write('ui-01-reward-dedup.json',{id:'UI-01',status:'FAIL',runId:id,namespace:root,checks,screenshots:shots,errors,state:page?await F.boardState(page).catch(()=>null):null});console.error(e);process.exitCode=1;}
 finally{if(context)await context.close();}
})();
