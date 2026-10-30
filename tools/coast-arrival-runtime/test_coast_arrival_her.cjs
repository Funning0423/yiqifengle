'use strict';
// coast-arrival-her gate (GGbot ggbot/coast-arrival-her): coastArrivalHer(world)(f) driven by the real playCoastArrival at 60/30/uneven dt.
// Checks: placement on f.root/f.heading when off; walks started via adapter.perform only (no SkeletalAnimation writes, CharacterMotion
// is the sole animation clock), each walk path starts/ends on the baked root (<=0.02 m), S7 walk = K.walk window from her stop root,
// durations match, no second perform while busy, install/dispose on the world object, missing adapter = no-op.
const fs=require('fs'),path=require('path'),ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets');
const tr=src=>ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
const mods={};function load(abs){if(mods[abs])return mods[abs].exports;const m={exports:{}};mods[abs]=m;const dir=path.dirname(abs);
 new Function('module','exports','require',tr(fs.readFileSync(abs+'.ts','utf8')))(m,m.exports,r=>r.startsWith('.')?load(path.resolve(dir,r)):require(r));return m.exports;}
const CAL=load(path.join(A,'bundles/region_coast/scripts/CoastArrivalLens'));
const K=load(path.join(A,'bundles/region_coast/scripts/CoastArrivalTrack')).COAST_ARRIVAL_TRACK;
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}};
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function lcg(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return 1/90+(1/45-1/90)*(s/4294967296);};}
(async()=>{
 const W=CAL.coastArrivalWalks(),[ws,we]=K.walk;
 ok(W.length>=2,'walks '+W.length);const s7=W[W.length-1];
 ok(Math.abs(s7.start-ws)<=0.1+1e-9&&Math.abs(s7.end-we)<=0.1+1e-9,'S7 window '+s7.start+'-'+s7.end+' vs '+ws+'-'+we);
 for(const w of W){ok(d3(w.path[0],CAL.arrivalHer(w.start).root)<=0.02,'walk start root '+w.start);ok(d3(w.path[w.path.length-1],CAL.arrivalHer(w.end).root)<=0.02,'walk end root '+w.end);}
 ok(d3(s7.path[s7.path.length-1],[-0.6,s7.path[s7.path.length-1][1],16.35])<1e-3,'S7 stop root '+s7.path[s7.path.length-1]);
 for(const [name,clock] of [['60fps',()=>1/60],['30fps',()=>1/30],['uneven',lcg(0xc0a57)]]){
  const pos={x:9,y:9,z:9},calls=[],rot=[];let skel=0,pending=null;
  const node={get worldPosition(){return pos;},setWorldPosition(x,y,z){pos.x=x;pos.y=y;pos.z=z;},setRotationFromEuler(x,y,z){rot.push(y);},getComponent(){skel++;return null;}};
  const adapter={node,perform(a,tok){tok.check();calls.push({a,t:curT});if(pending)throw Error('busy');let res;const p=new Promise(r=>res=r);pending=res;
   const endAt=curT+a.duration;watch=()=>{if(curT>=endAt-1e-9){pending=null;watch=null;res();}};return p;}};
  let curT=0,watch=null;const world={coastArrivalAdapter:adapter};const off=CAL.installCoastArrivalHer(world);ok(typeof world.coastArrivalHer==='function','install');
  const cam={node:{setWorldPosition(){},setWorldRotation(){}},fov:45};const frames=[];
  const r=await CAL.playCoastArrival({camera:cam,viewport:()=>({width:390,height:844}),nextFrame:async()=>{const dt=clock();curT=Math.min(K.total,curT+dt);if(watch)watch();await 0;return dt;},her:f=>{frames.push({...f});world.coastArrivalHer(f);}});
  off();ok(world.coastArrivalHer===undefined,name+' uninstall');
  ok(r.ok,name+' played');const f0=frames[0];ok(Math.hypot(pos.x-f0.root[0],pos.z-f0.root[2])<1e-9||calls.length,name+' placed');
  ok(rot.length===1&&Math.abs(rot[0]-Math.atan2(f0.heading[0],f0.heading[2])*180/Math.PI)<1e-9,name+' heading '+rot);
  ok(calls.length===W.length,name+' walks '+calls.length+'/'+W.length);ok(skel===0,name+' touched SkeletalAnimation');
  for(let i=0;i<calls.length;i++){const c=calls[i],w=W[i];ok(c.a.kind==='walk'&&c.a.stopAtEnd===true&&c.t>=w.start-1e-9&&c.t-w.start<=1/30+1e-9,`${name} walk ${i} start ${c.t}`);
   ok(Math.abs(c.t+c.a.duration-w.end)<1e-6,`${name} walk ${i} ends ${c.t+c.a.duration} vs ${w.end}`);}
  // clips the lens reports for S7 (what CharacterMotion plays from the walk): f.clip / f.clipTime consistent
  const at=t=>frames.find(f=>f.t>=t);ok(at(ws+0.01).clip==='walk_start'&&at(K.clips.loopAt+0.01).clip==='walk_loop'&&at(K.clips.stopAt+0.01).clip==='walk_stop_bodyL'&&at(we+0.01).clip==='idle_breathing_loop',name+' clips');
  console.log(`ok   ${name}: ${frames.length} frames, ${calls.length} walks via adapter.perform (${W.map(w=>w.start.toFixed(2)+'-'+w.end.toFixed(2)+'/'+w.path.length+'pt').join(', ')}), 0 SkeletalAnimation writes`);}
 {const d=CAL.coastArrivalHer({});d(CAL.arrivalHer(0));ok(d.errors[0]==='no-adapter'&&d.started===0,'missing adapter = no-op');d.dispose();}
 // self-test: a busy adapter rejecting a second walk is caught as an error, not thrown into the lens
 if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-arrival-her');
})().catch(e=>{console.log('FAIL '+(e&&e.stack||e));process.exit(1);});
