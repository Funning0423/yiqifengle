# R4 Cocos adapter contract

## Import boundary

All runtime files are CommonJS. Keep them together so relative imports resolve. The integrator must verify Cocos Creator's chosen JS/TS interoperability in the actual project; the provided declaration is a type reference, not proof that import succeeds. Do not copy the rule algorithm into a Component.

Construct one ChallengeController per active pack with:
- platform: synchronous load/save backed by a single-writer local store
- journey: the existing main-progress object or immutable live read view
- catalog: optional; defaults to the unchanged R3 c01 catalog
- attemptIdFactory: optional unique per attempt; never reuse IDs across stages

controller.snapshot() returns deeply frozen copies. Logical index is 0..48 on a 7×7 board; type is 0..5, never a texture/model identifier. Use active.theme and active.stageId to choose art. Animations must not consume or alter the rules RNG.

## Host seam

adapter/cocos-port.js exports createSynchronousStorage(localStorage) and bindChallengeController(controller, view, lifecycle).

view.render(snapshot): render lists, detail, board, goals, result, and explicit storage error. Snapshot board is authoritative current logic; while resolving, use visual snapshots to animate between states. Keep stable tile IDs.

view.animate(visual, snapshot, done): animate action, clear or drop; call done once on success. The controller still rejects duplicates. Do not call Engine or change goals from this callback.

view.cancelAnimations(): stop tweens when visibility, navigation or generation changes. Any late callbacks remain harmless.

view.onError(error): optional view-animation diagnostic. A thrown animation error causes the host to settle/pause the committed turn and render the error-safe state.

lifecycle.onHide/onShow/offHide/offShow: register and remove callbacks. A Cocos integration may map these to actual game EVENT_HIDE/EVENT_SHOW after verifying the project APIs. onShow does not automatically resume a paused challenge.

The host's command(name, ...args) forwards documented controller inputs and refreshes. It never grants inventory, writes old progress, or automatically claims a memento. Preview tokens come from command('previewAction', action); explicitly submit that token with command('commitAction', token).

## Required scenes and buttons

- Challenge book/region list: use snapshot.regions, snapshot.stages, selectedStageId and unlocked.
- Detail: selectStage(id), then startStage(id, {seed?}); production seed must be in that stage's verified bank.
- Run: preview/commit. Keep input disabled except run.ready. Run-preview confirmation may be immediate after a gesture, but cancellation must remain uncommitted.
- Pause: onHide; show a Resume control after onShow; use resume or resumeActive.
- Result: only result.saved enables exit/next. Next = requestExit, selectStage(nextStableId), startStage. Do not splice challenge ordinal into main progression.
- Save failure: show retrySave and keep the same attempt. Read-only: show preserved-data error; no destructive reset shortcut.
- Leaving a playable run: requestExit saves it for resume. New attempt requires explicit discardActive before startStage.

## Animation phase ownership

preview: engine unchanged; plan includes tiles and prospective wave. This is not a committed clear.
action: action has been committed exactly once; visual.tiles gives swap endpoints. When complete, acknowledge its token.
clear: visual.wave is the original Engine wave copied into arrays/plain data. Animate removed, created, specialTriggered, effects and obstacleHits. Do not submit those arrays back as a replacement wave.
drop: clearWave and fall have been committed once. visual.changes gives moved/spawned stable IDs and from/to indexes; negative source rows mean spawn above board. Acknowledge its token after movement.

The next token replaces the previous one. Every callback must capture its exact token, not read "current token" when it fires. The host demo follows this rule.

## Persistence and reward ownership

A crash-recovered action intent is irreversible and finishes to a stable checkpoint. Recovery cannot refund the move or let a new random seed replace the committed move.

Victory order: stable terminal checkpoint → independent progress journal → matching active receipt. On retry, the same attempt ID deduplicates. A restored receipt is accepted only when matching the replayed outcome and persisted journal attempt. Unknown/corrupt or exhausted formats remain untouched/read-only. Snapshot events are ephemeral UI notifications, not a grant queue.

No online/cloud atomicity or multi-device merge is implemented. Use the local synchronous boundary as specified; any asynchronous server sync needs its own explicit reconciler and acceptance tests. Never implement it by returning a Promise from save and pretending it succeeded.

## Acceptance still required in the real project

1. Verify actual CommonJS/TS import, dependencies, build and release packaging.
2. Bind actual scene nodes and existing themes; no new asset requirements are implied by this package.
3. Test taps, double taps, background/foreground, component destroy/recreate, result retries, navigation and stale tweens in the editor.
4. Verify actual storage errors on the platform and that legacy keys remain unchanged.
5. Run complete scenes on the intended iPhone and midrange Android; profile memory/frame rate/load time.
6. Separate expert-player difficulty, visuals/collision and phone acceptance from the headless tests shipped here.
