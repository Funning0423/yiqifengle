# Girl endpoints r4 (运镜bot) — 2026-10-17

## Commits (local only, nothing pushed)
- **2665429** `cine/region-hooks-meadow-r4-ggkeepout` (on 95d3eee): meadow stop using GGbot's keep-outs (icon ring/badge, hint line)
  - 7 portrait screens: clear, gap ≥13 pt; landscape 1024x768: she is behind the camera (unchanged from before)
  - **OPEN, needs the lead:** 08→09 O5 is +4.40 s over Build05 (limit 3 s; r4 base +2.64 s), and F7b fails (lens 0.5° left of behind at d=6.4)
  - suite 75/82 = the known 5 + journey-occlusion(O5) + journey-framing(F7b)
- **95d3eee** `cine/region-hooks-meadow-skycity-r4` (on 5b1f41d): earlier stop (between tray and tools)
  - O5/F7b pass, suite 77/82 (known 5 only)
  - its 390x844/414x896 stop (y 620–671) overlaps the hint line, and 360x780 sits at the left edge
  - Mac GPU 10 runs: swap delta 0/0/0 on all

## Why the two stops conflict
- Phones with the hint line: there is no room between the tray and the hint (17–20 pt on 360x780/375x667/320x568, ~6 pt on 390x844). So the only clear place on every portrait screen is the grass in the lower-left corner, beside the tool row and below the hint.
- That corner is next to player_spawn, behind walk_path_02. 08→09 then starts 2.6 m off the old start.
- Every clear corner stop costs more than 3 s: best is +3.24 s, and even a straight line to the bridge would be +3.17 s.
- The fix is a decision for the lead:
  - (a) raise O5 to about 4.5 s for 08→09; or
  - (b) shrink the hint keep-out (if the hint is short and centred, use its real width) and go back to 95d3eee-like stops on the tall screens.

## Skycity: BLOCKED, needs a decision (see endpoints.json → skycity, and the two png files)
- `skycity_inframe_spots.png`: spots clear of the UI on each screen (yellow). There is no single spot for all screens.
- `skycity_bridge_gap.png`: the cloud bridge deck is missing over 12.5–15.1 m. Both bridge states are in the GLB; state_bridge_before floats 1.7–2.5 m above the deck, so she would clip her head.
- Options:
  - A: walk across the bridge (+~50 s, waive O5, bridge-state art decision)
  - B: re-layout the rainbow bridge onto the court front rim (O4 decision, lens re-tune)
  - C: change the board camera composition (09 files are frozen)
- Every candidate spot is clear of the tray (GGbot's teal-robot note).

## Files
- endpoints.json: per-screen meadow stop for 2665429, model coords (= board copy local) and journey world, yaw, path, visibility; skycity blocker
- girl-visibility.json: independent projection, 8 screens × 2 regions; includes GGbot toolbar rects and hint line as a fixture
- meadow_v2_stops_7screens.png: yellow = new stop, red = old walk_path_02, magenta = keep-outs
- region-landing-hook.report.json: swap table for 7 screens × 2 regions (all 0 / ~1e-15)
- journey-*.m2.log, suite.*.log; patches/; meadow-r4.bundle (both branches; prerequisite 5b1f41d)

## Update 2026-10-17 ~08:35 EDT (Grok Bot decision: option b)
- r4 merges 95d3eee. 2665429 is dropped.
- **r4.1 meadow is NOT committed: the requirements conflict.**
  - The hint toast is measured from the game's own strings with PopupKit.measure(text,15)+40, clamped at 330. The widest is the ManagedTools string 「这件道具已用完，可从已获得的宝箱或地区礼物领取」, which gives the full 330 x 32 pt plate.
  - With that plate, gap ≥13 pt plus O5 plus F7b can't all hold on 390x844 (best gap 7.1 pt) or 360x780 (best 5.3 pt, at the left edge). The other 5 portrait screens reach ≥13 pt.
  - If the toast is moved out of the band between tray and tools (a GGbot UI change), all 7 portrait screens pass: 390x844 31 pt, 360x780 21 pt.
  - See r4.1-wip/: the uncommitted patch, o5-f7b-map.txt, and the scan scripts.
- HANDOFF: team/cinematic/HANDOFF.md, commit ad05040 on local branch cine/cinematic-handoff-20261017 (on top of 95d3eee).
