# critical-done = live program cache, not queue empty

`8e93c02b` logged `compiled=764 pending=0 criticalPending=0` and then `world.animateCamera` frame 1803 still first-created 70 shaders (772 ms). The counter only meant the warm queue was empty.

Cocos 3.8.8 custom pipeline: `Pass.tryCompile` / `getShaderVariant` call `cclegacy.rendering.programLib.getProgramVariant`. That function `Object.assign`s `pipeline.macros` onto the pass defines and keys `group.programProxies` with `getVariantKey`. The GPU name is `getShaderInstanceName` after that assign — the same string the Mac probe logs. Writing PCF onto some other macros bag, or swapping `reflect-map-fs` onto the wrong phase, does not fill that cache.

Warm now:

1. Compiles the live girl / room / scene passes (watched from `bindCharacter` / world create / `TransitionPreload`, not from the late `mount:meadow-warm-rig`).
2. Wraps `Object.assign` for that compile so the **same** defines object the library keys from gets the spike pipeline bag: `CC_USE_FOG=4`, `CC_SUPPORT_CASCADED_SHADOW_MAP=1`, `CC_USE_HDR=1`, `CC_SHADOWMAP_FORMAT=1`, `CC_SHADOWMAP_USE_LINEAR_DEPTH=1`, `CC_DIR_SHADOW_PCF_TYPE=2`, `CC_SHADOW_TYPE=2`.
3. Marks a job cached only when the returned shader name carries those tokens. `criticalPending` is uncached critical jobs plus any Mac createShader needle still missing.
4. Keeps compiling uncached critical jobs. Does not log done until `criticalPending===0`.

`world.animateCamera` is not awaited and the stepper is not held. Meadow C’s 4 ms plan and sail empty frame are unchanged. `mount:meadow-warm-rig` is meadow meshes; it does not gate the girl/room cache.
