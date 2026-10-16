'use strict';
const assert = require('node:assert/strict'), cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'reports');
const base = 'c5b4d6d503eeccf4fb7c9ed8dd9a94b3707b536b', file = 'creator-build-project/assets/scripts/WorldIntegrationBoot.ts';
const git = args => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
const before = git(['show', base + ':' + file]), after = fs.readFileSync(path.join(root, file), 'utf8');
const manifest = require('../legacy-test-repair/reviewed-controller-change.json');
const frozenPath = 'tools/journey-integration/frozen-production-inputs.json';
assert.equal(fs.readFileSync(path.join(root, frozenPath), 'utf8'), git(['show', base + ':' + frozenPath]), 'original frozen hashes must remain unchanged');
assert.deepEqual(git(['diff', '--name-only', base, 'HEAD', '--', 'creator-build-project']).trim().split('\n'), [file]);
let reconstructed = after;
for (const item of manifest.replacements) {
  assert.equal(reconstructed.split(item.after).length - 1, 1);
  reconstructed = reconstructed.replace(item.after, item.before);
}
assert.equal(reconstructed, before, 'whole Boot, not merely class hash, must reconstruct exact baseline');
const frozen = JSON.parse(git(['show', base + ':' + frozenPath]));
for (const item of frozen.files) assert.equal(sha(fs.readFileSync(path.join(root, item.path))), item.sha256, item.path);
const section = text => text.slice(text.indexOf('class FlowReferenceStandin'), text.indexOf("@ccclass('WorldIntegrationBoot')"));
assert.equal(sha(section(before)), frozen.characterControllerSectionSHA256);
assert.equal(manifest.baselineSectionSHA256, sha(section(before)));
assert.equal(manifest.candidateSectionSHA256, sha(section(after)));
const motion = 'creator-build-project/assets/scripts/CharacterMotion.ts';
assert.equal(fs.readFileSync(path.join(root, motion), 'utf8'), git(['show', base + ':' + motion]));
fs.mkdirSync(out, { recursive: true });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'qfl-independent-endpoint-negative-'));
const exact = manifest.replacements.find(x => x.after.includes('p===1?target:'));
assert(exact);
const checks = [];
for (const [id, text] of [['original-controller', before], ['without-exact-copy', after.replace(exact.after, exact.before)]]) {
  const source = path.join(temporary, id + '.ts'); fs.writeFileSync(source, text);
  const r = cp.spawnSync(process.execPath, ['tools/test_character_action_clock.cjs'], { cwd: root, env: { ...process.env, QF_ACTION_CLOCK_BOOT: source }, encoding: 'utf8', timeout: 60000 });
  fs.writeFileSync(path.join(out, id + '.stdout.txt'), r.stdout || '');
  fs.writeFileSync(path.join(out, id + '.stderr.txt'), r.stderr || '');
  assert.equal(r.status, 1); assert.match(r.stderr, /ERR_ASSERTION/); assert.match(r.stderr, /deepStrictEqual/);
  checks.push({ id, sourceSHA256: sha(text), exitCode: r.status, expectedStrictEndpointFailure: true });
}
const identity = require('../cloud-web/lib.cjs').sourceIdentity(root);
assert.equal(identity.sha256, '7264d8503207721c827525aa84c605fbb74fc1817c804a5fbf8a6c1ca0e9db04');
const result = { status: 'PASS', baseCommit: base, reviewedCandidateCommit: '5b84b2b3798e9b886971c7364b07adb3ff445577', productFilesChanged: [file], exactProductionReplacements: manifest.replacements.length, wholeBootReverseReconstruction: true, frozenAssetsAndRules: frozen.files.length, originalFrozenManifestUnchanged: true, CharacterMotionUnchanged: true, baselineControllerSHA256: sha(section(before)), candidateControllerSHA256: sha(section(after)), negatives: checks, sourceSha256: identity.sha256 };
fs.writeFileSync(path.join(out, 'scope-and-negatives.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
