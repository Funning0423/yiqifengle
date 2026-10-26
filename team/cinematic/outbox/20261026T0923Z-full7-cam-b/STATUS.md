# full7-cam-b — 运镜bot, cine/b19-full7-cam (base baf51b13), on top of the d1d52a58 interim
New commit 4bda3728: cam-trace per-frame state lines. While camLog.on, WorldFlowComponent.lateUpdate calls camLogFrame(worldCamera).
It prints `[QF_CAM_TRACE] frame=<n> CAM_OFF | WORLD_LAYER_OFF vis=0x.. | CAM_MISSING` on every bad frame and
`CAM_OK<-<prev>` on recovery. When off, the cost is one boolean test and no allocation. Tested in test-cam-trace-log (suite).
Suite at 4bda3728: 227 PASS / 0 FAIL / 3 BLOCKED (env). Visibility --full: no camera pose changed since d5cdba58 (235,257 cams, 0 holes).

## 1 Stuck region-travel lens — diagnosed, NOT changed (GGbot area for the stall)
Writer during the stall = the lakeside lease's beforeDraw apply(), RegionJourneyAdapter.ts:328
(`lastPose=sl.cam(tau,…);world.setCamera(c2Lens(…))`). It writes every frame, so the lens is not stale. It is frozen because tau is
clamped by ticker.step, RegionJourneyAdapter.ts:337–338: `tau<walkS → tau+=d`, then `!boarded → wait walkDone/boardIn,
tau≤boardEndTau-1e-3`. The C1 walk (`actor.perform(walk)`, :305) or boardIn (:296–302: performDoorReach / walk / sit) did not
resolve for about 80 s. Mac s2: C1-basket-in 07:44:06.905Z = ride-start, then nothing until the C2 entry.
So the lens holds the C1 walk / SkyWalkShot pose on skycity ground (grass and a rock), and the sky is green from the sky TypeError.
Proposed GGbot fix: find the awaited actor call that stalls (likely the walk, while the lakeside assets load). Camera-side
proposal, not built: if tau is held >2 s, ease to the moored door wide (doorLens). That needs an engine run to frame, so I did not ship it blind.
## 2 Grey frames — not root-caused without an engine. The M6→B1 code path (BalloonTransit.ts:571–580) writes c0 continuously
and B1's b1Draw starts on cam0, so it is not a missing write. Next device run: `?camTrace=1`. The new CAM_OFF / WORLD_LAYER_OFF / JUMP
lines will name the frame's cause (camera disabled, layer, or region swap).
## Not done: 3 solid-colour gate + false-positive sweep; 4 flat-sky sub-check proposal; 5 meadow follow change; 7 M6 extras.
