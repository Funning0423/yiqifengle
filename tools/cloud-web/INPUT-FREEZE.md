# Explicit preparation and strict formal build

Base: `690454cd05156a21227d4dc7e23396bd4f5b10d3`. This is an isolated proposed tooling patch, not a successful native rebuild. No old run, source manifest or provenance is rewritten.

## Changed acceptance semantics

The first engine invocation is now explicitly **preparation only**. It uses the already-known Creator `--build` interface, which imports and builds; it is NOT an unverified import-only CLI. Its generated artifact is never accepted or given artifact provenance. A second, distinct run builds from the recorded prepared inputs and must keep those inputs byte-for-byte identical throughout that formal invocation.

Preparation checks the complete included source path set and bytes against Git objects at the fixed base. Existing inputs cannot change or disappear. Only the eight exact observed metadata entries embedded in freeze.cjs are admitted: information.json and seven profiles files. Every admitted path must also match its reviewed byte count and full SHA-256; merely having the expected filename is insufficient. Profiles identities come from native read-only audit bc-a6a88e57-d793-4eb0-8f92-e215dc3a0f75; information identity comes from the earlier independent build audit (586 bytes, a38b4b0741e8f9187d2b886816fa76c4e6f2ba666025de2ed5d4b85c86e7a5fa). It is treated as an opaque input: size and SHA-256 only, never parsed, copied into reports, or described as harmless. Any of these observed metadata files being present before preparation is rejected. Absence of changes is also allowed.

`local` and `profiles` now participate in source identity. Pre-existing nonempty state is blocked for preparation. Any new file there outside the exact path/size/hash list, or any listed file with different bytes, is **rejected**, with metadata-only deltas in the failed report and no preparation receipt. Do not expand the policy to whole directories, delete the generated state to hide a difference, or reuse a failed preparation as approved input. Review the exact paths and their provenance separately before proposing another explicitly approved policy change.

The old generated-directory boundary remains for `library`, `temp`, `build`, `node_modules` and `.git`. This source receipt is not a claim to fingerprint every external dependency, cache, editor installation file or environment variable. Engine identity additionally hashes the complete verified macOS .app/Contents tree, including MacOS binaries, Resources (app.asar and bundled engine resources) and Frameworks. Internal symlinks are included by link identity and must resolve inside that tree; external symlinks fail closed. Files are hashed without parsing; no user home, preferences, credential store or external cache is inspected. Nonstandard layouts and Windows installations are blocked pending separate scope review. Tooling is checked for stability during both invocations and against preparation at formal entry.

## Authorized next native attempt

Use a NEW isolated checkout/copy with fixed-base Git objects available, and apply this reviewed patch. Never use the earlier failed run's project state. Verify the official Creator 3.8.8 installation separately; the wrapper cannot certify installation origin from a path.

First run contract tests:

    node tools/cloud-web/test.cjs
    node tools/cloud-web/freeze.test.cjs
    node tools/cloud-web/freeze.integration.test.cjs

Then, only when native preparation/build execution is authorized:

    node tools/cloud-web/build.cjs --prepare --creator /VERIFIED/CREATOR --run-id prep-UNIQUE

If and only if the report is `PREPARATION_FROZEN`, a separate authorized formal run can consume it:

    node tools/cloud-web/build.cjs --execute --creator /VERIFIED/CREATOR --run-id formal-UNIQUE --prepared-run prep-UNIQUE

Each run ID must be new. Receipt consumption rechecks baseline entries, preparation delta, source/tooling hashes and engine executable identity before process launch. Formal build still fails on ANY included input change, including information metadata; only successful engine exit 36, strict equality and artifact structure verification create new provenance. New provenance links the preparation receipt hash, fixed base and original/frozen input fingerprints. Existing verify/smoke gates are unchanged.

## Expected unresolved native blocker

The earlier native run created seven profiles files whose exact paths, sizes and hashes have now been observed without content inspection. They are a bounded byte-identity allowance, not a claim of harmless contents. If a new native preparation creates any different path or bytes, this candidate deliberately stops. The cloud tests do not establish that native preparation will complete or that the second engine pass leaves information metadata stable. No local authentication data may be copied or uploaded. If a new credential/login, metadata-content inspection or an unclassified state policy is required, stop and request the narrowly necessary decision.

## Verification limits

Node contract tests use synthetic data. Integration tests intercept process calls and simulate Creator exit codes and output; they do not launch an engine or browser. Passing them establishes control-flow and negative-check behavior only. Actual Creator preparation, native formal build, runtime/WebGL, visual quality and gameplay acceptance remain NOT_RUN for this candidate. Raw Creator logs may contain local data: retain locally and review/redact before any separately authorized upload.

## Evidence and filesystem trust boundary

Project inputs, tooling ancestors, output/run directories and evidence files reject symlinks before access. Preparation receipt consumption binds run ID, mode, engine success/status, source/tooling/engine identity and before/after tooling manifests. The receipt hash is a consistency link, not a digital signature: a trusted local execution/evidence directory is assumed; coordinated rewriting of all evidence is not cryptographically prevented. Filesystem checks do not claim adversarial race-proof isolation.

Integration fixtures substitute a synthetic information identity only inside their disposable copied tooling, because tests must not reproduce private metadata contents. Production allowlist validation separately tests all eight fixed entries and rejects size/hash deviations. No real metadata bytes are included in this patch.
