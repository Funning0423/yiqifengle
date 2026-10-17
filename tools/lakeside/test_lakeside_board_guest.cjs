// r4-prep B (lead): she stays in frame after landing — the 风铃湖畔 board background carries a frozen copy of her at the spot
// where she stands in the journey copy (same pose, board layer, nothing animating), her own renderers only, destroyed once.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}clone(){return new Vec3(this.x,this.y,this.z);}
 static transformQuat(o,a,q){const ix=q.w*a.x+q.y*a.z-q.z*a.y,iy=q.w*a.y+q.z*a.x-q.x*a.z,iz=q.w*a.z+q.x*a.y-q.y*a.x,iw=-q.x*a.x-q.y*a.y-q.z*a.z;
  o.x=ix*q.w+iw*-q.x+iy*-q.z-iz*-q.y;o.y=iy*q.w+iw*-q.y+iz*-q.x-ix*-q.z;o.z=iz*q.w+iw*-q.z+ix*-q.y-iy*-q.x;return o;}}
class Quat{constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});}clone(){return new Quat(this.x,this.y,this.z,this.w);}
 static invert(o,a){o.x=-a.x;o.y=-a.y;o.z=-a.z;o.w=a.w;return o;}
 static multiply(o,a,b){const x=a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,y=a.w*b.y+a.y*b.w+a.z*b.x-a.x*b.z,z=a.w*b.z+a.z*b.w+a.x*b.y-a.y*b.x,w=a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z;o.x=x;o.y=y;o.z=z;o.w=w;return o;}
 static yaw(deg){const t=deg*Math.PI/360;return new Quat(0,Math.sin(t),0,Math.cos(t));}}
let destroyed=0;
class Component{constructor(){this.enabled=true;}}class MeshRenderer extends Component{}class SkeletalAnimation extends Component{constructor(){super();this.playOnLoad=true;this.useBakedAnimation=false;}}class Script extends Component{}
class Node{constructor(name){this.name=name;this.children=[];this.parent=null;this.layer=1;this.active=true;this.comps=[];this.valid=true;this.position=new Vec3();this.rotation=new Quat();this.scale=new Vec3(1,1,1);}
 get worldPosition(){if(!this.parent)return this.position.clone();const p=new Vec3();Vec3.transformQuat(p,this.position,this.parent.worldRotation);const b=this.parent.worldPosition;return new Vec3(b.x+p.x,b.y+p.y,b.z+p.z);}
 get worldRotation(){if(!this.parent)return this.rotation.clone();const q=new Quat();return Quat.multiply(q,this.parent.worldRotation,this.rotation);}
 get worldScale(){return this.scale.clone();}
 addChild(c){c.parent=this;this.children.push(c);}getChildByName(n){return this.children.find(c=>c.name===n)||null;}
 addComponent(C){const c=new C();c.node=this;this.comps.push(c);return c;}
 getComponentsInChildren(C){const out=[];const walk=n=>{for(const c of n.comps)if(c instanceof C)out.push(c);n.children.forEach(walk);};walk(this);return out;}
 setPosition(p){this.position=new Vec3(p.x,p.y,p.z);}setRotation(q){this.rotation=new Quat(q.x,q.y,q.z,q.w);}setScale(x,y,z){this.scale=new Vec3(x,y,z);}
 destroy(){this.valid=false;destroyed++;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}}
function instantiate(n){const c=new Node(n.name);c.layer=n.layer;c.active=n.active;c.position=n.position.clone();c.rotation=n.rotation.clone();c.scale=n.scale.clone();
 for(const k of n.comps){const o=Object.assign(Object.create(Object.getPrototypeOf(k)),k);o.node=c;c.comps.push(o);}for(const ch of n.children)c.addChild(instantiate(ch));return c;}
let scene;const cc={Component,MeshRenderer,SkeletalAnimation,Node,Quat,Vec3,instantiate,director:{getScene:()=>scene},isValid:o=>!!o&&o.valid!==false};
const out=ts.transpileModule(fs.readFileSync(S+'region/LakesideBoardGuest.ts','utf8'),{compilerOptions:{module:1,target:7}}).outputText;
const G={};vm.runInThisContext('(function(exports,require){'+out+'\n})')(G,s=>s==='cc'?cc:null);
const run=(n,f)=>{f();console.log('PASS',n);};const near=(a,b)=>Math.abs(a-b)<1e-9;
function world(){scene=new Node('scene');const journey=new Node('RegionJourney-lakeside');scene.addChild(journey);const js=new Node('LakesideJourneyScene');journey.addChild(js);
 js.position=new Vec3(6.5,-0.58,44.2);js.rotation=Quat.yaw(180);
 const ref=new Node(G.LAKESIDE_GUEST_SOURCE);scene.addChild(ref);const girl=new Node('B_PASS2G_CURSOR');ref.addChild(girl);girl.addComponent(SkeletalAnimation);
 const body=new Node('body');girl.addChild(body);body.addComponent(MeshRenderer);const apron=new Node('apron');girl.addChild(apron);apron.addComponent(MeshRenderer);const hip=new Node('hip');girl.addChild(hip);hip.rotation=new Quat(.1,0,0,Math.sqrt(1-.01));
 ref.addComponent(Script);
 // she stands at lakeside-local (1.2, 0, 2.5) facing local yaw 30 (world = journey frame x local)
 const lp=new Vec3(1.2,0,2.5),wp=new Vec3();Vec3.transformQuat(wp,lp,js.rotation);ref.position=new Vec3(wp.x+6.5,wp.y-0.58,wp.z+44.2);ref.rotation=Quat.multiply(new Quat(),js.rotation,Quat.yaw(30));
 ref.active=false/* WorldFlow hid her for the level */;
 const rig=new Node('LakesideLiveScene');scene.addChild(rig);const scenery=new Node('LakesideScenery');rig.addChild(scenery);return {ref,scenery,hip,girl};}
run('placement: copy local = journey scene⁻¹ × her world transform (the same spot in the board copy of the scene), scale kept',()=>{
 const w=world(),g=G.mountLakesideGuest(w.scenery,1<<20);assert(g);const c=w.scenery.getChildByName(G.LAKESIDE_GUEST_NODE);assert.equal(c,g.node);
 assert(near(c.position.x,1.2)&&near(c.position.y,0)&&near(c.position.z,2.5),JSON.stringify(c.position));const q=Quat.yaw(30);assert(near(Math.abs(c.rotation.y),Math.abs(q.y))&&near(Math.abs(c.rotation.w),Math.abs(q.w)));
 assert.equal(c.active,true,'shown although the original is hidden');});
run('pose: joints copied as they are; animation off, playOnLoad off, scripts off, renderers on; whole copy on the board layer',()=>{
 const w=world(),g=G.mountLakesideGuest(w.scenery,1<<20),c=g.node;const hip=c.getChildByName('B_PASS2G_CURSOR').getChildByName('hip');assert.deepEqual(hip.rotation,w.hip.rotation);
 const a=c.getComponentsInChildren(SkeletalAnimation);assert.equal(a.length,1);assert.equal(a[0].enabled,false);assert.equal(a[0].playOnLoad,false);assert.equal(a[0].useBakedAnimation,false);
 assert.equal(c.getComponentsInChildren(Script)[0].enabled,false);const r=c.getComponentsInChildren(MeshRenderer);assert.equal(r.length,2);assert(r.every(x=>x.enabled));assert.equal(g.renderers,2,'her own renderers only');
 const all=[];const walk=n=>{all.push(n);n.children.forEach(walk);};walk(c);assert(all.every(n=>n.layer===1<<20));
 assert.equal(w.ref.layer,1,'original untouched');assert.equal(w.ref.active,false);assert.equal(w.girl.getComponentsInChildren(SkeletalAnimation)[0].enabled,true);});
run('free once: dispose destroys the copy exactly once; missing her / journey scene → null, nothing added',()=>{
 const w=world(),g=G.mountLakesideGuest(w.scenery,1<<20);destroyed=0;g.dispose();g.dispose();assert.equal(destroyed,1);assert.equal(w.scenery.children.length,0);
 const w2=world();w2.ref.name='other';assert.equal(G.mountLakesideGuest(w2.scenery,1<<20),null);assert.equal(w2.scenery.children.length,0);
 const w3=world();scene.children[0].children=[];assert.equal(G.mountLakesideGuest(w3.scenery,1<<20),null);});
run('wiring: board lease mounts her after the layer pass, frees her in dispose (once), reports her renderer count',()=>{
 const bg=fs.readFileSync(S+'region/LakesideBoardBackground.ts','utf8');
 assert.match(bg,/setLayer\(scenery\);\n  step='guest';guest=mountLakesideGuest\(scenery,LAKESIDE_LAYER\);/);assert.match(bg,/const dispose=\(\)=>\{if\(dead\)return;restoreDir\(\);dead=true;off\(\);offDayNight\(\);if\(guest\)\{guest\.dispose\(\);guest=null;\}/);
 assert.match(bg,/guest:guest\?guest\.renderers:0/);
 // other regions: their board cameras only see their own layer (by design no girl there)
 for(const f of ['region/MeadowBoardBackground.ts','region/SkycityBoardBackground.ts']){const t=fs.readFileSync(S+f,'utf8');assert.doesNotMatch(t,/mountLakesideGuest/);}});
