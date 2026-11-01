#!/usr/bin/env node
'use strict';
/** K2 hull stays inside the 390×844 frame; K7 stars are a few pixels in the sky; night sail is dimmer than day. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const {load:loadGlb}=require('../journey-integration/occlusion/lib-glb.cjs');
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const BUNDLE=path.resolve(__dirname,'../../creator-build-project/assets/bundles/transport_sail');
function load(rel,req){
 const file=path.join(S,rel);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:req||(()=>{}),console},{filename:file});return m.exports;
}
const layout=load('region/RegionJourneyLayout.ts');
const landing=load('region/SailLanding.ts');
const leg=load('region/TransportLeg.ts',spec=>spec.includes('RegionJourneyLayout')?layout:spec.includes('SailLanding')?landing:{});
// Live lens (see test_sail_farsea): SailVoyage once enabled by its re-baseline commit, else sailCamera. Thresholds unchanged.
const SV=load('region/SailVoyage.ts',spec=>spec.includes('TransportLeg')?{...leg}:{}),LIVE_VOYAGE=SV.SAIL_VOYAGE.enabled===true,lens=LIVE_VOYAGE?SV.sailVoyageCamera:leg.sailCamera;
const shot=load('region/SailShot.ts',spec=>spec.includes('TransportLeg')?leg:{});
const stars=load('region/SailStars.ts');
const CP=load('world-r1/CameraPose.ts');
const W=390,H=844,aspect=W/H,MARGIN=1-2*0.04;
const luma=([r,g,b])=>0.2126*r+0.7152*g+0.0722*b;
const dayL=luma(stars.SAIL_DAY_SAIL_RGB),nightL=luma(stars.SAIL_NIGHT_SAIL_RGB),ratio=nightL/dayL;
assert(ratio>=0.38&&ratio<=0.48,'night sail tint vs day '+ratio.toFixed(3));
const route=leg.sailRoute(),tl=leg.sailBeats(route.length);
const k2=shot.sailShotTime(2);
assert.equal(k2.night,false);
// b16: K2 still sits in the K2 hold of the eased arc clock (sailStillTimes), not at S-c u≥0.9.
{const h=leg.SAIL_K2_HOLD_S,a=lens(tl,route.samples,k2.t-h*0.45,{w:W,h:H}),b=lens(tl,route.samples,k2.t+h*0.45,{w:W,h:H}),c0=lens(tl,route.samples,k2.t,{w:W,h:H});
 const rel=(c,t)=>{const v=leg.sailVehicle(tl,route.samples,t);return c.position.map((x,i)=>x-v.pos[i]);};
 const d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
 assert(Math.abs(k2.t-leg.sailStillTimes(tl).k2)<1e-9,'K2 still time');
 assert(c0.fovVerticalDeg===a.fovVerticalDeg&&c0.fovVerticalDeg===b.fovVerticalDeg,'K2 still is the held K2 pose (fov)');}
const v=leg.sailVehicle(tl,route.samples,k2.t);
const cam=lens(tl,route.samples,k2.t,{w:W,h:H});
assert(v.speed>2.5,'wake needs way on, speed '+v.speed);
assert(v.sail>0.9,'sails open at K2');
const pose=CP.fromLookAt({position:cam.position,target:cam.target,fovVerticalDeg:cam.fovVerticalDeg});
const yaw=v.yaw,cy=Math.cos(yaw),sy=Math.sin(yaw);
const world=p=>[v.pos[0]+cy*p[0]+sy*p[2],v.pos[1]+p[1],v.pos[2]-sy*p[0]+cy*p[2]];
function ndc(p){return CP.projectPoint(pose,aspect,p);}
const boat=loadGlb(path.join(BUNDLE,'sailboat.glb'));
let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
for(const n of boat){
 if(n.name==='sail_furled'||!n.tris)continue;
 for(let i=0;i<n.tris.length;i+=3)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],n.tris[i+k]);mx[k]=Math.max(mx[k],n.tris[i+k]);}
}
const corners=[];
for(const x of [mn[0],mx[0]])for(const y of [mn[1],mx[1]])for(const z of [mn[2],mx[2]])corners.push(world([x,y,z]));
let maxAbs=0;
const px=[];
for(const p of corners){
 const q=ndc(p);
 assert(q.depth>0.4,'corner behind camera');
 maxAbs=Math.max(maxAbs,Math.abs(q.x),Math.abs(q.y));
 px.push([(q.x+1)/2*W,(1-q.y)/2*H]);
}
assert(maxAbs<=MARGIN+1e-6,'K2 boat corners exceed 4% margin, max |ndc| '+maxAbs.toFixed(3));
const props=loadGlb(path.join(BUNDLE,'transit_sea_props.glb'));
const wake=props.find(n=>n.name==='wake_strips');
assert(wake&&wake.tris,'wake mesh');
let wmn=[1e9,1e9,1e9],wmx=[-1e9,-1e9,-1e9];
for(let i=0;i<wake.tris.length;i+=3)for(let k=0;k<3;k++){wmn[k]=Math.min(wmn[k],wake.tris[i+k]);wmx[k]=Math.max(wmx[k],wake.tris[i+k]);}
// Authored node translation is replaced by setPosition(0,0.03,0) under wake_root (0,0,-2.2).
const origin=[16,0,34];
// K2 check object: sailCamera → the whole wake_strips box; SailVoyage (beam shot) → the boat stern and the wake just behind it
// (wake box clipped to its first 3 m aft of wake_root), i.e. "stern and wake not cropped by the frame edge". Same K2 time,
// same ≥4-of-8 corners at |ndc| ≤ 0.98 and the same stern test below.
if(LIVE_VOYAGE){const lo=Math.max(wmn[2],wmx[2]-3);wmn[2]=lo;}
const wakeCorners=[];
for(const x of [wmn[0],wmx[0]])for(const y of [wmn[1],wmx[1]])for(const z of [wmn[2],wmx[2]]){
 const local=[x-origin[0],0.03+(y-origin[1]),-2.2+(z-origin[2])];
 wakeCorners.push(world(local));
}
let wakeIn=0;
for(const p of wakeCorners){const q=ndc(p);if(q.depth>0.5&&Math.abs(q.x)<=0.98&&Math.abs(q.y)<=0.98)wakeIn++;}
assert(wakeIn>=4,(LIVE_VOYAGE?'stern wake (first 3 m) corners in frame ':'wake corners in frame ')+wakeIn);
const stern=ndc(world([0,0.08,-4]));
assert(stern.depth>0.5&&Math.abs(stern.x)<0.92&&Math.abs(stern.y)<0.92,'wake behind the stern off screen');
const k7=shot.sailShotTime(7);
assert.equal(k7.night,true);
const v7=leg.sailVehicle(tl,route.samples,k7.t);
const cam7=lens(tl,route.samples,k7.t,{w:W,h:H});
const pose7=CP.fromLookAt({position:cam7.position,target:cam7.target,fovVerticalDeg:cam7.fovVerticalDeg});
const placed=stars.sailStarWorld(cam7.position,cam7.target,cam7.fovVerticalDeg,{w:W,h:H});
assert.equal(placed.length,stars.SAIL_STAR_COUNT);
assert(placed.length>=20&&placed.length<=40,'star count');
const screen=[];
for(const star of placed){
 const q=CP.projectPoint(pose7,aspect,star.pos);
 assert(q.depth>1,'star behind camera');
 const x=(q.x+1)/2*W,y=(1-q.y)/2*H;
 assert(x>8&&x<W-8&&y>12&&y<78,'star not in the sky band '+x.toFixed(1)+','+y.toFixed(1));
 const back=norm(sub(cam7.position,star.pos));
 const rx=norm(cross([0,1,0],[-back[0],-back[1],-back[2]]));
 const up=cross([-back[0],-back[1],-back[2]],rx);
 const tip=[star.pos[0]+up[0]*star.radius,star.pos[1]+up[1]*star.radius,star.pos[2]+up[2]*star.radius];
 const qt=CP.projectPoint(pose7,aspect,tip);
 const py=(1-qt.y)/2*H;
 const size=Math.abs(py-y)*2;
 assert(size>=3&&size<=6,'star px '+size.toFixed(2));
 screen.push([x,y,size]);
}
let minSep=1e9;
for(let i=0;i<screen.length;i++)for(let j=i+1;j<screen.length;j++){
 const d=Math.hypot(screen[i][0]-screen[j][0],screen[i][1]-screen[j][1]);
 if(d<minSep)minSep=d;
}
assert(minSep>=8,'stars clump '+minSep.toFixed(1));
const art=fs.readFileSync(path.join(S,'region/SailArt.ts'),'utf8');
assert(art.includes('sailStarWorld')&&art.includes('depthTest:false')&&art.includes("stars.active=false"),'night stars wired');
assert(!/s=0\.012|s=0\.014/.test(art),'old sub-pixel or leftover diamond size');
function norm(a){const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];}
function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
console.log(JSON.stringify({status:'PASS',k2:{t:+k2.t.toFixed(2),tau:+(k2.t-tl.beats.find(b=>b.id==='S-c').t0).toFixed(3),speed:+v.speed.toFixed(2),maxNdc:+maxAbs.toFixed(3),wakeIn},sailLumaRatio:+ratio.toFixed(3),stars:{n:placed.length,minSep:+minSep.toFixed(1),px:[+Math.min(...screen.map(s=>s[2])).toFixed(2),+Math.max(...screen.map(s=>s[2])).toFixed(2)]}}));
