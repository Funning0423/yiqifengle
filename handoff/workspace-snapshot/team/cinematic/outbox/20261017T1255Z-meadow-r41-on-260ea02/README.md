# meadow r4.1 — 她的落点（提示条在托盘上方，GGbot 260ea02）

- branch `cine/region-hooks-meadow-r4.1-on-260ea02` @ **0ea1564** (local only, not pushed)
  = 260ea02 (GGbot hint above tray, on 6f42df4) → abeb1fa (95d3eee cherry-picked) → 0ea1564 (r4.1)
- fixture: GGbot toolbar rects + team/ggbot/outbox/20261017T124421Z-r41-hint-above-tray/footprint.json (banner/tray, incl. 390x520)
- 7 portrait screens; 1024x768 landscape out of scope (portrait-only mini-game)

| screen | stop m | model pos (x,y,z) / yaw | journey pos / yaw | gap pt (TS / independent) | O5 08→09 vs Build05 | F7b worst |
|---|---|---|---|---|---|---|
| 390x844 | 6.49 | (-0.8,1.88,14.0) / 180 | (-0.514,0.717,38.481) / 0 | 24.5 / 24.5 | +1.19 s | -0.17° |
| 414x896 | 6.49 | same | same | 26.0 / 26.0 | +1.19 s | -0.17° |
| 360x780 | 6.49 | same | same | 18.0 / 18.0 | +1.19 s | -0.17° |
| 375x667 | 6.49 | same | same | 18.1 / 13.4 (GG's older wider icon rects) | +1.19 s | -0.17° |
| 390x520 | 4.30 | (-1.5,1.665,16.022) / 180 | (0.186,0.501,36.46) / 0 | 16.3 / 16.3 | +2.98 s | -0.14° |
| 320x568 | 5.00 | (-1.198,1.734,15.396) / 153.4 | (-0.115,0.57,37.085) / -26.6 | 16.9 / 16.5 | +2.40 s | -0.22° |
| 768x1024 | 6.49 | (-0.8,1.88,14.0) / 180 | (-0.514,0.717,38.481) / 0 | 32.5 / 32.5 | +1.19 s | -0.17° |

（F7b：负值 = 镜头在她朝向的右后方，通过；O5 预算 +3 s。08→09 前 20 m 无遮挡，最近镜距 3 m。）

- swap delta (14 rows, 7 screens × meadow/skycity): max 3.7e-14°, fov 0, 9.6e-13 cm; clearance min 3 m (≥1.1)
- region-landing-hook 33/33 PASS; suite 90/93 — only legacy-board-ui-pure + reward-background-return (BLOCKED_NODE, Node 20) and navigation-guard (BLOCKED_BROWSER), all in the known 5
- strip: meadow_r41_stops_7screens.png (yellow = new stop, red = old walk_path_02, magenta = UI keep-outs)
- Mac GPU check: NOT done — Mac unreachable (3 tries). Offline renders only. Nothing created on the Mac.
- note: on most screens she is small (≈4–6 % of screen width) and sits at the lower-left beside the tool row; inFrameLimits only true on 390x520 and 768x1024 (the chooser prefers gap; the bonus needs gap ≥13).
