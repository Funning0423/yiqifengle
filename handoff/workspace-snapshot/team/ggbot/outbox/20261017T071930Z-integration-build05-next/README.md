> **SUPERSEDED**：已被 integration-build05-next-r2 取代，见 SUPERSEDED.md。

# integration/build05-next-20261017T0702Z（GGbot）

- **分支**：`integration/build05-next-20261017T0702Z`（仅本地，未推送，未动 main）
- **HEAD**：`be1cd5aae04463e835080fcbca095a024bf2d2a7`
- **基线**：`21c187d`（lakeside v3.2）
- **文件**：`patches/`（17 个，21c187d..HEAD）、`integration-build05-next.bundle`（分支 ^21c187d）、`optional-water-dc/`（2 个可选提交，见第 5 节）、`suite.json`、`journey_atmosphere_blend.png`、`meshopt_measure*.{mjs,txt}`、`SHA256SUMS`

## 1. 提交列表（按顺序）与来源
| # | 本线 | 来源 | 内容 |
|---|---|---|---|
| — | （基线内） | c49801b / a17395c | A3 / A3b。已核对：`a17395c` 与 `a995c41` 的 tree 完全相同（`git diff` 为空） |
| — | 21c187d | lakeside v3.2 | 基线 |
| 1 | 0cbce91 | 场景设计部 b9f04f7（经 92b2df0） | 通用区域导出器；r5h3 transforms 重新导出（615→581）。无冲突，未重复 0932b6b（已是 fec63e9） |
| 2 | 46c66a4 | GGbot | 删除 4 个零实例 GLB：LK_boardwalk / LK_boardwalk_rail / LK_fishnet / LK_signpost。GLB 25,724 B + meta 11,793 B，源码共省 37,517 B |
| 3 | 68da5fb | GGbot | 加载修复 A：启用 meshopt 引擎模块（见第 3 节） |
| 4 | 2aa5957 | GGbot | 加载修复 B：第 18、67 行改用 `Array.from`；全仓 TS AST 扫描（112 处展开，没有其他非数组展开）；新增测试 es5-iterator-spread |
| 5 | 240ac97 | GGbot | 加载失败不再被吞掉：`[QF_LAKESIDE] load-failed` 只写日志；岛屿提示 「湖畔暂时没准备好，先回小岛吧」 |
| 6 | 0af6131 | GGbot | 打开风铃湖畔章节时预热 bundle / transforms / prefab / 水材质（120 s 后自动释放） |
| 7–12 | 6942e9a, 17ddca2, a8bc792, aa15e04, a724d48, 5e1a291 | 运镜bot 7595b85, eee4dfe, c375304, 0e39055, **b0c21d2**, **68478d9**（cine/lakeside-cam） | 湖畔镜头 r1→r3 + FlowReferenceStandin 冻结守卫。b0c21d2 以 0e39055 / c375304 为前提，因此整段都带上；0932b6b 跳过 |
| 13 | 88ed387 | Voice Bot 4728814 | 岛→湖畔旅程接线 + landing→board 挂钩调用点（冲突解决见第 2 节） |
| 14 | 5bdfdc5 | Voice Bot f3fce67 | 湖畔环境声（amb_lake_loop.mp3，57,836 B），海浪在湖畔让位 |
| 15 | 655ecd5 | GGbot（集成） | test-lakeside-journey-wire 的 pitch 守卫跟随 b0c21d2：竖屏 board.pitchDeg 已删除，横屏保持 75 |
| 16 | 9060208 | GGbot | (c) 旅程最后一段平滑过渡到湖畔光照（见第 4 节） |
| 17 | be1cd5a | GGbot | 所有风铃湖畔失败路径统一走友好兜底（见第 2.1 节） |

**LakesideLandingHook**：运镜bot 没有提交真正的 `lakesideLandingToBoard`，只在 LakesideCameraLayout 里提供了 `lakesideLandingBlend`（1 s）。因此挂钩仍是 Voice Bot 的空实现，落地→棋盘仍是硬切。交给运镜bot 接入，这里没有自行实现。

## 2. 冲突与处理
- **LakesideBoardBackground.ts**
  - 采用 Voice Bot 的 `mountLakesideScenery`，其中的 Array.from 也用他的版本。
  - 挂载之后保留 v3.2 的实例化、水着色器、方向光和雾。
  - 水材质在挂载后加载（bundle 已缓存）；水实例名从缓存的 transforms JSON 读取。
  - catch 保留 v3.3 的 `[QF_LAKESIDE] load-failed` 日志，并返回稳定原因，替代重复的 `[QF_LAKE] board-background` 那一行。
  - 加载步骤改为 owner / scenery / water-material / lights-camera。
  - 相机姿态改用运镜bot 的 `lakesideAlignedBoardPose`，并保留 applyDir。
- **RegionJourneyCore**：同时保留 island→lakeside 的顺序校验和运镜bot 的 `journey-invalid-timing` 校验。
- **WorldNativeComposition**：同时保留挂钩调用点和 v3.3 的失败交接。
- **run-suite**：测试 id 取并集。
- **适配器补充**：路线加上 `timing:L.timing`。这是运镜bot `lakesideJourney` 约定的 17 s S 曲线；Voice Bot 基于 c375304 时这个字段还不存在。

### 2.1 失败兜底（覆盖 Voice Bot 记 `[QF_LAKE]` 的所有路径）
- 旅程准备或步行失败、ensureRegion 拒绝、棋盘背景失败，都进入 `lakesideFallback`：
  - `[QF_LAKE]` 日志原样保留，另加一行 `{event:'lakeside-fallback',stage,reason,island}`；
  - 通过新增的 `WorldFlow.abandonLakesideJourney` 丢弃湖畔旅程，让她站回小岛，不进入「旅程暂时受阻」重试状态，存档不动；
  - 屏幕上只出现提示 「湖畔暂时没准备好，先回小岛吧」。
- cancelled / paused / busy 属于正常暂停与恢复，不弹提示。
- 环境声加载失败只写日志（海浪继续播放），不弹提示。
- HUD 代码中不出现任何 `[QF_LAKE]` 文本。

## 3. meshopt 与关闭网格压缩（48 个湖畔 GLB，实测编码字节）
用真实的 meshoptimizer 编码器加 zlib，在本机对 48 个 GLB 的网格数据逐个编码（`meshopt_measure.mjs`，结果在 `meshopt_measure_48glb.txt`）：

| 方案 | 网格字节（实测） | 引擎模块 | 合计 |
|---|---|---|---|
| **A. 保持 quantize+encode+zlib，开启 meshopt 模块（选用）** | **122,869 B** | +8,612 B（Mac 实测：19,205,697 − 19,197,085） | **131,481 B** |
| B. 关闭 encode（quantize+zlib） | 170,187 B | 0 | 170,187 B（比 A 多 38,706 B） |
| C. 只用 zlib | 214,151 B | 0 | 214,151 B |
| D. 原始数据 | 888,316 B | 0 | 888,316 B |

- 选 A：总字节最小，而且不用重新导入 48 个 GLB。审计时的 TEST-ONLY 构建已在 web 上验证 A 能加载。
- 注意：这里的网格字节是编码器的输出。Creator 构建后的真实包体还要加上 JSON 头，B 方案的构建包体尚未在 Mac 上测量（见清单第 4 项）。

## 4. (c) 旅程光照混合
- 新增纯函数模块 `region/LakesideJourneyAtmosphere.ts`。权重 w 用 smootherstep：
  - 从彩虹桥中点（15.5 m）开始，到停步前 1 m（38.2 m，全程 39.2 m）结束；
  - 换算到 17 s 定时步行，是 **7.15 s → 14.97 s**；
  - 60 Hz 下每帧颜色变化最多 1/255，没有跳变（见 `journey_atmosphere_blend.png`）。
- 目标值与棋盘 `applyDir/applyFog` 完全一致，并且从同一个小岛基值出发：
  - 主光方向 slerp 到 sunForward，颜色和照度 × sunIlluminanceScale；
  - 环境天光、地面光，skyIllum = 基值照度 × 0.75；
  - 世界相机清屏色过渡到 `#f2b98a`；
  - 雾跟随 `?lakefog`：layered 模式下 fogRange/w，雾层随湖畔根节点 y（−0.58 m）偏移；linear60 推远；off 不改动。
- 旅程场景在出发黑屏下显示时，`prime()` 记录小岛的原值，并以接近 0 的浓度开启雾。CC_USE_FOG 变体切换因此发生在黑屏里，进入棋盘时不再切换（有望缓解首次进入卡顿，需要实机确认）。
- 销毁或按「主页」时 `restore()` 恢复原值。
- 棋盘改为按 `lakesideJourneyBaseIllum()` 的基值缩放，避免双重缩放。
- 已知风险：
  - 小岛天穹网格可能仍挡住清屏色；
  - 停步后如果切换昼夜，主光会被昼夜系统改回去；
  - 旅程中挂载的 431 个实例**没有做实例化或合批**，DC 风险很高（属 Voice Bot 的 DC 范围）。

## 5. 可选：水色、条纹与 DC 提交（交给 Voice Bot 决定保留还是丢弃）
本地分支 `integration/build05-next-20261017T0702Z-optional-water-dc`，HEAD `c2eaf64a3f9b1fa868051776e5150b8ebac0d494`，叠在 be1cd5a 之上，没有并入主线。在 `optional-water-dc/` 下，两个提交彼此独立：

| 提交 | 来源 | 作用 | 代理 / 静态数字 |
|---|---|---|---|
| 51aaa85 | ded0725 | 水面专用光照系数 lightParams（主光 0.8、环境 0.35），天空反射 1.0→0.4，streak 噪声 0.4→0，波浪法线在 12→35 m 内淡出 | 拟合 Mac v3.2 实测像素 64/218/216 → 预测 ≈ 60–61/151–153/144，r5h3 目标 66/152/146（`water_tune_v33.cjs`）。湖心橙/青条纹的成因：R.y≈0.2 落在天空渐变段，再叠加 sin(x·3.1) 噪声 |
| c2eaf64 | 42126a0 | 棋盘背景静态合并：材质内容按贴图图像 + 采样器分组，单块不超过 65,535 顶点，`?lakemerge=off` 可做 A/B | 430 块合成 2 块（57,010 v + 1,080 v）+ 1 块未合并 + 水 ≈ 背景 4 个 DC（原 36），总计约 47（原 79）。仅静态推算 |

两者都通过了湖畔测试。

## 6. 测试
`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript node tools/journey-integration/run-suite.cjs` 在 HEAD be1cd5a 上：**62/67**。

- 未通过的只有已知的 5 项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract、navigation-guard（BLOCKED）。
- 湖畔相关 14 项全部通过：rules、entry、instancing、dirlight、water-fog、meshopt、es5-iterator-spread、load-failure、prewarm、journey-atmosphere（新）、fallback（新）、camera、journey-wire、lake-ambience。

## 7. 包体估算（需在 Mac 上实测）
| 项 | 估算 |
|---|---|
| 21c187d（+TEST-ONLY）实测 | 19,197,085 B |
| meshopt 模块 | +8,612 B（实测） |
| 删除 4 个 GLB 的构建产物 | 约 −6～−14 KB（网格约 2.3 KB + 每个 GLB 的 prefab/材质/网格 JSON） |
| transforms JSON（615→581） | 源码 −5,211 B |
| 湖畔环境声 mp3（+meta） | +57,836 B（+约 1 KB） |
| 脚本（运镜 + Voice + GGbot，源码净增约 51 KB 代码） | 约 +20～35 KB（压缩后） |
| **合计** | **约 19.27–19.29 MB**；比 09a1b8e（19,125,680 B）多约 +0.15 MB；距 24,641,536 B 安全线还有约 5.35 MB |

## 8. Mac 测试清单
1. **干净构建**：不打 TEST-ONLY 补丁，`tools/build-guard/build-wechat-guarded.sh`。
   - 记录 wechat 总字节、与 09a1b8e（19,125,680）的差值、与安全线 24,641,536 的距离；
   - 记录 region_lakeside 子包字节（之前 464,387 B，现在应约 +58 KB 环境声、−4 个 GLB）。
2. **湖畔能加载**：控制台中 decodeVertexBuffer 报错 0 次，没有 `lakeside-prefab-missing`。在 web 预览、微信开发者工具、真机上各看一次。
3. **meshopt 对照（可选）**：在一个临时分支把 48 个 meta 的 encode 改为 false，重建后记录 region_lakeside 字节；与第 1 项对比，确认 A 方案更小（预计差约 30–40 KB）。
4. **提示路径**：分别人为制造三种失败：
   - 旅程准备失败（例如临时改坏 bundle 名）；
   - 旅程中途杀掉网络；
   - 棋盘失败（例如临时删掉水材质路径）。

   每种都应只看到提示 「湖畔暂时没准备好，先回小岛吧」，她站在小岛上，没有「旅程暂时受阻」，屏幕上没有任何英文或技术文字；控制台有 `[QF_LAKE]` / `[QF_LAKESIDE]` 日志。暂停或取消旅程不应弹提示。
5. **岛→湖畔旅程，白天和夜晚各一次**：
   - 记录 DC / FPS / 内存的峰值和平均值（重点看桥后段：小岛与 431 个湖畔实例同时在场）；
   - 光照从过桥中段开始逐渐变暖，约 15 s 时完成，没有跳变或闪烁；
   - 出发黑屏后没有明显卡顿（雾变体在黑屏里编译）；
   - 记录首次进入的最长帧（之前是 1683 ms）。
6. **棋盘**：DC / FPS / 内存（参考 v3.2：背景 36 + 棋盘/UI 约 43 = 79；可选分支预期 ≈ 47，可用 `?lakemerge=off` 做 A/B）。
7. **落地→棋盘连续性**：落地最后一帧和棋盘首帧的光照、色调、雾应一致（亮度不应翻倍）。镜头目前仍是硬切（等运镜bot 的挂钩）。白天和夜晚各截一组对比图。
8. **环境声**：
   - 进入湖畔的最后一段路和棋盘时，湖水加风铃循环淡入（1.2 s），海浪淡出；
   - 按「主页」回小岛后，湖畔声淡出（0.8 s），海浪恢复；
   - 设置滑块为 0 时静音；
   - 人为让 mp3 加载失败：只有 `[QF_LAKE] lake ambience … failed` 日志，海浪继续，不弹提示。
9. **默认雾为 layered**；`?lakefog=linear60` / `off` 仍可切换。
10. **清理**：删除 Mac 上的临时分支和改动，恢复构建目录。

## 9. 未验证
- 本机没有 Creator 和真机，着色器未经编译验证；所有渲染数字都是代理或静态估算。
- cc 类型声明缺失，只做了语法级 transpile 检查和自审。
