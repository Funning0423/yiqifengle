#!/usr/bin/env node
'use strict';
/** 390×844 shots of the real web-test balloon ride. No test banner. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const env=require('../qf-env.cjs');
const ROOT=path.resolve(__dirname,'../..');
const WEB=path.join(ROOT,'creator-build-project/build/web-test');
const OUT=path.join(ROOT,'docs/r5/balloon-fix/shots');
const PORT=Number(process.env.BALLOON_SHOT_PORT||8773);
function server(){
 const child=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:WEB,stdio:['ignore','pipe','pipe']});
 return child;
}
async function ready(url){
 for(let i=0;i<40;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}
 throw Error('server not ready');
}
async function shoot(page,name,pred,timeout=90000){
 const hit=await page.waitForFunction(pred,null,{timeout,polling:100}).catch(()=>null);
 if(!hit){console.log('MISS',name);return null;}
 const info=await page.evaluate(()=>{
  const b=globalThis.__QF_BALLOON||null;
  let dc=null,fps=null;
  try{dc=globalThis.cc&&globalThis.cc.director&&globalThis.cc.director.root&&globalThis.cc.director.root.device&&globalThis.cc.director.root.device.numDrawCalls;}catch{}
  try{fps=globalThis.cc&&globalThis.cc.game&&globalThis.cc.game.frameRate;}catch{}
  return {b,dc,fps};
 });
 const file=path.join(OUT,name+'.png');
 await page.screenshot({path:file,type:'png'});
 console.log('SHOT',name,JSON.stringify(info));
 return info;
}
async function run(browser,query,jobs){
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1});
 page.on('pageerror',e=>console.log('PAGE',String(e).slice(0,240)));
 await page.goto('http://127.0.0.1:'+PORT+'/'+query,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>globalThis.__QF_BALLOON&&globalThis.__QF_BALLOON.t>=0,{timeout:120000});
 const out=[];
 for(const job of jobs)out.push([job.name,await shoot(page,job.name,job.pred)]);
 await page.close();
 return out;
}
async function main(){
 if(!fs.existsSync(path.join(WEB,'index.html')))throw Error('missing web-test');
 fs.mkdirSync(OUT,{recursive:true});
 const child=server();
 const {chromium}=env.playwright();
 const browser=await chromium.launch({headless:true,executablePath:env.chromiumExecutable()});
 try{
  await ready('http://127.0.0.1:'+PORT+'/index.html');
  const day=[
   {name:'390x844-B-b',pred:()=>{const b=globalThis.__QF_BALLOON;return !!(b&&b.beat==='B-b'&&b.t>8);}},
   {name:'390x844-B-c',pred:()=>{const b=globalThis.__QF_BALLOON;return !!(b&&b.beat==='B-c'&&b.alt>0.4&&b.alt<2.5);}},
   {name:'390x844-B-c-late',pred:()=>{const b=globalThis.__QF_BALLOON;return !!(b&&b.alt>=9&&b.alt<=13);}},
   {name:'390x844-B-d',pred:()=>{const b=globalThis.__QF_BALLOON;return !!(b&&b.beat==='B-d'&&b.alt>=20&&b.alt<=27);}},
   {name:'390x844-B-e',pred:()=>{const b=globalThis.__QF_BALLOON;return !!(b&&b.beat==='B-e'&&b.t>22.4);}},
   {name:'390x844-B-f',pred:()=>{const b=globalThis.__QF_BALLOON;return !!(b&&b.beat==='B-f'&&b.t>27);}},
   {name:'390x844-B-h',pred:()=>{const b=globalThis.__QF_BALLOON;return !!(b&&b.beat==='B-h');}},
  ];
  const night=[
   {name:'390x844-night-B-d',pred:()=>{const b=globalThis.__QF_BALLOON;return !!(b&&b.beat==='B-d'&&b.alt>=20&&b.alt<=27);}},
   {name:'390x844-night-B-e',pred:()=>{const b=globalThis.__QF_BALLOON;return !!(b&&b.beat==='B-e'&&b.t>22.4);}},
  ];
  await run(browser,'?balloonPreview=1&night=1',day);
  await run(browser,'?balloonPreview=1',night);
 }finally{
  await browser.close();
  child.kill('SIGTERM');
 }
}
main().catch(e=>{console.error(e);process.exit(1);});
