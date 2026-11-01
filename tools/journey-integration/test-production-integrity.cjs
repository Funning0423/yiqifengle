'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),expected=require('./frozen-production-inputs.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const checks=[];
// Check every frozen file first, then fail once listing ALL mismatches (path, expected, actual); same exit code/semantics as before.
const mismatches=[];for(const entry of expected.files){const actual=sha(fs.readFileSync(path.join(root,entry.path)));if(actual!==entry.sha256)mismatches.push({path:entry.path,expected:entry.sha256,actual});}
if(mismatches.length){for(const m of mismatches)console.error('MISMATCH '+m.path+'\n  expected '+m.expected+'\n  actual   '+m.actual);assert.fail('Frozen shipped asset/rule changed: '+mismatches.length+' of '+expected.files.length+' files (first: '+mismatches[0].path+')\n'+mismatches.map(m=>'  '+m.path+' expected '+m.expected+' actual '+m.actual).join('\n'));}
checks.push({id:'immutable-shipped-assets-and-engine',files:expected.files.length});
const boot=fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/WorldIntegrationBoot.ts'),'utf8'),section=boot.slice(boot.indexOf('class FlowReferenceStandin'),boot.indexOf("@ccclass('WorldIntegrationBoot')"));
checks.push(require('../legacy-test-repair/controller-integrity.cjs').verifyController(section,expected.characterControllerSectionSHA256));
const report={status:'PASS',timeUTC:new Date().toISOString(),scope:'Frozen shipped bytes plus explicit reversible controller patch; no rendered quality inferred',checks};fs.writeFileSync(path.join(__dirname,'reports/production-integrity.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
