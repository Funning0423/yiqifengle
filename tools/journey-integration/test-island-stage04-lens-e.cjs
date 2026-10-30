'use strict';
// 运镜bot b21 (Grok Bot decision a): the L04 entry pan (islandEntryPan owns I3>I4) re-gated on GGbot's E-waypoint route, same limits as
// island-stage04-lens (face/chest <= 0.3 s, margin >= 0.08 every frame, motion, ground/solids, capsule, single writer; 7 screens x 60/30 fps).
process.env.QF_I3I4_VIA='occlusion/island-i3-i4-via-E-ggbot.json';require('./test-island-stage04-lens.cjs');
