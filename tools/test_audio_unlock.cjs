'use strict';
// Global first-touch audio unlock contract (Voice bot). Executes the real GameAudio with a Cocos/WX fake;
// the gesture arrives via static GameAudio.notifyUserGesture() with NO args, as from a platform-level
// wx.onTouchStart / global first-touch hook that runs before any Cocos node can swallow the touch.
// Mock control test only: NOT a Creator build, device, or listening test.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const env=require('./audio-test-env.cjs'),ts=env.typescript();
const src=fs.readFileSync(path.join(env.ROOT,'creator-build-project/assets/scripts/audio/GameAudio.ts'),'utf8');
const plain=src.replace(/^import .* from 'cc';\n/m,'').replace(/^@ccclass\('GameAudio'\)\n/m,'').replace(/export /g,'');
const code=ts.transpileModule(plain,{compilerOptions:{target:99,experimentalDecorators:true}}).outputText+'\nglobalThis.AudioClass=GameAudio;';
function harness(){
  const loads=[];class Ev{constructor(){this.m=new Map();}on(n,f,t){(this.m.get(n)||this.m.set(n,[]).get(n)).push([f,t]);}off(n,f,t){this.m.set(n,(this.m.get(n)||[]).filter(x=>x[0]!==f||x[1]!==t));}emit(n,...a){for(const[f,t]of[...(this.m.get(n)||[])])f.call(t,...a);}}
  class Component{destroy(){return true;}}
  class AudioSource{constructor(){this.clip=null;this.playing=false;this.starts=0;this.loop=false;this.volume=1;}play(){this.starts++;this.playing=true;}pause(){this.playing=false;}stop(){this.playing=false;}destroy(){}}
  AudioSource.EventType={STARTED:'started',ENDED:'ended'};AudioSource.AudioState={INIT:0,PLAYING:1,PAUSED:2,STOPPED:3};AudioSource.maxAudioChannel=10;
  class Node{constructor(n){this.name=n;this.valid=true;this.components=[];this.ev=new Ev();}on(...a){this.ev.on(...a);}off(...a){this.ev.off(...a);}addComponent(C){const c=new C();c.node=this;this.components.push(c);c.onLoad?.();return c;}addChild(){}}
  const game=new Ev(),input=new Ev(),wxE=new Ev(),scene=new Node('scene');
  const wx={setInnerAudioOption(o){o.success();}};for(const e of['Hide','Show','AudioInterruptionBegin','AudioInterruptionEnd']){wx['on'+e]=f=>wxE.on(e,f);wx['off'+e]=f=>wxE.off(e,f);}
  const ctx={_decorator:{ccclass:()=>x=>x},Component,Node,AudioSource,AudioClip:class{},resources:{load:(p,t,cb)=>loads.push({p,cb}),loadDir:()=>{}},director:{getScene:()=>scene,addPersistRootNode(){}},game,Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},input,Input:{EventType:{TOUCH_END:'touch',MOUSE_UP:'mouse',KEY_DOWN:'key'}},sys:{localStorage:{getItem:()=>null,setItem(){}}},isValid:n=>!!n?.valid,wx,console:{warn(){}}};
  vm.runInNewContext(code,ctx);const A=ctx.AudioClass;let t=1e4;A.now=()=>t;
  const clip={name:'bgm_main',addRef(){},decRef(){}};
  return{A,a:A.ensure(),loads,clip,game,input,wxE,adv:n=>t+=n};
}
let n=0;const test=(s,f)=>{f();n++;console.log('PASS',s);};
test('BGM requested at GameAudio onLoad (boot, i.e. indoors) regardless of scene state',()=>{const h=harness();assert.equal(h.loads[0].p,'audio_bgm/bgm_main');assert.equal(h.a.musicDiagnostics().gestureSeen,false);});
test('without any gesture: clip loaded, never plays, update holds',()=>{const h=harness();h.loads[0].cb(null,h.clip);for(let i=0;i<5;i++)h.a.update();assert.equal(h.a.loopSource.starts,0);assert.equal(h.a.canPlayAmbience(),false);});
test('notifyUserGesture() with no args after load -> one synchronous play(), loop=true',()=>{const h=harness();h.loads[0].cb(null,h.clip);h.A.notifyUserGesture();assert.equal(h.a.loopSource.starts,1);assert.equal(h.a.loopSource.loop,true);assert.equal(h.a.canPlayAmbience(),true);});
test('gesture BEFORE clip load -> play() fires on load (outside gesture)',()=>{const h=harness();h.A.notifyUserGesture();assert.equal(h.a.loopSource.starts,0);h.loads[0].cb(null,h.clip);assert.equal(h.a.loopSource.starts,1);});
test('idempotent: 50 calls (touchstart + touchend + Cocos) -> still one play()',()=>{const h=harness();h.loads[0].cb(null,h.clip);for(let i=0;i<50;i++){h.A.notifyUserGesture();h.input.emit('touch',{});h.a.update();}assert.equal(h.a.loopSource.starts,1);});
test('idempotent while engine play is still pending (playing=false) -> no restart',()=>{const h=harness();h.loads[0].cb(null,h.clip);h.a.loopSource.play=function(){this.starts++;};h.A.notifyUserGesture();h.A.notifyUserGesture();h.a.update();h.A.notifyUserGesture();assert.equal(h.a.loopSource.starts,1);});
test('gesture while hidden/interrupted -> no play; resumes on show/end without another gesture',()=>{let h=harness();h.loads[0].cb(null,h.clip);h.game.emit('hide');h.A.notifyUserGesture();assert.equal(h.a.loopSource.starts,0);h.game.emit('show');assert.equal(h.a.loopSource.starts,1);
  h=harness();h.loads[0].cb(null,h.clip);h.wxE.emit('AudioInterruptionBegin');h.A.notifyUserGesture();assert.equal(h.a.loopSource.starts,0);h.wxE.emit('AudioInterruptionEnd');assert.equal(h.a.loopSource.starts,1);});
test('notifyUserGesture before GameAudio exists is a safe no-op',()=>{const h=harness();h.a.destroy();h.a.onDestroy();assert.doesNotThrow(()=>h.A.notifyUserGesture());});
test('unconfirmed start (10 s) -> one rebuild on later gesture, then blocked; frequent global touches cannot loop it',()=>{const h=harness();h.loads[0].cb(null,h.clip);const P=Object.getPrototypeOf(h.a.loopSource);P.play=function(){this.starts++;};h.A.notifyUserGesture();h.adv(10001);h.a.update();assert.equal(h.a.musicDiagnostics().playbackState,'retryable');let rebuilds=0,last=h.a.loopSource;for(let i=0;i<30;i++){h.adv(2000);h.A.notifyUserGesture();h.a.update();if(h.a.loopSource!==last){rebuilds++;last=h.a.loopSource;}}assert.equal(rebuilds,1);assert.equal(h.a.musicDiagnostics().playbackState,'blocked');});
console.log(JSON.stringify({status:'PASS_MOCK_UNLOCK',cases:n,creatorBuild:'NOT_RUN',deviceListening:'NOT_RUN'}));
