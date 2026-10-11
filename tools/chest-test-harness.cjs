'use strict';
// Real Skia Canvas pixels with isolated Cocos scene/GPU doubles. Never claims a Creator/device render.
const fs=require('node:fs'),path=require('node:path'),{stripTypeScriptTypes}=require('node:module');
const Canvas=require(process.env.QF_CANVAS_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'../creator-build-project/assets/scripts');
const stats={images:0,textures:0,frames:0,failTexture:false};
class Component{}
class UITransform{setContentSize(w,h){this.width=w;this.height=h;}}
class Color{constructor(hex){this.hex=hex;}}
class Label{static Overflow={SHRINK:2};}
class Sprite{static SizeMode={CUSTOM:0};}
class ImageAsset{constructor(data){this.data=data;this.alive=true;stats.images++;}destroy(){if(this.alive){this.alive=false;stats.images--;}}}
class Texture2D{static PixelFormat={RGBA8888:35};constructor(){this.alive=true;stats.textures++;}set image(v){if(stats.failTexture)throw Error('expected GPU upload failure');this._image=v;}get image(){return this._image;}destroy(){if(this.alive){this.alive=false;stats.textures--;}}}
class SpriteFrame{constructor(){this.alive=true;stats.frames++;}destroy(){if(this.alive){this.alive=false;stats.frames--;}}}
class Node{constructor(name=''){this.name=name;this.children=[];this.components=new Map;this.layer=1;this.active=true;}addChild(n){n.removeFromParent();this.children.push(n);n.parent=this;}removeFromParent(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}addComponent(C){const c=new C;c.node=this;this.components.set(C,c);return c;}getComponent(C){return this.components.get(C)||null;}destroy(){if(this.dead)return;this.dead=true;for(const c of this.components.values())c.onDestroy?.();for(const c of [...this.children])c.destroy();this.children=[];this.removeFromParent();}}
const cc={Node,Component,UITransform,Sprite,SpriteFrame,Texture2D,ImageAsset,Label,Color,isValid:n=>!!n&&!n.dead};
function moduleSource(name){return stripTypeScriptTypes(fs.readFileSync(path.join(root,name+'.ts'),'utf8').replace(/^import .*;\n/gm,'').replace(/^const \{ ccclass \}=_decorator;\n/gm,'').replace(/^@ccclass\([^\n]+\)\n/gm,'').replace(/^export \{[^\n]+from[^\n]+\n/gm,'').replace(/export /g,''),{mode:'transform'});}
const OriginalResultChestPainter=new Function(moduleSource('OriginalResultChestPainter')+';return OriginalResultChestPainter')();
const resource=new Function(...Object.keys(cc),'OriginalResultChestPainter',moduleSource('ResultChestResource')+';return {RESULT_CHEST_RESOURCE:ORIGINAL_RESULT_CHEST_RESOURCE,RESULT_CHEST_SIZE,createChestCanvas}')(...Object.values(cc),OriginalResultChestPainter);
const ResultChestView=new Function(...Object.keys(cc),...Object.keys(resource),moduleSource('ResultChestView')+';return ResultChestView')(...Object.values(cc),...Object.values(resource));
function useCanvas(){globalThis.document={createElement:()=>Canvas.createCanvas(1,1)};}
function instantiate(open=0){const host=new Node('Chest');host.addComponent(UITransform).setContentSize(112,112);const view=host.addComponent(ResultChestView);view.initialize(open);return{host,view};}
function canvasFor(host){const image=host.children[0].getComponent(Sprite).spriteFrame.texture.image.data,c=Canvas.createCanvas(image.width,image.height);c.getContext('2d').putImageData(new Canvas.ImageData(new Uint8ClampedArray(image._data),image.width,image.height),0,0);return c;}
function createChestPNG(open){useCanvas();const {host}=instantiate(open);try{return canvasFor(host).toBuffer('image/png');}finally{host.destroy();}}
module.exports={Canvas,stats,cc,resource,OriginalResultChestPainter,ResultChestView,instantiate,canvasFor,createChestPNG,useCanvas};
