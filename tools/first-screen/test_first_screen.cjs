'use strict';
/** Box test for the custom WeChat first screen + scene loading layer (GGbot, docs/first-screen.md).
 *  A. first-screen.js (build-templates/wechatgame) run in a vm exactly like the generated game.js drives it
 *     (start -> setProgress 0.2/0.4/0.6 -> end), with a recording fake WebGL context and fake Image:
 *     loads only startup-art/*, draws one cover quad, never rejects on a missing picture, publishes __firstScreen,
 *     end() frees every GL object and leaves default bindings; WebGL2 detection hack kept.
 *  B. No Cocos logo path: first-screen.js never names logo.png / slogan.png / background.png / useDefaultLogo, the
 *     template folder carries no Cocos art, the scene layer no longer loads resources/ui/loading-reference.
 *  C. Layout: for 16:9, 19.5:9, 20:9, 9:16-ish and 4:3 screens the first-screen quad (from its clip-space vertices),
 *     StartupLoadingLayout.coverTransform and the StartupLoadingLayer node tree (cc stub) give the SAME picture rect;
 *     decorations inside the visible window + safe band; 4:3 crop reported.
 *  D. Scene layer glue (cc stub): handoff -> sprite frames set synchronously; without handoff -> loadRemote of the same
 *     files; intro fade 0 -> 255 over INTRO_FADE_S starting at the first frame; real-stage progress only; outro 0.7 s.
 *  E. WorldIntegrationBoot with the real layer: ready -> fade (backdrop stays active, room hints blocked), loadWorld
 *     during the fade is a no-op, nodes inactive after OUTRO_FADE_S; error keeps the layer + retry hint.
 *  F. ES5 syntax of first-screen.js (no arrow/let/const/template/class/spread/for-of).
 * Usage: node tools/first-screen/test_first_screen.cjs [--json out.json] */
const fs=require('fs'),path=require('path'),vm=require('vm'),os=require('os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','..');
const ts=(()=>{try{return require('../qf-env.cjs').typescript();}catch(e){const p=path.join(root,'..','..','character-core','lighthouse-island-astra-ultra','tools','vendor-node','node_modules','typescript');if(fs.existsSync(p))return require(p);throw e;}})();
const S=path.join(root,'creator-build-project/assets/scripts'),T=path.join(root,'creator-build-project/build-templates');
const FS_JS=path.join(T,'wechatgame/first-screen.js');
const checks=[],report={};const ok=(name,extra)=>{checks.push(name);if(extra!==undefined)report[name]=extra;};
const near=(a,b,eps,msg)=>assert(Math.abs(a-b)<=eps,msg+' '+a+' vs '+b);
const turn=()=>new Promise(r=>setImmediate(r));

// ---------- A. first-screen.js in a vm ----------
function fakeGL(log){const C={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,TEXTURE_2D:7,TEXTURE0:8,TEXTURE_MIN_FILTER:9,TEXTURE_MAG_FILTER:10,TEXTURE_WRAP_S:11,TEXTURE_WRAP_T:12,LINEAR:13,CLAMP_TO_EDGE:14,RGBA:15,UNSIGNED_BYTE:16,FLOAT:17,TRIANGLE_STRIP:18,COLOR_BUFFER_BIT:19,BLEND:20,UNPACK_FLIP_Y_WEBGL:21,UNPACK_PREMULTIPLY_ALPHA_WEBGL:22};
 let id=0;const live=new Set(),st={program:null,buffer:null,texture:null,attribs:new Set(),blend:false};
 const mk=k=>{const o={k,id:++id};live.add(o);return o;},del=o=>{if(o)live.delete(o);};
 const gl=Object.assign({},C,{_live:live,_st:st,
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>'',deleteShader(){},
  createProgram:()=>mk('program'),attachShader(){},linkProgram(){},getProgramParameter:()=>true,getProgramInfoLog:()=>'',deleteProgram:del,
  getAttribLocation:(p,n)=>n==='a_Position'?0:1,getUniformLocation:()=>({}),uniform1i(){},useProgram:p=>{st.program=p;},
  createBuffer:()=>mk('buffer'),bindBuffer:(t,b)=>{st.buffer=b;},bufferData:(t,d)=>{log.push({op:'bufferData',data:Array.from(d)});},deleteBuffer:del,
  createTexture:()=>mk('texture'),bindTexture:(t,x)=>{st.texture=x;},activeTexture(){},texParameteri:(t,k,v)=>{log.push({op:'texParameteri',k,v});},pixelStorei(){},
  texImage2D:(...a)=>{log.push({op:'texImage2D',src:a[a.length-1]&&a[a.length-1].src});},deleteTexture:del,
  enableVertexAttribArray:i=>st.attribs.add(i),disableVertexAttribArray:i=>st.attribs.delete(i),vertexAttribPointer(){},
  drawArrays:(m,f,c)=>{log.push({op:'drawArrays',mode:m,count:c});},viewport(){},disable:k=>{if(k===C.BLEND)st.blend=false;},enable:k=>{if(k===C.BLEND)st.blend=true;},
  clearColor:(...c)=>{log.push({op:'clearColor',c});},clear(){}});
 return gl;}
function runFirstScreen({W=1170,H=2532,missing=[],webgl2=false}={}){
 const log=[],loads=[],gl=fakeGL(log);let raf=[];
 const canvas={width:W,height:H,getContext:(k)=>{log.push({op:'getContext',k});return k==='webgl2'&&!webgl2?null:gl;}};
 class Image{set src(v){this._src=v;loads.push(v);setImmediate(()=>{if(missing.some(m=>v.indexOf(m)>=0))this.onerror&&this.onerror(new Error('404'));else{this.width=v.indexOf('composite')>=0?750:60;this.height=v.indexOf('composite')>=0?1624:60;this.onload&&this.onload();}});}get src(){return this._src;}}
 const window={canvas};const GameGlobal={};
 const sandbox={module:{exports:{}},window,canvas,GameGlobal,Image,console:{log:m=>log.push({op:'console',m})},Promise,Math,Date,Float32Array,performance:{now:()=>Date.now()},setImmediate,
  requestAnimationFrame:cb=>{raf.push(cb);return raf.length;},cancelAnimationFrame:()=>{raf.cancelled=true;}};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(fs.readFileSync(FS_JS,'utf8'),sandbox,{filename:'first-screen.js'});
 const frame=()=>{const q=raf;raf=[];q.forEach(cb=>cb());};
 return {fsm:sandbox.module.exports,log,loads,gl,frame,window,GameGlobal,sandbox,pending:()=>raf.length};
}
async function drive(env,webgl2='false'){ // = generated game.js (Cocos 3.8.8 templates/wechatgame/game.ejs) call order
 const pump=async p=>{let done=false;p.then(()=>done=true);for(let i=0;i<200&&!done;i++){await turn();env.frame();}assert(done,'promise settled');};
 await pump(env.fsm.start('false','true',webgl2));for(const v of [0.2,0.4,0.6])await pump(env.fsm.setProgress(v));await pump(env.fsm.end());}
(async()=>{
{const e=runFirstScreen({W:1170,H:2532});await drive(e);const st=e.GameGlobal.__firstScreen;
 assert.deepEqual(e.loads.slice().sort(),['startup-art/bar_fill.png','startup-art/first_screen_composite.jpg','startup-art/pinwheel.png']);
 assert(st&&st.ready&&st.ended&&st.images.composite&&st.images.fill&&st.images.pinwheel,'__firstScreen handoff with decoded images');
 assert.equal(e.window.WebGL2RenderingContext,false,'webgl1 path sets the engine detection flag');
 const draws=e.log.filter(x=>x.op==='drawArrays');assert(draws.length>=1&&draws.every(d=>d.count===4),'one 4-vertex quad per frame');
 const tex=e.log.filter(x=>x.op==='texImage2D');assert.equal(tex.length,1);assert.equal(tex[0].src,'startup-art/first_screen_composite.jpg');
 const tp=e.log.filter(x=>x.op==='texParameteri');assert(tp.some(x=>x.k===e.gl.TEXTURE_WRAP_S&&x.v===e.gl.CLAMP_TO_EDGE)&&tp.some(x=>x.k===e.gl.TEXTURE_WRAP_T&&x.v===e.gl.CLAMP_TO_EDGE),'NPOT-safe clamp');
 assert.equal(e.gl._live.size,0,'end() deleted every program/buffer/texture');assert.equal(e.gl._st.program,null);assert.equal(e.gl._st.buffer,null);assert.equal(e.gl._st.texture,null);assert.equal(e.gl._st.attribs.size,0);assert.equal(e.gl._st.blend,false);
 const clear=e.log.find(x=>x.op==='clearColor').c.map(v=>Math.round(v*255));assert.deepEqual(clear.slice(0,3),[217,210,196]);
 assert(st.t.firstArtFrame>=0&&st.t.end>=st.t.firstArtFrame&&st.t.released>=st.t.end,'timings recorded');
 ok('A1 game.js order start/setProgress/end: only startup-art loaded, one cover quad, handoff images, all GL objects freed, default bindings',{loads:e.loads,frames:st.frames});}
{const e=runFirstScreen({webgl2:true});await drive(e,'true');assert.equal(e.window.WebGL2RenderingContext,true);assert.equal(e.log.find(x=>x.op==='getContext').k,'webgl2');ok('A2 useWebgl2=true path keeps the template detection hack');}
{const e=runFirstScreen({missing:['first_screen_composite','pinwheel']});await drive(e);const st=e.GameGlobal.__firstScreen;
 assert.equal(st.ready,false);assert(st.error&&/load/.test(st.error));assert(!st.images.composite&&!st.images.pinwheel&&st.images.fill);assert.equal(e.log.filter(x=>x.op==='drawArrays').length,0,'no quad without picture (cream clear only)');
 ok('A3 missing picture: start()/end() still resolve (engine starts), cream clear, error recorded');}
{const e=runFirstScreen();e.fsm.start('false','true','false');e.frame();const p=e.fsm.setProgress(0.5);let r=false;p.then(()=>r=true);await turn();assert.equal(r,false);e.frame();await turn();assert.equal(r,true);ok('A4 setProgress resolves after the next frame (template contract); progress value ignored, track stays empty');}

// ---------- B. no Cocos logo path ----------
{const src=fs.readFileSync(FS_JS,'utf8');for(const bad of ['logo.png','slogan.png','background.png','useDefaultLogo','useLogo','logoName','Created with','cocos-logo'])assert(!src.includes(bad),'first-screen.js mentions '+bad);
 const files=[];(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);fs.statSync(p).isDirectory()?walk(p):files.push(path.relative(T,p));}})(T);
 for(const f of files)assert(!/(^|\/)(logo|slogan|background)\.png$/i.test(f)&&!/cocos/i.test(f),'template folder carries '+f);
 const crypto=require('crypto'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 const L=require(loadTs(['ui/StartupLoadingLayout']).StartupLoadingLayout);
 for(const plat of ['wechatgame','web-desktop'])assert.equal(sha(path.join(T,plat,L.ART.composite)),L.ART.compositeSha256,plat+' composite sha');
 assert.equal(sha(path.join(T,'wechatgame/startup-art/bar_fill.png')),sha(path.join(T,'web-desktop/startup-art/bar_fill.png')));
 const fsSrc=src.match(/var COMPOSITE = '([^']+)'/)[1];assert.equal(fsSrc,L.ART.composite);
 const boot=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');assert(!boot.includes('ui/loading-reference')&&!boot.includes("loadBundle('resources'"),'scene layer must not wait for the resources bundle');
 const sizes={};for(const f of files.filter(f=>f.startsWith('wechatgame/')))sizes[f]=fs.statSync(path.join(T,f)).size;
 ok('B no Cocos logo/slogan reference or asset; first-screen + scene layer share the composite (sha pinned); no resources-bundle wait',{wechatMainPackageFiles:sizes,total:Object.values(sizes).reduce((a,b)=>a+b,0)});}

// ---------- C/D. layout + layer glue (cc stub) ----------
const mods=loadTs(['ui/StartupLoadingLayout','ui/StartupLoadingLayer'],ccStub());const L=require(mods.StartupLoadingLayout),Layer=require(mods.StartupLoadingLayer).StartupLoadingLayer;
const handoffImages=()=>{const img=n=>({src:n,width:1,height:1});return {version:1,ready:true,ended:true,images:{composite:img('c'),fill:img('f'),pinwheel:img('p')},t:{start:1,image:2,firstArtFrame:3,end:4,released:5},frames:9};};
const fillSprite=layer=>layer.root.children[0].children[0].getComponent(CC.Sprite);
// ---------- G. engine order of the FILLED ribbon (r5 blocker: TypeError in new StartupLoadingLayer -> stuck on the first screen) ----------
{const probe=new CC.Sprite();probe.type=CC.Sprite.Type.FILLED;
 assert.throws(()=>{probe.fillStart=0;},e=>e instanceof TypeError&&/reading 'width'/.test(e.message),'stub reproduces the engine updateUVs TypeError (FILLED + no spriteFrame)');
 CC.G.__firstScreen=handoffImages();CC.remote.length=0;
 const l1=new Layer(new CC.Node('Canvas'),()=>{});const f1=fillSprite(l1);
 assert(f1.spriteFrame,'handoff: ribbon frame adopted in the constructor');assert.equal(f1.type,CC.Sprite.Type.FILLED);assert.equal(f1.fillType,CC.Sprite.FillType.HORIZONTAL);
 assert.equal(f1.fillStart,0);near(f1.fillRange,L.ribbonHead(0).fillRange,1e-12,'handoff: ribbon starts at the empty-track head');assert(f1.uvUpdates>0,'UVs computed with a frame present');
 l1.layout(390,844);l1.setStage(2);for(let i=0;i<60;i++)l1.tick(1/60);near(f1.fillRange,L.ribbonHead(l1.timeline.shown).fillRange,1e-12,'handoff: ribbon follows progress');
 delete CC.G.__firstScreen;CC.remote.length=0;
 const l2=new Layer(new CC.Node('Canvas'),()=>{});const f2=fillSprite(l2);l2.layout(390,844);l2.setStage(1);for(let i=0;i<60;i++)l2.tick(1/60);
 assert.equal(f2.spriteFrame,null);assert.equal(f2.type,CC.Sprite.Type.SIMPLE,'no frame yet: ribbon not FILLED (draws nothing, no updateUVs)');
 CC.remote.find(r=>/bar_fill/.test(r.url)).cb(null,new CC.ImageAsset({}));
 assert(f2.spriteFrame);assert.equal(f2.type,CC.Sprite.Type.FILLED,'ribbon turns FILLED when its frame lands');near(f2.fillRange,L.ribbonHead(l2.timeline.shown).fillRange,1e-12,'late frame: range = current progress head');
 l2.setStage(2);l2.startOutro();for(let i=0;i<60;i++)l2.tick(1/60);near(f2.fillRange,L.ribbonHead(1).fillRange,1e-12,'late frame: ribbon completes in the outro');
 CC.remote.length=0;const l3=new Layer(new CC.Node('Canvas'),()=>{});const f3=fillSprite(l3);l3.layout(390,844);
 CC.remote.find(r=>/bar_fill/.test(r.url)).cb(new Error('404'),null);l3.setStage(3);l3.startOutro();for(let i=0;i<60;i++)l3.tick(1/60);
 assert.equal(f3.type,CC.Sprite.Type.SIMPLE);assert.equal(l3.diagnostics().sources.fill,'failed');
 ok('G ribbon FILLED/fillStart/fillRange only after its spriteFrame (engine bar-filled.updateUVs reads spriteFrame.width unguarded): handoff sync, late loadRemote frame, failed load; stub reproduces the r5 TypeError');}
// ---------- H. outro: the Graphics cream mask fades with the picture (r5: UIOpacity never reached it -> flat cream + hard cut) ----------
{CC.G.__firstScreen=handoffImages();const l=new Layer(new CC.Node('Canvas'),()=>{});l.layout(390,844);const g=l.mask.getComponent(CC.Graphics),rootOp=l.root.getComponent(CC.UIOpacity);
 const alpha=()=>g.fills[g.fills.length-1][3];
 assert.equal(l.mask.getComponent(CC.UIOpacity),null,'mask alpha lives in the Graphics fill colour, not in a UIOpacity Graphics ignores');
 assert.deepEqual(g.rects[g.rects.length-1],[-195,-422,390,844],'mask covers the screen');
 l.setStage(2);for(let i=0;i<30;i++)l.tick(1/60);assert.equal(alpha(),255,'opaque while loading');
 l.startOutro();assert.equal(l.tick(0.1),false);assert.equal(alpha(),255,'first outro frame (room first draw, hitch dt) stays opaque');assert.equal(rootOp.opacity,255);assert(l.fading);
 const mask=[],root=[];let done=false,n=0;while(!done&&n<200){done=l.tick(1/60);n++;mask.push(alpha());root.push(rootOp.opacity);
  const fc=g.fills[g.fills.length-1];assert.deepEqual(fc.slice(0,3),L.BACKDROP_RGB,'cream colour kept');}
 assert(done,'outro finishes');for(let i=1;i<mask.length;i++)assert(mask[i]<=mask[i-1],'mask alpha monotonic down at frame '+i+': '+mask[i-1]+' -> '+mask[i]);
 assert.equal(mask[mask.length-1],0,'mask alpha reaches 0');assert.deepEqual(mask,root,'mask and picture fade on the same curve');
 assert.equal(l.diagnostics().maskAlpha,0,'diagnostics expose the drawn mask alpha');assert.equal(l.diagnostics().fillType,CC.Sprite.Type.FILLED);
 assert(mask[0]<255,'fade starts right after the held frame');near(n/60,L.OUTRO_FADE_S,1/60+1e-9,'fade length after the held frame');
 assert(L.OUTRO_FADE_S>=0.4,'outro lasts at least 0.4 s');
 const mid=mask[Math.min(mask.length-1,Math.round(L.OUTRO_FADE_S*30)-1)];
 assert(mid>40&&mid<210,'linear fade is still visible near the midpoint: '+mid);
 const half=Math.floor(mask.length/2);for(let i=1;i<half;i++)assert(mask[i]<mask[i-1],'first half of the fade: mask alpha drops every frame ('+i+')');
 const steps=mask.map((a,i)=>(i?mask[i-1]:255)-a);
 ok('H outro: Graphics mask redrawn with alpha each frame (no UIOpacity), held opaque on the first outro frame, then monotonic 255 -> 0 together with the picture over '+L.OUTRO_FADE_S+' s',{maskAlpha60fps:mask,maxStep:Math.max.apply(null,steps)});
 delete CC.G.__firstScreen;CC.remote.length=0;}
const SCREENS=[['16:9 iPhone 8 (375x667 pt)',375,667,750,1334],['19.5:9 iPhone 14 (390x844 pt)',390,844,1170,2532],['20:9 Android (360x800 dp)',360,800,1080,2400],['18:9 Android (360x720 dp)',360,720,1080,2160],['4:3 iPad portrait (768x1024 pt)',768,1024,1536,2048]];
const layoutReport=[];
for(const [name,w,h,pw,ph] of SCREENS){
 // first screen: clip-space quad on the physical canvas -> pixel rect
 const e=runFirstScreen({W:pw,H:ph});const v=e.fsm.coverVertices(pw,ph);const fsRect={x0:(v[0]+1)/2*pw,x1:(v[8]+1)/2*pw,y0:(1-v[1])/2*ph,y1:(1-v[5])/2*ph};
 assert.equal(v[2],0);assert.equal(v[3],0);assert.equal(v[6],0);assert.equal(v[7],1);assert.equal(v[10],1);assert.equal(v[11],0);// image top-left -> screen top-left
 const c=L.coverTransform(pw,ph);near(fsRect.x0,c.dx,1e-6,name+' fs x0');near(fsRect.y0,c.dy,1e-6,name+' fs y0');near(fsRect.x1,c.dx+c.w,1e-6,name+' fs x1');near(fsRect.y1,c.dy+c.h,1e-6,name+' fs y1');
 const jsc=e.fsm.coverTransform(pw,ph);for(const k of ['s','dx','dy','w','h'])near(jsc[k],c[k],1e-9,name+' js/ts '+k);
 // scene layer on the logical canvas (Boot uses window.innerWidth/innerHeight, centre origin) -> normalised rect
 const parent=new CC.Node('Canvas');const layer=new Layer(parent,()=>{});layer.layout(w,h);const ui=layer.root.getComponent(CC.UITransform);
 const lr={x0:(w/2+layer.root.position.x-ui.width/2)/w,x1:(w/2+layer.root.position.x+ui.width/2)/w,y0:(h/2-layer.root.position.y-ui.height/2)/h,y1:(h/2-layer.root.position.y+ui.height/2)/h};
 for(const k of ['x0','x1'])near(lr[k],fsRect[k]/pw,1e-9,name+' layer '+k);for(const k of ['y0','y1'])near(lr[k],fsRect[k]/ph,1e-9,name+' layer '+k);
 const vis=L.visibleDesignRect(w,h),cl=L.coverTransform(w,h);
 const bar=L.BAR,hint=L.HINT,pin=L.PINWHEEL,head0=L.ribbonHead(0),head1=L.ribbonHead(1);
 const items={logo:[347,295,432,385],title:[166,392,590,518],track:[bar.x,bar.y,bar.x+bar.w,bar.y+bar.h],hint:[L.DESIGN_W/2-hint.width/2,hint.centerY-hint.height/2,L.DESIGN_W/2+hint.width/2,hint.centerY+hint.height/2],pinwheel0:[head0.x-pin.w/2,head0.y-pin.h/2,head0.x+pin.w/2,head0.y+pin.h/2],pinwheel100:[head1.x-pin.w/2,head1.y-pin.h/2,head1.x+pin.w/2,head1.y+pin.h/2]};
 const inside={},safe={};for(const k in items){const b=items[k];inside[k]=b[0]>=vis.x0-0.5&&b[2]<=vis.x1+0.5&&b[1]>=vis.y0-0.5&&b[3]<=vis.y1+0.5;safe[k]=b[1]>=L.SAFE.top*L.DESIGN_H&&b[3]<=L.SAFE.bottom*L.DESIGN_H;}
 // layer element positions == design coords through the same transform
 const fillN=layer.root.children[0].children[0];const fp=L.toCentered(cl,L.BAR.x+L.BAR.w/2,L.BAR.y+L.BAR.h/2);near(fillN.position.x,fp.x,1e-9,'fill x');near(fillN.position.y,fp.y,1e-9,'fill y');
 const hintN=layer.root.children[0].children[2];near(hintN.position.y,L.toCentered(cl,L.DESIGN_W/2,L.HINT.centerY).y,1e-9,'hint y');near(hintN.getComponent(CC.Label).fontSize,L.HINT.size*cl.s,1e-9,'hint size');
 layoutReport.push({screen:name,logical:[w,h],physical:[pw,ph],s_logical:+cl.s.toFixed(5),visibleDesign:{x:[+vis.x0.toFixed(1),+vis.x1.toFixed(1)],y:[+vis.y0.toFixed(1),+vis.y1.toFixed(1)]},inside,firstScreenRectPx:{x:[+fsRect.x0.toFixed(2),+fsRect.x1.toFixed(2)],y:[+fsRect.y0.toFixed(2),+fsRect.y1.toFixed(2)]}});
 if(!/4:3/.test(name)){for(const k in inside)assert(inside[k],name+' '+k+' visible');}
}
ok('C first-screen quad == StartupLoadingLayout cover == StartupLoadingLayer node rect on 16:9/19.5:9/20:9/18:9/4:3; all decorations visible except on 4:3 (see report)',layoutReport);
{ // D1 handoff path
 const img=n=>({src:n,width:1,height:1});CC.G.__firstScreen={version:1,ready:true,ended:true,images:{composite:img('c'),fill:img('f'),pinwheel:img('p')},t:{start:1,image:2,firstArtFrame:3,end:4,released:5},frames:9};CC.remote.length=0;
 const layer=new Layer(new CC.Node('Canvas'),()=>{});layer.layout(390,844);const d=layer.diagnostics();
 assert.deepEqual(d.sources,{composite:'first-screen',fill:'first-screen',pinwheel:'first-screen'});assert.equal(CC.remote.length,0,'no async load when the first screen handed off');
 assert(layer.root.getComponent(CC.Sprite).spriteFrame,'base sprite frame set synchronously in the constructor');
 const tex=layer.root.getComponent(CC.Sprite).spriteFrame.texture;assert.deepEqual(tex.wrap,['clamp','clamp']);assert.deepEqual(tex.filters,['linear','linear']);
 const dyn=layer.root.children[0].getComponent(CC.UIOpacity);assert.equal(dyn.opacity,0,'fill/pinwheel/hint invisible on the takeover frame');assert.equal(layer.root.getComponent(CC.UIOpacity).opacity,255);
 layer.tick(1/60);assert.equal(dyn.opacity,0,'first frame starts the intro, does not advance it');
 const ops=[];for(let t=0;t<0.4;t+=1/60){layer.tick(1/60);ops.push(dyn.opacity);}
 const full=ops.findIndex(o=>o===255);near((full+1)/60,L.INTRO_FADE_S,1/60+1e-9,'intro reaches 255 at INTRO_FADE_S');for(let i=1;i<ops.length;i++)assert(ops[i]>=ops[i-1]);
 const maxStep=Math.max(...ops.map((o,i)=>i?o-ops[i-1]:o));
 assert.equal(layer.timeline.shown,0,'no progress without a real stage');layer.setStage(1);for(let i=0;i<120;i++)layer.tick(1/60);near(layer.timeline.shown,1/3,1e-9,'stage 1 -> 1/3');
 layer.setStage(0);assert.equal(layer.timeline.target,1/3,'never backwards');assert.equal(layer.diagnostics().hint,L.HINTS[1]);
 layer.startOutro();const lo=[];let frames=0;while(!layer.tick(1/60)&&frames<200){frames++;lo.push(layer.root.getComponent(CC.UIOpacity).opacity);}
 near(frames/60,L.OUTRO_FADE_S,1/60+1e-9,'outro length (frames counts the held first outro frame)');assert.equal(layer.timeline.shown,1,'bar completes during the outro');
 ok('D1 handoff: sprites set synchronously (no loadRemote), clamp/linear like first-screen, dynamic group 0 on takeover frame, intro 0->255 in '+L.INTRO_FADE_S+' s (max step '+maxStep+'/255 per 60 fps frame), real-stage progress only, outro '+L.OUTRO_FADE_S+' s');
 // D2 fallback
 delete CC.G.__firstScreen;CC.remote.length=0;const l2=new Layer(new CC.Node('Canvas'),()=>{});assert.deepEqual(CC.remote.map(r=>r.url).sort(),['startup-art/bar_fill.png','startup-art/first_screen_composite.jpg','startup-art/pinwheel.png']);
 assert.equal(l2.root.getComponent(CC.Sprite).spriteFrame,null);
 assert.equal(l2.root.getComponent(CC.Sprite).enabled,false,'empty base sprite stays disabled so it cannot cover the cream with a black quad');
 const early=l2.mask.getComponent(CC.Graphics);assert(early.fills.length>0&&early.fills[0][0]===217&&early.fills[0][1]===210&&early.fills[0][2]===196,'cream mask is drawn before the jpg');
 assert(early.rects[0][2]>=4096&&early.rects[0][3]>=4096,'cream covers the screen before layout');
 CC.remote.forEach(r=>r.cb(null,new CC.ImageAsset({})));assert(l2.root.getComponent(CC.Sprite).spriteFrame);assert.equal(l2.root.getComponent(CC.Sprite).enabled,true);assert.equal(l2.diagnostics().sources.composite,'loadRemote:ok');
 const g=l2.mask.getComponent(CC.Graphics);l2.layout(390,844);assert.deepEqual(g.fills[g.fills.length-1],[217,210,196,255]);
 ok('D2 no handoff (web preview / first-screen failed): loadRemote of the same startup-art files, cream mask (picture mean colour) meanwhile, never the old dark #123233');}

// ---------- E. Boot with the real layer ----------
await bootIntegration();
// ---------- F. ES5 syntax ----------
{const sf=ts.createSourceFile('first-screen.js',fs.readFileSync(FS_JS,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);const bad=[];
 (function walk(n){const K=ts.SyntaxKind;if([K.ArrowFunction,K.TemplateExpression,K.NoSubstitutionTemplateLiteral,K.ClassDeclaration,K.SpreadElement,K.ForOfStatement,K.AwaitExpression].includes(n.kind))bad.push(K[n.kind]+'@'+n.pos);
  if(n.kind===K.VariableDeclarationList&&(n.flags&(ts.NodeFlags.Let|ts.NodeFlags.Const)))bad.push('let/const@'+n.pos);ts.forEachChild(n,walk);})(sf);
 assert.deepEqual(bad,[]);ok('F first-screen.js is plain ES5 syntax (Promise is the only post-ES5 API, same as the template)');}
const out={status:'PASS',checks,report,scope:'Box only: vm + recording fake WebGL for first-screen.js, cc stubs for the scene layer/Boot. Not run: Cocos build, WeChat DevTools, iOS/Android devices, real GPU (see render_first_screen.cjs for a headless-Chrome WebGL render).'};
const j=process.argv.indexOf('--json');if(j>0)fs.writeFileSync(process.argv[j+1],JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length}));checks.forEach(c=>console.log(' ok '+c));
})().catch(e=>{console.error(e);process.exitCode=1;});

// ---------- helpers ----------
var CC;
function ccStub(){
 class Node{constructor(n){this.name=n;this.children=[];this.components=[];this.position={x:0,y:0,z:0};this.active=true;this.isValid=true;this.angle=0;this.handlers={};}
  addChild(n){n.parent=this;this.children.push(n);}addComponent(t){const c=new t();c.node=this;this.components.push(c);return c;}getComponent(t){return this.components.find(c=>c instanceof t)||null;}
  setPosition(x,y,z){this.position={x,y,z};}setSiblingIndex(i){const p=this.parent;if(!p)return;p.children.splice(p.children.indexOf(this),1);p.children.splice(i,0,this);}on(e,f){this.handlers[e]=f;}off(){}destroy(){this.isValid=false;}}
 Node.EventType={TOUCH_END:'touch-end'};
 class UITransform{setContentSize(w,h){this.width=w;this.height=h;}}
 class Graphics{constructor(){this.fills=[];this.rects=[];}clear(){}rect(x,y,w,h){this.rects.push([x,y,w,h]);}fill(){this.fills.push([this.fillColor.r,this.fillColor.g,this.fillColor.b,this.fillColor.a]);}}
 class Color{constructor(r,g,b,a){if(typeof r==='string'){const h=r.replace('#','');this.r=parseInt(h.slice(0,2),16);this.g=parseInt(h.slice(2,4),16);this.b=parseInt(h.slice(4,6),16);this.a=255;}else{this.r=r;this.g=g;this.b=b;this.a=a===undefined?255:a;}}}
 // Sprite mirrors Cocos 3.8.8 cocos/2d/components/sprite.ts + assembler/sprite/bar-filled.ts: renderData exists once the
 // component is enabled (_flushAssembler); type/fillType setters re-flush (UVs only when a frame exists); fillStart/fillRange
 // setters on a FILLED sprite with renderData call _updateUVs -> barFilled.updateUVs, which reads spriteFrame.width unguarded.
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;
 class Sprite{constructor(){this._spriteFrame=null;this._type=0;this._fillType=0;this._fillStart=0;this._fillRange=0;this._assembler=null;this.renderData=null;this.uvUpdates=0;this._flushAssembler();}
  get spriteFrame(){return this._spriteFrame;}set spriteFrame(v){this._spriteFrame=v;}
  get type(){return this._type;}set type(v){if(this._type!==v){this._type=v;this._flushAssembler();}}
  get fillType(){return this._fillType;}set fillType(v){this._fillType=v;this._flushAssembler();}
  get fillStart(){return this._fillStart;}set fillStart(v){this._fillStart=clamp(v,0,1);if(this._type===Sprite.Type.FILLED&&this.renderData)this._updateUVs();}
  get fillRange(){return this._fillRange;}set fillRange(v){this._fillRange=clamp(v,-1,1);if(this._type===Sprite.Type.FILLED&&this.renderData)this._updateUVs();}
  _flushAssembler(){const a=this._type===Sprite.Type.FILLED?'bar-filled':'simple';if(this._assembler!==a){this.renderData=null;this._assembler=a;}
   if(!this.renderData){this.renderData={};if(this._spriteFrame)this._updateUVs();}}
  _updateUVs(){const f=this._spriteFrame;const w=f.width,h=f.height;this.uvUpdates++;return w+h;}}
 Sprite.SizeMode={CUSTOM:0};Sprite.Type={SIMPLE:0,FILLED:3};Sprite.FillType={HORIZONTAL:0};
 class Label{}Label.HorizontalAlign={CENTER:1};Label.VerticalAlign={CENTER:1};
 class UIOpacity{constructor(){this.opacity=255;}}class Vec2{constructor(x,y){this.x=x;this.y=y;}}
 class ImageAsset{constructor(src){this.src=src;}}
 class Texture2D{setWrapMode(a,b){this.wrap=[a,b];}setFilters(a,b){this.filters=[a,b];}setMipFilter(m){this.mip=m;}}Texture2D.WrapMode={CLAMP_TO_EDGE:'clamp'};Texture2D.Filter={LINEAR:'linear',NONE:'none'};
 class SpriteFrame{get width(){return 1;}get height(){return 1;}}
 const remote=[];const G=globalThis;
 CC={Node,UITransform,Graphics,Color,Sprite,Label,UIOpacity,Vec2,ImageAsset,Texture2D,SpriteFrame,Layers:{Enum:{UI_2D:1}},isValid:n=>!!n&&n.isValid!==false,assetManager:{loadRemote:(url,opt,cb)=>remote.push({url,opt,cb})},remote,G};
 return CC;}
function loadTs(files,cc){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'first-screen-test-'));const out={};
 for(const f of files){const js=ts.transpileModule(fs.readFileSync(path.join(S,f+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES5,experimentalDecorators:true}}).outputText;
  const file=path.join(tmp,path.basename(f)+'.js');fs.writeFileSync(file,js.replace(/require\("cc"\)/g,'require('+JSON.stringify(path.join(tmp,'cc.js'))+')'));out[path.basename(f)]=file;}
 fs.writeFileSync(path.join(tmp,'cc.js'),'module.exports=globalThis.__ccStub;');if(cc)globalThis.__ccStub=cc;
 return out;}
async function bootIntegration(){
 const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
 const mods=loadTs(['ui/StartupLoadingLayout','ui/StartupLoadingLayer','world-r2/StartupReadyGate','CharacterMotion']);const motion=require(mods.CharacterMotion);
 const LayerMod=require(mods.StartupLoadingLayer),Lay=require(mods.StartupLoadingLayout),gate=require(mods.StartupReadyGate);
 const N=CC.Node;class Component{getComponent(t){return this.node.getComponent(t);}addComponent(t){return this.node.addComponent(t);}}
 class Camera{};class SkeletalAnimation{constructor(){this.clips=[];this.states=new Map();}stop(){for(const x of this.states.values())x.stop();}play(n){const x=this.getState(n);if(x)x.play();}getState(n){if(this.states.has(n))return this.states.get(n);const c=this.clips.find(x=>x&&x.name===n);if(!c)return null;const st={name:n,clip:c,time:0,duration:c.duration||4,isPlaying:false,isPaused:false,play(){this.isPlaying=true;},pause(){this.isPaused=true;},stop(){this.isPlaying=false;},setTime(t){this.time=t;},sample(){}};this.states.set(n,st);return st;}createState(c,n){return this.getState(n);}}
 N.prototype.getComponentsInChildren=function(t){return this.components.filter(c=>c instanceof t).concat(...this.children.map(n=>n.getComponentsInChildren(t)));};N.prototype.setRotationFromEuler=function(){};N.prototype.setScale=function(){};
 let sc;const identity=(t,k)=>k===undefined?t:undefined;
 const cc=Object.assign({},CC,{_decorator:{ccclass:()=>identity,property:(t,k)=>typeof k==='string'?undefined:identity},Component,Camera,SkeletalAnimation,MeshRenderer:class{},Prefab:class{},AnimationClip:{WrapMode:{Loop:1}},profiler:{hideStats(){}},view:{on(){},off(){}},
  director:{getScene:()=>sc.scene},game:{},Game:{},Vec3:class{},utils:{},primitives:{},EffectAsset:{get:()=>null},JsonAsset:class{},Canvas:class{},Label:CC.Label,ResolutionPolicy:{},
  assetManager:{getBundle:()=>({loadDir(p,t,cb){queueMicrotask(()=>cb(null,[{}]));},load(p,t,cb){cb(null,{json:{}});}}),loadRemote:CC.assetManager.loadRemote},
  instantiate:()=>{const n=new N('B');const a=n.addComponent(SkeletalAnimation);a.clips=['idle_breathing_loop','wind_sway_loop','walk_loop','sit_hold','stand_up','sit_down','door_reach'].map(name=>({name,duration:1.25}));return n;}});
 globalThis.__ccStub=cc;
 class Composition{constructor(){this.ready=deferred();sc.comp=this;}initializeWorld(){return this.ready.promise;}attachCalibratedCharacter(){return {ok:true};}worldCommands(){return {snapshot:()=>({state:'home'})};}}
 const ref={seatedRoot:[0.43,0,-4.2],standingRoot:[0,0,-4.4],seatYawRad:-2};
 const src=ts.transpileModule(fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText+'\nmodule.exports.__FlowReferenceStandin=FlowReferenceStandin;\n';
 const m={exports:{}};const req=name=>{if(name==='cc')return cc;if(name.includes('StartupLoadingLayer'))return LayerMod;if(name.includes('StartupLoadingLayout'))return Lay;if(name.includes('StartupReadyGate'))return gate;if(name.includes('WorldNativeComposition'))return {WorldNativeComposition:Composition};
  if(name.includes('CharacterReference'))return {CHARACTER_REFERENCE:ref};if(name.includes('WorldFlowCore'))return {Cancelled:gate.StartupCancelled,pointOnPath(){}};if(name.includes('IslandPropTaps'))return {emitPropTap(){},setPropTapLook(){},onPropTap(){return ()=>{};}};
  if(name.endsWith('IslandProps'))return {IslandProps:class{load(){return Promise.resolve(false);}dispose(){}}};if(name.includes('RegionLoader'))return {REGIONS:{island:{}},loadRegionPrefab(){return sc.region.promise;}};
  if(name.includes('CharacterMotion'))return motion;
  if(name.includes('FirstsliceFacts'))return {FIRSTSLICE:{anchors:{seat_anchor:{position:[0.4203,0.38,-4.2133]}}}};
  return {};};
 vm.runInNewContext(src,{module:m,exports:m.exports,require:req,console:{info(){},error(...a){if(process.env.FS_DEBUG)console.error(...a);},warn(){},log(){}},Promise,Date,Math,Error,Set,Map,Array,Object,globalThis:CC.G,queueMicrotask},{filename:'WorldIntegrationBoot.js'});
 const Boot=m.exports.WorldIntegrationBoot,Standin=m.exports.__FlowReferenceStandin;
 function seat(node){const s=new Standin(node);s.setAnimMeta(null);s.bindVisual(cc.instantiate());return s;}
 const rootOf=s=>Array.prototype.map.call(s.diagnostics().root,Number);
 // The reference node is created and parented before bindVisual samples sit_hold. The first-screen stub (and a node
 // that has not entered a scene, or has already been destroyed) has no worldPosition. Startup must still seat her.
 {const bare=new N('bare');bare.position={x:1.25,y:0,z:-4.2};assert.equal(bare.worldPosition,undefined);
  assert.deepEqual(rootOf(seat(bare)),[1.25,0,-4.2],'local position while worldPosition does not exist yet');
  const early=new N('early');early.position={x:2,y:3,z:4};Object.defineProperty(early,'worldPosition',{get(){throw Error('node is not in the scene');}});
  assert.deepEqual(rootOf(seat(early)),[2,3,4],'a throw from worldPosition before the node is in the scene falls back to position');
  const live=new N('live');live.position={x:0,y:0,z:0};live.worldPosition={x:9,y:8,z:7};assert.deepEqual(rootOf(seat(live)),[9,8,7],'a live worldPosition wins');
  const dead=new N('dead');dead.position={x:5,y:5,z:5};dead.destroy();Object.defineProperty(dead,'worldPosition',{get(){throw Error('destroyed');},configurable:true});
  const gone=seat(dead);assert.deepEqual(rootOf(gone),[0,0,0],'destroyed node does not throw');
  Object.defineProperty(dead,'isValid',{get(){throw Error('destroyed flag');}});assert.deepEqual(rootOf(gone),[0,0,0],'reading isValid after destroy does not throw');
  ok('E0 controller root: missing, not-yet-in-scene, and destroyed worldPosition stay finite and do not throw');}
 function fixture(){sc={scene:new N('Scene'),region:deferred()};sc.scene.addComponent(Camera);const b=new Boot();b.node=new N('Boot');b.smokeFixture={json:{}};
  b.paintNavigation=()=>{};b.resize=()=>{b.loadingLayer&&b.loadingLayer.layout(390,844);};let allowedFn=null;
  b.createNavigation=()=>{b.canvas=new N('Canvas');b.createLoadingBackdrop();b.status={string:'',node:new N('Status')};b.status.node.parent=new N('Plate');b.notice={node:new N('Notice')};b.notice.node.parent=new N('NoticePlate');
   b.canvas.addChild(new N('ButtonsAbove'));allowedFn=()=>b.loadPhase==='ready'&&!(b.loadingLayer&&b.loadingLayer.fading);};
  b.start();b.allowed=()=>allowedFn();return b;}
 // ready -> fade
 delete CC.G.__firstScreen;let b=fixture();assert(b.loadingLayer,'real layer created');assert.equal(b.loadingBackdrop,b.loadingLayer.root);assert.equal(b.loadingMask,b.loadingLayer.mask);
 assert.equal(b.status.node.parent.active,false,'dark status plate hidden while the startup layer shows');
 await turn();sc.region.resolve({});for(let i=0;i<5;i++)await turn();assert.equal(b.loadingLayer.timeline.target,2/3,'island + character stages reached');
 sc.comp.ready.resolve();for(let i=0;i<5;i++)await turn();assert.equal(b.loadPhase,'ready');
 assert.equal(b.loadingBackdrop.active,true,'layer still on screen at ready (fading)');assert(b.loadingLayer.fading);assert.equal(b.allowed(),false,'room hint/swipe wait for the fade');
 const mg=b.loadingMask.getComponent(CC.Graphics),ma=()=>mg.fills[mg.fills.length-1][3];
 assert.equal(b.ready,true,'room mounted (world composition ready, girl seated) before the fade starts');assert(b.startupGirl&&b.startupGirl.active!==false,'girl active under the layer');
 assert(b._referenceAdapter.diagnostics().root.every(Number.isFinite),'startup sampled sit_hold without a worldPosition');assert.equal(ma(),255);
 assert.equal(b.canvas.children[b.canvas.children.length-1],b.loadingBackdrop,'layer moved above buttons for the fade');
 const again=b.loadWorld();await again;assert.equal(b.loadingBackdrop.active,true,'loadWorld during fade does not reopen/restart');
 let t=0;const bootMask=[];while(b.loadingBackdrop.active&&t<2){b.update(1/60);t+=1/60;bootMask.push(ma());}near(t,Lay.OUTRO_FADE_S+2/60,2/60,'hidden after the held frame + outro');assert.equal(b.loadingMask.active,false);assert.equal(b.allowed(),true);
 assert.equal(bootMask[0],255,'held first outro frame');for(let i=1;i<bootMask.length;i++)assert(bootMask[i]<=bootMask[i-1],'Boot: mask alpha monotonic');assert.equal(bootMask[bootMask.length-1],0,'Boot: mask alpha 0 when the nodes go inactive');
 const snap=CC.G.__worldLoading.snapshot();assert.equal(snap.backgroundSha256,Lay.ART.compositeSha256);assert.equal(snap.art.hidden,true);
 // error keeps the layer, retry from the hint
 b=fixture();await turn();sc.region.reject(Error('network'));for(let i=0;i<5;i++)await turn();assert.equal(b.loadPhase,'error');assert.equal(b.loadingBackdrop.active,true);
 const d=b.loadingLayer.diagnostics();assert.equal(d.retry,true);assert(/重试/.test(d.hint));sc.region=deferred();b.loadingLayer['hintNode'].handlers['touch-end']();await turn();assert.equal(b.loadPhase,'loading');assert.equal(b.loadingLayer.diagnostics().retry,false);
 const bootSrc=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');assert(/new RoomExploreOverlay\([^;]*!this\.loadingLayer\?\.fading/.test(bootSrc),'real room overlay allowed() waits for the fade');assert(/canUse:\(\)=>[^,]*!this\.loadingLayer\?\.fading/.test(bootSrc),'island home canUse waits for the fade');
 ok('E Boot + real layer: ready starts a '+Lay.OUTRO_FADE_S+' s fade above the buttons, room input waits, loadWorld during fade is a no-op, nodes off after the fade; error keeps layer with tap-to-retry hint');
}
