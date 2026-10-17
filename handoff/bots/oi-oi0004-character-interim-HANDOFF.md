# Local Cocos incremental handoff: 0004, approved loading art, interim B

2026-10-09. Isolated project `cocos-wechat-world-r5-e2fix-20261009`, branch `cocos/wechat-world-r5-e2fix-20261009`. Patch base `4ba0580`; do not apply over uncommitted files or old projects.

## Environment
Mac M4 Air 16GB, macOS27.0.1 arm64. Official Cocos Creator3.8.8 actually imported and built. WeChat DevTools Stable2.02.2608080, observed simulator library3.17.3. Blender is not installed locally; source Blender4.5.14 is not local installation evidence. No new legal agreement, payment or account login accepted.

## Implementation
Reviewed 0004 first three fixes only: new attempt after loss/recorded win, tool drag feedback and reward button placement. 0004b and separate R5 reward ledger were not imported. Distinguish original EventTouch event code when Cocos node TOUCH_CANCEL forwards a normal release outside the source node; actual system cancellation consumes nothing. Guard optional CSS safe inset queries.

Real start/resource loading progress and failure retry. Approved historical loading image SHA256 `308f78b5f037bd33668ff8ad899649ee6094b8e55cf695cf7df62a195b7e8e8d` confirmed by source.

Exact interim B GLB SHA256 `054da436278dd48f1165e3c4f58be1ce100d85a4f86420725e4d6bbb46e99112`, Creator generated meta, original root scale1, no second K. Actual idle and complete initial home framing passed. No sit/stand/walk/door clips were delivered: displayOnly=true, motionAcceptance=false. Island/return camera and motion remain unaccepted.

LegacyJourneyReader.ts already integrates the authorized v1/v2/v3 reader, source SHA256 `a58d6cee97cb2e4e062170e82ff0771464bdb8fe36779dd52e0f417d12a9465a`. Three historical keys are read through a port without save. Actual sys.localStorage writes use only `dot-mainline-r1-isolated-20261009:`. Tests create fresh owned browser profiles, with no user save injection.

The controller owns world displacement in the current implementation. Proposed clip-owned transitions need formal 0006 source/SHA and translation, rotation, collider, cancellation/skip recovery contracts, with the controller paused and exactly one displacement owner. Not applied. This is an unverified interface migration, not a user prohibition on all root-motion.

## Actual verification
Official Creator Web and WeChat builds finished, exit36. Logs included. Actual game.json package gate PASS: main1819486B, total26304258B; resources/island/sky declared as subpackages. Retain the already verified builder.json bundle overwrite profile; withdrawn folder flags were removed.

Web actual Cocos touch PASS run `5293c7d4-5dfb-4f27-8c3b-6231fc8670e9`:11 actual swaps win, chest once/duplicate zero grant, return home/new browser process exact storage equality, next stage,22 actual swaps loss/retry new attempt, outside drag no consumption, genuine system touchCancel no consumption, valid tile24 drop consumes1. Game errors0. One Chromium noncancelable touchcancel warning remains preserved in browserWarnings; no zero-browser-warning claim.

B Web test PASS_DISPLAY_AND_IDLE_ONLY: full projected bounds inside viewport,3 meshes, scale1, idle time advances, reference capsule hidden. Desktop120 actual AFTER_DRAW samples observed15drawCalls/52496tris. These are not WeChat GPU, whole-process memory, phone fps or heat acceptance.

WeChat normal input in this project's uniquely named window: approved start/loading, real room and full interim B, island, board, actual swaps, valid bomb charge consumption, outside drag no consumption and visible prompt, win670/3stars/saved, chest label owned and repeated click unchanged, return island. Actual paused attempt restored after simulator restart. After the win and normal Tools Compile restart, normal start/leave/mainline input entered stage02, titled 苔径初开, moves25/target7/shell10. Screenshot wechat-cold-next-stage.png verifies retained stage progression. Exact inventory duplicate zero-grant assertions are Web evidence; screenshot labels alone do not establish WeChat byte equality.

## Reproduction
Build with tools/web-world-r5-playable-build-options.json. Freeze a complete copy of the generated Web tree before long tests; concurrent Creator builds delete live preview assets. Run `python3 tools/serve_cocos_preview.py 8790 [frozen directory]`. Set QF_TEST_URL=http://127.0.0.1:8790/ and QF_BUILD_DIR=[frozen directory], then `node tools/test_playable_loop_0004.cjs`. Dependencies resolve through tools/qf-env.cjs.

After WeChat build, run tools/finalize_wechat_local.cjs with the generated output directory and the package gate. Only completely empty generated compile conditions are removed; active conditions are rejected. AppID wx3bdd911c5c06f591.

## Open acceptance
Full B actions/clothing/hand contacts, continuous door/camera motion, island framing, complete WeChat loss/retry, fresh-project initial startup stability, exact WeChat reward inventory assertions, phone fps and heat. No automatic application of0004b, sky v3/robot or0006 interfaces. No WeChat upload or publication; old projects remain recoverable.
