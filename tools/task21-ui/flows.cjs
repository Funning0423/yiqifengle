'use strict';
// Real-touch flows on the debug Web build. Checkpoints come from the existing in-game 地区流程测试 entry.
const assert=require('node:assert/strict'),H=require('./harness.cjs');
const root=ns=>'dot-region-flow-test-'+ns+':';
async function boardState(page){return page.evaluate(()=>{const b=__worldIntegration.board();if(!b)return null;const s=b.snapshot;return {state:s.state,provider:s.provider,stageId:s.active?.stageId,level:s.active?.level,attemptId:s.active?.attemptId,moves:s.active?.moves,score:s.active?.score,status:s.active?.status,completionRecorded:!!s.result?.completionRecorded,stars:s.result?.stars??null,nextStageId:s.nextStageId??null,journeyCompleted:s.journey?.completed??null,actions:b.checkpoint?.actions?.length??null,popups:b.popups,background:b.background};});}
async function waitBoard(page,pred,arg,timeout=120000){await page.waitForFunction(({src,arg})=>{const b=__worldIntegration.board();if(!b||__worldIntegration.snapshot().state!=='level')return false;return (new Function('b','arg','return ('+src+')(b,arg)'))(b,arg);},{src:pred.toString(),arg},{timeout});}
const TUTORIALS={ToolIntroPanel:'GotIt',RuleGuidePanel:'GotIt'};
/** One-time tutorial popups are dismissed the way a player would (their own button). Returns the names dismissed. */
async function dismissTutorials(page,settleMs=800){const seen=[];for(let i=0;i<8;i++){await page.waitForTimeout(settleMs);const p=(await boardState(page))?.popups||[];const top=p.find(x=>TUTORIALS[x]);if(!top)break;await H.tapNode(page,{popup:top,name:TUTORIALS[top]});seen.push(top);}return seen;}
/** Resume a paused board through the pause panel, then clear tutorials. */
async function resumeBoard(page){const tutorials=[];tutorials.push(...await dismissTutorials(page,300));if((await boardState(page)).state==='run.paused'){await H.tapNode(page,{popup:'PausePanel',name:'Resume'});}
 await waitBoard(page,b=>b.snapshot.state==='run.ready'&&!b.popups.includes('PausePanel'));tutorials.push(...await dismissTutorials(page));
 await waitBoard(page,b=>b.snapshot.state==='run.ready'&&b.popups.length===0);return tutorials;}
/** 地区流程测试 → NN · 最后一步 → (paused) 继续. Returns the board at run.ready on the last action. */
async function enterCheckpoint(page,n){
 await H.nav(page,'flowTests');await H.nav(page,'flowTest'+n);
 await waitBoard(page,(b,n)=>b.snapshot.active?.stageId==='mainline-'+String(n).padStart(2,'0')&&['run.paused','run.ready'].includes(b.snapshot.state),n,180000);
 const tutorials=await resumeBoard(page);
 return {...await boardState(page),tutorialsDismissed:tutorials};
}
async function finalSwap(page){const t=await page.evaluate(()=>__worldIntegration.regionFlowTest());const a=t.lastAction;assert.equal(a[0],'swap');const before=await boardState(page);
 await H.swap(page,a[1],a[2],before.actions+1);
 await waitBoard(page,b=>b.snapshot.state==='result.saved'&&b.snapshot.result?.completionRecorded&&b.popups.includes('ResultPanel'));
 return {lastAction:a,result:await boardState(page)};}
const journey=page=>page.evaluate(()=>{const s=__worldIntegration.board()?.snapshot?.journey;return s?{completed:s.completed,inventory:s.inventory,chests:s.chests,regionRewards:s.regionRewards}:null;});
const gates=page=>page.evaluate(()=>{const g=__worldIntegration.islandGates();return {r5:g.r5.map(x=>({region:x.region,id:x.id,ok:x.ok,reason:x.reason||null})),r4:g.r4.map(x=>({id:x.id,unlocked:x.unlocked})),challenges:g.challenges};});
const mainline=page=>page.evaluate(()=>{const s=__worldIntegration.mainline();return {completed:s.journey?.completed,nextStageId:s.nextStageId,active:s.active?{stageId:s.active.stageId,status:s.active.status,attemptId:s.active.attemptId,moves:s.active.moves}:null,unlocked:s.stages.filter(x=>x.unlocked).map(x=>x.id),inventory:s.journey?.inventory,regionRewards:s.journey?.regionRewards,chests:(s.journey?.chests||[]).filter(c=>c.earned||c.opened)};});
/** Burst of N touch taps pipelined through CDP without awaiting frames between them (same-frame duplicates). */
async function burstTap(page,x,y,n){const cdp=await page.context().newCDPSession(page);const sends=[];for(let i=0;i<n;i++){const tp=[{x,y,id:100+i}];sends.push(cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:tp}));sends.push(cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}));}await Promise.all(sends);await cdp.detach();}
/** Board pause → 回到小岛 → island. */
async function exitToIsland(page){await dismissTutorials(page,300);const s=await boardState(page);
 if(s.popups.includes('ResultPanel'))await H.tapNode(page,{popup:'ResultPanel',name:'Home'});
 else{if(!s.popups.includes('PausePanel')){const p=(await H.board(page)).layout.pause||null;if(p)await page.touchscreen.tap(p.x,p.y);else await page.evaluate(()=>__worldIntegration.hide()),await page.evaluate(()=>__worldIntegration.show());await page.waitForFunction(()=>__worldIntegration.board()?.popups.includes('PausePanel'),{},{timeout:30000});}
  await H.tapNode(page,{popup:'PausePanel',name:'Home'});}
 await H.waitState(page,'island');}
async function leaveHome(page){const r=await page.evaluate(()=>__worldIntegration.leave());if(!r.ok)throw Error('leave '+r.reason);await H.waitState(page,'island');}
const R5W=require('../persistence-fixtures/verified-replays.json');
/** Island 旅程册 → chapter → 继续 (the player route into an R5 region). */
async function openRegionViaJournal(page,region){await H.tapNode(page,{name:'Island-journal'});await H.tapNode(page,{name:'Chapter-'+region});await H.tapNode(page,{name:'Continue-'+region});}
/** Replays the verified witness for the board's actual seed with real taps; returns the won board. */
async function playR5Stage(page,stageId){await waitBoard(page,(b,id)=>b.snapshot.active?.stageId===id,stageId,180000);await resumeBoard(page);
 const s=await boardState(page),seed=await page.evaluate(()=>__worldIntegration.board().snapshot.active.seed);const w=R5W[stageId].find(x=>x.seed===seed);if(!w)throw Error('no verified witness for '+stageId);
 for(let i=s.actions;i<w.actions.length;i++){const a=w.actions[i];if(a[0]==='swap')await H.swap(page,a[1],a[2],i+1);else if(a[0]==='activate'){await H.tapCell(page,a[1]);await H.tapCell(page,a[1]);await page.waitForFunction(n=>__worldIntegration.board().checkpoint.actions.length===n,i+1,{timeout:60000});}else throw Error('action '+a[0]);}
 await waitBoard(page,b=>b.snapshot.state==='result.saved'&&b.snapshot.result?.completionRecorded&&b.popups.includes('ResultPanel'));await page.waitForTimeout(1200);
 const won=await boardState(page);if(won.score!==w.score)throw Error('score mismatch '+stageId+' '+won.score+' vs '+w.score);return {...won,witnessSeed:w.seed,witnessActions:w.actions.length};}
const r5Ledger=async(page,root)=>{const raw=await page.evaluate(k=>localStorage.getItem(k),root+'r5:forest-regional-r05-progress');if(!raw)return null;const d=JSON.parse(raw);return {revision:d.revision,sequence:d.sequence,records:Object.fromEntries(Object.entries(d.records).map(([k,v])=>[k,{clears:v.clears,bestStars:v.bestStars}])),attempts:Object.keys(d.attempts).length,claimedRegions:d.claimedRegions,openAttempt:d.openAttempt?d.openAttempt.id:null};};
/** Board content, piece positions, and the background renderer the player actually has on screen.
 * Live meadow diagnostics publish rendering.source.nodeCount / meshCount and rendering.visible.
 * They do not publish rendering.size. A null width is an unpublished picture size, not a hidden frame.
 * Static board pictures publish rendering.size (UI-02 island frame was about 404×874). */
async function boardVisual(page){return page.evaluate(()=>{const b=__worldIntegration.board();if(!b?.snapshot?.active)return null;const a=b.snapshot.active,stage=(b.snapshot.stages||[]).find(s=>s.id===a.stageId)||null,cell=t=>t?String(t.type)+(t.special?':'+t.special:''):'.',bg=b.background||{},r=bg.rendering||{},source=r.source||null,size=r.size||null;
 return {state:b.snapshot.state,provider:b.snapshot.provider,stageId:a.stageId,name:a.name||stage?.name||null,theme:a.theme||null,chapterName:stage?.chapterName||null,region:a.region||stage?.region||null,level:a.level,attemptId:a.attemptId,seed:a.seed,moves:a.moves,score:a.score,status:a.status,actions:b.checkpoint?.actions?.length??null,occupied:(a.board||[]).filter(Boolean).length,board:(a.board||[]).map(cell).join(''),moss:a.moss||[],roots:a.roots||[],tiles:(b.layout?.tiles||[]).map(t=>[Math.round(t.x*10)/10,Math.round(t.y*10)/10]),spriteSizes:(b.layout?.spriteSizes||[]).map(s=>[Math.round(s.width),Math.round(s.height)]),popups:b.popups,background:{state:bg.state,stageId:bg.stageId,renderer:r.renderer||null,bundle:r.bundle||null,path:r.path||null,prefabName:r.prefabName||null,chapter:r.chapter||'',region:r.region||'',visible:r.visible===true,width:size&&typeof size.width==='number'?size.width:null,height:size&&typeof size.height==='number'?size.height:null,meshCount:source&&typeof source.meshCount==='number'?source.meshCount:null,nodeCount:source&&typeof source.nodeCount==='number'?source.nodeCount:null}};});}
/** null when the published live-meadow diagnostics are on screen. The reason names visible:false separately from a missing picture size. */
function liveMeadowReason(bg){
 if(!bg)return 'missing background';
 if(bg.state!=='ready')return 'state '+bg.state;
 if(bg.renderer!=='region-live-3d')return 'renderer '+bg.renderer;
 if(bg.bundle!=='region_meadow')return 'bundle '+bg.bundle;
 if(bg.region!=='meadow')return 'region '+bg.region;
 if(bg.visible!==true)return 'visible is false; picture size '+(bg.width==null?'unpublished':bg.width+'x'+bg.height);
 if(!(bg.meshCount>0&&bg.nodeCount>0))return 'rendering.source meshCount='+bg.meshCount+' nodeCount='+bg.nodeCount+'; picture size '+(bg.width==null?'unpublished (live 3D does not publish rendering.size)':bg.width+'x'+bg.height);
 return null;
}
/** null when the published live sky-city diagnostics are on screen. Sky does not publish a picture size or mesh counts. */
function liveSkycityReason(bg){
 if(!bg)return 'missing background';
 if(bg.state!=='ready')return 'state '+bg.state;
 if(bg.renderer!=='region-live-3d')return 'renderer '+bg.renderer;
 if(bg.bundle!=='region_skycity')return 'bundle '+bg.bundle;
 if(bg.prefabName!=='env_skycity')return 'prefab '+bg.prefabName;
 if(bg.region!=='skycity')return 'region '+bg.region;
 if(bg.visible!==true)return 'visible is false';
 return null;
}
async function visiblePieces(page){return (await H.nodes(page,{name:'ProjectPieceArt'})).filter(n=>n.width>8&&n.height>8).length;}
module.exports={R5W,openRegionViaJournal,playR5Stage,r5Ledger,boardVisual,liveMeadowReason,liveSkycityReason,visiblePieces,root,boardState,waitBoard,dismissTutorials,resumeBoard,enterCheckpoint,finalSwap,journey,gates,mainline,burstTap,exitToIsland,leaveHome};
