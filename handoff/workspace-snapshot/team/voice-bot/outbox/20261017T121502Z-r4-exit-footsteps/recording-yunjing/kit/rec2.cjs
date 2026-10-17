// node rec2.cjs <cfg.json> — test harness only (no game code). Mac headless Chromium (GPU), CDP screencast frames with
// timestamps, in-page WebAudio PCM tap (tap.js), buffer-start + [QF_AUDIO] log tap (steptap.js), A/V markers.
const {chromium}=require(process.env.PWCORE||'./playwright-core');const fs=require('fs'),path=require('path');
const cfg=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const out=cfg.out;fs.mkdirSync(out+'/frames',{recursive:true});
const log=(...a)=>{const s=new Date().toISOString()+' '+a.join(' ');console.log(s);fs.appendFileSync(out+'/run.log',s+'\n');};
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:cfg.chrome,args:[...(cfg.args||['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']),'--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const ctx=await b.newContext({viewport:{width:cfg.w,height:cfg.h},deviceScaleFactor:cfg.dpr||2,hasTouch:true,timezoneId:cfg.tz||'Asia/Shanghai'});
 if(cfg.init)await ctx.addInitScript(cfg.init);
 await ctx.addInitScript({path:path.join(__dirname,'tap.js')});await ctx.addInitScript({path:path.join(__dirname,'steptap.js')});const p=await ctx.newPage();
 p.on('console',m=>{fs.appendFileSync(out+'/console_full.log',new Date().toISOString()+' ['+m.type()+'] '+m.text().slice(0,1000)+'\n');});
 p.on('pageerror',e=>fs.appendFileSync(out+'/console_full.log','PAGEERROR '+String(e).slice(0,600)+'\n'));
 await p.goto(`http://127.0.0.1:${cfg.port}/${cfg.query||''}`,{waitUntil:'commit'});
 await p.waitForFunction(()=>{try{const s=__worldIntegration.snapshot();return s.state==='home'&&s.characterReady!==false;}catch{return false;}},{},{timeout:900000,polling:500});
 log('home ready');const gl=await p.evaluate(()=>{const c=document.createElement('canvas').getContext('webgl');const e=c&&c.getExtension('WEBGL_debug_renderer_info');return e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):'?';});log('renderer',gl);
 await p.evaluate(()=>{(globalThis).__worldFlowLog=true;});
 await p.evaluate(async()=>{const cc=await System.import('cc');window.__cc=cc;const s=cc.director.getScene();window.__ga=()=>{for(const c of s.getComponentsInChildren(cc.Component))if(typeof c.setSfxMuted==='function'&&typeof c.isSfxMuted==='function')return c;return null;};
  window.__fps=[];let lt=0;cc.director.on(cc.Director.EVENT_AFTER_DRAW,()=>{const n=performance.now();if(window.__qfTap.recording)window.__fps.push(+(n-lt).toFixed(2));lt=n;});});
 const cdp=await ctx.newCDPSession(p);let nf=0;const frames=[];
 cdp.on('Page.screencastFrame',async f=>{const k=nf++;fs.writeFileSync(`${out}/frames/${String(k).padStart(6,'0')}.jpg`,Buffer.from(f.data,'base64'));frames.push([k,f.metadata.timestamp]);try{await cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId});}catch{}});
 const perfEpoch=await p.evaluate(()=>performance.timeOrigin);
 const startRec=async()=>{await cdp.send('Page.startScreencast',{format:'jpeg',quality:cfg.quality||80,maxWidth:cfg.w*(cfg.dpr||2),maxHeight:cfg.h*(cfg.dpr||2),everyNthFrame:1});await p.evaluate(()=>{__qfTap.start();});log('recording');};
 for(const s of cfg.steps||[]){log('step',JSON.stringify(s));
  if(s.op==='startRec')await startRec();
  else if(s.op==='wait')await p.waitForTimeout(s.ms);
  else if(s.op==='marker'){const m=await p.evaluate(ms=>__qfTap.marker(ms),s.ms||120);log('marker',JSON.stringify(m));fs.appendFileSync(out+'/markers.jsonl',JSON.stringify(m)+'\n');await p.waitForTimeout(600);}
  else if(s.op==='eval'){const r=await p.evaluate(s.js);log('eval ->',JSON.stringify(r)?.slice(0,400));}
  else if(s.op==='until'){await p.waitForFunction(s.js,{},{timeout:s.timeout||300000,polling:50});log('until ok');}
  else if(s.op==='play'){p.evaluate(s.js).then(r=>log('play ->',JSON.stringify(r)?.slice(0,300))).catch(e=>log('play err',String(e).slice(0,300)));}
  else if(s.op==='tap'){await p.touchscreen.tap(s.x,s.y);log('tap',s.x,s.y);}
  else if(s.op==='shot'){await p.screenshot({path:`${out}/${s.name}.png`}).catch(()=>{});log('shot',s.name);}
 }
 await cdp.send('Page.stopScreencast');await p.evaluate(()=>{__qfTap.stop();});log('stopped');
 const meta=await p.evaluate(()=>({tap:__qfTap.meta(),media:__qfTap.media,events:__qfTap.events,startPerf:__qfTap.startPerf,stopPerf:__qfTap.stopPerf}));
 for(const m of meta.tap){if(!m.wlBlocks)continue;const fd=fs.openSync(`${out}/audio_wl${m.i}.pcm`,'w');const f0=[];for(let k=0;k<m.wlBlocks;k+=50){const x=await p.evaluate(([i,k])=>__qfTap.wlpcm(i,k,50),[m.i,k]);fs.writeSync(fd,Buffer.from(x.b64,'base64'));f0.push(...x.f0);}fs.closeSync(fd);m.wlF0=f0;}
 const ev=await p.evaluate(()=>({src:{starts:__qfSrc.starts,len:__qfSrc.len},logs:__qfLogs,marks:__qfMarks,states:__qfStates,fps:__fps}));
 const pcm=await p.evaluate(()=>__qfSrc.pcm);fs.writeFileSync(out+'/buffers.json',JSON.stringify(pcm));
 fs.writeFileSync(out+'/events.json',JSON.stringify(ev));
 fs.writeFileSync(out+'/console.log',ev.logs.map(([t,s])=>new Date(perfEpoch+t).toISOString()+' perf='+t.toFixed(1)+' '+s).join('\n')+'\n');
 fs.writeFileSync(out+'/meta.json',JSON.stringify({cfg,perfEpoch,renderer:gl,frames,audio:meta},null,0));
 log('saved',frames.length,'frames',ev.logs.length,'logs',ev.src.starts.length,'starts',meta.tap.map(t=>t.kind+':wl'+t.wlBlocks+(t.wlErr?'('+t.wlErr+')':'')).join(','));await b.close();
})().catch(e=>{log('FATAL',String(e.stack||e).slice(0,800));process.exit(1);});
