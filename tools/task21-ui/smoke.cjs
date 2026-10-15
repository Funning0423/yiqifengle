'use strict';
const path=require('node:path'),H=require('./harness.cjs');
(async()=>{const id=H.runId(),profile=path.join(H.OUT,'profile-smoke-'+id),errors=[],logs=[];const t0=Date.now();
 const {context,page}=await H.launch(profile,{errors,logs});
 const d=await page.evaluate(()=>({snapshot:__worldIntegration.snapshot(),keys:Object.keys(__worldIntegration),targets:Object.keys(__worldIntegration.layout().targets),mainline:(s=>({completed:s.journey?.completed,next:s.nextStageId,unlocked:s.stages.filter(x=>x.unlocked).map(x=>x.id)}))(__worldIntegration.mainline()),loading:__worldLoading.snapshot().phase,probe:typeof __r5PersistenceProbe}));
 const s=await H.shot(page,'smoke-home.png');await context.close();
 console.log(JSON.stringify({readyMs:Date.now()-t0,d,errors,logs,shot:s},null,2));})().catch(e=>{console.error(e);process.exit(1);});
