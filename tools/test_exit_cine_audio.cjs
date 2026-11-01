'use strict';
// B5.5 出门音轨 wiring: GameAudio.onWorldState preloads region_island/audio_cine/sfx_exit_outbound on stand-up,
// plays it on 'crossing-out' (t=0 of the 20 s track), keeps it through 'island', stops it when the flow leaves the exit.
// Mock Cocos only: NOT a Creator build or a listening test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {stripTypeScriptTypes}=require('node:module');
const src=fs.readFileSync('creator-build-project/assets/scripts/audio/GameAudio.ts','utf8');
const plain=src.replace(/^import .* from 'cc';\n/m,'').replace(/^@ccclass\('GameAudio'\)\n/m,'').replace(/export /g,'');
const code=(stripTypeScriptTypes?stripTypeScriptTypes(plain,{mode:'transform'}):require('./qf-env.cjs').typescript().transpileModule(plain,{compilerOptions:{target:99}}).outputText)+'\nglobalThis.AudioClass=GameAudio;globalThis.EXIT=EXIT_CINE;';
let count=0;const test=(n,f)=>{f();count++;console.log('PASS',n);};
function harness(){
 class Events{constructor(){this.m=new Map();}on(n,f,t){(this.m.get(n)||this.m.set(n,[]).get(n)).push([f,t]);}off(n,f){this.m.set(n,(this.m.get(n)||[]).filter(x=>x[0]!==f));}emit(n){for(const [f,t] of [...(this.m.get(n)||[])])f.call(t);}}
 class Component{destroy(){return true;}}
 class AudioSource{constructor(){this.clip=null;this.playing=false;this.starts=0;this.stops=0;this.currentTime=0;this.state=0;}play(){this.starts++;this.playing=true;}pause(){this.playing=false;}stop(){this.stops++;this.playing=false;}destroy(){this.destroyed=true;}}
 AudioSource.EventType={STARTED:'s',ENDED:'e'};AudioSource.AudioState={INIT:0,PLAYING:1,PAUSED:2,STOPPED:3};AudioSource.maxAudioChannel=24;
 class Node extends Events{constructor(n){super();this.name=n;this.valid=true;this.components=[];}addComponent(C){const c=new C();c.node=this;this.components.push(c);c.onLoad?.();return c;}addChild(){}}
 const bundleLoads=[],bundleReqs=[];let bundle=null;
 const assetManager={getBundle:n=>bundle&&n==='region_island'?bundle:null,loadBundle:(n,cb)=>bundleReqs.push({n,cb})};
 const mkBundle=()=>({load:(p,t,cb)=>bundleLoads.push({p,cb})});
 const logs=[];
 const ctx={_decorator:{ccclass:()=>x=>x},Component,Node,AudioSource,AudioClip:class{},assetManager,resources:{load(){},loadDir(){}},director:{getScene:()=>new Node('scene'),addPersistRootNode(){}},game:new Events(),Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},input:new Events(),Input:{EventType:{TOUCH_END:'t',MOUSE_UP:'m',KEY_DOWN:'k'}},sys:{localStorage:{getItem:()=>null,setItem(){}}},isValid:n=>!!n?.valid,console:{warn(){},info:(...a)=>logs.push(a.join(' '))},globalThis:{}};
 ctx.globalThis=ctx;
 vm.runInNewContext(code,ctx);const A=ctx.AudioClass;let time=10000;A.now=()=>time;
 const a=A.ensure();
 const clip=()=>({name:'sfx_exit_outbound',refs:0,addRef(){this.refs++;},decRef(){this.refs--;}});
 return {A,a,ctx,clip,bundleLoads,bundleReqs,setBundle:()=>{bundle=mkBundle();return bundle;},advance:ms=>time+=ms,logs};
}
const src_=a=>a.exitCineSource;
test('stand-up preloads from region_island bundle; crossing-out plays from t=0; island keeps it',()=>{
 const h=harness(),a=h.a;a.onWorldState('home');assert.equal(h.bundleReqs.length,0);
 a.onWorldState('standing');assert.equal(h.bundleReqs.length,1);assert.equal(h.bundleReqs[0].n,'region_island');
 const b=h.setBundle();h.bundleReqs[0].cb(null,b);assert.equal(h.bundleLoads[0].p,'audio_cine/sfx_exit_outbound');
 const c=h.clip();h.bundleLoads[0].cb(null,c);assert.equal(c.refs,1);
 for(const s of ['turning-out','walking-out','opening-door'])a.onWorldState(s);
 assert.equal(h.bundleLoads.length,1,'loaded once');assert.equal(a.exitCineDiagnostics().active,false,'not before the doorway');
 a.onWorldState('crossing-out');const s=src_(a);assert(s);assert.equal(s.starts,1);assert.equal(s.clip,c);assert.equal(s.loop,false);assert.equal(s.currentTime,0);
 a.onWorldState('island');assert.equal(s.stops,0);assert.equal(a.exitCineDiagnostics().playing,true);
});
test('late clip joins the segment by seeking; > maxLateS is dropped (no desynced footsteps)',()=>{
 for(const [lateMs,expectPlay] of [[400,true],[2000,false]]){const h=harness(),a=h.a;const b=h.setBundle();
  a.onWorldState('opening-door');a.onWorldState('crossing-out');h.advance(lateMs);h.bundleLoads[0].cb(null,h.clip());
  assert.equal(!!src_(a),expectPlay);if(expectPlay)assert(Math.abs(src_(a).currentTime-lateMs/1000)<1e-9);}
});
test('leaving the exit (cancel / home / level) stops and releases the voice; restart plays again',()=>{
 const h=harness(),a=h.a;h.setBundle();a.onWorldState('standing');h.bundleLoads[0].cb(null,h.clip());
 a.onWorldState('opening-door');a.onWorldState('crossing-out');const s=src_(a);a.onWorldState('home');
 assert.equal(s.stops,1);assert.equal(s.destroyed,true);assert.equal(a.exitCineDiagnostics().active,false);
 a.onWorldState('standing');a.onWorldState('opening-door');a.onWorldState('crossing-out');assert(src_(a)&&src_(a)!==s);assert.equal(src_(a).starts,1);
});
test('muted / sfx-muted never start the track',()=>{for(const k of ['setMuted','setSfxMuted']){const h=harness(),a=h.a;h.setBundle();a[k](true);a.onWorldState('standing');h.bundleLoads[0].cb(null,h.clip());a.onWorldState('opening-door');a.onWorldState('crossing-out');assert.equal(src_(a),null);}});
test('load failure is silent; __worldFlowLog gets timestamped events',()=>{const h=harness(),a=h.a;h.ctx.__worldFlowLog=true;h.setBundle();a.onWorldState('standing');h.bundleLoads[0].cb(new Error('missing'),null);a.onWorldState('opening-door');a.onWorldState('crossing-out');assert.equal(src_(a),null);
 const ev=a.exitCineDiagnostics().log.map(e=>e.event);assert.equal(JSON.stringify(ev),JSON.stringify(['load-failed','segment-start']));assert(h.logs.some(l=>l.includes('exit-cine')&&l.includes('segment-start')));});
test('「主页」 transition fade applies to the exit track (it is an owned sfx voice)',()=>{const h=harness(),a=h.a;h.setBundle();a.onWorldState('standing');h.bundleLoads[0].cb(null,h.clip());a.onWorldState('opening-door');a.onWorldState('crossing-out');a.fadeTransition(0,0);assert.equal(src_(a).volume,0);});
test('Boot feeds world states to GameAudio.onWorldState',()=>{const b=fs.readFileSync('creator-build-project/assets/scripts/WorldIntegrationBoot.ts','utf8');assert(/trackTransitionHud\(state:string\)\{[^\n]*\n[^\n]*onWorldState\?\.\(state\)/.test(b));});
test('A1b: standing + crossing-out mount the wind/sea beds; the exit track starting opens the ambience gate; [QF_AUDIO] logs',()=>{
 const h=harness(),a=h.a,A=h.A;h.ctx.__worldFlowLog=true;const calls=[];A.ambienceMounters.length=0;A.ambienceMounters.push(()=>calls.push('wind'),()=>calls.push('waves'));
 h.setBundle();assert.equal(a.canPlayAmbience(),false,'no gesture yet');a.onWorldState('standing');assert.deepEqual(calls,['wind','waves']);
 h.bundleLoads[0].cb(null,h.clip());a.onWorldState('opening-door');a.onWorldState('crossing-out');
 assert(calls.length>=4,'mounted again at crossing-out');assert(src_(a),'exit track playing');
 assert.equal(a.canPlayAmbience(),true,'wind/sea may follow the exit track');assert.equal(a.ambienceGate(),'ok');
 assert(h.logs.some(l=>l.includes('[QF_AUDIO]')&&l.includes('ensure-ambience')),'ensure logged');assert(h.logs.some(l=>l.includes('gesture-proven-by-exit-track')));
 a.setMuted(true);assert.equal(a.canPlayAmbience(),false,'mute still wins');assert.equal(a.ambienceGate(),'muted');
 const w=fs.readFileSync('creator-build-project/assets/scripts/audio/WindAudio.ts','utf8'),m=fs.readFileSync('creator-build-project/assets/scripts/audio/AmbienceAudio.ts','utf8');
 assert(/ambienceMounters\?\.push\(\(\) => WindAudio\.ensure\(\)\)/.test(w)&&/ambienceMounters\?\.push\(\(\) => AmbienceAudio\.ensure\(\)\)/.test(m),'both beds register a mounter');
 for(const e of ['wind-gate','wind-play','wind-loaded'])assert(w.includes("qfAudioLog('"+e+"'"),e);for(const e of ['waves-gate','waves-play','waves-loaded'])assert(m.includes("qfAudioLog('"+e+"'"),e);
});
test('asset: re-encoded mono mp3 in region_island subpackage, fixed Cocos meta, budget size',()=>{
 const p='creator-build-project/assets/bundles/region_island/audio_cine/sfx_exit_outbound.mp3',bytes=fs.readFileSync(p);
 // A1 (Voice Bot f57b8d2): 32 kHz 56k CBR mono, 140,660 B; budget 150 KB. Header must be MPEG-1 Layer III 32 kHz (not 22.05k).
 assert(bytes.length<=150000,'size '+bytes.length);
 {let i=bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33?10+((bytes[6]&127)<<21|(bytes[7]&127)<<14|(bytes[8]&127)<<7|(bytes[9]&127)):0;while(i<bytes.length-1&&!(bytes[i]===0xff&&(bytes[i+1]&0xe0)===0xe0))i++;
  const ver=(bytes[i+1]>>3)&3,sr=(bytes[i+2]>>2)&3,ch=(bytes[i+3]>>6)&3;assert.equal(ver,3,'MPEG-1');assert.equal(sr,2,'32 kHz');assert.equal(ch,3,'mono');}
 const m=JSON.parse(fs.readFileSync(p+'.meta','utf8'));assert.equal(m.importer,'audio-clip');assert.equal(m.uuid,'f3058b2d-c395-491f-abb5-9bbf5ac15871');
 const d=JSON.parse(fs.readFileSync('creator-build-project/assets/bundles/region_island/audio_cine.meta','utf8'));assert.equal(d.importer,'directory');
 const isl=JSON.parse(fs.readFileSync('creator-build-project/assets/bundles/region_island.meta','utf8'));assert.equal(isl.userData.bundleName,'region_island');
 console.log('asset sha256',crypto.createHash('sha256').update(bytes).digest('hex'),bytes.length);
});
console.log(JSON.stringify({status:'PASS_MOCK',cases:count,creatorBuild:'NOT_RUN',deviceListening:'NOT_RUN'}));
