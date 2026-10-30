'use strict';
// coast-arrival single-writer gate in the REAL WNC order (运镜bot, item C). Kit ON, region coast:
// r3: line 156 = the runCoastArrival single entry; loadCoastScene is a STUB here (场景设计部 loader 1062a72b not merged); negatives incl. two writers.
//  WNC.ts is copied to a temp dir and outbox diff 02 is applied there (git apply; the tree is never patched). The patched line 156
//  (setEnterLevelEnd + loadBundle + __qfCoast self-registry + install her + playCoastArrival + uninstall) and line 157 (enterLevel)
//  run in that order as one async method on a fake `this` whose world is the REAL WorldFlowComponent playEnterLevel block (cut from
//  WorldFlowComponent.ts, as coast-board-lens does). Every camera write is traced by source (CameraPose.cameraWriteHook).
//  PASS = lens writes > 0, push-in ('world.enterLevel') writes 0, last write = coastBoardPose(w,h), no [QF_COAST] error, her
//  installed before / uninstalled after, 60 / 30 / uneven dt, 7 screens.
//  Negative self-tests (must FAIL the detectors): lens cancelled early -> the push-in writes; no self-registry -> [QF_COAST] error;
//  kit off -> patched 156 does nothing (no load, no write) and the patched file differs from WNC only on lines 8 and 156.
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets'),S=path.join(A,'scripts');
const tr=src=>ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
const mods={};function load(abs){if(mods[abs])return mods[abs].exports;const m={exports:{}};mods[abs]=m;const dir=path.dirname(abs);
 new Function('module','exports','require',tr(fs.readFileSync(abs+'.ts','utf8')))(m,m.exports,r=>r==='cc'?(globalThis.__yjCcStub||{}):(r.endsWith('/CoastSceneLoader')&&globalThis.__yjSceneStub)?globalThis.__yjSceneStub:r.startsWith('.')?load(path.resolve(dir,r)):require(r));return m.exports;}
const CP=load(path.join(S,'world-r1/CameraPose')),CB=load(path.join(S,'region/CoastBoardLens'));
const LENS=path.join(A,'bundles/region_coast/scripts/CoastArrivalLens');
// 场景设计部 1062a72b loader: signature pinned from the merged source, then stubbed per that signature (no engine here).
{const L=fs.readFileSync(path.join(A,'bundles/region_coast/scripts/CoastSceneLoader.ts'),'utf8');if(!/export async function loadCoastScene\(world:CoastWorld,opts:CoastSceneOptions\):Promise<CoastSceneHandle\|null>/.test(L)||!/resolveMaterial:/.test(L)||!/cancelled:\(\)=>boolean/.test(L)){console.log('FAIL loadCoastScene signature (1062a72b) changed');process.exit(1);}}
let SCENE=null;globalThis.__yjSceneStub={loadCoastScene:(w,o)=>SCENE(w,o),unloadCoastScene:h=>h?.dispose(),coastIslandMaterial:(isl,n)=>({name:n,isValid:true}),loadCoastPalette:async()=>null,makeCoastPaletteMaterial:()=>({})};
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}return c;};
// --- patched WNC (temp copy) ---
const WNC_REL='creator-build-project/assets/scripts/world-r2/WorldNativeComposition.ts',DIFF=path.join(ROOT,'team/cinematic/outbox/20261030-coast-arrival-runtime/02-WorldNativeComposition-coast-arrival.diff');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'yj-wnc-'));fs.mkdirSync(path.dirname(path.join(tmp,WNC_REL)),{recursive:true});fs.copyFileSync(path.join(ROOT,WNC_REL),path.join(tmp,WNC_REL));
cp.execFileSync('git',['apply','--unsafe-paths','--directory=.',DIFF],{cwd:tmp});const orig=fs.readFileSync(path.join(ROOT,WNC_REL),'utf8').split('\n'),pat=fs.readFileSync(path.join(tmp,WNC_REL),'utf8').split('\n');fs.rmSync(tmp,{recursive:true,force:true});
{const d=orig.map((l,i)=>l===pat[i]?null:i+1).filter(Boolean);ok(orig.length===pat.length&&JSON.stringify(d)==='[8,156]','patched WNC differs on lines '+d);
 ok(pat[155].startsWith('    if(coastKit){')&&pat[155].startsWith(orig[155].slice(0,-1)),'patched 156 = original statement extended inside the same if(coastKit){...}');
 ok((pat[155].match(/;/g)||[]).length>0&&!/\bimport\b|require\(/.test(pat[155]),'156: no import/require of a bundle script');}
// --- WFC playEnterLevel block (real code) ---
const wsrc=fs.readFileSync(path.join(S,'world-r1/WorldFlowComponent.ts'),'utf8');
const cut=(a,b)=>{const i=wsrc.indexOf(a);assert.ok(i>=0,'WFC moved: '+a);const j=wsrc.indexOf(b,i);assert.ok(j>i);return wsrc.slice(i,j+b.length);};
const Wf=new Function('director','isValid','rotate','CAMERA_FIXED','samePose','coastPushSeconds','COAST_PUSH_EASE','createCameraTrack','camTag','Cancelled','module',tr(`class W{constructor(camera){this.jobs=new Set();this.worldCamera=camera;this.enterLevelEnd=null;}noteCinematic(){}
 ${cut('  private run(seconds:number','\n  }\n').replace('private run','run')}
 ${cut('  private enterLevelLook():Pose[]|null {','\n  }\n').replace('private enterLevelLook','enterLevelLook')}
 step(frameDt){${cut('    for(const j of Array.from(this.jobs)) {','\n    }\n')}}
 play(camera,token){const ENTER_LEVEL_SHOT_S=0.78;${cut('          if(this.enterLevelEnd){','\n          }\n')} return 'generic';}}
module.exports=W;`));
function method(line156){return new Function('coastBoardPose','assetManager','director','Result',tr(`return async function(region,coastKit,selection,held){
${line156}
${pat[156]}
return result;}`))(CB.coastBoardPose,assetManagerProxy,directorProxy,undefined);}
let ENV=null;const assetManagerProxy={loadBundle:(n,cb)=>ENV.loadBundle(n,cb)},directorProxy={getDeltaTime:()=>ENV.dt(),getTotalFrames:()=>ENV.fr};
function lcg(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return 1/90+(1/45-1/90)*(s/4294967296);};}
function makeW(director){const m={exports:{}};Wf(director,()=>true,CP.rotate,CP.CAMERA_FIXED,CB.samePose,CB.coastPushSeconds,CB.COAST_PUSH_EASE,CP.createCameraTrack,()=>{},class extends Error{},m);return m.exports;}
async function scenario({w,h,clock,kit=true,registry=true,scene=true,cancelAfter=-1,rogue=false,line=pat[155]}){
 const writes=[],errors=[],log={loads:0,installed:0,uninstalled:0,order:[]};
 const node={worldPosition:{x:0,y:0,z:0},worldRotation:{x:0,y:0,z:0,w:1},isValid:true,setWorldPosition(x,y,z){this.worldPosition={x,y,z};},setWorldRotation(x,y,z,w){this.worldRotation={x,y,z,w};}};
 const camera={node,fov:45},island=CP.fromLookAt({position:[6,9,-4],target:[-0.6,-0.8,11],fovVerticalDeg:45});
 node.worldPosition={x:island.position[0],y:island.position[1],z:island.position[2]};node.worldRotation={x:island.rotation[0],y:island.rotation[1],z:island.rotation[2],w:island.rotation[3]};camera.fov=45;
 const self={isValid:true,selection:{stageId:'r03-coast-01'},node:{isValid:true,scene:{name:'scene',children:[]}},pendingJourneySelection:null,markExplore(){}};
 ENV={fr:100,dt:clock,loadBundle:(n,cb)=>{log.loads++;log.order.push('loadBundle');delete globalThis.__qfCoast;
   if(registry){delete mods[LENS];load(LENS);SCENE=async(wd,o)=>{log.order.push('loadCoastScene');ok(typeof o.resolveReuse==='function'&&typeof o.cancelled==='function'&&typeof o.resolveMaterial==='function','loadCoastScene opts (1062a72b signature)');ok(wd===self.world.ownedModel?.scene_root_||wd?.sceneRoot===islandRoot,'loadCoastScene gets the island scene_root, not the world component');try{o.resolveMaterial({mesh:'foam',kind:'unlit',alpha:0.6,emit:false,palette:'coast_palette_256'});}catch(e){ok(false,'resolveMaterial rejects a fafaad1a key with palette: '+e);}if(!scene){console.error('[QF_COAST] stub: layout missing');return null;}return {root:{},placed:1,reusePlaced:0,errors:[],dispose(){log.order.push('sceneDispose');}};};}
   setImmediate(()=>cb(n==='region_coast'?null:Error('bundle '+n)));}};
 const director={getTotalFrames:()=>ENV.fr,getDeltaTime:()=>ENV.last??1/60};globalThis.cc={director};
 const WC=makeW(director),wf=new WC(camera);const hook=CP.cameraWriteHook,prev=hook.trace;
 hook.trace=src=>{writes.push({fr:ENV.fr,s:src,p:[node.worldPosition.x,node.worldPosition.y,node.worldPosition.z],fov:camera.fov});};
 let frames=0;const rogueP=CP.fromLookAt({position:[1,8,0],target:[0,0,10],fovVerticalDeg:48});
 const islandRoot={name:'scene_root',children:[],isValid:true},world={isValid:true,ownedModel:{name:'island',children:[islandRoot],isValid:true,getChildByName:n=>n==='scene_root'?islandRoot:null},worldCamera:camera,node:{isValid:true,scene:self.node.scene},setEnterLevelEnd(f){wf.enterLevelEnd=f;log.order.push(f?'setEnd':'clearEnd');},holdEnterLevel(){},
  scheduleOnce(fn){setImmediate(()=>{ENV.fr++;ENV.last=clock();frames++;if(frames===cancelAfter)self.selection={stageId:'other'};if(rogue)CP.applyCameraPose(camera,rogueP,'rogue.writer');fn(ENV.last);});},
  coastArrivalAdapter:{node:{worldPosition:{x:0,y:0,z:0},setWorldPosition(){},setRotationFromEuler(){}},perform:()=>new Promise(()=>{})},
  commands(){return {snapshot:()=>({journey:{region:'island'}}),enterLevel:async()=>{log.order.push('enterLevel');const token={check(){},onCancel(){return ()=>{};}};wf.play(camera,token);let n=0;
    while(wf.jobs.size&&n<4000){ENV.fr++;wf.step(clock());n++;}for(let i=0;i<120;i++){ENV.fr++;wf.step(clock());}return {ok:true};}};}};
 const proxyWorld=new Proxy(world,{set(t,k,v){if(k==='coastArrivalHer'&&v){log.installed++;log.order.push('installHer');}t[k]=v;return true;},
  deleteProperty(t,k){if(k==='coastArrivalHer'){log.uninstalled++;log.order.push('uninstallHer');}delete t[k];return true;}});
 self.world=proxyWorld;self.worldCamera=camera;
 const ce=console.error,ci=console.info,cw=console.warn;console.error=(...a)=>{errors.push(a.join(' '));};console.info=()=>{};console.warn=()=>{};
 let res;try{res=await method(line).call(self,'coast',kit,{stageId:'r03-coast-01'},false);}finally{console.error=ce;console.info=ci;console.warn=cw;hook.trace=prev;delete globalThis.cc;}
 const lens=writes.filter(x=>x.s==='coast.arrival').length,push=writes.filter(x=>x.s==='world.enterLevel').length,other=writes.length-lens-push;
 const per=new Map();for(const x of writes)per.set(x.fr,(per.get(x.fr)||0)+1);const maxPer=writes.length?Math.max(...per.values()):0;
 return {writes,errors,log,lens,push,other,maxPer,res,end:writes.at(-1)};}
/** the single-writer verdict used for every run (and proven to FAIL on two writers below). */
const singleWriter=r=>r.lens>0&&r.push===0&&r.other===0&&r.maxPer<=1;
(async()=>{
 const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
 const clocks={'60fps':()=>()=>1/60,'30fps':()=>()=>1/30,uneven:()=>lcg(20261030)};
 for(const [w,h] of SCREENS){const g=globalThis;g.window={innerWidth:w,innerHeight:h};const to=CB.coastBoardPose(w,h),tp=CP.fromLookAt(to);const row=[];
  for(const [cn,mk] of Object.entries(clocks)){const r=await scenario({w,h,clock:mk()});const id=`${w}x${h} ${cn}`;
   ok(singleWriter(r),id+' not single writer: lens '+r.lens+' push '+r.push+' other '+r.other+' max/frame '+r.maxPer);ok(r.errors.length===0,id+' errors '+r.errors[0]);
   ok(r.end&&Math.hypot(r.end.p[0]-tp.position[0],r.end.p[1]-tp.position[1],r.end.p[2]-tp.position[2])<1e-6&&Math.abs(r.end.fov-tp.fovVerticalDeg)<1e-9,id+' last write != coastBoardPose');
   ok(JSON.stringify(r.log.order)==='["setEnd","loadBundle","loadCoastScene","installHer","uninstallHer","enterLevel","clearEnd"]',id+' order '+r.log.order);row.push(`${cn} lens ${r.lens} push ${r.push}`);}
  console.log(`ok   ${w}x${h}: ${row.join(' | ')}`);}
 globalThis.window={innerWidth:390,innerHeight:844};
 {const r=await scenario({w:390,h:844,clock:()=>1/60,rogue:true});ok(!singleWriter(r)&&r.other>0&&r.maxPer>=2,'NEGATIVE: two camera writers (lens + rogue every frame) passed the single-writer verdict');
  console.log(`ok   negative: 2 writers (lens ${r.lens} + rogue ${r.other}, ${r.maxPer}/frame) -> single-writer verdict FAILS as required`);}
 {const r=await scenario({w:390,h:844,clock:()=>1/60,cancelAfter:30});ok(!singleWriter(r)&&r.push>0,'NEGATIVE: lens cancelled (selection change) but push-in wrote 0');ok(!r.errors.length,'cancel must be quiet (teardown), got '+r.errors[0]);
  ok(r.log.order.includes('sceneDispose')&&r.log.uninstalled===1,'cancel: scene disposed + her uninstalled');
  console.log(`ok   negative: selection change at frame 30 -> lens cancelled, push-in writes ${r.push} -> verdict FAILS; quiet; scene disposed, her uninstalled`);}
 {const r=await scenario({w:390,h:844,clock:()=>1/60,registry:false});ok(r.errors.some(e=>e.includes('[QF_COAST]')&&e.includes('not registered'))&&r.lens===0,'NEGATIVE: missing registry not logged');
  console.log('ok   negative: no __qfCoast.runCoastArrival after loadBundle -> console.error [QF_COAST] (= FAIL on the Mac)');}
 {const r=await scenario({w:390,h:844,clock:()=>1/60,scene:false});ok(r.errors.some(e=>e.includes('[QF_COAST]')&&e.includes('scene-null'))&&r.lens===0&&r.log.installed===0,'NEGATIVE: loadCoastScene null not logged / lens ran');
  console.log('ok   negative: loadCoastScene -> null (not cancelled) -> [QF_COAST] scene-null, NO arrival, no her');}
 {const r=await scenario({w:390,h:844,clock:()=>1/60});ok(!r.log.order.includes('sceneDispose'),'scene disposed at the arrival end');console.log('ok   scene kept at the arrival end (board stands in it)');}
 {const r=await scenario({w:390,h:844,clock:()=>1/60,kit:false});ok(r.log.loads===0&&r.lens===0&&r.errors.length===0&&r.log.installed===0&&JSON.stringify(r.log.order)==='["enterLevel"]','kit off: patched 156 did something: '+r.log.order);
  const rO=await scenario({w:390,h:844,clock:()=>1/60,kit:false,line:orig[155]});ok(JSON.stringify(rO.writes)===JSON.stringify(r.writes)&&JSON.stringify(rO.log.order)===JSON.stringify(r.log.order),'kit off: patched != original (writes/order)');
  console.log(`ok   kit off: patched 156 = original 156 (no load, no her, same ${r.writes.length} enter-level writes, same order)`);}
 if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-arrival-single-writer');
})().catch(e=>{console.log('FAIL',e.stack||e);process.exit(1);});
