#!/usr/bin/env node
'use strict';
/** Screenshots of the built web-test. Requires ?qa=1 so qaShot exists. Not shipped in the player package. */
const fs=require('node:fs');
const path=require('node:path');
const {playwright,chromiumExecutable}=require('../qf-env.cjs');
const {chromium}=playwright();
const OUT=path.resolve(process.argv[2]||'docs/r5/region-nodes-r2/shots');
const BASE=process.env.QF_SHOT_URL||'http://127.0.0.1:8765/?qa=1';
const SHOTS=[
 {file:'island-blend.png',spec:{region:'island',lens:'blend'}},
 {file:'island-walk.png',spec:{region:'island',lens:'walk'}},
 {file:'island-board.png',spec:{region:'island',lens:'board'}},
 {file:'island-markers.png',spec:{region:'island',lens:'markers'}},
 {file:'island-map.png',spec:{region:'island',lens:'map'}},
 {file:'island-tap.png',spec:{region:'island',lens:'tap'},wait:700},
 {file:'meadow-blend.png',spec:{region:'meadow',lens:'blend'}},
 {file:'meadow-walk.png',spec:{region:'meadow',lens:'walk'}},
 {file:'meadow-board.png',spec:{region:'meadow',lens:'board'}},
 {file:'meadow-markers.png',spec:{region:'meadow',lens:'markers'}},
 {file:'meadow-map.png',spec:{region:'meadow',lens:'map'}},
 {file:'meadow-tap.png',spec:{region:'meadow',lens:'tap'},wait:700},
 {file:'meadow-night.png',spec:{region:'meadow',lens:'markers',night:true}},
 {file:'sky-blend.png',spec:{region:'skycity',lens:'blend'}},
 {file:'sky-walk.png',spec:{region:'skycity',lens:'walk'}},
 {file:'sky-board.png',spec:{region:'skycity',lens:'board'}},
 {file:'sky-markers.png',spec:{region:'skycity',lens:'markers'}},
 {file:'sky-map.png',spec:{region:'skycity',lens:'map'}},
 {file:'sky-tap.png',spec:{region:'skycity',lens:'tap'},wait:700},
 {file:'sky-finale.png',spec:{region:'skycity',lens:'finale'}},
 {file:'sky-prop.png',spec:{region:'skycity',lens:'prop',prop:'windchime'},wait:220},
];
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable()});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>{try{return typeof globalThis.__worldIntegration?.qaShot==='function'&&globalThis.__worldIntegration.snapshot().characterReady;}catch{return false;}},{timeout:180000});
 const log=[];
 for(const shot of SHOTS){
  const result=await page.evaluate(async spec=>globalThis.__worldIntegration.qaShot(spec),shot.spec);
  await page.waitForTimeout(shot.wait||500);
  const dest=path.join(OUT,shot.file);
  await page.screenshot({path:dest,scale:'css',type:'png'});
  log.push({file:shot.file,result,bytes:fs.statSync(dest).size});
  console.log(shot.file,JSON.stringify(result),fs.statSync(dest).size);
 }
 fs.writeFileSync(path.join(OUT,'shot-log.json'),JSON.stringify({errors:errors.slice(0,40),log},null,1));
 await browser.close();
 if(log.some(x=>!x.result||x.result.ok!==true))process.exit(1);
})().catch(error=>{console.error(error);process.exit(1);});
