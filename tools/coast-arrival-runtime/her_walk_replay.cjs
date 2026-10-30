'use strict';
/** Her real S7 walk on the runtime path (运镜bot): the REAL FlowReferenceStandin + CharacterMotion (setup = tools/walk-driver/test_walk_driver.cjs
 * prelude, evaluated as-is) performs CoastArrivalLens.coastArrivalWalks()'s S7 walk exactly like coastArrivalHer does
 * (adapter.perform({kind:'walk',path,duration,stopAtEnd:true})), on 60 fps, 30 fps and uneven dt (LCG [1/90,1/45]).
 * Records per frame: t, her root/yaw, the clip CharacterMotion chose, and every rig node's local TRS (for skinning in her_size_runtime.py).
 * usage: node her_walk_replay.cjs <out.json>   (QF_TYPESCRIPT_MODULE required) */
const fs=require('fs'),path=require('path');
const WD=path.resolve(__dirname,'../walk-driver'),src=fs.readFileSync(path.join(WD,'test_walk_driver.cjs'),'utf8');
const pre=src.slice(0,src.indexOf('/** Straight walk at a given speed'))+'\nmodule.exports={makeCharacter,Token,flush,G};';
const m={exports:{}};new Function('module','exports','require','__dirname','__filename',pre)(m,m.exports,r=>require(r.startsWith('.')?path.resolve(WD,r):r),WD,path.join(WD,'test_walk_driver.cjs'));
const {makeCharacter,Token,flush}=m.exports;
const ts=require(process.env.QF_TYPESCRIPT_MODULE),A=path.resolve(__dirname,'../../creator-build-project/assets');
const tr=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
const mods={};function load(abs){if(mods[abs])return mods[abs].exports;const mm={exports:{}};mods[abs]=mm;const dir=path.dirname(abs);new Function('module','exports','require',tr(fs.readFileSync(abs+'.ts','utf8')))(mm,mm.exports,r=>r==='cc'?(globalThis.__yjCcStub||{}):(r.endsWith('/CoastSceneLoader')&&globalThis.__yjSceneStub)?globalThis.__yjSceneStub:r.startsWith('.')?load(path.resolve(dir,r)):require(r));return mm.exports;}
const CAL=load(path.join(A,'bundles/region_coast/scripts/CoastArrivalLens'));
function lcg(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return 1/90+(1/45-1/90)*(s/4294967296);};}
const W=CAL.coastArrivalWalks(),S7=process.env.QF_S7?{...W[W.length-1],start:+process.env.QF_S7.split(",")[0],end:+process.env.QF_S7.split(",")[1]}:W[W.length-1],T0=28.175,T1=Math.max(39.9,S7.end+0.1);
async function replay(name,clock){const c=makeCharacter();const p0=S7.path[0],p1=S7.path[S7.path.length-1],yaw=Math.atan2(p1[0]-p0[0],p1[2]-p0[2]);
 c.s.cancelAndReset({kind:'standing',controllerRoot:[p0[0],p0[1],p0[2]],yawRad:yaw});let t=T0-2;while(t<T0){const dt=clock();c.s.advance(dt);t+=dt;}
 const frames=[];let started=false,pr=null;
 while(t<=T1){if(!started&&t+1e-9>=S7.start){started=true;pr=c.s.perform({kind:'walk',path:S7.path,duration:Math.max(0.35,S7.end-t),stopAtEnd:true},new Token());}
  const n=c.node,d=c.s.diagnostics();frames.push({t:+t.toFixed(5),root:[n.worldPosition.x,n.worldPosition.y,n.worldPosition.z],yaw:n.yaw,clip:d.clip,clipTime:d.time,
   trs:c.rig.nodes.map(q=>[q.position.x,q.position.y,q.position.z,q.rotation.x,q.rotation.y,q.rotation.z,q.rotation.w,q.scale.x,q.scale.y,q.scale.z].map(v=>+v.toFixed(6)))});
  const dt=clock();c.s.advance(dt);await flush();t+=dt;}
 if(pr)await pr;console.log(name,"plan",JSON.stringify(c.s.diagnostics().motion?.walkPlan));const clips=[...new Set(frames.map(f=>f.clip))];return {name,clips,frames};}
(async()=>{const out=[];for(const [n,cl] of [['60fps',()=>1/60],['30fps',()=>1/30],['uneven',lcg(0x51f15e)]])out.push(await replay(n,cl));
 fs.writeFileSync(process.argv[2],JSON.stringify(out));for(const r of out)console.log(r.name,r.frames.length,'clips',r.clips.join('>'),'end',r.frames.at(-1).root.map(v=>v.toFixed(3)).join(','));})().catch(e=>{console.error(e.stack||e);process.exit(1);});
