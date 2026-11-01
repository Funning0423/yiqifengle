# Current-scene Web build pipeline

## Actual result, 2026-10-15

The reproducible build wrapper, input/output identity checks, static Web package validator, and startup smoke adapter are implemented. They do not provide a Web build. Official Creator 3.8.8 is absent from the examined cloud locations; the current host is Linux. The supported cloud browser separately reports WebGL unavailable. Therefore engine build, browser startup, gameplay, and visual acceptance remain **NOT RUN / BLOCKED**.

No editor, package, browser, graphics driver, or experimental CLI was installed. No new browser process, sandbox/security workaround, user Mac, or WeChat tool was used. Product files were not edited. The independent pipeline tests use unmistakably synthetic temporary validator fixtures, never a replacement game.

### Verified official route and the environment that is still missing

The Creator 3.8 command-line publishing documentation supports a project path and exported build configuration, documents exit code **36** as success, and says the command-line build still requires a GUI session. The installation documentation describes Windows/macOS. This is a GUI-backed automation route, not a verified headless Linux builder. For this cloud-only task, an authorized cloud Windows GUI worker with official Creator 3.8.8 is the concrete prerequisite; **such a worker is not currently available**. A generic Linux coding container alone does not satisfy it.

- [Official Creator command-line publishing](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html)
- [Official installation documentation](https://docs.cocos.com/creator/3.8/manual/en/getting-started/install/)
- [Official version/download page](https://www.cocos.com/creator-download)
- [Official Web publishing](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-web.html)

The official newer `cocos/cocos-cli` project was checked rather than assumed compatible. Its current `repo.json` selects `cocos/cocos4` tag `4.0.0-alpha.36`; its package version is `0.0.1-alpha.44`. Although its tool-download documentation mentions Linux and its design discusses importing 3.x projects, that does not establish a byte-compatible or officially supported Creator 3.8.8 build. Installing it would introduce a different toolchain and is not the selected route.

- [Official CLI engine selection](https://raw.githubusercontent.com/cocos/cocos-cli/main/repo.json)
- [Official CLI package metadata](https://raw.githubusercontent.com/cocos/cocos-cli/main/package.json)
- [Official CLI tool-download documentation](https://raw.githubusercontent.com/cocos/cocos-cli/main/docs/en/download-tools.md)

### If the missing environment must be provisioned

The parent must arrange the supported cloud execution environment; this worker cannot create an unlisted Windows machine. If Creator installation is required there, the action is to install **Cocos Dashboard / Creator 3.8.8 from the official Cocos download flow**, then use a normal authorized GUI session. It installs an executable and dependencies and consumes disk/download bandwidth; any new account agreement, login, payment, persistent access, or unexpected permission needs its applicable approval. No driver or security change is part of this proposal. Confirm actual environment access, editor version, and GUI availability before building. The user's Mac remains out of scope.

## Files and commands

All commands below run at the integrated repository root, after copying/cherry-picking this tooling onto the final integrated source. No previous run's source hash should be reused after role/region changes.

### 1. Run the local contract checks

`node tools/cloud-web/test.cjs`

These exercise parser and assertion logic with synthetic fixtures and a mock browser adapter. The report explicitly says `NODE_CONTRACT_TESTS_ONLY`, `engineBuild: NOT_RUN`, `browser: NOT_RUN`, and `visualAcceptance: NOT_RUN`.

### 2. Generate a plan without launching anything

`node tools/cloud-web/build.cjs --plan`

The wrapper records the exact input file hashes, current scene UUID, explicit configuration, intended command, and blockers in a unique `output/cloud-web-build/<run-id>/` directory. It refuses run-directory reuse, so old build bytes cannot silently satisfy a new attempt. All project source inputs, including assets, settings, build templates, extensions, package files, and the build configuration form the input fingerprint; only explicitly named generated/local-state directories are excluded. Tooling receives a separate file manifest. The legacy scene display name is `FirstsliceImport`, but the scene asset and UUID are `WorldR5Integration`; checking display name alone would reject the correct scene or accept the wrong one.

The excluded project directories are `library`, `temp`, `local`, `profiles`, `build`, `node_modules`, and `.git`. Parameters come from the fixed JSON and fingerprinted project settings. Before launch, nonempty `local` or `profiles` is a blocker because stored editor defaults are not part of the source fingerprint. Use a fresh frozen source copy instead of deleting state from an existing user project. This project currently declares no dependency installation step; any future package/dependency change needs its own locked toolchain check.

### 3. Execute only in the authorized, verified Creator cloud environment

`node tools/cloud-web/build.cjs --execute --creator "C:/verified/path/to/CocosCreator.exe"`

Replace the illustrative path with the verified official 3.8.8 executable. This command is **not usable on the current Linux cloud host**. It passes arguments without a shell, records stdout/stderr/Creator logs, imposes a 30-minute process timeout, and accepts only the documented exit code 36. It does not install software, log in, open remote access, or adjust sandbox/GPU settings.

The input is checked again after import/build; any source mutation invalidates the receipt and requires review/rebuild. Successful execution must also pass package checks: 3.8.8 Web settings, current launch scene, entry dependencies, required three-region/art/audio bundles plus every source-declared bundle, their entry scripts, all listed import files/packs, current scene import, and Web engine files. CCONB `.bin` storage and binary packs follow the official 3.8.8 loader rules. It writes `artifact-manifest.json` and an external `provenance.json` with source and complete artifact SHA256 identities. The validator deliberately rejects remote bundles and mini-game packages. Native-resource semantic references and runtime dependency resolution still need the browser check; a static file inventory alone cannot prove them.

- [Official 3.8.8 bundle/pack configuration](https://raw.githubusercontent.com/cocos/cocos-engine/3.8.8/cocos/asset/asset-manager/config.ts)
- [Official 3.8.8 Web downloader and CCONB filename fallback](https://raw.githubusercontent.com/cocos/cocos-engine/3.8.8/cocos/asset/asset-manager/downloader.ts)

### 4. Verify a transferred package before running it

`node tools/cloud-web/verify.cjs ARTIFACT_DIR PROVENANCE_JSON SOURCE_ROOT`

Transfer the entire artifact directory and the external provenance file together. This compares every package file and the current integrated source against the build receipt. Do not reuse the WeChat package, old Firstslice output, a copied index wrapper, or an edited receipt. Receipts are integrity records from the trusted build process, not signed attestations against a malicious builder.

### 5. Run browser startup through the supported environment

The provided `tools/cloud-web/smoke.cjs` exports `runStartupSmoke(page, options)`. It intentionally has **no browser launcher or CDP attach path**. The authorized browser executor supplies a fresh disposable Playwright-compatible page using its supported tools. If that executor exposes a different page API, adapt the calls through that supported API; do not bypass the browser tool's restrictions.

Options are `url` (approved HTTP(S) build base URL ending in `/`), `artifactDir`, `provenanceFile`, `sourceRoot`, and a new `evidenceDir`. A pre-existing tab or context with cookies/origin storage is refused. WebGL failure produces `BLOCKED_WEBGL` before navigation or artifact requests. The runner checks every served file's SHA256, then actual startup, ownership gate, dynamic character, animations, renderer materials, game canvas, and errors. It captures a screenshot, while leaving visual review explicitly open. The browser executor owns context cleanup.

The broader required checks are in `tools/cloud-web/smoke-contract.json`. Startup is only one stage. Repeated gestures, transitions, board play, isolated recovery, character/contact/material quality, and real device checks cannot be inferred from startup or Node tests. No current-scene runtime or visual pass is claimed here.

## Evidence from this cloud execution

- `20261015-web-pipeline-node-tests.json`: actual contract-test result.
- `20261015-web-pipeline-result.json`: actual source identity, plan/blocker result, unchanged product tree check, and explicit unrun stages.
- Per-run uncommitted logs/manifests: `output/cloud-web-build/`.

The current source/config fingerprint is an intake identity, not a promise that later integration changes are included. Re-run the plan/build after integrating the role and region work.
