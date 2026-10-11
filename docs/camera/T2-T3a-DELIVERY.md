# T2 / T3a (+T2+) camera delivery — 运镜bot

Branch `work/运镜bot`, baseline `4428997` (T2/T3a frame-verified addendum).

## Checkpoint 1 (pre-T2+ redesign)

Committed as a checkpoint before the T2+ scope expansion (Funning via lead, 2026-10-11 06:17 CT).
What it contains:

| Area | Change |
|---|---|
| `CameraPose.ts` | `TrackOptions` (pchip / ease-in / ease-out, C2 time remap), monotone cubic Hermite sampler, `WeightRamp`/`rampWeight` |
| `WorldFlowCore.ts` | track options + interior-light ramps per walk, `walkSpan` (one camera track across consecutive walks), `doorwayInterior` layer flag |
| `WorldFlowComponent.ts` | doorway-visible interior renderers on the island layer, `setInteriorWeight` / `animateInteriorWeight` lease wiring |
| `RoomLightingRig.ts` | continuous interior<->exterior weight (sun pose/illuminance/colour, ambient, shadow saturation, lamp); w=1 is bit-identical to the old interior mode, w=0 to the exterior |
| `RegionCameraData.ts` / `FirstsliceRoutes.ts` | `TRANSITION_CAMERA` data keys (close follow, optimiser-designed), rollback switch `enabled` |
| `WorldIntegrationBoot.ts` | island buttons pre-baked during `resize()` while hidden (final material on first visible frame), 0.25 s slide+scale entrance, HUD `hide`/`slideIn` call sites for GGbot |
| `tools/camera-frame-test/` | `test_camera_frames.cjs`, `flow_sim.cjs`, `metrics.cjs`, `glb_geometry.cjs` (draco3d GLB decode), `video_frame_check.py` |
| `tools/cloud-skycity/test_navigation_integration.cjs` | assertion updated to the new contract: skin baked in `resize()`, zero rebuilds on first paint |

Checkpoint test status (honest): CPU frame test runs end-to-end on decoded GLB geometry. PASS: settle island/home,
no hard cut, angular-velocity continuity, lighting continuity. FAIL (addressed by the T2+ redesign below): in-frame
(stand-up and the doorway close follow), linear acceleration on the old 45 m crane leg, lens clearance (palm fronds of
`env_prop_palm_tall_01` beside the door, 5 mm), line of sight (fence/palm outdoors).
`tsc` with Cocos 3.8.8 types: 11 errors = baseline 11, 0 new. Repo `test_*.cjs` under Node 23.11: every failure also
fails on a pristine baseline copy (Playwright / fixtures / canvas path missing), except `test_navigation_integration`,
updated as above.
Negative control: `video_frame_check.py 08-outbound-motion.mp4 --start 22 --end 24` flags 22.867 s (luma -6.7%).
