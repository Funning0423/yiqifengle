# Build05 旅途 v3 验收（764dcd8 / tree c97f0c4b）
## 开始前（Mac 18:33 CST = 06:33 ET）
- 没有 Creator 进程在跑；剩余 5,128,408 KiB ≈ 4.89 GiB
- 临时目录 ~/qf-v3-tmp，origin push=DISABLED，depth-1 fetch 751905c
- 中间提交（a373227…0a9161c）只在本机仓库里，GitHub 上没有，所以打成 bundle（751905c..0a9161c，1.79MB），和 outbox 的 3 个补丁一起打包成 v3.tgz（sha1 76d5ac8c…），按 700KB 分块传过去。
- 补丁 sha256：0001 533c74b3… / 0002 fb2514d0… / 0003 46505ee3…

## 代码准备 ✅
- bundle 校验通过，fetch 后得到 0a9161c；在它上面 git am 0001–0003：
  - 0001 → tree 4d22fd7d… ✅（等于 441792b）
  - 0002 → tree 6e3f27af… ✅（等于 cb4f846）
  - 0003 → tree **c97f0c4b938b627b2a011379d84abb8ce27f4515** ✅（等于 764dcd8；本地 commit 号 fb6c14c，因为 committer 不同）
- 18:45 CST 开始构建：先微信 release（debug=false、sourceMaps=false），再 web(debug) 用来录屏

## 构建 ✅（18:54 CST，微信 release 和 web 都 exit 36；构建期间没有其他 Creator 进程）
构建前 Mac 剩余：（开始时 5,128,408 KiB；构建后 3,725,192 KiB）

### 微信 release 包体（字节）
| 分包 | 字节 | 上次 4c30cf7 |
|---|---|---|
| main 分包 | 1,118,103 | 1,114,395 |
| internal | 297,535 | 297,535 |
| resources | 433,034 | 433,034 |
| **shared_effects** | **563,694** | （没有） |
| audio_bgm_island | 502,421 | 502,421 |
| board_art | 2,112,889 | 2,675,272 |
| region_island | 8,912,266 | 9,474,651 |
| region_meadow | 3,007,055 | 3,569,608 |
| **region_skycity** | **3,372,502** | 7,829,515 |
| static_seat_preview | 3,471,832 | 4,034,372 |
| **主包（总−分包）** | **1,861,999 = 1.78 MiB ≤ 4 MiB ✅** | 1,861,856 |
| **总包** | **25,653,330 = 24.46 MiB > 24 MiB ❌（超 487,754 B）** | 31,792,659 |

### 三项确认
1. builtin-standard 只打包了一份 ✅：整个构建产物里，shader 源码（含 builtin-standard|shadow-caster-vs / planar-shadow-vs 等 pass）只出现在 `subpackages/shared_effects/import/0f/0f7852dde.json`（562,673 B）这一个文件；另外只有 `subpackages/main/game.js` 里出现了这个名字（只是引用，不含源码）。builtin effect 的 uuid c8f66d17-351a-48da-a12c-0212d28575c4 在产物里搜不到（已被 shared_effects 里的那份替代）。shared_effects 材质 uuid a5aabc81-…。
2. .meta 改写 ✅ 没有：构建后在 v3 worktree 里跑 `git status --short`，结果为空，没有任何 .meta（包括材质 .meta 和 env_skycity.glb.meta）被改写。构建日志只有 GLTF 扩展不支持的警告（KHR_materials_specular / emissive_strength），没有错误。
3. shared_effects 的加载顺序：看下面录屏一节里的网络日志

## 录屏
- 07:23 ET 恢复：day 两段（24/25）已经录完；night 被中断，删掉残留的 tmp 后重录 night。server 8831 还在跑。
- 四段录屏都录完（Mac 19:20–19:31 CST）。传回 out.tar（sha1 a5f9b1ce…，7MB 分块，两边一致），然后删除 Mac 上 ~/qf-v3-tmp 整个目录（clone、worktree、web 构建、Creator library 缓存、录屏），并停掉 8831。
- night：props().night=true，TZ Etc/GMT-12（录的时候当地 23 点）
- Mac 剩余空间：开始时 5,128,408 KiB → 录完、删除前 3,697,528 KiB → 删除后 **4,172,100 KiB（约 3.98 GiB）**。比开始时少了约 0.9 GiB，不是这个任务占的（任务目录已经全部删掉，同期别的进程在写盘）。

### 第 3 项确认：shared_effects 的加载顺序 ✅（web 构建，Playwright 网络日志，时间从页面打开算起）
25 day：internal 0.328s → main 0.360 → resources 0.361 → **shared_effects 0.596（200）** → board_art / static_seat_preview 0.630 → region_island 0.809 → audio_bgm_island 1.466 → region_meadow 26.251 → region_skycity 60.396
24 day 也是同样顺序（shared_effects 0.632 请求、0.636 两个文件都 200）。shared_effects 在所有业务分包之前加载；排在它前面的只有引擎自带的 internal/main/resources。没有 requestfailed。
控制台没有 shared_effects 或 effect 相关的报错。现有报错是 startup-art/*.png/jpg 加载失败、17 个 404、5 个 ERR_CONNECTION_RESET，跟这次改动无关（web 模板缺启动图）。
注意：这是 web 构建上的加载顺序，微信真机上的顺序没测。

## 逐项对照上次的 FAIL（时间 = 视频秒数；"旅途+"= 从 travelStart 算起）
旅途标记：08→09 day 62.53→100.86（38.33s），night 59.48→97.81（38.33s）；04→05 day 34.61→61.61（27.00s），night 36.86→63.92（27.06s）。

| # | 项 | 结果 | 数据 / 时间点 | 证据 |
|---|---|---|---|---|
| 1 | 08→09 镜头不甩、她全程在画内 | ✅ | 旅途内帧差最大值：day 23.6（99.3–99.9，旅途+36.8–37.4，最后转向广场），上次是 50.2；每帧位移 ≤11px，上次 40–70px；night 最大 16.6（96.4–97.0），上次 34.9。全程每秒抽帧都看得到她，上次 94.0–94.9 她出画的问题没了。注意：92–99（旅途+30–37）镜头拉得很高，她只有约 25–40px 高，在木板之间很小 | sbs/0809_day_old4c30cf7_vs_v3.mp4、frames/sheet_25_v3_day_p750.png、logs/motion_*.json |
| 2 | 落地最后一帧：广场居中、她约占 1/6 屏高、前景不挡 | ⚠️ 部分通过 | day 100.8 / night 97.75：她从帽顶 y≈472 到脚 y≈627，**约 155px / 812 = 19%（约 1/5.2）**，接近 1/6 ✅；前景只有底部的草花，没挡住她 ✅；**广场不居中** ❌：广场在画面上方 y≈170–290（约 21–36% 高处），画面正中 y≈290–470 被浮岛的棕色岩体占住 | frames/final_v3_day_100.8.png、final_v3_night_97.75.png、cmp_final_old_vs_v3_day_night.png |
| 3 | 浮岛灰色底面不再大面积压屏 | ✅ | 上半屏低饱和灰色占比（旅途+10..29s）：上次 day 最高 21.9%（旅途+23），night 30.6%；v3 day 在同一时段最高 10.4%，night 最高 7.3%。v3 day 旅途+10/+11 的 23.7%/19.8% 是草地上的灰色小路，不是浮岛底面（看帧确认）。现在出现的浮岛底面是棕色岩层，不是灰色 | logs/grey.txt、sheet_25_v3_*.png |
| 4 | 原 90–92s 不再有平涂绿地 | ❌（有改进） | 对应 v3 的 93–95（旅途+30.5–32.5）：有了顶点色深浅块和花草，但圆岛表面还是大块单色绿色三角面，木板顶面也是整块平涂的绿色 | frames/cmp_ground_old90-92_vs_v3_93-95.png |
| 5 | 04→05 出发后镜头先跟着她，不先飞向桥 | ⚠️ | 不再先飞去桥那边、人出画（上次 35.6–38.3 她不在画内）。但出发后头约 5–9s（day 34.6–43.5）是远景：镜头从岛的全景慢慢跟着她，她只有约 15–25px 高，在 37.5 左右才看得清她在岛边走上桥；约 44s 才切到身后跟拍 | frames/k_0405_start_v3_day.png、sheet_24_v3_day_p750.png、sbs/0405_day_old_vs_v3.mp4 |
| 6 | 夜间旅途天空是夜色、海面深色 | ❌ | 海面（蓝色主导像素）均值，night v3 08→09：亮度 Y 0.43–0.50，色相 199–204°，RGB≈(34–66,120–140,168–185)；上次 night Y 0.48–0.50、色相 198–203°，**基本没变**，仍是中等亮度的青蓝色，不是深色。白天作对比是 Y 0.61–0.67、色相 192–194°。04→05 night 前 10s 海面 Y 0.44–0.56，到旅途+16s（草地段）天空才变成深蓝 RGB(26,61,111)、Y 0.23。天空城一段（08→09 最后几秒）天空是深蓝夜色 ✅，草地和彩虹桥段看不到天空，海面仍是青色 | logs/sea_hsv.txt、sbs/0809_night_old_vs_v3.mp4 |

## 结论
- 包体：主包 1,861,999 B ✅；**总包 25,653,330 B = 24.46 MiB，超出 24 MiB 上限 487,754 B ❌**；region_skycity 从 7,829,515 B 降到 3,372,502 B
- 三项确认都通过：shader 只有一份；没有 .meta 被改写；shared_effects 在所有业务分包之前加载且返回 200（web 构建）
- 录屏：第 1、3 项通过；第 2、5 项部分通过；第 4、6 项不通过
