'use strict';
// Executes the unedited Cocos 3.8.8 Input, PointerEventDispatcher and NodeEventProcessor
// source with small host/device doubles. This is engine-method evidence, not a Creator
// build, trusted-browser input test, or recorded-audio/device listening result.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const ROOT=path.resolve(__dirname,'..'),UP=path.join(ROOT,'evidence/audio-ui-capture/upstream-v3.8.8');
const TS=s=>stripTypeScriptTypes(s.replace(/^import[\s\S]*?;\s*$/gm,'').replace(/^@ccclass\([^\n]+\)\n/gm,'').replace(/^const \{ ccclass \} = _decorator;\n/gm,'').replace(/export /g,''),{mode:'transform'});
class Events {
 constructor(){this.events=new Map();} on(n,f,t,once=false){const a=this.events.get(n)||[];if(!a.some(x=>x[0]===f&&x[1]===t))a.push([f,t,once]);this.events.set(n,a);}
 once(n,f,t){this.on(n,f,t,true);} off(n,f,t){this.events.set(n,(this.events.get(n)||[]).filter(x=>f?(x[0]!==f||x[1]!==t):false));this.offCallback?.();}
 emit(n,...args){for(const [f,t,once]of [...(this.events.get(n)||[])]){if(once)this.off(n,f,t);f.apply(t,args);}}
 hasEventListener(n,f,t){return(this.events.get(n)||[]).some(x=>!f||(x[0]===f&&x[1]===t));}
 removeAll(t){for(const[n,a]of this.events)this.events.set(n,a.filter(x=>x[1]!==t));this.offCallback?.();}clear(){this.events.clear();this.offCallback?.();}_registerOffCallback(f){this.offCallback=f;}
 dispatchEventsInCache(){}
}
function harness({baseline=false,saved={},missingValue='',pendingAudio=false}={}){
 let ctx,seq=0;const loads=[],sfxLoads=[],writes=[],storage=new Map(Object.entries(saved)),trace=[];
 const types=Object.fromEntries(['TOUCH_START','TOUCH_MOVE','TOUCH_END','TOUCH_CANCEL','MOUSE_DOWN','MOUSE_UP','MOUSE_MOVE','MOUSE_ENTER','MOUSE_LEAVE','MOUSE_WHEEL','KEY_DOWN'].map(k=>[k,k.toLowerCase().replace('_','-')]));
 class Component {constructor(){this.enabledInHierarchy=true;}destroy(){this.queued=true;return true;}}
 class Node {
  static EventType=types;
  constructor(name=''){this.name=name;this.uuid=String(++seq);this.parent=null;this.children=[];this.components=[];this.valid=true;this.isValid=true;this.activeInHierarchy=true;this._objFlags=0;this._uiProps={};this.position={x:0,y:0,z:0};this.layer=1;this.eventProcessor=new ctx.NEP(this);this.eventProcessor.setEnabled(true);}
  get siblingIndex(){return this.parent?.children.indexOf(this)||0;}
  addChild(n){if(n.parent)n.removeFromParent();this.children.push(n);n.parent=this;}
  removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}
  addComponent(C){const c=new C();c.node=this;this.components.push(c);c.onLoad?.();return c;}
  getComponent(C){return typeof C==='string'?null:this.components.find(c=>c instanceof C)||null;}
  _getUITransformComp(){return this.getComponent(UITransform);}
  on(...a){this.eventProcessor.on(...a);}off(...a){this.eventProcessor.off(...a);}emit(...a){this.eventProcessor.emit(...a);}dispatchEvent(e){this.eventProcessor.dispatchEvent(e);}
  setPosition(x,y,z=0){this.position={x,y,z};}
  destroy(){this.eventProcessor.setEnabled(false);this.eventProcessor.destroy();this.valid=this.isValid=false;this._objFlags=2;this.removeFromParent();}
 }
 class UITransform {constructor(){this.width=46;this.height=46;this.cameraPriority=0;}setContentSize(w,h){this.width=w;this.height=h;}hitTest(p,windowId=0){return windowId===0&&Math.abs(p.x-this.node.position.x)<=this.width/2&&Math.abs(p.y-this.node.position.y)<=this.height/2;}}
 class AudioSource{constructor(){this.clip=null;this.playing=false;this.starts=0;this.stops=0;this.pauses=0;}play(){this.starts++;trace.push('play');this.playing=!pendingAudio;}pause(){this.pauses++;this.playing=false;}stop(){this.stops++;this.playing=false;}playOneShot(){}}
 class EventTouch {constructor(touches=[],bubbles=false,type=types.TOUCH_START){this.type=type;this.code=type;this.touch=touches[0];this.touches=touches;this.bubbles=bubbles;this.windowId=0;this.preventSwallow=false;this.propagationStopped=false;this.propagationImmediateStopped=false;}getTouches(){return this.touches;}getID(){return this.touch.getID();}getLocation(out){const p=this.touch.p;return out?Object.assign(out,p):{...p};}getUILocation(){return this.getLocation();}getEventCode(){return this.code;}}
 const touch=(id,x=0,y=0)=>({getID:()=>id,p:{x,y}}),touches=new Map();
 const touchManager={getOrCreateTouch(id,x,y){const t=touches.get(id)||touch(id,x,y);t.p={x,y};touches.set(id,t);return t;},releaseTouch(id){touches.delete(id);}};
 const game=new Events(),wxEvents=new Events(),director=new Events();let scene;
 director.getScene=()=>scene;director.addPersistRootNode=()=>{};
 const wx={setInnerAudioOption(o){o.success();}};for(const event of ['Hide','Show','AudioInterruptionBegin','AudioInterruptionEnd']){wx['on'+event]=f=>wxEvents.on(event,f);wx['off'+event]=f=>wxEvents.off(event,f);}
 ctx={Component,Node,UITransform,AudioSource,AudioClip:class{},Graphics:class{},Color:class{},EventTouch,EventMouse:class{},Event:class{},Touch:class{},Vec2:class{},Pool:class{constructor(f){this.f=f;}alloc(){return this.f();}free(){}},CallbacksInvoker:Events,EventTarget:Events,InputEventType:types,NodeEventType:types,cclegacy:{},CCObjectFlags:{Destroying:1,Destroyed:2},js:{array:{remove(a,x){const i=a.indexOf(x);if(i>=0)a.splice(i,1);},removeAt(a,i){a.splice(i,1);}}},EDITOR_NOT_IN_PREVIEW:false,HTML5:false,NATIVE:false,AccelerometerInputSource:Events,MouseInputSource:Events,TouchInputSource:Events,KeyboardInputSource:Events,touchManager,resources:{load:(p,t,cb)=>loads.push({p,cb}),loadDir:(p,t,cb)=>sfxLoads.push(cb)},director,game,Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},sys:{Feature:{},hasFeature:()=>false,localStorage:{getItem:k=>storage.has(k)?storage.get(k):missingValue,setItem:(k,v)=>{writes.push([k,v]);storage.set(k,v);}}},isValid:o=>!!o&&o.valid!==false&&o.isValid!==false&&!o.queued,wx,_decorator:{ccclass:()=>x=>x},console};
 vm.createContext(ctx);
 vm.runInContext(TS(fs.readFileSync(path.join(UP,'input.ts'),'utf8'))+'\nglobalThis.input=input;globalThis.Input=Input;',ctx);
 vm.runInContext(TS(fs.readFileSync(path.join(UP,'node-event-processor.ts'),'utf8'))+'\nglobalThis.NEP=NodeEventProcessor;',ctx);
 vm.runInContext(TS(fs.readFileSync(path.join(UP,'pointer-event-dispatcher.ts'),'utf8'))+'\nglobalThis.pointer=pointerEventDispatcher;',ctx);
 scene=new Node('Scene');
 const srcRoot=baseline?path.join(ROOT,'tools/audio-gesture-fixtures'):ROOT;
 vm.runInContext(TS(fs.readFileSync(path.join(srcRoot,'creator-build-project/assets/scripts/audio/GameAudio.ts'),'utf8'))+'\nglobalThis.A=GameAudio;',ctx);
 vm.runInContext(TS(fs.readFileSync(path.join(srcRoot,'creator-build-project/assets/scripts/WarmButton.ts'),'utf8'))+'\nglobalThis.WarmButton=WarmButton;',ctx);
 const boardText=fs.readFileSync(path.join(srcRoot,'creator-build-project/assets/scripts/ManagedMobileBoardUI.ts'),'utf8');
 const cellLines=boardText.split('\n').filter(l=>l.includes('n.on(Node.EventType.')&&((l.includes('this.dragStart')&&!l.includes('this.toolDrag'))||l.includes('d.consumed=true'))).join('\n').replace('this.cells.push(n);','');
 vm.runInContext(TS('globalThis.bindCell=function(n,i){'+cellLines+'};'),ctx);
 const toolLines=boardText.split('\n').filter(l=>l.includes('n.on(Node.EventType.')&&(l.includes('this.toolDrag')||l.includes('this.endToolDrag'))).join('\n').replace('return n;}','');
 vm.runInContext(TS('globalThis.bindTool=function(n){const slot=0;'+toolLines+'};'),ctx);
 const toolMethod=boardText.slice(boardText.indexOf('  private endToolDrag('),boardText.indexOf('  private toolSlot('));
 vm.runInContext(TS('class ToolHandler{'+toolMethod+'}\nglobalThis.ToolHandler=ToolHandler;'),ctx);
 const a=ctx.A.ensure(),clip={name:'bgm',refs:0,addRef(){this.refs++;},decRef(){this.refs--;},getDuration(){return 1;}};
 const load=()=>loads[0].cb(null,clip);
 const ui=(name='UI',parent=scene,w=46,h=46)=>{const n=new Node(name);parent.addChild(n);n.addComponent(UITransform).setContentSize(w,h);return n;};
 const button=(action=()=>trace.push('action'),parent=scene)=>{const n=ui('Button',parent);const s=n.addComponent(ctx.WarmButton);s.bind(action);return{n,s};};
 const send=(type,id=1,x=0,y=0)=>{const e=new EventTouch([touch(id,x,y)],false,type);ctx.input._dispatchEventTouch(e);return e;};
 const mouse=(type,x=0,y=0)=>{const e={type,windowId:0,getLocation:out=>out?Object.assign(out,{x,y}):{x,y},getLocationX:()=>x,getLocationY:()=>y};ctx.input._emitEvent(e);return e;};
 const tap=()=>{send(types.TOUCH_START);send(types.TOUCH_END);};
 const board=()=>{const b={dragStart:null,selected:-1,cell:50,snapshot:{state:'run.ready',readOnly:false},modalOpen:()=>false,taps:0,swaps:0,paint(){},cancelToolInput(){},paintToolTray(){},tap(){this.taps++;trace.push('board-action');},swap(){this.swaps++;}},n=ui('Tile-0');ctx.bindCell.call(b,n,0);return{n,b};};
 return{ctx,types,a,scene,ui,button,send,mouse,tap,load,board,trace,game,wxEvents,storage,writes,loads,clip,Node,UITransform,EventTouch,touch,changeScene(){scene=new Node('Scene-next');return scene;}};
}
const cases=[];function test(name,fn){fn();cases.push(name);console.log('PASS',name);}
test('unmodified baseline reproduces UI activation with swallowed global and no music',()=>{const h=harness({baseline:true});h.load();let global=0;h.ctx.input.on(h.types.TOUCH_END,()=>global++);h.button();h.tap();assert.equal(global,0);assert.deepEqual(h.trace,['action']);assert.equal(h.a.gestureSeen,false);assert.equal(h.a.loopSource.starts,0);h.send(h.types.TOUCH_START,2,200,200);h.send(h.types.TOUCH_END,2,200,200);assert.equal(h.a.loopSource.starts,1);});
test('bare Scene capture actually throws in official pointer sort (rejected design)',()=>{const h=harness();h.scene.on(h.types.TOUCH_END,()=>{},null,true);h.button();assert.throws(()=>h.tap(),/cameraPriority/);});
test('full-screen Canvas capture really swallows previously-global blank input (rejected design)',()=>{const h=harness();const root=h.ui('Canvas',h.scene,1000,1000);let global=0,captured=0;h.ctx.input.on(h.types.TOUCH_END,()=>global++);root.on(h.types.TOUCH_END,()=>captured++,null,true);h.send(h.types.TOUCH_START,1,200,200);h.send(h.types.TOUCH_END,1,200,200);assert.equal(captured,1);assert.equal(global,0);});
test('first valid WarmButton release unlocks synchronously before action, global remains swallowed',()=>{const h=harness();h.load();let global=0;h.ctx.input.on(h.types.TOUCH_END,()=>global++);h.button(()=>{assert.equal(h.a.loopSource.starts,1);h.trace.push('action');});h.tap();assert.deepEqual(h.trace,['play','action']);assert.equal(global,0);assert.equal(h.writes.length,0);});
test('audio getter/gesture failures cannot block valid button action, ACTIVATED or board tap',()=>{for(const target of ['button','board']){const h=harness();h.load();h.a.onGesture=()=>{throw Error('injected stale native getter');};if(target==='button'){let acts=0;const{n}=h.button();n.on(h.ctx.WarmButton.ACTIVATED,()=>acts++);h.tap();assert.equal(acts,1);assert.deepEqual(h.trace,['action']);}else{const{b}=h.board();h.tap();assert.equal(b.taps,1);assert.deepEqual(h.trace,['board-action']);}assert.equal(h.a.loopSource.starts,0);}});
test('UI button created and clicked before any scan tick works',()=>{const h=harness();h.load();h.button();h.tap();assert.equal(h.a.loopSource.starts,1);assert.equal(h.a.gestureSeen,true);});
test('action may destroy target and rebuild scene after synchronous unlock',()=>{const h=harness();h.load();let btn;btn=h.button(()=>{assert.equal(h.a.loopSource.starts,1);btn.n.destroy();h.changeScene();h.button();});h.tap();h.tap();assert.equal(h.a.loopSource.starts,1);});
test('callback false still has real gesture, but does not emit ACTIVATED',()=>{const h=harness();h.load();const {n}=h.button(()=>false);let activated=0;n.on(h.ctx.WarmButton.ACTIVATED,()=>activated++);h.tap();assert.equal(h.a.loopSource.starts,1);assert.equal(activated,0);});
test('cancel, foreign pointer, disabled and drag-return never activate or unlock through WarmButton',()=>{for(const mode of ['cancel','foreign','disabled','drag-return']){const h=harness();h.load();const{n,s}=h.button();h.send(h.types.TOUCH_START);if(mode==='cancel')h.send(h.types.TOUCH_CANCEL);if(mode==='foreign'){h.send(h.types.TOUCH_START,2);h.send(h.types.TOUCH_END,2);}if(mode==='disabled')s.enabledInHierarchy=false;if(mode==='drag-return'){h.send(h.types.TOUCH_MOVE,1,200);h.send(h.types.TOUCH_MOVE);}if(mode!=='foreign'&&mode!=='cancel')h.send(h.types.TOUCH_END);assert.equal(h.a.gestureSeen,false,mode);assert.equal(h.trace.length,0,mode);}});
test('programmatic click, ACTIVATED, raw Node.emit end, render/snapshot paths do not unlock',()=>{const h=harness();h.load();const {n}=h.button();n.emit('click');n.emit(h.ctx.WarmButton.ACTIVATED);n.emit(h.types.TOUCH_END,{getID:()=>1});h.a.onButton();h.a.onToolTap();h.a.onRender('run.ready',false);h.a.onRender('result.saved',true);h.a.musicDiagnostics();assert.equal(h.a.gestureSeen,false);assert.equal(h.a.loopSource.starts,0);});
test('board tap and consumed swap-end unlock before gameplay action despite swallowed global',()=>{for(const moved of [false,true]){const h=harness();h.load();const {b}=h.board();h.send(h.types.TOUCH_START);if(moved)h.send(h.types.TOUCH_MOVE,1,19);h.send(h.types.TOUCH_END);assert.equal(h.a.gestureSeen,true);assert.equal(h.a.loopSource.starts,1);assert.equal(b.taps,moved?0:1);assert.equal(b.swaps,moved?1:0);if(!moved)assert.deepEqual(h.trace,['play','board-action']);}});
test('board cancel and late programmatic end with no event or no owner do not unlock',()=>{for(const mode of ['cancel','late','programmatic']){const h=harness();h.load();const {n}=h.board();if(mode!=='late')h.send(h.types.TOUCH_START);if(mode==='cancel')h.send(h.types.TOUCH_CANCEL);n.emit(h.types.TOUCH_END);assert.equal(h.a.gestureSeen,false);}});
test('tool actual outside release(original END), cancel and guarded release use unchanged node routing',()=>{for(const mode of ['tap','drag','cancel','modal','readonly','paused']){const h=harness();h.load();const t=new h.ctx.ToolHandler();Object.assign(t,{toolDrag:null,selected:0,snapshot:{state:'run.ready'},modalOpen:()=>mode==='modal',cellAt:()=>1,moveGhost(){},paint(){},useToolAt(){h.trace.push('tool-action');}});if(mode==='readonly')t.snapshot.readOnly=true;if(mode==='paused')t.snapshot.state='run.paused';const n=h.ui('slot');Object.assign(t,{tools:[n],toolVersion:()=>1,toolCatalog:()=>[{available:true,kind:'bomb'}],canUseTools:()=>!['modal','readonly','paused'].includes(mode),cancelToolInput(){this.toolDrag=null;},paintToolTray(){},tapTool(){h.trace.push('tool-action');return true;}});h.ctx.bindTool.call(t,n);h.send(h.types.TOUCH_START);if(mode==='drag')h.send(h.types.TOUCH_MOVE,1,100);h.send(mode==='cancel'?h.types.TOUCH_CANCEL:h.types.TOUCH_END,1,mode==='drag'?100:0);if(mode==='tap'||mode==='drag')assert.deepEqual(h.trace,['play','tool-action']);else assert.deepEqual(h.trace,[],mode);}});
test('mute, hidden, interruption, explicit zero remain authoritative and do not rewrite preferences',()=>{for(const mode of ['mute','hidden','interrupted','zero']){const saved=mode==='mute'?{'qfl.audio.muted':'1'}:mode==='zero'?{'qfl.audio.musicVolume':'0'}:{};const h=harness({saved});h.load();if(mode==='hidden')h.game.emit('hide');if(mode==='interrupted')h.wxEvents.emit('AudioInterruptionBegin');h.button();h.tap();assert.equal(h.a.gestureSeen,true);assert.equal(h.a.loopSource.starts,0,mode);assert.equal(h.writes.length,0);}});
test('default missing volume stays .4 without creating preference or save keys',()=>{const h=harness();h.load();h.button();h.tap();assert.equal(h.a.musicDiagnostics().volume,.4);assert.equal(h.storage.size,0);assert.equal(h.writes.length,0);});
test('gesture before resource load preserves normal asynchronous start without timers or retry changes',()=>{const h=harness();h.button();h.tap();assert.equal(h.a.loopSource.starts,0);h.load();assert.equal(h.a.loopSource.starts,1);});
test('multiple valid taps and simulated touch plus mouse release coalesce delayed engine requests',()=>{const h=harness({pendingAudio:true});h.load();h.button();for(let i=0;i<20;i++)h.tap();h.mouse(h.types.MOUSE_UP);assert.equal(h.a.loopSource.starts,1);});
test('blank/3D input remains globally delivered after narrow hook',()=>{const h=harness();h.load();h.button();let global=0;h.ctx.input.on(h.types.TOUCH_END,()=>global++);h.send(h.types.TOUCH_START,1,200,200);h.send(h.types.TOUCH_END,1,200,200);assert.equal(global,1);});
test('destroyed/replaced audio cannot accept stale instance callback; next button reaches replacement',()=>{const h=harness();h.load();h.button();h.a.destroy();h.tap();assert.equal(h.a.gestureSeen,false);const b=h.ctx.A.ensure();h.loads[1].cb(null,{...h.clip,refs:0});h.tap();assert.equal(b.gestureSeen,true);assert.equal(b.loopSource.starts,1);assert.equal(h.a.loopSource.starts,0);});
const result={status:'PASS_UPSTREAM_INPUT_METHODS',cases:cases.length,checks:cases,engineVersion:'v3.8.8',methodSources:['input.ts','node-event-processor.ts','pointer-event-dispatcher.ts'],hostDoubles:['Node shell/transform hitTest','event data','audio source/device','storage','component lifecycle'],creatorBuild:'NOT_RUN',trustedBrowserInput:'NOT_RUN',deviceRecording:'NOT_RUN',hearing:'NOT_RUN'};
fs.writeFileSync(path.join(ROOT,'evidence/audio-ui-capture/input-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
