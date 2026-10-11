'use strict';
const fs=require('node:fs'),path=require('node:path'),{stripTypeScriptTypes}=require('node:module');
const vm=require('node:vm'),Canvas=require(process.env.QF_CANVAS_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
// Chromium socket creation is unavailable in this workspace. Use a real native Skia Canvas, not synthetic draw stubs.
globalThis.Image=Canvas.Image;globalThis.ImageData=Canvas.ImageData;globalThis.document={createElement:()=>Canvas.createCanvas(1,1),body:{appendChild:canvas=>{globalThis.preview=canvas;}}};
const chromium={launch:async()=>({newPage:async()=>({setContent:async()=>{},evaluate:async(fn,arg)=>fn(arg),addScriptTag:async({content})=>vm.runInThisContext(content),screenshot:async({path})=>fs.writeFileSync(path,preview.toBuffer('image/png'))}),close:async()=>{}})};
const root=path.resolve(__dirname,'../creator-build-project/assets');
const output=path.resolve(process.env.QF_BACKGROUND_OUTPUT||path.join(__dirname,'../evidence/static-background'));fs.mkdirSync(output,{recursive:true});
const original=fs.readFileSync(path.join(root,'scripts/world-r2/OriginalLevelEnvironment.ts'),'utf8').replace(/export \{[^}]+\};/,'globalThis.Original={LevelEnvironment,MAIN,COAST};Object.assign(globalThis,Original);');
let provider=fs.readFileSync(path.join(root,'scripts/world-r2/OriginalLevelBackground.ts'),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'').replace(/^@ccclass\(.*\)\n/gm,'');provider=stripTypeScriptTypes(provider,{mode:'transform'})+'\nglobalThis.Provider={createOriginalLevelBackground,originalMainlineLevel,createBackgroundCanvas};';
// T8: botanical-props.png and background_ground/painted-grass.png were deleted (static background retired; no runtime loader). Only art still in the tree is loaded.
const assets={};for(const [name,file] of Object.entries({cloud:'background_foliage/painted-cloud.png'}))assets[name]='data:image/png;base64,'+fs.readFileSync(path.join(root,'bundles',file)).toString('base64');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.QF_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
 try{const page=await browser.newPage({viewport:{width:402,height:844}});await page.setContent('<style>html,body{margin:0}canvas{width:100vw;height:100vh;display:block}</style>');
 await page.evaluate(async assets=>{
   globalThis.art={};for(const [k,url] of Object.entries(assets)){const im=new Image();im.src=url;await im.decode();art[k]=im;}
   globalThis._decorator={ccclass:()=>()=>{}};
   globalThis.Component=class {enabled=true;};
   globalThis.Graphics=class {ellipse(){}fill(){}clear(){}rect(){}};
   globalThis.Color=class {constructor(value){this.value=value;}};
   globalThis.UIOpacity=class {opacity=255;};
   globalThis.sys={localStorage:{getItem:()=>null}};
   globalThis.__worldDayNight={snapshot:()=>({mode:'day'})};
   globalThis.stats={textures:0,frames:0,images:0,refs:0,loads:0};
   globalThis.ImageAsset=class {constructor(data){this.data=data;this.owned=true;stats.images++;}addRef(){stats.refs++;return this;}decRef(){stats.refs--;}destroy(){if(this.owned){this.owned=false;stats.images--;}}};
   globalThis.Texture2D=class {static PixelFormat={RGBA8888:35};set image(value){if(globalThis.failTexture)throw Error('expected GPU upload failure');this._image=value;}get image(){return this._image;}constructor(){this.alive=true;stats.textures++;}destroy(){if(this.alive){this.alive=false;stats.textures--;}}};
   globalThis.SpriteFrame=class {constructor(){this.alive=true;stats.frames++;}destroy(){if(this.alive){this.alive=false;stats.frames--;}}};
   globalThis.Sprite=class {static SizeMode={CUSTOM:0};};globalThis.Layers={Enum:{UI_2D:1}};
   globalThis.UITransform=class {setContentSize(w,h){this.width=w;this.height=h;}};
   globalThis.Node=class {constructor(name){this.name=name;this.children=[];this.components=new Map();this.active=true;}addChild(n){this.children.push(n);n.parent=this;}getChildByName(n){return this.children.find(x=>x.name===n);}setSiblingIndex(i){const a=this.parent.children;a.splice(a.indexOf(this),1);a.splice(i,0,this);}addComponent(C){const c=new C();c.node=this;this.components.set(C,c);return c;}getComponent(C){return this.components.get(C);}setPosition(){}setScale(){}destroy(){this.dead=true;for(const c of this.components.values())c.onDestroy?.();for(const n of this.children)n.destroy();}};
   globalThis.isValid=n=>!n.dead;
   globalThis.assetManager={loadBundle(name,cb){stats.loads++;queueMicrotask(()=>cb(null,{load(path,Type,cb){const deliver=()=>{if(globalThis.failImage===path){cb(Error('expected image failure'));return;}const data=path==='botanical-props'?art.botanical:path==='painted-cloud'?art.cloud:art.grass;cb(null,{data,addRef(){stats.refs++;},decRef(){stats.refs--;}});if(globalThis.cancelAfterImage===path)globalThis.cancelToken.cancel();};if(globalThis.holdImage===path){globalThis.releaseImage=deliver;}else queueMicrotask(deliver);}}));}};
 },assets);
 await page.addScriptTag({content:original});await page.addScriptTag({content:provider});
 const result=await page.evaluate(async()=>{
   const checks=[],draws=[];const assert=(v,m)=>{if(!v)throw Error(m);};
   const token=()=>({cancelled:false,listeners:new Set(),check(){if(this.cancelled)throw Error('cancelled');},wait(p){return p;},onCancel(fn){if(this.cancelled)fn();else this.listeners.add(fn);return ()=>this.listeners.delete(fn);},cancel(){this.cancelled=true;for(const fn of [...this.listeners])fn();}});
   const imageCanvas=data=>{const c=document.createElement('canvas');c.width=data.width;c.height=data.height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data._data),data.width,data.height),0,0);return c;};
   const parent=()=>{const p=new Node('host'),c=new Node('NativeBoardCanvas');p.addChild(c);c.addChild(new Node('HUD'));return p;};
   const layout=(w,h)=>{const portrait=w<h*1.1,left=portrait?0:44,top=portrait?62:12,bottom=portrait?34:21,board=portrait?Math.min(460,w-24,h-top-bottom-190):Math.min(460,h-top-bottom-40,w-left*2-220),y=portrait?Math.max(-h*.08,-h/2+bottom+94+board/2):0;return {width:w,height:h,boardTop:h/2-y-board/2};};
   for(let i=0;i<12;i++){
    const p=parent(),t=token(),lease=await Provider.createOriginalLevelBackground({parent:p,selection:{provider:'mainline',stageId:'mainline-'+String(i+1).padStart(2,'0'),seed:1},token:t});const l=layout(402,844);lease.frame(true,l);lease.setVisible(true);
    const n=p.children[0].children[0];assert(n.name==='OriginalMainlineBackground','background precedes HUD');const canvas=imageCanvas(n.getComponent(Sprite).spriteFrame.texture.image.data);
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let alpha=0,colors=new Set();for(let k=0;k<pixels.length;k+=4){alpha+=pixels[k+3]===255?1:0;if(k%400===0)colors.add(pixels[k]+','+pixels[k+1]+','+pixels[k+2]);}
    assert(alpha===pixels.length/4,'opaque background fills viewport');assert(colors.size>40,'real art not solid fill');draws.push({level:i+1,theme:Original.MAIN[i],width:canvas.width,height:canvas.height,colors:colors.size});
    const before=stats.textures;lease.frame(true,l);assert(stats.textures===before,'same-size no allocations');lease.setVisible(false);assert(n.active===false,'hidden');lease.setVisible(true);assert(n.active===true,'resume visible');
    for(const [w,h] of [[320,568],[844,390],[402,844]])lease.frame(w<h,layout(w,h));
    assert(stats.textures===1&&stats.frames===1&&stats.images===1,'resize resources replaced');lease.dispose();lease.dispose();lease.frame(true,l);assert(stats.refs===0&&stats.textures===0&&stats.frames===0&&stats.images===0,'dispose releases owned resources');
   }
   checks.push('12 exact mainline themes render opaque non-solid original art; 3 viewports; hidden/resume; no-op same layout; texture/frame/image/ref disposal');
   assert(await Provider.createOriginalLevelBackground({parent:parent(),selection:{provider:'r5',stageId:'tide-1'},token:token()})===null,'unmapped provider explicit null');assert(stats.loads===24,'unmapped provider no asset loads');checks.push('R4/R5 mapping is not invented');
   globalThis.failImage='painted-cloud';let failed=false;try{await Provider.createOriginalLevelBackground({parent:parent(),selection:{provider:'mainline',stageId:'mainline-01'},token:token()});}catch{failed=true;}assert(failed&&stats.refs===0,'failed load releases earlier image');globalThis.failImage=null;checks.push('partial image failure releases prior refs');
   const cancelled=token();cancelled.cancelled=true;try{await Provider.createOriginalLevelBackground({parent:parent(),selection:{provider:'mainline',stageId:'mainline-01'},token:cancelled});}catch{}assert(stats.refs===0,'cancellation no image leak');checks.push('cancelled load cannot retain or draw image');
   globalThis.holdImage='painted-cloud';const heldToken=token();const held=Provider.createOriginalLevelBackground({parent:parent(),selection:{provider:'mainline',stageId:'mainline-01'},token:heldToken}).catch(e=>e);await new Promise(r=>setTimeout(r,0));assert(stats.refs===1,'prior image held before cancellation');heldToken.cancel();assert(stats.refs===0,'immediate cancellation releases prior refs without waiting callback');globalThis.holdImage=null;globalThis.releaseImage();await held;assert(stats.refs===0,'late callback does not reacquire refs');checks.push('cancel during never-returning image request immediately releases earlier refs, late callback harmless');
   globalThis.cancelAfterImage='botanical-props';globalThis.cancelToken=token();let raced=false;try{await Provider.createOriginalLevelBackground({parent:parent(),selection:{provider:'mainline',stageId:'mainline-01'},token:globalThis.cancelToken});}catch{raced=true;}globalThis.cancelAfterImage=null;assert(raced&&stats.refs===0,'resolve/continuation cancel owns and releases image');checks.push('cancel between image callback resolve and await continuation cannot leak');
   const gpuParent=parent(),gpu=await Provider.createOriginalLevelBackground({parent:gpuParent,selection:{provider:'mainline',stageId:'mainline-01'},token:token()});globalThis.failTexture=true;let gpuFailed=false;try{gpu.frame(true,layout(402,844));}catch{gpuFailed=true;}assert(gpuFailed&&stats.images===0&&stats.textures===0&&stats.frames===0,'failed GPU image setter cleans candidate objects');globalThis.failTexture=false;gpu.frame(true,layout(402,844));gpu.dispose();assert(stats.refs===0&&stats.textures===0,'retry after failed frame releases all');checks.push('GPU upload failure clears candidate ImageAsset/Texture2D and permits retry');
   // Exercise mini-game factories without document dependence. Real WeChat runtime still needs a device check.
   let calls=[];globalThis.wx={createOffscreenCanvas(o){calls.push('offscreen');const c=document.createElement('canvas');return c;}};Provider.createBackgroundCanvas(12,16);globalThis.wx={createCanvas(){calls.push('canvas');return document.createElement('canvas');}};Provider.createBackgroundCanvas(12,16);delete globalThis.wx;assert(calls.join(',')==='offscreen,canvas','both wx factories');checks.push('wx offscreen and createCanvas branch dispatch');
   const p=parent(),lease=await Provider.createOriginalLevelBackground({parent:p,selection:{provider:'mainline',stageId:'mainline-01'},token:token()});lease.frame(true,layout(402,844));const canvas=imageCanvas(p.children[0].children[0].getComponent(Sprite).spriteFrame.texture.image.data);document.body.appendChild(canvas);lease.dispose();assert(stats.refs===0&&stats.textures===0&&stats.frames===0&&stats.images===0,'preview also releases lease');
   return {result:'PASS',checks,draws,scope:'Real Skia 2D Canvas with original PNG bytes + mock Cocos GPU/scene lifecycle; no Creator/WeChat visual acceptance',retainedPreview:true};
 });
 await page.screenshot({path:path.join(output,'original-mainline-01-cloud-canvas.png')});fs.writeFileSync(path.join(output,'original-background-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
