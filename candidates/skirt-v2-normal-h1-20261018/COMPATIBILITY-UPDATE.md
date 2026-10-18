# Cocos import compatibility update: 2026-10-18

The original `af5c0efa…` candidate in this directory failed actual Mac Cocos import with:

> glTF non-conformance error: Morph attributes in all target must be same

The initial structure/CPU checks did not catch the importer's requirement that morph target attribute sets match. APRON targets 29–36 and DRESS target 32 had POSITION but no NORMAL, while the other targets included NORMAL.

The additive repair is in [cocos-attrs-r1](cocos-attrs-r1/README.md). It supplies zero NORMAL deltas for those nine existing geometry targets using two shared zero accessors. It preserves original geometry, original NORMAL data, h1 shoes, bone animation, and morph timing. The original files and evidence remain unchanged for traceability.

The corrected candidate is SHA-256 `8a79b26ec12d4e248abe14310dd75febca433a15097b1f22ea94144cd3f5a592`, with metadata `6d775f7779127f2254aa18f243f7cd2a0fcba177564c8ca1c921eed42684182c`. It is the next input for isolated Cocos re-import. The previous candidate must not be described as import-ready based on the earlier CPU evidence.

At this snapshot, real Cocos re-import/build/GPU confirmation is still pending. The h1 old-foot-solver preview gate must remain in place. Knee-release refinement and the actual Mac stage patch are separate work; neither is included in this compatibility update.
