# Independent journey integration checks

Run from this source root:

```sh
node tools/journey-integration/test-mainline-boundaries.cjs
QF_TYPESCRIPT_MODULE=/absolute/path/to/typescript node tools/journey-integration/test-journey-lifecycle.cjs
```

The integration environment currently reuses TypeScript 5.9.3 read-only from:
`/workspace/shared/region-levels-20261015/tools/region-levels/deps/node_modules/typescript`.
It does not install software or launch a browser. `QF_JOURNEY_SOURCE_ROOT` is an explicit read-only review target override; final integration evidence must use this checkout without that override.

Each executable writes a JSON report under `reports/`. `mainline-baseline.json` records the pre-integration pass. `route-mismatch-before-fix.json` preserves the independently reproduced loader-request mismatch before its repair. This defect allowed a valid meadow→skycity route to satisfy an island→meadow request; the final lifecycle suite requires rejection and exactly one lease disposal.

See `ACCEPTANCE.md` for the full scenario matrix and evidence levels. A script pass is never a rendered, device, or production-save acceptance. The source baseline has 2,244 hash-verified files. Imported development commits and final acceptance status will be recorded separately.

The Node suite preflights source for browser-launch APIs and reports such legacy tests BLOCKED without executing them. An initial attempt to classify the old navigation guard as a pure Node test stopped at a missing browser executable before any browser launched; its exact error is retained in `reports/legacy-browser-not-started.txt`. Do not install a browser, override graphics flags, or route around the authorized-browser requirement to run it.
