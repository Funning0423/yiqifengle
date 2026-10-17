'use strict';
// r4 exit footsteps (Voice Bot). Funning 2026-10-17 on 09a1b8e: "no steps in the room; after the door sudden sharp loud steps".
// 1) data: FootstepData.ts is what derive_footsteps.cjs derives from the SHIPPED character GLB + ground map (world GLB sha).
// 2) alignment on the real exit (+ return) flow: real WorldFlow + frozen FlowReferenceStandin + CharacterMotion + GLB FK;
//    every foot plant measured on the posed soles gets exactly one step within 40 ms (GameAudio play frame), no step
//    without a plant, the right surface per zone; at 30 / 45 / 60 (+-30% frame jitter) / 120 fps.
// 3) FootstepAudio + GameAudio (mock Cocos): loads region_island/audio_steps, plays through play() so mute / sfx mute /
//    background drop steps (none queued, no burst on return), silent outside the exit/return states.
// 4) assets: 20 tiny mono mp3s + metas; exit track without baked steps (pinned). Mock Cocos + offline sim: NOT a device test.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const EXIT_SHA='ca6c9fa509a0a5b019838fdaca2a2049d11310b7c9d506ef1b4f05deccea4269';
const ROOT=path.resolve(__dirname,'..','..');process.chdir(ROOT);
const {stripTypeScriptTypes}=require('node:module');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const D=require('./derive_footsteps.cjs'),AL=require('./footstep_align.cjs');
const AUD='creator-build-project/assets/scripts/audio';
let count=0;const results=[];const test=async(n,f)=>{await f();count++;console.log('PASS',n);};
const C=AL.loadCore();
(async()=>{
await test('FootstepData.ts is up to date with the shipped character GLB and world ground map',()=>{
  const {src}=D.build();assert.equal(fs.readFileSync(D.OUT,'utf8'),src,'run node tools/exit-footsteps/derive_footsteps.cjs');
  const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const data=fs.readFileSync(D.OUT,'utf8');assert(data.includes(sha(D.GLB)),'plants carry the character GLB sha');
  assert(data.includes(sha('creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb')),'ground carries the world GLB sha');
});
let exitRes;
await test('exit 60 fps: every plant one step <= 40 ms (also with 25 ms untrimmed mp3 priming), no extra, right surface',async()=>{
  const r=exitRes=await AL.align({fps:60});const s=r.stats;console.log(JSON.stringify(s));
  assert.equal(s.plants,25);assert.equal(s.steps,25);assert.equal(s.matched,25);assert.equal(s.extra,0);assert.equal(s.surfaceMismatch,0);
  assert(s.errMaxMs<=40&&s.errMinMs>=-40);assert.equal(s.untrimmedWithin40,25);
});
await test('the room walk has steps from her first plant (the reported bug): turn + walk + stop, before the door opens',()=>{
  const room=exitRes.rows.filter(x=>['standing','turning-out','walking-out'].includes(x.state));
  assert(room.length>=10,'room steps '+room.length);assert(room[0].stepT<2.7,'first step at '+room[0].stepT);assert.equal(room[0].state,'turning-out');
  const zones=st=>exitRes.rows.filter(x=>st(x.state)).map(x=>x.surface).filter((v,i,a)=>i===0||a[i-1]!==v);
  assert.deepEqual(zones(s=>s!=='crossing-out'),['wood','rug','wood'],'room: plank floor, the rug, plank floor');
  assert.deepEqual(zones(s=>s==='crossing-out'),['stone','path','grass','path'],'outside: door slab, sand path, grass where the route cuts the bend, path');
});
for(const [fps,jitter] of [[30,0],[45,0],[60,0.3],[120,0]])await test(`exit + return ${fps} fps${jitter?' (+-30% frame jitter)':''}: one step per plant within 40 ms, none extra, surfaces right`,async()=>{
  const r=await AL.align({fps,jitter,returnHome:true});const s=r.stats;console.log(JSON.stringify(s));
  assert.equal(s.plants,52);assert.equal(s.steps,52);assert.equal(s.matched,52,JSON.stringify(r.rows.filter(x=>!x.ok)));assert.equal(s.extra,0);assert.equal(s.surfaceMismatch,0);
  assert(s.errMaxMs<=40&&s.errMinMs>=-40);
});
await test('tracker: loop wrap, no burst after reset / clip jump, same-foot dedupe',()=>{
  const plants={walk_loop:[{t:0.5,bone:'foot.L',x:0,z:0},{t:1.2,bone:'foot.R',x:0,z:0}]};const T=new C.FootstepTracker(plants,0,0.25);
  const tr={clip:'walk_loop',abs:0,loop:true,duration:1.4};const clock={base:tr};let n=[];
  for(let i=0;i<=420;i++){tr.abs=i/60*1.0;n=n.concat(T.observe(clock,1/60));}
  assert.equal(n.length,10,'7 s of a 1.4 s loop with 2 plants = 5 cycles x 2: '+n.length);
  assert.deepEqual(n.slice(0,3).map(h=>h.bone),['foot.L','foot.R','foot.L']);
  T.reset();tr.abs=100;assert.equal(T.observe(clock,1/60).length,0,'first observation after reset never fires a backlog');
  tr.abs=200;assert(T.observe(clock,1/60).length<=2,'a 100 s jump is deduped per foot');
});
await test('variant picker: never the same file twice in a row, volume = STEP_GAIN +-1.5 dB',()=>{
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;const P=new C.StepVariantPicker(rnd);
  for(const su of ['wood','rug','stone','path','grass']){let prev='';const seen=new Set();for(let i=0;i<500;i++){const v=P.pick(su);assert.notEqual(v.name,prev);prev=v.name;seen.add(v.name);
    const db=20*Math.log10(v.volume/C.STEP_GAIN[su]);assert(Math.abs(db)<=C.STEP_JITTER_DB+1e-9);}assert.equal(seen.size,4);}
  for(const su in C.STEP_GAIN)assert(C.STEP_GAIN[su]<=0.4,'steps stay soft: gain '+su+' '+C.STEP_GAIN[su]);
});
await test('ground: rug / wood / slab / path / grass cells; off-map falls back by side of the door',()=>{
  const g=new C.StepGround();assert.equal(g.surfaceAt(0,-3),'rug');assert.equal(g.surfaceAt(1.6,-1),'wood');assert.equal(g.surfaceAt(0.2,0.4),'stone');
  assert.equal(g.surfaceAt(-50,-50),'wood');assert.equal(g.surfaceAt(50,50),'path');
});
// ---- FootstepAudio + GameAudio, mock Cocos ----
function harness(){
  const plain=fs.readFileSync(AUD+'/GameAudio.ts','utf8').replace(/^import .* from 'cc';\n/m,'').replace(/^@ccclass\('GameAudio'\)\n/m,'').replace(/export /g,'');
  const code=(stripTypeScriptTypes?stripTypeScriptTypes(plain,{mode:'transform'}):ts.transpileModule(plain,{compilerOptions:{target:99}}).outputText)+'\nglobalThis.AudioClass=GameAudio;globalThis.qfLog=qfAudioLog;';
  class Events{constructor(){this.m=new Map();}on(n,f,t){(this.m.get(n)||this.m.set(n,[]).get(n)).push([f,t]);}off(n,f){this.m.set(n,(this.m.get(n)||[]).filter(x=>x[0]!==f));}emit(n){for(const [f,t] of [...(this.m.get(n)||[])])f.call(t);}}
  class Component{destroy(){return true;}}
  const sources=[];
  class AudioSource{constructor(){this.clip=null;this.playing=false;this.starts=0;this.volume=1;sources.push(this);}play(){this.starts++;this.playing=true;this.played=this.clip&&this.clip.name;this.playedVolume=this.volume;}pause(){this.playing=false;}stop(){this.playing=false;}destroy(){this.destroyed=true;}}
  AudioSource.EventType={STARTED:'s',ENDED:'e'};AudioSource.AudioState={INIT:0,PLAYING:1,PAUSED:2,STOPPED:3};AudioSource.maxAudioChannel=24;
  class Node extends Events{constructor(n){super();this.name=n;this.valid=true;this.components=[];}addComponent(C){const c=new C();c.node=this;this.components.push(c);c.onLoad?.();return c;}addChild(){}}
  const dirLoads=[],bundleReqs=[];let bundle=null;
  const assetManager={getBundle:n=>bundle&&n==='region_island'?bundle:null,loadBundle:(n,cb)=>bundleReqs.push({n,cb})};
  const AudioClip=class{};
  const game=new Events();
  const ctx={_decorator:{ccclass:()=>x=>x},Component,Node,AudioSource,AudioClip,assetManager,resources:{load(){},loadDir(){}},director:{getScene:()=>new Node('scene'),addPersistRootNode(){}},game,Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},input:new Events(),Input:{EventType:{TOUCH_END:'t',MOUSE_UP:'m',KEY_DOWN:'k'}},sys:{localStorage:{getItem:()=>null,setItem(){}}},isValid:n=>!!n&&n.valid!==false,console:{log(){},warn(){},info(){},error:console.error},Date,Math,JSON,Promise,Map,Set,Array,Object,Number,String,Error,setTimeout,clearTimeout};
  ctx.globalThis=ctx;vm.runInNewContext(code,ctx);const A=ctx.AudioClass;let time=10000;A.now=()=>time;
  const a=A.ensure();
  const req=n=>{if(n==='cc')return {assetManager,AudioClip};if(n==='./GameAudio')return {GameAudio:A,qfAudioLog:ctx.qfLog};if(n==='./FootstepCore')return C;throw Error('import '+n);};
  const FA={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(AUD+'/FootstepAudio.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:FA,require:req,console:ctx.console,Math,Array,Number,String,Error});
  const tr={clip:'walk_loop',abs:0,loop:true,duration:1.4667};let pos={x:0.5,z:-3,yaw:Math.PI};
  const f=new FA.FootstepAudio(()=>({clock:{base:tr},x:pos.x,z:pos.z,yaw:pos.yaw}));
  const mkClips=()=>['wood','rug','stone','path','grass'].flatMap(s=>[1,2,3,4].map(i=>({name:`step_${s}_${i}`,refs:0,addRef(){this.refs++;},decRef(){this.refs--;}})));
  const steps=()=>sources.filter(s=>s.starts>0&&/^step_/.test(s.played||'')).map(s=>({name:s.played,volume:s.playedVolume}));
  // a step clip is ~0.3 s: report ENDED like the engine does, so voices are released (MAX_VOICES applies)
  const walk=(seconds)=>{for(let i=0;i<Math.round(seconds*60);i++){tr.abs+=1/60;time+=1000/60;f.tick(1/60);for(const s of sources)if(s.starts>0&&!s.ended&&(s.age=(s.age||0)+1)>18){s.ended=true;a.onSfxEnded(s);}}};
  return {A,a,f,game,bundleReqs,dirLoads,setBundle:()=>{bundle={loadDir:(d,t,cb)=>dirLoads.push({d,cb})};return bundle;},mkClips,steps,walk,tr,setPos:p=>pos=p};
}
const ready=h=>{h.setBundle();h.f.onWorldState('home');assert.equal(h.dirLoads.length,1);assert.equal(h.dirLoads[0].d,'audio_steps');h.dirLoads[0].cb(null,h.mkClips());};
await test('FootstepAudio: loads region_island/audio_steps on home, adopted by GameAudio (ref-counted); walking plays one step per plant',()=>{
  const h=harness();h.f.onWorldState('home');assert.equal(h.bundleReqs.length,1);assert.equal(h.bundleReqs[0].n,'region_island');
  const b=h.setBundle();h.bundleReqs[0].cb(null,b);const clips=h.mkClips();h.dirLoads[0].cb(null,clips);assert(clips.every(c=>c.refs===1));assert(h.a.hasClip('step_rug_3'));
  h.f.onWorldState('walking-out');h.walk(1.4667*3);const s=h.steps();assert.equal(s.length,6,'3 cycles x 2 plants');
  assert(s.every(x=>/^step_rug_/.test(x.name)),'on the rug');for(let i=1;i<s.length;i++)assert.notEqual(s[i].name,s[i-1].name);
  assert(s.every(x=>x.volume>0.2&&x.volume<0.45));
  h.setPos({x:0.2,z:0.4,yaw:0});h.walk(1.4667);assert(h.steps().slice(6).every(x=>/^step_stone_/.test(x.name)),'doorstep slab');
  assert.equal(h.f.diagnostics().log.length,8);
  h.a.onDestroy();assert(clips.every(c=>c.refs===0),'released with GameAudio');
});
for(const [label,apply,undo] of [['muted',h=>h.a.setMuted(true),h=>h.a.setMuted(false)],['sfx muted (设置「音效」)',h=>h.a.setSfxMuted(true),h=>h.a.setSfxMuted(false)],['background (hide)',h=>h.game.emit('hide'),h=>h.game.emit('show')]])
await test(`${label}: no steps, none queued, no burst when sound returns`,()=>{
  const h=harness();ready(h);h.f.onWorldState('crossing-out');apply(h);h.walk(1.4667*2);assert.equal(h.steps().length,0);
  undo(h);h.walk(0.05);assert.equal(h.steps().length,0,'nothing replayed');h.walk(1.4667*2);assert.equal(h.steps().length,4,'normal steps again');
});
await test('silent outside exit / return states (region journey, level, paused) and before clips load',()=>{
  const h=harness();h.setBundle();h.f.onWorldState('standing');h.f.onWorldState('walking-out');h.walk(3);assert.equal(h.steps().length,0,'not loaded yet: dropped, not queued');
  h.dirLoads[0].cb(null,h.mkClips());for(const st of ['region-travel','level','paused','meadow','lakeside','skycity']){h.f.onWorldState(st);h.walk(3);assert.equal(h.steps().length,0,st);}
  h.f.onWorldState('walking-home');h.walk(1.5);assert.equal(h.steps().length,2);
});
await test('Boot wiring: FootstepAudio fed every world state next to GameAudio, ticked in lateUpdate, disposed; frozen stand-in untouched',()=>{
  const b=fs.readFileSync('creator-build-project/assets/scripts/WorldIntegrationBoot.ts','utf8');
  assert(/onWorldState\?\.\(state\);[^\n]*\n\s*try\{this\.footsteps\?\.onWorldState\(state\);/.test(b));
  assert(/lateUpdate\(dt:number\)\{try\{this\.footsteps\?\.tick\(dt\);/.test(b));assert(/onDestroy\(\)\{this\.footsteps\?\.dispose\(\);/.test(b));
  assert(/new FootstepAudio\(\(\)=>\{[^\n]*clock:adapter\.clock\?\?null/.test(b));
  const cp=require('node:child_process').spawnSync(process.execPath,['tools/legacy-test-repair/controller-integrity.cjs'],{encoding:'utf8'});assert.equal(cp.status,0,cp.stdout+cp.stderr);
  const g=fs.readFileSync(AUD+'/GameAudio.ts','utf8');assert(!/from '\.\/Footstep/.test(g),'GameAudio does not import the footstep modules');
});
await test('assets: 20 mono 44.1 kHz mp3 one-shots (<= 2 KB each, <= 32 KB total) + metas; exit track has no baked steps',()=>{
  const dir='creator-build-project/assets/bundles/region_island/audio_steps';const files=fs.readdirSync(dir).filter(f=>f.endsWith('.mp3')).sort();assert.equal(files.length,20);
  let total=0;const uuids=new Set();
  for(const f of files){const bytes=fs.readFileSync(path.join(dir,f));total+=bytes.length;assert(bytes.length<=2048,f+' '+bytes.length);
    let i=bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33?10+((bytes[6]&127)<<21|(bytes[7]&127)<<14|(bytes[8]&127)<<7|(bytes[9]&127)):0;while(i<bytes.length-1&&!(bytes[i]===0xff&&(bytes[i+1]&0xe0)===0xe0))i++;
    assert.equal((bytes[i+1]>>3)&3,3,'MPEG-1');assert.equal((bytes[i+2]>>2)&3,0,'44.1 kHz');assert.equal((bytes[i+3]>>6)&3,3,'mono');
    const m=JSON.parse(fs.readFileSync(path.join(dir,f+'.meta'),'utf8'));assert.equal(m.importer,'audio-clip');assert.deepEqual(m.files,['.json','.mp3']);uuids.add(m.uuid);}
  assert.equal(uuids.size,20);assert(total<=32768,'total '+total);assert.equal(JSON.parse(fs.readFileSync(dir+'.meta','utf8')).importer,'directory');
  for(const f of ['FootstepCore.ts','FootstepData.ts','FootstepAudio.ts'])assert.equal(JSON.parse(fs.readFileSync(AUD+'/'+f+'.meta','utf8')).importer,'typescript');
  const ex=fs.readFileSync('creator-build-project/assets/bundles/region_island/audio_cine/sfx_exit_outbound.mp3');
  // tools/exit-footsteps/synth_exit.py (default = no steps; --with-steps reproduces the A1 file byte for byte)
  assert.equal(crypto.createHash('sha256').update(ex).digest('hex'),EXIT_SHA);
  console.log('steps total bytes',total);
});
console.log(JSON.stringify({status:'PASS_MOCK_AND_SIM',cases:count,creatorBuild:'NOT_RUN',deviceListening:'NOT_RUN'}));
})().catch(e=>{console.error(e);process.exit(1);});
