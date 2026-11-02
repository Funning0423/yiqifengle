# HANDOFF — fx/r5-black-landing-fix（草甸黑面 + 天空城落地穿模）

**Bot:** 场景特效bot  
**分支:** `fx/r5-black-landing-fix`  
**修复 SHA:** `2af136607945861b34b4ed8bdba4849cc3d80121`  
**基点:** `606f434eb6289aa03585165ee9f76aff775fa504`（`github/ggbot/b20-meadow-c-skycity-rt` / PR #65 tip）  
**日期:** 2026-11-02（America/New_York）  
**微信包:** 未上传（等 Grok 验收）

## 根因（一句话）

草甸黑面：`M_meadow_palette`×无 COLOR_0，b20 warm-up 非 null 时跳过同步 `configureMeadowVertexColors`；天空城穿模：`showIsland` 在 cover/strataOff 后关岛体，B5 走出时 `arrived` 仍为 false，脚下只剩云海。

## A) 可见黑面（栅栏 / 路径 / 大气球旁结构）

### 根因
- 截图对应 `env_meadow` 上共享 `M_meadow_palette` + `USE_VERTEX_COLOR=true` 的无 COLOR_0 mesh（`meadow_fence_merged`、`meadow_path`、`windmill_*`、远山等）→ 缺色通道被当成 (0,0,0,1)。
- 花草实例有 COLOR_0，故绿边正常。
- `beginMeadowSailWarm` 返回非 null 后，`RegionJourneyAdapter` 原逻辑 `if(!warm)configureMeadowVertexColors(model)` 跳过同步修补；warm 异步编译完成前（或未走到）画面保持黑面。旧手机包无 warm 门控，始终 configure。

### 改动
- `RegionJourneyAdapter.ts`：无论 warm 是否存在，挂载后始终 `configureMeadowVertexColors(model)`。
- `SailPreload.ts`：`beginMeadowSailWarm` 后同样同步 configure。
- 未改 glb（未 bake COLOR_0）；运行时开关与历史 `configureMeadowVertexColors` / balloon 门绕序修法同族。

## B) 天空城落地穿模（人站云海）

### 根因
- `BalloonTransit.paint`：`showIsland = arrived || (cityOn && t < strataOffAt && !cover)`。
- `LAND_T=35`，`HANDOFF_COVER_T=35.9`，`STRATA_OFF_T=36`，`FLIGHT_DURATION=36`。
- 接近落地后 cover/strata 关 `ISLAND_BODY`（`env_sky_static_palette` + `env_sky_static_rock_strata`）；B5 门走出发生在 `arrived=true; paint(plan.total)` **之前**，且 ride `beforeDraw` 已停 → 整段走出岛面关闭，S0 朝海只见云海 + 远 `floatingrocks`。
- Soft cloudsea 在 S0 下约 y−37，并非脚底替代面；问题是岛体被藏，不是落点坐标错。

### 改动
- `showIsland` 增加 `t >= LAND_T`，自触地时刻起保持岛体可见。
- B5 开始前强制：`ISLAND_BODY`/`ISLAND_VINES` on、`skyNodeAfterArrival` lawn on、解除 soft `setFlightHidden`。

## 测试

| 项 | 结果 |
|----|------|
| `tools/meadow/test_meadow_vertex_colors.cjs` | PASS |
| `tools/meadow/test_meadow_sail_warm.cjs` | PASS（断言去掉 `if(!warm)` 门控；preload 也 configure） |
| `tools/transitions/test_sky_arrival.cjs` | PASS（LAND_T 门闩 + B5 强制岛面） |
| `tools/test_manifests.cjs` | PASS（已 `--write`） |
| 全量 `run-suite.cjs` | 跑过；本修复相关项 PASS。箱内多项 FAIL 为缺 `DRACO3D`/Blender/`ggbot/full9c-final` 等环境依赖，与本次改动无关（见 suite log） |
| glTF-Validator | N/A（未改 glb） |
| 实机 / Blender after 帧 | **未测**（无设备包；等验收） |

## 预览

`/workspace/yiqifengle/previews/场景特效bot/r5/black_landing_fix/`
- `01_before_black_fence_balloon.png`
- `02_before_skycity_sea_landing.png`
- `README.md`（根因对照；无 after 实机帧）

## 未做 / 并行

- GGbot 负责 landing RT 探针；本分支不扩 texture pool、不碰 RT 预算。
- 未 bake meadow COLOR_0 白顶点（可作后续耐久备份）。
- 通过前不上传微信。

## 推送

- `git push -u github fx/r5-black-landing-fix` → **403**（只试 1 次）
- Bundle: `/workspace/yiqifengle/bundles/push-20261102/场景特效bot-fx-r5-black-landing-fix.bundle`
- Bundle HEAD / 分支 tip: `fb7e9f72b584b79f54ca2eb9fad2af10f43da376`

