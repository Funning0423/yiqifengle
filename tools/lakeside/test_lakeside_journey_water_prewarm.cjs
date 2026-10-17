// r4 journey fix 3 (GGbot): the journey lake's water shader/PSO is built before the lake first comes into view. On the first show(true)
// (under the set-off fade's full black, right after prime() switched the fog) the journey draws its own water copy once on a copy of a
// real water mesh shrunk to <= 1 mm in front of the camera, for 2 rendered frames, then removes it. Real LakesideJourneyWater with a fake
// cc; ordering locked in the adapter + RegionJourneyCore sources (show(true) under black, before the fade-in and the first walked frame).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
class Node{constructor(name='',layer=1){this.name=name;this.layer=layer;this.children=[];this.parent=null;this.components=[];this.destroyed=0;this.pos=[0,0,0];this.scale=[1,1,1];}
 addChild(c){c.parent=this;this.children.push(c);}setPosition(x,y,z){this.pos=[x,y,z];}setScale(x,y,z){this.scale=[x,y,z];}
 addComponent(C){const c=new C();c.node=this;this.components.push(c);return c;}getComponentsInChildren(C){const out=[];const walk=n=>{for(const c of n.components)if(c instanceof C)out.push(c);n.children.forEach(walk);};walk(this);return out;}
 destroy(){this.destroyed++;this.isValid=false;if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}}
class MeshRenderer{constructor(){this.mesh=null;this.sharedMaterials=[];this.shadowCastingMode=0;this.receiveShadow=1;}setSharedMaterial(m,i){this.sharedMaterials[i]=m;}}
let afterDrawHandlers=[];const director={once(ev,fn){assert.equal(ev,'director_after_draw');afterDrawHandlers.push(fn);}};
const draw=async()=>{const h=afterDrawHandlers;afterDrawHandlers=[];h.forEach(f=>f());await new Promise(r=>setImmediate(r));};
const cc={Node,MeshRenderer,director,isValid:o=>!!o&&o.isValid!==false};
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:7}}).outputText;
 const req=spec=>spec==='cc'?cc:spec==='cc/env'?{DEBUG:false}:load(path.resolve(path.dirname(file),spec)+'.ts');
 vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,req,m);return m.exports;}
const W=load(S+'region/LakesideJourneyWater.ts');
function lake(){const model=new Node('LakesideJourneyScene'),tree=new Node('LK_tree_01'),w=new Node('LK_water_01',1<<30);w.water=true;model.addChild(tree);model.addChild(w);
 const tr=tree.addComponent(MeshRenderer);tr.mesh={name:'tree'};const r=w.addComponent(MeshRenderer);r.mesh={name:'lake-mesh',struct:{minPosition:{x:-80,y:0,z:-120},maxPosition:{x:80,y:.2,z:120}}};r.sharedMaterials=[{n:'old0'},{n:'old1'}];r.shadowCastingMode=0;r.receiveShadow=1;
 const camNode=new Node('JourneyCamera');return {model,r,camera:{node:camNode,near:.1}};}
const water={name:'journey water copy'},isWater=n=>!!n.water;
const tests=[];const t=(n,f)=>tests.push([n,f]);
t('source = the lake renderer (water node, with a mesh), not other scenery',async()=>{const {model,r}=lake();assert.equal(W.lakesideWaterSourceRenderer(model,isWater),r);assert.equal(W.lakesideWaterSourceRenderer(null,isWater),null);});
t('prewarm: one tiny node in front of the camera draws the water copy on the real lake mesh, kept for 2 drawn frames, then removed',async()=>{
 const {model,r,camera}=lake();const p=W.prewarmLakesideWaterDraw(camera,water,W.lakesideWaterSourceRenderer(model,isWater));const n=p.node();
 assert(n&&n.parent===camera.node,'child of the journey camera');assert.equal(n.layer,r.node.layer,'lake layer (camera sees it)');assert(n.pos[2]<0&&n.pos[0]===0&&n.pos[1]===0,'straight ahead');
 const mr=n.components[0];assert.equal(mr.mesh,r.mesh,'same mesh = same vertex layout/PSO');assert.deepEqual(mr.sharedMaterials,[water,water],'water copy on every slot');assert.equal(mr.shadowCastingMode,r.shadowCastingMode);assert.equal(mr.receiveShadow,r.receiveShadow);
 assert(240*n.scale[0]<=W.LAKESIDE_WATER_PREWARM.sizeM+1e-12,'<= 1 mm on screen side');
 await draw();assert.equal(n.destroyed,0,'still there after 1 frame');await draw();const ok=await p.done;assert.equal(ok,true);assert.equal(n.destroyed,1);assert.equal(camera.node.children.length,0);assert.equal(p.node(),null);
 p.cancel();assert.equal(n.destroyed,1,'removed exactly once');});
t('cancel (journey disposed before the frames): removed once, done=false, later draws do nothing',async()=>{const {model,camera}=lake();const p=W.prewarmLakesideWaterDraw(camera,water,W.lakesideWaterSourceRenderer(model,isWater));const n=p.node();
 p.cancel();assert.equal(n.destroyed,1);await draw();await draw();assert.equal(await p.done,false);assert.equal(n.destroyed,1);});
t('no water copy / no mesh / no camera: nothing created, no throw',async()=>{const {model,camera}=lake();const src=W.lakesideWaterSourceRenderer(model,isWater);
 for(const p of [W.prewarmLakesideWaterDraw(camera,null,src),W.prewarmLakesideWaterDraw(camera,water,null),W.prewarmLakesideWaterDraw(null,water,src)]){assert.equal(p.node(),null);assert.equal(await p.done,false);p.cancel();}assert.equal(camera.node.children.length,0);});
t('paused game (no draw event): removed after maxMs anyway',async()=>{const {model,camera}=lake();const p=W.prewarmLakesideWaterDraw(camera,water,W.lakesideWaterSourceRenderer(model,isWater),{afterDraw:()=>new Promise(()=>{}),maxMs:5});const n=p.node();assert.equal(await p.done,true);assert.equal(n.destroyed,1);});
t('ordering: prewarm runs on the first show(true) right after prime(), under the set-off black, before the fade-in and any walked frame; freed on release',async()=>{
 const rd=f=>fs.readFileSync(S+f,'utf8'),ad=rd('region/RegionJourneyAdapter.ts'),core=rd('world-r1/RegionJourneyCore.ts'),prep=ad.slice(ad.indexOf('async function prepareLakesideJourney'));
 assert.match(prep,/show\(visible\)\{if\(dead\)return;rig\.active=visible;if\(visible\)\{atmosphere\.prime\(\);warmWater\(\);\}\}/);
 assert.match(prep,/const warmWater=\(\)=>\{if\(warm\|\|dead\|\|!journeyWater\)return;warm=prewarmLakesideWaterDraw\(camera,journeyWater,lakesideWaterSourceRenderer\(lakeModel,isLakesideWaterNode\)\);\};/);
 assert.match(prep,/useLakesideWater\(model,water\);[\s\S]{0,200}journeyWater=water;\}/,'the journey copy, after it is on the lake');
 assert.doesNotMatch(prep.slice(prep.indexOf('progress(d)')),/warmWater\(\)/,'not from the walk');
 assert.match(prep,/const release=\(\)=>\{if\(dead\)return;dead=true;offWater\(\);atmosphere\.restore\(\);releaseLakesideBoardPreload\(\)[^;]*;warm\?\.cancel\(\)/);
 const black=core.indexOf("this.fadeState='black'"),show=core.indexOf('this.show(true);',black),fadeIn=core.indexOf("this.fadeState='in'",black);
 assert(black>0&&show>black&&fadeIn>show,'show(true) happens under full black, before the fade-in');});
(async()=>{let fail=0;for(const [n,f] of tests){try{await f();console.log('PASS',n);}catch(e){fail++;console.log('FAIL',n,'\n',e.stack||e);}}
 console.log(fail?'FAIL '+fail:'lakeside journey water prewarm OK');process.exit(fail?1:0);})();
