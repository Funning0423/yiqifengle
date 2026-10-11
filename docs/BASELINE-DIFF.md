# BASELINE-DIFF：original vs near vs matte

生成：Grok Bot，2026-10-11 05:32 CDT。来源：交接包 `20261011T100310Z-oi-mac-source-resources.tar.gz`（SHA256 06b220b5…6606657）解出的三套 Mac 工程，逐文件拷贝后与原目录 `diff -r` 完全一致；STOP-STATUS 七个关键文件 SHA 三个分支均 7/7 吻合。

| 分支 | 提交 | 来源目录 | STOP-STATUS 记录的 main SHA256 |
|---|---|---|---|
| baseline | d32920c（原样快照）→ 7551546（+gitignore，+本文档前） | original-project（dot/beach-q-safe-20261011，HEAD 1ee4a7f） | 519bce02…ddf45 |
| near | 41fabe7 | near-isolated（R→S→cloud(T)→near） | f7588d24…c28e19e9 |
| matte | 26b6305 | matte-isolated（Q→fish-v2→matte） | 469b3234…755b4024 |

说明：Mac 原 .git 只是指向 Mac 本机的 worktree 指针文件，没有 git 对象；本仓库历史从这次快照开始，1ee4a7f 仅为记录值，无法在本仓库中检出。main SHA 是构建产物指纹，本仓库只含源码，无法复算。

## baseline → near（ 5 files changed, 42 insertions(+), 13 deletions(-)）

| 状态 | 文件 | baseline 字节 | near 字节 |
|---|---|---|---|
| M | `creator-build-project/assets/bundles/region_island/combined_visual_m.glb` | 5020780 | 5019964 |
| M | `creator-build-project/assets/scripts/render/RoomLightingRig.ts` | 28039 | 28897 |
| M | `creator-build-project/assets/scripts/world-r1/FirstsliceFacts.ts` | 43446 | 43446 |
| M | `creator-build-project/assets/scripts/world-r1/FirstsliceRoutes.ts` | 4826 | 5844 |
| M | `creator-build-project/assets/scripts/world-r1/WorldFlowCore.ts` | 17732 | 17946 |

要点：岛屋 GLB 231e2987… → 77bff8b3…（场景交接中的 T-on-S GLB），FirstsliceFacts → 290bbd42…（T-on-S Facts），RoomLightingRig → 5dc228a0…（S Rig：SeaSampler 只读回执、阴影 PCF SOFT→SOFT_2X）；FirstsliceRoutes 8272f925…、WorldFlowCore c5cd721f…（近门可读镜头 doorway-camera-readable）。

## baseline → matte（ 25 files changed, 832 insertions(+), 32 deletions(-)）

| 状态 | 文件 | baseline 字节 | matte 字节 |
|---|---|---|---|
| M | `creator-build-project/assets/scripts/ManagedMobileBoardUI.ts` | 53521 | 53647 |
| M | `creator-build-project/assets/scripts/ui/TactileToolButton.ts` | 6037 | 6520 |
| M | `creator-build-project/assets/scripts/world-r2/OriginalLevelBackground.ts` | 18592 | 24622 |
| M | `creator-build-project/assets/scripts/world-r2/OriginalLevelEnvironment.ts` | 22913 | 27259 |
| A | `tools/cloud-leap-proposal/README.md` | - | 4930 |
| A | `tools/cloud-leap-proposal/corridor.cjs` | - | 5718 |
| A | `tools/cloud-leap-proposal/diagram.cjs` | - | 2264 |
| A | `tools/cloud-leap-proposal/fixtures/same-size-unsafe/OriginalLevelBackground.ts` | - | 22846 |
| A | `tools/cloud-leap-proposal/fixtures/same-size-unsafe/OriginalLevelEnvironment.ts` | - | 27259 |
| A | `tools/cloud-leap-proposal/occlusion.cjs` | - | 6000 |
| A | `tools/cloud-leap-proposal/profiles.cjs` | - | 2328 |
| A | `tools/cloud-leap-proposal/test_corridors.cjs` | - | 3162 |
| A | `tools/cloud-leap-proposal/test_profiles.cjs` | - | 2199 |
| A | `tools/cloud-leap-proposal/test_reader_independent.cjs` | - | 3627 |
| A | `tools/cloud-leap-proposal/test_safe_flip.cjs` | - | 7543 |
| A | `tools/cloud-ocean-leap/actual_geometry.cjs` | - | 1361 |
| A | `tools/cloud-ocean-leap/benchmark_selector.cjs` | - | 1039 |
| A | `tools/cloud-ocean-leap/replay.cjs` | - | 3575 |
| A | `tools/cloud-ocean-leap/source_stamp.cjs` | - | 592 |
| A | `tools/cloud-ocean-leap/test_pending_layout.cjs` | - | 2724 |
| A | `tools/cloud-ocean-leap/test_provider_visibility.cjs` | - | 4199 |
| A | `tools/cloud-ocean-leap/test_reader.cjs` | - | 2132 |
| A | `tools/cloud-ocean-leap/verify_reports.cjs` | - | 2036 |
| M | `tools/cloud-ocean/provider-harness.cjs` | 7603 | 7703 |
| M | `tools/cloud-ocean/test_provider.cjs` | 10009 | 9979 |

要点：运行时改动只有 4 个 .ts（ManagedMobileBoardUI、ui/TactileToolButton、world-r2/OriginalLevelBackground、OriginalLevelEnvironment，对应 fish-v2 + matte 道具按钮）；其余 21 个是 tools/ 下的测试/提案脚本（cloud-leap-proposal 新增 13 个，cloud-ocean-leap 新增 8 个，cloud-ocean 改 2 个）。matte 不含 near 的场景/镜头改动。

## near ↔ matte

两者互不包含： 30 files changed, 845 insertions(+), 74 deletions(-)。合并时 near 的 5 个文件与 matte 的 25 个文件没有重叠路径。

重叠检查：0 个路径同时被 near 和 matte 修改。
