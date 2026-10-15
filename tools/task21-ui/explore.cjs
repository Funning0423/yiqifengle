'use strict';
// Exploration only: prints live state at each step of checkpoint N.
const path=require('node:path'),H=require('./harness.cjs');
(async()=>{const id=H.runId(),n=Number(process.argv[2]||4),ns='task21-web-explore-'+id,profile=path.join(H.OUT,'profile-explore-'+id),errors=[],logs=[];
 const {context,page}=await H.launch(profile,{query:'?testNamespace='+ns,errors,logs});const log=(k,v)=>console.log('## '+k,JSON.stringify(v));
 try{
 log('status',await page.evaluate(()=>__worldIntegration.regionFlowTest()));
 await H.nav(page,'flowTests');await H.nav(page,'flowTest'+n);
 await page.waitForFunction(()=>{const b=__worldIntegration.board();return __worldIntegration.snapshot().state==='level'&&b&&b.snapshot;},{},{timeout:180000});
 await page.waitForTimeout(1500);
 const b=await H.board(page);log('board',{state:b.snapshot.state,stage:b.snapshot.active?.stageId,moves:b.snapshot.active?.moves,popups:b.popups,actions:b.checkpoint?.actions?.length,bg:b.background,keys:Object.keys(b)});
 log('pauseNodes',(await H.nodes(page,{popup:'PausePanel'})).filter(x=>x.label||/Tile|Resume|Close/.test(x.name)).slice(0,30));
 log('status2',await page.evaluate(()=>__worldIntegration.regionFlowTest()));
 await H.shot(page,'explore-'+n+'.png');
 }finally{log('errors',errors);await context.close();}
})().catch(e=>{console.error(e);process.exit(1);});
