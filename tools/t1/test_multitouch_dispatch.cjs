#!/usr/bin/env node
'use strict';
/* T1 多指负控（CPU，真实 Cocos 3.8.8 小游戏输入源 → touchManager → input → PointerEventDispatcher → Node.dispatchEvent）。
 * 不直接调用 observeTouch，不人工发 GLOBAL 回调。UITransform.hitTest 矩形、激活态、UI 相机优先级为 CPU 桩；灯塔命中为注入谓词。
 * 用法: T1_FIXTURE=<…/island-lighthouse-return/tools/fixture.cjs> ROOM_COCOS_CPU=… ROOM_TYPESCRIPT=… \
 *       node test_multitouch_dispatch.cjs <IslandHomeInteraction.ts> <WarmButton.ts> [--raw-wx] */
const fs=require('fs'),crypto=require('crypto');
const [candidate,warmFile,flag]=process.argv.slice(2);
const {cc,transpile}=require(process.env.T1_FIXTURE);
const vm=require('vm');
const T=cc.Node.EventType,touchSrc=cc.input._touchInput;
if(!touchSrc||typeof touchSrc._createCallback!=='function')throw Error('engine touch input source not reachable');
// 可选：模拟微信平台层多监听（wx.onTouchStart 允许多个监听；真实设备行为待验）。
const rawListeners=new Set();const wx=flag==='--raw-wx'?{onTouchStart:f=>rawListeners.add(f),offTouchStart:f=>rawListeners.delete(f)}:undefined;
const src=fs.readFileSync(candidate,'utf8');let audio=0;
const scope={exports:{},require:n=>n==='cc'?cc:{GameAudio:{notifyUserGesture(){audio++}}},console,Math,Number,Promise,Array,globalThis:wx?{wx}:{}};
vm.runInNewContext(transpile(src),scope);const {IslandHomeInteraction}=scope.exports;
const ws={exports:{},require:n=>n==='cc'?cc:n.includes('WarmButtonSkin')?{WarmButtonSkin:class{}}:{GameAudio:{notifyUserGesture(){}}},console};
vm.runInNewContext(transpile(fs.readFileSync(warmFile,'utf8').replace(/@ccclass\('WarmButton'\)/,'')),ws);const {WarmButton}=ws.exports;
cc.director.root.batcher2D={getFirstRenderCamera:()=>({priority:0})};
cc.view._scaleX=1;cc.view._scaleY=1;
function activate(n){n._activeInHierarchy=true;n._eventProcessor.setEnabled(true);}
const H=844;
// 原始平台事件 → 真实引擎回调。屏幕 y 向下；引擎转换为 UI y 向上。
const live=new Map();
function raw(type,id,x,y){const t={identifier:id,clientX:x,clientY:y,pageX:x,pageY:y};if(type==='touch-start')live.set(id,t);const changed=[t];
 if(type==='touch-start')for(const f of rawListeners)f({touches:[...live.values()],changedTouches:changed});
 if(type==='touch-end'||type==='touch-cancel')live.delete(id);
 touchSrc._createCallback(type)({changedTouches:changed,touches:[...live.values()]});}
function fixture(){const canvas=new cc.Node('Canvas');activate(canvas);let returns=0,uiActions=0;
 const input=new IslandHomeInteraction(canvas,{canUse:()=>true,hit:(x,y)=>x>=100&&x<=200&&y>=250&&y<=600,returnHome(){returns++;return new Promise(()=>{});}});input.sync(390,H,true);
 const root=canvas.getChildByName('IslandLighthouseTouch');root.getComponent(cc.UITransform).hitTest=p=>p.x>=0&&p.x<=390&&p.y>=0&&p.y<=H;activate(root);
 const ui=new cc.Node('ExistingIslandWarmButton');canvas.addChild(ui);ui.addComponent(cc.UITransform).hitTest=p=>p.x>=280&&p.x<=350&&p.y>=50&&p.y<=120;activate(ui);
 const warm=new WarmButton();warm.node=ui;Object.defineProperty(warm,'enabledInHierarchy',{value:true});warm.bind(()=>uiActions++);ui._eventProcessor.setEnabled(true);
 return{input,warm,get returns(){return returns},get uiActions(){return uiActions},frame(){input.sync(390,H,true);},dispose(){input.dispose();warm.onDestroy();ui.destroy();canvas.destroy();for(const id of [...live.keys()])raw('touch-cancel',id,0,0);}};}
// CPU 加载器窗口 800×600：屏幕 clientY = 600 - UI y。灯塔 UI(150,400)，WarmButton UI(300,80)，海面 UI(30,300)。
const WIN_H=cc.screen.windowSize.height,scr=(x,uy)=>[x,WIN_H-uy];
const A=scr(150,400),B=scr(300,80),SEA=scr(30,300);
const cases=[
 {name:'single-tap-lighthouse',expect:1,run:x=>{raw('touch-start',1,...A);x.frame();raw('touch-end',1,...A);}},
 {name:'B-held-on-WarmButton-A-releases-first',expect:0,run:x=>{raw('touch-start',1,...A);raw('touch-start',2,...B);x.frame();raw('touch-end',1,...A);raw('touch-end',2,...B);}},
 {name:'B-held-on-WarmButton-no-frame-between',expect:0,run:x=>{raw('touch-start',1,...A);raw('touch-start',2,...B);raw('touch-end',1,...A);raw('touch-end',2,...B);}},
 {name:'B-tap-released-on-WarmButton-with-frame-before-A-up',expect:0,run:x=>{raw('touch-start',1,...A);raw('touch-start',2,...B);x.frame();raw('touch-end',2,...B);x.frame();raw('touch-end',1,...A);}},
 {name:'B-tap-released-on-WarmButton-within-one-frame',expect:0,run:x=>{raw('touch-start',1,...A);x.frame();raw('touch-start',2,...B);raw('touch-end',2,...B);x.frame();raw('touch-end',1,...A);}},
 {name:'B-on-sea-surface-held',expect:0,run:x=>{raw('touch-start',1,...A);raw('touch-start',2,...SEA);raw('touch-end',1,...A);raw('touch-end',2,...SEA);}},
 {name:'B-first-on-WarmButton-then-A-tap',expect:0,run:x=>{raw('touch-start',2,...B);raw('touch-start',1,...A);raw('touch-end',1,...A);raw('touch-end',2,...B);}},
 {name:'clean-tap-after-multitouch-gesture',expect:1,run:x=>{raw('touch-start',1,...A);raw('touch-start',2,...B);raw('touch-end',1,...A);raw('touch-end',2,...B);x.frame();raw('touch-start',3,...A);x.frame();raw('touch-end',3,...A);}},
 {name:'tap-sea-only',expect:0,run:x=>{raw('touch-start',1,...SEA);raw('touch-end',1,...SEA);}},
];
const rows=[];for(const c of cases){const x=fixture();c.run(x);rows.push({case:c.name,expected:c.expect,actual:x.returns,pass:x.returns===c.expect});x.dispose();}
const report={candidateSHA256:crypto.createHash('sha256').update(src).digest('hex'),rawWx:!!wx,engineTouchSource:'input._touchInput._createCallback (real 3.8.8 minigame source; releases touch before building EventTouch on end/cancel)',rows,gatePass:rows.every(r=>r.pass)};
console.log(JSON.stringify(report,null,1));process.exitCode=report.gatePass?0:3;
