'use strict';
// UI-02: mainline 04 legal win → 05 (meadow 3D board), unlock + scene transition + storage + warm/cold re-entry.
const path=require('node:path'),assert=require('node:assert/strict'),H=require('./harness.cjs'),F=require('./flows.cjs');
(async()=>{const id=H.runId(),ns='task21-web-ui02-'+id,root=F.root(ns),query='?testNamespace='+ns,profile=path.join(H.OUT,'profile-ui02-'+id),errors=[],logs=[],checks=[],shots={};const startedAt=new Date().toISOString();let context,page;
 const check=(name,data)=>{checks.push({name,pass:true,...data});console.log('PASS',name);};
 try{
  ({context,page}=await H.launch(profile,{query,errors,logs}));
  const pinned=await page.evaluate(()=>__worldIntegration.regionFlowTest());assert.equal(pinned.namespace,root);assert.equal(pinned.pinned,true);
  assert.deepEqual(await H.storageRows(page,root),{});check('task21-root-pinned-and-empty',{pinned});
  const entry=await F.enterCheckpoint(page,4);assert.equal(entry.stageId,'mainline-04');assert.equal(entry.journeyCompleted,3);
  const before=await F.gates(page);assert.equal(before.r5.find(g=>g.region==='tide').ok,false);check('checkpoint-04-last-step-tide-still-locked',{entry,gates:before});
  const win=await F.finalSwap(page);const r=win.result;assert.equal(r.journeyCompleted,4);assert.equal(r.nextStageId,'mainline-05');
  const hint=await H.nodes(page,{popup:'ResultPanel',text:'主线 05'});assert(hint.length,'unlock hint on result page');
  shots.result=await H.shot(page,'ui-02-a-mainline04-result.png');
  const after=await F.gates(page);const g=Object.fromEntries(after.r5.map(x=>[x.region,x]));
  assert.equal(g.tide.ok,true);assert.equal(g.meadow.ok,false);assert.equal(g.meadow.reason,'stage-locked');assert.equal(g.sky.ok,false);
  check('mainline-04-win-registers-unlocks-05-and-tide-challenge',{lastAction:win.lastAction,result:r,hint:hint[hint.length-1].label,gates:after,note:'R5 meadow challenge (r05-meadow-01) stays locked until mainline 08 by design (progress-journal isUnlocked: journey.records[region*4+3]).'});
  const rowsAfterWin=await H.storageRows(page,root);const mainActive=JSON.parse(rowsAfterWin[root+'mainline:forest-mainline-cocos-r1-active']||'null');
  assert(Object.keys(rowsAfterWin).every(k=>k.startsWith(root)));
  await H.tapNode(page,{popup:'ResultPanel',name:'Next'});
  await F.waitBoard(page,b=>b.snapshot.active?.stageId==='mainline-05'&&b.background?.state==='ready',null,180000);
  await page.waitForTimeout(1500);
  const m5=await F.boardState(page);assert.equal(m5.provider,'mainline-v33');assert.match(JSON.stringify(m5.background),/meadow/i,'meadow 3D background for mainline 05');
  shots.meadow=await H.shot(page,'ui-02-b-mainline05-meadow.png');
  const rows5=await H.storageRows(page,root),active5=JSON.parse(rows5[root+'mainline:forest-mainline-cocos-r1-active']);
  check('next-enters-mainline-05-on-meadow-scene-and-persists',{board:m5,storedActiveStage:active5?.checkpoint?.stageId||active5?.stageId||null,storageKeys:Object.keys(rows5),activeBeforeNext:mainActive?.checkpoint?.stageId||null});
  await F.resumeBoard(page);
  await F.exitToIsland(page);shots.island=await H.shot(page,'ui-02-c-back-on-island.png');
  const ml1=await F.mainline(page);assert.equal(ml1.completed,4);assert(ml1.unlocked.includes('mainline-05'));check('exit-to-island-keeps-progress',{mainline:ml1});
  // Warm restore: same browser process, page reload.
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>{try{return __worldIntegration.snapshot().state==='home'}catch{return false}},{},{timeout:180000});
  const ml2=await F.mainline(page);assert.equal(ml2.completed,4);assert.equal((await page.evaluate(()=>__worldIntegration.regionFlowTest())).namespace,root);
  await F.leaveHome(page);await H.nav(page,'mainline');await F.waitBoard(page,b=>b.snapshot.active?.stageId==='mainline-05'&&b.background?.state==='ready',null,180000);
  await F.dismissTutorials(page);const warm=await F.boardState(page);assert.match(JSON.stringify(warm.background),/meadow/i);
  check('warm-reload-reenters-mainline-05-meadow',{mainline:ml2,board:warm});
  await F.exitToIsland(page);
  // Cold restore: close the browser process, relaunch the same persistent profile + task21 namespace.
  await context.close();context=null;({context,page}=await H.launch(profile,{query,errors,logs}));
  const ml3=await F.mainline(page);assert.equal(ml3.completed,4);assert(ml3.unlocked.includes('mainline-05'));
  const g3=await page.evaluate(()=>__worldIntegration.islandGates().r5.map(x=>[x.region,x.ok]));assert.deepEqual(g3,[['tide',true],['meadow',false],['sky',false]]);
  await F.leaveHome(page);await H.nav(page,'mainline');await F.waitBoard(page,b=>b.snapshot.active?.stageId==='mainline-05'&&b.background?.state==='ready',null,180000);await page.waitForTimeout(1500);
  const cold=await F.boardState(page);assert.match(JSON.stringify(cold.background),/meadow/i);assert.equal(cold.attemptId,warm.attemptId,'same mainline-05 attempt after cold restart');
  shots.cold=await H.shot(page,'ui-02-d-cold-restart-reentry-meadow.png');
  check('cold-restart-restores-unlock-and-reenters-same-mainline-05-attempt',{mainline:ml3,gates:g3,board:cold});
  const foreign=(await H.allKeys(page)).filter(k=>k.startsWith('dot-region-flow-test-')&&!k.startsWith(root));assert.deepEqual(foreign,[]);
  assert.deepEqual(errors,[]);
  const out=H.write('ui-02-meadow-progression.json',{id:'UI-02',status:'PASS',layer:'网页集成 (Mac headless Chromium, Cocos web-desktop debug build)',runId:id,startedAt,finishedAt:new Date().toISOString(),build:H.buildIdentity(),namespace:root,profile:path.relative(H.ROOT,profile),route:'home → 地区流程测试 → 04 · 最后一步 → 继续 → real swap 23↔30 → 下一关 → mainline-05 (meadow) → 回到小岛 → reload → 继续旅程 → close browser → relaunch → 继续旅程',checks,screenshots:shots,errors,logs:logs.slice(-20),limitations:['Not phone / WeChat; headless Chromium on Mac','Mainline 05 numbering: R5 meadow challenge unlock is gated by mainline 08 and verified in UI-04']});
  console.log('UI-02 PASS',out);
 }catch(e){errors.push(String(e.stack||e));try{if(page)shots.failure=await H.shot(page,'ui-02-failure.png');}catch{}H.write('ui-02-meadow-progression.json',{id:'UI-02',status:'FAIL',runId:id,namespace:root,checks,screenshots:shots,errors,state:page?await F.boardState(page).catch(()=>null):null});console.error(e);process.exitCode=1;}
 finally{if(context)await context.close();}
})();
