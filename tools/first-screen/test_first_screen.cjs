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
 const items={logo:[347,295,432,385],title:[166,392,590,518],track:[133,1283,617,1306],hint:[55,1341,695,1381],pinwheel0:[105,1263,165,1323],pinwheel100:[585,1263,645,1323]};
 const inside={},safe={};for(const k in items){const b=items[k];inside[k]=b[0]>=vis.x0-0.5&&b[2]<=vis.x1+0.5&&b[1]>=vis.y0-0.5&&b[3]<=vis.y1+0.5;safe[k]=b[1]>=L.SAFE.top*L.DESIGN_H&&b[3]<=L.SAFE.bottom*L.DESIGN_H;}
 // layer element positions == design coords through the same transform
 const fillN=layer.root.children[0].children[0];const fp=L.toCentered(cl,375,1293);near(fillN.position.x,fp.x,1e-9,'fill x');near(fillN.position.y,fp.y,1e-9,'fill y');
 const hintN=layer.root.children[0].children[2];near(hintN.position.y,L.toCentered(cl,375,1361).y,1e-9,'hint y');near(hintN.getComponent(CC.Label).fontSize,28*cl.s,1e-9,'hint size');
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
 near((frames+1)/60,L.OUTRO_FADE_S,1/60+1e-9,'outro length');assert.equal(layer.timeline.shown,1,'bar completes during the outro');
 ok('D1 handoff: sprites set synchronously (no loadRemote), clamp/linear like first-screen, dynamic group 0 on takeover frame, intro 0->255 in '+L.INTRO_FADE_S+' s (max step '+maxStep+'/255 per 60 fps frame), real-stage progress only, outro '+L.OUTRO_FADE_S+' s');
 // D2 fallback
 delete CC.G.__firstScreen;CC.remote.length=0;const l2=new Layer(new CC.Node('Canvas'),()=>{});assert.deepEqual(CC.remote.map(r=>r.url).sort(),['startup-art/bar_fill.png','startup-art/first_screen_composite.jpg','startup-art/pinwheel.png']);
 assert.equal(l2.root.getComponent(CC.Sprite).spriteFrame,null);CC.remote.forEach(r=>r.cb(null,new CC.ImageAsset({})));assert(l2.root.getComponent(CC.Sprite).spriteFrame);assert.equal(l2.diagnostics().sources.composite,'loadRemote:ok');
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
 class Graphics{constructor(){this.fills=[];}clear(){}rect(){}fill(){this.fills.push([this.fillColor.r,this.fillColor.g,this.fillColor.b,this.fillColor.a]);}}
 class Color{constructor(r,g,b,a){if(typeof r==='string'){const h=r.replace('#','');this.r=parseInt(h.slice(0,2),16);this.g=parseInt(h.slice(2,4),16);this.b=parseInt(h.slice(4,6),16);this.a=255;}else{this.r=r;this.g=g;this.b=b;this.a=a===undefined?255:a;}}}
 class Sprite{constructor(){this.spriteFrame=null;}}Sprite.SizeMode={CUSTOM:0};Sprite.Type={SIMPLE:0,FILLED:3};Sprite.FillType={HORIZONTAL:0};
 class Label{}Label.HorizontalAlign={CENTER:1};Label.VerticalAlign={CENTER:1};
 class UIOpacity{constructor(){this.opacity=255;}}class Vec2{constructor(x,y){this.x=x;this.y=y;}}
 class ImageAsset{constructor(src){this.src=src;}}
 class Texture2D{setWrapMode(a,b){this.wrap=[a,b];}setFilters(a,b){this.filters=[a,b];}setMipFilter(m){this.mip=m;}}Texture2D.WrapMode={CLAMP_TO_EDGE:'clamp'};Texture2D.Filter={LINEAR:'linear',NONE:'none'};
 class SpriteFrame{}
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
 const src=ts.transpileModule(fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText;
 const m={exports:{}};const req=name=>{if(name==='cc')return cc;if(name.includes('StartupLoadingLayer'))return LayerMod;if(name.includes('StartupLoadingLayout'))return Lay;if(name.includes('StartupReadyGate'))return gate;if(name.includes('WorldNativeComposition'))return {WorldNativeComposition:Composition};
  if(name.includes('CharacterReference'))return {CHARACTER_REFERENCE:ref};if(name.includes('WorldFlowCore'))return {Cancelled:gate.StartupCancelled,pointOnPath(){}};if(name.includes('IslandPropTaps'))return {emitPropTap(){},setPropTapLook(){},onPropTap(){return ()=>{};}};
  if(name.endsWith('IslandProps'))return {IslandProps:class{load(){return Promise.resolve(false);}dispose(){}}};if(name.includes('RegionLoader'))return {REGIONS:{island:{}},loadRegionPrefab(){return sc.region.promise;}};
  if(name.includes('CharacterMotion'))return motion;return {};};
 vm.runInNewContext(src,{module:m,exports:m.exports,require:req,console:{info(){},error(...a){if(process.env.FS_DEBUG)console.error(...a);},warn(){},log(){}},Promise,Date,Math,Error,Set,Map,Array,Object,globalThis:CC.G,queueMicrotask},{filename:'WorldIntegrationBoot.js'});
 const Boot=m.exports.WorldIntegrationBoot;
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
 assert.equal(b.canvas.children[b.canvas.children.length-1],b.loadingBackdrop,'layer moved above buttons for the fade');
 const again=b.loadWorld();await again;assert.equal(b.loadingBackdrop.active,true,'loadWorld during fade does not reopen/restart');
 let t=0;while(b.loadingBackdrop.active&&t<2){b.update(1/60);t+=1/60;}near(t,Lay.OUTRO_FADE_S+1/60,2/60,'hidden after the outro');assert.equal(b.loadingMask.active,false);assert.equal(b.allowed(),true);
 const snap=CC.G.__worldLoading.snapshot();assert.equal(snap.backgroundSha256,Lay.ART.compositeSha256);assert.equal(snap.art.hidden,true);
 // error keeps the layer, retry from the hint
 b=fixture();await turn();sc.region.reject(Error('network'));for(let i=0;i<5;i++)await turn();assert.equal(b.loadPhase,'error');assert.equal(b.loadingBackdrop.active,true);
 const d=b.loadingLayer.diagnostics();assert.equal(d.retry,true);assert(/重试/.test(d.hint));sc.region=deferred();b.loadingLayer['hintNode'].handlers['touch-end']();await turn();assert.equal(b.loadPhase,'loading');assert.equal(b.loadingLayer.diagnostics().retry,false);
 const bootSrc=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');assert(/new RoomExploreOverlay\([^;]*!this\.loadingLayer\?\.fading/.test(bootSrc),'real room overlay allowed() waits for the fade');assert(/canUse:\(\)=>[^,]*!this\.loadingLayer\?\.fading/.test(bootSrc),'island home canUse waits for the fade');
 ok('E Boot + real layer: ready starts a '+Lay.OUTRO_FADE_S+' s fade above the buttons, room input waits, loadWorld during fade is a no-op, nodes off after the fade; error keeps layer with tap-to-retry hint');
}
