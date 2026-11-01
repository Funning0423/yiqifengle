'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs');
const { verifyController } = require('./controller-integrity.cjs');
const manifest = require('./reviewed-controller-change.json');
const frozen = require('../journey-integration/frozen-production-inputs.json');
const source = fs.readFileSync('creator-build-project/assets/scripts/WorldIntegrationBoot.ts', 'utf8');
const candidate = source.slice(source.indexOf('class FlowReferenceStandin'), source.indexOf("@ccclass('WorldIntegrationBoot')"));
assert.equal(verifyController(candidate, frozen.characterControllerSectionSHA256).id, 'reviewed-character-endpoint-patch-only');
let baseline = candidate;
for (const change of manifest.replacements) baseline = baseline.replace(change.after, change.before);
assert.equal(verifyController(baseline, frozen.characterControllerSectionSHA256).id, 'existing-character-controller-byte-identical');
for (const [before, after] of [['Math.min(left,1/120)', 'Math.min(left,1/60)'], ['j.elapsed+1e-6>=j.duration', 'j.elapsed+1e-3>=j.duration']]) {
  assert(candidate.includes(before));
  assert.throws(() => verifyController(candidate.replace(before, after), frozen.characterControllerSectionSHA256), /Unreviewed controller bytes changed/);
}
assert.throws(() => verifyController(candidate, '0'.repeat(64)), /preserve the original frozen controller identity/);
console.log(JSON.stringify({ status: 'PASS', candidateExact: true, originalBaselinePreserved: true, unauthorizedSubstepOrToleranceChangesRejected: true, replacementBaselineRejected: true }));
