#!/usr/bin/env node
'use strict';
/** Record one full balloon ride (day or night) at 390×844, 30 fps, then compress to ≤1.5 MB. */
const fs=require('fs'),path=require('path'),{spawn,spawnSync}=require('child_process');
const env=require('../qf-env.cjs');
const ROOT=path.resolve(__dirname,'../..');
const WEB=path.join(ROOT,'creator-build-project/build/web-test');
const OUT=path.join(ROOT,'docs/r5/balloon-v26fix/shots');
const PORT=Number(process.env.BALLOON_SHOT_PORT||8787);
const NIGHT=process.env.BALLOON_RIDE_NIGHT==='1';
const NAME=NIGHT?'balloon_ride_night':'balloon_ride_day';

function server(){return spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:WEB,stdio:['ignore','pipe','pipe']});}
async function ready(url){
 for(let i=0;i<60;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(2000)});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,300));}
 throw Error('server not ready');
}
async function main(){
 if(!fs.existsSync(path.join(WEB,'index.html')))throw Error('missing web-test');
 fs.mkdirSync(OUT,{recursive:true});
 const {chromium}=env.playwright();
 const child=server();
 const tmp=path.join(OUT,'.ride-'+NAME);
 fs.rmSync(tmp,{recursive:true,force:true});
 fs.mkdirSync(tmp);
 try{
  await ready('http://127.0.0.1:'+PORT+'/index.html');
  const browser=await chromium.launch({headless:true,executablePath:env.chromiumExecutable(),args:['--disable-frame-rate-limit','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1,recordVideo:{dir:tmp,size:{width:390,height:844}}});
  const page=await context.newPage();
  page.setDefaultTimeout(300000);
  const q='?balloonPreview=1&balloonNight='+(NIGHT?1:0);
  const t0=Date.now();
  await page.goto('http://127.0.0.1:'+PORT+'/'+q,{waitUntil:'load',timeout:240000});
  const log=[];
  let seen=false,done=false;
  const deadline=Date.now()+240000;
  while(Date.now()<deadline&&!done){
   const s=await page.evaluate(()=>{
    const b=globalThis.__QF_BALLOON||null;
    const c=globalThis.__QF_BALLOON_CAM||null;
    return {t:b?b.t:null,total:b?b.total:null,dc:b?b.dc:null,dcWorst:b?b.dcWorst:null,cam:c};
   });
   log.push({wall:Date.now()-t0,t:s.t,dc:s.dc,dcWorst:s.dcWorst,cam:s.cam});
   if(s.t!=null)seen=true;
   if(seen&&s.t!=null&&s.total!=null&&s.t>=s.total-0.05)done=true;
   await page.waitForTimeout(100);
  }
  if(!done)throw Error('ride did not finish '+JSON.stringify(log.at(-1)));
  await page.waitForTimeout(400);
  const video=page.video();
  await context.close();
  await browser.close();
  const src=await video.path();
  fs.writeFileSync(path.join(OUT,NAME+'.json'),JSON.stringify({night:NIGHT,samples:log},null,2));
  const start=log.find(s=>s.t!=null&&s.t>=0.05);
  const end=log.findLast?log.findLast(s=>s.t!=null):[...log].reverse().find(s=>s.t!=null);
  const ss=Math.max(0,(start?start.wall:0)/1000-0.05);
  const to=Math.max(ss+1,(end?end.wall:0)/1000+0.15);
  const dest=path.join(OUT,NAME+'.mp4');
  let crf=30,ok=false;
  for(;crf<=40&&!ok;crf+=2){
   const ff=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-ss',ss.toFixed(3),'-to',to.toFixed(3),'-i',src,'-an','-vf','scale=390:-2,fps=30','-c:v','libx264','-pix_fmt','yuv420p','-crf',String(crf),'-movflags','+faststart',dest],{encoding:'utf8'});
   if(ff.status)throw Error(ff.stderr||'ffmpeg failed');
   const sz=fs.statSync(dest).size;
   console.log('ENCODE',NAME,'crf',crf,'bytes',sz,'window',ss.toFixed(2),to.toFixed(2));
   if(sz<=1.5*1024*1024)ok=true;
  }
  if(!ok)throw Error(NAME+' still over 1.5MB');
 }finally{
  try{child.kill('SIGTERM');}catch{}
  fs.rmSync(tmp,{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e);process.exit(1);});
