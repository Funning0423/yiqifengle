# T5-material：出门 22–22.8 s 灯塔/小屋"深棕 → 亮白"突变

分支 `work/GGbot-t5`（自 near `41fabe7`）。结论在 baseline `1ef9f1d` 上同样成立（行号见 §2）。

## 0. 结论（一句话）

**不是 LOD，不是换了另一套场景/预制体实例，也不是材质/贴图换了。** 灯塔+小屋始终是同一个 MeshRenderer、同一个 mesh、同一个材质；
突变来自 **`RoomLightingRig` 把"室内光照方案"（全局太阳方向/强度/颜色 + 环境光 + 阴影）一直挂到出门走完，
到 `restore()` → `setLayers(ISLAND)` 那一帧才一次性切回场景原本的"海岛光照方案"**。这在白天和夜晚都出现；回屋时则反向（白 → 暗）跳一帧，只是被弹窗关闭挡住了。

和 df09ce8（门边小窗夜里还是白天）**不是同一类问题**：那次是一张 unlit 窗景卡片没进夜间 tint 名单；这次灯塔/小屋用的是受光照的 `M_env_palette`（全岛共用一个材质），
不在 `unlitBackdrops` 名单里，也不需要进；它变色是因为全局灯光被改了，白天视频里同样会跳。夜间 tint 名单（`backdropNames` + df09ce8 加的 `env_window_blind_cards`）与本问题无关，T5 补丁和 df09ce8 可以干净叠加（已用 `git apply --check` 验证）。

## 1. 证据

### 1.1 视频/截图（帧号可复现：`tools/t5/measure_video_jump.py`）
| 素材 | 帧 | 塔身 ROI 平均亮度 | 小屋 ROI | 海面 ROI |
|---|---|---|---|---|
| `evidence-cloud/06-native-evidence/near-camera/native/08-outbound-motion.mp4`（sha256 40dfce45…，60 fps） | ≈22.73 s → 22.75 s（`end-frames/0078.png` → `0079.png`，已有的 `end-frame-differences.json` 记作 index 79 / 22.8 s，场景均值差 34.7，全片第一） | 151.3 → 203.4（**+34.4% / 1 帧**） | 142.7 → 197.3（**+39.1%**） | 162 → 123（**−23.9%**） |
| 同一视频 22.0–22.73 s | 镜头已停在 cameraIsland，前 ~15 帧各 ROI 变化 < 0.1%/帧 | — | — | — |
| `11-return-motion.mp4` | ≈1.80 s（关闭"海岛小憩"弹窗那帧） | −35.5% | −39.1% | −31.0% |
| `mac-tests/shots/walk3/` 夜间 | `w-021.8.jpg` → `w-022.3.jpg`（`pair-jump.jpg` 第 1 → 2 张） | 夜里同样暗棕→灰白；全画面中段亮度 64.0 → 69.6，之后与 `island-final.jpg`（69.5）一致 | | |

RGB（塔身 ROI）：0078 = (156,151,138) 偏棕灰 → 0079 = (207,203,194) 白。镜头在突变前 15 帧完全静止，所以确认**不是镜头**。
同一帧里还发生：门洞/窗洞从"能看到室内"变成黑洞（室内壳 `env_interior_shell` 被关），海面变暗（环境光颜色从暖白变回蓝）。
对比图：`docs/T5-evidence/outbound-0078-vs-0079.jpg`、`docs/T5-evidence/walk3-night-21.8-vs-22.3.jpg`；逐帧数据：`docs/T5-evidence/*-roi-luma.csv`。

### 1.2 资产：只有一套灯塔/小屋
- 预制体：`assets/bundles/region_island/combined_visual_m.glb`，uuid `498b3fa5-2dd3-4e86-93b8-637ae51438fe`，运行时只 `instantiate` 一次
  （`scripts/region/RegionLoader.ts:22` prefabUuid `…@87291`；`WorldFlowComponent.ts:203`）。场景 `WorldR5Integration.scene` 里只有 `Main Light` 和 `Main Camera` 两个节点，没有第二个灯塔实例/预制体。
- 灯塔+侧屋外壳：节点 `env_lighthouse_ext`（glTF node 98，mesh 32，`…@a6ed6`），材质 `M_env_palette`（`…@18b7e`），贴图 `env_palette_256`（image `…@e7e58`）。baseline 与 near 完全相同。
- 门：`env_lighthouse_door`（mesh `…@39a0a`，同一 `M_env_palette`）。
- 室内壳：`env_interior_shell`（mesh `…@baef1`，材质 `M_env_palette_interior_1s` `…@25644`）——只在 interior 层开。
- LOD：glb.meta `userData.lods.enable=false, hasBuiltinLOD=false`；场景/预制体里没有 `cc.LODGroup`。
- 烘焙/探针/反射：`cc.StaticLightSettings _baked=false`；无 LightProbe/ReflectionProbe；`SkyboxInfo _enabled=false, _useIBL=false`；`FogInfo _enabled=false`。
- 代码里 `env_lighthouse_ext` 在 `setLayers` 中被特殊处理为 `interior||exterior` 时都开（`WorldFlowComponent.ts:262`），即 BOTH 与 ISLAND 下是**同一个 renderer 一直开着**；没有任何地方给它换材质（`bindIslandSourceAlpha` 只在加载时对透明件做一次，与层无关）。

### 1.3 光照：两套方案
| | 海岛方案（场景原值，`WorldR5Integration.scene`） | 室内方案（`RoomLightingRig.setView(interior=true)`） |
|---|---|---|
| 太阳方向 | 节点 euler(−30,−30,0)，光线方向 (0.43,−0.50,**−0.75**)：从镜头一侧打到塔正面 | 节点移到 (0.8,6.6,−7) 并 `lookAt(−0.4,0.6,−2)`，光线方向 (−0.15,−0.76,**+0.63**)：从背后打，塔正面（法线≈+Z，镜头在 +Z 方向 [−12,15.5,48]）**完全背光** |
| 太阳强度/颜色 | 125000 lx × lightScale(白天 1 / 夜 0.35)，白色 | 125000 × 0.60（夜 0.035），`#fff4de` |
| 环境光 | skyIllum 20000，sky (51,128,204) 蓝，ground (51,51,51) | skyIllum = 125000×0.15 = 18750，sky `#b4c8dd`，ground `#9c856d`（棕） |
| 阴影 | 太阳不投影，scene shadow 512 | 太阳 ShadowMap 1024、fixed-area ortho 4.1、saturation 0.72 |

背光 + 棕色地面反照 → 塔/小屋正面只剩环境光 → "深棕"；切回海岛方案后正面被 125000 lx 直射 → "亮白"。海面相反（室内方案的暖白环境光让海更亮）。

## 2. 触发代码（file:line）

near `41fabe7`：
1. `world-r1/WorldFlowCore.ts:172` `leaveHome()` 开门后 `setLayers(BOTH)` —— interior=true，室内方案一直保持。
2. `world-r1/WorldFlowComponent.ts:262` `setLayers` → `applyDayNight()`；`:326` 先把 Main Light 写回海岛强度/颜色，`:331` 再 `roomLighting.setView(interiorVisible,…)` 用室内方案覆盖。
3. `render/RoomLightingRig.ts:314-345` `setView(true)`：`:329` 改太阳位置/朝向，`:334` 强度×0.60，`:339-341` 环境光，`:344` 阴影强度。
4. `world-r1/WorldFlowCore.ts:175` 走到岛上后 `this.stable='island';this.restore()` → `:112` `setLayers(ISLAND)` → `setView(false)` → `RoomLightingRig.ts:345` `restoreSun(false)`（`:392-408` 一次性恢复太阳朝向/阴影/环境光）+ 关闭 `env_interior_shell`。**这就是 22.75 s 那一帧。**
5. 回屋反向：`WorldFlowCore.ts:208` `returnHome()` 一开始在岛视角就 `setLayers(BOTH)`，同一帧切到室内方案。

baseline `1ef9f1d` 机制完全相同：`WorldFlowCore.ts:109/169/172/205`，`WorldFlowComponent.ts:262/331`，`RoomLightingRig.ts:304/319/335`（唯一差别是 near 把室内阴影 PCF 从 SOFT 改成 SOFT_2X，与本问题无关）。

## 3. 统一方案（已做原型，只改代码，不动资产）

**原则：画面里看得到外景时只用一套光——场景原本的海岛方案；室内方案只在镜头在屋里时生效；两者之间按走路进度连续过渡，不再有"一帧切换"。**

原型（本分支提交）：
- `RoomLightingRig.ts`：新增 `setRoomLightWeight(w)`（0 = 海岛方案，1 = 室内方案）。插值太阳朝向（slerp：从场景原朝向到室内 lookAt 朝向）、强度、颜色、环境光强度/颜色；阴影强度 `shadowSaturation` 从 0.72 渐变到 0（0 = 阴影完全不压暗，所以关阴影时不会跳）。`w=1` 时用与旧代码**完全相同**的赋值（屋内画面不变）；`setView(false)` 仍走原 `restoreSun`。
- `WorldFlowComponent.ts`：world lease 新增 `blendRoomLight(from,to,seconds,token)`（走现有 `run()` job，可取消）；离散的 `setLayers()` 只要 interior 就落回 w=1，保证取消/暂停/恢复后状态确定。
- `WorldFlowCore.ts`：`WorldLease.blendRoomLight?` 为**可选**（老 adapter/测试桩不受影响）。
  - 出门：`outCrossing` 走完（镜头已在门外、背对塔）后，与 `toIsland` 这段走路**同时、同时长**把 w 从 1 渐变到 0（实测路线 6.26 s ≈ 376 帧），所以到 `restore()` 时光照已经是海岛方案，`restore()` 只剩关室内壳。
  - 回屋：`setLayers(BOTH)` 同一同步步骤里把 w 设为 0（不再在岛视角跳暗），随 `toThreshold`（7.05 s）渐变到 1，到门口时正好是室内方案。

估算（`tools/t5/test_room_light_blend.cjs`，塔正面 Lambert 代理 + gamma，两端标定到视频实测亮度 151.3/203.4）：
旧逻辑单帧 +34.4%（与视频一致）；新逻辑最差单帧 **0.55%**（376 帧）；即使压缩到 **53 帧** 也只有 **3.3%/帧**，< 8% 门槛。

不推荐的备选：
- 只把 `restore()` 挪到镜头背对塔时：海面/地面仍会一帧跳 24%+，过不了 8%。
- 改室内方案的太阳方向去迁就外景：会改动已验收的屋内画面。
- 再做一套"室内看到的外景"资产：增包，且没必要——外景本来就只有一套。

## 4. 包体影响
- 不改任何资产（glb/材质/贴图/场景/meta 都没动），不新增文件进 `assets/`（新文件只在 `tools/t5/`、`docs/`）。
- JS：三个文件 terser 压缩后合计 **+2084 B**（RoomLightingRig +1519，WorldFlowCore +356，WorldFlowComponent +209）。

## 5. 风险
1. 盒子上没跑 Cocos/微信：插值是 3.8.8 公开 API（`Quat.slerp`、`Color.lerp`、`Vec4.lerp`、`ambient.skyColor/groundAlbedo`、`shadowSaturation`），但真实画面（tone mapping、阴影图在 fixed-area 下随太阳旋转的样子）必须在 Mac/真机上看。
2. 过渡期间太阳在转，室内 fixed-area 阴影图跟着转；阴影强度同时在淡出，预计不明显，需目测。
3. 门洞/窗洞"能看到室内 → 黑洞"仍在 `restore()` 那帧发生（关 `env_interior_shell`）。面积约占画面 1% 以内、远低于 8%，但如美术介意，可以在渐变结束后再关、或改成门洞也受同一过渡（不在本原型范围）。
4. 渐变期间切昼夜（`applyDayNight`）会按当前 w 重新计算，两端值随昼夜一起变，不会跳回 w=1。
5. `fixed` 镜头模式下镜头直接跳到终点，光照仍按走路时长渐变（无害）。
6. 补丁基于 near；baseline 上 `RoomLightingRig.ts`/`WorldFlowCore.ts` 有上下文差异，`git apply` 不能直接用，需要手工 rebase（逻辑相同）。叠加 df09ce8 没有冲突。

## 6. 已测 / 失败 / 未测
**已测（盒子，pinned Node 23.11.0 + typescript 5.8.3 + @cocos/creator-types 3.8.8，来自 work/GGbot 的 tools/vendor-node）**
- 视频逐帧亮度：出门 +34.4%/1 帧、回屋 −35.5%/1 帧，突变前镜头静止 ✓；walk3 夜间同样现象 ✓
- 资产核对：baseline 与 near 的灯塔/小屋 mesh、材质、贴图、LOD、烘焙设置 ✓（只有一套）
- `tools/t5/test_room_light_blend.cjs` 8/8 通过：出门/回屋调用顺序与时长、老 adapter 不带 blend 仍能完成、取消中途无 unhandled rejection 且落到稳定层、w=1 与旧室内值完全一致、w=0 与海岛值一致且之后 `restore()` 不再改变亮度、退出室内/销毁后为 no-op、53 帧与 376 帧过渡每帧 < 8%
- 回归：`tools/cloud-skycity/test_flow.cjs` ✓、`tools/cloud-skycity/test_adapter.cjs` ✓、`tools/test_camera0007_failure.cjs` ✓（42 条路径 / 7334 样本）
- tsc（cc.d.ts 3.8.8）：0 个新错误（near 原有 11 个）
- 与 df09ce8 的 `WorldFlowComponent.ts` 叠加 `git apply --check` ✓

**失败**
- `tools/cloud-island-camera/test_composition.cjs`：near `41fabe7` 原样就失败（期望值是旧镜头位姿），与本改动无关。

**未测**
- Mac Cocos 构建 + 微信开发者工具/真机录屏：需要主管跑出门、回屋（白天+夜晚）各一遍，用 `tools/t5/measure_video_jump.py <录屏> <开始秒> <时长>` 量 53 帧窗口内最大单帧跳变（目标 < 8%），并目测过渡期阴影和门洞。
- 真实渲染下的亮度曲线（盒子上是代理估算，不是渲染结果）。
- baseline 版本的补丁（需要 rebase）。

## 7. Mac 验证步骤
```
cd <repo> && git checkout work/GGbot-t5        # 或 cherry-pick 到要测的分支
# 照常 CLI 构建微信包（同 mac-tests/phase0-build.log 的命令），进游戏：
#  1) 白天：出门 → 录屏 08；回屋 → 录屏 11
#  2) 夜晚：__worldDayNight.set('night') 后重复
python3 tools/t5/measure_video_jump.py 08.mp4 <出门开始秒> <时长>   # 打印最差帧
# 运行时诊断：__worldDayNight.roomLighting().photometry 看 sunIlluminance / ambientSkyIllum / shadowSaturation 随走路连续变化
```
