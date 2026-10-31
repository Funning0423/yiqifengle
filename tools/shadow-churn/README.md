# p0-shadow-churn

**Symptom** (fin e8cd7c1e finV, Mac): 112–116 `[QF_GPU] TEX op=create 1024x1024` per second (fmt35 colour + fmt55 depth), one pair per
frame, during the island segments (standing → crossing-out). `w=world.animateCamera` was only the probe's last-camera-writer tag.

**Root cause** (Cocos 3.8.8 web custom pipeline, not game code):
- builtin pipeline `windowResize` (internal bundle, builtin-pipeline) registers `ShadowMap<win>` / `ShadowDepth<win>` with MANAGED residency, sized `shadows.size` (RoomLightingRig sets 1024 indoors).
- `cc.js` executor `_removeDeviceResource` releases every MANAGED device texture whose name is not in `pipeline.resourceUses`; that list is empty at that point every frame, so the shadow pair is destroyed and the shadow pass re-creates it every frame.

**Headless trace** (`headless/`, Chrome swiftshader on a web build, a bare scene with one shadow-casting directional light and one camera):
`uses=[] before=[Color0,DepthStencil0,ShadowMap0,ShadowDepth0] after=[Color0,DepthStencil0]`; 240 creates / 240 destroys per 120 frames.

**Fix** (`render/RoomLightingRig.ts`, bottom): wrap `pipeline.execute` once; before each execute pin shadow resources to PERSISTENT
residency and release a pinned device texture only when its descriptor size changed (one re-create per real size change).
Headless after fix: 0 creates per 120 steady frames, live 2 / 8 MB flat, 1024→2048 change = exactly 1 pair, screenshot pixel-identical to the unfixed build.

**Gate** `shadow-churn-gate` (`test_shadow_churn_gate.cjs`): ≤ 1 shadow create per N=600 steady frames (10 s at 60 fps — one legitimate
size change per room transition fits; the bug produces 1200), live count/MB flat; negative = old behaviour fails.

Run headless: serve a web build dir on :8765 with `churn_repro.js` (+ `churn_fix.js` generated from RoomLightingRig) copied in, then
`node headless/run.cjs mode=one "mode=one&fix=1" "mode=resize&fix=1"` (needs playwright-core + google-chrome).
