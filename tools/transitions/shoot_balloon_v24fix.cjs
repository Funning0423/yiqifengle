#!/usr/bin/env node
'use strict';
/** 390×844 (DPR2 → 780×1688) shots of the real web-test world at v2.3 keyframes. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const env=require('../qf-env.cjs');
const ROOT=path.resolve(__dirname,'../..');
const WEB=path.join(ROOT,'creator-build-project/build/web-test');
const OUT=path.join(ROOT,'docs/r5/balloon-v24fix/shots');
const PORT=Number(process.env.BALLOON_SHOT_PORT||8786);
const FRAMES=[
 {name:'00_meadow_gameplay_ref',t:null,night:0,meadowOnly:1},
 {name:'01_board',t:0.9,night:0},
 {name:'02_liftoff',t:5.2,night:0},
 {name:'03_clouds',t:11.4,night:0},
 {name:'04_cruise',t:18.5,night:0},
 {name:'05_city',t:24.0,night:0},
 {name:'06_land',t:33.6,night:0},
 {name:'07_night',t:24.0,night:1},
 {name:'handoff_before',t:35.8,night:0},
 {name:'handoff_restore',t:35.9,night:0},
 {name:'handoff_after',t:36.0,night:0},
 {name:'light_10_7',t:10.7,night:0},
 {name:'light_11_0',t:11.0,night:0},
 {name:'light_11_3',t:11.3,night:0},
 {name:'light_11_4',t:11.4,night:0},
];
function server(){return spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:WEB,stdio:['ignore','pipe','pipe']});}
async function ready(url){
 for(let i=0;i<60;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(2000)});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,300));}
 throw Error('server not ready');
}
async function main(){
 if(!fs.existsSync(path.join(WEB,'index.html')))throw Error('missing web-test');
 fs.mkdirSync(OUT,{recursive:true});
 const {chromium}=env.playwright();
 const log=[];
 let child=null;
 try{
  for(const frame of FRAMES){
   if(process.env.BALLOON_ONLY&&!frame.name.includes(process.env.BALLOON_ONLY))continue;
   if(child){try{child.kill('SIGTERM');}catch{}}
   child=server(); await ready('http://127.0.0.1:'+PORT+'/index.html');
   const dest=path.join(OUT,frame.name+'.png');
   if(process.env.BALLOON_SKIP_EXISTING&&fs.existsSync(dest)){console.log('SKIP',frame.name);continue;}
   let ok=false,info=null,samples=0;
   for(let attempt=1;attempt<=2&&!ok;attempt++){
    const browser=await chromium.launch({headless:true,executablePath:env.chromiumExecutable(),args:['--disable-frame-rate-limit','--disable-dev-shm-usage']});
    try{
     const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2});
     page.setDefaultTimeout(240000);
     if(frame.meadowOnly){
      await page.goto('http://127.0.0.1:'+PORT+'/?meadowGameplay=1',{waitUntil:'load',timeout:240000});
      await page.waitForFunction(()=>{try{return globalThis.__worldIntegration.snapshot().state==='meadow';}catch{return false;}},{timeout:240000}).catch(()=>null);
      await page.waitForTimeout(1500);
      const state=await page.evaluate(()=>{try{return globalThis.__worldIntegration.snapshot().state;}catch{return null;}});
      if(state==='meadow'){await page.screenshot({path:dest,type:'png'});ok=true;}
      info={meadowOnly:true,state};samples=0;
      console.log(ok?'SHOT':'MISS',frame.name,'try'+attempt,JSON.stringify(info));
     }else{
     const q='?balloonPreview=1&balloonNight='+frame.night+'&balloonAt='+frame.t;
     await page.goto('http://127.0.0.1:'+PORT+'/'+q,{waitUntil:'load',timeout:240000});
     const hit=await page.waitForFunction(t=>{const b=globalThis.__QF_BALLOON;return !!(b&&b.hold&&Math.abs(b.t-t)<0.25);},frame.t,{timeout:240000,polling:250}).catch(()=>null);
     await page.waitForTimeout(800);
     info=await page.evaluate(()=>{
      const b=globalThis.__QF_BALLOON||null;
      const h=globalThis.__QF_BALLOON_HANDOFF||null;
      let dc=null;try{dc=globalThis.cc.director.root.device.numDrawCalls;}catch{}
      return {b,h,dc};
     });
     samples=await page.evaluate(()=>new Promise(ok=>{const t0=performance.now();let n=0;function step(now){n++;if(now-t0<1000)requestAnimationFrame(step);else ok(n);}requestAnimationFrame(step);}));
     if(hit){await page.screenshot({path:dest,type:'png'});ok=true;}
     console.log(ok?'SHOT':'MISS',frame.name,'try'+attempt,JSON.stringify({fps:samples,dc:info&&info.dc,t:info&&info.b&&info.b.t,dcWorst:info&&info.b&&info.b.dcWorst,fade:info&&info.h&&info.h.fade}));
     }
    }finally{await browser.close();}
   }
   log.push({name:frame.name,ok,fps:samples,info});
  }
  fs.writeFileSync(path.join(OUT,'capture.json'),JSON.stringify(log,null,2));
 }finally{try{if(child)child.kill('SIGTERM');}catch{}}
}
main().catch(e=>{console.error(e);process.exit(1);});
