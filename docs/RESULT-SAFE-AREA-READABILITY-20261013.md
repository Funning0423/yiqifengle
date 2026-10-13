# Result safe area and readable content flow

## Scope and integration

This is a follow-on to the frozen `cc266398992fab17e435b817124b5a8462260dbe` result viewport repair, based on manifest-only commit `a0841352f42ecbc1a23f4f4a3e7d053a3a52d460`. It does not replace or rewrite the separately frozen stage-4 engine-test source. Only `ManagedMobileBoardUI`, `PopupKit`, `BoardPanels`, this document and the safe-area/reward-width regression tests are changed.

`ManagedMobileBoardUI.layout()` still clamps its logical viewport to at least 240 × 320. Its existing CSS/WeChat safe-inset calculation is now passed into `PopupStack` as an optional `safeInsets` field. `PopupPanel` passes that value to an opt-in result layout strategy, retains it across animation updates, and cancels held gestures when insets change even if the frame size does not. The full-screen shade remains full-screen. Other popup layouts are unchanged.

The Result panel reserves the capsule's entire top band, takes 12 logical units of margin inside the resulting rectangle, and uses its true asymmetric center. This intentionally prefers avoiding the menu capsule to filling every available corner. Insets are logical coordinates from the existing host, not a new device-pixel measurement.

## Readability and reachability

- Fixed main actions at the bottom: 48-unit hit height; two actions sit side by side. The minimum opening factor remains 0.92, leaving at least 44.16 logical units of hit height.
- Body and action text stays at 16 logical units, at least 14.72 during opening. Ordinary scores are 20/24, and fallback titles are 18. The tested safe-integer extreme uses 20 or the same 16-unit body floor in compact layouts so their full digits fit together on one page. Small baked title art is replaced with the same title at readable size instead of shrinking it further.
- Content rows reflow into finite pages when they cannot fit. The header has 48-unit previous/next controls and an explicit page count. First/last controls disable at their bounds. Page changes cancel all held gestures and invoke no claim, navigation, exit or save callback.
- Stars, scores, instructions, remaining goal icons/counts and all rewards remain reachable. At ordinary 568 × 320 with default landscape insets, a two-reward win fits on one page. At a 320 × 320 host with its default capsule band it uses four pages, with Next/Home always available.
- Fixed protection, loss and chest explanations stay together on one page. Long labels wrap into separate readable rows/pages. If a reward's full label cannot fit on its button, the full label is shown immediately before the concise claim row; it is not ellipsized or silently dropped. Production action callbacks and nodes are retained.
- Width fitting uses Canvas text measurement when available, never less than a conservative one-em-per-codepoint bound (half-em spaces). No body text uses automatic font shrinking. Independent Noto/Pillow glyph-width diagnostics supplement node tests, but do not certify Cocos font fallback or rasterization.

## Bounded support and formal host fallback

The readable-action contract requires a remaining safe rectangle of at least 216 × 196 logical units, after capsule exclusion. The checks certify only the listed sampled frames/insets, not every possible device/window geometry.

If the host produces less space, the Result panel cancels input and deactivates all claim, main-action and paging nodes. It keeps the full-screen modal guard and shows a 16-unit message: “空间不足 / 请旋转屏幕 / 或放大窗口”. If even that text cannot fit, it is hidden rather than drawn outside the safe rectangle. Increasing the window or rotating back to sufficient space restores the original actions. There is no automatic exit, retry, claim, write or safeguard bypass.

This fallback is an explicitly unsupported geometry outcome, not a smaller-screen accessibility pass. A real 239 × 240 host, logically clamped to 240 × 320, plus larger CSS insets is one recorded case. The original pre-fallback raw rows were lost in the cloud environment reset. Their earlier counts are historical tool receipts only; freshly rerun baseline and unsupported-geometry records are kept separately in the recovery evidence.

## Reproduce

Run from this source checkout:

    QF_TYPESCRIPT_MODULE=/workspace/scratch/8bf3a2cbf3a8/qifengle-recovery-20261013-1411/dependencies/node_modules/typescript \
      QF_RESULT_SAFE_OUTPUT=/path/to/separate/output \
      node tools/board-ui/test_result_safe_area.cjs

`QF_RESULT_SAFE_SOURCE` can point at an exported older source for a negative control. Test output records source hashes, sampled logical safe rectangles, every active node rectangle, all reachable text/actions, host clamping/CSS/WeChat integration, pointer/lifecycle checks and explicit unsupported rows. Its SVGs are measured node diagrams, not Cocos screenshots.

The previous `test_result_viewports.cjs` remains unchanged so its original evidence is reproducible. Its “all actions simultaneously visible” contract and exact action list do not describe pagination. Its unadapted failures must be reported. The old pointer/lifecycle assertions can be replayed with a transparent in-memory fixture adapter that reveals a paged action before a fresh tap; production handlers and held-release assertions must remain unchanged. The new safe-area matrix is the geometry/full-content gate for this version.

## Protection and unverified boundaries

R4 read-only Home still uses the existing safe-exit flow with no storage attempts. Unsaved results still require explicit RetrySave and cannot bypass refused Home exits. Asynchronous claim-state updates replace the prior result, and modal return exposes the new claimed state without reviving the old action. Late asset loads do not restore an old result layout. This UI change does not clear saves, unlock protection, change permissions, or resolve the separate board-freeze incident.

Not validated here: Cocos Creator semantic compilation or rendered pixels, actual default/fallback font shaping and wrapping, sliced-art quality, native input/camera/DPR projection, physical safe areas and menu capsule behavior, screen-reader/keyboard navigation, device storage, or Mac/WeChat acceptance. Pillow glyph diagnostics and node SVG/PNG evidence are not engine screenshots. The existing Reward/Pause/other popup geometries are outside this result-only change.

## Recovery provenance

The execution environment reset after the original candidate was committed. The three production files and the new test were rebuilt from visible write records, and all four SHA-256 values exactly match the printed receipts for `4fbad2a34dceb2b5ba391fa8440b5bee5986c4ba`. This recovery has new Git identities. The old final 15-suite run lost its completion receipt and is not counted as completed. Validation is rerun in the recovered environment with official TypeScript 5.9.3; the original compiler version was not retained. This documentation is updated for recovery, not claimed byte-identical to the old document.

## Review correction: reward label width

Independent review of recovered `dd0d849f57ddc4d36aeba9b2d119583cb880493e` found a real four-unit mismatch: the long-label decision allowed `cell - 72`, but the CLAMP label was only `cell - 60 - 16`. Seven-character “领取工具大礼包” at a 224-wide safe rectangle and eight-character text at 240 could therefore lose glyphs without a full-text row. The previous safe-area matrix and glyph sample set did not cover this boundary and cannot certify it.

The corrected code shares the button text inset and reward icon lane between actual label sizing, the long-label decision, and the paired-column decision. It uses the same available width for all three. Equality fits; a measured width larger by any amount produces full readable rows (or prevents pairing). No text size or storage flow changes.

Run `node tools/board-ui/test_result_reward_width.cjs` with the same absolute `QF_TYPESCRIPT_MODULE` above. Optional `QF_RESULT_SAFE_SOURCE` supplies an exported negative-control source; `QF_REWARD_WIDTH_OUTPUT` saves the complete matrix. It probes the exact boundary and both sides in no-Canvas, document Canvas and wx Canvas branches, one/two rewards, ready/claimed/locked states, loaded/fallback art and animated/reduced motion. Canvas values are controlled metrics, not actual Cocos glyph measurements.
