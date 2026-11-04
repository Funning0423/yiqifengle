#!/usr/bin/env node
/**
 * Lock: tip branch gate-critical scripts must stay bit-identical to over-line
 * Mac tip fb74d437. Strategy B Mac FAIL (6f785228) already had ZERO script
 * delta vs fb74 on the integrate tree — peeling BalloonTransit / black-fence /
 * K.s1 is NOT a valid gate fix. Standup warmSample must stay absent.
 */
const { execSync } = require('child_process');
const PASS = 'fb74d437d96d1201f597b36f669b22115988077d';
const FILES = [
  'creator-build-project/assets/scripts/region/BalloonTransit.ts',
  'creator-build-project/assets/scripts/region/TransitionStaging.ts',
  'creator-build-project/assets/scripts/region/BalloonFlight.ts',
  'creator-build-project/assets/scripts/region/SailPreload.ts',
  'creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts',
  'creator-build-project/assets/scripts/region/SkycityBoardLive.ts',
  'creator-build-project/assets/scripts/region/SkycityBoardBackground.ts',
  'creator-build-project/assets/scripts/region/TransitionShaderWarm.ts',
  'creator-build-project/assets/scripts/WorldIntegrationBoot.ts',
  'creator-build-project/assets/scripts/CharacterMotion.ts',
];
function revParse(spec) {
  try {
    return execSync(`git rev-parse ${spec}`, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}
if (!revParse(`${PASS}^{commit}`)) {
  console.log('SKIP: fb74d437 not reachable');
  process.exit(0);
}
let failed = 0;
for (const f of FILES) {
  const passBlob = revParse(`${PASS}:${f}`);
  // Prefer index/working tree for pre-commit; fall back to HEAD
  let cur = null;
  try {
    cur = execSync(`git hash-object ${f}`, { encoding: 'utf8' }).trim();
  } catch {
    cur = revParse(`HEAD:${f}`);
  }
  if (!passBlob || !cur) {
    console.error(`MISSING ${f}`);
    failed++;
    continue;
  }
  if (passBlob !== cur) {
    console.error(`DIFF vs fb74 ${f}\n  pass=${passBlob}\n  cur=${cur}`);
    failed++;
  } else {
    console.log(`SAME ${f}`);
  }
}
const warmHits = execSync(
  `git grep -n warmSampleStandUp -- creator-build-project/assets/scripts || true`,
  { encoding: 'utf8' },
).trim();
if (warmHits) {
  console.error('UNEXPECTED warmSampleStandUp:\n' + warmHits);
  failed++;
} else {
  console.log('OK no warmSampleStandUp');
}
if (failed) {
  console.error(`FAIL ${failed}`);
  process.exit(1);
}
console.log('PASS tip scripts == fb74d437 (gate-critical + standup deferred)');
