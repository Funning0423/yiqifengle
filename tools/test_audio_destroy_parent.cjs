'use strict';
// Pure-method test of GameAudio.destroy(): the exact source method, compiled alone onto a stub owner.
// Intent (unchanged): parent Component.destroy is called exactly once on the same receiver with its
// return value preserved, `destroying` is set, and the Creator 3.8.8 direct parent-call form is kept.
// Refreshed for v0.3.3+: destroy() now also cancels the loop request and stops loop + SFX immediately,
// BEFORE the deferred parent destroy (Cocos destroys at end of frame). NOT an audio runtime test.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),vm=require('node:vm');
const env=require('./audio-test-env.cjs'),ts=env.typescript();
const src=fs.readFileSync(path.join(env.ROOT,'creator-build-project/assets/scripts/audio/GameAudio.ts'),'utf8');
const a=src.indexOf('  destroy(): boolean {'),b=src.indexOf('\n  //',a+1);assert(a>=0&&b>a,'destroy() method not found');
const method=src.slice(a,b);
// Owner stubs for the members the current destroy() uses; each records call order.
const stubs='destroying=false; loopRequested=true; order=[]; detachLoopSource(){this.order.push("detach:"+this.loopRequested);} stopAllSfx(){this.order.push("sfx");}';
const compiled=ts.transpileModule('class CandidateAudio extends Component { '+stubs+method+' }; globalThis.CandidateAudio=CandidateAudio;', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
let calls=0,ret=true,receiver=null;
class Component {destroy(){calls++;receiver=this;this.order.push('parent');return ret;}}
const ctx={Component,console};vm.runInNewContext(compiled,ctx);
for(const value of [true,false]){ret=value;const x=new ctx.CandidateAudio();assert.equal(x.destroy(),value);assert.equal(receiver,x);assert.equal(x.destroying,true);
  assert.equal(x.loopRequested,false,'loop request cancelled');
  assert.deepEqual(Array.from(x.order),['detach:false','sfx','parent'],'loop detached (after cancelling request) and SFX stopped before deferred parent destroy');}
assert.equal(calls,2);
// Exact Creator 3.8.8 parent-call validator contract, checked on compiled method.
assert(/\b\._super\b|destroy.*\.call\s*\(\s*\w+\s*[,|)]/.test(ctx.CandidateAudio.prototype.destroy.toString()));
const report={status:'PASS_PURE_METHOD_NOT_AUDIO_RUNTIME',parentCalls:calls,flagsPreserved:true,returnsPreserved:true,stopsBeforeParent:true,creatorParentCallContract:true};
env.writeReport('evidence/dot-candidate-validation-20261010/audio-destroy-test.json',report);console.log(JSON.stringify(report));
