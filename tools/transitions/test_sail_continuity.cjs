#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const boot=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');
const section=boot.slice(boot.indexOf('class FlowReferenceStandin'),boot.indexOf("@ccclass('WorldIntegrationBoot')"));
assert(section.includes('scene.addChild(reference)')||boot.includes('scene.addChild(reference)'),'reference is parented to the scene in mountWorld');
const adapter=fs.readFileSync(path.join(S,'region/RegionJourneyAdapter.ts'),'utf8');
assert(!/find\(options\.parent,'FLOW_REFERENCE_PLACEHOLDER_NOT_B'\)/.test(adapter),'rider lookup must not stop at WorldFlowOwner');
assert(adapter.includes('director.getScene')||adapter.includes('parent.scene'),'rider lookup walks the scene');
const ride=fs.readFileSync(path.join(S,'region/SailRide.ts'),'utf8');
assert(ride.includes('sail-rider-missing'),'missing rider is an error');
assert(ride.includes('depart('),'departure is gated');
assert(!ride.includes('duration:7.6'),'dock is not a fixed 7.6 s walk');
assert(!/Date\.now\(\)-t0/.test(ride),'arrival camera does not use a second wall clock');
function load(rel,req){const file=path.join(S,rel);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:req||(()=>({})),console},{filename:file});return m.exports;}
const layout=load('region/RegionJourneyLayout.ts');
const landing=load('region/SailLanding.ts');
const leg=load('region/TransportLeg.ts',spec=>spec.includes('Layout')?layout:spec.includes('SailLanding')?landing:{});
const route=leg.sailRoute();
const tl=leg.sailBeats(route.length);
const sc=tl.beats.find(b=>b.id==='S-c'),se=tl.beats.find(b=>b.id==='S-e');
assert(leg.sailPresentationT(3,null,sc.t0,se.t1,tl.build05S,10)<sc.t0,'hull stays put before depart');
assert(leg.sailVehicle(tl,route.samples,sc.t0-0.05).speed===0,'no way on before S-c');
const moved=leg.sailPresentationT(sc.t0+1,sc.t0,sc.t0,se.t1,tl.build05S,se.t1-sc.t0);
assert(moved>sc.t0,'clock advances only after depart');
// Scene-shaped lookup: the girl is a sibling of the flow owner, not a descendant.
function find(node,name){if(node.name===name)return node;for(const c of node.children||[]){const h=find(c,name);if(h)return h;}return null;}
const scene={name:'scene',children:[{name:'FLOW_REFERENCE_PLACEHOLDER_NOT_B',children:[]},{name:'IsolatedWorldComposition',children:[{name:'WorldFlowOwner',children:[]}]}]};
const owner=scene.children[1].children[0];
assert.equal(find(owner,'FLOW_REFERENCE_PLACEHOLDER_NOT_B'),null);
assert.equal(find(scene,'FLOW_REFERENCE_PLACEHOLDER_NOT_B').name,'FLOW_REFERENCE_PLACEHOLDER_NOT_B');
const csv=path.join(__dirname,'../../docs/r5/sail-qa1/metrics_after.csv');
if(fs.existsSync(csv)){
 const text=fs.readFileSync(csv,'utf8').trim().split('\n');
 const head=text[0].split(',');
 const col=n=>head.indexOf(n);
 const rows=text.slice(1).map(l=>l.split(','));
 let prev=null,prevBoat=null,sailReal0=null,sailReal1=null,arr0=null,arr1=null,movedBeforeSit=false,seenSeat=false;
 for(const c of rows){
  const t=+c[col('t')],real=+c[col('real')],beat=c[col('beat')],parent=c[col('parent')]||'';
  const gx=+c[col('gx')],gz=+c[col('gz')],renderers=+c[col('girlRenderers')];
  const departed=c[col('departed')]==='1';
  const boatx=+c[col('boatx')],boatz=+c[col('boatz')];
  if(beat!=='arrival'){if(sailReal0==null)sailReal0=real;sailReal1=real;}
  if((beat==='S-c'||beat==='S-d'||beat==='S-e')&&departed){
   seenSeat=true;
   assert(parent.includes('seated_root_anchor'),'girl left the seat during '+beat+' parent '+parent);
   assert(renderers>0,'girl has no renderer during '+beat);
  }
  if(beat==='arrival'){if(arr0==null)arr0=t;arr1=t;}
  if(prev&&Number.isFinite(gx)&&Number.isFinite(prev.gx)){
   const dt=(beat==='arrival'?t-prev.t:real-prev.real);
   if(dt>1e-4&&dt<0.2&&prev.beat===beat&&(beat==='S-a'||beat==='S-b'||beat==='arrival')){
    const sp=Math.hypot(gx-prev.gx,gz-prev.gz)/dt;
    if(prev.sp>0.9&&sp>0.9)assert(Math.abs(sp-prev.sp)/prev.sp<=0.15,'walk speed jump '+prev.sp.toFixed(2)+' -> '+sp.toFixed(2)+' @ '+beat);
    prev={t,real,beat,gx,gz,sp,boatx,boatz};
   }else prev={t,real,beat,gx,gz,sp:0,boatx,boatz};
  }else prev={t,real,beat,gx,gz,sp:0,boatx,boatz};
  if(prevBoat&&!departed&&Number.isFinite(boatx)&&Number.isFinite(prevBoat.x)){
   if(Math.hypot(boatx-prevBoat.x,boatz-prevBoat.z)>0.08)movedBeforeSit=true;
  }
  prevBoat={x:boatx,z:boatz};
  if(col('water')>=0)assert(+c[col('water')]<=0.005,'water in cockpit '+c[col('water')]+' @ '+beat);
  if(col('clearRatio')>=0)assert(+c[col('clearRatio')]<=0.005,'clear-color hole '+c[col('clearRatio')]);
 }
 assert(!movedBeforeSit,'hull moved before she was seated');
 assert(seenSeat,'no seated cruise frames');
 if(sailReal0!=null)assert(sailReal1-sailReal0<=30.5,'sail span '+(sailReal1-sailReal0));
 if(arr0!=null)assert(arr1-arr0<=16.8,'arrival span '+(arr1-arr0));
 const pix=csv.replace(/metrics_/, 'pixels_').replace(/\.csv$/, '.json');
 if(fs.existsSync(pix)){
  const summary=JSON.parse(fs.readFileSync(pix,'utf8'));
  assert(!summary.flicker,'brightness flicker '+JSON.stringify(summary.flickerCells));
  assert(summary.waterMax<=0.005,'water '+summary.waterMax);
  assert(summary.clearMax<=0.005,'clear '+summary.clearMax);
 }
}
console.log(JSON.stringify({status:'PASS',build05S:+tl.build05S.toFixed(3)}));
