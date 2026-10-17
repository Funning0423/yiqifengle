#!/usr/bin/env node
'use strict';
/** 390×844 shots of the real web-test world at the v2.3 balloon keyframes. No test banner. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const env=require('../qf-env.cjs');
const ROOT=path.resolve(__dirname,'../..');
const WEB=path.join(ROOT,'creator-build-project/build/web-test');
const OUT=path.join(ROOT,'docs/r5/balloon-v22/shots');
const PORT=Number(process.env.BALLOON_SHOT_PORT||8775);
const FRAMES=[
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
 for(let i=0;i<40;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}
 throw Error('server not ready');
}
async function main(){
 if(!fs.existsSync(path.join(WEB,'index.html')))throw Error('missing web-test');
 fs.mkdirSync(OUT,{recursive:true});
 const child=server();
 const {chromium}=env.playwright();
 const log=[];
 try{
  await ready('http://127.0.0.1:'+PORT+'/index.html');
  for(const frame of FRAMES){
   if(process.env.BALLOON_ONLY&&!frame.name.includes(process.env.BALLOON_ONLY))continue;
   const browser=await chromium.launch({headless:true,executablePath:env.chromiumExecutable(),args:['--disable-frame-rate-limit']});
   try{
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2});
    page.on('pageerror',e=>console.log('PAGE',String(e).slice(0,400)));
    page.on('console',msg=>{if(msg.type()==='error')console.log('CONSOLE',msg.text().slice(0,300));});
    const q='?balloonPreview=1&balloonNight='+frame.night+'&balloonAt='+frame.t;
    await page.goto('http://127.0.0.1:'+PORT+'/'+q,{waitUntil:'domcontentloaded',timeout:180000});
    const hit=await page.waitForFunction(t=>{const b=globalThis.__QF_BALLOON;return !!(b&&b.hold&&Math.abs(b.t-t)<0.2);},frame.t,{timeout:180000,polling:200}).catch(()=>null);
    await page.waitForTimeout(700);
    const info=await page.evaluate(()=>{
     const b=globalThis.__QF_BALLOON||null;
     const h=globalThis.__QF_BALLOON_HANDOFF||null;
     let dc=null;try{dc=globalThis.cc.director.root.device.numDrawCalls;}catch{}
     return {b,h,dc};
    });
    const samples=await page.evaluate(()=>new Promise(ok=>{const t0=performance.now();let n=0;function step(now){n++;if(now-t0<1000)requestAnimationFrame(step);else ok(n);}requestAnimationFrame(step);}));
    const file=path.join(OUT,frame.name+'.png');
    if(hit)await page.screenshot({path:file,type:'png'});
    log.push({name:frame.name,ok:!!hit,fps:samples,info});
    console.log(hit?'SHOT':'MISS',frame.name,JSON.stringify({fps:samples,dc:info&&info.dc,t:info&&info.b&&info.b.t,fade:info&&info.h&&info.h.fade}));
   }finally{await browser.close();}
  }
  fs.writeFileSync(path.join(OUT,'capture.json'),JSON.stringify(log,null,2));
 }finally{child.kill('SIGTERM');}
}
main().catch(e=>{console.error(e);process.exit(1);});
