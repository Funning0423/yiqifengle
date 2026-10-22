# Skirt v2 NORMAL + approved h1 shoes: frozen stage input

Prepared by Oi, Funning's assistant, on 2026-10-18. This directory preserves the current candidate and its necessary integration tools in GitHub. It is not a production asset replacement or a completed game release.

## Repository identity

- Branch base: `gbt/r5-integrated-b07-wip` at `bc81575fead2d4d05b11b962c936d3b76708ad4b`.
- Base tree: `900c6ac0a6c49e68639196e29aac292d3564704e`.
- At publication preflight, `gbt/r5-integrated` was `a83e1c2bde62a348543365a0a762c73ac1ee49a7`; `gbt/r5-integrated-fix1` was `9895057155dcd15e4a646dc1f1cf79e8e25abd85`.
- The separate Mac source was reported as `b35f1a8b10775668300385d224f4ae4aad937fe8`, tree `c29e2158eba12f446afb8f3d89c31b443aaa0420`. GitHub returned "No commit found" for that SHA at publication preflight. This branch does not claim to contain or publish that Mac revision.
- Only this candidate directory is added. Runtime code, active assets, permissions, and other branches are unchanged. The tested Mac integration patch will be a separate, explicitly identified change when available.

## Frozen files

- `character-skirt-v2-normal-h1.glb`: SHA-256 `af5c0efa865211679610a785c39bdf19a1c8ea5720be8fa769ddae06da90c20d`
- `anim_meta.json`: SHA-256 `aeaa23399c6dba01871f8303da704e5ca053e5b56c11398125ce6aa1587249bb`

The model contains the skirt v2 geometry, its NORMAL bases, and the approved h1 shoe shape. It has AP53 / DRESS49 targets and zero native animation weights channels; MorphDriver remains the sole morph writer. The h1 shoe is rigidly bound to shin. The metadata deliberately retains the old `sole_contact` foot-frame data as frozen input evidence; it must not be treated as h1-compatible contact configuration.

## Runtime integration boundary

1. Recheck the actual project HEAD, tree, dirty state, model, metadata, and script hashes before patching. The verified character source is `bb37efb59f558e4a80dbed1082dd048914084adf3518353292980e35474fab3f`, old metadata `cefb3e4261592da20be40c9ada49a8f51354fc93f5557da7f178c79b40ea60e6`, and CharacterMotion `3ef288ff12a8f8512e07a3ea2f94819e984cc70a9d9d4a38b5a9c69e1523b657`. A new source requires revalidation.
2. Work in an isolated branch/copy. Preserve actual project UUIDs and import settings. Do not add a second character prefab to a directory whose loader expects exactly one prefab.
3. For the approved initial preview package, explicitly identify h1 preview mode and disable the incompatible old foot-contact compensation only for this character. Preserve original bone animation. Disabling compensation does not establish correct grounding. Do not globally disable other characters' contact handling.
4. Verify imported target names/indices, NORMAL data, single-writer behavior, clip duration, actual renderer/GPU behavior, and the initial scene. Current WorldIntegrationBoot has changed; use a narrow patch rather than replacing it with an older file.
5. Build a new independent version directory. Do not replace existing test packages, upload to WeChat, publish a release, force-push, or merge this candidate into a shared branch as part of this stage.
6. Do not mix failed h2b, fixed-foot experiments, or unfinished knee compensation into this frozen snapshot.

## Evidence and remaining work

The included historical structure audit passed 33 assertions, preserving original BIN data, BODY0/non-shoe body parts, 504 bone tracks, nodes and skin. Reported geometry checks covered 345 walk samples with crossing-pair sets unchanged relative to the production-body+h1 baseline, and 384 poses with exact h1 shoe coordinates. Existing intersections remain. These are discrete CPU observations, not continuous collision or GPU proof.

The included runtime report is CPU/mock-only: 1,800 times and 416,878 assertions, maximum native/metadata weight difference 2.965e-8. It does not prove Cocos importing or rendering. The normal-reference residual includes DRESS maximum 9.067471 degrees on an extremely thin triangle; no all-vertex normal pass is claimed. Inherited repeated animation input times in sit/stand clips remain unresolved.

The skirt can still retain a bulge after the knee retreats. Physical release/fall-back refinement continues separately and is not present here. Start/stop/turn, sit/stand, chair contact, real grounding, and GPU normals still require validation. This snapshot is not a statement that those checks pass.

## Tools and reproducibility

Requirements: Python 3 and NumPy. No credentials, package caches, renderer caches, personal paths, or generated game builds are included.

Run `python tools/verify_snapshot.py` from this directory. It checks the manifest, frozen hashes, mesh/target mapping, new curve times, normal-only positions, and shoe structure. It does not run the game.

`tools/merge_h1_shoes.py` is the portable form of the exact append-only merger. It requires source model `4daf91c1a172d3a97a3f042279c94a1a784794cf9c05e64b87380e9605a311fc`, source metadata `b60faae0fe44e8ae1be710cf42cfe9c60ba7cda5f6055050ff21ba2ae6625273`, and h1 input `c7da4672f9e0f42191b65cbc744d46ef7a6ddc6cf307c0bf5e40889250fc486a`. It refuses existing output files and enforces input hashes. Re-running it on those retained inputs reproduced both frozen output hashes exactly. Example: `python tools/merge_h1_shoes.py --source INPUT.glb --source-meta INPUT.json --h1 H1.glb --output-dir NEW_OUTPUT_DIR`.

`tools/convert_targets_normals_for_runtime.py` preserves the skirt target-transplant implementation with explicit reference inputs rather than workstation paths. It additionally checks reference and preview-metadata hashes. Inputs: production model/meta above; reference `2d902b2c944036d233c264f04540d9f351aeee26df5048b61438b99aa0d850d3`; r3 preview `f26c2276f82f006e34e0f85b934ae51b8290833371b8d8592bc5d34d8bba81fb`; preview metadata `4615d4356019fed2ecc0a32387dba072e4f5c5daddc870fb92f2227025660e39`. Re-running this portable converter reproduced `4daf91c1…` and `b60faae0…` exactly. Use `--help` for required paths and hashes. Source/reference/intermediate models are retained outside this small stage snapshot; they are not embedded again here. This is an integration-stage snapshot, not a complete archival copy of every sculpting experiment.

The evidence JSON files are historical reports and preserve their original limited scope. `manifest.json` records every staged file hash except itself. Publication receipt and remote verification are separate from these source artifacts.
