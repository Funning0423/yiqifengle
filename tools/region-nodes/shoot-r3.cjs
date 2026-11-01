#!/usr/bin/env node
'use strict';
/** Screenshots of the built web-test. Requires ?qa=1 so qaShot exists. Not shipped in the player package. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {playwright,chromiumExecutable}=require('../qf-env.cjs');
const {chromium}=playwright();
const OUT=path.resolve(process.argv[2]||'docs/r5/region-nodes-r3/shots');
const BASE=process.env.QF_SHOT_URL||'http://127.0.0.1:8765/?qa=1';
const SHOTS=[
 {file:'island-blend.png',spec:{region:'island',lens:'blend'}},
 {file:'island-walk.png',spec:{region:'island',lens:'walk'}},
 {file:'island-board.png',spec:{region:'island',lens:'board'},wait:900},
 {file:'island-markers.png',spec:{region:'island',lens:'markers'}},
 {file:'island-map.png',spec:{region:'island',lens:'map'}},
 {file:'island-tap.png',spec:{region:'island',lens:'tap'},wait:700},
 {file:'island-prop.png',spec:{region:'island',lens:'prop',prop:'palm'},wait:220},
 {file:'meadow-blend.png',spec:{region:'meadow',lens:'blend'}},
 {file:'meadow-walk.png',spec:{region:'meadow',lens:'walk'}},
 {file:'meadow-board.png',spec:{region:'meadow',lens:'board'},wait:900},
 {file:'meadow-markers.png',spec:{region:'meadow',lens:'markers'}},
 {file:'meadow-map.png',spec:{region:'meadow',lens:'map'}},
 {file:'meadow-tap.png',spec:{region:'meadow',lens:'tap'},wait:700},
 {file:'meadow-prop.png',spec:{region:'meadow',lens:'prop',prop:'bell'},wait:220},
 {file:'meadow-night.png',spec:{region:'meadow',lens:'markers',night:true}},
 {file:'sky-blend.png',spec:{region:'skycity',lens:'blend'}},
 {file:'sky-walk.png',spec:{region:'skycity',lens:'walk'}},
 {file:'sky-board.png',spec:{region:'skycity',lens:'board'},wait:900},
 {file:'sky-markers.png',spec:{region:'skycity',lens:'markers'}},
 {file:'sky-map.png',spec:{region:'skycity',lens:'map'}},
 {file:'sky-tap.png',spec:{region:'skycity',lens:'tap'},wait:700},
 {file:'sky-prop.png',spec:{region:'skycity',lens:'prop',prop:'robot'},wait:220},
 {file:'sky-finale.png',spec:{region:'skycity',lens:'finale'},wait:600},
];
function md5(file){return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');}
async function sampleDraws(page,frames){
 return page.evaluate(async n=>{
  const cc=await (globalThis.System?System.import('cc'):Promise.reject(Error('no System')));
  const {director,Director}=cc;
  return await new Promise(resolve=>{
   const samples=[];let last=performance.now();
   const timer=setTimeout(()=>{director.off(Director.EVENT_AFTER_DRAW,onDraw);resolve(samples);},8000);
   const onDraw=()=>{
    const now=performance.now(),d=director.root&&director.root.device;
    samples.push({intervalMs:now-last,drawCalls:d?d.numDrawCalls:null,triangles:d?d.numTris:null});
    last=now;
    if(samples.length>=n){clearTimeout(timer);director.off(Director.EVENT_AFTER_DRAW,onDraw);resolve(samples);}
   };
   director.on(Director.EVENT_AFTER_DRAW,onDraw);
  });
 },frames);
}
function summarize(samples){
 const calls=samples.map(s=>s.drawCalls).filter(n=>typeof n==='number');
 const dt=samples.map(s=>s.intervalMs).filter(n=>n>0&&n<5000);
 const mid=a=>{const b=a.slice().sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:null;};
 return {frames:samples.length,drawCalls:mid(calls),drawMin:calls.length?Math.min(...calls):null,drawMax:calls.length?Math.max(...calls):null,intervalMs:mid(dt),fps:mid(dt)?+(1000/mid(dt)).toFixed(2):null};
}
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable()});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.setDefaultTimeout(180000);
 await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>{try{return typeof globalThis.__worldIntegration?.qaShot==='function'&&globalThis.__worldIntegration.snapshot().characterReady;}catch{return false;}},{timeout:180000});
 const seen=new Map();
 const log=[];
 const perf={};
 async function take(shot,attempt){
  const t0=performance.now();
  const result=await page.evaluate(async spec=>globalThis.__worldIntegration.qaShot(spec),shot.spec);
  await page.waitForTimeout(shot.wait||500);
  const dest=path.join(OUT,shot.file);
  await page.screenshot({path:dest,scale:'css',type:'png'});
  const hash=md5(dest);
  const dup=[...seen.entries()].find(([file,h])=>h===hash&&file!==shot.file);
  if(dup&&attempt<2){
   console.log('dup',shot.file,'==',dup[0],'retake',attempt+1);
   await page.waitForTimeout(400);
   return take(shot,attempt+1);
  }
  seen.set(shot.file,hash);
  const row={file:shot.file,result,bytes:fs.statSync(dest).size,md5:hash,dup:dup?dup[0]:null,shotMs:+(performance.now()-t0).toFixed(0)};
  log.push(row);
  console.log(shot.file,JSON.stringify(result),row.bytes,hash.slice(0,8),dup?'DUP '+dup[0]:'');
  return row;
 }
 for(const shot of SHOTS){
  const row=await take(shot,0);
  if(shot.spec.lens==='board'&&shot.spec.region==='island'&&!perf.board){
   const t0=performance.now();
   perf.boardPresentMs=await page.evaluate(async()=>{
    const cc=await System.import('cc');
    const {director,Director}=cc;
    const start=performance.now();
    return await new Promise(resolve=>{
     const timer=setTimeout(()=>{director.off(Director.EVENT_AFTER_DRAW,on);resolve(null);},4000);
     const on=()=>{clearTimeout(timer);director.off(Director.EVENT_AFTER_DRAW,on);resolve(+(performance.now()-start).toFixed(2));};
     director.on(Director.EVENT_AFTER_DRAW,on);
    });
   });
   perf.board=summarize(await sampleDraws(page,40));
   perf.boardShotMs=row.shotMs;
   perf.boardSampleMs=+(performance.now()-t0).toFixed(0);
   perf.note='Headless web-test. boardPresentMs is the wait for the next AFTER_DRAW after the board frame, not a 16.7 ms budget. FPS is 1000/median frame interval and is limited by software GL.';
  }
  if(shot.spec.lens==='markers'&&!perf[shot.spec.region]){
   perf[shot.spec.region]=summarize(await sampleDraws(page,30));
   if(shot.spec.region==='island'){
    const delta=await page.evaluate(async()=>{
     const cc=await System.import('cc');
     const {director,Director}=cc;
     const scene=director.getScene();
     const node=scene&&scene.getChildByName('RegionNodeMarkers');
     const read=()=>new Promise(resolve=>{
      const on=()=>{director.off(Director.EVENT_AFTER_DRAW,on);resolve(director.root&&director.root.device?director.root.device.numDrawCalls:null);};
      director.on(Director.EVENT_AFTER_DRAW,on);
     });
     const on=await read();
     if(node)node.active=false;
     const off=await read();
     if(node)node.active=true;
     return {withMarkers:on,withoutMarkers:off,delta:on!=null&&off!=null?on-off:null};
    });
    perf.markerDc=delta;
   }
  }
 }
 const hashes=[...seen.values()];
 const unique=new Set(hashes).size;
 fs.writeFileSync(path.join(OUT,'shot-log.json'),JSON.stringify({errors:errors.slice(0,40),unique,files:hashes.length,perf,log},null,1));
 await browser.close();
 for(const file of SHOTS.map(s=>s.file)){
  const dest=path.join(OUT,file);
  execFileSync('sips',['-Z','900',dest],{stdio:'ignore'});
 }
 if(log.some(x=>!x.result||x.result.ok!==true))process.exit(1);
 if(log.some(x=>x.dup)){console.error('duplicate screenshots remain');process.exit(1);}
 if(unique!==SHOTS.length){console.error('hash collision',unique,SHOTS.length);process.exit(1);}
 console.log('shots',SHOTS.length,'unique',unique);
 console.log('perf',JSON.stringify(perf));
})().catch(error=>{console.error(error);process.exit(1);});
