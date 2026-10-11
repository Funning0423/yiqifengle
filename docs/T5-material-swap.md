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

## 3. 统一方案

**原则：外景能看到的时候只用一套光，就是场景原来的海岛光；室内光只在镜头在屋里时生效；两者之间按镜头分段进度连续过渡，不再一帧切换。**

分工（主管已定）：光照接口只有一个 `setRoomLightWeight`，由 GGbot 维护；**由运镜bot 在 T2+ 里按镜头分段进度驱动 w**（出门：toIsland 到升镜之间 w→0；回屋：先保持海岛光，在 toThreshold/crossing-in 内 w→1）；门洞黑洞遗留也归运镜bot；声音bot 读同一条曲线驱动环境声。

> **注意：本提交只提供接口，不驱动。** WorldFlowCore 已回到 near 原行为，所以在运镜bot 接上之前，**出门 22.75 s 和回屋开头那一帧的跳变（+34%/−35%）仍然存在**，跟 near 一样。旧的自动渐变（第一版 `bf00258`）没有保留成开关：放进 Core 要加配置项和时序代码，不算"很小的改动"，而且跟运镜bot 的驱动会重复。

## 4. API（最终版）

位置与签名：
- `render/RoomLightingRig.ts`
  - `setRoomLightWeight(weight: number): boolean`
  - `getRoomLightWeight(): number`
  - 文件头注释写了完整契约
- `world-r1/WorldFlowComponent.ts`（透传，其他模块从这里拿）
  - `setRoomLightWeight(weight:number):boolean`；没有 rig 时返回 false
  - `getRoomLightWeight():number`；没有 rig 时返回 0
  - 调试：`__worldDayNight.roomLightWeight()`
- `world-r1/WorldFlowCore.ts` 的 `WorldLease` 新增三个**可选**成员（Core 自己不调用；老 adapter 和测试桩不用改）：
  - `setRoomLightWeight?(weight)`
  - `getRoomLightWeight?()`
  - `blendRoomLight?(from,to,seconds,token):Promise<void>`

契约：
1. **取值**：w ∈ [0,1]，超出范围会被截断（−1→0，2→1）；NaN/±Infinity 拒绝，返回 false，状态不变。
2. **端点**：
   - w=0：场景原海岛光。Main Light 用场景原朝向，亮度/颜色是昼夜逻辑刚写入的值；环境光 skyIllum/skyColor/groundAlbedo 用原值；室内阴影强度为 0。
   - w=1：室内光，赋值和 T5 之前的 `setView(interior=true)` **逐条相同**，屋内画面不变。
   - 中间值：太阳朝向 slerp，亮度/颜色/环境光 lerp，`shadowSaturation = 室内值×w`。
3. **只在包含室内的视图里有效**（HOME 或 BOTH，即 rig 处于 interior）。不在室内视图时，set 返回 false、get 返回 0；dispose 之后同样。
4. **和 restore()/setLayers 的关系**：
   - `setLayers(HOME)` 或 `setLayers(BOTH)`：w **强制设为 1**，包括本来就在室内视图的情况。
   - `restore()` 落到 ISLAND/NONE（interior=false）：w 设为 0，并执行原来的 `restoreSun`（恢复阴影开关和尺寸）。
   - `restore()` 落到 HOME：w=1。
   - `restore()` 会先调 `cancelTransient()`，所以正在进行的 `blendRoomLight` 会被取消。
   - 昼夜切换（`applyDayNight` 再次调 `setView(true)`）**保留当前 w**，只按新的昼夜端点重新计算。
   - 想让 BOTH 一开始就是海岛光：在**同一个同步步骤**里先 `setLayers(BOTH)` 再 `setRoomLightWeight(0)`，中间没有渲染帧，所以不会闪。
5. **`blendRoomLight(from,to,seconds,token)`**：跟 animateDoor/animateCamera 是同一套 job 机制。
   - 调用时同步写入 `from`，之后每帧按 `elapsed/seconds` 线性推进，结束时恰好写入 `to` 再 resolve。
   - `seconds<=0` 或非有限值：直接写 `to` 并 resolve。
   - token 已取消时调用：同步抛出 Cancelled。
   - 中途被取消（token.cancel / cancelTransient / dispose）：reject Cancelled，**w 停在最后写入的值，不回弹**；之后再调 setLayers/restore 会按第 4 条落到确定状态。
6. **幂等**：同一个 w 总是产生相同的写入，和之前经过哪些值无关（0.3 经过 0.9 再回 0.3 = 直接设 0.3），不会累积误差。
7. **读取**：`getRoomLightWeight()` 只读，供每帧轮询，**没有事件**。声音bot 直接轮询即可。

## 5. 包体影响
- 不改任何资产（glb/材质/贴图/场景/meta 都没动），`assets/` 下没有新增文件（新文件只在 `tools/t5/`、`docs/`）。
- JS（terser 压缩后，对比 near）：RoomLightingRig +1584 B，WorldFlowComponent +547 B，WorldFlowCore +0 B（只加了类型声明），**合计 +2131 B**。

## 6. 风险
1. 盒子上没跑 Cocos/微信。插值用的都是 3.8.8 公开 API（`Quat.slerp`、`Color.lerp`、`Vec4.lerp`、`ambient.skyColor/groundAlbedo`、`shadowSaturation`），但真实画面要在 Mac/真机上看。
2. 过渡期间太阳在转，室内 fixed-area 阴影图会跟着转，同时阴影强度在淡出，需要目测。
3. 门洞黑洞（`restore()` 那帧关掉 `env_interior_shell`）归运镜bot。
4. 运镜bot 接上之前，跳变仍在（见 §3）。
5. 补丁基于 near；放到 baseline 需要手工 rebase（逻辑相同）。叠加 df09ce8 没有冲突。

## 7. 已测 / 失败 / 未测
**已测（盒子，用 work/GGbot 里的 tools/vendor-node：Node 23.11.0 + typescript 5.8.3 + @cocos/creator-types 3.8.8）**
- 视频逐帧亮度：出门 +34.4%/1 帧、回屋 −35.5%/1 帧，突变前镜头静止 ✓；walk3 夜间同样现象 ✓
- 资产核对：baseline 和 near 的灯塔/小屋只有一套 ✓
- `tools/t5/test_room_light_blend.cjs` 13/13 ✓：
  - A：Core 不驱动 w；老 adapter 没有光照 API 也能完成流程；Core 和 near 的差异只有可选 API 成员
  - B：w=1 与旧室内值逐条一致；w=0 与场景海岛值一致，之后 restore 不再改亮度；截断与拒绝；幂等/与路径无关；不在室内或 dispose 后 set=false、get=0；昼夜切换保留 w
  - C：从 WorldFlowComponent 原样抽取 `run`/job 循环/`blendRoomLight`/透传方法来驱动真实 rig：端点、逐帧线性、seconds≤0、token 取消和 cancelJobs 取消都停在最后的 w、已取消的 token 同步抛错、没有 rig 时透传返回 0/false
  - D：用模拟的镜头分段进度驱动 w 做跳变估算：不驱动时单帧 34.4%；53 帧内过渡最差 3.28%/帧；toIsland（376 帧）0.55%/帧；toThreshold（423 帧）0.49%/帧（估算，不是渲染结果）
- 回归：`cloud-skycity/test_flow` ✓、`cloud-skycity/test_adapter` ✓、`test_camera0007_failure` ✓
- tsc：0 个新错误（near 原有 11 个）

**失败**
- `tools/cloud-island-camera/test_composition.cjs`：near `41fabe7` 原样就失败（期望值是旧镜头位姿），与本改动无关。

**未测**
- Mac 构建 + 微信/真机，要等运镜bot 接上驱动之后才有意义：录出门/回屋（白天+夜晚），用 `tools/t5/measure_video_jump.py <录屏> <开始秒> <时长>` 量 53 帧内最大单帧跳变（目标 < 8%）。
- 只接了 API、还没驱动时的真机：应该与 near 完全一样（w 始终是 0 或 1）。
- baseline 版本（需要 rebase）。

## 8. 运行测试
```
N=<work/GGbot>/tools/vendor-node/node-runtime/node-v23.11.0-linux-x64/bin/node
QF_TYPESCRIPT_MODULE=<work/GGbot>/tools/vendor-node/node_modules/typescript $N --no-warnings tools/t5/test_room_light_blend.cjs
QF_TYPESCRIPT_MODULE=... $N tools/t5/print_walk_durations.cjs     # toIsland / toThreshold 时长
```
