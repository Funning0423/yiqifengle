'use strict';
/** Optional preview / GL smoke (GGbot): runs the REAL build-templates/wechatgame/first-screen.js in headless Chrome WebGL
 * (SwiftShader) with the same call order as the generated game.js, screenshots it, then draws the scene loading layer
 * frames with a 2D canvas from StartupLoadingLayout numbers (takeover frame = intro opacity 0; +INTRO_FADE_S; 50%):
 *   fs_<aspect>.png            first screen (WebGL, after start())
 *   fs_after_end_<aspect>.png  same canvas after end() (no engine yet): must still show the picture, not black
 *   layer0_<aspect>.png        scene layer takeover frame (2D canvas emulation, NOT Cocos)
 *   layer_intro_<aspect>.png   scene layer after the 0.25 s intro, ribbon at its start
 *   layer50_<aspect>.png       scene layer at 50 %
 * and diff stats in render_report.json. Needs playwright(-core) + Chrome: QF_PLAYWRIGHT_MODULE, QF_CHROMIUM_EXECUTABLE.
 * Usage: node tools/first-screen/render_first_screen.cjs <out dir> */
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');
const root=path.resolve(__dirname,'..','..'),T=path.join(root,'creator-build-project/build-templates/wechatgame');
const out=path.resolve(process.argv[2]||path.join(os.tmpdir(),'first-screen-render'));fs.mkdirSync(out,{recursive:true});
const pw=require(process.env.QF_PLAYWRIGHT_MODULE||'playwright-core');
const ts=(()=>{try{return require('../qf-env.cjs').typescript();}catch(e){return require(path.join(root,'..','..','character-core','lighthouse-island-astra-ultra','tools','vendor-node','node_modules','typescript'));}})();
const layoutJs=ts.transpileModule(fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/ui/StartupLoadingLayout.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;
const SCREENS=[['16x9',375,667],['19.5x9',390,844],['4x3',768,1024]];const DPR=2;
const page=`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f0f"><canvas id=c></canvas><script>
var module={exports:{}};var exports=module.exports;</script><script src="first-screen.js"></script><script>
window.FSM=module.exports;var lm={exports:{}};(function(module,exports){${layoutJs}})(lm,lm.exports);window.L=lm.exports;
function img(u){return new Promise(function(r){var i=new Image();i.onload=function(){r(i)};i.src=u;});}
window.layer=async function(W,H,p,intro){var cv=document.createElement('canvas');cv.width=W;cv.height=H;var g=cv.getContext('2d');var c=L.coverTransform(W,H);
 var base=await img(L.ART.composite),fill=await img(L.ART.fill),pin=await img(L.ART.pinwheel);g.fillStyle='rgb('+L.BACKDROP_RGB.join(',')+')';g.fillRect(0,0,W,H);
 g.imageSmoothingQuality='low';g.drawImage(base,c.dx,c.dy,c.w,c.h);if(intro>0){g.globalAlpha=intro;var h=L.ribbonHead(p),fw=L.BAR.w*h.fillRange;
 g.drawImage(fill,0,0,fw,L.BAR.h,L.BAR.x*c.s+c.dx,L.BAR.y*c.s+c.dy,fw*c.s,L.BAR.h*c.s);g.save();g.translate(h.x*c.s+c.dx,h.y*c.s+c.dy);g.rotate(-70*p*Math.PI/180);g.drawImage(pin,-30*c.s,-30*c.s,60*c.s,60*c.s);g.restore();
 g.font=(L.HINT.size*c.s)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';var t=L.HINTS[p>=0.5?1:0];var y=L.HINT.centerY*c.s+c.dy;
 g.fillStyle='rgba(255,250,238,0.7)';g.fillText(t,W/2+c.s,y+c.s);g.fillStyle=L.HINT.color;g.fillText(t,W/2,y);}return cv.toDataURL('image/png');};
</script></body></html>`;
const files={'/index.html':Buffer.from(page),'/first-screen.js':fs.readFileSync(path.join(T,'first-screen.js'))};
for(const f of fs.readdirSync(path.join(T,'startup-art')))files['/startup-art/'+f]=fs.readFileSync(path.join(T,'startup-art',f));
const srv=http.createServer((q,r)=>{const b=files[q.url.split('?')[0]];if(!b){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':q.url.endsWith('.js')?'text/javascript; charset=utf-8':q.url.endsWith('.html')?'text/html; charset=utf-8':q.url.endsWith('.png')?'image/png':'image/jpeg'});r.end(b);});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+srv.address().port+'/index.html';
 const browser=await pw.chromium.launch({executablePath:process.env.QF_CHROMIUM_EXECUTABLE||'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const report={renderer:null,screens:[]};
 for(const [name,w,h] of SCREENS){const pg=await browser.newPage({viewport:{width:w*DPR,height:h*DPR},deviceScaleFactor:1});await pg.goto(url);
  const info=await pg.evaluate(async([W,H])=>{const c=document.getElementById('c');c.width=W;c.height=H;window.canvas=c;
   await FSM.start('false','true','false');const gl=c.getContext('webgl');const d=gl.getExtension('WEBGL_debug_renderer_info');
   return {state:{ready:__firstScreen.ready,error:__firstScreen.error,frames:__firstScreen.frames},renderer:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),glError:gl.getError()};},[w*DPR,h*DPR]);
  report.renderer=info.renderer;await pg.waitForTimeout(150);
  await pg.screenshot({path:path.join(out,`fs_${name}.png`)});
  await pg.evaluate(async()=>{await FSM.end();});await pg.waitForTimeout(300);await pg.screenshot({path:path.join(out,`fs_after_end_${name}.png`)});
  for(const [tag,p,intro] of [['layer0',0,0],['layer_intro',0,1],['layer50',0.5,1]]){const data=await pg.evaluate(([W,H,p,i])=>window.layer(W,H,p,i),[w*DPR,h*DPR,p,intro]);fs.writeFileSync(path.join(out,`${tag}_${name}.png`),Buffer.from(data.split(',')[1],'base64'));}
  report.screens.push({name,logical:[w,h],canvas:[w*DPR,h*DPR],firstScreen:info.state,glError:info.glError});await pg.close();}
 await browser.close();srv.close();fs.writeFileSync(path.join(out,'render_report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);srv.close();process.exitCode=1;});
