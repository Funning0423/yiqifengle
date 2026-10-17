# PR #56 r4 — meadow mount split across frames (运镜bot)

Base: d317b2f (feat/sailboat-transition-20261015) · Commit: e2aa9003b91a5605ed2af39f79497bf02803987a · Tree: 4e895780a08636c4475011bf1c03dd9c28c13167
Patch: 0001-pr56-r4-meadow-instantiate-split-on-d317b2f.patch (`git am` on clean d317b2f verified → same tree). Local branch `cine/pr56-r4-instantiate-split` in worktree /workspace/wt-pr56r4. Not pushed.

## Root cause (from r4 logs)
- cloudCover.fullFrom = 78, sceneSwapFrame = 81. Gate open day 27.720 → frame 78 = 30.320; night 27.944 → 30.544.
- The 183 ms rAF frame starts exactly there: day 30.332, night 30.558 (raf.json). It is the first frame with a shut bank, where d317b2f's `mountUnderCloud` ran **in one frame**: `instantiate(prefab)` + `addChild` (active → onLoad/onEnable of every renderer, model upload) + `configureMeadowVertexColors` (`recompileShaders` variants) + key light + night sky + first draw (pipeline compile).
- The next update got dt = 183 ms (clamp 0.25 s), advancing ~5.5 timeline frames (78 → ~83) in substeps with warmFrames still 0 → crossed frame 81 not warmed → `hold enter`; one more frame finished warm frame 2 → `hold leave` 9–10 ms later. Preload (ready 21.29 / 23.52) was never the issue.

## What moved where (one stage per rendered frame, never per substep)
New pure module `cine/SailboatMeadowStager.ts` (no cc import, unit-tested), driven from `update()` after the substep loop:
| Stage | When | Work |
|---|---|---|
| instantiate | first frame ≥ 66 (cloud closing, `SAILBOAT_STAGE_INSTANTIATE_FROM_FRAME` = cloudCover.inStartFrame) with prefab ready | `mountRegion(..., inactive=true)`: root set inactive **before** addChild → no onLoad/onEnable, nothing drawn |
| prepare | next frame, still inactive | `stageMeadowReveal`: vertex-colour variant recompile, cameras/clips off, key light child. Does NOT touch the world camera (night sky deferred) |
| activate 1/2 | first frame with shut bank (78) | children off, root on, `syncSailboatMeadowNight` (clear colour/night) , slice 1 on |
| activate 2/2 | next frame (still covered) | slice 2 on (children balanced by MeshRenderer count) |
| warm 1, 2 | following frames | unchanged `SAILBOAT_WARM_FRAMES = 2` rule |
Simulated at 60 Hz: warmed at timeline frame 79 (< 81) → no hold. Late prefab (arrives under cover) still mounts in stages; hold fallback unchanged for slow network. Readiness (`meadowReady: this.warmed`) intentionally still means "rendered under cover" — opening on the bare instance would show undrawn/uncompiled meadow; the pre-instantiation is what lets it reach warmed before 81.
Other files: `RegionLoader.mountRegion` gets optional `inactive` (other callers unchanged); `SailboatMeadowWarmup.prepareMeadowReveal` = `stageMeadowReveal` + night sync (kept for compatibility). Not touched: island hide timing (`syncScene`, GGbot), timing.json, audio.

## Expected per-frame cost
Estimates only, not measured on Mac: instantiate-inactive ≈ clone cost (expected ≲ 20–40 ms, in frames 66–77 under the closing clouds); prepare ≲ 10 ms; each activate slice ≈ half of the old onEnable + first-draw compile (old total ~170 ms ⇒ may still be ~60–85 ms per slice if compile dominates). If any slice frame > 50 ms on Mac, raise `SAILBOAT_STAGE_SLICES` (3 still warms by frame ~80 at 60 Hz) or move instantiate earlier — log tells which.

## Mac logs to check (console, normal flow 22, day+night)
```
[sailboat] meadow instantiate frame 66 ms N
[sailboat] meadow prepare frame 66|67 ms N
[sailboat] meadow activate 1/2 frame 78 ms N
[sailboat] meadow activate 2/2 frame 78|79 ms N
[sailboat] meadow warm 1 frame F dt ms N   (dt = this frame's delta, i.e. includes previous frame's render/compile)
[sailboat] meadow warm 2 frame F dt ms N
```
Pass: no `[sailboat] hold enter/leave` in 22; every rAF frame between gate open and landing ≤ 50 ms; warm 2 frame < 81; skip (23) still lands; night first meadow frame still night; duration still 5.2 ± 0.2 s.

## Tests (Node 22.14, QF_TYPESCRIPT_MODULE/QF_CC_DTS set) — all PASS
test_sailboat_transition (+ stager unit tests, 60 Hz timeline sim, source checks: one stage per frame, night sync only under cover, inactive mount), test_sailboat_audio, test_meadow_preload, test_manifests (text manifest updated), test_es5_safety, test_meadow_night_sky.
Ad-hoc tsc on driver/stager: same 17 diagnostics as base d317b2f (all cc-resolution noise in that ad-hoc setup), none new.

## Skip-branch sail sound nearly inaudible — findings only (no change)
- In 23 the RMS has no sting peak at 28.0–28.6 s even though the tap is at 29.13 s: pre-tap driver path is identical to 22 and `[sailboat] sting start` is logged at 27.775/27.809. So the missing peak is before the skip fade; not caused by the skip branch of the driver.
- Caveat in my driver: `sting start` is logged **before** `GameAudio.playCineSlot`, which silently returns when muted/sfxMuted/`reasons` non-empty, and loads the clip async (warns `[GameAudio] cine slot missing` only on error). So the log does not prove playback. 23's console logs were not saved in r4 (only 22 day); next recording should keep 23 console logs to check for `[GameAudio]` warnings.
- After the tap the driver fades the sting over skipFadeSec 0.3 s (by design), so post-tap the sting is short regardless.
