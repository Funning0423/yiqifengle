'use strict';
// Reuse the existing full-board API double without running its stale pre-task-4 assertions.
const fs=require('node:fs'),path=require('node:path');
module.exports=function loadHarness({baseline=false}={}){
 const tools=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(tools,'test_tool_switch_ui.cjs'),'utf8');
 let pre=source.slice(0,source.indexOf('const checks=[];'));
 pre=pre.replace("const {ManagedMobileBoardUI:UI}=evaluate", "class ResultChestView { initialize(open){this.open=open;}setOpen(open){this.open=open;} } const RESULT_CHEST_SIZE=112;\nconst {ManagedMobileBoardUI:UI}=evaluate");
 pre=pre.replace("{GameAudio,...warm,managedTools,ManagedToolArt,resultLayout,resultActionCount,Controller", "{ResultChestView,RESULT_CHEST_SIZE,GameAudio,...warm,managedTools,ManagedToolArt,resultLayout,resultActionCount,Controller");
 const boardPath=path.resolve(process.env.QF_UI_BOARD_ROOT||path.resolve(tools,'..'),'creator-build-project/assets/scripts/ManagedMobileBoardUI.ts'),needsTactile=!baseline&&fs.readFileSync(boardPath,'utf8').includes("from './ui/TactileToolButton'");
 if(needsTactile){
  pre=pre.replace('const {ManagedMobileBoardUI:UI}=evaluate',`const C=require('./cloud-tool-art/canvas.cjs');
  class ToolImage {constructor(data){this.data=data;}destroy(){this.destroyed=true;}}
  class ToolTexture {static PixelFormat={RGBA8888:35};set image(i){this._image=i;}get image(){return this._image;}destroy(){this.destroyed=true;}}
  class ToolFrame {destroy(){this.destroyed=true;}}class ToolSize {constructor(width,height){Object.assign(this,{width,height});}}
  const tactile=evaluate(root+'/ui/TactileToolButton.ts',['TactileToolButton','tactileToolButton','tactileToolGraphics'],{...warm,ImageAsset:ToolImage,Texture2D:ToolTexture,SpriteFrame:ToolFrame,Size:ToolSize,document:{createElement:()=>C.createCanvas(1,1)}});
  const {ManagedMobileBoardUI:UI}=evaluate`);
  pre=pre.replace('{ResultChestView,RESULT_CHEST_SIZE,GameAudio,...warm,','{...tactile,ResultChestView,RESULT_CHEST_SIZE,GameAudio,...warm,');
 }
 const realfs=fs,proxy={...fs,readFileSync(file,...args){if(baseline&&String(file).endsWith('/ManagedMobileBoardUI.ts'))return require('node:child_process').execFileSync('git',['show','4cf1cab:creator-build-project/assets/scripts/ManagedMobileBoardUI.ts'],{cwd:path.resolve(tools,'..'),encoding:'utf8'});if(!baseline&&String(file).endsWith('/ManagedMobileBoardUI.ts'))return realfs.readFileSync(boardPath,...args);return realfs.readFileSync(file,...args)}};
 return new Function('require','__dirname',pre+';return {setup,tapNode,drag,event,point,evaluate,root,cc,Node,warm,UI,Graphics,Color,Label,UITransform,Sprite,Vec3,resourceCalls,ImageAsset,resultLayout,resultActionCount,ResultChestView};')(id=>id==='fs'?proxy:id==='./cloud-tool-art/canvas.cjs'?require('../cloud-tool-art/canvas.cjs'):require(id),tools);
};
