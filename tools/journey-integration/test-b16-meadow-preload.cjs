'use strict';
// GGbot b16 meadow long frames: (1) with the board-phase preload done, a sail ride makes NO loadBundle / bundle.load call;
// without it SailAudio falls back to lazy and logs it; (2) BedLayerAudio.update() never loads; it adopts preloaded clips only;
// (3) the OI_WORLD_FLOW console log is off by default in release, ?qfLog / ?qfPreload switches parse, and the 5 s tick does
// not even build the snapshot when the gate is off. Mock Cocos only (logic), not a Creator build.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const env=require('../qf-env.cjs'),ts=env.typescript();
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
let n=0;const T=async(name,f)=>{await f();n++;console.log('PASS',name);};
function world(){
 const calls={loadBundle:[],load:[]},bundles={},warns=[],infos=[];
 class AudioClip{constructor(p){this.p=p;this.refs=0;}addRef(){this.refs++;}decRef(){this.refs--;}}
 class AudioSource{constructor(){this.clip=null;this.volume=0;this.playing=false;this.loop=false;}play(){this.playing=true;}stop(){this.playing=false;}}
 class Component{scheduleOnce(f){this._sched=f;}}
 class Node{constructor(){this.c=[];}addComponent(C){const c=new C();c.node=this;this.c.push(c);c.onLoad&&c.onLoad();return c;}getComponent(C){return this.c.find(x=>x instanceof C)||null;}}
 const mkB=name=>({name,load:(p,t,cb)=>{calls.load.push(name+'|'+p);cb(null,new AudioClip(p));}});
 const assetManager={getBundle:nm=>bundles[nm]||null,loadBundle:(nm,cb)=>{calls.loadBundle.push(nm);bundles[nm]=mkB(nm);cb(null,bundles[nm]);}};
 const cc={_decorator:{ccclass:()=>x=>x},Component,AudioSource,AudioClip,assetManager,director:{once(){},getScene:()=>null},Director:{EVENT_AFTER_SCENE_LAUNCH:'l'},isValid:()=>true,Node};
 let cueFn=null;const audioNode=new Node();
 const GameAudio={instance:{canPlayAmbience:()=>true,isSfxMuted:()=>false,getMusicVolume:()=>1,transitionGain:()=>1},ensure:()=>({node:audioNode}),ambienceMounters:[],ambienceQuieters:[]};
 const stubs={'cc':cc,'cc/env':{DEBUG:false},[path.join(S,'audio/GameAudio')]:{GameAudio},[path.join(S,'region/TransitAudioHooks')]:{onTransitCue:f=>{cueFn=f;return()=>{};},transitHidden:()=>false},[path.join(S,'audio/AmbienceAudio')]:{ambienceBedGain:()=>1}};
 const g={console:{info:(...a)=>infos.push(a.join(' ')),warn:(...a)=>warns.push(a.join(' ')),error:(...a)=>warns.push(a.join(' ')),log(){}}};
 const cache={};
 function load(file){
  const f=file.endsWith('.ts')?file:file+'.ts';if(cache[f])return cache[f].exports;
  const out=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:99,experimentalDecorators:true}}).outputText;
  const m={exports:{}};cache[f]=m;
  const req=s=>{if(stubs[s])return stubs[s];if(s.startsWith('.')){const r=path.resolve(path.dirname(f),s);if(stubs[r])return stubs[r];return load(r);}throw Error('unexpected import '+s);};
  new Function('require','module','exports','globalThis','console',out)(req,m,m.exports,g,g.console);return m.exports;
 }
 return {load,calls,warns,infos,g,cue:(c,i)=>cueFn&&cueFn(c,i),audioNode,AudioClip};
}
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
await T('sail ride after the board preload: zero loadBundle / load on the cues; all 4 clips assigned',async()=>{
 const w=world(),P=w.load(path.join(S,'audio/AudioPreload')),{SailAudio}=w.load(path.join(S,'audio/SailAudio'));
 const sa=w.audioNode.addComponent(SailAudio);
 await P.preloadRideAudio();await flush();
 assert(w.calls.loadBundle.includes('transport_sail'),'preload pulled transport_sail on the board');
 const before={b:w.calls.loadBundle.length,l:w.calls.load.length};
 for(const c of ['sail-board','sail-unfurl','sail-cruise-loop-start','sail-cruise-loop-stop','sail-dock']){w.cue(c,{region:'island'});sa.update(1/60);}
 assert.equal(w.calls.loadBundle.length,before.b,'no loadBundle during the ride');assert.equal(w.calls.load.length,before.l,'no bundle.load during the ride');
 assert.equal(sa.diagnostics().ready,true);assert(!w.warns.some(x=>/lazy load/.test(x)));
});
await T('no preload (or ?qfPreload=0): lazy fallback still plays and is logged',async()=>{
 const w=world();w.g.__qfAudioPreloadOff=true;w.g.__worldFlowLog=true;const P=w.load(path.join(S,'audio/AudioPreload')),{SailAudio}=w.load(path.join(S,'audio/SailAudio'));
 const sa=w.audioNode.addComponent(SailAudio);await P.preloadRideAudio();assert.equal(w.calls.loadBundle.length,0,'preload disabled');
 w.cue('sail-board',{region:'island'});assert.deepEqual(w.calls.loadBundle,['transport_sail']);assert.equal(sa.diagnostics().ready,true);
 assert(w.warns.some(x=>/not preloaded; lazy load/.test(x)));assert(w.infos.some(x=>/sail-audio-lazy-fallback/.test(x)));
});
await T('BedLayerAudio.update(): never calls loadBundle / load; adopts preloaded beds + scatter',async()=>{
 const w=world(),P=w.load(path.join(S,'audio/AudioPreload')),B=w.load(path.join(S,'audio/BedLayerAudio'));
 const bl=w.audioNode.addComponent(B.BedLayerAudio);
 w.g.__sceneAudioBed={place:'meadow',birds:true,insects:true,highWind:true};
 for(let i=0;i<120;i++)bl.update(1/60);
 assert.equal(w.calls.loadBundle.length+w.calls.load.length,0,'update without a preload: no loads (silent, logged)');
 await P.preloadRideAudio();await flush();const before=w.calls.loadBundle.length+w.calls.load.length;assert(before>0,'preload loaded');
 for(let i=0;i<600;i++)bl.update(1/60);
 assert.equal(w.calls.loadBundle.length+w.calls.load.length,before,'update after the preload: still no loads');
 const plan=B.bedPreloadPlan(),bundles=Object.keys(plan);assert(bundles.length>=1);
 for(const id of ['birds','insects'])assert(bl.clips[id],'adopted '+id);assert(Object.values(plan).flat().length>=3,'highWind in the plan too');assert(bl.scatterClips.length>0,'bird scatter adopted');
});
await T('log gate: release default OFF; opt-in true ON; qfLog=0 forces OFF even in DEBUG; switches parse',async()=>{
 const src=fs.readFileSync(path.join(S,'world-r1/WorldFlowComponent.ts'),'utf8');
 const m=src.match(/export function worldFlowConsoleEnabled\(debug:boolean,optIn:unknown\):boolean\{([^}]*)\}/);const gate=new Function('debug','optIn',m[1]);
 assert.equal(gate(false,undefined),false);assert.equal(gate(false,true),true);assert.equal(gate(true,undefined),true);assert.equal(gate(true,false),false);
 assert(/if\(event==='tick'&&!worldFlowConsoleEnabled\(DEBUG,/.test(src),'tick skips the snapshot when the gate is off');
 const w=world(),D=w.load(path.join(S,'world-r1/QfDebugSwitches'));
 assert.deepEqual(D.parseQfDebugSwitches('?qfLog=1&qfPreload=0'),{worldFlowLog:true,audioPreloadOff:true});assert.deepEqual(D.parseQfDebugSwitches(''),{});
 const g={location:{search:'?qfLog=0'}};D.applyQfDebugSwitches(g);assert.equal(g.__worldFlowLog,false);
 const g2={};D.applyQfDebugSwitches(g2);assert.equal(g2.__worldFlowLog,undefined,'no URL: default (off in release)');
 const g3={location:{search:'?qfLog=1'}},__=D.applyQfDebugSwitches(g3);assert.equal(g3.__worldFlowLog,true);
});
console.log(JSON.stringify({status:'PASS',tests:n}));
})().catch(e=>{console.error(e);process.exit(1);});
