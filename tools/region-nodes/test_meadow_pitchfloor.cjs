'use strict';
// 运镜bot r5 meadow pitch floor: pitchMin(d) = -8 - 4 * smoothstep(3.2, 14, d) on the meadow free camera only.
//   node test_meadow_pitchfloor.cjs   (prints a JSON report; asserts)
// 1. Curve values (±0.01°). 2. Every other place: no pitchFloor, floor == pitchMinDeg at every distance.
// 3. Behaviour vs FreeOrbit @6eafc35f (git show; skipped with a note if git is unavailable): seeded random input scripts
//    (drag, pinch, release, step, solve with boxes, pause/return) per place; outputs must be bit-identical everywhere but
//    the meadow. Home is the room and follows r10 (6e18f6ca), not the r6 pose. 4. Outdoor regression baseline (fixtures/room-keepinside/outdoor_solve_baseline.json): direct solves, and
//    the same cases after 2 s of steps in free mode (where the floor and its ease act). 5. Pinch-in ease: no snap, no
//    overshoot past the floor, pitch accel <= PITCH_FLOOR_FEEL.accDegS2 (<= 120 °/s², HANDOFF §4) at 30/60/120 fps.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {load,ROOT}=require('./load.cjs');
const C=load('region/FreeOrbit.ts'),M=C.ORBIT_LIMITS.meadow,out={};
// 1) curve
const want=[[3.2,-8.00],[5,-8.30],[7,-9.14],[9,-10.22],[11,-11.25],[14,-12.00],[20,-12.00],[2,-8.00]];
out.curve=want.map(([d,w])=>{const g=C.orbitPitchFloor(M,d);assert.ok(Math.abs(g-w)<=0.01,'pitchMin('+d+') = '+g+', want '+w);return {d,got:+g.toFixed(4),want:w}});
for(let d=M.distMin;d<M.distMax;d+=0.01)assert.ok(C.orbitPitchFloor(M,d+0.01)<=C.orbitPitchFloor(M,d)+1e-12,'floor falls monotonically with distance');
assert.equal(M.pitchMinDeg,-12,'meadow absolute floor stays -12');
// 2) other places
const places=Object.keys(C.ORBIT_LIMITS);
for(const id of places){if(id==='meadow')continue;const L=C.ORBIT_LIMITS[id];assert.equal(L.pitchFloor,undefined,id+' has no pitch floor');
 for(let d=0;d<=60;d+=0.5)assert.equal(C.orbitPitchFloor(L,d),L.pitchMinDeg,id+' floor is pitchMinDeg')}
// 3) behaviour vs the base commit
function showOrbit(rev){const src=cp.execFileSync('git',['show',rev+':creator-build-project/assets/scripts/region/FreeOrbit.ts'],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore']});
 const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'fo-base-')),'FreeOrbit.ts');fs.writeFileSync(f,src);return load(f)}
let B=null,R10=null;try{B=showOrbit('6eafc35f')}catch(e){out.baseCompare='skipped: '+e.message.split('\n')[0]}
try{R10=showOrbit('6e18f6ca')}catch(e){out.roomCompare='skipped: '+e.message.split('\n')[0]}
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function script(K,place,seed){const r=rng(seed),o=new K.FreeOrbit(place),feet=[r()*4-2,r(),r()*4-2],trace=[];const fps=[30,60,120][seed%3],dt=1/fps;
 const boxes=[];for(let i=0;i<3;i++){const c=[r()*16-8,r()*3,r()*16-8];boxes.push({min:[c[0]-1,c[1]-1,c[2]-1],max:[c[0]+1,c[1]+1,c[2]+1]})}
 if(r()<0.5)o.seed({position:[feet[0]+r()*8-4,feet[1]+r()*4-1,feet[2]+r()*8-4],target:[feet[0],feet[1]+1.1,feet[2]],fovVerticalDeg:45},feet);
 for(let i=0;i<240;i++){const a=r();
  if(a<0.35)o.drag((r()-0.5)*0.08,(r()-0.5)*0.08,dt);else if(a<0.5)o.pinch(0.8+r()*0.45);else if(a<0.6)o.release();
  else if(a<0.61&&o.mode==='free')o.pause();else if(a<0.62&&o.mode==='paused')o.beginReturn({position:[feet[0]+5,feet[1]+2,feet[2]+3],target:[feet[0],feet[1]+1,feet[2]],fovVerticalDeg:44});
  o.step(dt);const p=o.solve(feet,boxes,feet[1]);trace.push([o.mode,o.yaw,o.pitch,o.dist,p.position[0],p.position[1],p.position[2],p.target[0],p.target[1],p.target[2],p.fovVerticalDeg])}
 return trace}
if(B){out.baseCompare={};for(const id of places){if(id==='home')continue;let changed=0;const N=60;
  for(let s=1;s<=N;s++){const a=JSON.stringify(script(C,id,s*7919+id.length)),b=JSON.stringify(script(B,id,s*7919+id.length));if(a!==b)changed++}
  out.baseCompare[id]={scripts:N,changed};if(id!=='meadow')assert.equal(changed,0,id+' behaviour changed in '+changed+' of '+N+' scripts')}
 // home (room look) follows r10, not the r6 pose at 6eafc35f
 const W=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/room-keepinside/world_boxes.json'),'utf8')).boxes,seat=[0.4327,0,-4.2076];let hc=0;
 if(R10){for(let s=1;s<=20;s++){const run=K=>{const r=rng(s),o=new K.FreeOrbit('home'),t=[];for(let i=0;i<180;i++){if(r()<0.5)o.drag((r()-0.5)*0.06,(r()-0.5)*0.06,1/60);else if(r()<0.6)o.pinch(0.9+r()*0.2);else o.release();o.step(1/60);const p=o.solve(seat,W,0);t.push([o.yaw,o.pitch,o.dist,p.position,p.target])}return JSON.stringify(t)};if(run(C)!==run(R10))hc++}
  out.baseCompare.home={against:'6e18f6ca',scripts:20,changed:hc};assert.equal(hc,0,'home behaviour drifted from r10')}
 else out.baseCompare.home=out.roomCompare||'skipped'}
// 4) outdoor regression baseline
const BASE=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/room-keepinside/outdoor_solve_baseline.json'),'utf8')).cases;
const WORLD=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/room-keepinside/world_boxes.json'),'utf8')).boxes.filter(b=>!/^env_int|interior|lighthouse/.test(b.name)).map(b=>({min:b.min,max:b.max}));
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function reg(settle){const per={},list=[];for(const c of BASE){const o=new C.FreeOrbit(c.place);o.yaw=c.yaw;o.pitch=c.pitch;o.dist=c.dist;
  if(settle){o.mode='free';for(let i=0;i<120;i++)o.step(1/60)}
  const p=o.solve(c.feet,WORLD.concat(c.boxes),c.groundY,c.xz||undefined),d=Math.max(d3(p.position,c.expect.position),d3(p.target,c.expect.target));
  per[c.place]=per[c.place]||{cases:0,changed:0};per[c.place].cases++;if(d>1e-9){per[c.place].changed++;list.push({place:c.place,pitch:+c.pitch.toFixed(3),dist:+c.dist.toFixed(3),floor:+C.orbitPitchFloor(C.ORBIT_LIMITS[c.place],c.dist).toFixed(3),pitchAfter:+o.pitch.toFixed(3),moveM:+d.toFixed(4)})}}
 return {per,list}}
out.outdoorDirect=reg(false);out.outdoorSettled=reg(true);
for(const k of ['outdoorDirect','outdoorSettled'])for(const [id,v] of Object.entries(out[k].per))if(id!=='meadow')assert.equal(v.changed,0,k+' '+id+' changed');
assert.equal(out.outdoorDirect.per.meadow.changed,0,'a direct solve does not clamp (the floor acts through input and step)');
for(const c of out.outdoorSettled.list)assert.ok(c.pitch<c.floor&&Math.abs(c.pitchAfter-c.floor)<1e-9,'only cases below the floor change, and they end on it');
// 5) pinch-in ease
const F=C.PITCH_FLOOR_FEEL,feet=[0,0,0];assert.ok(F.accDegS2<=120&&F.brakeDegS2<=F.accDegS2/2);
function ease(fps,pinchS,from,to){const o=new C.FreeOrbit('meadow'),dt=1/fps;o.dist=from;o.drag(0,5,dt);o.release();for(let i=0;i<10;i++)o.step(dt);
 const p0=o.pitch;assert.ok(Math.abs(p0-C.orbitPitchFloor(M,from))<1e-9,'drag down stops on the floor');
 const P=[p0],FL=[o.pitchFloorDeg],V=[];const n=Math.max(1,Math.round(pinchS/dt)),sc=Math.pow(from/to,1/n);
 const view=()=>{const q=o.solve(feet,[],-50),d=[0,1,2].map(k=>q.target[k]-q.position[k]),m=Math.hypot(...d);return Math.asin(d[1]/m)*180/Math.PI};V.push(view());
 for(let i=0;i<n;i++){o.pinch(sc);if(i%5===0)o.drag(0,0.01,dt);o.step(dt);P.push(o.pitch);FL.push(o.pitchFloorDeg);V.push(view())}   // keeps trying to look further up/down: drag down is blocked while easing
 o.release();for(let i=0;i<Math.round(2.5/dt);i++){o.step(dt);P.push(o.pitch);FL.push(o.pitchFloorDeg);V.push(view())}
 let acc=0,va=0,step=0,over=0;for(let i=1;i<P.length;i++){step=Math.max(step,Math.abs(P[i]-P[i-1]));over=Math.max(over,P[i]-FL[i]);if(i<P.length-1){acc=Math.max(acc,Math.abs(P[i+1]-2*P[i]+P[i-1])/dt/dt);va=Math.max(va,Math.abs(V[i+1]-2*V[i]+V[i-1])/dt/dt)}}
 const end=P[P.length-1],tEnd=(P.findIndex((p,i)=>i>0&&Math.abs(p-FL[i])<1e-6&&P.slice(i).every((q,k)=>Math.abs(q-FL[i+k])<1e-6)))*dt;
 return {fps,pinchS,from,to:+o.dist.toFixed(2),startPitch:+p0.toFixed(3),endPitch:+end.toFixed(3),floorEnd:+o.pitchFloorDeg.toFixed(3),peakPitchAccDegS2:+acc.toFixed(2),peakViewAccDegS2:+va.toFixed(2),maxStepDeg:+step.toFixed(4),maxAboveFloorDeg:+over.toFixed(6),onFloorAfterS:+tEnd.toFixed(3)}}
out.ease=[];for(const fps of [30,60,120])for(const [s,a,b] of [[0.1,14,3.2],[0.3,14,4],[1.5,14,4],[0.5,9,3.5]]){const r=ease(fps,s,a,b);out.ease.push(r);
 assert.ok(r.peakPitchAccDegS2<=F.accDegS2+1e-6,'ease accel '+r.peakPitchAccDegS2);assert.ok(r.peakViewAccDegS2<=F.accDegS2+0.5,'view accel '+r.peakViewAccDegS2);
 assert.ok(r.maxStepDeg<=F.vMaxDegS/fps+1e-9,'no snap: '+r.maxStepDeg+'° in one frame');assert.ok(r.maxAboveFloorDeg<=1e-9,'no overshoot past the floor');
 assert.ok(Math.abs(r.endPitch-r.floorEnd)<1e-6,'ends on the floor')}
out.peakEaseAccDegS2=Math.max(...out.ease.map(r=>r.peakPitchAccDegS2));
// drag up while easing lifts; pinch out lowers the floor and leaves the pitch where it is
{const o=new C.FreeOrbit('meadow');o.dist=14;o.drag(0,5);o.pinch(14/3.2);o.step(1/60);const a=o.pitch;o.drag(0,-0.05);assert.ok(o.pitch>a,'drag up lifts while easing');
 for(let i=0;i<200;i++)o.step(1/60);o.release();for(let i=0;i<200;i++)o.step(1/60);const b=o.pitch;o.pinch(0.3);for(let i=0;i<120;i++)o.step(1/60);assert.equal(o.pitch,b,'pinch out does not move the pitch')}
console.log(JSON.stringify(out,null,1));console.log('meadow-pitchfloor PASS');
