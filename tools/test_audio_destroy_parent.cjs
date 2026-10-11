'use strict';
const fs=require('fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('./qf-env.cjs').typescript();
const src=fs.readFileSync('creator-build-project/assets/scripts/audio/GameAudio.ts','utf8');
const a=src.indexOf('  destroy(): boolean {'),b=src.indexOf('\n  /**',a);assert(a>=0&&b>a);
const method=src.slice(a,b);
const compiled=ts.transpileModule('class CandidateAudio extends Component { destroying=false;'+method+' }; globalThis.CandidateAudio=CandidateAudio;', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
let calls=0,ret=true,receiver=null;
class Component {destroy(){calls++;receiver=this;return ret;}}
const ctx={Component};vm.runInNewContext(compiled,ctx);
for(const value of [true,false]){ret=value;const x=new ctx.CandidateAudio();assert.equal(x.destroy(),value);assert.equal(receiver,x);assert.equal(x.destroying,true);}
assert.equal(calls,2);
// Exact Creator 3.8.8 parent-call validator contract, checked on compiled method.
assert(/\b\._super\b|destroy.*\.call\s*\(\s*\w+\s*[,|)]/.test(ctx.CandidateAudio.prototype.destroy.toString()));
const report={status:'PASS_PURE_METHOD_NOT_AUDIO_RUNTIME',parentCalls:calls,flagsPreserved:true,returnsPreserved:true,creatorParentCallContract:true};
fs.writeFileSync('evidence/dot-candidate-validation-20261010/audio-destroy-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
