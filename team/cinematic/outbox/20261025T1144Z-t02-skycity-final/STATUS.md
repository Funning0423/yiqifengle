# T-02 skycity finale — 运镜bot (option C)
Branch cine/t02-skycity-final. Base 977711f0, plus merges of ggbot/cand-b18-stage (d050422a, and the d9423886 tip in 75f156e1).

## Option
- A2 is infeasible. With fov ≤ 60 and no upward tilt, no pose puts any ring arc in the upper half of the frame: the best span was 0 % of the frame width, even from projection alone with her at ≥ 20 %.
- Option C, pre-approved by Grok Bot: her plus the city, with no ring requirement.

## Shot
- Rear 3/4 view, 50° off her back. Arm 6 m, lens 1.3 m up, fov 45. Target 1 m above lens height.
- Model-local pose: P (6.845, 1.342, −26.291), T (−3.199, 2.342, −26.649).
- Her share of frame height is 32.2 % on all 7 screens. It was 3.1 %.
- City readability (18×38 ray grid; "structure" means skycity meshes more than 5 m away):

| Screen | Structure | Ruins | Sky |
|---|---|---|---|
| 390x844 | 78.2 % | 15.1 % | 5.6 % |
| 414x896 | 78.2 % | 15.1 % | 5.6 % |
| 360x780 | 78.2 % | 15.1 % | 5.6 % |
| 375x667 | 77.6 % | 14.9 % | 5.8 % |
| 390x520 | 76.2 % | 14.8 % | 5.4 % |
| 320x568 | 77.5 % | 14.9 % | 5.8 % |
| 768x1024 | 76.2 % | 14.8 % | 5.4 % |

  Test gates: structure ≥ 50 %, ruins ≥ 8 %, sky ≤ 40 %.
- Real-mesh clearance is 1.21 m. Head and chest rays are clear. The lens is not in a box.
- Ring share is 2.3–4.5 %, which is informational only.

## Ease-in
- 1.4 s orbit. The height drops in the first 55 % so the lens passes under the canopy band.
- Peak yaw 51.7°/s and 114°/s². 0 frames in a box. Face/chest hidden for at most 0.27 s. Largest step 0.10 m per frame.
- The start is the walk lens at 0.58 m, accepted as-is.

## Continue
- The 5.5 s countdown starts after the 1.4 s ease-in, about 6.9 s after entry. Drag, pinch or tap cancels it, and 继续旅程 stays.
- Auto-continue and the 继续旅程 button, both visible and the QA path, go through one continuation hook: `composition.continueFromSkyFinale()`.
  - A continuous skycity→lakeside segment registers with `composition.onSkyFinaleContinue(cam => true)`.
  - It receives the end-of-shot camera from `stage.finaleEndCamera()`: `{position, rotation(quat), fovVerticalDeg, velocity [0,0,0], angularVelocityDegS 0, at}`. The shot ends at rest and is held.
  - Returning true means the segment has taken over.
- **Fallback:** when nothing is registered, or every handler declines, the flow uses the existing `enterMainline()`, which plays the WindWipe 'ride' (0.45 / ≥1.10 / 0.55). onWipeCovered and onWipeRevealed disarm the countdown, and addWipeBeforeReveal waits for our blend. We add no black screen.

## Engine capture
- **Not possible on this box.** tools/cloud-web/build.cjs reports: "Official Creator 3.8 editor installation/CLI support is documented for Windows/macOS, not this linux host" and "An explicitly verified official Cocos Creator 3.8.8 executable is required".
- There is no Creator on the box, so there is no local web build. Console, natural trigger and WindWipe playthrough are unverified. This is for GGbot/界面验收部 on the Mac.

## Image
- t02_before_after_NOT_ENGINE.png is a raycast proxy of the raw GLB at 390x844. In "before", the tree is not hidden; the old in-game shot hid it.
- The large mass at the top of "after" is skycity structure from the merged env_sky_static_palette mesh. Its readability as "city" must be confirmed in the engine.

## Suite
195/198. Non-passing:
- legacy-board-ui-pure: BLOCKED_NODE (needs Node ≥ 22.6)
- reward-background-return: BLOCKED_NODE (needs Node ≥ 22.6)
- navigation-guard: BLOCKED_BROWSER

0 FAIL.
