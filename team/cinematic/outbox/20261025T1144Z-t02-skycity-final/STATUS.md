# T-02 skycity finale — 运镜bot
Branch cine/t02-skycity-final (base 977711f0 + merge of ggbot/cand-b18-stage d050422a for WindWipe).
Shot: baked over-the-shoulder 3/4-back pose, 7 m arm, 12° look-up, fov 50, camera 1.3 m off the floor; she stands in the foreground looking out at the city and the star ring.
Her share of frame height: 25.6% on all 7 screens (was 3.1%). Star ring: 9.1% (was 22.7–31.8%). Real-mesh clearance: 1.30 m. Head and chest unoccluded. Ring samples on screen: 2 of 4 seen.
Approach: 1.4 s orbit; yaw peak 3.9°/s; 0 frames in a box; occlusion 0.43 s; never closer to mesh than the walk lens it starts from (0.58 m, already there before).
Hold: auto-continue (enterMainline) after a 5.5 s hold with no input. Drag, pinch or tap cancels it, and 继续旅程 stays. WindWipe hooks: onWipeCovered and onWipeRevealed disarm; addWipeBeforeReveal waits for our blend to end. We add no black screen.
Image: t02_before_after_NOT_ENGINE.png — NOT_ENGINE raycast proxy of the raw GLB, no tree hiding. No video.
Suite 195/198 at 75f156e1, after merging the ggbot/cand-b18-stage tip d9423886 (contains ab8c98a4): windwipe-ending passes; only the 2× Node≥22.6 and navigation-guard environment blocks remain. f28071dc only changes the test.
Ruling 4: the 5.5 s countdown starts after the 1.4 s ease-in (about 6.9 s after entry); the test now checks this.
BLOCKER (ruling 2): the whole star ring (44 samples, ~47 m wide, nearly horizontal at y≈20, almost directly above S6) cannot fit in a portrait frame from anywhere reachable. Even ignoring the mesh and her size (camera up to 40 m away, any yaw/pitch, fov 50–80), the best is 24/44 samples at fov 50 on 320x568 (her 6.8%) and 36/44 at fov 80 (her 3%). Engine capture is on hold until the framing target is decided.
