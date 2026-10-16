# Three historical test failures: diagnosis and repair

Base: `c5b4d6d503eeccf4fb7c9ed8dd9a94b3707b536b`.
Isolated branch: `oi/legacy-test-repair`. No push, browser, Creator, user Mac, credentials or real user storage used.

## Final validation

The final 35-suite aggregate completed: **34 PASS, 0 FAIL, 1 BLOCKED_BROWSER**. All three requested failing suites now pass. The two supplementary pre-existing failures listed below remain failures, and the locomotion helper was not independently executed. Product source fingerprint was rechecked after all checks and stayed `7264d8503207721c827525aa84c605fbb74fc1817c804a5fbf8a6c1ca0e9db04`.

## What changed

1. **Action-clock endpoint: numerical production defect plus obsolete test boundary.**
   `FlowReferenceStandin.advanceStep` resolved at `elapsed + 1e-6 >= duration`, although the final root still used an incomplete interpolation. The first failure was `0.9999999999999984 !== 1`. The same bug is also exercised deliberately at 0.5 microseconds before clip end. The repair normalizes elapsed within the existing completion tolerance before evaluating the root and copies exact stand/sit target coordinates at the endpoint. No tolerance was increased. Only three explicit replacements in this method are authorized; animation samples, `CharacterMotion.ts`, assets and the 120 Hz subdivision are unchanged.

   The old test also expected `adapter.advance(5)` to drop all but 0.1 seconds. Current production puts that cap in `WorldFlow.advance` and `WorldFlowComponent.update`; the adapter consumes its full supplied time in substeps. The new test verifies the adapter's complete time consumption and the actual WorldFlow entry's 0.1-second cap, hide/show cancellation and explicit resume separately. Intermediate clock sums allow only a documented 1e-12 IEEE-754 difference; terminal controller coordinates remain strict equality. Completion is checked synchronously before awaiting each action so an unresolved promise cannot silently make a Node test exit successfully.

2. **Journey book: obsolete challenge-unlock expectation.**
   The old test treated opening mainline stage 05 as enough to unlock meadow challenges. The current campaign host and actual chapter UI require same-region mainline milestones **04 / 08 / 12**. Production was unchanged. The corrected unit expectation is backed by actual legal replays immediately before and after all three milestones, actual R5 provider gates, and actual IslandJourneyOverlay → journal text → chapter button event handling. No synthetic saved completion was injected.

3. **Startup-ready gate: obsolete static heroine expectation.**
   The old test required three instantiated objects and static/dynamic heroine swapping. Current Boot explicitly loads one unified dynamic heroine and one independent stationary stool. Production was unchanged. The test now asserts exactly those object identities, no `actor` load or static heroine instance, persistent dynamic renderer binding, stationary stool transform, and the existing startup/failure/retry/dispose gate checks. Initial seated samples remain exactly three and at time zero.

## Regression evidence

- `reports/before/`: all three original failures reproduced before editing.
- `reports/new-regression-against-baseline.txt`: the updated action-clock regression still fails against the exact original production Boot at the strict root assertion.
- `reports/no-exact-target-copy-negative.txt`: removing the exact target copy also fails strict endpoint equality.
- `test-character-endpoints-real-glb.cjs`: six stand/sit runs using shipped GLB and anim_meta, at 30/60/120 fps, assert exact CharacterReference endpoints and single completion. It uses JS skeletal evaluation, not imported Cocos rendering.
- `reviewed-controller-change.json`: original and candidate controller hashes plus the three exact before/after replacements. The original frozen snapshot is preserved. The integrity gate verifies candidate identity and reverses only these replacements to reconstruct the original frozen hash. Its negative regression rejects unrelated subdivision/tolerance changes and substituted baseline hashes.
- `reports/after/`: complete final selected-suite logs and supplementary checks. `reports/summary.json` records final statuses and source identities.

The aggregate runner now includes the original three failing suites plus chapter production-entry, controller-integrity negative and real-GLB endpoint regressions. Browser-only legacy navigation remains explicitly blocked and is never launched.

## Additional failures found, not hidden or repaired in this scope

Both were run on a fresh `git archive` of the exact base and on the repaired source, with Node 24.19.0 and TypeScript 5.9.3:

- `tools/walk-driver/test_action_transitions.cjs:23`: same **sit foot movement 2.006046579344563 / 2.9713408754964563 mm**, exceeding its 2 mm assertion. This is a pre-existing real-GLB contact-quality failure, unrelated to the endpoint patch. Later checks in that fail-fast suite did not execute.
- `tools/walk-driver/test_walk_driver.cjs:144`: same missing `hips` structural fixture causes `supportPose` to read an undefined position during bindVisual. This is a pre-existing test-fixture failure; the suite did not complete.

Their complete before/after logs remain in the evidence. `test_anim_eval_order` passed on the repaired source. `test_locomotion.cjs` is a helper installed and invoked by `test_walk_driver`; its standalone exit 0 executed no tests and is recorded as NOT_EXECUTED_HELPER, not a pass. The failed host prevented completion of that helper suite. No broad "all repository tests passed" claim is made.

## Limits

This repairs the requested three historical test failures. It does not approve character deformation, foot contact, visual appearance or a release build. Official Creator 3.8.8 compilation, WebGL rendered acceptance, real lifecycle events, physical devices, WeChat and real user saves remain unverified. Build tooling was run only with `--plan`.

## Reproduce

```sh
export QF_TYPESCRIPT_MODULE=/workspace/shared/region-levels-20261015/tools/region-levels/deps/node_modules/typescript
node tools/journey-integration/run-suite.cjs
node tools/walk-driver/test_anim_eval_order.cjs
node tools/cloud-web/build.cjs --plan
```

The full runner intentionally exits nonzero while the browser-only suite is blocked. The source file manifest and per-suite results must be read alongside that exit status.
