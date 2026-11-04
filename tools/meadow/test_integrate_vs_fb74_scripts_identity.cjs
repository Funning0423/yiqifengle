#!/usr/bin/env node
/**
 * Strategy C CONTROL_FAIL_NOISE: lock transition/board/balloon paths bit-identical to
 * over-line Mac tip fb74d437. Character standup warmSample is ALLOWED only in
 * WorldIntegrationBoot / RegionJourneyAdapter / CharacterMotion (MorphDriver comment).
 * Do NOT peel BalloonTransit / black-fence / K.s1. Do NOT put warmSample into
 * TransitionShaderWarm / SkycityBoard* / BalloonTransit.
 */
const { execSync } = require('child_process');
const PASS = 'fb74d437d96d1201f597b36f669b22115988077d';
const LOCK_SAME = [
  'creator-build-project/assets/scripts/region/BalloonTransit.ts',
  'creator-build-project/assets/scripts/region/TransitionStaging.ts',
  'creator-build-project/assets/scripts/region/BalloonFlight.ts',
  'creator-build-project/assets/scripts/region/SailPreload.ts',
  'creator-build-project/assets/scripts/region/SkycityBoardLive.ts',
  'creator-build-project/assets/scripts/region/SkycityBoardBackground.ts',
  'creator-build-project/assets/scripts/region/TransitionShaderWarm.ts',
];
const STANDUP_ALLOWED = [
  'creator-build-project/assets/scripts/WorldIntegrationBoot.ts',
  'creator-build-project/assets/scripts/CharacterMotion.ts',
  'creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts',
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
for (const f of LOCK_SAME) {
  const passBlob = revParse(`${PASS}:${f}`);
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
const bad = warmHits.split('\n').filter(Boolean).filter((line) => {
  return !STANDUP_ALLOWED.some((f) => line.startsWith(f + ':') || line.includes(f + ':'));
});
// git grep format: path:lineno:text
const bad2 = warmHits.split('\n').filter(Boolean).filter((line) => {
  const path = line.split(':')[0];
  return !STANDUP_ALLOWED.includes(path);
});
if (bad2.length) {
  console.error('warmSampleStandUp outside standup-allowed files:\n' + bad2.join('\n'));
  failed++;
} else if (!warmHits) {
  console.error('EXPECTED warmSampleStandUp in standup-allowed character path');
  failed++;
} else {
  console.log('OK warmSampleStandUp isolated to character standup path');
}
const burst = execSync(
  `git grep -n armStandupShaderBurst -- creator-build-project/assets/scripts || true`,
  { encoding: 'utf8' },
).trim();
// Allow mention in forbid-comments; forbid real call/import/export wiring.
const burstCode = burst.split('\n').filter(Boolean).filter((line) => {
  const body = line.split(':').slice(2).join(':');
  return /\b(armStandupShaderBurst)\s*\(|import\s*\{[^}]*armStandupShaderBurst|export\s+function\s+armStandupShaderBurst|typeof\s+T\.armStandupShaderBurst/.test(body)
    || /armStandupShaderBurst\s*=/.test(body);
});
if (burstCode.length) {
  console.error('FORBIDDEN armStandupShaderBurst wiring:\n' + burstCode.join('\n'));
  failed++;
} else {
  console.log('OK no armStandupShaderBurst wiring');
}
if (failed) {
  console.error(`FAIL ${failed}`);
  process.exit(1);
}
console.log('PASS Strategy C: transition/board/balloon == fb74; standup warmSample isolated');
