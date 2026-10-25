# T-02 skycity finale — 运镜bot
Branch cine/t02-skycity-final (base 977711f0 + merge of ggbot/cand-b18-stage d050422a for WindWipe).
Shot: baked over-the-shoulder 3/4-back pose, 7 m arm, 12° look-up, fov 50, camera 1.3 m off the floor; she stands in the foreground looking out at the city and the star ring.
Her share of frame height: 25.6% on all 7 screens (was 3.1%). Star ring: 9.1% (was 22.7–31.8%). Real-mesh clearance: 1.30 m. Head and chest unoccluded. Ring samples on screen: 2 of 4 seen.
Approach: 1.4 s orbit; yaw peak 3.9°/s; 0 frames in a box; occlusion 0.43 s; never closer to mesh than the walk lens it starts from (0.58 m, already there before).
Hold: auto-continue (enterMainline) after a 5.5 s hold with no input. Drag, pinch or tap cancels it, and 继续旅程 stays. WindWipe hooks: onWipeCovered and onWipeRevealed disarm; addWipeBeforeReveal waits for our blend to end. We add no black screen.
Image: t02_before_after_NOT_ENGINE.png — NOT_ENGINE raycast proxy of the raw GLB, no tree hiding. No video.
Suite 194/198: 2× Node≥22.6, navigation-guard, and windwipe-ending, which already fails at merge base d050422a and is fixed upstream by ggbot ab8c98a4.
