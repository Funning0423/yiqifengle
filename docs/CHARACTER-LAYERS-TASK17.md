# Task17 late sit-down cloth repair — OPEN

Fixed input 6160801354a9e2a9cd98c393cdb312840bc05d7e. Adjust only existing late sit-down envelope deltas and corresponding target normals. Local welded apron projection against the posed dress: max 2.886mm. Dress projection against posed legs: max 1.204mm. Fit includes task16 actual crossfaded skeletons and morph weights. No new targets, base geometry, skin, animation, metadata curves, body/boot or UI changes.

CPU dense 80→59 failing poses; all381 133→112; no per-pair count increases. Task16 actual136 blended frames replay:39→29 with no increases. Additional125 samples .59–1.21s: no increases. This replay does not replace a new native natural-route test.

Remaining early sit-down skirt/leg penetration, incoming stand-up hand/wrist, heel appearance and all unaccepted scope remain OPEN. Do not freeze or publish.

## Native verification (cd13c58)

Fresh single-window s14 natural route starts from home/sit_hold and completes stand_up,90-degree turn,walk_start/walk_loop,walk_stop/door_reach,stable island,180-degree return turn,walk/return and sit_down to home/sit_hold. All137 distinct actual engine frames (70stand_up,67sit_down) exported in contiguous chunks with original TRS/morph weights: same-pose task16→task17 failures39→29, zero per-pair increases; stand14→14,sit25→15. This is separate from the prior136-frame replay. Multiangle/normal-view screenshots inspected; chair-occluded regions do not prove passing. Early wrist and walk apron yellow spots remain open.

Actual BUILD_SHAcd13c58; GLBe1a3415bb58b2de2a517e2ad594af89da11281e2a47295e60663bb8e9ce031b1; meta68c12ada03999c7c14195f4eeb4d93970713857d5d8b73515af21f23a5e8d572; motion3ef288ff12a8f8512e07a3ea2f94819e984cc70a9d9d4a38b5a9c69e1523b657; prefab dce9f061-7913-4893-9eb9-35e039adda3c@6af54. Package509files31218252B, canonicalSHAc34aa317c9ad9c121f0cee392bdd25ece2d2a2bb889b58fd2730c951bce8102d.

Inherited task16 actual508 fixture: all posed mesh positions exact;725calf faces versus boot leather/sole remains0crossings. This is preservation evidence, not a new task17 controlled foot test or whole-foot acceptance. Late envelope7/8normal recomputation has max1.49e-8 numerical change without position changes; original pre-envelope target attributes remain exact.

Official Creator3.8.8generated output but returned36; retained log includes build-script SIGTERM and completed build-task output. Not clean CLI success. Onlys14closed,IDEkept running. Formal80storage/479package and prior2229source/509package files retain byte hashes. Library official helper attempts2, no confirmed new IDs. No publication,push,formal-state semantics or credential/permission changes.
