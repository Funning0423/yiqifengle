# Region level verification

Run from the repository root. Node 24.19.0 and TypeScript 5.9.3 were used.

```sh
npm ci --prefix tools/region-levels/deps --ignore-scripts --cache /tmp/qifengle-region-levels-npm-cache
export QF_TYPESCRIPT_MODULE="$PWD/tools/region-levels/deps/node_modules/typescript"
node tools/region-levels/qualify-mainline.cjs --check
node tools/region-levels/test-region-levels.cjs
node tools/region-levels/test-production-binding.cjs
node tools/region-levels/deps/node_modules/typescript/bin/tsc --strict --noEmit --esModuleInterop --target ES2017 --module commonjs tools/region-levels/contract-typecheck.ts
QF_TEST_OUTPUT="$PWD/tools/region-levels/retry-protection-results.json" node tools/test_retry_protection.cjs
```

To deliberately regenerate the fixture after an approved rules/seed change, omit `--check` from qualify-mainline.cjs. Requalification must win every shipped seed. A winning witness is not a guarantee that every strategy wins or a human difficulty measurement.

The test suite drives real production rule engines, controllers and storage transactions with isolated Map stores. The production binding suite uses the existing Cocos memory harness. No real user save is read or written. No image, WebGL, Creator build, Mac, WeChat or phone result is claimed.

The dependency lock records the official npm registry URL and integrity. node_modules is ignored and is not included in the commit.
