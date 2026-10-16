# Local Creator Web build adjustment

The reviewed Library patch was applied to the verified 2244-file baseline. Its 619-input Creator fingerprint matched `7264d8503207721c827525aa84c605fbb74fc1817c804a5fbf8a6c1ca0e9db04` before the first official build.

Creator 3.8.8 returned 36 in build01, but input verification correctly rejected its automatic change to information.json. The original build and logs are retained in the sibling source directory. This new frozen copy preserves the exact editor-generated information.json; no account, credential, entitlement, or permission operation was performed.

The old builder settings referenced a nonexistent absolute splash-logo path. The original tracked logo is copied byte-for-byte into creator-build-project/build-resources so it participates in the effective input fingerprint. Builder settings point to that actual local file. The artwork is unchanged.

The static validator now resolves scriptPackages relative to cocos-js/cc.js, matching the real Creator 3.8.8 SystemJS module.import call. It verifies the cc import-map mapping and retains artifact-root/realpath/symlink checks. Actual relative references, missing files and traversal/encoded-URL rejection are covered by the contract tests.

No gameplay source, character source, asset or threshold was changed. These are local build inputs/tooling; the resulting fingerprint differs from the reviewed intake and is recorded separately. The source-path-specific logo setting must be rebound and re-fingerprinted before rebuilding at another location. Runtime and visual acceptance remain open.
