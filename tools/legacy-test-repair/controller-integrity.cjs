'use strict';
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const reviewed = require('./reviewed-controller-change.json');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function verifyController(section, frozenSHA256) {
  const actual = sha(section);
  if (actual === frozenSHA256) return { id: 'existing-character-controller-byte-identical', sectionSHA256: actual };
  assert.equal(reviewed.baselineSectionSHA256, frozenSHA256, 'Review must preserve the original frozen controller identity');
  assert.equal(actual, reviewed.candidateSectionSHA256, 'Unreviewed controller bytes changed');
  let restored = section;
  for (const replacement of reviewed.replacements) {
    assert.equal(restored.split(replacement.after).length - 1, 1, 'Each reviewed replacement must match exactly once');
    restored = restored.replace(replacement.after, replacement.before);
  }
  assert.equal(sha(restored), frozenSHA256, 'Reversing only the reviewed endpoint patch must reconstruct the frozen controller');
  return { id: 'reviewed-character-endpoint-patch-only', baselineSectionSHA256: frozenSHA256, sectionSHA256: actual,
    exactReviewedReplacements: reviewed.replacements.length, baselineReconstructionVerified: true, note: 'Controller bytes intentionally changed; not a byte-identical claim.' };
}
module.exports = { verifyController };
