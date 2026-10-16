'use strict';
// build05 DevTools check: the [OI_WORLD_FLOW] full snapshot (~11.7 KB) must not print in release; snapshot() return unchanged.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.resolve(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts');
const src=fs.readFileSync(path.join(S,'world-r1/WorldFlowComponent.ts'),'utf8');
const m=src.match(/export function worldFlowConsoleEnabled\(debug:boolean,optIn:unknown\):boolean\{([^}]*)\}/);assert(m,'gate function present');
const gate=new Function('debug','optIn',m[1]);
assert.equal(gate(false,undefined),false,'release: no snapshot print');assert.equal(gate(false,1),false);assert.equal(gate(true,undefined),true,'debug prints');assert.equal(gate(false,true),true,'explicit opt-in prints');
const prints=src.split('\n').filter(l=>/console\.(log|info|debug)\(\s*'\[OI_WORLD_FLOW\]'/.test(l));
assert.equal(prints.length,1);assert(/if\(worldFlowConsoleEnabled\(DEBUG,/.test(prints[0]),'the only snapshot print is gated');
assert(/^import \{ DEBUG \} from 'cc\/env';/m.test(src));
// no other console line dumps flow.snapshot() unconditionally per tick
for(const f of cp.execSync('git ls-files "creator-build-project/assets/scripts/*.ts"',{cwd:ROOT}).toString().trim().split('\n')){const t=fs.readFileSync(path.join(ROOT,f),'utf8');
 for(const l of t.split('\n'))if(/console\.(log|info)\([^;]*JSON\.stringify\([^;]*snapshot\(\)/.test(l))assert.fail('unguarded snapshot dump in '+f);
 // [sailboat] sting start (Voice Bot A/V sync) must stay ungated wherever it exists
 for(const l of t.split('\n'))if(l.includes('[sailboat] sting start'))assert(!/DEBUG|worldFlowConsoleEnabled/.test(l),'sting start must print in release: '+f);}
const sting=cp.execSync('git grep -c "\\[sailboat\\] sting start" -- creator-build-project || true',{cwd:ROOT}).toString().trim();
// snapshot() code path not modified by the gate: WorldFlowCore.snapshot unchanged vs 2607de6
const core=f=>f.match(/\n  snapshot\(\)[\s\S]*?\n  \}/)?.[0];
assert.equal(core(fs.readFileSync(path.join(S,'world-r1/WorldFlowCore.ts'),'utf8')),core(cp.execSync('git show 2607de6:creator-build-project/assets/scripts/world-r1/WorldFlowCore.ts',{cwd:ROOT}).toString()),'snapshot() unchanged');
console.log(JSON.stringify({status:'PASS',stingStartLines:sting||'none in this tree'}));
