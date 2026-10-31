#!/usr/bin/env node
'use strict';
/** P1 (c88320c1 FINDINGS §2A): camTrace frame/pose tracking is per camera. Board camera + world camera in one frame → no MULTI,
 *  no cross-camera JUMP. Two writers on the SAME camera in one frame → still MULTI=2 (§2B stays visible). Negative self-test:
 *  the old merged-stream code (`void camera`, no camSwap) must fail the first check. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const F=path.join(__dirname,'../../creator-build-project/assets/scripts/region/CamTraceLog.ts');
function load(src){const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 let frame=1;const box=vm.createContext({console,performance});box.globalThis=box;box.cc={director:{getTotalFrames:()=>frame}};
 const m={exports:{}};const req=s=>s==='cc'?{director:{on(){}},Director:{},view:{on(){}},screen:{on(){}},sys:{}}:s.includes('DebugQuery')?{debugSearch:()=>''}:s.includes('CameraPose')?{cameraWriteHook:{}}:{};
 vm.runInContext(js,Object.assign(box,{module:m,exports:m.exports,require:req}),{filename:F});
 const C=m.exports,lines=[];C.camLogReset?.();C.camLogStart('?camTrace=1',{});C.camLog.out=s=>lines.push(s);
 return {C,lines,next:()=>{frame++;}};}
const pose=(x,yaw=0)=>({position:[x,2,0],rotation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],fovVerticalDeg:45});
function scenario(src){const {C,lines,next}=load(src);const world={n:'world'},board={n:'board'};
 for(let i=0;i<4;i++){C.camLogWrite(world,pose(0+i*.01),'enter-level');C.camLogWrite(board,pose(50+i*.01,Math.PI),'meadow.board-background');next();}
 const twoCams=lines.slice();lines.length=0;
 C.camLogWrite(world,pose(1),'region.node-lens');C.camLogWrite(world,pose(12),'RegionJourneyCore:restore');next();
 return {twoCams,sameCam:lines.slice()};}
const src=fs.readFileSync(F,'utf8');
const r=scenario(src);
assert.ok(r.twoCams.length===8,'lines '+r.twoCams.length);
assert.ok(r.twoCams.every(l=>!/MULTI=/.test(l)),'two cameras in one frame flagged MULTI:\n'+r.twoCams.join('\n'));
assert.ok(r.twoCams.every(l=>!/JUMP=/.test(l)),'cross-camera JUMP:\n'+r.twoCams.join('\n'));
assert.ok(r.twoCams.some(l=>/ cam=2/.test(l)),'second camera labelled');
assert.ok(/MULTI=2/.test(r.sameCam[1]||''),'same camera two writers must stay MULTI=2:\n'+r.sameCam.join('\n'));
assert.ok(/JUMP=11/.test(r.sameCam[1]||''),'same-camera 11 m cut must stay a JUMP');
// negative self-test: merged stream (pre-fix)
const old=src.replace('const cs=camState(camera);camSwap(cs,true);','').replace('finally{camSwap(cs,false);camLog.busy=false;}','finally{camLog.busy=false;}');
assert.notEqual(old,src,'mutant applied');const o=scenario(old);
assert.ok(o.twoCams.some(l=>/MULTI=2/.test(l))&&o.twoCams.some(l=>/JUMP=/.test(l)),'self-test: old merged trace must show false MULTI/JUMP');
console.log('PASS cam-trace-per-camera (self-test caught merged stream)');
