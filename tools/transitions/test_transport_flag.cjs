#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
function load(rel,req){const file=path.join(S,rel);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:req,console},{filename:file});return m.exports;}
const jt=load('region/JourneyTransport.ts',()=>({}));
assert.equal(jt.JOURNEY_TRANSPORT['island-meadow'],'sail');
assert.equal(jt.JOURNEY_TRANSPORT['meadow-skycity'],'bridge');
assert.equal(jt.JOURNEY_TRANSPORT['island-lakeside'],'bridge');
assert.equal(jt.transportFor('island','meadow',null),'sail');
assert.equal(jt.transportFor('meadow','skycity',null),'bridge');
assert.equal(jt.transportFor('skycity','island',null),'bridge');
assert.equal(jt.transportQaOverride('?transport=bridge',null),'bridge');
assert.equal(jt.transportQaOverride('?transport=bridge',{getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}})}),null);
assert.equal(jt.transportFor('island','meadow','bridge'),'bridge');
const adapter=fs.readFileSync(path.join(S,'region/RegionJourneyAdapter.ts'),'utf8');
assert(/function rainbowBridge\(/.test(adapter),'rainbow helper remains');
assert(/prepareTransportLeg|sailPrepare|transportFor\(/.test(adapter),'sail branch');
const sailFn=adapter.slice(adapter.indexOf('if(sail)'));
assert(!/rainbowBridge\(rig/.test(sailFn.slice(0,sailFn.indexOf('}else{'))),'sail branch does not build rainbow strips');
const layout=fs.readFileSync(path.join(S,'region/RegionJourneyLayout.ts'),'utf8');
assert(/meadowOffset:\[0,0,24\]/.test(layout.replace(/\s/g,'')),'bridge offset unchanged');
const scene=require('../journey-integration/journey-scene.cjs');
const bridgeLen=scene.routeLength(scene.leg1);
const stamp=crypto.createHash('sha256').update(JSON.stringify(scene.leg1)).digest('hex');
console.log(JSON.stringify({status:'PASS',bridge04m:+bridgeLen.toFixed(3),bridgePathSha:stamp}));
