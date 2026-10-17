# Meadow (04→05) and skycity (08→09): continuous landing→board transitions (camera only)

**Branch:** `cine/region-hooks-meadow-skycity-r4`. Local only, never pushed.
- **Base:** GGbot `ggbot/build05-r4-prep` HEAD **97b761d** (c30eeec + B2 morph copy), plus the lakeside hook v3 commits.
- **HEAD 5b1f41d.** Commits since 97b761d (see `COMMITS`, `patches/0001..0007`, and `region-hooks-r4.bundle`, which has
  prerequisite 97b761d and was verified with `git fetch <bundle> cine/region-hooks-meadow-skycity-r4`):

| SHA | what |
|---|---|
| 9e5843f | = c3cbf89: lakeside enter-level cover holds the landed board pose (camera only) |
| 834f9bf | = a8ba19a: lakeside hook v3 swap-frame test |
| dd45b5d | meadow / skycity journeys end on the board camera that renders after the swap; push-in held |
| 6f2396b | hook deps built first (the sandboxed region-journey-host test path) |
| 052db63 | blend view slerps from its blend-start direction (strictly monotonic, no turn-away) |
| cc2a6d4 | test: her r4-prep B+ board copy at the board camera, per screen |
| 5b1f41d | test helper: screen-right sign fix, checked against the in-game capture (tools only) |

Production code is identical at cc2a6d4 and 5b1f41d. The in-game runs used a cc2a6d4 web build.

## Root cause
In both regions the journey ended on a follow / Landing A lens. Then the generic 0.78 s enter-level push-in ran, and the board
camera (MeadowBackgroundCamera / SkycityBackgroundCamera, layer 1<<20) took over as a designed cut. The scenery-relative gaps were:
- **meadow:** 24.9 m, 20.3° of view, +1.4° FOV;
- **skycity:** ~60 m, 72.4° of view, +7° FOV.

## Approach (same as lakeside)
- At runtime, for each screen, the end pose is back-solved from the camera that actually renders after the swap:
  - meadow: `meadowScenePose(aspect)`;
  - skycity: `skycityVisitPose(spawn, court, aspect)`.

  It is mapped into the journey world with J·B⁻¹, where B is the prefab root TRS captured right after mountRegion.
- Over the last blendM metres of her walk (meadow 12 m ≈ 10 s, skycity 22 m ≈ 18.3 s), one smootherstep drives three things:
  - position: lerp from the moving lens (C1 hand-off);
  - view direction: slerp from the lens's blend-start direction to the board direction;
  - FOV: lerp.

  The camera comes to rest exactly where she stops. There's no overshoot: the FOV gap and the view angle to the board never grow.
- Hook `regionLandingToBoard`:
  - exact (≤1 mm / 0.01°) → one write and ok;
  - a small residual (e.g. the viewport changed) → 1–4 s blend;
  - otherwise ok:false. It never rejects.

  The generic push-in is held only on ok, and only when the meadow / skycity background renders.
- Board cameras, scene, lighting and GGbot's guest/preload code are untouched.

## Swap continuity (limits: angle/FOV ≤ 0.1°, position ≤ 1 cm)
**Pure test (`tests/region-landing-hook.json`, real GLB scene, 5 screens):**
- meadow: max 3.6e-15° / 0 / 0;
- skycity: max 3.7e-14° / 0 / 9.6e-13 cm.

**In-game, Mac GPU (Chromium, dpr 2, scenery-relative, web build cc2a6d4 on 97b761d), all 10 runs:**
- swapDelta is **0.000° / 0.000° / 0.00 cm** (`swapdelta/*.json`), and every step in the ±10-frame window is 0;
- the last frame before the swap is `Main Camera` (level-loading) and the first frame after is the board camera at an identical pose. For example,
  skycity 390x844 is (5.27321, 11.88217, 57.18419), fwd (−0.207888, −0.381127, −0.900847), FOV 55;
- strips (10 rendered frames before and after, annotated with Δ): `strips/<run>.jpg`;
- per-frame camera data: `ingame/<run>/camframes.json`. Background pose: `bg_camera_pose.json`. Board-only capture: `board_bgonly.png`.

## Landing (pure, 60 Hz, 1.2 m/s walk; in-game numbers from `ingame/<run>/landana.json`)
| | meadow | skycity |
|---|---|---|
| gap at blend start | 16.0–16.7 m, 10.36°, FOV +1.43° | 47.7–52.0 m, 17.27°, FOV +7° |
| min lens clearance (≥1.1 m) | 3.0 m | 1.713 m (390x520), 2.552 m (375x667), else ≥3 m |
| max turn (pure / in-game) | 1.94 / 2.25–2.66 °/s (4.37, 5.44 on the 2 hitch runs) | 1.77 / 1.84–2.96 °/s |
| FOV rate (pure / in-game) | 0.27 / ≤0.37 °/s (0.61, 0.75 on the 2 hitch runs) | 0.72 / ≤1.20 °/s |
| view angle to board | strictly falling; 0 frames growing in-game | strictly falling; 0 frames growing in-game |
| turn-rate jump at blend start | 0 | 0 |
| gap at arrival (in-game) | 0 / 0 / 0 | 0 / 0 / 0 |
| cover hold (push-in held) | 0 cm / 0° movement | 0 cm / 0° movement |
| her chest in frame during blend | 100% | 18–21% |

- **Meadow position caveat:** when the blend starts, the follow lens is heading away from the board pose (cos −0.6). The blend turns
  it smoothly (speed dips to 0.81 m/s and never reverses), so the distance to the board first grows by 0.71 m in total. Any
  C1 hand-off has this; the test bounds it at ≤1 m and checks for no back-up.
- **052db63 fixed a real defect:** the in-game data on dd45b5d showed the skycity view angle to the board going 17.3 → 25.8 → 2.0 → 4.7 → 0°,
  because the deck corners swing the Landing A view by up to 70°. The view now slerps from its blend-start direction instead.
- **Hitches:**
  - meadow 375x667 and 414x896 each have two consecutive frames of 47–71 ms, about 6.4–7.1 s before arrival;
  - those runs were recorded while the Mac's load average was ~45 (WeChat devtools renderer from another team);
  - the other 8 runs, and all 10 earlier unloaded runs (dd45b5d / 052db63-equivalent builds), have 0 frames over 40 ms;
  - so I don't attribute them to camera code; please recheck on r4.
- **Frame drops:** the screencast dropped frames under load (e.g. 1340 of 1932 frames). Strips use the nearest rendered frame. Deltas come
  from the in-page camera log, which load does not affect.

## Her board copy (GGbot B+) against the camera rules (`tests/girl-at-board.json`, checked against the in-game capture)
characterBox(landing spot, 1.7253 m, half-width 0.3 m) is projected through the board camera, and the board UI comes from
boardLayout(boardSafeInsets).
- **Meadow:** visible on all 5 screens. **4–6% of frame width** (≤80% ✓), inside REGION_CAMERA.frameLimits ✓, and **not under the board
  tray or goal plate** ✓. She sits bottom-left on the path, at x 99–123 / y 703–762 pt on 390x844 (the capture shows her there).
  - **Caveat:** she overlaps the tool row. With 3 tools she's behind the left tool icon on 390x844 / 414x896 / 360x780 (100/100/96%), 63% on 375x667,
    and 8% on 390x520. With 2 tools the overlap is 8–40%; with 1 tool, 0. At the 04→05 level only 1–2 tools show, and the strips show her clear.
- **Skycity:** **not in frame on any screen.** The visit camera ends 2.1–12.4 m beside her landing spot, looking at the star court,
  and she's off the left edge (NDC x −14 to −57). To show her, one of these is needed (I haven't done any of them):
  - a different skycity board camera composition (a design decision);
  - placing her copy somewhere in view (GGbot);
  - ending the 08→09 route inside the visit frame.
- **Scene observation for GGbot:** in skycity, a teal figure on the star court (not her) is visible in the journey copy, disappears
  5 frames before the swap (during level-loading), and isn't in the board scene (see `strips/rh_skycity_390x844.jpg`).

## Tests
- `region-landing-hook` 24/24 (`tests/`).
- **Full suite on cc2a6d4: 77/82** (`tests/suite-cc2a6d4.log`). Only the 5 known failures: production-integrity, legacy-board-ui-pure,
  reward-background-return and cloud-web-contract (FAIL), plus navigation-guard (BLOCKED_BROWSER). That is GGbot's baseline 76/81
  plus region-landing-hook.
- An earlier suite run on c1bdbf6 was killed in the 06:45–06:50 window, is void, and was rerun.
## Note: npm change in the Mac home directory (for a human to judge, no further changes made)

Times are EDT (the Mac clock is CST, UTC+8: 16:39 CST = 04:39 EDT).

**What happened.** At about 04:39 EDT on 2026-10-17, while the cinematic agent was setting up its Playwright recorder on the
Mac, an `npm install` ran in the home directory `~` (the exact command line is not in any log). It changed `~/package.json`,
`~/package-lock.json` and `~/node_modules`:
- it added a root dependency `"playwright-core": "1.56"` and installed playwright-core 1.56.1 at `~/node_modules/playwright-core`;
- npm pruned packages not listed in the lock, including `~/node_modules/draco3d`, which was extraneous (not in any lock).

**What the agent changed afterwards (04:40–04:41 EDT), trying to restore the previous state.**
1. 04:40:39: backed up the post-install state to `~/lkcam-tmp/npm-backup/`: package.json (sha256 df982c1b…), package-lock.json
   (af48745f…, 629 packages), and the removed 1.56.1 package (`playwright-core-1.56.1-removed`).
2. 04:41:41, in `~/package-lock.json` (now sha256 e82c0cfe…, 628 packages):
   - removed the root dependency `playwright-core: 1.56`;
   - `node_modules/playwright-core` is now 1.58.2, marked `peer: true`. Its `resolved`/`integrity` (npmmirror) were copied
     from the nested entry `node_modules/openclaw/node_modules/playwright-core` 1.58.2, and that nested entry was removed.

   `~/package.json` (now sha256 3df89caf…) lost the same playwright-core dependency and is back to 5 deps: @playwright/test ^1.60.0,
   @sunnoy/wecom ^2.2.1, docx ^9.7.1, playwright ^1.61.1, undici ^7.24.4.
3. On disk, `~/node_modules/playwright-core` is now 1.58.2.
4. **draco3d 1.5.7 was reinstalled at `~/node_modules/draco3d` (04:41:41). The version is a guess.** The original version was
   never recorded anywhere, because it was not in any lock. The tarball is kept at `~/lkcam-tmp/draco3d-1.5.7.tgz`.

**Known inconsistency, left as is.** npm's hidden `~/node_modules/.package-lock.json` (mtime 04:39:13 EDT, 562 entries) still
describes the post-install state: root playwright-core 1.56.1 plus the nested openclaw copy at 1.58.2. That no longer matches
`~/node_modules`. A future `npm install` / `npm ci` in `~` will reconcile it.

**Does this belong to a real project?**
- `~` is not a git repository (`git rev-parse`: "not a git repository"), so there is no history to compare against.
- Lock name: "shineanl". Both files were created on 2026-03-19 (package-lock.json 2026-03-18 16:38 EDT, package.json 17:48 EDT).
  Before today, their last change can't be recovered.
- The lock also lists openclaw 2026.3.13. The openclaw process actually running comes from the pnpm global install, not
  from `~/node_modules`.
- This looks like an ad-hoc home-directory npm area (Playwright, WeCom, docx tooling), not a versioned project. A human should
  check whether anything relies on `~/node_modules/draco3d` (version) or on the playwright-core 1.56 pin.
  - **To restore the exact post-install state:** copy `~/lkcam-tmp/npm-backup/package*.json` back and run `npm install` in `~`.

No further changes have been made to these files. The backups stay in ~/lkcam-tmp/npm-backup and ~/lkcam-tmp/draco3d-1.5.7.tgz,
and are kept through cleanup.
