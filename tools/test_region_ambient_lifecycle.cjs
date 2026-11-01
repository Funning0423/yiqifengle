'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ts=require('./qf-env.cjs').typescript();
const source=process.env.QF_AMBIENT_SOURCE||'creator-build-project/assets/scripts/region/RegionAmbientAnimation.ts';
const rows=[],errors=[],callbacks=[];
const events=new Map();
const game={on(event,fn,owner){if(!events.has(event))events.set(event,[]);events.get(event).push({fn,owner});},off(event,fn,owner){events.set(event,(events.get(event)||[]).filter(x=>x.fn!==fn||x.owner!==owner));},emit(event){for(const x of events.get(event)||[])x.fn.call(x.owner);}};
class Component{
 constructor(){this.enabled=true;}
 get enabledInHierarchy(){return this.enabled&&!!this.node?.activeInHierarchy;}
 getComponent(type){return this.node.getComponent(type);}
 addComponent(type){return this.node.addComponent(type);}
}
class Node{
 constructor(){this.active=false;this.isValid=true;this.components=[];}
 get activeInHierarchy(){return this.active&&this.isValid;}
 addComponent(Type){const c=new Type();c.node=this;this.components.push(c);return c;}
 getComponent(Type){return this.components.find(c=>c instanceof Type)||null;}
}
// Model the shipped 3.8.8 Animation lifecycle: serialized _clips is not its public
// setter; getState never creates, onLoad reassigns clips and replaces automatic states.
class SkeletalAnimation{
 constructor(){this._clips=[];this.states=new Map();this.created=[];this.playOnLoad=true;this.useBakedAnimation=true;}
 get clips(){return this._clips;}
 set clips(value){for(const c of this._clips){if(c){this.states.get(c.name)?.stop();this.states.delete(c.name);}}for(const c of value)if(c)this.createState(c,c.name);this._clips=value;}
 onLoad(){this.clips=this._clips;}
 onEnable(){}
 onDisable(){}
 start(){if(this.playOnLoad&&this.defaultClip)this.getState(this.defaultClip.name)?.play();}
 getState(name){return this.states.get(name)||null;}
 createState(clip,name=clip.name){
  this.states.get(name)?.stop();
  const state={name,clip,duration:clip.duration,time:0,isPlaying:false,isPaused:false,plays:0,
   play(){this.plays++;this.time=0;this.isPlaying=true;this.isPaused=false;},
   pause(){this.isPaused=true;},resume(){this.isPaused=false;},stop(){this.isPlaying=false;this.isPaused=false;}};
  this.states.set(name,state);this.created.push(state);return state;
 }
 tick(dt){for(const s of this.states.values())if(s.isPlaying&&!s.isPaused)s.time+=dt;}
 onDestroy(){for(const s of this.states.values())s.stop();this.states.clear();}
}
const decorator=(target,key)=>key===undefined?target:undefined;
const cc={_decorator:{ccclass:()=>decorator,property:(target,key)=>typeof key==='string'?undefined:decorator},Component,SkeletalAnimation,
 AnimationClip:{WrapMode:{Loop:'loop',Normal:'normal'}},isValid:value=>!!value&&value.isValid!==false,game,Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},
 assetManager:{loadAny(request,callback){callbacks.push({request,callback});}}};
function load(file,resolve){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}});assert.equal((code.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);const m={exports:{}};vm.runInNewContext(code.outputText,{module:m,exports:m.exports,require:resolve,Promise,Math,Date,console:{warn(){},error(...values){errors.push(values.map(String).join(' '));}}});return m.exports;}
const robot=load('creator-build-project/assets/scripts/region/RobotClips.ts',()=>{throw Error('Unexpected robot dependency');});
const {RegionAmbientAnimation:Ambient}=load(source,name=>{if(name==='cc')return cc;if(name==='./RobotClips')return robot;throw Error(name);});
const names=['sky_ambient_loop','robot_idle','robot_watering','robot_give_flower'];
const clip=name=>({name,duration:4});
function fixture(serialized=names){
 const node=new Node(),anim=node.addComponent(SkeletalAnimation),ambient=node.addComponent(Ambient);
 anim._clips=serialized.map(clip);ambient.clipNames=['sky_ambient_loop','robot_idle'];
 let loaded=false,started=false;
 return {node,anim,ambient,
  activate(){node.active=true;if(!loaded){ambient.onLoad();anim.onLoad();loaded=true;}assert.equal(ambient.enabledInHierarchy,true,'Creator public getter reflects enabled and active hierarchy');ambient.onEnable();anim.onEnable();if(!started){ambient.start();anim.start();started=true;}},
  deactivate(){node.active=false;ambient.onDisable();anim.onDisable();},
  destroy(){if(loaded){node.active=false;ambient.onDisable();ambient.onDestroy();anim.onDestroy();}node.isValid=false;node.active=false;},
 };
}
const sample=f=>f.ambient.diagnostics().map(x=>({name:x.name,time:x.time,playing:x.playing,baked:x.baked}));
const snapshot=f=>JSON.stringify(sample(f));
async function test(name,run){await run();rows.push(name);}
(async()=>{
 await test('serialized inactive clips have no states; first activation starts both current states exactly once',async()=>{
  const f=fixture();assert.equal(f.anim.getState('sky_ambient_loop'),null);assert.equal(f.anim.created.length,0);
  const preparation=f.ambient.prepare();assert.equal(f.ambient.prepare(),preparation);await preparation;
  assert.equal(f.node.active,false);assert.equal(f.anim.created.length,0);assert.equal(f.ambient.diagnostics().length,0);assert.equal(f.anim.playOnLoad,false);
  f.activate();await f.ambient.prepare();assert.equal(f.anim.created.length,4);
  const loops=f.ambient.diagnostics();assert.equal(JSON.stringify(loops.map(s=>s.name)),JSON.stringify(names.slice(0,2)));
  assert.equal(f.anim.useBakedAnimation,false);assert.equal(f.anim.playOnLoad,false);
  for(const name of names.slice(0,2)){const s=f.anim.getState(name);assert(s.isPlaying);assert.equal(s.wrapMode,'loop');assert.equal(s.repeatCount,Infinity);assert.equal(s.plays,1);}
  for(const name of names.slice(2))assert.equal(f.anim.getState(name).isPlaying,false);
  f.anim.tick(.25);for(const d of f.ambient.diagnostics()){assert.equal(d.time,.25);assert.equal(d.time,f.anim.getState(d.name).time);}
  f.destroy();
 });
 await test('hide, host pause, and deactivate/resume retain both state identities and times without replay',async()=>{
  const f=fixture();await f.ambient.prepare();f.activate();f.anim.tick(.4);
  const states=names.slice(0,2).map(n=>f.anim.getState(n));const before=snapshot(f);
  game.emit('hide');f.anim.tick(1);assert.equal(snapshot(f),before);f.ambient.setHostPaused(true);game.emit('show');f.anim.tick(1);assert.equal(snapshot(f),before);
  f.ambient.setHostPaused(false);f.anim.tick(.1);assert(f.ambient.diagnostics().every(x=>x.time===.5));
  f.deactivate();const hidden=snapshot(f);f.anim.tick(1);assert.equal(snapshot(f),hidden);f.activate();f.anim.tick(.2);
  states.forEach((s,i)=>{assert.equal(f.anim.getState(names[i]),s);assert.equal(s.plays,1);assert.equal(s.time,.7);});f.destroy();
 });
 await test('UUID clips prepared inactive remain stopped and bind replacement onLoad states on reveal',async()=>{
  const f=fixture([]);f.ambient.clipUuids=['sky','robot'];const first=callbacks.length,p=f.ambient.prepare();
  callbacks[first].callback(null,clip(names[0]));callbacks[first+1].callback(null,clip(names[1]));await p;
  const old=names.slice(0,2).map(n=>f.anim.getState(n));assert(old.every(s=>s&&!s.isPlaying));assert.equal(f.ambient.diagnostics().length,0);
  f.activate();f.anim.tick(.3);old.forEach((s,i)=>{assert.notEqual(f.anim.getState(names[i]),s);assert.equal(s.plays,0);});
  assert(f.ambient.diagnostics().every(s=>s.time===.3&&s.playing));f.destroy();
 });
 await test('activation during pending UUID load neither auto-plays nor loses the completion playback',async()=>{
  const f=fixture([]);f.ambient.clipUuids=['sky','robot'];const first=callbacks.length,p=f.ambient.prepare();
  assert.equal(f.anim.playOnLoad,false);f.activate();assert.equal(f.anim.created.length,0);
  callbacks[first].callback(null,clip(names[0]));callbacks[first+1].callback(null,clip(names[1]));await p;f.anim.tick(.2);
  assert.equal(f.ambient.diagnostics().length,2);assert(f.ambient.diagnostics().every(s=>s.time===.2&&s.playing));
  assert(names.slice(0,2).every(n=>f.anim.getState(n).plays===1));f.destroy();
 });
 await test('active preparation suppresses playOnLoad before awaiting assets and honors a retained host pause',async()=>{
  const f=fixture([]);f.node.active=true;f.anim.onLoad();f.ambient.clipUuids=['sky','robot'];f.ambient.setHostPaused(true);
  const first=callbacks.length,p=f.ambient.prepare();assert.equal(f.anim.playOnLoad,false);f.anim.start();assert.equal(f.anim.created.length,0);
  callbacks[first].callback(null,clip(names[0]));callbacks[first+1].callback(null,clip(names[1]));await p;f.anim.tick(.2);
  assert(f.ambient.diagnostics().every(s=>s.time===0));f.ambient.setHostPaused(false);f.anim.tick(.2);assert(f.ambient.diagnostics().every(s=>s.time===.2));
  f.ambient.onDestroy();f.anim.onDestroy();
 });
 await test('destroyed inactive pending owner rejects late assets even when Creator never calls onDestroy',async()=>{
  const f=fixture([]);f.ambient.clipUuids=['sky','robot'];const first=callbacks.length,p=f.ambient.prepare(),rejected=assert.rejects(p,/destroyed during preparation/);
  f.destroy();callbacks[first].callback(null,clip(names[0]));callbacks[first+1].callback(null,clip(names[1]));await rejected;
  assert.equal(f.anim.created.length,0);assert.equal(f.ambient.diagnostics().length,0);
 });
 await test('missing required clip rejects the resource gate without creating or playing states',async()=>{
  const f=fixture(['sky_ambient_loop']);await assert.rejects(f.ambient.prepare(),/Required ambient animation unavailable/);assert.equal(f.anim.created.length,0);assert.equal(f.ambient.diagnostics().length,0);f.destroy();
 });
 await test('active missing state uses public createState for an existing clip; missing clip still fails',async()=>{
  const f=fixture();f.node.active=true;f.anim.onLoad();f.anim.states.delete('robot_idle');
  assert.equal(f.anim.getState('robot_idle'),null);const count=f.anim.created.length;await f.ambient.prepare();
  assert.equal(f.anim.created.length,count+1);assert.equal(f.anim.getState('robot_idle').plays,1);assert.equal(f.ambient.diagnostics().length,2);
  f.ambient.onDestroy();f.anim.onDestroy();
 });
 assert.equal(errors.length,0,errors.join('\n'));
 assert.equal([...events.values()].flat().length,0,'Loaded owners unregister hide/show listeners');
 console.log(JSON.stringify({status:'PASS',cases:rows.length,checks:rows,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),scope:'Actual ambient TypeScript; lifecycle/state boundary modeled from shipped Creator 3.8.8. No browser, render, storage, or game-route acceptance.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
