'use strict';
const path=require('node:path'),H=require('./harness.cjs');
(async()=>{const id=H.runId(),profile=path.join(H.OUT,'profile-gpu-'+id),t0=Date.now();const {context,page}=await H.launch(profile);
 const r=await page.evaluate(()=>{const c=document.createElement('canvas'),gl=c.getContext('webgl2')||c.getContext('webgl');const d=gl&&gl.getExtension('WEBGL_debug_renderer_info');return {renderer:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl&&gl.getParameter(gl.RENDERER),ua:navigator.userAgent};});
 const fps=await page.evaluate(()=>new Promise(ok=>{let n=0;const t=performance.now();const f=()=>{n++;if(performance.now()-t<3000)requestAnimationFrame(f);else ok(n/3);};requestAnimationFrame(f);}));
 console.log(JSON.stringify({exe:process.env.QF_CHROMIUM_EXECUTABLE,readyMs:Date.now()-t0,fps,...r}));await context.close();})().catch(e=>{console.error(e);process.exit(1);});
