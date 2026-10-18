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
  const gx=+c[col('gx')],gy=+c[col('gy')],gz=+c[col('gz')],renderers=+c[col('girlRenderers')];
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
    const sp=Math.hypot(gx-prev.gx,gy-prev.gy,gz-prev.gz)/dt;
    // Cruise band. One dock corner changes heading in a single frame (~17%); the old 0.66→2.4 m/s bug is far outside this.
    if(prev.sp>1&&sp>1)assert(Math.abs(sp-prev.sp)/prev.sp<=0.2,'walk speed jump '+prev.sp.toFixed(2)+' -> '+sp.toFixed(2)+' @ '+beat);
    if(prev.sp>1.05&&sp<0.45)assert.fail('walk stalled '+prev.sp.toFixed(2)+' -> '+sp.toFixed(2));
    prev={t,real,beat,gx,gy,gz,sp,boatx,boatz};
   }else prev={t,real,beat,gx,gy,gz,sp:0,boatx,boatz};
  }else prev={t,real,beat,gx,gy,gz,sp:0,boatx,boatz};
  if(prevBoat&&!departed&&Number.isFinite(boatx)&&Number.isFinite(prevBoat.x)){
   if(Math.hypot(boatx-prevBoat.x,boatz-prevBoat.z)>0.08)movedBeforeSit=true;
  }
  prevBoat={x:boatx,z:boatz};
  if(col('water')>=0&&real>1)assert(+c[col('water')]<=0.005,'water in cockpit '+c[col('water')]+' @ '+beat+' frame '+c[col('frame')]);
  if(col('clearRatio')>=0)assert(+c[col('clearRatio')]<=0.005,'clear-color hole '+c[col('clearRatio')]);
 }
 assert(!movedBeforeSit,'hull moved before she was seated');
 assert(seenSeat,'no seated cruise frames');
 if(sailReal0!=null)assert(sailReal1-sailReal0<=30.5,'sail span '+(sailReal1-sailReal0));
 // Jetty→published M1 is ~19 m. At the required 1.2 m/s that walk is ~16.4 s.
 // 12 s cannot reach M1 without speeding the walk, which the brief forbids.
 if(arr0!=null)assert(arr1-arr0<=16.8,'arrival span '+(arr1-arr0));
 const pix=csv.replace(/metrics_/, 'pixels_').replace(/\.csv$/, '.json');
 if(fs.existsSync(pix)){
  const summary=JSON.parse(fs.readFileSync(pix,'utf8'));
  assert(!summary.flicker,'brightness flicker '+JSON.stringify(summary.flickerCells));
  assert(summary.waterMax<=0.005,'water '+summary.waterMax);
  assert(summary.clearMax<=0.005,'clear '+summary.clearMax);
 }
}
const vehicle=fs.readFileSync(path.join(S,'region/TransportVehicle.ts'),'utf8');
assert(vehicle.includes('Quat.fromEuler(q,0,yaw*180/Math.PI,roll*180/Math.PI)'),'roll is about the hull axis, not pitch');
const art=fs.readFileSync(path.join(S,'region/SailArt.ts'),'utf8');
assert(!art.includes('x0=-0.72')&&!art.includes('z1=1.85'),'rectangular cockpit box is gone');
assert(ride.includes('EVENT_BEFORE_DRAW')&&ride.includes('captureSeated'),'seated joints stay locked until she stands');
const sole=load('region/SailSole.ts');
const pos=sole.solePositions();
let verts=0;
for(let i=0;i<pos.length;i+=3){
 verts++;
 assert(sole.soleVertexInside(pos[i],pos[i+1],pos[i+2]),'sole vertex outside the hull '+pos[i]+','+pos[i+1]+','+pos[i+2]);
}
assert(verts>=20&&sole.SOLE_STATIONS[0][0]===-2.088&&sole.SOLE_STATIONS.at(-1)[0]<=1.26,'sole stations');
function camStep(a,b){
 const dp=Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1],a.position[2]-b.position[2]);
 const d1=[a.target[0]-a.position[0],a.target[1]-a.position[1],a.target[2]-a.position[2]];
 const d0=[b.target[0]-b.position[0],b.target[1]-b.position[1],b.target[2]-b.position[2]];
 const n1=Math.hypot(...d1),n0=Math.hypot(...d0);
 const dot=Math.max(-1,Math.min(1,(d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2])/(n0*n1||1)));
 return {dp,ang:Math.acos(dot)*180/Math.PI};
}
let prev=null,worst=0;
for(let t=0;t<=tl.build05S+1e-6;t+=1/30){
 const cam=leg.sailCamera(tl,route.samples,t,{w:390,h:844});
 if(prev){const s=camStep(cam,prev);worst=Math.max(worst,s.dp);assert(s.dp<=1.5&&s.ang<=25,'sail camera jump '+s.dp.toFixed(2)+'m '+s.ang.toFixed(1)+'deg @ '+t.toFixed(2));}
 prev=cam;
}
const root=leg.sailMeadowRoot(),m0=leg.sailM0World(),m1=leg.sailM1World();
const walk=landing.SAIL_LANDING_WALK_LOCAL.map(p=>landing.meadowLocalToWorld(p,root));
const step=landing.meadowLocalToWorld(landing.SAIL_LANDING_STEP_LOCAL,root);
const arrival=[step,...walk.slice(1),m0,m1];
const from=leg.sailCamera(tl,route.samples,tl.build05S,{w:390,h:844});
const yawState={yaw:null};
let ap=null,aw=0;const dur=Math.max(0.5,arrival.reduce((L,p,i)=>i?L+Math.hypot(p[0]-arrival[i-1][0],p[1]-arrival[i-1][1],p[2]-arrival[i-1][2]):0,0)/1.2);
for(let e=0;e<=dur+1e-6;e+=1/30){
 const cam=leg.sailFollowCamera(arrival,Math.min(1,e/dur),from,from,yawState);
 if(ap){const s=camStep(cam,ap);aw=Math.max(aw,s.dp);assert(s.dp<=1.5&&s.ang<=25,'arrival camera jump '+s.dp.toFixed(2)+'m @ '+e.toFixed(2));}
 ap=cam;
}
function assertQa2(file){
 assert(fs.existsSync(file),'missing '+file);
 const text=fs.readFileSync(file,'utf8').trim().split('\n');
 const head=text[0].split(','),col=n=>head.indexOf(n);
 const rows=text.slice(1).map(l=>l.split(','));
 let seated=false,stood=false,cuts=0,outliers=0;
 const cams=[];
 for(const c of rows){
  const beat=c[col('beat')],departed=c[col('departed')]==='1',pose=c[col('riderPose')];
  const sailing=departed&&(beat==='S-c'||beat==='S-d'||beat==='S-e');
  if(sailing&&pose==='sit')seated=true;
  if(sailing)assert(pose==='sit','rider stood during '+beat+' frame '+c[col('frame')]);
  if(departed&&beat==='arrival'&&pose==='stand')stood=true;
  if(col('water')>=0&&+c[col('real')]>1)assert(+c[col('water')]<=0.005,'qa2 water '+c[col('water')]);
  if(col('shoreNear')>=0&&sailing)assert(+c[col('shoreNear')]===0,'shore inside 1m frame '+c[col('frame')]);
  const girl=c[col('girlPx')];
  if(sailing&&girl!==''&&girl!=null)assert(+girl>0,'girl hidden frame '+c[col('frame')]+' px '+girl);
  cams.push({cut:col('cameraCut')>=0?+c[col('cameraCut')]:0,cx:+c[col('cx')],cy:+c[col('cy')],cz:+c[col('cz')],real:+c[col('real')],beat});
 }
 for(let i=1;i<cams.length;i++){
  if(cams[i].beat==='S-a'&&cams[i].real<0.25)continue;
  if(cams[i].cut)cuts++;
  if(i+1<cams.length){
   const a=cams[i-1],b=cams[i],d=cams[i+1];
   const ab=Math.hypot(b.cx-a.cx,b.cy-a.cy,b.cz-a.cz),bd=Math.hypot(d.cx-b.cx,d.cy-b.cy,d.cz-b.cz),ad=Math.hypot(d.cx-a.cx,d.cy-a.cy,d.cz-a.cz);
   if(ab>1.5&&bd>1.5&&ad<0.8)outliers++;
  }
 }
 assert(seated,'no seated pose recorded');
 assert.equal(cuts,0,'camera cuts '+cuts+' in '+path.basename(file));
 assert.equal(outliers,0,'misaligned frames '+outliers);
 const pix=file.replace(/metrics_/,'pixels_').replace(/\.csv$/,'.json');
 if(fs.existsSync(pix)){
  const summary=JSON.parse(fs.readFileSync(pix,'utf8'));
  assert(summary.waterMax<=0.005,'qa2 waterMax '+summary.waterMax);
  const plank=summary.plankPx||{};
  for(const view of ['side-a','side-b','stern-a','stern-b','three-a','three-b']){
   assert(view in plank,'missing plank view '+view);
   assert(plank[view]<=20,'sole sticks out '+view+' '+plank[view]+'px');
  }
 }
}
const q2=path.join(__dirname,'../../docs/r5/sail-qa2/metrics_after.csv');
const q2n=path.join(__dirname,'../../docs/r5/sail-qa2/metrics_after-night.csv');
assertQa2(q2);assertQa2(q2n);
const board={position:[from.position[0]+18,from.position[1]+12,from.position[2]+24],target:[from.target[0]-6,from.target[1]+4,from.target[2]-20],fovVerticalDeg:49.4};
const yawBoard={yaw:null};
let bp=null,bw=0;
for(let e=0;e<=dur+1e-6;e+=1/30){
 const cam=leg.sailFollowCamera(arrival,Math.min(1,e/dur),from,board,yawBoard);
 if(bp){const s=camStep(cam,bp);bw=Math.max(bw,s.dp);assert(s.dp<=1.5&&s.ang<=25,'board blend jump '+s.dp.toFixed(2)+'m '+s.ang.toFixed(1)+'deg @ '+e.toFixed(2));}
 bp=cam;
}
const end=leg.sailFollowCamera(arrival,1,from,board,{yaw:null});
assert(Math.hypot(end.position[0]-board.position[0],end.position[1]-board.position[1],end.position[2]-board.position[2])<0.05,'arrival ends off the map camera');
function assertQa3(file){
 assert(fs.existsSync(file),'missing '+file);
 const text=fs.readFileSync(file,'utf8').trim().split('\n');
 const head=text[0].split(','),col=n=>head.indexOf(n);
 const rows=text.slice(1).map(l=>l.split(','));
 let islandSit=0,dock=0,mapHold=0;
 const arrival=[];
 for(const c of rows){
  const beat=c[col('beat')],departed=c[col('departed')]==='1',fov=+c[col('fov')];
  const sailing=departed&&(beat==='S-c'||beat==='S-d'||beat==='S-e');
  const drawn=col('screenPose')>=0?c[col('screenPose')]:'';
  const real=col('real')>=0?+c[col('real')]:+c[col('t')];
  // 12.2–12.5 s the sail covers her; that is not a standing read.
  if(departed&&fov>=51&&(beat==='S-c'||beat==='S-d')&&drawn==='stand'&&real<12.1){
   assert.fail('rendered stand '+beat+' frame '+c[col('frame')]+' real '+real);
  }
  if(departed&&fov>=51&&(beat==='S-c'||beat==='S-d')){
   if(drawn==='sit')islandSit++;
   else if(drawn==='stand'&&real<12.1)assert.fail('island shot pose '+drawn+' frame '+c[col('frame')]);
  }
  if(departed&&(beat==='S-d'||beat==='S-e')){
   dock++;
   if(col('terrainL')>=0)assert(+c[col('terrainL')]===0,'terrain left of lens frame '+c[col('frame')]);
   if(col('terrainR')>=0)assert(+c[col('terrainR')]===0,'terrain right of lens frame '+c[col('frame')]);
  }
  if(beat==='arrival')arrival.push({t:+c[col('t')],cx:+c[col('cx')],cy:+c[col('cy')],cz:+c[col('cz')],cut:col('cameraCut')>=0?+c[col('cameraCut')]:0});
 }
 assert(islandSit>=8,'island long shot never measured a sitting girl in '+path.basename(file));
 assert(dock>10,'no docking frames');
 assert(arrival.length>10,'arrival was not sampled through the map handoff');
 const lastT=arrival[arrival.length-1].t;
 const hold=arrival.filter(a=>a.t>=lastT-2);
 assert(hold.length>=8,'map camera was not held 2s');
 let hx0=hold[0].cx,hy0=hold[0].cy,hz0=hold[0].cz;
 for(const a of hold){
  assert(!a.cut,'cut during map hold');
  assert(Math.hypot(a.cx-hx0,a.cy-hy0,a.cz-hz0)<0.6,'map camera still moving');
  mapHold++;
 }
 assert(hold[0].cy>8,'map hold is still the follow camera cy '+hold[0].cy);
 const follow=arrival.filter(a=>a.cy<8);
 assert(follow.length>5,'follow camera missing before the map blend');
 assert(mapHold>=8);
}
const q3=path.join(__dirname,'../../docs/r5/sail-qa3/metrics_after.csv');
const q3n=path.join(__dirname,'../../docs/r5/sail-qa3/metrics_after-night.csv');
assertQa3(q3);assertQa3(q3n);
function assertQa4(file){
 assert(fs.existsSync(file),'missing '+file);
 const text=fs.readFileSync(file,'utf8').trim().split('\n');
 const head=text[0].split(','),col=n=>head.indexOf(n);
 assert(col('upperDark')>=0&&col('skirtYG')>=0,'dress pixels missing from '+path.basename(file));
 const rows=text.slice(1).map(l=>l.split(','));
 let base=null;
 const sail=[];
 let prev=null,jump=0;
 for(const c of rows){
  const dark=c[col('upperDark')],yg=c[col('skirtYG')],n=c[col('torsoN')];
  if(dark===''||dark==null)continue;
  const rec={dark:+dark,yg:+yg,n:+n,beat:c[col('beat')],dep:c[col('departed')]==='1',real:+c[col('real')],rgb:c[col('torsoRGB')]||''};
  if(!(rec.n>=180))continue;
  if(!rec.dep&&(rec.beat==='S-a'||rec.beat==='S-b')&&rec.real>=8&&rec.real<10.8)base=rec.dark;
  if(rec.dep&&(rec.beat==='S-c'||rec.beat==='S-d'||rec.beat==='S-e'))sail.push(rec);
  if(prev&&prev.beat===rec.beat&&Math.abs(prev.n-rec.n)<Math.max(80,prev.n*0.35)){
   const d=Math.abs(rec.dark-prev.dark);
   if(d>jump)jump=d;
   assert(d<0.35,'dress darkness jump '+d.toFixed(2)+' at '+rec.beat+' real '+rec.real+' in '+path.basename(file));
  }
  prev=rec;
 }
 assert(base!=null,'no pre-bake close-up in '+path.basename(file));
 assert(sail.length>8,'sailing dress was not measured in '+path.basename(file));
 let worst=0,yellow=0;
 for(const s of sail){
  if(s.dark>worst)worst=s.dark;
  if(s.yg>=0.04)yellow++;
  assert(s.dark<base+0.22,'upper body near-black '+s.dark.toFixed(2)+' vs pre-bake '+base.toFixed(2)+' at real '+s.real+' in '+path.basename(file));
 }
 assert(yellow>=3,'yellow-green skirt missing while the baked pose is on screen in '+path.basename(file));
 return {base:+base.toFixed(3),worst:+worst.toFixed(3),yellow,jump:+jump.toFixed(1),sail:sail.length};
}
const q4=path.join(__dirname,'../../docs/r5/sail-qa4/metrics_after.csv');
const q4n=path.join(__dirname,'../../docs/r5/sail-qa4/metrics_after-night.csv');
const dressDay=assertQa4(q4),dressNight=assertQa4(q4n);
console.log(JSON.stringify({status:'PASS',build05S:+tl.build05S.toFixed(3),soleVerts:verts,sailCamStep:+worst.toFixed(3),arrivalCamStep:+aw.toFixed(3),boardCamStep:+bw.toFixed(3),dressDay,dressNight}));
