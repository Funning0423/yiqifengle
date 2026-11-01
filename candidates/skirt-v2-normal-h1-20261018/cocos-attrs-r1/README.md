# Zero-NORMAL compatibility repair for the frozen h1 stage

Prepared by Oi, Funning's assistant, on 2026-10-18. Additive follow-up to candidate commit `195e1c0e9b9334e040b41745d1cec37a3aabcf8f`; original snapshot files remain unchanged.

## Why this revision exists

The actual Mac Cocos importer rejected the previous `af5c0efa…` model: "glTF non-conformance error: Morph attributes in all target must be same". Earlier structural and CPU verification did not cover this importer requirement.

APRON geometry targets 29–36 and DRESS geometry target 32 had POSITION only. Other targets in those primitives included POSITION and NORMAL. This revision adds a zero NORMAL reference to exactly those nine targets, backed by two appended zero float32 VEC3 accessors (690 and 5,721 vertices). It adds 76,932 binary bytes; all original BIN bytes remain an exact prefix.

## Frozen identity

- Source model in the parent directory: `af5c0efa865211679610a785c39bdf19a1c8ea5720be8fa769ddae06da90c20d`
- Source metadata: `aeaa23399c6dba01871f8303da704e5ca053e5b56c11398125ce6aa1587249bb`
- `character-skirt-v2-normal-h1-cocos-attrs-r1.glb`: `8a79b26ec12d4e248abe14310dd75febca433a15097b1f22ea94144cd3f5a592`
- `anim_meta.json`: `6d775f7779127f2254aa18f243f7cd2a0fcba177564c8ca1c921eed42684182c`

Metadata differs only in the GLB filename. AP53 / DRESS49 / BODY16 target counts, target names, weights, 504 skeletal channels, and zero native weights channels are unchanged. No geometry sculpting, replacement NORMAL fit, h2b, knee compensation, or contact-solver change is included.

## Evidence and limits

`cpu-verification.json` is the independent audit report for these exact files. It verifies old BIN, accessors, original accessor values, metadata, and the exact allowed JSON changes. Canonical target delta arrays are identical when an omitted NORMAL delta is interpreted as zero. Its 345 walk times compare 690 APRON/DRESS poses with exact position and final-normal equality.

This is CPU and file evidence. Actual Cocos re-import, build, and GPU testing remain pending at publication. The old foot-frame `sole_contact` is still incompatible with shin-bound h1. Preserve the isolated Mac h1-preview gate that disables that old compensation for this character. Do not claim correct grounding or a completed game package from this repair.

Before the next guarded build, complete the isolated Creator import, inspect generated .meta changes (UUIDs, subMeta mappings, NORMAL settings, and clip splits), and commit only the verified import changes so the worktree is clean. Retain the original failed-import log and metadata diff. Do not suppress the guard warning or deliver the failed output directory.

The original package's other limitations remain, including knee-release bulge, sit/stand/turn/contact checks, inherited sampler duplicates, and thin-triangle normal residuals. No active production assets or other branches are changed by this commit.

## Reproduce and verify

`repair_cocos_target_attributes.py` requires Python 3 only. It accepts explicit source/model paths and a new output directory, checks the frozen source hashes, and refuses output overwrite. From this directory:

`python repair_cocos_target_attributes.py --source ../character-skirt-v2-normal-h1.glb --meta ../anim_meta.json --out-dir NEW_OUTPUT_DIRECTORY`

The portable repair was re-run and reproduced both frozen output hashes exactly.

`verify_repair_structure.py` requires NumPy and imports the parent directory's `tools/glb_io.py`. It compares the retained original and corrected models, checks the manifest and exact repair envelope, and prints a limited structure result. It does not replay Cocos or claim a fresh 345-frame run; the historical CPU replay is the separately labeled report. Run it from anywhere with `python verify_repair_structure.py`.

`manifest.json` hashes the files in this repair directory except itself. `repair-manifest.json` is the repair record with paths expressed relative to this directory for portability. Original source blobs and original audit evidence are retained in the parent directory and previous commit.
