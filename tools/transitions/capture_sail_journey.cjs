#!/usr/bin/env node
'use strict';
/**
 * Deterministic sail-journey capture (real WorldFlow, ?sailqa=1).
 * Usage: node tools/transitions/capture_sail_journey.cjs before|after [--night]
 * Frames: docs/r5/sail-qa1/frames/<tag>/  (gitignored). CSV: docs/r5/sail-qa1/metrics_<tag>.csv
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.QF_PLAYWRIGHT||'/Users/shineanl/node_modules/playwright');
const tag=process.argv[2]||'before';
const night=process.argv.includes('--night');
const ROOT=path.resolve(__dirname,'../..');
const WEB=path.join(ROOT,'creator-build-project/build/web-test');
const OUT=path.join(ROOT,'docs/r5/sail-qa1');
const FRAMES=path.join(OUT,'frames',tag+(night?'-night':''));
const CHROME=process.env.QF_CHROME||path.join(process.env.HOME,'Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
if(!fs.existsSync(path.join(WEB,'index.html'))){console.error('missing web-test build');process.exit(2);}
fs.mkdirSync(FRAMES,{recursive:true});
function serve(root){
 const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.wasm':'application/wasm'};
 return http.createServer((req,res)=>{
  const u=decodeURIComponent((req.url||'/').split('?')[0]);
  let file=path.join(root,u==='/'?'index.html':u);
  if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,buf)=>{
   if(err){res.writeHead(404);res.end('no');return;}
   res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
   res.end(buf);
  });
 });
}
(async()=>{
 const server=serve(WEB);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port;
 const browser=await chromium.launch({executablePath:CHROME,headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 await page.addInitScript(()=>{
  let now=0,spins=0;const origin=Date.now();
  performance.now=()=>{if(++spins>4000){spins=0;now+=1;}return now;};
  Date.now=()=>origin+Math.floor(now);
  const q=[];
  window.requestAnimationFrame=(cb)=>{q.push(cb);return q.length;};
  window.cancelAnimationFrame=()=>{};
  window.__stepFrame=()=>{spins=0;now+=1000/30;const cbs=q.splice(0,q.length);for(const cb of cbs){try{cb(now);}catch(e){console.error(e);}}return {now,queued:q.length};};
 });
 page.on('console',msg=>{const t=msg.text();if(/QF_SAIL|WORLD_STARTUP|sailqa|Error|error/.test(t))console.log('PAGE',t.slice(0,240));});
 page.on('pageerror',err=>console.log('PAGEERROR',String(err).slice(0,400)));
 const q=night?'sailqa=1&night=1&transport=sail':'sailqa=1&transport=sail';
 await page.goto('http://127.0.0.1:'+port+'/index.html?'+q,{waitUntil:'domcontentloaded',timeout:120000});
 let shots=0,lastN=0,stable=0,seenSail=false;
 const index=[];
 for(let i=0;i<30*90;i++){
  await page.evaluate(()=>window.__stepFrame&&window.__stepFrame());
  const info=await page.evaluate(()=>{
   const snap=window.__worldIntegration&&window.__worldIntegration.snapshot&&window.__worldIntegration.snapshot();
   const qa=window.__sailQa;const frames=qa&&qa.frames||[];const last=frames[frames.length-1]||null;
   return {state:snap&&snap.state,n:frames.length,beat:last&&last.beat,phase:last&&last.phase,t:last&&last.t};
  });
  if(info.n>lastN){lastN=info.n;stable=0;seenSail=true;}else stable++;
  if(seenSail&&i%2===0){
   const name=String(shots).padStart(5,'0')+'.png';
   await page.screenshot({path:path.join(FRAMES,name),type:'png'});
   index.push({file:name,i,state:info.state,beat:info.beat,t:info.t,n:info.n});
   shots++;
  }
  if(i%30===0)console.log('step',i,'state',info.state,'frames',info.n,'beat',info.beat,'shots',shots);
  if(seenSail&&info.state==='meadow'&&stable>40)break;
  if(!seenSail&&i>30*40){console.error('sail never started',JSON.stringify(info));break;}
 }
 const dumped=await page.evaluate(()=>window.__sailQa||{frames:[],cues:[]});
 fs.writeFileSync(path.join(FRAMES,'probe.json'),JSON.stringify({cues:dumped.cues,frames:dumped.frames}));
 fs.writeFileSync(path.join(FRAMES,'shots.json'),JSON.stringify(index));
 const cols=['frame','t','real','beat','phase','departed','gx','gy','gz','girlActive','girlRenderers','parent','boatx','boaty','boatz','yaw','roll','cx','cy','cz','fov','near','far','clip','rate','cockpit','clear','seas'];
 const lines=[cols.join(',')];
 (dumped.frames||[]).forEach((f,n)=>{
  const g=f.girl||['','',''],b=f.boat||['','',''],c=f.cam||['','',''];
  const seas=(f.seas||[]).map(s=>s.name+':'+s.y+':'+(s.active?1:0)+':'+(s.enabled?1:0)).join('|');
  const cockpit=(f.cockpit||[]).map(p=>p.join(':')).join('|');
  const clear=(f.clear||[]).join(':');
  lines.push([n,f.t,f.real,f.beat,f.phase,f.departed?1:0,g[0],g[1],g[2],f.girlActive?1:0,f.girlRenderers,f.parent||'',b[0],b[1],b[2],f.yaw,f.roll,c[0],c[1],c[2],f.fov,f.near,f.far,f.clip||'',f.rate,cockpit,clear,seas].join(','));
 });
 const csvName='metrics_'+tag+(night?'-night':'')+'.csv';
 fs.writeFileSync(path.join(OUT,csvName),lines.join('\n'));
 console.log(JSON.stringify({tag,night,shots,frames:(dumped.frames||[]).length,cues:dumped.cues,csv:csvName,framesDir:FRAMES}));
 const py=path.join(__dirname,'analyze_sail_pixels.py');
 if(fs.existsSync(py)){
  const {spawnSync}=require('node:child_process');
  const pix=spawnSync('python3',[py,FRAMES,path.join(OUT,csvName)],{stdio:'inherit'});
  if(pix.status)process.exit(pix.status||1);
 }
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
