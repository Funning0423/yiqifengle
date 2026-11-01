# full7-cam (interim) — 运镜bot. Branch cine/b19-full7-cam = baf51b13 (GGbot full6, keeps a053220b) + full6-cam + cam-trace
Commits: 9634af03 (full6-cam P1, cherry-picked from 868a7e01) · c0af46a3 (full6 outbox) · d5cdba58 (cam-trace)
Cherry-pick conflict: BalloonTransit.ts, resolved as the union of both sides. GGbot's `Layers` import, b1PreWalk/followPose and
liveWorldPose are kept; the board-source registration and balloonBoardSource are added. test-board-handoff PASS.

## Cam-trace (NEW)
On: open the page with `?camTrace=1`, or set `globalThis.__QF_CAM_TRACE=1` before the game scripts load. The switch is read
once, when region/CamTraceLog.ts loads. Off (default): cameraWriteHook.log stays null and __qfCamTag is not published, so
nothing is hooked or allocated.
Line per applyCameraPose write (console.log only):
`[QF_CAM_TRACE] f=<n> t=<s> pos=x,y,z yaw=<deg> pitch=<deg> fov=<deg> w=<writer>[ CHANGE<-prev][ JUMP=<m>m/<deg>deg]`
Writers: TransitionCamera, LiveHandoff, RegionJourneyCore(:onFrame), SkyWalkShot, BalloonTransit:{prewalk,B1,flight,B5},
regionBoardHandoff, regionLandingToBoard, enter-level; otherwise the applyCameraPose source (e.g. world.setCamera).
JUMP = >0.0875 m or >3° in one write. Test: tools/journey-integration/test-cam-trace-log.cjs (in suite).
Not covered yet: a line when the camera is disabled or the world layer is off.

## P2c — shot found; nothing reframed (reason below)
Shot: meadow B1 basket-in close-up → pull-back to cam0 (BalloonTransit b1Lens; Mac cut-a frames 626→628, then 628–635).
The pulled-back frames DO contain the balloon, meadow ground, windmill, fence and an ocean horizon. The "solid dark blue" is
the top ~55 % of the frame, a flat sky colour (sampled RGB 2,67,133, no gradient or clouds). So the 9×16 ray-grid proxy
would not flag these frames, and the ≥92 % ΔE<6 pixel rule would not either. It is a sky look/colour question, not framing.
GGbot's a053220b also rewrote the B1 start (follow lens → cam0), so a reframe has to be built and checked against that new code.

## Not done in this delivery
P2c reframe; sky-only / solid-colour gate (proxy + false-positive sweep); meadow walk continuous follow (7-screen numbers);
full6 Mac items 1–5 (skycity→lakeside stuck lens and wipe, the two grey frames, gate extension, cam-trace coverage).

## Tests
Visibility --full (at d5cdba58 before the amend; no camera poses changed since): 235,257 cams, 0 holes, PASS.
Suite: see SUITE line appended below.
SUITE at d5cdba58: 227 PASS / 0 FAIL / 3 BLOCKED (env).
