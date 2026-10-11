'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const root='creator-build-project/assets/scripts/';
const managed=fs.readFileSync(root+'ManagedMobileBoardUI.ts','utf8'),world=fs.readFileSync(root+'WorldIntegrationBoot.ts','utf8');
const compile=(body,vars={})=>new Function(...Object.keys(vars),stripTypeScriptTypes('class Test {'+body+'}',{mode:'transform'})+';return Test')(...Object.values(vars));
const checks=[];
async function main(){
const invoke=world.split('\n').find(l=>l.startsWith(' private async invoke('));
const W=compile(invoke);let modal=true,calls=0,paints=0;const w=new W;w.board=()=>({hostModalOpen:()=>modal});w.paintNavigation=()=>paints++;w.error='keep';
await w.invoke(()=>calls++);assert.equal(calls,0);assert.equal(w.error,'keep');modal=false;await w.invoke(()=>{calls++;return {ok:true}});assert.equal(calls,1);assert.equal(paints,1);
// A touch can already belong to the navigation Canvas before the modal opens.
modal=true;await w.invoke(()=>{throw Error('a captured second-finger release must be blocked')});assert.equal(w.busy,false);
checks.push('actual WorldNavigation invoke blocks fresh and captured releases while the board modal is open');
const navigation=world.slice(world.indexOf(' private paintNavigation()'),world.indexOf('\n update()'));
const Nav=compile(navigation,{Label:class Label{}});let boardModal=true;
const snapshot={provider:'mainline-v33',state:'result.saved',active:{level:3},result:{completionRecorded:true},nextStageId:'mainline-05',journey:{chests:[{level:3,earned:true}],regionRewards:[{region:0,unlocked:true}]}};
const n=new Nav;n.composition={worldCommands:()=>({snapshot:()=>({state:'level',needsResume:false}),dayNight:()=>({mode:'day'})})};n.notice={node:{parent:{}}};n.status={node:{parent:{}}};n.board=()=>({hostPresentation:()=>snapshot,hostLayout:()=>({}),hostModalOpen:()=>boardModal});n.placeResultButtons=()=>{};n.navLayout=()=>({width:390,height:844});
const names=['resume','mainNext','chest','regionReward','next','claim','leave','home','mainline','r4','tide','meadow','sky','dayNight'];n.controls=new Map(names.map(k=>[k,{active:false,setPosition(){},getComponentsInChildren:()=>[{}]}]));
n.paintNavigation();for(const key of ['mainNext','chest','regionReward'])assert.equal(n.controls.get(key).active,false,key);boardModal=false;n.paintNavigation();for(const key of ['mainNext','chest','regionReward'])assert.equal(n.controls.get(key).active,true,key);
snapshot.provider='regional-r05';snapshot.active={region:'tide'};snapshot.progress={records:{},claimedRegions:[]};snapshot.nextStageId='r05-tide-02';boardModal=true;n.paintNavigation();assert.equal(n.controls.get('next').active,false);boardModal=false;n.paintNavigation();assert.equal(n.controls.get('next').active,true);
snapshot.nextStageId=null;snapshot.progress.records=Object.fromEntries([1,2,3,4].map(i=>['r05-tide-0'+i,{}]));boardModal=true;n.paintNavigation();assert.equal(n.controls.get('claim').active,false);boardModal=false;n.paintNavigation();assert.equal(n.controls.get('claim').active,true);
checks.push('actual mainline and regional result navigation hides during modal, restores original eligibility after close');
let pending=[],textures=0,frames=0,refs=0,frameCreated=0,failAt=0,failTexture=false;
class Texture2D{constructor(){textures++;this.alive=true;}set image(a){if(failTexture)throw Error('expected texture upload failure');this.asset=a;}destroy(){assert(this.alive);this.alive=false;textures--;}}
class SpriteFrame{constructor(){frames++;frameCreated++;this.alive=true;}set texture(a){if(frameCreated===failAt)throw Error('expected frame setup failure');this.tex=a;}destroy(){assert(this.alive);this.alive=false;frames--;}}
class ImageAsset{}class Sprite{}class Rect{constructor(...v){this.v=v}}
const resources={load:(p,T,cb)=>pending.push(cb)},isValid=o=>!o.dead;
const artStart=managed.indexOf('  private loadPieceArt()'),artEnd=managed.indexOf('  private toolArt!');
assert(artStart>=0&&artEnd>artStart,'piece-atlas method boundaries must exist');
const methods=managed.slice(artStart,artEnd);
const Art=compile(methods,{resources,ImageAsset,Texture2D,SpriteFrame,Sprite,Rect,isValid,console:{error(){}}});
const asset={addRef(){refs++},decRef(){refs--}};const make=()=>{const a=new Art;a.node={};a.frames=[];a.pieceImage=null;a.pieceTexture=null;a.spriteReady=false;a.sprites=[];a.root={getComponentsInChildren:()=>a.sprites};a.paint=()=>{};return a};
for(let i=0;i<30;i++){const a=make();a.loadPieceArt();pending.shift()(null,asset);assert.equal(textures,1);assert.equal(frames,6);assert.equal(refs,1);a.sprites=[{spriteFrame:a.frames[0]}];a.releasePieceArt();assert.equal(a.sprites[0].spriteFrame,null);a.releasePieceArt();assert.equal(textures,0);assert.equal(frames,0);assert.equal(refs,0)}
checks.push('30 stage entry/exit cycles release all six generated frames, their texture and owned image reference exactly once');
for(const target of ['component','node']){const a=make();a.loadPieceArt();if(target==='component')a.dead=true;else a.node.dead=true;pending.shift()(null,asset);assert.equal(textures,0);assert.equal(frames,0);assert.equal(refs,0)}
for(const kind of ['texture','frame']){const a=make();failTexture=kind==='texture';failAt=kind==='frame'?frameCreated+3:0;a.loadPieceArt();pending.shift()(null,asset);assert.equal(textures,0);assert.equal(frames,0);assert.equal(refs,0);failTexture=false;failAt=0}
const a=make();a.loadPieceArt();pending.shift()(Error('missing'),null);assert.equal(textures,0);a.loadPieceArt();pending.shift()(null,asset);a.sprites=[{spriteFrame:a.frames[0]}];a.loadPieceArt();pending.shift()(null,asset);assert.equal(textures,1);assert.equal(frames,6);assert.equal(refs,1);assert.equal(a.sprites[0].spriteFrame,null);a.releasePieceArt();
assert.match(managed,/onDestroy\(\)\{this\.releasePieceArt\(\)/);
checks.push('late callbacks, component-only disposal, missing image, partial GPU failure and replacement cannot leak or resurrect atlas resources');
const bridgeSource=fs.readFileSync(root+'audio/AudioBridge.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^@ccclass.*\n/gm,'').replace(/export /g,'').split('// Mount once')[0];
class Emitter{constructor(name){this.name=name;this.handlers=new Map()}on(k,f,t){const a=this.handlers.get(k)||[];a.push([f,t]);this.handlers.set(k,a)}emit(k,...args){for(const[f,t]of this.handlers.get(k)||[])f.apply(t,args)}}
class WarmButton{static ACTIVATED='warm-button-activated';constructor(node){this.node=node}}
const nodes=['back','bag','retry','hint','返回','打开第1关宝箱','关上','slot'].map(n=>new Emitter(n)),panel=new Emitter('ResultPage');
const scene={getComponentsInChildren:()=>nodes.map(n=>new WarmButton(n))};let buttonSounds=0,toolSounds=0;const GameAudio={instance:{onButton:()=>buttonSounds++,onToolTap:()=>toolSounds++}};
const Bridge=new Function('Component','Node','WarmButton','GameAudio','director','_decorator','isValid',stripTypeScriptTypes(bridgeSource,{mode:'transform'})+';return AudioBridge')(class{}, {EventType:{TOUCH_END:'end'}},WarmButton,GameAudio,{getScene:()=>scene},{ccclass:()=>x=>x},o=>!o.dead);
const bridge=new Bridge;let toolState={state:'run.ready',readOnly:false},toolModal=false;bridge.board={hostPresentation:()=>toolState,hostModalOpen:()=>toolModal};bridge.scanButtons();bridge.scanButtons();
for(const node of [...nodes,panel])node.emit('end');assert.equal(buttonSounds,0);assert.equal(toolSounds,0);panel.emit(WarmButton.ACTIVATED);assert.equal(buttonSounds,0);
for(const node of nodes.slice(0,-1))node.emit(WarmButton.ACTIVATED);assert.equal(buttonSounds,nodes.length-1,'all real buttons, including nested modal buttons, once only');nodes.at(-1).emit(WarmButton.ACTIVATED);assert.equal(toolSounds,1);toolModal=true;nodes.at(-1).emit(WarmButton.ACTIVATED);toolModal=false;toolState.readOnly=true;nodes.at(-1).emit(WarmButton.ACTIVATED);toolState={state:'run.paused'};nodes.at(-1).emit(WarmButton.ACTIVATED);assert.equal(toolSounds,1);
checks.push('AudioBridge tags real WarmButton components recursively, never ResultPage or raw touch-end; modal, readonly and paused tools stay silent');
console.log(JSON.stringify({status:'PASS',checks,scope:'Actual patched methods with adversarial scene/resource doubles; official Cocos 3.8.8 lifecycle reviewed; GPU/device NOT RUN'},null,2));}
main().catch(e=>{console.error(e);process.exitCode=1});
