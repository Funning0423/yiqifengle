'use strict';
// coast-scene-loader gate (场景设计部 2026-10-30): bundles/region_coast/scripts/CoastSceneLayout.ts + CoastSceneLoader.ts.
// 1 layout -> TRS == coastshot.js inst() convention; every non-reuse mesh is a node in models/*.glb; root frame == placement block.
// 2 flag off: mountCoastScene touches no engine API (no bundle load, no Node); pinned kit-off/frozen files byte-identical.
// 3 no pop-in: root detached + inactive for every placement; one addChild+active at the end; first camera write after that.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets'),B=path.join(A,'bundles/region_coast');
const tr=src=>ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
function loader(stubs){const mods={};const load=abs=>{if(mods[abs])return mods[abs].exports;const m={exports:{}};mods[abs]=m;const dir=path.dirname(abs);
 new Function('module','exports','require',tr(fs.readFileSync(abs+'.ts','utf8')))(m,m.exports,r=>{if(stubs[r])return stubs[r];if(r.startsWith('.')){const k=path.basename(r);if(stubs[k])return stubs[k];return load(path.resolve(dir,r));}return require(r);});return m.exports;};return load;}
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}else console.log('ok   '+m);};
const near=(a,b,e=1e-9)=>a.every((v,i)=>Math.abs(v-b[i])<=e);
// ---- 1 placement core
const CL=loader({})(path.join(B,'scripts/CoastSceneLayout'));
const LY=JSON.parse(fs.readFileSync(path.join(B,'data/coast_layout.json'),'utf8'));
const I=CL.coastInstances(LY);
ok(I.length===LY.layout.length&&I.length===244&&!LY.layout.some(e=>e.piece||/^piece_/.test(e.mesh)),'244 instances, runtime layout has no piece_* (got '+I.length+')');
ok(I.every((x,k)=>{const e=LY.layout[x.index];return near(x.position,e.p)&&near(x.eulerDeg,[e.tilt?e.tilt[0]:0,e.rz*180/Math.PI,e.tilt?e.tilt[1]:0])&&x.scale===e.s;}),'TRS == coastshot inst(): setPosition(p), setRotationFromEuler(tilt0, rz*180/PI, tilt1), setScale(s)');
const shot=fs.readFileSync(path.join(ROOT,'tools/coast-scene/coastshot.js'),'utf8');
ok(shot.includes("n.setRotationFromEuler(e.tilt?e.tilt[0]:0,e.rz*180/Math.PI,e.tilt?e.tilt[1]:0);n.setScale(e.s,e.s,e.s)")&&shot.includes('/^rock_|^reuse_rock|ebb_bell|crab|gull|hermit|headland|beacon_post|reuse_palm|reuse_bush/'),'coastshot.js still uses the same euler/scale/shadow rule (text pin)');
const P=LY.placement;ok(near(CL.COAST_ROOT.position,P.position)&&CL.COAST_ROOT.yawDeg===180&&P.yaw_deg===180&&P.scale===1,'COAST_ROOT == layout placement (-0.6,-0.845,21.5) yaw 180');
ok(near(CL.coastWorldOf([0,0.845,13.1]),[-0.6,0,8.4],1e-9)&&near(CL.coastWorldOf(P.anchors_local.ramp_start),P.island_walk.ramp_start_world,1e-9),'ramp_start local -> world (-0.6,0,8.4) == island_walk.ramp_start_world');
ok(near(CL.coastWorldOf([1,2,3]),[-1.6,1.155,18.5],1e-9),'world = (pos.x-x, pos.y+y, pos.z-z)');
const nodes=new Set();for(const f of fs.readdirSync(path.join(B,'models')).filter(f=>f.endsWith('.glb'))){const b=fs.readFileSync(path.join(B,'models',f)),jl=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+jl));
 for(const n of j.nodes)if(n.mesh!==undefined){nodes.add(n.name);if(n.translation||n.rotation||n.scale)ok(false,'glb node has own TRS: '+f+'/'+n.name);}
 ok(!(j.materials||[]).length&&j.meshes.every(m=>m.primitives.every(p=>p.attributes.COLOR_0!==undefined)),f+': no materials, vertex colours (loader binds builtin vertex-colour materials)');}
const own=I.filter(x=>!x.reuse),reuse=I.filter(x=>x.reuse);
ok(own.every(x=>nodes.has(x.mesh)),'all '+own.length+' non-reuse instances resolve to a glb node (missing: '+[...new Set(own.filter(x=>!nodes.has(x.mesh)).map(x=>x.mesh))]+')');
console.log('info reuse:true instances (island props, not in this bundle): '+reuse.length+' ['+[...new Set(reuse.map(x=>x.mesh))].join(',')+']');
// ---- 2/3 engine mock
function mockCC(log){class Asset{constructor(n){this.name=n;this.refs=0;}addRef(){this.refs++;log.push(['addRef',this.name]);}decRef(){this.refs--;log.push(['decRef',this.name]);}}
  class Node{constructor(n){this.name=n;this.children=[];this.parent=null;this.active=true;this.comps=[];log.push(['new',n]);}
  addChild(c){c.parent=this;this.children.push(c);log.push(['add',this.name,c.name,root(this).name,root(this).active]);}
  setPosition(...a){this.pos=a;}setRotationFromEuler(...a){this.eul=a;}setScale(...a){this.scl=a;}getComponent(){return this.comps[0]||null;}destroy(){this.dead=true;log.push(['destroy',this.name]);}}
  const root=n=>{while(n.parent)n=n.parent;return n;};
  const clone=n=>{const c=new Node(n.name);c.comps=n.comps.map(()=>({setMaterial(m,i){c.mat=m;},shadowCastingMode:0,receiveShadow:0}));for(const k of n.children)c.addChild(clone(k));return c;};
  const mk=d=>{const n=Object.create(Node.prototype);Object.assign(n,{name:d.name,children:[],parent:null,active:true,comps:d.comps.map(()=>({}))});for(const c of d.children){const k=mk(c);k.parent=n;n.children.push(k);}return n;};
  const prefabs=fs.readdirSync(path.join(B,'models')).filter(f=>f.endsWith('.glb')).map(f=>{const b=fs.readFileSync(path.join(B,'models',f)),jl=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+jl));
   const n=mk({name:f,children:j.nodes.map(x=>({name:x.name,children:[],comps:[1]})),comps:[]});Object.assign(n,new Asset(f));n.addRef=Asset.prototype.addRef;n.decRef=Asset.prototype.decRef;return n;});
  const json=new Asset('coast_layout');json.json=LY;
  const bundle={load(p,T,cb){log.push(['load',p]);cb(null,json);},loadDir(p,T,cb){log.push(['loadDir',p]);cb(null,prefabs);}};
  return {cc:{assetManager:{getBundle:()=>null,loadBundle(n,cb){log.push(['loadBundle',n]);cb(null,bundle);}},AssetManager:{},Asset,JsonAsset:class{},Prefab:class{},MeshRenderer:class{},Material:class{},
   instantiate:n=>clone(n),isValid:n=>!!n&&!n.dead,Node},json,prefabs};}
const islandMat={name:'M_env_palette'};
async function run(o){const log=[];const M=mockCC(log);if(o.loadFail)M.cc.assetManager.loadBundle=(n,cb)=>cb(Error('boom'));const errs=[],warns=[];const ce=console.error,cw=console.warn;console.error=m=>errs.push(m);console.warn=m=>warns.push(m);
  delete globalThis.__qfCoast;const L=loader({cc:M.cc,'BoardProjection':{coastBoardKitFromFlag:()=>o.kit!==false}})(path.join(B,'scripts/CoastSceneLoader'));
  const world=new M.cc.Node('island_scene_root');const tplIsland=new M.cc.Node('island_tpl');tplIsland.comps=[{}];log.length=0;
  const opts=o.opts?o.opts(tplIsland):{resolveReuse:n=>tplIsland,resolveMaterial:()=>islandMat,cancelled:()=>false};
  let h;try{h=await L.loadCoastScene(o.world===undefined?world:o.world,opts);}finally{console.error=ce;console.warn=cw;}return {h,log,errs,warns,world,M,L,tplIsland};}
async function main(){
 {const r=await run({kit:false});ok(r.h===null&&r.log.length===0&&r.errs.length===0&&r.world.children.length===0,'flag off: no engine call, no log, nothing added (engine calls '+r.log.length+')');}
 {const r=await run({});const h=r.h;
  ok(typeof r.L.loadCoastScene==='function'&&globalThis.__qfCoast&&globalThis.__qfCoast.loadCoastScene===r.L.loadCoastScene&&globalThis.__qfCoast.unloadCoastScene===r.L.unloadCoastScene,'export loadCoastScene + globalThis.__qfCoast.loadCoastScene/unloadCoastScene registered');
  ok(h&&h.placed===own.length&&h.reusePlaced===reuse.length&&r.errs.length===0,'flag on: placed '+(h&&h.placed)+' + reuse '+(h&&h.reusePlaced)+', 0 errors');
  const adds=r.log.filter(x=>x[0]==='add'&&x[3]==='region_coast_root');ok(adds.length>=I.length&&adds.every(x=>x[4]===false),'every placement on the detached, inactive root');
  const show=r.log.findIndex(x=>x[0]==='add'&&x[1]==='island_scene_root'&&x[2]==='region_coast_root');
  ok(show>0&&r.log.slice(show+1).every(x=>x[0]!=='add')&&h.root.active===true&&r.world.children.length===1,'one attach under the world node at the end, then active');
  const bad=h.root.children.filter(n=>!n.name.startsWith('reuse_')&&n.mat!==islandMat);if(bad.length)console.log('bad',bad.slice(0,3).map(n=>n.name+':'+JSON.stringify(n.mat)));ok(!bad.length,'every coast mesh uses the resolveMaterial material (no builtin material created)');
  const src=fs.readFileSync(path.join(B,'scripts/CoastSceneLoader.ts'),'utf8');ok(!/builtin-standard|builtin-unlit|USE_VERTEX_COLOR/.test(src)&&(src.match(/new Material\(/g)||[]).length===(src.match(/new Material\(\);m\.initialize\(\{effectAsset:src\.effectAsset,/g)||[]).length,'no builtin / vertex-colour fallback material in the loader source (only new Material on the island palette effect, Grok Bot 2026-10-30)');
  const c=h.root.children.find(n=>n.name===own[0].mesh);ok(near(h.root.pos,[-0.6,-0.845,21.5])&&near(h.root.eul,[0,180,0])&&c&&near(c.pos,own[0].position)&&near(c.eul,own[0].eulerDeg),'root TRS + child TRS applied');
  r.log.length=0;h.dispose();h.dispose();const dec=r.log.filter(x=>x[0]==='decRef').length;
  ok(h.root.dead&&dec===1+r.M.prefabs.length&&r.M.json.refs===0&&r.M.prefabs.every(p=>p.refs===0)&&!r.tplIsland.dead&&!islandMat.dead,'dispose: root destroyed, layout+4 glbs decRef once, island templates/materials untouched (idempotent)');}
 {const r=await run({loadFail:true});ok(r.h===null&&r.world.children.length===0&&r.errs.some(e=>/^\[QF_COAST\] scene mount failed/.test(e)),'load failure: console.error [QF_COAST], nothing shown');}
 {const r=await run({opts:t=>({resolveMaterial:()=>islandMat,cancelled:()=>false})});ok(r.h===null&&r.log.length===0&&r.errs.some(e=>/\[QF_COAST\].*missing resolveReuse/.test(e)),'missing resolveReuse: console.error [QF_COAST], nothing loaded');}
 {const r=await run({opts:t=>({resolveReuse:()=>t,cancelled:()=>false})});ok(r.h===null&&r.errs.some(e=>/\[QF_COAST\].*missing resolveMaterial/.test(e)),'missing resolveMaterial: console.error [QF_COAST] (no builtin fallback)');}
 {const r=await run({opts:t=>({resolveReuse:n=>n==='reuse_cloud'?null:t,resolveMaterial:()=>islandMat,cancelled:()=>false})});
  ok(r.h&&r.errs.length===1&&/\[QF_COAST\] reuse unresolved: reuse_cloud \(5 instances/.test(r.errs[0])&&r.h.reusePlaced===reuse.length-5,'unresolved reuse name: console.error [QF_COAST] naming it + count');}
 {const r=await run({opts:t=>({resolveReuse:()=>t,resolveMaterial:k=>k.mesh==='terrain'?null:islandMat,cancelled:()=>false})});
  ok(r.h&&r.errs.some(e=>/\[QF_COAST\] material unavailable for terrain/.test(e))&&!r.h.root.children.some(n=>n.name==='terrain'),'material unavailable: console.error [QF_COAST], mesh not mounted with any fallback');}
 for(const at of [1,2,3]){let k=0;const r=await run({opts:t=>({resolveReuse:()=>t,resolveMaterial:()=>islandMat,cancelled:()=>++k>=at})});
  ok(r.h===null&&r.world.children.length===0&&r.M.json.refs===0&&r.M.prefabs.every(p=>p.refs===0)&&r.warns.some(w=>/\[QF_COAST\] scene mount cancelled/.test(w)),'cancelled at check '+at+': nothing shown, all loaded assets released');}
 {const L=await run({});ok(Object.keys(CL.COAST_REUSE_SOURCES).sort().join()===[...new Set(reuse.map(x=>x.mesh))].sort().join()&&Object.values(CL.COAST_REUSE_SOURCES).reduce((a,b)=>a+b.count,0)===reuse.length&&reuse.length===96,'COAST_REUSE_SOURCES == the 13 reuse names / 96 instances in the layout');}
 // pins
 const PIN={'scripts/regional-r05/runtime/regional-session.js':'730332db8e4b2f7543d091fd2effb54b8b7b4929b9fb207fec46b1a71fc0248b','scripts/regional-r05/runtime/rule-guide.js':'2653f7233a890100a1e7c7bb8ca5cfc5f5d3a44bc93a9de3b32796c55af9f3ea',
  'scripts/CharacterMotion.ts':'3ef288ff12a8f8512e07a3ea2f94819e984cc70a9d9d4a38b5a9c69e1523b657','scripts/world-r2/WorldNativeComposition.ts':'663e60d6d63c5288c6f9b42678dbb8191a7eab5373671f1d204d31d267946012',
  'scripts/world-r1/WorldFlowComponent.ts':'e5d501a3f46ac6a9aac472f3d84eab949a50921ddd6e86b4b1a01abcc68ff487','scripts/WorldIntegrationBoot.ts':'19619af0b691b94d8d88031fb93e1cd28ef00ec1e5170b609286714faf7cb834',
  'scripts/regional-r05/runtime/coast-kit.js':'6ce4523fbf8aca24539384ce9c4bcfb49d6d7c94bbcdc2b9b5652ca05014d982'};
 for(const [f,h] of Object.entries(PIN))ok(crypto.createHash('sha256').update(fs.readFileSync(path.join(A,f))).digest('hex')===h,'pinned (kit-off/frozen) '+f);
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 const refs=walk(path.join(A,'scripts')).filter(f=>/\.(ts|js)$/.test(f)&&/CoastSceneLoader|CoastSceneLayout/.test(fs.readFileSync(f,'utf8')));
 ok(refs.length===0,'no main-package script references the loader (it only runs from the region_coast bundle on the kit path)');
 ok(!fs.readdirSync(path.join(B,'scripts')).some(f=>f.endsWith('.meta')),'no hand-written .meta in region_coast/scripts');
 console.log(fails?'FAIL coast-scene-loader ('+fails+')':'PASS coast-scene-loader');process.exit(fails?1:0);}
main().catch(e=>{console.log('FAIL',e.stack);process.exit(1);});
