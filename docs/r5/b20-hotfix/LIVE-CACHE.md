# critical-done = live program cache (animateCamera + setCamera bags)

`2672b080` cleared meadow→skycity `world.animateCamera` LONGs, but Funning’s experience build still felt like slow-mo. Residual spike: `world.setCamera` B1 frame 1714 **647ms / 102 shaders**. Those createShader names carried FOG4 / cascaded / HDR / SHADOWMAP_* / **PCF2**, but **`CC_SHADOW_TYPE2` was 0/40**. Warm that forced `CC_SHADOW_TYPE=2` filled a different live-cache key than the draw path. Meanwhile marking every `builtin-standard` as critical ballooned `pending` / `criticalPending` to 500–1200 and kept compiling every frame.

Warm now:

1. Compiles **two** pipeline bags into the live `programLib` cache via an `Object.assign` wrap:
   - **animateCamera**: FOG4 + cascaded + HDR + SHADOWMAP_* + PCF2 + **SHADOW_TYPE=2**
   - **setCamera**: same without `CC_SHADOW_TYPE` (0 is omitted from the program key)
2. Marks a job cached when the returned name has the shared PCF2 bag (TYPE2 optional).
3. **critical** = skin/morph (`hot`) + `USE_VERTEX_COLOR` + `HAS_SECOND_UV` only — not every standard pass.
4. While `criticalPending>0`, non-critical warm yields (stops the slow-mo thrash).
5. Does not await or hold `animateCamera` / `setCamera`.

RT pool / fidelity / walk speed / cine-fx unchanged. No WeChat upload from this tip.

## Mac 81c841d4 follow-up

Residual setCamera was unlit+morph (not PCF). board-bg LONGs were Invalid reflect warm + reveal sync, not RT. See `SETCAM-BOARD-LONG.md`.
