# palm clearance → b1-yard-balloon C3 combined allowlist (运镜bot, for GGbot)
Grok Bot ruling (a): TransportLeg.ts byte-identical to 19bd812a except two exact lines:
- SAIL_M1_LOCAL (your 8a63be5b pin, unchanged text)
- `const K0:SailOff={back:10.5,side:-4.2,up:4,fov:60,look:0.5,orb:0};` (cine/b20-island-palm-clearance)
Rule moved to tools/journey-integration/c3-transport-leg.cjs (each pinned line = base or exactly its pin; nothing else may differ, same line count)
with negative self-test test-c3-transport-leg.cjs (suite: c3-transport-leg-selftest).
Merging cine/b20-island-palm-clearance into ggbot/b20-walk-merge conflicts in test-b1-yard-balloon.cjs at the C3 TransportLeg hunk:
take OURS (the palm-clearance side) — it is a superset of 8a63be5b's pin.
Alternatively apply b1-yard-c3-transportleg-on-8a63be5b.diff on top of 8a63be5b (git apply --check OK; selftest + b1-yard-balloon PASS there).
Other merge conflicts (RegionNodes.ts, region-nodes.json, walk_durations_pinned.json) come from the a1c4c07d island re-bake, not this change: re-bake + QF_PIN_WRITE.
