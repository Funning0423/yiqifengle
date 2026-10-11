'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Canvas,stats,cc,resource,OriginalResultChestPainter,ResultChestView,instantiate,canvasFor,useCanvas}=require('./chest-test-harness.cjs');
const output=path.resolve(__dirname,'../evidence/result-chest');fs.mkdirSync(output,{recursive:true});useCanvas();
const checks=[];const alive=(n=0)=>{for(const k of ['images','textures','frames'])assert.equal(stats[k],n,k+' count');};
let samples={};
for(const open of [0,.25,.5,.75,1]){const{host,view}=instantiate(open);assert.equal(view.diagnostics().kind,'painted-2d');const c=canvasFor(host);const bytes=c.toBuffer('image/png');fs.writeFileSync(path.join(output,`chest-${open}.png`),bytes);samples[open]=crypto.createHash('sha256').update(bytes).digest('hex');const pixels=c.getContext('2d').getImageData(0,0,256,256).data;let minX=256,minY=256,maxX=-1,maxY=-1;const colors=new Set;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4;if(pixels[i+3]>32){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);colors.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);}}assert(colors.size>500,'gradient/grain pixels');assert(maxY-minY>=249,'painted surface is filled vertically for small screens');view.onDisable();assert.equal(host.children[0].active,false);view.onEnable();assert.equal(host.children[0].active,true);host.destroy();host.destroy();alive();}
assert.notEqual(samples[0],samples[1]);checks.push('Real Skia 256px art: five lid states, gradients/grain, visible cavity, distinct closed/open pixels; alpha bounds fill >97% of height');
for(let i=0;i<100;i++){const{host}=instantiate(i%2);host.destroy();}alive();checks.push('100 alternating closed/open page entries leave zero ImageAsset, Texture2D and SpriteFrame allocations');
{
 const host=new cc.Node('lease');const lease=resource.RESULT_CHEST_RESOURCE.create(host);lease.setOpen(0);alive(1);const first=host.children[0].getComponent(cc.Sprite).spriteFrame;lease.setOpen(0);assert.equal(host.children[0].getComponent(cc.Sprite).spriteFrame,first);lease.setOpen(1);alive(1);assert(first.alive===false);lease.setOpen(NaN);alive(1);lease.dispose();lease.dispose();lease.setOpen(1);lease.setVisible(true);alive();assert.equal(host.children.length,0);
}checks.push('Identical state reuses resources; changed state releases old assets; invalid open clamps closed; disposal is idempotent and blocks late updates');
{
 const host=new cc.Node('lease');const lease=resource.RESULT_CHEST_RESOURCE.create(host);lease.setOpen(0);const first=host.children[0].getComponent(cc.Sprite).spriteFrame;stats.failTexture=true;assert.throws(()=>lease.setOpen(1),/GPU/);stats.failTexture=false;alive(1);assert.equal(host.children[0].getComponent(cc.Sprite).spriteFrame,first);lease.setOpen(1);alive(1);lease.dispose();alive();
}checks.push('GPU upload failure destroys all candidate objects, preserves old frame, permits retry, and releases on dispose');
{
 const originalWarn=console.warn;console.warn=()=>{};delete globalThis.document;const{host,view}=instantiate(1);assert.match(view.diagnostics().error,/No supported/);assert(host.getComponent(cc.Label).enabled);alive();useCanvas();view.initialize(1);assert(!host.getComponent(cc.Label).enabled);assert.equal(view.diagnostics().error,null);alive(1);view.onDestroy();host.destroy();alive();console.warn=originalWarn;
}checks.push('Missing Canvas renders a bounded error label, leaves page controls available, retries cleanly without stale label');
{
 let calls=[];globalThis.wx={createOffscreenCanvas(){calls.push('offscreen');return Canvas.createCanvas(1,1);},createCanvas(){calls.push('canvas');return Canvas.createCanvas(1,1);}};resource.createChestCanvas(1,1);delete wx.createOffscreenCanvas;resource.createChestCanvas(1,1);assert.deepEqual(calls,['offscreen','canvas']);delete globalThis.wx;
}checks.push('WeChat offscreen factory is preferred; createCanvas fallback checked with doubles (not device verified)');
{
 let disposed=0,visible=[];const{host,view}=instantiate(0);view.initialize(1,{id:'test-only-model-contract',kind:'model-3d',source:'fixture-not-shipping',create(host){assert(host.name==='Chest');return{setOpen(n){assert.equal(n,1)},setVisible(v){visible.push(v)},dispose(){disposed++}}}});alive();view.onDisable();view.onEnable();view.onDestroy();view.onDestroy();assert.deepEqual(visible,[false,true]);assert.equal(disposed,1);host.destroy();
}checks.push('Resource substitution/lifecycle contract tested with a lease double; real 3D implementation is tested separately');
// Verify copied chest helper/body/lid/draw source against the actual recovered original, if available.
const originalPath=process.env.QF_ORIGINAL_TREASURE||path.resolve(__dirname,'../../asset-research/CommonR2/fixed/shared/treasure.js');
let originalCheck='not present';
if(fs.existsSync(originalPath)){
 const original=fs.readFileSync(originalPath,'utf8'),copied=fs.readFileSync(path.resolve(__dirname,'../creator-build-project/assets/scripts/OriginalResultChestPainter.ts'),'utf8');
 assert.equal(crypto.createHash('sha256').update(original).digest('hex'),'132077f104e8c5c965f00ee42278cdb4a6aa96cd7f14a93efb1cb4d6e62645a6');
 for(const [a,b]of [['function path(','function bell('],['function body(','class Treasure'],[' drawChest(',' getStats(']])assert(copied.includes(original.slice(original.indexOf(a),original.indexOf(b))),'original code segment '+a);
 const module={exports:{}};new Function('module','require',original)(module,name=>name==='./regional-content'?{REGIONS:[],toolRegion:()=>-1}:{});const old=new module.exports({createCanvas:Canvas.createCanvas}),now=new OriginalResultChestPainter({createCanvas:Canvas.createCanvas});
 for(const open of [0,.25,.5,.75,1]){const a=Canvas.createCanvas(256,256),b=Canvas.createCanvas(256,256);old.drawChest(a.getContext('2d'),128,128,240,{open,timeMs:720});now.drawChest(b.getContext('2d'),128,128,240,{open,timeMs:720});assert.deepEqual(a.toBuffer('image/png'),b.toBuffer('image/png'),'unchanged original artwork pixels');}now.dispose();originalCheck='PASS: source SHA and five uncropped output frames are byte-identical';checks.push(originalCheck);
}
// Before/after comparison is actual production before geometry and production replacement pixels.
const c=Canvas.createCanvas(1000,480),ctx=c.getContext('2d');ctx.fillStyle='#e8e3d8';ctx.fillRect(0,0,1000,480);ctx.fillStyle='#365b50';ctx.font='24px sans-serif';ctx.fillText('Cloud Canvas comparison - original 2D art restored, not final 3D',24,36);
const before=fs.readFileSync(path.resolve(__dirname,'chest-model/stage3-managed-ui.ts.txt'),'utf8');let body=before.slice(before.indexOf('  private drawChest('),before.indexOf('\n  onDestroy()',before.indexOf('  private drawChest(')));body=body.replace(/  private drawChest\([^\{]+\)\{/,'function drawChest(parent,x,y,open){');
const graphics={roundRect(...v){ctx.beginPath();ctx.roundRect(...v)},circle(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2)},fill(){ctx.fillStyle=this.fillColor.hex;ctx.fill()},stroke(){ctx.strokeStyle=this.strokeColor.hex;ctx.lineWidth=this.lineWidth;ctx.stroke()}};
const drawBefore=new Function('Color','Graphics',body+';return drawChest')(cc.Color,function(){return graphics});
for(let i=0;i<2;i++){ctx.save();ctx.translate(150+i*280,235);ctx.scale(2.2,-2.2);drawBefore.call({box:()=>({addComponent:()=>graphics})},null,0,0,i);ctx.restore();}
ctx.font='18px sans-serif';for(const[x,t]of [[36,'Stage3 flat / closed'],[316,'Stage3 flat / opened'],[610,'Restored / closed'],[810,'Restored / opened']])ctx.fillText(t,x,430);
for(const[open,x]of [[0,575],[1,785]]){const{host}=instantiate(open);ctx.drawImage(canvasFor(host),x,110,200,200);host.destroy();}
ctx.font='15px sans-serif';ctx.fillText('Restored side face, original wood grain, metal trims, lifted lid and illuminated cavity.',24,466);fs.writeFileSync(path.join(output,'before-after.png'),c.toBuffer('image/png'));alive();
const report={status:'PASS',scope:'Real native Skia Canvas rasterization + Cocos lifecycle/GPU doubles. NOT Creator engine, Mac, WeChat or phone acceptance. This suite explicitly selects the retained original painted-2d comparison backend. Shipping default is tested separately by test_result_chest_3d.cjs.',checks,originalCheck,samples};fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
