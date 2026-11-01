# Three-region integration result

Status: all three development commits integrated; 28 executable suites PASS, one browser-dependent legacy suite BLOCKED, and three historical failures independently reproduced. Formal build and rendered acceptance remain blocked. This is a local code candidate, not a release-approved build.

## Combined-source acceptance result

- `reports/suite.json`: 29 declared suites, 28 PASS, 0 FAIL, 1 BLOCKED_BROWSER. The one blocked suite is the preflight-excluded legacy browser launcher. Suite exit code 1 truthfully represents that unresolved environment requirement.
- Actual production entry and binding, legal 190-action twelve-stage replay, 04→05 and 08→09 command ordering, saved-result preservation on failed preflight, explicit retry, loading timeouts, stale callbacks, pause/resume, input ownership, corrupt saves and reward idempotency passed their stated logic scopes.
- Both meadow and skycity board exit/background/resume paths preserve their current region and controller root, with zero extra travel requests.
- Strict engine-independent TypeScript type checking, all 12 changed TypeScript syntax checks, and `git diff --check` passed.
- 311 frozen shipped resources/rule files and the entire existing character controller remain byte-identical.
- All 36 originally shipped mainline seeds remain legally winnable. This is seed qualification, not measured human difficulty.
- The static route-geometry audit passed its sampled checks only. Actual bridge/terrain/foot contact and skycity visibility still require rendered review.
- The final source fingerprint was checked again after all combined tests and was unchanged: see `reports/final-source-recheck.json`.

## Proven source baseline

- Frozen manifest: `source-after-final-manifest.json`
- Manifest SHA256: `9183915105c982a82389633ceca4ea30cf4cfefc0f8369e694002814af74484c`
- All 2,244 files verified byte-for-byte, no missing, changed or extra files before development
- Local baseline commit: `4f78549`
- Worktree/branch: isolated `game-integration-20261015`, `oi/journey-integration`; no push

## Imported work

- Region content/progression: `b121fae27b505fefc2d9e283f334c68b29e5a0cd`, integrated as `acfa1c6`
- Official-Web build/verification tooling: `eb4d3d8bec9175940666897e0b0859299e867da9`, integrated as `2deb71d`
- Region journey: `21086bd00aec54a0d5addd49f9d7793c5e72dbcc`, integrated as `1d08cd5`

## Independently identified and repaired gaps

1. A valid meadow→skycity route could satisfy an island→meadow request. Preparation now checks both source and requested destination; invalid ownership disposes the lease. Before-fix evidence is preserved.
2. Web source provenance omitted build templates. The fingerprint now covers effective Creator project inputs including templates/extensions, with explicit generated/local exclusions and blocking nonempty local/profile state.
3. Web artifact verification accepted a bundle list without the actual regions. It now requires current-scene bundles, source-declared bundles and all declared import/pack/CCONB files.

## Evidence limits

- Node/controller/component-double tests prove logic and ownership only.
- Strict TypeScript checks cover the engine-independent modules; they are not a full Creator compile.
- 311 frozen asset/rule files and the existing character-controller implementation are guarded byte-for-byte.
- No official Creator 3.8.8 Web output has been produced in this environment.
- No actual rendered rainbow-bridge/region traversal has passed visual review. Current cloud WebGL is unavailable.
- No physical-device, WeChat, real OS lifecycle, or normal-user-save acceptance is claimed.
- Backward travel from meadow/skycity to earlier regions is explicitly unavailable in this implementation. Forward progression and return from a board to its current region are the implemented scope.

The old `test_world_navigation_guard.cjs` is a browser-launching test and is blocked by the Node-only runner. An initial classification error reached the missing-executable check; no browser started. Exact evidence is retained rather than converted to a logic pass.

## Historical regression failures reproduced independently

The following are failures, not waived passes. Each was run on a disposable archive of the exact frozen baseline and again on the fully integrated source with Node v24.19.0 and TypeScript 5.9.3:

- `tools/test_character_action_clock.cjs:12`: strict equality `0.9999999999999984 !== 1`
- `tools/board-ui/test_board_ui_pure.cjs:115`: strict equality `true !== false`
- `tools/test_startup_ready_gate.cjs:30/33`: strict equality `2 !== 3`

Both runs fail at the same assertion and values. Evidence: `reports/baseline-comparison/summary.json` and six complete output files. No character implementation or earlier assertion was changed to conceal these failures.

## Exact final product-source identity

The combined Creator source fingerprint is:
`68c89eb32269be70dec669855fee04f80bbb6fd9a18d535c9000abfab5ff3d07`

Recreated by `node tools/cloud-web/build.cjs --plan` after all three development commits were integrated. The full effective-input manifest is `reports/final-source-manifest.json`. It includes build templates and current bundle metadata. The plan remains `PLAN_ONLY`; it is not a produced Web artifact.

## Reproduction

From the integrated source root:

```sh
export QF_TYPESCRIPT_MODULE=/workspace/shared/region-levels-20261015/tools/region-levels/deps/node_modules/typescript
node tools/journey-integration/run-suite.cjs
node tools/region-levels/qualify-mainline.cjs --check
python3 tools/region-journey/audit_route_assets.py
node tools/cloud-web/build.cjs --plan
```

TypeScript is the already installed, lock-pinned 5.9.3 package used read-only. The geometry audit also needs numpy. The suite intentionally returns a nonzero blocked status for the legacy browser launcher rather than attempting to run it. Runtime evidence must later use an authorized browser adapter with a matching official build and fresh disposable profile.
