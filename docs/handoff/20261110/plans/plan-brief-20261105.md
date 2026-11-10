# QIFENGLE plan rewrite briefing — 2026-11-05

Gathered for Grok Bot to rewrite the two-track development plan after Funning's 2026-11-05 ask (quota reset; re-read GitHub; Track A = acceptance+bugs with Genshin-class visual bar; Track B = continue scene/level development; audit board–scene fusion, esp. lakeside).

Times below are America/New_York (EST, UTC-5) unless marked otherwise.

---

## 1. Current shipped / GitHub state

### Branches & SHAs (concrete)

| Line | Ref | Full SHA | Role |
|---|---|---|---|
| Default branch (stale) | `int/v1` | `01e25e3eb707db3cd5c9a269a31f5fd6e3f104d5` | Default on GitHub; last meaningful merge ~2026-10-13 (PR #52 drag-swap). **Not** the live playable line. |
| Active integrate tip | `gbt/r5-b20-integrate-landing-visual-bg2` | `e976a733ba1303b1531a432b75fb952189ddcc47` | Tip after merged pause-docs PR #67. Parent playable tip: `02c9bd5eb9eff9adced0a117be59eddb01146160`. |
| Prior integrate (trial base) | same branch | `02c9bd5e…` | Lakeside kit-ON mild-overhead board cam + empty-board preload fix + balloon door/dismount + SkycityLegHeavy OFF. |
| Formal release line (open PR) | `ggbot/release-b20` | `b339414036cbba6d0b3053b035adb045b2e4b0e4` | PR #63 → `int/v1`. Suite noted 365/366 (only BLOCKED_BROWSER). |
| Meadow A+B base | `ggbot/b20-meadow-ab` | `93607a48b0db90487f9c061b9294c02a9b33f225` | Under release-b20. |
| Meadow C / skycity RT (open) | `ggbot/b20-meadow-c-skycity-rt` | `ca1bf8f949106065906f9e4648d93739245ec144` | PR #65 → release-b20. **Note:** pause doc says this SHA is **not** in the integrate object store used for trial `060228`. |
| Local-only perf | `ggbot/perf-r1` / `da238e2a` | — | **Not on GitHub** (branch 404; commit 422). Lived on box `/workspace/wt/perf-r1` / `/workspace/wt-skw`. Mac re-run of `da238e2a` never completed (Mac offline; no `*perf-r1-da238e2a*` report). |

### Live WeChat trial builds (AppID `wx3bdd911c5c06f591`)

| Version | Tip | Notes |
|---|---|---|
| **`1.0.202611060228`** (current per PR #67 / PROGRESS pause) | `02c9bd5e` on integrate-bg2 | Funning oral: balloon door closed in flight **PASS**; period stutter + clipping **FAIL/hold**. Lakeside empty-board / mild top-down **unconfirmed**. Dev/test **paused for Clonebot** (docs-only pause note). |
| `1.0.202611050927` | `9ec8410` | Prior integrate sample. |
| `1.0.202611050759` | `dc248d14` | TSW default OFF; Funning「不卡了」for that period-stutter A/B (ROOT HIT PR #66). |
| `1.0.202611011047` | `b3394140` (release-b20) | Uploaded 2026-11-01; set 体验版; Mac sim acceptance incomplete (simfail). Recorded on issue #64. Older than Nov 5 integrate trials. |

### Recent commits on active integrate (last ~15, newest first)

1. `e976a733` — 【进度备注】1.0.202611060228 暂停交接 Clonebot (#67)
2. `02c9bd5e` — fix(cine): lakeside kit-ON mild-overhead board cam (`portraitFusion`)
3. `dfe0c01f` / `a77f1a6c` — lakeside empty-board: apply `LAKESIDE_KIT` flag **before** board preload mount
4. `66286cf4` — balloon door B rest-180 + B5 land seat (no meadow fling); hide 继续旅程/主页 in transit
5. `09880379` / `203503e8` — SkycityLegHeavy default OFF (ascent+plaza stutter A/B)
6. `9ec8410c` — meta-allowlist BoardKit/BoardProjection/CoastBoardPieces
7. `81bcc7ec` / `457b359c` — LAKESIDE_KIT trial default **ON** for WeChat sample A/B
8. `43443b09` — rewrite LAKESIDE_KIT for Funning fusion sample (acceptance = lakeside interior board pieces, not coast kit)
9. `8d317527` — LAKESIDE_KIT board-kit (default OFF, `?qflakesidekit=1`)
10. `b2b11461` — docs ROOT HIT TransitionShaderWarm (#66)
11. `dc248d14` — TransitionShaderWarm default OFF

### Open PRs (high signal)

- **#63** open: `ggbot/release-b20` → `int/v1` — playable b20 + HANDOFF.md @ `b3394140`. journal-r6 **not** merged (13 conflicts).
- **#65** open: `ggbot/b20-meadow-c-skycity-rt` → `ggbot/release-b20` — live program cache / meadow→skycity shaders.
- Many older open PRs still point at `int/v1` / `gbt/r5-integrated` / `int/v2-slim` (sit/skirt/coast/UI); treat as backlog, not current tip.

### Closed / merged recently

- **#67** merged 2026-11-05 ~13:52 EST: pause + Clonebot handoff docs for trial `060228`.
- **#66** merged 2026-11-05 ~08:36 EST: ROOT HIT — period stutter = `TransitionShaderWarm`; keep default OFF.
- Older: #62 b18 path, #52 drag-swap, etc.

### Open issues

- **#64** open — “Handoff: current status” → points at release-b20 HANDOFF + PR #63. Comments document: upload `1.0.202611011047`, R2-COLD FAIL, slimacc+perf FAIL findings, perf-r1 Mac FAIL (160 console errors; branch not on GitHub).
- Search for open handoff/acceptance/coast/meadow/lakeside/skycity: primarily #64; many related PRs still open rather than issues.

### Key HANDOFF open issues / next steps

**From GitHub `HANDOFF.md` on `ggbot/release-b20` @ `b3394140`:**

Open issues:
1. env_meadow shader compile stall (~1.6 s sail set-off); warm-up C not done.
2. Lake freeze (`fc3123fa`) unconfirmed on Mac.
3. DevTools simfail race (getBuilder); R1 retry incomplete.

Next steps listed: R1 six-launch; J7b; preview/QR; J8; r8; b20 B23; meadow C; preview P3s; port fin→coast/b20; glb-skin rebake; 48 legacy fails; pin debt.

**From local `/workspace/wt/perf-r1/HANDOFF.md` (supersedes for perf, not pushed):**

- P0 render-budget crash on Mac for `3e5be7f5` fixed on box at later SHAs (`137c85ac` / `da238e2a`) but **never Mac-proven / never uploaded**.
- Memory release wired (WNC) on box; device unmeasured.
- Overlay only in preview-flavor builds.
- R2-COLD is the acceptance launch environment (compileType×1 still fails strict gate but game starts).
- Findings: Skycity L1 autoplay losses = weak harness solver; main route skipping harbor expected on b20; camTrace “hang” is host/observation stop.

**From `docs/handoff/PM/PROGRESS-060228-PAUSE-20261105.md` (integrate tip):**

- Minigame **paused** for Clonebot (as of that note). Funning's **new** 2026-11-05 afternoon ask (quota restored; two tracks + fusion audit) **supersedes** “do not keep fixing” for planning — treat pause as historical Clonebot handoff, then resume under the new plan.
- TSW must stay OFF unless Funning reopens.
- Kit / SkycityLegHeavy defaults: do not flip as part of pickup.

---

## 2. Board–scene fusion philosophy

### Funning's rule (2026-11-05, user message — authoritative for this rewrite)

> 游戏的棋盘要和游戏的场景尽可能的高度融合……湖畔的有些棋盘应该是在湖面上去做交互。山顶的那个餐厅部，就要在餐厅部上去做交互。海边的沙滩就要在海边的那个沙滩去做交互。如果是雪地就要在雪地上去做交互……湖畔那边已经出了问题。

### Earlier product decisions (memory / journal)

- **2026-10-30:** Funning chose **B** — coast as first pilot for **board fused into the real scene**, built as a shared kit all regions adopt afterwards (not “blurred 2D board forever”).
- **2026-10-30 audit:** At that check, **no** region (island/meadow/lakeside/skycity) had the board as a real in-scene object; all used shared 2D `ManagedMobileBoardUI` / BoardArt over a per-region background.
- **2026-10-30 art:** Regions may have features, but **art style must never change**; every scene acceptance compares side-by-side vs island v2.2 + meadow same viewpoint.

### Intended kit lineage (code/docs)

- **Coast kit** (`BoardKit` / `BoardProjection` / `CoastBoardPieces`, unmerged `coast-kit-int` / `ggbot/coast-*`): pilot for in-scene board on beach. **Not** on b20 main route (`HANDOFF`: coast/harbor only on unmerged coast branches).
- **LAKESIDE_KIT** (Nov 5 integrate): rewrite so acceptance = Funning lakeside interior board (`wb_line` + `buoy_lantern` + `chime_raft` + `LK_piece_*`), water as carrier (`LK_board_frame` skipped), 2D tray hidden when kit ON, camera `portraitFusion` mild top-down when kit ON. Trial default ON (`?qflakesidekit=0` kill-switch). Empty-board race fixed by applying flag **before** preload.

### Playable board / level → scene placement (as of active lines)

| Stages | Region (product) | Scene surface intended | What ships today | Fusion verdict |
|---|---|---|---|---|
| 01–04 | Island 小岛 | Beach / cottage / yard | Live 3D island; board still primarily **2D UI** over island framing | Partial — world fused, board not on sand as interactive 3D surface |
| 05–08 | Meadow 风车草原 | Meadow grass / windmills | Live 3D meadow board background (`MeadowBoardBackground`); 2D board UI | Partial — background fused; pieces not grass-embedded kit |
| 09–12 | Skycity 天空之城 | Plaza / cloud lawn | Live 3D skycity board bg; 2D board UI; RT churn historically bad | Partial — same pattern |
| 13–16 | Lakeside 湖畔 | **Lake water surface** (Funning) | 3D lakeside world + **LAKESIDE_KIT** attempt (trial ON on `060228`); oral lakeside empty/cam **unconfirmed**; Funning says **already drifted** | **Mismatch / P0 fusion debt** — kit exists but not accepted; historically 2D tray over lake or empty 3D |
| (planned) Coast / harbor / beach | Coast | **Sand / shore** | Unmerged coast kit branches only; not on b20 journey | Missing from mainline |
| (concept) 雪山风铃山口 | Snow | **Snow surface** | `docs/r6/ui/concepts/concept_snow.png` 2D only | Not built |
| (concept) 灯塔 / 小镇 / 庭院 | Later | Per concept | 2D concepts only (`concept_lighthouse/town/courtyard`) | Not built |
| (design memory) 湖畔村, 秋林铁路, 雪夜观星台, 云海, 山丘重逢 + … = **8 regions** planned | — | — | Journey code: island→meadow→skycity→lakeside | Later regions not in `JOURNEY_TRANSPORT` |
| (Funning today) 山顶餐厅 | Summit restaurant | **Restaurant interior surface** | No clear shipped region id; closest concepts = courtyard / future summit — **needs inventory confirm** | Drift / undefined mapping |

Journey transport (code quote, `JourneyTransport.ts`):

```text
island-meadow → sail
meadow-skycity → balloon
skycity-lakeside → balloon
```

`REGIONS` loader entries (release/perf): `island`, `meadow`, `skycity`, `transitBalloon` (+ lakeside mounted via lakeside-specific paths / walkable list `['island','meadow','skycity','lakeside']`).

### Fusion audit flags (actionable)

1. **Lakeside P0:** Funning reports design drift; trial kit ON but feel unconfirmed; empty-board race just fixed in tip — needs Funning visual accept that pieces sit **on water**, interaction feels lake-native, camera mild top-down OK.
2. **All current mainline boards** still fail the Oct 30 / Nov 5 “board ON surface” bar unless kit path is ON and accepted.
3. **Coast pilot unfinished** — cannot claim shared kit rolled out to all regions.
4. **Snow / restaurant / lighthouse / town / courtyard** — concept only; no fused boards.
5. **Meadow vs skycity tray ΔE = 0** in r6 UI audit (shared tray/tiles) — visual identity debt even before 3D fusion.

---

## 3. Acceptance / QA standards already documented

### Genshin-class / industry bar (documented)

- `docs/r6/ui/RESULT.md` title: **「对标原神级别」** — lakeside board UI self-check.
- Measurable UI bars used there / ui-audit:
  - Background saturation ≤ board saturation; **saliency (board/bg) ≥ 10**
  - Roof saturation &lt; 40%; night lake **B ≥ G &gt; R**
  - HUD contrast ≥ ~4.5 (WCAG-style); tray must not steal focus (low chroma)
  - Side-by-side region compare (1× / grayscale / squint) + ΔE
  - Funning board principles: no corner rivets; tray not heavy/saturated; tiles not blueberry-like; lily vs leaf distinguishable when squinting
- Funning Oct 29: research industry UI/animation/VFX/transition acceptance beyond Genshin bar and upgrade the system (memory) — **upgrade not fully productized as a single checklist in repo tip**.
- Funning Oct 30: every scene acceptance = **side-by-side vs island v2.2 + meadow**, same viewpoint; art style locked.
- Funning Oct 15: watch **rendered video** for obvious visual problems before trusting numeric clip counts.

### Automated / Mac suites (what they cover vs gaps)

| Suite / harness | Covers | Gaps vs Funning's ask |
|---|---|---|
| `tools/journey-integration/run-suite.cjs` (365–371 checks) | Logic, composition doubles, many region/skirt/cam gates; 0 FAIL except allowed `navigation-guard` BLOCKED_BROWSER | Explicitly **no** Creator build, WebGL pixels, device, WeChat (`report.scope`) |
| Mac slim acceptance (MAIN / SKIRT / JOUR) | Full route autoplay, skirt, diary hooks | MAIN failed Skycity L1 autoplay (harness solver); SKIRT/JOUR incomplete under simfail/CDP; **not** beauty/reasonableness |
| Mac perf (`?camTrace=1`, perf-r1) | Long frames, GPU probes, RT churn | Device heat/fps; visual A/B unfinished for fixed perf SHAs |
| R1 / R2-COLD launch gates | DevTools start reliability | Tooling race, not game content |
| r6 UI offline metrics / ui-audit | Board UI beauty numbers | Not wired as hard gate on every integrate upload |
| Autoplay solver | Progress through levels | Weak 1-ply; false “level too hard” |

**Gap summary for Track A:** Need an explicit **Genshin-class visual acceptance checklist** (beauty + reasonableness + fusion-on-surface + style lock) that blocks upload, not only Node suite PASS.

---

## 4. Known open bugs (priority-shaped)

| ID | Severity | Status |
|---|---|---|
| Period stutter (ascent / post-landing walk) | P0 feel | FAIL/hold on `060228`; TSW OFF already; SkycityLegHeavy OFF; still not optimized per Funning |
| Clipping 穿模 | P0 feel | FAIL/hold on `060228` |
| Lakeside fusion / empty or wrong board | P0 design | Kit ON + preload fix + portraitFusion in tip; Funning unconfirmed + says drifted |
| DevTools simfail / compileType×1 | P0 tooling | Blocks reliable Mac acceptance |
| Phone ~30 fps + heat | P0 device | Root-caused Nov 1; perf-r1 fixes **not** on GitHub / not Mac-proven / not in `060228` |
| env_meadow shader stall ~1.6 s | P1 | Warm-up C open |
| Memory only grows across regions | P1 | Wired on box perf-r1; not in shipped trial |
| Skirt / diary Mac acceptance incomplete | P1 | Launch/CDP issues |
| Lotus seats / known gaps | P2 | Called out in pause note |
| Coast not on mainline | P2 product | Unmerged |
| `int/v1` stale vs integrate tip | Process | Default branch misleading |

---

## 5. Scene inventory (short)

**Shipped journey regions:** island → (sail) meadow → (balloon) skycity → (balloon) lakeside.

**Levels:** mainline 01–04 island; 05–08 meadow; 09–12 skycity; 13–16 lakeside (params/docs + lily skin; kit path for 3D pieces).

**Concept / planned (not journey-wired):** snow pass 雪山风铃山口; lighthouse; town; courtyard; design-doc later set includes 湖畔村 / 秋林铁路 / 雪夜观星台 / 云海 / 山丘重逢; Funning **山顶餐厅** needs explicit region mapping.

**Coast:** kit + art existed on side branches; style once drifted (r4d); not in b20 route.

---

## 6. Recommended two-track plan outline

### Track A — Acceptance + bugs (Genshin-class bar)

**First 5 concrete next actions**

1. **Write & adopt `ACCEPTANCE-VISUAL-v1.md`** on the active integrate tip: (a) style lock vs island v2.2+meadow same POV; (b) fusion-on-surface check per region; (c) UI metrics from r6 (≥10 saliency, sat rules, contrast); (d) animation/VFX/transition reasonableness; (e) no upload without Funning or designated visual PASS. Quote Funning Nov 5 fusion rule at top.
2. **Lakeside fusion accept pass on device** for `1.0.202611060228` / tip `02c9bd5e` (or rebuild if needed): confirm pieces on water, no empty board, mild top-down OK; record PASS/FAIL on #64; if FAIL, open a single fusion fix branch (no style drift).
3. **Resume Mac acceptance under R2-COLD** once Mac online + disk ≥5 GiB (auto-clean caches per Funning rule): MAIN with improved autoplay or human Skycity L1 check; SKIRT; JOUR; block on console errors.
4. **Land or discard perf-r1:** push `ggbot/perf-r1` (needs Funning OK historically) **or** cherry RT-churn + shader-global-flip + memory-release + safe DPR budget onto integrate; Mac prove 0 boot console errors; preview-flavor trial with `?perf=1` for iPhone 16 Pro numbers.
5. **Period stutter + clipping triage** (Clonebot/GGbot): keep TSW OFF; measure whether SkycityLegHeavy OFF helped; new root cause only with before/after video — do not reopen TSW without Funning.

### Track B — New scenes / levels (火力全开)

**First 5 concrete next actions**

1. **Fusion backlog map:** table every board (01–16+) → required surface (sand / grass / plaza / lake / snow / restaurant / beach); mark MISMATCH; lakeside first, then coast kit completion as shared kit.
2. **Finish coast as shared BoardKit pilot** (Funning Oct 30 B): merge/port coast kit with **style lock** vs island+meadow; beach interaction on sand; then templatize for snow/restaurant.
3. **Specify 山顶餐厅** as a real region brief (layout, board anchor on restaurant floor, levels count, journey hook after lakeside or parallel) — currently named by Funning but not in `JOURNEY_TRANSPORT`.
4. **Produce next region beyond lakeside** from existing concepts (priority suggestion: **雪山风铃山口** has concept art + transition draft) with fused board from day one — no more “2D tray + postcard bg” new regions.
5. **Level content surge:** implement lakeside 13–16 data if still suggestion-only; draft 17–N difficulty using `DIFFICULTY-13-32.md`; keep engine signatures stable; each new level ships with visual accept shots under Track A checklist.

### Process / sequencing

- Prefer integrating onto **`gbt/r5-b20-integrate-landing-visual-bg2` @ `e976a733` / `02c9bd5e`**, not stale `int/v1`.
- Keep PR #63 / #65 honest: either merge release-b20 story or retarget docs to integrate tip as source of truth.
- Upload rule unchanged: formal via `FORMAL_RELEASE=1 build-production-upload.sh`; always set 体验版 after upload; preview flavor if perf overlay needed.
- Do **not** default-ON TransitionShaderWarm.

---

## 7. Source index (paths)

- GitHub HANDOFF: `https://github.com/Funning0423/yiqifengle/blob/ggbot/release-b20/HANDOFF.md`
- Issue #64: `https://github.com/Funning0423/yiqifengle/issues/64`
- PR #63 / #65 / #66 / #67
- Pause note: `docs/handoff/PM/PROGRESS-060228-PAUSE-20261105.md` @ integrate-bg2
- Local perf HANDOFF: `/workspace/wt/perf-r1/HANDOFF.md`
- Local release HANDOFF: `/workspace/wt/release-b20/HANDOFF.md`
- Levels: `docs/REGION-LEVELS-20261015.md`, `docs/r6/ui/LAKESIDE-LEVELS.md`
- Genshin UI bar: `docs/r6/ui/RESULT.md`
- Journey: `docs/REGION-JOURNEY-20261015.md`
- Mac reports: `/workspace/qifengle/test-reports/20261101T*`
- Trial QR (older): `/workspace/qifengle/trial-qr.png` (for `011047`, expires ~Nov 8)

---

*End of briefing.*
