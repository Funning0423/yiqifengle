# Three-region integration acceptance

Scope: the original twelve-stage mainline, island → rainbow bridge → meadow at 04→05, and meadow → skycity at 08→09. Tests must derive progression from real controller actions in an isolated in-memory store. No normal save editing, injected completion counters, character replacement, remote publication, or user computer use.

## Evidence levels

- **Source identity:** all 2,244 frozen-manifest files hash-match before changes.
- **Logic:** real CommonJS/TypeScript production controller code with explicit engine/asset doubles. This proves only tested contracts, not rendered appearance.
- **Official build:** Creator 3.8.8 build tied to exact source fingerprint, build options, scene and bundle inventory.
- **Rendered acceptance:** real official build in a supported WebGL browser, screenshots/video and console evidence from the same build. Node doubles, generated thumbnails, an HTML mock, and an old native package cannot pass this layer.
- **Device acceptance:** physical-device/WeChat behavior, only if separately executed. Never inferred from browser behavior.

## Independent acceptance matrix

| ID | Scenario and required observation | Automated evidence | Rendered evidence still required |
|---|---|---|---|
| J01 | Fresh progress opens only island; meadow after exactly 4 legal saved clears; skycity after 8. Challenge gates remain 4/8/12. | Controller replay + campaign and host gates | Locked/available cards and actual taps |
| J02 | Mainline 04 victory → explicit next → load target → walk across continuous seven-color bridge → arrive meadow → 05 board. One avatar, no teleport/camera cut, no card-only substitute. | Transition intent, route continuity, distance signal, one level lease | Continuous video from 04 result through 05 board |
| J03 | Mainline 08 victory → skycity journey → 09 board, then return to skycity. | Transition + levelOrigin + current-region exit | Continuous video and destination screenshot |
| J04 | Target bundle/prefab/material/anchor failure preserves saved result and prior world; retry actually reloads; no silent fallback or success text. | Failed dependency injection + retry | Failure UI and recovered journey video |
| J05 | Pause/hide while loading, walking and inside board preserves exact progress; show alone does not auto-move; explicit resume continues without jump. | Cancellation + distance checkpoint + board lifecycle | Background/foreground and resume capture |
| J06 | Double click, stale async completion, cancellation and disposal never create duplicate scenes/boards/rewards or mutate old ownership. | Controlled deferred promises + repeated input + lease counts | Repeated touch stress with scene counts |
| J07 | Reward/chest claims survive retry/reopen/cold controller creation and grant once; repeated claims cause zero extra writes. | Real reward receipts + byte-for-byte store equality | Result/claimed labels after reopen |
| J08 | Failed active or journey write never shows saved win, unlocks destination, accepts more board input or loses pending work; explicit retry records one win. | Before-write failure at both durable boundaries | Save-failure/retry UI |
| J09 | Broken JSON, future/invalid schemas, inconsistent records and external revision changes preserve bytes, expose read-only recovery and cannot unlock travel. | Corrupt isolated save + raw-byte invariance | Recovery screen; no hidden destructive reset |
| J10 | During animation/scene load/travel/pause/result lock, board actions and navigation cannot overlap; old callbacks are harmless. | Input ownership and generation tokens | Real pointer/touch routing |
| J11 | New metadata preserves frozen mainline engine/replay rules and real shipped seeds; all 12 stages remain completable. | Source/engine identity + legal replays | Playability/readability check on 05–12 |
| J12 | Current scene and all three region bundles/art exist in the exact official web build; preflight never reports a stale/missing build or software/non-WebGL mock as accepted. | Web artifact audit | Real GPU/WebGL screenshot + console |

## Current disposition

Source identity: PASS (see reports/baseline-verification.json).
Logic/build/visual statuses are recorded separately by executable tests. Current cloud browser WebGL and a formal Creator Web build are unavailable; rendered and device acceptance remain **BLOCKED/NOT RUN**, not passed. A passing Node suite does not close J02/J03 or any visual column.
