'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),{stripTypeScriptTypes}=require('module'),stamp=require('./source_stamp.cjs');
const root=process.env.QF_OCEAN_SOURCE_ROOT||path.resolve(__dirname,'../..'),dir=path.join(root,'evidence/cloud-ocean-leap'),context={Math};vm.createContext(context);
vm.runInContext(stripTypeScriptTypes(fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/world-r2/OriginalLevelEnvironment.ts'),'utf8').replace(/export /g,''),{mode:'transform'}),context);
const layout=JSON.parse(fs.readFileSync(path.join(dir,'reader-results.json'))).results[0].layout,times=[];
for(let i=0;i<200;i++){const t=performance.now();context.chooseOceanLeapCorridor(layout);times.push(performance.now()-t);}times.sort((a,b)=>a-b);
fs.writeFileSync(path.join(dir,'selector-timing.json'),JSON.stringify({source:stamp.verify(),scope:'Cloud Node selector CPU only. No mobile/GPU FPS or OS getWindowInfo timing claim.',calls:200,p50Ms:times[100],p95Ms:times[190],maxMs:times[199]},null,2)+'\n');
