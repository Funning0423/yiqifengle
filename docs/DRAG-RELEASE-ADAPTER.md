# Drag-release adapter (Cocos 3.8.8 bounded candidate)

The test-only checkpoint `100db91c768a22320980f1703069497cac86e6e9` preserved the stage5 negative control. The subsequent candidate changes only `ManagedMobileBoardUI.ts` production code, based on frozen stage5 `d3cbc66e22b5683e43f2669febf456d314b45fdf`. QF-BOARD-FREEZE remains open: this is only the separately identified drag-release adaptation subitem, not the original user现场 root-cause closure.

## Confirmed source contract

Official Cocos v3.8.8 `EventTouch` constructs its private event code from the input event type. The public, deprecated `getEventCode()` method returns that stored value. `NodeEventProcessor._handleTouchEnd()` changes the public node-dispatch `type` to touch-cancel when the release position misses the original node; it does not replace the stored code. The genuine cancel handler dispatches cancellation. Consequently node dispatch type alone cannot distinguish a normal outside-node release from a system cancellation.

Primary sources read through the official source webpage:
- https://raw.githubusercontent.com/cocos/cocos-engine/v3.8.8/cocos/input/types/event/event-touch.ts (constructor/getEventCode, lines79–93)
- https://raw.githubusercontent.com/cocos/cocos-engine/v3.8.8/cocos/scene-graph/node-event-processor.ts (node touch dispatch, lines568–644; destruction-generated cancel, lines166–179)

No private field name is used as an unverified application contract. The method is deprecated; any future engine upgrade needs a new source audit. Downloading official source files was interrupted by the execution approval mechanism and was not retried through another route. No locally downloaded engine files are claimed.

## Regression model and negative control

`tools/board-ui/test_engine_drag_release.cjs` runs actual production TypeScript and the actual mainline controller with isolated storage. An explicit two-layer event double models raw input code separately from node dispatch type and supplies currentTarget/target, pointer ID and coordinates. It is derived from the reviewed engine contract, not an execution of the actual Cocos engine, browser or physical input.

Run with an absolute official TypeScript path:

    QF_TYPESCRIPT_MODULE=/path/to/typescript \
      QF_DRAG_REPORT=/separate/evidence/report.json \
      node tools/board-ui/test_engine_drag_release.cjs

`QF_DRAG_SOURCE` optionally points to another immutable source tree, including a negative control. It does not mutate that source.

The original71-check stage5 negative control yields20 failures (preserved with its exact historical test hash). Eighteen failure assertions require legal owned raw-end releases to commit, including touch/mouse-simulated input, UI y-down/screen-calibrated channels, foreign-pointer ownership recovery and unchanged layout. Two extra failures are stronger-than-real-dispatch stale callbacks after a single node has already been destroyed: the current double retains listeners, exposing unsafe paint calls. Those are diagnostic stress cases, not a claim about observed Mac dispatch.

True raw-cancel, missing/throwing/wrong raw code, invalid dispatch identity, foreign window, outside/NaN/origin endpoint, stale board version, modal coverage, hiding, disable, rotation/inset changes and board teardown are explicit negative cases. Existing79 input-ownership and24 tool suites deliberately reject a bare cancel emit even if its optional code says end; the future adapter must preserve that by requiring genuine dispatch context, current source-node identity, a valid owned pointer and trustworthy endpoint. It must not treat all cancel events as release.

## Matched Mac evidence and narrow implementation

The parent supplied excerpts of already recorded `STAGE3-R4-LATE-DRAG-RESULT-20261013.json`:

| JSON path | input | subscribed node kind | originalEventCode | pointer id |
| --- | --- | --- | --- | --- |
| $.nodes[2] | normal touch release | touch-cancel | touch-end | 81 |
| $.nodes[5] | true touch cancellation | touch-cancel | touch-cancel | 82 |
| $.nodes[13] | normal mouse release | touch-cancel | touch-end | 0 |

All three record `startCellHit=false` and `destinationCellHit=true`. The captured original code came from `typeof e.getEventCode === 'function' ? e.getEventCode() : null`. The original log did **not** capture `e.type` or the private field; those are not claimed as measured facts. Actual mouse cancellation was not tested. This author received the excerpts through the parent and did not access the Mac or full original file.

The source audit and recorded original-code access agree, allowing the narrow implementation:
- Only a CANCEL handler on the current live source node can adapt an owned pointer.
- The public `getEventCode()` must positively report `touch-end`; absent, throwing or any other result stays cancel.
- The official dispatch context must have node type `touch-cancel`, target/currentTarget equal to the source, and the tracked window. These context checks are source-audited and covered by the new double, but await real-engine validation because the prior Mac log did not record them.
- Source hit test must currently miss and the finite calibrated endpoint must independently hit the board. No old aim, old receiving-cell hint or PR52 origin rollback can authorize adaptation. Piece endpoints must be orthogonal neighbors. Tool use still runs its existing availability/version/release checks.
- State, version, visibility and modal guards remain. Genuine cancels and foreign pointer events keep prior cancellation/ownership behavior. A changed board layout clears held input immediately; identical layout does not. Invalid/stale source nodes clear state without repainting destroyed nodes.
- Existing normal-END, popup/button and save/protection paths are untouched. Bare cancel emits carrying only an end code still cancel, preserving the previous input/tool contracts.

The two-layer tests also use recorded pointer IDs81/82 and mouse ID0. They do not execute the engine mouse-conversion chain; the fixture leaves `simulate=false`, matching the official conversion default. The marker alone is not real mouse delivery. They include a synthetic mouse-cancel negative control, explicitly not a previously observed Mac mouse-cancel result. The same test must run against the frozen stage5 source as a negative control and the candidate as a positive control. Full old suites and Result/protection tests must be rerun before handoff. Independent review and actual Cocos3.8.8 Web/device verification remain required. This repair does not close QF-BOARD-FREEZE.

## Independent review corrections after0180464

The0180464 candidate was blocked by independent review: START in window0 followed by the same pointer's MOVE in window99 changed mutable `sw` to99, allowing a later raw-end/node-cancel in99 to swap or spend a bomb. This is a verified node-model guard gap, not an observed Mac cross-window incident. The old018 source and its evidence remain preserved.

The corrected owner records `originWindow` only at START. Common pointer ownership requires both pointer ID and that immutable window; wrong-window MOVE/END/START/CANCEL cannot change tracked geometry or ownership. A valid origin window must be finite. Missing/NaN/infinite START windows never acquire a gesture. Non-owner events are ignored rather than permanently invalidating the original owner, consistent with foreign-pointer handling. On returning to the original window, origin/outside/true-cancel endpoints do not commit; only a new explicit valid owner endpoint can authorize an action.

The cancellation adapter additionally requires `cells[hit].UITransform.hitTest(screen, originWindow) === true`. Its UI-coordinate calculation and `releaseHit` are related computations, not independent physical hit evidence. A claimed UI neighbor with an outside or different screen destination is rejected. Normal-END PR52 compatibility is unchanged.

`test_engine_drag_window_ownership.cjs` tests both the adapter and the app's direct-END compatibility branch. Direct-END cases are explicitly branch tests, not a claim that the engine emits END on a missed source node. It covers0/nonzero origin windows, wrong-window MOVE→END, restoration to origin/outside/true-cancel/valid endpoints, owner geometry remaining byte-for-byte unchanged after foreign samples, and invalid START windows. The two-layer suite retains its original71 scenarios and adds4 screen-destination disagreement cases.

Board geometry currently uses conservative full-structure comparison: a changed capsule position or other geometry metadata can cancel an old drag even when tile positions are unchanged. This can be over-conservative but cannot convert a cancellation into an action; narrowing this policy is outside the current correctness repair. Actual Cocos/Web mouse conversion, true mouse cancellation, OS multi-window delivery and the new dispatch-context checks still require engine/device acceptance.
